import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  Database,
  Eye,
  FileText,
  ListFilter,
  Loader2,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  ConnectionType,
  DatasetType,
  JoinType,
  OutputFormat,
} from "../backend";
import { useActor } from "../hooks/useActor";
import type {
  DatasetState,
  FieldMetadata,
  FieldSelectionEntry,
  LocalConnection,
  MockDataResult,
} from "../types/etl";
import { applyMetadataToData } from "../utils/dataFormat";
import { fetchSupabaseData, isSupabaseHost } from "../utils/supabaseApi";
import { ConnectionForm } from "./ConnectionForm";
import { DataPreviewModal } from "./DataPreviewModal";
import { FieldSelectionModal } from "./FieldSelectionModal";
import { MetadataEditorModal } from "./MetadataEditorModal";

interface Props {
  datasetState: DatasetState;
  onUpdateDataset: (updated: DatasetState) => void;
}

type DbTypeLabel = Record<string, string>;
const DB_LABELS: DbTypeLabel = {
  sqlServer: "SQL Server",
  postgres: "PostgreSQL",
  mySql: "MySQL",
  db2: "DB2",
  databricks: "Databricks",
};
const FILE_LABELS: DbTypeLabel = {
  csv: "CSV",
  fixedWidth: "Fixed Width",
  parquet: "Parquet",
  json: "JSON",
  xml: "XML",
};

export function DatasetPanel({ datasetState, onUpdateDataset }: Props) {
  const { actor } = useActor();
  const [showForm, setShowForm] = useState(false);
  const [initialConnType, setInitialConnType] = useState<ConnectionType | null>(
    null,
  );
  const [loadingMock, setLoadingMock] = useState<string | null>(null);
  const [previewConn, setPreviewConn] = useState<LocalConnection | null>(null);
  const [metaConn, setMetaConn] = useState<LocalConnection | null>(null);
  const [fieldSelConnId, setFieldSelConnId] = useState<string | null>(null);
  const [deleteConnId, setDeleteConnId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const metadataMap = datasetState.metadataMap ?? {};
  const csvHeadersMap = datasetState.csvHeadersMap ?? {};
  const fieldSelectionMap = datasetState.fieldSelectionMap ?? {};

  const allColumns = Object.values(datasetState.mockDataMap)
    .flatMap((m) => m.columns)
    .filter((v, i, a) => a.indexOf(v) === i);

  const openForm = (connType: ConnectionType) => {
    setInitialConnType(connType);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setInitialConnType(null);
  };

  const handleAddConnection = async (
    connData: Omit<LocalConnection, "id" | "createdAt" | "updatedAt">,
    fileHeaders?: string[],
    fullData?: MockDataResult,
  ) => {
    if (!actor) return;
    try {
      const connObj = {
        ...connData,
        id: 0n,
        createdAt: 0n,
        updatedAt: 0n,
      };
      const newId = await actor.addConnection(datasetState.id, connObj);
      const newConn: LocalConnection = { ...connObj, id: newId };

      const updatedCsvHeadersMap =
        fileHeaders && fileHeaders.length > 0
          ? { ...csvHeadersMap, [newId.toString()]: fileHeaders }
          : csvHeadersMap;

      const updatedFullDataMap = fullData
        ? { ...(datasetState.fullDataMap ?? {}), [newId.toString()]: fullData }
        : (datasetState.fullDataMap ?? {});

      onUpdateDataset({
        ...datasetState,
        connections: [...datasetState.connections, newConn],
        csvHeadersMap: updatedCsvHeadersMap,
        fullDataMap: updatedFullDataMap,
      });
      closeForm();
      toast.success("Connection added");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to add connection: ${msg}`);
    }
  };

  const handleDeleteConnection = async () => {
    if (!actor || !deleteConnId) return;
    setDeleting(true);
    try {
      await actor.deleteConnection(BigInt(deleteConnId));

      // Clean up all maps
      const newMockDataMap = { ...datasetState.mockDataMap };
      delete newMockDataMap[deleteConnId];
      const newCsvHeadersMap = { ...csvHeadersMap };
      delete newCsvHeadersMap[deleteConnId];
      const newFullDataMap = { ...(datasetState.fullDataMap ?? {}) };
      delete newFullDataMap[deleteConnId];
      const newMetadataMap = { ...metadataMap };
      delete newMetadataMap[deleteConnId];
      const newFieldSelectionMap = { ...fieldSelectionMap };
      delete newFieldSelectionMap[deleteConnId];

      onUpdateDataset({
        ...datasetState,
        connections: datasetState.connections.filter(
          (c) => c.id.toString() !== deleteConnId,
        ),
        mockDataMap: newMockDataMap,
        csvHeadersMap: newCsvHeadersMap,
        fullDataMap: newFullDataMap,
        metadataMap: newMetadataMap,
        fieldSelectionMap: newFieldSelectionMap,
      });

      toast.success("Connection deleted");
    } catch {
      toast.error("Failed to delete connection");
    } finally {
      setDeleting(false);
      setDeleteConnId(null);
    }
  };

  const applyRealHeaders = (
    mockData: MockDataResult,
    realHeaders: string[],
  ): MockDataResult => {
    const colCount = realHeaders.length;
    const adjustedRows = mockData.rows.map((row) => {
      const adjusted = [...row];
      while (adjusted.length < colCount) adjusted.push("");
      return adjusted.slice(0, colCount);
    });
    return { columns: realHeaders, rows: adjustedRows };
  };

  /**
   * Returns real data for the connection.
   * - Supabase Postgres connections: fetch from Supabase REST API.
   * - CSV file connections: use full parsed data or cache.
   * - Everything else: use backend getMockData.
   */
  const fetchMockData = async (
    conn: LocalConnection,
  ): Promise<MockDataResult | null> => {
    const key = conn.id.toString();
    const isDatabase = conn.connectionType === ConnectionType.database;

    // For file connections, use cache if available.
    if (!isDatabase && datasetState.mockDataMap[key])
      return datasetState.mockDataMap[key];

    setLoadingMock(key);
    try {
      // Route Supabase Postgres connections through the REST API.
      if (
        isDatabase &&
        conn.host &&
        isSupabaseHost(conn.host) &&
        conn.tableName
      ) {
        const supabaseData = await fetchSupabaseData(conn.host, conn.tableName);
        onUpdateDataset({
          ...datasetState,
          mockDataMap: { ...datasetState.mockDataMap, [key]: supabaseData },
        });
        return supabaseData;
      }

      // Fallback: backend getMockData (returns mock rows for non-Supabase).
      if (!actor) return null;
      const result = await actor.getMockData(conn.id);
      if (result) {
        let mockData = result as MockDataResult;
        const realHeaders = csvHeadersMap[key];
        if (realHeaders && realHeaders.length > 0) {
          mockData = applyRealHeaders(mockData, realHeaders);
        }
        onUpdateDataset({
          ...datasetState,
          mockDataMap: { ...datasetState.mockDataMap, [key]: mockData },
        });
        return mockData;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to fetch data: ${msg}`);
    } finally {
      setLoadingMock(null);
    }
    return null;
  };

  const handleViewData = async (conn: LocalConnection) => {
    setPreviewConn(conn);
    await fetchMockData(conn);
  };

  const handleEditMetadata = async (conn: LocalConnection) => {
    setMetaConn(conn);
    await fetchMockData(conn);
  };

  const handleOpenFieldSelection = async (conn: LocalConnection) => {
    await fetchMockData(conn);
    setFieldSelConnId(conn.id.toString());
  };

  const handleLoadDataForPreview = async () => {
    if (!previewConn) return;
    await fetchMockData(previewConn);
  };

  const handleSaveJoin = async () => {
    if (!actor || !datasetState.joinConfig) return;
    try {
      await actor.setJoinConfig(datasetState.id, datasetState.joinConfig);
      toast.success("Join configuration saved");
    } catch {
      toast.error("Failed to save join config");
    }
  };

  const handleSaveFormat = async (fmt: OutputFormat) => {
    if (!actor) return;
    try {
      await actor.setOutputFormat(datasetState.id, fmt);
      onUpdateDataset({ ...datasetState, outputFormat: fmt });
      toast.success("Output format saved");
    } catch {
      toast.error("Failed to save format");
    }
  };

  const getDisplayData = (conn: LocalConnection): MockDataResult | null => {
    const key = conn.id.toString();
    const rawData = datasetState.mockDataMap[key] ?? null;
    if (!rawData) return null;
    const metadata = metadataMap[key] ?? [];
    if (metadata.length === 0) return rawData;
    return applyMetadataToData(rawData, metadata);
  };

  const fieldSelConn = fieldSelConnId
    ? (datasetState.connections.find(
        (c) => c.id.toString() === fieldSelConnId,
      ) ?? null)
    : null;

  const deleteConn = deleteConnId
    ? (datasetState.connections.find((c) => c.id.toString() === deleteConnId) ??
      null)
    : null;

  const datasetLabel =
    datasetState.datasetType === DatasetType.source ? "Source" : "Target";

  return (
    <div className="space-y-5">
      {/* Connections list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">
            {datasetLabel} Connections
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                data-ocid="dataset.add_connection.open_modal_button"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Connection
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => openForm(ConnectionType.database)}
                data-ocid="dataset.add_database.button"
                className="gap-2 cursor-pointer"
              >
                <Database className="w-4 h-4 text-info" />
                Add Database Connection
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openForm(ConnectionType.file)}
                data-ocid="dataset.add_files.button"
                className="gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-warning" />
                Add Files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showForm && initialConnType !== null && (
          <div className="bg-muted/50 rounded-lg p-4 mb-3 border border-border">
            <ConnectionForm
              datasetId={datasetState.id}
              initialConnType={initialConnType}
              onSave={handleAddConnection}
              onCancel={closeForm}
            />
          </div>
        )}

        {datasetState.connections.length === 0 && !showForm ? (
          <div
            className="flex flex-col items-center justify-center h-24 border border-dashed border-border rounded-lg"
            data-ocid="dataset.connections.empty_state"
          >
            <p className="text-xs text-muted-foreground">No connections yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {datasetState.connections.map((conn, idx) => {
              const key = conn.id.toString();
              const isLoadingThis = loadingMock === key;
              const selEntries = fieldSelectionMap[key] ?? [];
              const selectedCount = selEntries.filter((e) => e.selected).length;
              const totalCount = selEntries.length;
              const hasFieldSelection = totalCount > 0;
              return (
                <div
                  key={key}
                  className="border border-border rounded-lg overflow-hidden"
                  data-ocid={`dataset.connection.item.${idx + 1}`}
                >
                  <div className="flex items-center justify-between p-3 bg-card">
                    <div className="flex items-center gap-2">
                      {conn.connectionType === ConnectionType.database ? (
                        <Database className="w-4 h-4 text-info" />
                      ) : (
                        <FileText className="w-4 h-4 text-warning" />
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {conn.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {conn.connectionType === ConnectionType.database
                          ? (DB_LABELS[conn.dbType ?? ""] ?? conn.dbType)
                          : (FILE_LABELS[conn.fileType ?? ""] ?? conn.fileType)}
                      </Badge>
                      {hasFieldSelection && (
                        <Badge
                          variant="outline"
                          className="text-xs text-primary border-primary/40"
                        >
                          {selectedCount}/{totalCount} fields
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs"
                        onClick={() => handleViewData(conn)}
                        disabled={isLoadingThis}
                        data-ocid={`dataset.view_data.button.${idx + 1}`}
                      >
                        {isLoadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        View Data
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs"
                        onClick={() => handleEditMetadata(conn)}
                        disabled={isLoadingThis}
                        data-ocid={`dataset.edit_metadata.button.${idx + 1}`}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Edit Metadata
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs"
                        onClick={() => handleOpenFieldSelection(conn)}
                        disabled={isLoadingThis}
                        data-ocid={`dataset.field_selection.button.${idx + 1}`}
                      >
                        <ListFilter className="w-3.5 h-3.5" />
                        Field Selection
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConnId(key)}
                        disabled={isLoadingThis}
                        data-ocid={`dataset.delete_connection.button.${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Join Builder */}
      {datasetState.connections.length >= 2 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">
              Join Builder
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Join Type</Label>
                <Select
                  value={datasetState.joinConfig?.joinType ?? JoinType.inner}
                  onValueChange={(v) =>
                    onUpdateDataset({
                      ...datasetState,
                      joinConfig: {
                        ...(datasetState.joinConfig ?? {
                          leftConnectionId: datasetState.connections[0].id,
                          rightConnectionId: datasetState.connections[1].id,
                          leftKey: "",
                          rightKey: "",
                        }),
                        joinType: v as JoinType,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={JoinType.inner}>INNER JOIN</SelectItem>
                    <SelectItem value={JoinType.left}>LEFT JOIN</SelectItem>
                    <SelectItem value={JoinType.right}>RIGHT JOIN</SelectItem>
                    <SelectItem value={JoinType.full}>
                      FULL OUTER JOIN
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Left Connection</Label>
                <Select
                  value={
                    datasetState.joinConfig?.leftConnectionId?.toString() ??
                    datasetState.connections[0].id.toString()
                  }
                  onValueChange={(v) =>
                    onUpdateDataset({
                      ...datasetState,
                      joinConfig: {
                        ...(datasetState.joinConfig ?? {
                          joinType: JoinType.inner,
                          rightConnectionId: datasetState.connections[1].id,
                          leftKey: "",
                          rightKey: "",
                        }),
                        leftConnectionId: BigInt(v),
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {datasetState.connections.map((c) => (
                      <SelectItem key={c.id.toString()} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Left Join Key</Label>
                <Select
                  value={datasetState.joinConfig?.leftKey ?? ""}
                  onValueChange={(v) =>
                    onUpdateDataset({
                      ...datasetState,
                      joinConfig: {
                        ...(datasetState.joinConfig ?? {
                          joinType: JoinType.inner,
                          leftConnectionId: datasetState.connections[0].id,
                          rightConnectionId: datasetState.connections[1].id,
                          rightKey: "",
                        }),
                        leftKey: v,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {allColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Right Connection</Label>
                <Select
                  value={
                    datasetState.joinConfig?.rightConnectionId?.toString() ??
                    datasetState.connections[1].id.toString()
                  }
                  onValueChange={(v) =>
                    onUpdateDataset({
                      ...datasetState,
                      joinConfig: {
                        ...(datasetState.joinConfig ?? {
                          joinType: JoinType.inner,
                          leftConnectionId: datasetState.connections[0].id,
                          leftKey: "",
                          rightKey: "",
                        }),
                        rightConnectionId: BigInt(v),
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {datasetState.connections.map((c) => (
                      <SelectItem key={c.id.toString()} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Right Join Key</Label>
                <Select
                  value={datasetState.joinConfig?.rightKey ?? ""}
                  onValueChange={(v) =>
                    onUpdateDataset({
                      ...datasetState,
                      joinConfig: {
                        ...(datasetState.joinConfig ?? {
                          joinType: JoinType.inner,
                          leftConnectionId: datasetState.connections[0].id,
                          rightConnectionId: datasetState.connections[1].id,
                          leftKey: "",
                        }),
                        rightKey: v,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {allColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={handleSaveJoin}
                >
                  Save Join Config
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Output Format */}
      <>
        <Separator />
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium text-foreground shrink-0">
            Output Format
          </Label>
          <Select
            value={datasetState.outputFormat ?? OutputFormat.csv}
            onValueChange={(v) => handleSaveFormat(v as OutputFormat)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OutputFormat.csv}>CSV</SelectItem>
              <SelectItem value={OutputFormat.json}>JSON</SelectItem>
              <SelectItem value={OutputFormat.parquet}>Parquet</SelectItem>
              <SelectItem value={OutputFormat.xml}>XML</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>

      {/* Modals */}
      {previewConn && (
        <DataPreviewModal
          open={previewConn !== null}
          onClose={() => setPreviewConn(null)}
          connection={previewConn}
          mockData={getDisplayData(previewConn)}
          onLoadData={handleLoadDataForPreview}
          loading={loadingMock === previewConn.id.toString()}
        />
      )}

      {metaConn && (
        <MetadataEditorModal
          open={metaConn !== null}
          onClose={() => setMetaConn(null)}
          connection={metaConn}
          mockData={datasetState.mockDataMap[metaConn.id.toString()] ?? null}
          metadata={metadataMap[metaConn.id.toString()] ?? []}
          onSave={(meta: FieldMetadata[]) => {
            onUpdateDataset({
              ...datasetState,
              metadataMap: {
                ...metadataMap,
                [metaConn.id.toString()]: meta,
              },
            });
          }}
        />
      )}

      {fieldSelConn && (
        <FieldSelectionModal
          open={fieldSelConnId !== null}
          onClose={() => setFieldSelConnId(null)}
          connection={fieldSelConn}
          mockData={datasetState.mockDataMap[fieldSelConnId!] ?? null}
          entries={fieldSelectionMap[fieldSelConnId!] ?? []}
          onSave={(entries: FieldSelectionEntry[]) => {
            onUpdateDataset({
              ...datasetState,
              fieldSelectionMap: {
                ...fieldSelectionMap,
                [fieldSelConnId!]: entries,
              },
            });
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteConnId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConnId(null);
        }}
      >
        <AlertDialogContent data-ocid="dataset.delete_connection.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete connection?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConn ? (
                <>
                  Are you sure you want to delete{" "}
                  <strong>{deleteConn.name}</strong>? This action cannot be
                  undone.
                </>
              ) : (
                "Are you sure you want to delete this connection? This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              data-ocid="dataset.delete_connection.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConnection}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="dataset.delete_connection.confirm_button"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
