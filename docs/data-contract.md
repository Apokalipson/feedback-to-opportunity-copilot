# Survey data contract

## Import assumptions

- Input format: CSV with one survey response per row.
- Blank answers are valid and remain `null`; they must not shift another row.
- Original row order and a non-identifying source row number are retained for
  traceability.
- Raw fields are stored separately from normalized values.
- Unknown columns are reported rather than silently discarded.
- Development fixtures contain synthetic feedback only.

## Frozen CSV header mapping

The parser accepts the frozen survey export below. Headers may be in the first
row or may follow one single-cell export-title row. Header names are trimmed,
but otherwise matched exactly. All 15 known columns are required; additional
uniquely named columns are preserved in `raw_payload` and reported as an import
warning.

| Source header | Normalized handling |
| --- | --- |
| `RecordedDate` | raw only |
| `ResponseId` | raw only |
| `Q1b U - CSAT COMMENT` | `q1b_csat_comment` |
| `Q1c U - CSAT COMMENT` | `q1c_csat_comment` |
| `Q1d U - CSAT COMMENT` | `q1d_csat_comment` |
| `Q2 U - FEAT` | `q2_feature_codes` |
| `Q2 U - FEAT_6_TEXT` | `q2_other_text` |
| `Q3 U - FEAT` | `q3_feature_code` |
| `Q3 U - FEAT_6_TEXT` | `q3_other_text` |
| `Q3b U - FEAT COMMENT` | `q3b_feature_comment` |
| `Q4 U - CES` | raw only |
| `Q4b U - CES COMMENT` | `q4b_ces_comment` |
| `Q5 U - COMMENT` | `q5_comment` |
| `age_range` | raw only |
| `os` | raw only |

Raw blank or whitespace-only cells become explicit `null`. Normalized text is
trimmed and blank text remains `null`. The one-based `source_row_number` counts
response records after the header, independent of the optional title row.

## File and row validation

- filename must end in `.csv` and use an allowed CSV MIME type;
- content must be valid UTF-8 and at most 1 MiB;
- an import may contain at most 1,000 response rows and 30 columns; each header
  is limited to 200 characters;
- blank and duplicate headers, missing known headers, malformed quoting, and
  inconsistent row lengths reject the whole file before persistence;
- a normalized text value over 4,000 characters creates a row warning; any cell
  over 10,000 characters rejects the file before persistence;
- unsupported Q2/Q3 codes and multiple Q3 codes reject the row without guessing
  a normalized value;
- selecting code `6` without its matching Other text creates a row warning.

Valid and warning rows count as accepted. Invalid rows count as rejected but
remain stored with their raw payload and structured validation issues for
traceability. The UI receives only counts and file-level warnings, never raw
respondent data.

## Confirmed feature mapping

Q2 is multi-select: **Which features of the app did you use in the past week?**

Q3 is single-select: **Which features of the app did you find most valuable?**

| Code | Feature |
| --- | --- |
| `1` | myDisplay |
| `2` | myLock |
| `3` | Find my Glo |
| `4` | mySession |
| `5` | myUsage |
| `6` | Other |

Parsing rules:

- Q2 values such as `1,3,5` become a list of three feature codes.
- Q3 contains at most one feature code.
- Empty Q2 or Q3 remains empty and does not invalidate the whole response.
- Unsupported codes are flagged for review and never guessed.

## Q1 decision

The numerical Q1 satisfaction-score column was intentionally excluded from the
available source export because it is not required to construct the MVP
Opportunity Card. This is a product decision, not an accidental missing field.
Available free-text follow-up responses can still contribute evidence.

Consequences:

- the MVP must not calculate satisfaction averages or score-based trends;
- scale means occurrence count and percentage within the current import;
- documentation and UI must not imply that Q1 numerical scores were analyzed.

## Normalized response fields

The response persistence contract requires every normalized response to retain:

- internal UUID;
- import UUID;
- source row number;
- raw payload;
- normalized text fields in an object that preserves explicit `null` values;
- Q2 used-feature codes;
- Q3 most-valuable-feature code;
- validation status and issues;
- creation timestamp.

Unsupported Q2/Q3 values remain in `raw_payload`, are omitted from normalized
feature-code fields, and create a structured validation issue. The application
must never convert an unsupported code into a guessed supported value.

## Relational schema

The migration in `supabase/migrations/` defines these application tables:

- `profiles`: one application profile per Supabase Auth user;
- `imports`: import status, current-import flag, scoped counts, and owner;
- `survey_responses`: raw and normalized survey data with row traceability;
- `response_analyses`: AI proposals stored separately from source responses;
- `feedback_groups` and `group_memberships`: grouping proposals and sources;
- `opportunity_cards` and `opportunity_evidence`: draft cards and linked quotes;
- `opportunity_review_history`: append-only review events.

Every domain row is owned by a Supabase Auth UUID. Composite foreign keys keep
owners and import IDs consistent across relationships. The one-current-import
rule is enforced by a partial unique index per owner.

## AI-derived fields

AI output is stored separately from raw survey answers:

- topic;
- user problem;
- sentiment;
- product area;
- group assignment and confidence/uncertainty metadata;
- model and analysis version.

AI-derived fields are proposals and may not overwrite source feedback.

## Frozen AI analysis contract

Only `valid` and `warning` responses from the current ready import are eligible.
An eligible response must also contain at least one non-empty normalized text
field. Invalid rows and accepted rows without feedback text remain stored but
are not sent to OpenAI.

The controlled labels are:

- topic: `usability`, `reliability`, `performance`, `discoverability`,
  `clarity`, `trust`, `support`, or `other`;
- sentiment: `negative`, `mixed`, `neutral`, or `positive`;
- product area: `my_display`, `my_lock`, `find_my_glo`, `my_session`,
  `my_usage`, or `ecosystem_other`.

Every eligible response must have exactly one analysis and belong to exactly
one feedback group. Every group must have exactly one AI-generated Opportunity
Card in `pending` review status. Model output may select evidence only as a
response UUID plus an available normalized text-field name. The database
resolves the exact source text and stores at most the first 500 characters;
model-generated quote text is never accepted. A source response may be used at
most once as evidence within one card, even if it contains several eligible
text fields. When otherwise valid model output repeats a response, the server
keeps its first evidence reference and removes later references to that response.

The runtime rejects duplicate or unknown response IDs, incomplete response
coverage, duplicate group keys, cross-group duplication, missing cards,
evidence outside its group, unavailable evidence fields, out-of-range
confidence, uncontrolled labels, and overlong generated fields before any
database replacement occurs. Repeated valid evidence source responses within a
card are normalized to their first occurrence before replacement.

## Frozen Product Manager review contract

Only an Opportunity Card belonging to the authenticated owner's current,
ready import may be reviewed. The browser submits the card UUID, import UUID,
last observed update timestamp, requested status, edited user need, edited
potential solution, one to four unique research questions, and an optional
review note. It never submits evidence quote text.

Review limits are 1,000 characters for the user need, 1,500 for the potential
solution, 500 per research question, and 1,000 for the review note. The request
body is limited to 16 KiB. Whitespace is trimmed and blank required fields,
duplicate questions, unknown fields, invalid UUIDs, and unsupported statuses
are rejected before persistence.

A database function performs the card update and append-only history insert in
one transaction. `expected_updated_at` provides optimistic concurrency: a stale
browser copy is refused instead of overwriting a newer human decision. A
review must change at least one editable field or status. The card's
`ai_generated` flag remains origin metadata after editing; `review_status` and
the review history record the human decision separately.

Scale is the number of responses assigned to the card's feedback group divided
by `imports.total_rows` for the current import. The UI displays both the count
and percentage and explicitly identifies the denominator as all rows in the
current import.
