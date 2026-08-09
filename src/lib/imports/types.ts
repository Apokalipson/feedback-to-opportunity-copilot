export type ImportIssueSeverity = "warning" | "error";

export type ImportIssue = {
  field: string;
  code: string;
  severity: ImportIssueSeverity;
  value?: string;
};

export type ParsedSurveyResponse = {
  sourceRowNumber: number;
  rawPayload: Record<string, string | null>;
  normalizedTexts: Record<string, string | null>;
  q2FeatureCodes: number[];
  q3FeatureCode: number | null;
  validationStatus: "valid" | "warning" | "invalid";
  validationIssues: ImportIssue[];
};

export type ImportSummary = {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  warningRows: number;
};

export type ParsedSurveyImport = {
  records: ParsedSurveyResponse[];
  summary: ImportSummary;
  warnings: string[];
};

export type CsvFileInput = {
  name: string;
  type: string;
  bytes: Uint8Array;
};

export class CsvImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CsvImportError";
  }
}

export type ImportApiSuccess = {
  ok: true;
  importId: string;
  filename: string;
  summary: ImportSummary;
  warnings: string[];
};

export type ImportApiFailure = {
  ok: false;
  code: string;
  message: string;
};

export type ImportApiResponse = ImportApiSuccess | ImportApiFailure;
