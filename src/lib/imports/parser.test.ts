import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSV_IMPORT_LIMITS, SURVEY_HEADERS } from "./contract";
import { parseSurveyCsv } from "./parser";
import { CsvImportError } from "./types";

const fixtureBytes = new Uint8Array(
  readFileSync(new URL("./__fixtures__/synthetic-feedback.csv", import.meta.url)),
);

function csvCell(value: string) {
  return /[",\n\r]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvRow(values: string[]) {
  return values.map(csvCell).join(",");
}

function validRow(overrides: Partial<Record<string, string>> = {}) {
  const defaults: Record<string, string> = {
    RecordedDate: "2026-01-15T09:00:00Z",
    ResponseId: "synthetic-response",
    "Q1b U - CSAT COMMENT": "",
    "Q1c U - CSAT COMMENT": "",
    "Q1d U - CSAT COMMENT": "Synthetic comment",
    "Q2 U - FEAT": "1,3",
    "Q2 U - FEAT_6_TEXT": "",
    "Q3 U - FEAT": "3",
    "Q3 U - FEAT_6_TEXT": "",
    "Q3b U - FEAT COMMENT": "Synthetic follow-up",
    "Q4 U - CES": "2",
    "Q4b U - CES COMMENT": "",
    "Q5 U - COMMENT": "Synthetic feedback",
    age_range: "25-34",
    os: "SyntheticOS",
  };

  return SURVEY_HEADERS.map((header) => overrides[header] ?? defaults[header]);
}

function buildCsv(options?: {
  headers?: string[];
  rows?: string[][];
  title?: boolean;
}) {
  const headers = options?.headers ?? [...SURVEY_HEADERS];
  const rows = options?.rows ?? [validRow()];
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  if (options?.title) {
    lines.unshift("Synthetic survey export");
  }
  return new TextEncoder().encode(lines.join("\n"));
}

function parse(
  bytes: Uint8Array = buildCsv(),
  type = "text/csv",
  name = "fixture.csv",
) {
  return parseSurveyCsv({ name, type, bytes });
}

function expectImportError(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("Expected parseSurveyCsv to throw.");
  } catch (error) {
    expect(error).toBeInstanceOf(CsvImportError);
    expect((error as CsvImportError).code).toBe(code);
  }
}

describe("parseSurveyCsv", () => {
  it("parses the synthetic export without shifting quoted multiline rows", () => {
    const result = parse(fixtureBytes);

    expect(result.summary).toEqual({
      totalRows: 4,
      acceptedRows: 3,
      rejectedRows: 1,
      warningRows: 0,
    });
    expect(result.records[0].q2FeatureCodes).toEqual([1, 3]);
    expect(result.records[0].q3FeatureCode).toBe(3);
    expect(result.records[0].normalizedTexts.q5_comment).toBe(
      "I need a manual refresh,\nwith a visible timestamp.",
    );
    expect(result.records[1]).toMatchObject({
      sourceRowNumber: 2,
      q2FeatureCodes: [],
      q3FeatureCode: null,
      validationStatus: "valid",
    });
    expect(result.records[1].rawPayload.ResponseId).toBe(
      "synthetic-response-002",
    );
    expect(Object.values(result.records[1].normalizedTexts)).toEqual(
      Array(8).fill(null),
    );
    expect(result.records[3].q2FeatureCodes).toEqual([1]);
    expect(result.records[3].validationIssues).toContainEqual({
      field: "q2_feature_codes",
      code: "unsupported_feature_code",
      severity: "error",
      value: "99",
    });
  });

  it("accepts headers in the first row and reports unknown columns", () => {
    const headers = [...SURVEY_HEADERS, "SyntheticExtra"];
    const result = parse(
      buildCsv({ headers, rows: [[...validRow(), "preserved"]] }),
    );

    expect(result.summary.acceptedRows).toBe(1);
    expect(result.warnings).toEqual([
      "Unknown columns were preserved in raw data: SyntheticExtra.",
    ]);
    expect(result.records[0].rawPayload.SyntheticExtra).toBe("preserved");
  });

  it("keeps empty Q2 and Q3 values valid and tied to their source row", () => {
    const result = parse(
      buildCsv({
        rows: [
          validRow({ ResponseId: "synthetic-1" }),
          validRow({
            ResponseId: "synthetic-2",
            "Q2 U - FEAT": "",
            "Q3 U - FEAT": "",
          }),
        ],
      }),
    );

    expect(result.records[1].sourceRowNumber).toBe(2);
    expect(result.records[1].rawPayload.ResponseId).toBe("synthetic-2");
    expect(result.records[1].q2FeatureCodes).toEqual([]);
    expect(result.records[1].q3FeatureCode).toBeNull();
  });

  it("rejects multiple Q3 feature codes without guessing", () => {
    const result = parse(
      buildCsv({ rows: [validRow({ "Q3 U - FEAT": "2,3" })] }),
    );

    expect(result.summary.rejectedRows).toBe(1);
    expect(result.records[0].q3FeatureCode).toBeNull();
    expect(result.records[0].validationIssues[0].code).toBe(
      "multiple_feature_codes",
    );
  });

  it("warns when Other is selected without the corresponding text", () => {
    const result = parse(
      buildCsv({
        rows: [
          validRow({
            "Q2 U - FEAT": "6",
            "Q2 U - FEAT_6_TEXT": "",
          }),
        ],
      }),
    );

    expect(result.summary.warningRows).toBe(1);
    expect(result.records[0].validationStatus).toBe("warning");
  });

  it.each([
    ["invalid_file_type", buildCsv(), "application/pdf", "fixture.csv"],
    ["invalid_file_type", buildCsv(), "text/csv", "fixture.xlsx"],
    ["invalid_encoding", new Uint8Array([0xff, 0xfe]), "text/csv", "fixture.csv"],
    [
      "invalid_character",
      new TextEncoder().encode("valid\u0000text"),
      "text/csv",
      "fixture.csv",
    ],
    [
      "file_too_large",
      new Uint8Array(CSV_IMPORT_LIMITS.maxBytes + 1),
      "text/csv",
      "fixture.csv",
    ],
  ])("fails safely with %s", (code, bytes, type, name) => {
    expectImportError(
      () => parse(bytes as Uint8Array, type as string, name as string),
      code as string,
    );
  });

  it("rejects missing and duplicate required headers", () => {
    expectImportError(
      () =>
        parse(
          buildCsv({
            headers: SURVEY_HEADERS.filter((header) => header !== "Q3 U - FEAT"),
            rows: [validRow().slice(0, -1)],
          }),
        ),
      "missing_headers",
    );

    const duplicateHeaders = [...SURVEY_HEADERS];
    duplicateHeaders[1] = duplicateHeaders[0];
    expectImportError(
      () => parse(buildCsv({ headers: duplicateHeaders })),
      "duplicate_header",
    );
  });

  it("rejects an oversized unknown header", () => {
    const headers = [
      ...SURVEY_HEADERS,
      "x".repeat(CSV_IMPORT_LIMITS.maxHeaderCharacters + 1),
    ];

    expectImportError(
      () => parse(buildCsv({ headers, rows: [[...validRow(), "value"]] })),
      "header_too_long",
    );
  });

  it("rejects an oversized cell before persistence", () => {
    const rows = [
      validRow({
        ResponseId: "x".repeat(CSV_IMPORT_LIMITS.maxCellCharacters + 1),
      }),
    ];

    expectImportError(() => parse(buildCsv({ rows })), "cell_too_large");
  });

  it("rejects inconsistent row lengths and malformed quotes", () => {
    expectImportError(
      () => parse(buildCsv({ rows: [validRow().slice(0, -1)] })),
      "inconsistent_row_length",
    );
    expectImportError(
      () => parse(new TextEncoder().encode(`${csvRow([...SURVEY_HEADERS])}\n"`)),
      "malformed_csv",
    );
  });

  it("enforces the response row limit", () => {
    const rows = Array.from(
      { length: CSV_IMPORT_LIMITS.maxRows + 1 },
      (_, index) => validRow({ ResponseId: `synthetic-${index}` }),
    );

    expectImportError(() => parse(buildCsv({ rows })), "too_many_rows");
  });
});
