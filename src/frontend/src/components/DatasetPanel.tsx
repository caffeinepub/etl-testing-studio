import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  ChevronUp,
  Database,
  Eye,
  FileText,
  Loader2,
  Plus,
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
  LocalConnection,
  MockDataResult,
} from "../types/etl";
import { ConnectionForm } from "./ConnectionForm";
import { DataViewer } from "./DataViewer";

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
  const [expandedConn, setExpandedConn] = useState<string | null>(null);
  const [loadingMock, setLoadingMock] = useState<string | null>(null);

  const allColumns = Object.values(datasetState.mockDataMap)
    .flatMap((m) => m.columns)
    .filter((v, i, a) => a.indexOf(v) === i);

  const handleAddConnection = async (
    connData: Omit<LocalConnection, "id" | "createdAt" | "updatedAt">,
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
      onUpdateDataset({
        ...datasetState,
        connections: [...datasetState.connections, newConn],
      });
      setShowForm(false);
      toast.success("Connection added");
    } catch {
      toast.error("Failed to add connection");
    }
  };

  const handleViewData = async (conn: LocalConnection) => {
    if (!actor) return;
    const key = conn.id.toString();
    if (datasetState.mockDataMap[key]) {
      setExpandedConn(expandedConn === key ? null : key);
      return;
    }
    setLoadingMock(key);
    try {
      const result = await actor.getMockData(conn.id);
      if (result) {
        onUpdateDataset({
          ...datasetState,
          mockDataMap: {
            ...datasetState.mockDataMap,
            [key]: result as MockDataResult,
          },
        });
        setExpandedConn(key);
      }
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoadingMock(null);
    }
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

  const handleSaveFields = async () => {
    if (!actor) return;
    try {
      await actor.setFieldSelection(
        datasetState.id,
        datasetState.selectedFields,
      );
      toast.success("Field selection saved");
    } catch {
      toast.error("Failed to save field selection");
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

  const toggleField = (field: string) => {
    const fields = datasetState.selectedFields.includes(field)
      ? datasetState.selectedFields.filter((f) => f !== field)
      : [...datasetState.selectedFields, field];
    onUpdateDataset({ ...datasetState, selectedFields: fields });
  };

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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(!showForm)}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Connection
          </Button>
        </div>

        {showForm && (
          <div className="bg-muted/50 rounded-lg p-4 mb-3 border border-border">
            <ConnectionForm
              datasetId={datasetState.id}
              onSave={handleAddConnection}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {datasetState.connections.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-24 border border-dashed border-border rounded-lg">
            <p className="text-xs text-muted-foreground">No connections yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {datasetState.connections.map((conn) => {
              const key = conn.id.toString();
              const isExpanded = expandedConn === key;
              const mockData = datasetState.mockDataMap[key];
              const isLoadingThis = loadingMock === key;
              return (
                <div
                  key={key}
                  className="border border-border rounded-lg overflow-hidden"
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
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs"
                      onClick={() => handleViewData(conn)}
                      disabled={isLoadingThis}
                    >
                      {isLoadingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      View Data
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                  {isExpanded && mockData && (
                    <div className="p-3 border-t border-border bg-background/50">
                      <DataViewer data={mockData} />
                    </div>
                  )}
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

      {/* Field Selector */}
      {allColumns.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">
                Field Selection
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={handleSaveFields}
              >
                Save Fields
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allColumns.map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <Checkbox
                    id={`field-${col}`}
                    checked={datasetState.selectedFields.includes(col)}
                    onCheckedChange={() => toggleField(col)}
                  />
                  <label
                    htmlFor={`field-${col}`}
                    className="text-xs text-foreground cursor-pointer"
                  >
                    {col}
                  </label>
                </div>
              ))}
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
    </div>
  );
}
