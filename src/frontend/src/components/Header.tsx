import { Button } from "@/components/ui/button";
import { Database, LogOut, Users } from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { ETLRole } from "../types/rbac";

const ROLE_BADGE: Record<ETLRole, { label: string; className: string }> = {
  masterAdmin: {
    label: "Master Admin",
    className: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  },
  admin: {
    label: "Admin",
    className: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  },
  etlTester: {
    label: "ETL Tester",
    className: "bg-green-500/15 text-green-400 border border-green-500/20",
  },
  apiTester: {
    label: "API Tester",
    className: "bg-teal-500/15 text-teal-400 border border-teal-500/20",
  },
  viewEtlTester: {
    label: "View ETL",
    className: "bg-muted text-muted-foreground border border-border",
  },
  viewApiTester: {
    label: "View API",
    className: "bg-muted text-muted-foreground border border-border",
  },
};

interface Props {
  onOpenAdmin: () => void;
}

export function Header({ onOpenAdmin }: Props) {
  const { identity, clear } = useInternetIdentity();
  const { userRecord, isAdmin } = useRole();
  const principal = identity?.getPrincipal().toString() ?? "";
  const shortPrincipal = principal ? `${principal.slice(0, 8)}...` : "";
  const badge = userRecord ? ROLE_BADGE[userRecord.role] : null;

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-info/20 flex items-center justify-center">
          <Database className="w-4 h-4 text-info" />
        </div>
        <span className="font-semibold text-foreground text-sm tracking-wide">
          ETL Testing Studio
        </span>
      </div>
      <div className="flex items-center gap-3">
        {badge && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              badge.className
            }`}
          >
            {badge.label}
          </span>
        )}
        <span className="text-xs text-muted-foreground font-mono">
          {shortPrincipal}
        </span>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenAdmin}
            className="text-muted-foreground hover:text-foreground gap-1.5"
            data-ocid="header.admin_button"
          >
            <Users className="w-3.5 h-3.5" />
            Users
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground gap-1.5"
          data-ocid="header.logout_button"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </Button>
      </div>
    </header>
  );
}
