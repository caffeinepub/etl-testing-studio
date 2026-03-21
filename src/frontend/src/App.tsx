import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { Project } from "./backend";
import { Header } from "./components/Header";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SubProjectPage } from "./pages/SubProjectPage";

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  if (isInitializing) {
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

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex flex-1 min-h-0">
        {selectedProject ? (
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
