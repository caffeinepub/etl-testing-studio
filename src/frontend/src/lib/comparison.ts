import type {
  ComparisonResult,
  FieldStat,
  MockDataResult,
  TestCase,
} from "../types/etl";

function countDuplicates(rows: string[][]): number {
  const seen = new Set<string>();
  let dups = 0;
  for (const row of rows) {
    const key = row.join("|");
    if (seen.has(key)) dups++;
    else seen.add(key);
  }
  return dups;
}

export function compareData(
  sourceMock: MockDataResult,
  targetMock: MockDataResult,
): ComparisonResult {
  const srcRows = sourceMock.rows;
  const tgtRows = targetMock.rows;
  const cols = sourceMock.columns;

  const minRows = Math.min(srcRows.length, tgtRows.length);
  let matched = 0;
  let mismatched = 0;

  const fieldStatsMap: Record<string, { matched: number; mismatched: number }> =
    {};
  for (const col of cols) {
    fieldStatsMap[col] = { matched: 0, mismatched: 0 };
  }

  for (let i = 0; i < minRows; i++) {
    const srcRow = srcRows[i];
    const tgtRow = tgtRows[i];
    let rowMatch = true;
    for (let j = 0; j < cols.length; j++) {
      const col = cols[j];
      const sv = srcRow[j] ?? "";
      const tv = tgtRow[j] ?? "";
      if (sv === tv) {
        fieldStatsMap[col].matched++;
      } else {
        fieldStatsMap[col].mismatched++;
        rowMatch = false;
      }
    }
    if (rowMatch) matched++;
    else mismatched++;
  }
  mismatched += Math.abs(srcRows.length - tgtRows.length);

  const fieldStats: FieldStat[] = cols.map((col) => {
    const s = fieldStatsMap[col];
    const total = s.matched + s.mismatched;
    return {
      field: col,
      matchedCount: s.matched,
      mismatchedCount: s.mismatched,
      matchPercent: total > 0 ? Math.round((s.matched / total) * 100) : 0,
    };
  });

  return {
    totalSourceRows: srcRows.length,
    totalTargetRows: tgtRows.length,
    matchedRows: matched,
    mismatchedRows: mismatched,
    sourceDuplicates: countDuplicates(srcRows),
    targetDuplicates: countDuplicates(tgtRows),
    fieldStats,
  };
}

export function generateTestCases(
  sourceMock: MockDataResult,
  targetMock: MockDataResult,
): TestCase[] {
  const cols = sourceMock.columns;
  const minRows = Math.min(sourceMock.rows.length, targetMock.rows.length);
  const testCases: TestCase[] = [];

  for (let i = 0; i < minRows; i++) {
    const srcRow = sourceMock.rows[i];
    const tgtRow = targetMock.rows[i];
    const rowMatch = cols.every(
      (_, j) => (srcRow[j] ?? "") === (tgtRow[j] ?? ""),
    );
    testCases.push({
      id: `TC-${String(i + 1).padStart(3, "0")}`,
      description: `Row ${i + 1} comparison across ${cols.length} fields`,
      sourceValue: srcRow.slice(0, 3).join(", "),
      targetValue: tgtRow.slice(0, 3).join(", "),
      status: rowMatch ? "Pass" : "Fail",
    });
  }

  // Add field-level test cases
  cols.forEach((col, j) => {
    const srcSample = sourceMock.rows[0]?.[j] ?? "N/A";
    const tgtSample = targetMock.rows[0]?.[j] ?? "N/A";
    testCases.push({
      id: `TC-F${String(j + 1).padStart(3, "0")}`,
      description: `Field validation: ${col}`,
      sourceValue: srcSample,
      targetValue: tgtSample,
      status: srcSample === tgtSample ? "Pass" : "Fail",
    });
  });

  return testCases;
}

export function exportTestCasesCSV(testCases: TestCase[]): void {
  const header = "Test Case ID,Description,Source Value,Target Value,Status";
  const rows = testCases.map((tc) =>
    [
      tc.id,
      `"${tc.description}"`,
      `"${tc.sourceValue}"`,
      `"${tc.targetValue}"`,
      tc.status,
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "test-cases.csv";
  a.click();
  URL.revokeObjectURL(url);
}
