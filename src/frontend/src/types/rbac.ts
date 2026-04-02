export type ETLRole =
  | "masterAdmin"
  | "admin"
  | "etlTester"
  | "apiTester"
  | "viewEtlTester"
  | "viewApiTester";

export interface UserRecord {
  principalText: string;
  role: ETLRole;
  isActive: boolean;
  registeredAt: bigint;
}
