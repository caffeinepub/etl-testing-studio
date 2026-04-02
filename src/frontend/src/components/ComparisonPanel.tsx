import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { compareData } from "../lib/comparison";
import { applyMetadataFormatting } from "../lib/formatUtils";
import type {
  ComparisonResult,
  DatasetState,
  MockDataResult,
} from "../types/etl";

interface Props {
  sourceDataset: DatasetState;
  targetDataset: DatasetState;
}

function getDataForDataset(dataset: DatasetState): MockDataResult | null {
  const allData = dataset.connections
    .map((conn) => {
      const key = conn.id.toString();
      const raw = dataset.fullDataMap?.[key] ?? dataset.mockDataMap[key];
      if (!raw) return null;

      const selEntries = dataset.fieldSelectionMap?.[key];
      if (!selEntries || selEntries.length === 0) return raw;

      const selectedEntries = selEntries.filter((e) => e.selected);
      if (selectedEntries.length === 0) return raw;

      const newColumns = selectedEntries.map((e) => e.alias || e.originalName);
      const newRows = raw.rows.map((row) =>
        selectedEntries.map((e) => {
          const idx = raw.columns.indexOf(e.originalName);
          return idx >= 0 ? row[idx] : "";
        }),
      );
      return { columns: newColumns, rows: newRows };
    })
    .filter(Boolean) as MockDataResult[];

  if (allData.length === 0) return null;
  return {
    columns: allData[0].columns,
    rows: allData.flatMap((d) => d.rows),
  };
}

export function ComparisonPanel({ sourceDataset, targetDataset }: Props) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    const srcData = getDataForDataset(sourceDataset);
    const tgtData = getDataForDataset(targetDataset);

    if (!srcData || !tgtData) {
      alert(
        "Please view data for at least one source and one target connection first.",
      );
      return;
    }

    // Apply metadata format transformations before comparison
    const srcMetadata = Object.values(sourceDataset.metadataMap).flat();
    const tgtMetadata = Object.values(targetDataset.metadataMap).flat();
    const transformedSrc = applyMetadataFormatting(srcData, srcMetadata);
    const transformedTgt = applyMetadataFormatting(tgtData, tgtMetadata);

    setRunning(true);
    await new Promise((r) => setTimeout(r, 600));
    setResult(compareData(transformedSrc, transformedTgt));
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Data Comparison
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare source and target datasets field by field
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={running}
          className="gap-1.5"
          data-ocid="comparison.run.button"
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Run Comparison
        </Button>
      </div>

      {!result && !running && (
        <div
          className="flex flex-col items-center justify-center h-40 border border-dashed border-border rounded-xl"
          data-ocid="comparison.empty_state"
        >
          <p className="text-sm text-muted-foreground">
            Click &quot;Run Comparison&quot; to start
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Make sure you have viewed data in both source and target connections
          </p>
        </div>
      )}

      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Matched Rows"
              value={result.matchedRows}
              icon={<CheckCircle2 className="w-4 h-4 text-success" />}
              color="text-success"
            />
            <StatCard
              label="Mismatched Rows"
              value={result.mismatchedRows}
              icon={<XCircle className="w-4 h-4 text-destructive" />}
              color="text-destructive"
            />
            <StatCard
              label="Source Duplicates"
              value={result.sourceDuplicates}
              icon={<Copy className="w-4 h-4 text-warning" />}
              color="text-warning"
            />
            <StatCard
              label="Target Duplicates"
              value={result.targetDuplicates}
              icon={<AlertTriangle className="w-4 h-4 text-warning" />}
              color="text-warning"
            />
          </div>

          {/* Row summary */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Source rows:{" "}
              <strong className="text-foreground">
                {result.totalSourceRows}
              </strong>
            </span>
            <span>
              Target rows:{" "}
              <strong className="text-foreground">
                {result.totalTargetRows}
              </strong>
            </span>
          </div>

          {/* Field-by-field table */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Field-by-Field Validation
            </h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table data-ocid="comparison.table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Field</TableHead>
                    <TableHead className="text-xs">Matched</TableHead>
                    <TableHead className="text-xs">Mismatched</TableHead>
                    <TableHead className="text-xs">Match %</TableHead>
                    <TableHead className="text-xs w-40">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.fieldStats.map((stat) => (
                    <TableRow key={stat.field}>
                      <TableCell className="text-xs font-mono font-medium">
                        {stat.field}
                      </TableCell>
                      <TableCell className="text-xs text-success">
                        {stat.matchedCount}
                      </TableCell>
                      <TableCell className="text-xs text-destructive">
                        {stat.mismatchedCount}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        {stat.matchPercent}%
                      </TableCell>
                      <TableCell>
                        <Progress value={stat.matchPercent} className="h-1.5" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
