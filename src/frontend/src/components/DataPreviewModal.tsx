import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw } from "lucide-react";
import type { LocalConnection, MockDataResult } from "../types/etl";
import { DataViewer } from "./DataViewer";

interface Props {
  open: boolean;
  onClose: () => void;
  connection: LocalConnection;
  mockData: MockDataResult | null;
  onLoadData: () => Promise<void>;
  loading: boolean;
}

export function DataPreviewModal({
  open,
  onClose,
  connection,
  mockData,
  onLoadData,
  loading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-4xl w-full"
        data-ocid="data_preview.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {connection.name}
            {mockData && (
              <span className="text-xs font-normal text-muted-foreground">
                — {mockData.rows.length} rows × {mockData.columns.length} cols
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[200px] flex flex-col">
          {loading ? (
            <div
              className="flex flex-col items-center justify-center flex-1 gap-3 py-12"
              data-ocid="data_preview.loading_state"
            >
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading data...</p>
            </div>
          ) : mockData ? (
            <ScrollArea className="h-[420px] w-full">
              <DataViewer data={mockData} />
            </ScrollArea>
          ) : (
            <div
              className="flex flex-col items-center justify-center flex-1 gap-4 py-12"
              data-ocid="data_preview.empty_state"
            >
              <p className="text-sm text-muted-foreground">
                No data loaded yet for this connection.
              </p>
              <Button
                onClick={onLoadData}
                className="gap-2"
                data-ocid="data_preview.primary_button"
              >
                <RefreshCw className="w-4 h-4" />
                Load Data
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {mockData && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadData}
              disabled={loading}
              className="gap-1.5"
              data-ocid="data_preview.secondary_button"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-ocid="data_preview.close_button"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
