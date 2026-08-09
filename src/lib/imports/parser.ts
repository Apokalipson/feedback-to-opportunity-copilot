import { parse } from "csv-parse/sync";
import {
  ALLOWED_CSV_MIME_TYPES,
  CSV_IMPORT_LIMITS,
  Q2_HEADER,
  Q3_HEADER,
  SUPPORTED_FEATURE_CODES,
  SURVEY_HEADERS,
  TEXT_FIELD_HEADERS,
} from "./contract";
import {
  CsvImportError,
  type CsvFileInput,
  type ImportIssue,
  type ParsedSurveyImport,
  type ParsedSurveyResponse,
} from "./types";

const supportedFeatureCodes = new Set<number>(SUPPORTED_FEATURE_CODES);

function fail(code: string, message: string): never {
  throw new CsvImportError(code, message);
}

function validateFile(input: CsvFileInput) {
  const filename = input.name.trim();

  if (
    filename.length === 0 ||
    filename.length > 255 ||
    /[\u0000-\u001f\u007f]/u.test(filename)
  ) {
    fail("invalid_filename", "Choose a CSV file with a valid filename.");
  }

  if (!filename.toLowerCase().endsWith(".csv")) {
    fail("invalid_file_type", "Only .csv files can be imported.");
  }

  const mimeType = input.type.toLowerCase().split(";", 1)[0].trim();
  if (!ALLOWED_CSV_MIME_TYPES.has(mimeType)) {
    fail("invalid_file_type", "The selected file is not a supported CSV file.");
  }

  if (input.bytes.byteLength === 0) {
    fail("empty_file", "The selected CSV file is empty.");
  }

  if (input.bytes.byteLength > CSV_IMPORT_LIMITS.maxBytes) {
    fail(
      "file_too_large",
      `The CSV file exceeds the ${CSV_IMPORT_LIMITS.maxBytes / 1024 / 1024} MiB limit.`,
    );
  }
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (decoded.includes("\u0000")) {
      fail("invalid_character", "The CSV file contains an unsupported NUL character.");
    }
    return decoded;
  } catch (error) {
    if (error instanceof CsvImportError) {
      throw error;
    }
    fail("invalid_encoding", "The CSV file must use valid UTF-8 encoding.");
  }
}

function parseRows(csvText: string): string[][] {
  try {
    const rows = parse(csvText, {
      bom: true,
      columns: false,
      max_record_size: 128 * 1024,
      relax_column_count: true,
      skip_empty_lines: true,
    }) as unknown;

    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          !Array.isArray(row) || row.some((value) => typeof value !== "string"),
      )
    ) {
      fail("malformed_csv", "The CSV structure could not be read safely.");
    }

    return rows as string[][];
  } catch (error) {
    if (error instanceof CsvImportError) {
      throw error;
    }

    fail(
      "malformed_csv",
      "The CSV is malformed. Check quotes, delimiters, and row lengths.",
    );
  }
}

function selectHeaderRow(rows: string[][]) {
  if (rows.length === 0) {
    fail("empty_file", "The selected CSV file is empty.");
  }

  const firstRowValues = rows[0].filter((value) => value.trim().length > 0);
  const hasSingleCellTitle = firstRowValues.length === 1 && rows.length > 1;
  const headerIndex = hasSingleCellTitle ? 1 : 0;
  const headers = rows[headerIndex].map((header) => header.trim());

  if (headers.length > CSV_IMPORT_LIMITS.maxColumns) {
    fail(
      "too_many_columns",
      `The CSV contains more than ${CSV_IMPORT_LIMITS.maxColumns} columns.`,
    );
  }

  if (headers.some((header) => header.length === 0)) {
    fail("blank_header", "Every CSV column must have a non-empty header.");
  }

  if (headers.some((header) => /[\u0000-\u001f\u007f]/u.test(header))) {
    fail("invalid_header", "CSV headers cannot contain control characters.");
  }

  if (
    headers.some(
      (header) => header.length > CSV_IMPORT_LIMITS.maxHeaderCharacters,
    )
  ) {
    fail(
      "header_too_long",
      `CSV headers may contain at most ${CSV_IMPORT_LIMITS.maxHeaderCharacters} characters.`,
    );
  }

  if (new Set(headers).size !== headers.length) {
    fail("duplicate_header", "CSV column headers must be unique.");
  }

  const missingHeaders = SURVEY_HEADERS.filter(
    (expectedHeader) => !headers.includes(expectedHeader),
  );

  if (missingHeaders.length > 0) {
    fail(
      "missing_headers",
      `The CSV is missing required columns: ${missingHeaders.join(", ")}.`,
    );
  }

  const expectedHeaders = new Set<string>(SURVEY_HEADERS);
  const unknownHeaders = headers.filter((header) => !expectedHeaders.has(header));

  return { headerIndex, headers, unknownHeaders };
}

function rawValue(value: string) {
  return value.trim().length === 0 ? null : value;
}

function normalizedText(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function addTextIssues(
  field: string,
  value: string | null,
  issues: ImportIssue[],
) {
  if (value === null) {
    return;
  }

  if (value.length > CSV_IMPORT_LIMITS.longTextWarningCharacters) {
    issues.push({
      field,
      code: "long_text",
      severity: "warning",
    });
  }
}

function parseQ2(value: string, issues: ImportIssue[]) {
  if (value.trim().length === 0) {
    return [];
  }

  const result: number[] = [];
  const seen = new Set<number>();

  for (const rawCode of value.split(",")) {
    const candidate = rawCode.trim();
    const parsedCode = /^\d+$/u.test(candidate) ? Number(candidate) : Number.NaN;

    if (!Number.isInteger(parsedCode) || !supportedFeatureCodes.has(parsedCode)) {
      issues.push({
        field: "q2_feature_codes",
        code: "unsupported_feature_code",
        severity: "error",
        value: candidate,
      });
      continue;
    }

    if (seen.has(parsedCode)) {
      issues.push({
        field: "q2_feature_codes",
        code: "duplicate_feature_code",
        severity: "warning",
        value: candidate,
      });
      continue;
    }

    seen.add(parsedCode);
    result.push(parsedCode);
  }

  return result;
}

function parseQ3(value: string, issues: ImportIssue[]) {
  const candidate = value.trim();
  if (candidate.length === 0) {
    return null;
  }

  if (candidate.includes(",")) {
    issues.push({
      field: "q3_feature_code",
      code: "multiple_feature_codes",
      severity: "error",
      value: candidate,
    });
    return null;
  }

  const parsedCode = /^\d+$/u.test(candidate) ? Number(candidate) : Number.NaN;
  if (!Number.isInteger(parsedCode) || !supportedFeatureCodes.has(parsedCode)) {
    issues.push({
      field: "q3_feature_code",
      code: "unsupported_feature_code",
      severity: "error",
      value: candidate,
    });
    return null;
  }

  return parsedCode;
}

function buildResponse(
  headers: string[],
  row: string[],
  sourceRowNumber: number,
): ParsedSurveyResponse {
  const values = new Map(headers.map((header, index) => [header, row[index]]));
  const issues: ImportIssue[] = [];
  const rawPayload = Object.fromEntries(
    headers.map((header, index) => [header, rawValue(row[index])]),
  );
  const normalizedTexts = Object.fromEntries(
    Object.entries(TEXT_FIELD_HEADERS).map(([field, header]) => {
      const value = normalizedText(values.get(header) ?? "");
      addTextIssues(field, value, issues);
      return [field, value];
    }),
  );
  const q2FeatureCodes = parseQ2(values.get(Q2_HEADER) ?? "", issues);
  const q3FeatureCode = parseQ3(values.get(Q3_HEADER) ?? "", issues);

  if (q2FeatureCodes.includes(6) && normalizedTexts.q2_other_text === null) {
    issues.push({
      field: "q2_other_text",
      code: "missing_other_text",
      severity: "warning",
    });
  }

  if (q3FeatureCode === 6 && normalizedTexts.q3_other_text === null) {
    issues.push({
      field: "q3_other_text",
      code: "missing_other_text",
      severity: "warning",
    });
  }

  const validationStatus = issues.some((issue) => issue.severity === "error")
    ? "invalid"
    : issues.length > 0
      ? "warning"
      : "valid";

  return {
    sourceRowNumber,
    rawPayload,
    normalizedTexts,
    q2FeatureCodes,
    q3FeatureCode,
    validationStatus,
    validationIssues: issues,
  };
}

export function parseSurveyCsv(input: CsvFileInput): ParsedSurveyImport {
  validateFile(input);
  const rows = parseRows(decodeUtf8(input.bytes));
  const { headerIndex, headers, unknownHeaders } = selectHeaderRow(rows);
  const dataRows = rows.slice(headerIndex + 1);

  if (dataRows.length === 0) {
    fail("no_data_rows", "The CSV contains headers but no survey responses.");
  }

  if (dataRows.length > CSV_IMPORT_LIMITS.maxRows) {
    fail(
      "too_many_rows",
      `The CSV contains more than ${CSV_IMPORT_LIMITS.maxRows} response rows.`,
    );
  }

  if (dataRows.some((row) => row.length !== headers.length)) {
    fail(
      "inconsistent_row_length",
      "Every response row must contain the same number of columns as the header row.",
    );
  }


  if (
    dataRows.some((row) =>
      row.some((value) => value.length > CSV_IMPORT_LIMITS.maxCellCharacters),
    )
  ) {
    fail(
      "cell_too_large",
      `CSV cells may contain at most ${CSV_IMPORT_LIMITS.maxCellCharacters} characters.`,
    );
  }

  const records = dataRows.map((row, index) =>
    buildResponse(headers, row, index + 1),
  );
  const rejectedRows = records.filter(
    (record) => record.validationStatus === "invalid",
  ).length;
  const warningRows = records.filter(
    (record) => record.validationStatus === "warning",
  ).length;
  const warnings = unknownHeaders.length
    ? [`Unknown columns were preserved in raw data: ${unknownHeaders.join(", ")}.`]
    : [];

  return {
    records,
    summary: {
      totalRows: records.length,
      acceptedRows: records.length - rejectedRows,
      rejectedRows,
      warningRows,
    },
    warnings,
  };
}
