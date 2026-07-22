import {
  AdminDatabaseAccessError,
  readAdminDatabase,
  type AdminDatabaseJsonObject,
  type AdminSupabaseDatabaseContext,
} from "@/lib/adminDatabase";
import { formatAdminDateTime } from "@/lib/adminTime";

const MAX_AUDIT_EVENTS = 50;

type AdminAuditEventDbRow = {
  id: string;
  created_at: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type AdminAuditEvent = {
  id: string;
  createdAt: string;
  actorEmail: string;
  action: string;
  actionLabel: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type AdminAuditLogData = {
  isConfigured: boolean;
  errorMessage: string | null;
  generatedAt: string;
  retentionDays: number;
  events: AdminAuditEvent[];
};

function emptyAuditLogData(errorMessage: string | null = null): AdminAuditLogData {
  return {
    isConfigured: !errorMessage,
    errorMessage,
    generatedAt: new Date().toISOString(),
    retentionDays: getAuditRetentionDays(),
    events: [],
  };
}

function getAuditRetentionDays() {
  const rawValue = Number(process.env.NUTSNEWS_ADMIN_AUDIT_RETENTION_DAYS ?? 180);

  if (!Number.isFinite(rawValue)) {
    return 180;
  }

  return Math.max(30, Math.min(3650, Math.round(rawValue)));
}

function toObject(value: Record<string, unknown> | null): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value;
}

function getActionLabel(action: string) {
  if (action === "rss_feed.enable") {
    return "RSS feed enabled";
  }

  if (action === "rss_feed.disable") {
    return "RSS feed disabled";
  }

  if (action === "rss_feed.trust_tier_update") {
    return "RSS source trust tier updated";
  }

  return action
    .split(/[._:-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapAuditEvent(row: AdminAuditEventDbRow): AdminAuditEvent {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorEmail: row.actor_email,
    action: row.action,
    actionLabel: getActionLabel(row.action),
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    beforeValues: toObject(row.before_values),
    afterValues: toObject(row.after_values),
    metadata: toObject(row.metadata),
  };
}

type SupabaseConfig = ReturnType<AdminSupabaseDatabaseContext["getConfig"]>;

type AuditLogDatabaseResult = {
  rows: AdminDatabaseJsonObject[];
  rowCount?: number;
  generatedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAuditLogDatabaseResult(
  result: AuditLogDatabaseResult,
): AdminAuditEventDbRow[] {
  const rows = result.rows ?? [];
  const snapshot = rows[0];

  if (isRecord(snapshot) && Array.isArray(snapshot.auditEventRows)) {
    return snapshot.auditEventRows as AdminAuditEventDbRow[];
  }

  return rows as unknown as AdminAuditEventDbRow[];
}

async function fetchSupabaseAuditRows(
  config: SupabaseConfig,
  limit: number,
): Promise<AdminAuditEventDbRow[]> {
  const response = await fetch(
    `${config.url}/rest/v1/admin_audit_events?select=id,created_at,actor_email,action,target_type,target_id,target_label,before_values,after_values,metadata&order=created_at.desc&limit=${limit}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(errorText || `Supabase returned ${response.status}`);
  }

  return (await response.json()) as AdminAuditEventDbRow[];
}

async function loadSupabaseAuditLogRows(
  context: AdminSupabaseDatabaseContext,
  limit: number,
) {
  const rows = await fetchSupabaseAuditRows(context.getConfig(), limit);

  return {
    rows: rows as unknown as AdminDatabaseJsonObject[],
    rowCount: rows.length,
    generatedAt: new Date().toISOString(),
  };
}

async function loadAuditLogDatabaseRows(limit: number) {
  const result = await readAdminDatabase(
    "load-admin-audit-log",
    { limit },
    (context) => loadSupabaseAuditLogRows(context, limit),
    { cache: "no-store" },
  );

  return normalizeAuditLogDatabaseResult(result as AuditLogDatabaseResult);
}

function auditLogDataAccessErrorMessage(error: unknown) {
  if (error instanceof AdminDatabaseAccessError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    /server-side supabase access is not configured/i.test(error.message)
  ) {
    return "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for the admin audit log.";
  }

  return error instanceof Error ? error.message : "Unknown admin audit log error.";
}

export async function getAdminAuditLogData(limit = MAX_AUDIT_EVENTS): Promise<AdminAuditLogData> {
  const boundedLimit = Math.max(1, Math.min(MAX_AUDIT_EVENTS, Math.round(limit)));
  let rows: AdminAuditEventDbRow[];

  try {
    rows = await loadAuditLogDatabaseRows(boundedLimit);
  } catch (error) {
    return emptyAuditLogData(auditLogDataAccessErrorMessage(error));
  }

  return {
    isConfigured: true,
    errorMessage: null,
    generatedAt: new Date().toISOString(),
    retentionDays: getAuditRetentionDays(),
    events: rows.map((row) => mapAuditEvent(row)),
  };
}

export function formatAdminAuditDateTime(value: string | null, fallback = "Never") {
  return formatAdminDateTime(value, fallback);
}
