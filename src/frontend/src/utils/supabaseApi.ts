import type { MockDataResult } from "../types/etl";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHF2a2ttdHZ6Ym1lYXhudXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDU1MjEsImV4cCI6MjA4OTc4MTUyMX0._PVxJdaCNbYCMekkxne7igdZQ5UDVUrFXnyinW8dyJc";

export function isSupabaseHost(host: string): boolean {
  return host.includes("supabase.co");
}

/**
 * Fetches up to 100 rows from a Supabase table via the REST API.
 * Returns a MockDataResult with real column names and row values.
 */
export async function fetchSupabaseData(
  host: string,
  tableName: string,
): Promise<MockDataResult> {
  // The host stored in the connection is the bare hostname, e.g.
  // "db.xnhqvkkmtvzbmeaxnush.supabase.co". The REST API lives on the
  // project subdomain: "xnhqvkkmtvzbmeaxnush.supabase.co".
  // Derive the project ref from the hostname.
  const projectRef = host.replace(/^db\./, "").replace(/\.supabase\.co.*$/, "");
  const apiHost = `${projectRef}.supabase.co`;
  const url = `https://${apiHost}/rest/v1/${encodeURIComponent(tableName)}?select=*&limit=100`;

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Supabase API error ${response.status}: ${errText}`);
  }

  const data: Record<string, unknown>[] = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = Object.keys(data[0]);
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return String(val);
    }),
  );

  return { columns, rows };
}
