import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FlaskConical, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { exportTestCasesCSV, generateTestCases } from "../lib/comparison";
import type { DatasetState, TestCase } from "../types/etl";

interface Props {
  sourceDataset: DatasetState;
  targetDataset: DatasetState;
}

export function TestCasesPanel({ sourceDataset, targetDataset }: Props) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    const srcMocks = Object.values(sourceDataset.mockDataMap);
    const tgtMocks = Object.values(targetDataset.mockDataMap);

    if (srcMocks.length === 0 || tgtMocks.length === 0) {
      alert(
        "Please view data for at least one source and one target connection first.",
      );
      return;
    }

    setGenerating(true);
    await new Promise((r) => setTimeout(r, 500));
    const srcMerged = {
      columns: srcMocks[0].columns,
      rows: srcMocks.flatMap((m) => m.rows),
    };
    const tgtMerged = {
      columns: tgtMocks[0].columns,
      rows: tgtMocks.flatMap((m) => m.rows),
    };
    setTestCases(generateTestCases(srcMerged, tgtMerged));
    setGenerating(false);
  };

  const passCount = testCases.filter((tc) => tc.status === "Pass").length;
  const failCount = testCases.filter((tc) => tc.status === "Fail").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Test Cases</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-generated test cases from source vs target comparison
          </p>
        </div>
        <div className="flex items-center gap-2">
          {testCases.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportTestCasesCSV(testCases)}
              className="gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="gap-1.5"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Generate Test Cases
          </Button>
        </div>
      </div>

      {testCases.length === 0 && !generating ? (
        <div className="flex flex-col items-center justify-center h-40 border border-dashed border-border rounded-xl gap-3">
          <FlaskConical className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No test cases yet. Click "Generate Test Cases" to start.
          </p>
        </div>
      ) : (
        <>
          {testCases.length > 0 && (
            <div className="flex items-center gap-3">
              <Badge className="bg-success/15 text-success border-success/30">
                {passCount} Pass
              </Badge>
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                {failCount} Fail
              </Badge>
              <span className="text-xs text-muted-foreground">
                {testCases.length} total test cases
              </span>
            </div>
          )}
          <ScrollArea className="h-96">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-24">Test Case ID</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">Source Value</TableHead>
                    <TableHead className="text-xs">Target Value</TableHead>
                    <TableHead className="text-xs w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testCases.map((tc) => (
                    <TableRow key={tc.id}>
                      <TableCell className="text-xs font-mono font-semibold text-info">
                        {tc.id}
                      </TableCell>
                      <TableCell className="text-xs">
                        {tc.description}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {tc.sourceValue}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {tc.targetValue}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            tc.status === "Pass"
                              ? "text-success border-success/40 bg-success/10 text-xs"
                              : "text-destructive border-destructive/40 bg-destructive/10 text-xs"
                          }
                        >
                          {tc.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
