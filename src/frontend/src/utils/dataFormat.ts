import type { FieldMetadata, MockDataResult } from "../types/etl";

// Try to parse a date string using common patterns
function parseDate(value: string): Date | null {
  if (!value || value.trim() === "") return null;

  const v = value.trim();

  // ISO datetime or date
  const iso = new Date(v);
  if (!Number.isNaN(iso.getTime())) return iso;

  // yyyyMMdd
  if (/^\d{8}$/.test(v)) {
    const y = Number.parseInt(v.substring(0, 4), 10);
    const m = Number.parseInt(v.substring(4, 6), 10) - 1;
    const d = Number.parseInt(v.substring(6, 8), 10);
    const dt = new Date(y, m, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // yyMMdd
  if (/^\d{6}$/.test(v)) {
    const y = 2000 + Number.parseInt(v.substring(0, 2), 10);
    const m = Number.parseInt(v.substring(2, 4), 10) - 1;
    const d = Number.parseInt(v.substring(4, 6), 10);
    const dt = new Date(y, m, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // dd/MM/yyyy
  const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dt = new Date(
      Number.parseInt(dmy[3], 10),
      Number.parseInt(dmy[2], 10) - 1,
      Number.parseInt(dmy[1], 10),
    );
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // MM/dd/yyyy
  const mdy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const dt = new Date(
      Number.parseInt(mdy[3], 10),
      Number.parseInt(mdy[1], 10) - 1,
      Number.parseInt(mdy[2], 10),
    );
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(dt: Date, format: string): string {
  const yyyy = String(dt.getFullYear());
  const yy = yyyy.substring(2);
  const MM = pad2(dt.getMonth() + 1);
  const dd = pad2(dt.getDate());
  const HH = pad2(dt.getHours());
  const mm = pad2(dt.getMinutes());
  const ss = pad2(dt.getSeconds());

  return format
    .replace("yyyy", yyyy)
    .replace("yy", yy)
    .replace("MM", MM)
    .replace("dd", dd)
    .replace("HH", HH)
    .replace("mm", mm)
    .replace("ss", ss);
}

function applyDateFormat(value: string, format: string): string {
  try {
    const dt = parseDate(value);
    if (!dt) return value;
    return formatDate(dt, format);
  } catch {
    return value;
  }
}

function applyNumberFormat(value: string, format: string): string {
  try {
    const num = Number.parseFloat(value.replace(/,/g, ""));
    if (Number.isNaN(num)) return value;

    if (format === "0.00") {
      return num.toFixed(2);
    }
    if (format === "0,000.00") {
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (format === "0000.0000") {
      return num.toFixed(4);
    }
    if (format === "#.####") {
      return num.toFixed(4).replace(/\.?0+$/, "");
    }
    // Custom: try to use as a decimal-places indicator
    const parts = format.split(".");
    if (parts.length === 2) {
      return num.toFixed(parts[1].length);
    }
    return String(num);
  } catch {
    return value;
  }
}

export function applyFieldFormat(value: string, meta: FieldMetadata): string {
  if (!meta.format || meta.format === "Custom") return value;

  const type = meta.mappedType;
  if (["Date", "DateTime", "Timestamp"].includes(type)) {
    return applyDateFormat(value, meta.format);
  }
  if (["Integer", "Decimal"].includes(type)) {
    return applyNumberFormat(value, meta.format);
  }
  return value;
}

export function applyMetadataToData(
  data: MockDataResult,
  metadata: FieldMetadata[],
): MockDataResult {
  if (!metadata.length) return data;

  // Build a map: column index -> FieldMetadata (match by originalName)
  const colIndexMap: Record<number, FieldMetadata> = {};
  data.columns.forEach((col, idx) => {
    const meta = metadata.find(
      (m) => m.originalName === col || m.mappedName === col,
    );
    if (meta) colIndexMap[idx] = meta;
  });

  const transformedRows = data.rows.map((row) =>
    row.map((cell, idx) => {
      const meta = colIndexMap[idx];
      if (!meta) return cell;
      return applyFieldFormat(cell, meta);
    }),
  );

  // Also apply mapped names to columns if different
  const transformedColumns = data.columns.map((col) => {
    const meta = metadata.find((m) => m.originalName === col);
    return meta?.mappedName ?? col;
  });

  return { columns: transformedColumns, rows: transformedRows };
}
