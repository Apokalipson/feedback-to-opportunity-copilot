export const CSV_IMPORT_LIMITS = {
  maxBytes: 1024 * 1024,
  maxRows: 1000,
  maxColumns: 30,
  maxHeaderCharacters: 200,
  maxCellCharacters: 10_000,
  longTextWarningCharacters: 4000,
} as const;

export const SURVEY_HEADERS = [
  "RecordedDate",
  "ResponseId",
  "Q1b U - CSAT COMMENT",
  "Q1c U - CSAT COMMENT",
  "Q1d U - CSAT COMMENT",
  "Q2 U - FEAT",
  "Q2 U - FEAT_6_TEXT",
  "Q3 U - FEAT",
  "Q3 U - FEAT_6_TEXT",
  "Q3b U - FEAT COMMENT",
  "Q4 U - CES",
  "Q4b U - CES COMMENT",
  "Q5 U - COMMENT",
  "age_range",
  "os",
] as const;

export type SurveyHeader = (typeof SURVEY_HEADERS)[number];

export const TEXT_FIELD_HEADERS = {
  q1b_csat_comment: "Q1b U - CSAT COMMENT",
  q1c_csat_comment: "Q1c U - CSAT COMMENT",
  q1d_csat_comment: "Q1d U - CSAT COMMENT",
  q2_other_text: "Q2 U - FEAT_6_TEXT",
  q3_other_text: "Q3 U - FEAT_6_TEXT",
  q3b_feature_comment: "Q3b U - FEAT COMMENT",
  q4b_ces_comment: "Q4b U - CES COMMENT",
  q5_comment: "Q5 U - COMMENT",
} as const satisfies Record<string, SurveyHeader>;

export type NormalizedTextField = keyof typeof TEXT_FIELD_HEADERS;

export const Q2_HEADER = "Q2 U - FEAT" satisfies SurveyHeader;
export const Q3_HEADER = "Q3 U - FEAT" satisfies SurveyHeader;

export const SUPPORTED_FEATURE_CODES = [1, 2, 3, 4, 5, 6] as const;

export const ALLOWED_CSV_MIME_TYPES = new Set([
  "",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);
