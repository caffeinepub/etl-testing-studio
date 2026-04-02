import type { FieldMetadata, MockDataResult } from "../types/etl";

const DATE_PRESETS = [
  "yyyy-MM-dd",
  "yyyyMMdd",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "yyMMdd",
];
const NUMBER_PRESETS = ["0.00", "0,000.00", "0000.0000", "#.####"];

export function isCustomFormat(
  format: string | undefined,
  mappedType: string,
): boolean {
  if (!format && format !== "") return false;
  if (["Date", "DateTime", "Timestamp"].includes(mappedType)) {
    return !DATE_PRESETS.includes(format ?? "");
  }
  if (["Integer", "Decimal"].includes(mappedType)) {
    return !NUMBER_PRESETS.includes(format ?? "");
  }
  return false;
}

export function autoParseDate(value: string): Date | null {
  if (!value) return null;
  // yyyy-MM-dd or yyyy/MM/dd
  let m = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  // yyyyMMdd
  m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  // dd/MM/yyyy
  m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  // yyMMdd
  m = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const yr = +m[1] > 50 ? 1900 + +m[1] : 2000 + +m[1];
    return new Date(yr, +m[2] - 1, +m[3]);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(date: Date, format: string): string {
  const yyyy = date.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return format
    .replace("yyyy", yyyy)
    .replace("yy", yy)
    .replace("MM", MM)
    .replace("dd", dd);
}

export function formatNumber(value: string, format: string): string {
  const num = Number.parseFloat(value.replace(/,/g, ""));
  if (Number.isNaN(num)) return value;
  const dotIdx = format.indexOf(".");
  const decimalPlaces =
    dotIdx >= 0 ? format.slice(dotIdx + 1).replace(/[^0#]/g, "").length : 0;
  const hasThousands = format.includes(",");
  const fixed = num.toFixed(decimalPlaces);
  if (hasThousands) {
    const [intPart, fracPart] = fixed.split(".");
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fracPart !== undefined ? `${withCommas}.${fracPart}` : withCommas;
  }
  return fixed;
}

export function applyMetadataFormatting(
  data: MockDataResult,
  metadata: FieldMetadata[],
): MockDataResult {
  if (!metadata || metadata.length === 0) return data;
  const metaByOriginal: Record<string, FieldMetadata> = {};
  for (const m of metadata) {
    metaByOriginal[m.originalName] = m;
    metaByOriginal[m.mappedName] = m;
  }
  const transformedRows = data.rows.map((row) =>
    row.map((cell, colIdx) => {
      const col = data.columns[colIdx];
      const meta = metaByOriginal[col];
      if (!meta || !meta.format) return cell;
      const t = meta.mappedType;
      if (["Date", "DateTime", "Timestamp"].includes(t)) {
        const parsed = autoParseDate(cell);
        if (parsed) return formatDate(parsed, meta.format);
        return cell;
      }
      if (["Integer", "Decimal"].includes(t)) {
        return formatNumber(cell, meta.format);
      }
      return cell;
    }),
  );
  return { columns: data.columns, rows: transformedRows };
}
