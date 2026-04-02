import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { Project } from "./backend";
import { Header } from "./components/Header";
import { RoleProvider, useRole } from "./context/RoleContext";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { AdminDashboard } from "./pages/AdminDashboard";
import { LoginPage } from "./pages/LoginPage";
import { PendingAccessPage } from "./pages/PendingAccessPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SubProjectPage } from "./pages/SubProjectPage";

function AppInner() {
  const { identity, isInitializing } = useInternetIdentity();
  const { userRecord, isLoading } = useRole();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  if (isInitializing || (identity && isLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!identity) {
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    );
  }

  if (!userRecord) {
    return (
      <>
        <PendingAccessPage />
        <Toaster />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header onOpenAdmin={() => setShowAdmin(true)} />
      <div className="flex flex-1 min-h-0">
        {showAdmin ? (
          <AdminDashboard onBack={() => setShowAdmin(false)} />
        ) : selectedProject ? (
          <SubProjectPage
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <ProjectsPage onSelectProject={setSelectedProject} />
        )}
      </div>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <AppInner />
    </RoleProvider>
  );
}
