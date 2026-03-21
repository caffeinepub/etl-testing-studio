import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { ConnectionType, DbType, FileType, SourceLocation } from "../backend";
import type { LocalConnection } from "../types/etl";

interface Props {
  datasetId: bigint;
  onSave: (
    conn: Omit<LocalConnection, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onCancel: () => void;
}

export function ConnectionForm({ datasetId, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [connName, setConnName] = useState("");
  const [connType, setConnType] = useState<ConnectionType>(
    ConnectionType.database,
  );
  const [dbType, setDbType] = useState<DbType>(DbType.sqlServer);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("1433");
  const [dbName, setDbName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tableName, setTableName] = useState("");
  const [fileType, setFileType] = useState<FileType>(FileType.csv);
  const [sourceLocation, setSourceLocation] = useState<SourceLocation>(
    SourceLocation.local,
  );
  const [filePath, setFilePath] = useState("");

  const handleSave = async () => {
    setSaving(true);
    try {
      const conn: Omit<LocalConnection, "id" | "createdAt" | "updatedAt"> = {
        datasetId,
        name: connName,
        connectionType: connType,
        ...(connType === ConnectionType.database
          ? {
              dbType,
              host,
              port: BigInt(port || "0"),
              dbName,
              username,
              password,
              tableName,
            }
          : {
              fileType,
              sourceLocation,
              filePath,
            }),
      };
      await onSave(conn);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Connection Name</Label>
        <Input
          placeholder="e.g. SQL Server - Customers"
          value={connName}
          onChange={(e) => setConnName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Connection Type</Label>
        <Select
          value={connType}
          onValueChange={(v) => setConnType(v as ConnectionType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ConnectionType.database}>Database</SelectItem>
            <SelectItem value={ConnectionType.file}>File</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {connType === ConnectionType.database ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Database Type</Label>
            <Select
              value={dbType}
              onValueChange={(v) => setDbType(v as DbType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DbType.sqlServer}>SQL Server</SelectItem>
                <SelectItem value={DbType.postgres}>PostgreSQL</SelectItem>
                <SelectItem value={DbType.mySql}>MySQL</SelectItem>
                <SelectItem value={DbType.db2}>DB2</SelectItem>
                <SelectItem value={DbType.databricks}>Databricks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Host</Label>
            <Input
              placeholder="localhost"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Port</Label>
            <Input
              placeholder="1433"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Database Name</Label>
            <Input
              placeholder="mydb"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input
              placeholder="user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Table Name</Label>
            <Input
              placeholder="dbo.customers"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>File Type</Label>
            <Select
              value={fileType}
              onValueChange={(v) => setFileType(v as FileType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FileType.csv}>CSV</SelectItem>
                <SelectItem value={FileType.fixedWidth}>Fixed Width</SelectItem>
                <SelectItem value={FileType.parquet}>Parquet</SelectItem>
                <SelectItem value={FileType.json}>JSON</SelectItem>
                <SelectItem value={FileType.xml}>XML</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source Location</Label>
            <Select
              value={sourceLocation}
              onValueChange={(v) => setSourceLocation(v as SourceLocation)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SourceLocation.local}>Local</SelectItem>
                <SelectItem value={SourceLocation.network}>Network</SelectItem>
                <SelectItem value={SourceLocation.azureBlob}>
                  Azure Blob
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>File Path / URL</Label>
            <Input
              placeholder="/data/file.csv"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !connName.trim()}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add Connection
        </Button>
      </div>
    </div>
  );
}
