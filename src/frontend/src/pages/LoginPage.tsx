import { Button } from "@/components/ui/button";
import { Database, Loader2 } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export function LoginPage() {
  const { login, isLoggingIn, isInitializing } = useInternetIdentity();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-xl p-8 shadow-xl">
          <div className="flex flex-col items-center gap-6">
            <div className="w-14 h-14 rounded-xl bg-info/15 border border-info/30 flex items-center justify-center">
              <Database className="w-7 h-7 text-info" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">
                ETL Testing Studio
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to manage your ETL test projects
              </p>
            </div>
            <Button
              className="w-full"
              onClick={login}
              disabled={isLoggingIn || isInitializing}
            >
              {isLoggingIn || isInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Login with Internet Identity"
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Secure authentication via Internet Computer Identity
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
