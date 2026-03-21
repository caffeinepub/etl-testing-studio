import { Button } from "@/components/ui/button";
import { Database, LogOut } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export function Header() {
  const { identity, clear } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? "";
  const shortPrincipal = principal ? `${principal.slice(0, 8)}...` : "";

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
        <span className="text-xs text-muted-foreground font-mono">
          {shortPrincipal}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </Button>
      </div>
    </header>
  );
}
