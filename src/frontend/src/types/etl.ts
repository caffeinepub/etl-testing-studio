import type {
  ConnectionType,
  DatasetType,
  DbType,
  FileType,
  JoinType,
  OutputFormat,
  SourceLocation,
} from "../backend";

export interface LocalConnection {
  id: bigint;
  datasetId: bigint;
  name: string;
  connectionType: ConnectionType;
  dbType?: DbType;
  host?: string;
  port?: bigint;
  dbName?: string;
  username?: string;
  password?: string;
  tableName?: string;
  fileType?: FileType;
  sourceLocation?: SourceLocation;
  filePath?: string;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface MockDataResult {
  columns: string[];
  rows: string[][];
}

export interface JoinConfig {
  joinType: JoinType;
  leftConnectionId: bigint;
  rightConnectionId: bigint;
  leftKey: string;
  rightKey: string;
}

export interface FieldSelectionEntry {
  originalName: string;
  alias: string;
  selected: boolean;
}

export interface DatasetState {
  id: bigint;
  datasetType: DatasetType;
  connections: LocalConnection[];
  joinConfig?: JoinConfig;
  selectedFields: string[];
  outputFormat?: OutputFormat;
  mockDataMap: Record<string, MockDataResult>; // connectionId -> MockData
  csvHeadersMap: Record<string, string[]>; // connectionId -> CSV headers
  fullDataMap: Record<string, MockDataResult>; // connectionId -> full CSV data
  metadataMap: Record<string, FieldMetadata[]>; // connectionId -> metadata
  fieldSelectionMap?: Record<string, FieldSelectionEntry[]>; // connectionId -> entries
}

export interface ComparisonResult {
  totalSourceRows: number;
  totalTargetRows: number;
  matchedRows: number;
  mismatchedRows: number;
  sourceDuplicates: number;
  targetDuplicates: number;
  fieldStats: FieldStat[];
}

export interface FieldStat {
  field: string;
  matchedCount: number;
  mismatchedCount: number;
  matchPercent: number;
}

export interface TestCase {
  id: string;
  description: string;
  sourceValue: string;
  targetValue: string;
  status: "Pass" | "Fail";
}

export interface FieldMetadata {
  originalName: string;
  mappedName: string;
  originalType: string;
  mappedType: string;
  format?: string;
}
