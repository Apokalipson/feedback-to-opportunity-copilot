begin;

create unique index opportunity_cards_one_per_group
  on public.opportunity_cards (group_id)
  where group_id is not null;

create function public.replace_current_import_analysis(
  p_import_id uuid,
  p_model_identifier text,
  p_analysis_version text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_analysis jsonb;
  v_group jsonb;
  v_card jsonb;
  v_evidence jsonb;
  v_response_id uuid;
  v_group_id uuid;
  v_card_id uuid;
  v_group_key text;
  v_text_field text;
  v_source_quote text;
  v_group_ids jsonb := '{}'::jsonb;
  v_research_questions text[];
  v_eligible_count integer;
  v_analysis_count integer;
  v_group_count integer;
  v_card_count integer;
  v_evidence_count integer := 0;
begin
  if v_owner_id is null then
    raise exception using
      errcode = '42501',
      message = 'analysis_authentication_required';
  end if;

  if p_model_identifier is null
    or char_length(p_model_identifier) not between 1 and 120
    or p_analysis_version is null
    or char_length(p_analysis_version) not between 1 and 64
  then
    raise exception using
      errcode = '22023',
      message = 'analysis_metadata_invalid';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'analyses') <> 'array'
    or jsonb_typeof(p_payload -> 'groups') <> 'array'
    or jsonb_typeof(p_payload -> 'cards') <> 'array'
  then
    raise exception using
      errcode = '22023',
      message = 'analysis_payload_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_import_id::text, 0)
  );

  if not exists (
    select 1
    from public.imports as i
    where i.id = p_import_id
      and i.owner_id = v_owner_id
      and i.is_current
      and i.status = 'ready'
  ) then
    raise exception using
      errcode = '22023',
      message = 'analysis_import_not_available';
  end if;

  if exists (
    select 1
    from public.opportunity_cards as c
    where c.import_id = p_import_id
      and c.owner_id = v_owner_id
      and c.review_status <> 'pending'
  ) then
    raise exception using
      errcode = '55000',
      message = 'analysis_has_human_reviews';
  end if;

  select count(*)::integer
  into v_eligible_count
  from public.survey_responses as r
  where r.import_id = p_import_id
    and r.owner_id = v_owner_id
    and r.validation_status in ('valid', 'warning')
    and exists (
      select 1
      from pg_catalog.jsonb_each(r.normalized_texts) as item(key, value)
      where item.key in (
        'q1b_csat_comment',
        'q1c_csat_comment',
        'q1d_csat_comment',
        'q2_other_text',
        'q3_other_text',
        'q3b_feature_comment',
        'q4b_ces_comment',
        'q5_comment'
      )
        and pg_catalog.jsonb_typeof(item.value) = 'string'
        and pg_catalog.btrim(item.value #>> '{}') <> ''
    );

  v_analysis_count := pg_catalog.jsonb_array_length(p_payload -> 'analyses');
  v_group_count := pg_catalog.jsonb_array_length(p_payload -> 'groups');
  v_card_count := pg_catalog.jsonb_array_length(p_payload -> 'cards');

  if v_eligible_count < 1
    or v_eligible_count > 25
    or v_analysis_count <> v_eligible_count
    or v_group_count not between 1 and 10
    or v_card_count <> v_group_count
  then
    raise exception using
      errcode = '22023',
      message = 'analysis_payload_count_mismatch';
  end if;

  delete from public.opportunity_cards
  where import_id = p_import_id and owner_id = v_owner_id;

  delete from public.feedback_groups
  where import_id = p_import_id and owner_id = v_owner_id;

  delete from public.response_analyses
  where import_id = p_import_id and owner_id = v_owner_id;

  for v_analysis in
    select value from pg_catalog.jsonb_array_elements(p_payload -> 'analyses')
  loop
    v_response_id := (v_analysis ->> 'response_id')::uuid;

    if not exists (
      select 1
      from public.survey_responses as r
      where r.id = v_response_id
        and r.import_id = p_import_id
        and r.owner_id = v_owner_id
        and r.validation_status in ('valid', 'warning')
    ) then
      raise exception using
        errcode = '22023',
        message = 'analysis_response_invalid';
    end if;

    if (v_analysis ->> 'topic') not in (
      'usability', 'reliability', 'performance', 'discoverability',
      'clarity', 'trust', 'support', 'other'
    )
      or (v_analysis ->> 'sentiment') not in (
        'negative', 'mixed', 'neutral', 'positive'
      )
      or (v_analysis ->> 'product_area') not in (
        'my_display', 'my_lock', 'find_my_glo', 'my_session',
        'my_usage', 'ecosystem_other'
      )
      or char_length(pg_catalog.btrim(v_analysis ->> 'user_problem'))
        not between 1 and 1000
      or (v_analysis ->> 'confidence')::numeric not between 0 and 1
      or jsonb_typeof(v_analysis -> 'uncertainty_reasons') <> 'array'
      or jsonb_array_length(v_analysis -> 'uncertainty_reasons') > 3
    then
      raise exception using
        errcode = '22023',
        message = 'analysis_item_invalid';
    end if;

    insert into public.response_analyses (
      response_id,
      import_id,
      owner_id,
      topic,
      user_problem,
      sentiment,
      product_area,
      confidence,
      uncertainty_metadata,
      model_identifier,
      analysis_version
    ) values (
      v_response_id,
      p_import_id,
      v_owner_id,
      v_analysis ->> 'topic',
      pg_catalog.btrim(v_analysis ->> 'user_problem'),
      v_analysis ->> 'sentiment',
      v_analysis ->> 'product_area',
      (v_analysis ->> 'confidence')::numeric,
      pg_catalog.jsonb_build_object(
        'reasons', v_analysis -> 'uncertainty_reasons'
      ),
      p_model_identifier,
      p_analysis_version
    );
  end loop;

  for v_group in
    select value from pg_catalog.jsonb_array_elements(p_payload -> 'groups')
  loop
    v_group_key := v_group ->> 'group_key';

    if v_group_key is null
      or v_group_key !~ '^[a-z0-9_-]{1,64}$'
      or v_group_ids ? v_group_key
      or char_length(pg_catalog.btrim(v_group ->> 'label')) not between 1 and 160
      or char_length(pg_catalog.btrim(v_group ->> 'summary')) not between 1 and 1000
      or (v_group ->> 'confidence')::numeric not between 0 and 1
      or jsonb_typeof(v_group -> 'response_ids') <> 'array'
      or jsonb_array_length(v_group -> 'response_ids') not between 1 and 25
    then
      raise exception using
        errcode = '22023',
        message = 'analysis_group_invalid';
    end if;

    insert into public.feedback_groups (
      import_id,
      owner_id,
      label,
      summary,
      confidence,
      grouping_version
    ) values (
      p_import_id,
      v_owner_id,
      pg_catalog.btrim(v_group ->> 'label'),
      pg_catalog.btrim(v_group ->> 'summary'),
      (v_group ->> 'confidence')::numeric,
      p_analysis_version
    ) returning id into v_group_id;

    v_group_ids := pg_catalog.jsonb_set(
      v_group_ids,
      array[v_group_key],
      pg_catalog.to_jsonb(v_group_id::text)
    );

    for v_response_id in
      select value::text::uuid
      from pg_catalog.jsonb_array_elements_text(v_group -> 'response_ids')
    loop
      if not exists (
        select 1
        from public.response_analyses as a
        where a.response_id = v_response_id
          and a.import_id = p_import_id
          and a.owner_id = v_owner_id
      ) then
        raise exception using
          errcode = '22023',
          message = 'analysis_group_member_invalid';
      end if;

      insert into public.group_memberships (
        group_id,
        response_id,
        import_id,
        owner_id,
        confidence
      ) values (
        v_group_id,
        v_response_id,
        p_import_id,
        v_owner_id,
        (v_group ->> 'confidence')::numeric
      );
    end loop;
  end loop;

  if (
    select count(*) <> v_analysis_count
      or count(distinct response_id) <> v_analysis_count
    from public.group_memberships
    where import_id = p_import_id and owner_id = v_owner_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'analysis_group_coverage_invalid';
  end if;

  for v_card in
    select value from pg_catalog.jsonb_array_elements(p_payload -> 'cards')
  loop
    v_group_key := v_card ->> 'group_key';
    v_group_id := (v_group_ids ->> v_group_key)::uuid;

    if v_group_id is null
      or char_length(pg_catalog.btrim(v_card ->> 'user_need'))
        not between 1 and 1000
      or char_length(pg_catalog.btrim(v_card ->> 'potential_solution'))
        not between 1 and 1500
      or jsonb_typeof(v_card -> 'research_questions') <> 'array'
      or jsonb_array_length(v_card -> 'research_questions') not between 1 and 4
      or exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          v_card -> 'research_questions'
        ) as question(value)
        where char_length(pg_catalog.btrim(question.value)) not between 1 and 500
      )
      or jsonb_typeof(v_card -> 'evidence') <> 'array'
      or jsonb_array_length(v_card -> 'evidence') not between 1 and 3
    then
      raise exception using
        errcode = '22023',
        message = 'analysis_card_invalid';
    end if;

    select pg_catalog.array_agg(pg_catalog.btrim(value) order by ordinality)
    into v_research_questions
    from pg_catalog.jsonb_array_elements_text(
      v_card -> 'research_questions'
    ) with ordinality as question(value, ordinality);

    insert into public.opportunity_cards (
      group_id,
      import_id,
      owner_id,
      user_need,
      potential_solution,
      research_questions,
      review_status,
      ai_generated,
      analysis_version
    ) values (
      v_group_id,
      p_import_id,
      v_owner_id,
      pg_catalog.btrim(v_card ->> 'user_need'),
      pg_catalog.btrim(v_card ->> 'potential_solution'),
      v_research_questions,
      'pending',
      true,
      p_analysis_version
    ) returning id into v_card_id;

    for v_evidence in
      select value from pg_catalog.jsonb_array_elements(v_card -> 'evidence')
    loop
      v_response_id := (v_evidence ->> 'response_id')::uuid;
      v_text_field := v_evidence ->> 'text_field';

      if v_text_field not in (
        'q1b_csat_comment',
        'q1c_csat_comment',
        'q1d_csat_comment',
        'q2_other_text',
        'q3_other_text',
        'q3b_feature_comment',
        'q4b_ces_comment',
        'q5_comment'
      ) or not exists (
          select 1
          from public.group_memberships as m
          where m.group_id = v_group_id
            and m.response_id = v_response_id
            and m.import_id = p_import_id
            and m.owner_id = v_owner_id
        )
      then
        raise exception using
          errcode = '22023',
          message = 'analysis_evidence_invalid';
      end if;

      select pg_catalog.btrim(r.normalized_texts ->> v_text_field)
      into v_source_quote
      from public.survey_responses as r
      where r.id = v_response_id
        and r.import_id = p_import_id
        and r.owner_id = v_owner_id;

      if v_source_quote is null or v_source_quote = '' then
        raise exception using
          errcode = '22023',
          message = 'analysis_evidence_source_missing';
      end if;

      if char_length(v_source_quote) > 500 then
        v_source_quote := pg_catalog.substr(v_source_quote, 1, 499) || '…';
      end if;

      insert into public.opportunity_evidence (
        card_id,
        response_id,
        import_id,
        owner_id,
        representative_quote
      ) values (
        v_card_id,
        v_response_id,
        p_import_id,
        v_owner_id,
        v_source_quote
      );

      v_evidence_count := v_evidence_count + 1;
    end loop;
  end loop;

  if (
    select count(*) <> v_group_count
      or count(distinct group_id) <> v_group_count
    from public.opportunity_cards
    where import_id = p_import_id and owner_id = v_owner_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'analysis_card_coverage_invalid';
  end if;

  return pg_catalog.jsonb_build_object(
    'analyses', v_analysis_count,
    'groups', v_group_count,
    'cards', v_card_count,
    'evidence', v_evidence_count
  );
end;
$$;

revoke execute on function public.replace_current_import_analysis(
  uuid,
  text,
  text,
  jsonb
) from public, anon;

grant execute on function public.replace_current_import_analysis(
  uuid,
  text,
  text,
  jsonb
) to authenticated;

revoke insert, update, delete
on table
  public.response_analyses,
  public.feedback_groups,
  public.group_memberships,
  public.opportunity_cards,
  public.opportunity_evidence
from authenticated;

commit;
