begin;

create function public.review_current_opportunity_card(
  p_import_id uuid,
  p_card_id uuid,
  p_expected_updated_at timestamptz,
  p_user_need text,
  p_potential_solution text,
  p_research_questions text[],
  p_review_status public.review_status,
  p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_card record;
  v_user_need text := pg_catalog.btrim(p_user_need);
  v_potential_solution text := pg_catalog.btrim(p_potential_solution);
  v_research_questions text[];
  v_review_note text := pg_catalog.nullif(pg_catalog.btrim(p_review_note), '');
  v_edited_fields jsonb := '{}'::jsonb;
  v_updated_at timestamptz;
begin
  if v_owner_id is null then
    raise exception using
      errcode = '42501',
      message = 'review_authentication_required';
  end if;

  if p_import_id is null
    or p_card_id is null
    or p_expected_updated_at is null
    or p_review_status is null
    or p_user_need is null
    or p_potential_solution is null
    or char_length(v_user_need) not between 1 and 1000
    or char_length(v_potential_solution) not between 1 and 1500
    or p_research_questions is null
    or cardinality(p_research_questions) not between 1 and 4
    or exists (
      select 1
      from pg_catalog.unnest(p_research_questions) as question(value)
      where question.value is null
        or char_length(pg_catalog.btrim(question.value)) not between 1 and 500
    )
    or (
      select count(*) <> count(distinct pg_catalog.lower(pg_catalog.btrim(question.value)))
      from pg_catalog.unnest(p_research_questions) as question(value)
    )
    or (v_review_note is not null and char_length(v_review_note) > 1000)
  then
    raise exception using
      errcode = '22023',
      message = 'review_payload_invalid';
  end if;

  select pg_catalog.array_agg(pg_catalog.btrim(question.value) order by question.ordinality)
  into v_research_questions
  from pg_catalog.unnest(p_research_questions) with ordinality
    as question(value, ordinality);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_card_id::text, 0)
  );

  select
    c.user_need,
    c.potential_solution,
    c.research_questions,
    c.review_status,
    c.updated_at
  into v_card
  from public.opportunity_cards as c
  inner join public.imports as i
    on i.id = c.import_id
    and i.owner_id = c.owner_id
  where c.id = p_card_id
    and c.import_id = p_import_id
    and c.owner_id = v_owner_id
    and i.is_current
    and i.status = 'ready'
  for update of c;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'review_card_not_available';
  end if;

  if v_card.updated_at <> p_expected_updated_at then
    raise exception using
      errcode = '40001',
      message = 'review_stale';
  end if;

  if v_card.user_need is distinct from v_user_need then
    v_edited_fields := v_edited_fields ||
      pg_catalog.jsonb_build_object('user_need', true);
  end if;

  if v_card.potential_solution is distinct from v_potential_solution then
    v_edited_fields := v_edited_fields ||
      pg_catalog.jsonb_build_object('potential_solution', true);
  end if;

  if v_card.research_questions is distinct from v_research_questions then
    v_edited_fields := v_edited_fields ||
      pg_catalog.jsonb_build_object('research_questions', true);
  end if;

  if v_edited_fields = '{}'::jsonb
    and v_card.review_status = p_review_status
    and v_review_note is null
  then
    raise exception using
      errcode = '22023',
      message = 'review_no_changes';
  end if;

  update public.opportunity_cards
  set
    user_need = v_user_need,
    potential_solution = v_potential_solution,
    research_questions = v_research_questions,
    review_status = p_review_status
  where id = p_card_id
    and import_id = p_import_id
    and owner_id = v_owner_id
  returning updated_at into v_updated_at;

  insert into public.opportunity_review_history (
    card_id,
    import_id,
    owner_id,
    previous_status,
    new_status,
    edited_fields,
    review_note
  ) values (
    p_card_id,
    p_import_id,
    v_owner_id,
    v_card.review_status,
    p_review_status,
    v_edited_fields,
    v_review_note
  );

  return pg_catalog.jsonb_build_object(
    'card_id', p_card_id,
    'review_status', p_review_status,
    'updated_at', v_updated_at
  );
end;
$$;

revoke execute on function public.review_current_opportunity_card(
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text[],
  public.review_status,
  text
) from public, anon;

grant execute on function public.review_current_opportunity_card(
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text[],
  public.review_status,
  text
) to authenticated;

revoke insert on table public.opportunity_review_history from authenticated;

commit;
