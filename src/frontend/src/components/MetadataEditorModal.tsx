import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  FieldMetadata,
  LocalConnection,
  MockDataResult,
} from "../types/etl";

const TYPE_OPTIONS = [
  "String",
  "Integer",
  "Decimal",
  "Boolean",
  "Date",
  "DateTime",
  "Timestamp",
];

const DATE_FORMAT_PRESETS = [
  "yyyy-MM-dd",
  "yyyyMMdd",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "yyMMdd",
];

const NUMBER_FORMAT_PRESETS = ["0.00", "0,000.00", "0000.0000", "#.####"];

function getFormatPresets(mappedType: string): string[] | null {
  if (["Date", "DateTime", "Timestamp"].includes(mappedType)) {
    return DATE_FORMAT_PRESETS;
  }
  if (["Integer", "Decimal"].includes(mappedType)) {
    return NUMBER_FORMAT_PRESETS;
  }
  return null;
}

function applyFormat(
  value: string,
  mappedType: string,
  format: string | undefined,
): string {
  if (!format || !value) return value;

  // Number formatting
  if (["Decimal", "Integer"].includes(mappedType)) {
    const num = Number.parseFloat(value.replace(/,/g, ""));
    if (Number.isNaN(num)) return value;

    const hasThousands = format.includes(",");
    const dotIdx = format.indexOf(".");
    const decimalPlaces = dotIdx >= 0 ? format.length - dotIdx - 1 : 0;

    if (hasThousands) {
      return num.toLocaleString("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });
    }
    return num.toFixed(decimalPlaces);
  }

  // Date formatting
  if (["Date", "DateTime", "Timestamp"].includes(mappedType)) {
    let date = new Date(value);

    // Try yyyyMMdd pattern if standard parsing fails
    if (Number.isNaN(date.getTime()) && /^\d{8}$/.test(value)) {
      const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
      date = new Date(iso);
    }
    // Try ddMMyyy or MMddyyyy variants
    if (Number.isNaN(date.getTime()) && /^\d{6,8}$/.test(value)) {
      const y = value.slice(0, 4);
      const m = value.slice(4, 6);
      const d = value.slice(6, 8);
      date = new Date(`${y}-${m}-${d}`);
    }

    if (Number.isNaN(date.getTime())) return value;

    const yyyy = date.getFullYear().toString();
    const yy = yyyy.slice(-2);
    const MM = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const HH = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    return format
      .replace("yyyy", yyyy)
      .replace("yy", yy)
      .replace("MM", MM)
      .replace("dd", dd)
      .replace("HH", HH)
      .replace("mm", mm)
      .replace("ss", ss);
  }

  return value;
}

interface Props {
  open: boolean;
  onClose: () => void;
  connection: LocalConnection;
  mockData: MockDataResult | null;
  metadata: FieldMetadata[];
  onSave: (meta: FieldMetadata[]) => void;
}

export function MetadataEditorModal({
  open,
  onClose,
  connection,
  mockData,
  metadata,
  onSave,
}: Props) {
  const [rows, setRows] = useState<FieldMetadata[]>([]);
  const [customModeIndices, setCustomModeIndices] = useState<Set<number>>(
    new Set(),
  );
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowPreview(false);
      return;
    }
    setCustomModeIndices(new Set());
    if (metadata.length > 0) {
      setRows(metadata);
    } else if (mockData?.columns) {
      setRows(
        mockData.columns.map((col) => ({
          originalName: col,
          mappedName: col,
          originalType: "String",
          mappedType: "String",
          format: undefined,
        })),
      );
    } else {
      setRows([]);
    }
  }, [open, mockData, metadata]);

  const updateRow = (
    idx: number,
    field: keyof FieldMetadata,
    value: string,
  ) => {
    if (field === "mappedType") {
      setCustomModeIndices((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: value };
        if (field === "mappedType") {
          updated.format = undefined;
        }
        return updated;
      }),
    );
  };

  const handleSave = () => {
    onSave(rows);
    onClose();
  };

  // Build preview rows — up to 5 rows with format applied
  const previewRows =
    showPreview && mockData?.rows
      ? mockData.rows.slice(0, 5).map((dataRow) =>
          rows.map((fieldMeta) => {
            const colIdx = mockData.columns.indexOf(fieldMeta.originalName);
            const raw = colIdx >= 0 ? String(dataRow[colIdx] ?? "") : "";
            return applyFormat(raw, fieldMeta.mappedType, fieldMeta.format);
          }),
        )
      : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-5xl w-full"
        data-ocid="metadata_editor.dialog"
      >
        <DialogHeader>
          <DialogTitle>Schema Metadata — {connection.name}</DialogTitle>
        </DialogHeader>

        {!mockData ? (
          <div
            className="flex items-center justify-center py-12 text-sm text-muted-foreground"
            data-ocid="metadata_editor.empty_state"
          >
            Load data first to view schema
          </div>
        ) : (
          <>
            <ScrollArea className="h-[340px] w-full rounded-md border border-border">
              <Table data-ocid="metadata_editor.table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold w-[18%]">
                      Original Field Name
                    </TableHead>
                    <TableHead className="text-xs font-semibold w-[12%]">
                      Original Type
                    </TableHead>
                    <TableHead className="text-xs font-semibold w-[22%]">
                      Mapped Field Name
                    </TableHead>
                    <TableHead className="text-xs font-semibold w-[16%]">
                      Mapped Type
                    </TableHead>
                    <TableHead className="text-xs font-semibold w-[32%]">
                      Format
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => {
                    const presets = getFormatPresets(row.mappedType);
                    const isCustom = customModeIndices.has(idx);
                    const selectValue = isCustom
                      ? "Custom"
                      : (row.format ?? "");

                    return (
                      <TableRow
                        key={row.originalName}
                        data-ocid={`metadata_editor.row.item.${idx + 1}`}
                      >
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {row.originalName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.originalType}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 text-xs"
                            value={row.mappedName}
                            onChange={(e) =>
                              updateRow(idx, "mappedName", e.target.value)
                            }
                            data-ocid={`metadata_editor.input.${idx + 1}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.mappedType}
                            onValueChange={(v) =>
                              updateRow(idx, "mappedType", v)
                            }
                          >
                            <SelectTrigger
                              className="h-7 text-xs"
                              data-ocid={`metadata_editor.select.${idx + 1}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TYPE_OPTIONS.map((t) => (
                                <SelectItem
                                  key={t}
                                  value={t}
                                  className="text-xs"
                                >
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {presets ? (
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={selectValue || presets[0]}
                                onValueChange={(v) => {
                                  if (v === "Custom") {
                                    setCustomModeIndices((prev) => {
                                      const next = new Set(prev);
                                      next.add(idx);
                                      return next;
                                    });
                                    updateRow(idx, "format", "");
                                  } else {
                                    setCustomModeIndices((prev) => {
                                      const next = new Set(prev);
                                      next.delete(idx);
                                      return next;
                                    });
                                    updateRow(idx, "format", v);
                                  }
                                }}
                              >
                                <SelectTrigger
                                  className="h-7 text-xs min-w-[110px]"
                                  data-ocid={`metadata_editor.format_select.${idx + 1}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {presets.map((f) => (
                                    <SelectItem
                                      key={f}
                                      value={f}
                                      className="text-xs"
                                    >
                                      {f}
                                    </SelectItem>
                                  ))}
                                  <SelectItem
                                    value="Custom"
                                    className="text-xs"
                                  >
                                    Custom
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {isCustom && (
                                <Input
                                  className="h-7 text-xs w-32"
                                  placeholder="e.g. dd-MM-yy"
                                  value={row.format ?? ""}
                                  onChange={(e) =>
                                    updateRow(idx, "format", e.target.value)
                                  }
                                  data-ocid={`metadata_editor.format_input.${idx + 1}`}
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Transformed Data Preview Panel */}
            {showPreview && (
              <div
                className="rounded-md border border-border bg-muted/30 overflow-hidden"
                data-ocid="metadata_editor.panel"
              >
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                  <span className="text-xs font-semibold text-foreground">
                    Transformed Data Preview
                    <span className="ml-1.5 text-muted-foreground font-normal">
                      (up to 5 rows)
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setShowPreview(false)}
                    data-ocid="metadata_editor.close_button"
                  >
                    Hide
                  </Button>
                </div>
                {previewRows.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    No data available for preview.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {rows.map((r) => (
                            <TableHead
                              key={r.originalName}
                              className="text-xs font-semibold py-1.5 h-auto"
                            >
                              {r.mappedName}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((cells) => (
                          <TableRow key={cells.join("|")}>
                            {cells.map((cell, ci) => (
                              <TableCell
                                key={rows[ci]?.originalName ?? ci}
                                className="text-xs py-1.5 font-mono"
                              >
                                {cell !== "" ? (
                                  cell
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {mockData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
              className="mr-auto gap-1.5"
              data-ocid="metadata_editor.toggle"
            >
              {showPreview ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {showPreview ? "Hide Preview" : "Preview Transformed Data"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-ocid="metadata_editor.cancel_button"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!mockData}
            data-ocid="metadata_editor.save_button"
          >
            Save Metadata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
