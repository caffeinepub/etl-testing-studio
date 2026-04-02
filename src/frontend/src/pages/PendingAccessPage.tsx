import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, LogOut, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export function PendingAccessPage() {
  const { identity, clear } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? "";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!principal) return;
    await navigator.clipboard.writeText(principal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8 text-warning" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Access Pending
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account has not been activated yet. Please contact your
            administrator and provide your Principal ID below.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Your Principal ID
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-foreground break-all text-left bg-muted/50 rounded-lg p-3">
              {principal}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              data-ocid="pending.copy_button"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={clear}
          data-ocid="pending.logout_button"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </Button>
      </div>
    </div>
  );
}
