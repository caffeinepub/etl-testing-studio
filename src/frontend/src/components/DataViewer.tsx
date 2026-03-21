import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MockDataResult } from "../types/etl";

interface Props {
  data: MockDataResult;
}

export function DataViewer({ data }: Props) {
  if (!data.columns.length) {
    return <p className="text-sm text-muted-foreground">No data available.</p>;
  }

  return (
    <ScrollArea className="h-64 rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {data.columns.map((col) => (
              <TableHead
                key={col}
                className="text-xs font-semibold text-muted-foreground whitespace-nowrap"
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row, i) => {
            const rowKey = row.slice(0, 2).join("-") || String(i);
            return (
              <TableRow key={rowKey}>
                {data.columns.map((col, j) => (
                  <TableCell
                    key={col}
                    className="text-xs font-mono whitespace-nowrap"
                  >
                    {row[j] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
