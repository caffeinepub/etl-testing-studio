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
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Loader2,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { ConnectionType, DbType, FileType, SourceLocation } from "../backend";
import { useActor } from "../hooks/useActor";
import type { LocalConnection, MockDataResult } from "../types/etl";

interface Props {
  datasetId: bigint;
  initialConnType?: ConnectionType;
  onSave: (
    conn: Omit<LocalConnection, "id" | "createdAt" | "updatedAt">,
    fileHeaders?: string[],
    fullData?: MockDataResult,
  ) => Promise<void>;
  onCancel: () => void;
}

function parseCSVHeaders(line: string): string[] {
  const headers: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      headers.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current || headers.length > 0) {
    headers.push(current.trim());
  }
  return headers.filter(Boolean);
}

function parseCSVAllRows(text: string): MockDataResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const headers = parseCSVHeaders(lines[0] ?? "");
  const rows = lines.slice(1).map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') {
        inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    while (cells.length < headers.length) cells.push("");
    return cells.slice(0, headers.length);
  });
  return { columns: headers, rows };
}

type TestStatus = { ok: boolean; message: string } | null;

export function ConnectionForm({
  datasetId,
  initialConnType,
  onSave,
  onCancel,
}: Props) {
  const { actor } = useActor();
  const [saving, setSaving] = useState(false);
  const [connName, setConnName] = useState("");
  const [connType, setConnType] = useState<ConnectionType>(
    initialConnType ?? ConnectionType.database,
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
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fullCsvData, setFullCsvData] = useState<MockDataResult | null>(null);
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<TestStatus>(null);
  const [testValidationError, setTestValidationError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearTestResult = () => {
    setTestResult(null);
    setTestValidationError("");
  };

  const handleFieldChange =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      clearTestResult();
    };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilePath(file.name);

    if (fileType === FileType.csv) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) {
          const parsed = parseCSVAllRows(text);
          setFileHeaders(parsed.columns);
          setFullCsvData(parsed);
        }
      };
      reader.readAsText(file);
    } else {
      setFileHeaders([]);
      setFullCsvData(null);
    }
  };

  const isSslError = (message: string) =>
    message.includes("InvalidCertificate") ||
    message.includes("ExpiredContext") ||
    message.includes("Certificate");

  const handleTestConnection = async () => {
    setTestValidationError("");
    setTestResult(null);

    // Option A: field validation
    const missing: string[] = [];
    if (!host.trim()) missing.push("Host");
    if (!port.trim()) missing.push("Port");
    if (!dbName.trim()) missing.push("Database Name");
    if (!username.trim()) missing.push("Username");
    if (!password.trim()) missing.push("Password");
    if (!tableName.trim()) missing.push("Table Name");

    if (missing.length > 0) {
      setTestValidationError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    if (!actor) {
      setTestValidationError("Not connected to backend. Please try again.");
      return;
    }

    // Option B: live test
    setTestingConn(true);
    try {
      const result = await actor.testDatabaseConnection(host);
      // If the error is only an SSL cert issue, treat as reachable with a warning
      if (!result.ok && isSslError(result.message)) {
        setTestResult({ ok: true, message: "ssl_warning" });
      } else {
        setTestResult(result);
      }
    } catch {
      setTestResult({
        ok: false,
        message: "Connection test failed. Please check your details.",
      });
    } finally {
      setTestingConn(false);
    }
  };

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
      await onSave(
        conn,
        fileHeaders.length > 0 ? fileHeaders : undefined,
        fullCsvData ?? undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  const renderTestResult = () => {
    if (!testResult) return null;

    if (testResult.message === "ssl_warning") {
      return (
        <div
          className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
          data-ocid="connection.test_connection.success_state"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            Host is reachable. SSL certificate issue detected — connection
            should still work in most ETL tools.
          </span>
        </div>
      );
    }

    if (testResult.ok) {
      return (
        <p
          className="mt-2 flex items-center gap-1 text-xs text-green-600"
          data-ocid="connection.test_connection.success_state"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {`Connection successful — ${host} is reachable`}
        </p>
      );
    }

    return (
      <p
        className="mt-2 flex items-center gap-1 text-xs text-destructive"
        data-ocid="connection.test_connection.error_state"
      >
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        {testResult.message}
      </p>
    );
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".csv,.txt,.json,.xml,.parquet"
        onChange={handleFileSelect}
      />
      <div className="space-y-1.5">
        <Label>Connection Name</Label>
        <Input
          placeholder="e.g. SQL Server - Customers"
          value={connName}
          onChange={(e) => setConnName(e.target.value)}
          data-ocid="connection.name.input"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Connection Type</Label>
        <Select
          value={connType}
          onValueChange={(v) => {
            setConnType(v as ConnectionType);
            clearTestResult();
          }}
        >
          <SelectTrigger data-ocid="connection.type.select">
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
              onValueChange={(v) => {
                setDbType(v as DbType);
                clearTestResult();
              }}
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
              onChange={handleFieldChange(setHost)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Port</Label>
            <Input
              placeholder="1433"
              value={port}
              onChange={handleFieldChange(setPort)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Database Name</Label>
            <Input
              placeholder="mydb"
              value={dbName}
              onChange={handleFieldChange(setDbName)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input
              placeholder="user"
              value={username}
              onChange={handleFieldChange(setUsername)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="••••••"
              value={password}
              onChange={handleFieldChange(setPassword)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Table Name</Label>
            <Input
              placeholder="dbo.customers"
              value={tableName}
              onChange={handleFieldChange(setTableName)}
            />
          </div>

          {/* Test Connection */}
          <div className="col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleTestConnection}
              disabled={testingConn}
              data-ocid="connection.test_connection.button"
            >
              {testingConn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Activity className="w-4 h-4" />
              )}
              {testingConn ? "Testing..." : "Test Connection"}
            </Button>

            {testValidationError && (
              <p
                className="mt-2 text-xs text-destructive flex items-center gap-1"
                data-ocid="connection.test_connection.error_state"
              >
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                {testValidationError}
              </p>
            )}

            {renderTestResult()}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>File Type</Label>
            <Select
              value={fileType}
              onValueChange={(v) => {
                setFileType(v as FileType);
                setFileHeaders([]);
                setFullCsvData(null);
              }}
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
            {sourceLocation === SourceLocation.local ? (
              <div className="flex gap-2">
                <Input
                  className="flex-1 cursor-pointer"
                  placeholder="Click to browse or type a path..."
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  onClick={() => fileInputRef.current?.click()}
                  readOnly={false}
                  data-ocid="connection.filepath.input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  title="Browse local files"
                  data-ocid="connection.browse.button"
                >
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Input
                placeholder={
                  sourceLocation === SourceLocation.azureBlob
                    ? "https://account.blob.core.windows.net/container/file.csv"
                    : "//server/share/file.csv"
                }
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                data-ocid="connection.filepath.input"
              />
            )}
            {fileHeaders.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                ✓ Detected {fileHeaders.length} column
                {fileHeaders.length !== 1 ? "s" : ""}:{" "}
                <span className="font-medium">
                  {fileHeaders.slice(0, 5).join(", ")}
                  {fileHeaders.length > 5
                    ? ` +${fileHeaders.length - 5} more`
                    : ""}
                </span>
                {fullCsvData && fullCsvData.rows.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    ({fullCsvData.rows.length} row
                    {fullCsvData.rows.length !== 1 ? "s" : ""} loaded)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          data-ocid="connection.cancel_button"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !connName.trim()}
          data-ocid="connection.submit_button"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add Connection
        </Button>
      </div>
    </div>
  );
}
