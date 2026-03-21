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
import type { ComparisonResult, DatasetState } from "../types/etl";

interface Props {
  sourceDataset: DatasetState;
  targetDataset: DatasetState;
}

export function ComparisonPanel({ sourceDataset, targetDataset }: Props) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    const srcMocks = Object.values(sourceDataset.mockDataMap);
    const tgtMocks = Object.values(targetDataset.mockDataMap);

    if (srcMocks.length === 0 || tgtMocks.length === 0) {
      alert(
        "Please view data for at least one source and one target connection first.",
      );
      return;
    }

    setRunning(true);
    await new Promise((r) => setTimeout(r, 600));
    // Merge all mock data from source and target
    const srcMerged = {
      columns: srcMocks[0].columns,
      rows: srcMocks.flatMap((m) => m.rows),
    };
    const tgtMerged = {
      columns: tgtMocks[0].columns,
      rows: tgtMocks.flatMap((m) => m.rows),
    };
    setResult(compareData(srcMerged, tgtMerged));
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
        <div className="flex flex-col items-center justify-center h-40 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            Click "Run Comparison" to start
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
              <Table>
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
