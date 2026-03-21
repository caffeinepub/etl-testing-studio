import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Connection {
    id: ConnectionId;
    username?: string;
    datasetId: DatasetId;
    host?: string;
    password?: string;
    name: string;
    createdAt: bigint;
    port?: bigint;
    filePath?: string;
    fileType?: FileType;
    sourceLocation?: SourceLocation;
    connectionType: ConnectionType;
    updatedAt: bigint;
    dbName?: string;
    dbType?: DbType;
    tableName?: string;
}
export interface SubProject {
    id: SubProjectId;
    name: string;
    targetDataset: DatasetId;
    createdAt: bigint;
    description: string;
    sourceDataset: DatasetId;
    updatedAt: bigint;
    projectId: ProjectId;
}
export type SubProjectId = bigint;
export interface MockData {
    rows: Array<Array<string>>;
    columns: Array<string>;
}
export type DatasetId = bigint;
export interface JoinConfig {
    leftConnectionId: ConnectionId;
    joinType: JoinType;
    rightConnectionId: ConnectionId;
    rightKey: string;
    leftKey: string;
}
export type ConnectionId = bigint;
export interface Dataset {
    id: DatasetId;
    subProjectId: SubProjectId;
    name: string;
    createdAt: bigint;
    updatedAt: bigint;
    datasetType: DatasetType;
}
export type ProjectId = bigint;
export interface Project {
    id: ProjectId;
    owner: Principal;
    name: string;
    createdAt: bigint;
    description: string;
    updatedAt: bigint;
    subProjects: Array<SubProjectId>;
}
export enum ConnectionType {
    file = "file",
    database = "database"
}
export enum DatasetType {
    source = "source",
    target = "target"
}
export enum DbType {
    db2 = "db2",
    mySql = "mySql",
    postgres = "postgres",
    sqlServer = "sqlServer",
    databricks = "databricks"
}
export enum FileType {
    csv = "csv",
    xml = "xml",
    json = "json",
    fixedWidth = "fixedWidth",
    parquet = "parquet"
}
export enum JoinType {
    full = "full",
    left = "left",
    inner = "inner",
    right = "right"
}
export enum OutputFormat {
    csv = "csv",
    xml = "xml",
    json = "json",
    parquet = "parquet"
}
export enum SourceLocation {
    azureBlob = "azureBlob",
    network = "network",
    local = "local"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addConnection(datasetId: DatasetId, connection: Connection): Promise<ConnectionId>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createProject(name: string, description: string): Promise<ProjectId>;
    createSubProject(projectId: ProjectId, name: string, description: string): Promise<SubProjectId>;
    deleteProject(projectId: ProjectId): Promise<void>;
    getCallerUserRole(): Promise<UserRole>;
    getConnectionById(connectionId: ConnectionId): Promise<Connection | null>;
    getDatasetById(datasetId: DatasetId): Promise<Dataset | null>;
    getMockData(connectionId: ConnectionId): Promise<MockData | null>;
    getProjects(): Promise<Array<Project>>;
    getSubProjects(projectId: ProjectId): Promise<Array<SubProject>>;
    isCallerAdmin(): Promise<boolean>;
    setFieldSelection(datasetId: DatasetId, fields: Array<string>): Promise<void>;
    setJoinConfig(datasetId: DatasetId, config: JoinConfig): Promise<void>;
    setOutputFormat(datasetId: DatasetId, format: OutputFormat): Promise<void>;
}
