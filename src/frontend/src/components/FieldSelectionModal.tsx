import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  FieldSelectionEntry,
  LocalConnection,
  MockDataResult,
} from "../types/etl";

interface Props {
  open: boolean;
  onClose: () => void;
  connection: LocalConnection;
  mockData: MockDataResult | null;
  entries: FieldSelectionEntry[];
  onSave: (entries: FieldSelectionEntry[]) => void;
}

interface PreviewData {
  columns: string[];
  rows: Array<Record<string, string>>;
}

export function FieldSelectionModal({
  open,
  onClose,
  connection,
  mockData,
  entries,
  onSave,
}: Props) {
  const [rows, setRows] = useState<FieldSelectionEntry[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (entries.length > 0) {
      setRows(entries);
    } else if (mockData && mockData.columns.length > 0) {
      setRows(
        mockData.columns.map((col) => ({
          originalName: col,
          alias: col,
          selected: true,
        })),
      );
    } else {
      setRows([]);
    }
    setShowPreview(false);
  }, [open, entries, mockData]);

  const toggleSelected = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)),
    );
  };

  const updateAlias = (idx: number, alias: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, alias } : r)));
  };

  const handleSelectAll = () => {
    const allSelected = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  };

  const selectedRows = rows.filter((r) => r.selected);

  const getPreviewData = (): PreviewData | null => {
    if (!mockData || selectedRows.length === 0) return null;
    const columns = selectedRows.map((e) => e.alias || e.originalName);
    const previewRows = mockData.rows.slice(0, 5).map((row) => {
      const record: Record<string, string> = {};
      for (const e of selectedRows) {
        const colAlias = e.alias || e.originalName;
        const colIdx = mockData.columns.indexOf(e.originalName);
        // use alias as key, append originalName to ensure uniqueness
        record[`${colAlias}__${e.originalName}`] =
          colIdx >= 0 ? row[colIdx] : "";
      }
      return record;
    });
    return { columns, rows: previewRows };
  };

  const previewData = showPreview ? getPreviewData() : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Field Selection
            <Badge variant="secondary" className="text-xs font-normal">
              {connection.name}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4">
          {/* Info bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {selectedRows.length} of {rows.length} fields selected
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-primary hover:underline"
            >
              {rows.every((r) => r.selected) ? "Deselect All" : "Select All"}
            </button>
          </div>

          {/* Fields table */}
          <ScrollArea className="flex-1 border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-xs">Select</TableHead>
                  <TableHead className="text-xs">Original Field Name</TableHead>
                  <TableHead className="text-xs">
                    Alias (for comparison)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-xs text-muted-foreground py-8"
                    >
                      No fields available. View data for this connection first.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, idx) => (
                    <TableRow
                      key={row.originalName}
                      className={!row.selected ? "opacity-50" : ""}
                      data-ocid={`field_selection.row.${idx + 1}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={() => toggleSelected(idx)}
                          data-ocid={`field_selection.checkbox.${idx + 1}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {row.originalName}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.alias}
                          onChange={(e) => updateAlias(idx, e.target.value)}
                          className="h-7 text-xs"
                          placeholder={row.originalName}
                          disabled={!row.selected}
                          data-ocid={`field_selection.input.${idx + 1}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Preview section */}
          <div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setShowPreview((v) => !v)}
              disabled={selectedRows.length === 0 || !mockData}
              data-ocid="field_selection.preview.button"
            >
              <Eye className="w-3.5 h-3.5" />
              {showPreview ? "Hide" : "Preview"} Selected Fields
            </Button>

            {showPreview && previewData && (
              <div className="mt-3 border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">
                    Preview — {previewData.columns.length} selected fields,{" "}
                    {previewData.rows.length} rows
                  </span>
                </div>
                <ScrollArea className="max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData.columns.map((col) => (
                          <TableHead
                            key={col}
                            className="text-xs whitespace-nowrap"
                          >
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.rows.map((rowRecord) => (
                        <TableRow key={Object.values(rowRecord).join("|")}>
                          {Object.entries(rowRecord).map(([k, cell]) => (
                            <TableCell key={k} className="text-xs">
                              {cell || (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            data-ocid="field_selection.cancel_button"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(rows);
              onClose();
            }}
            data-ocid="field_selection.save_button"
          >
            Save Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
