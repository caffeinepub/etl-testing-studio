import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, FolderKanban, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Project, SubProject } from "../backend";
import { DatasetType } from "../backend";
import { ComparisonPanel } from "../components/ComparisonPanel";
import { DatasetPanel } from "../components/DatasetPanel";
import { TestCasesPanel } from "../components/TestCasesPanel";
import { useActor } from "../hooks/useActor";
import type { DatasetState } from "../types/etl";

interface Props {
  project: Project;
  onBack: () => void;
}

type DatasetMap = Record<string, DatasetState>;

function makeEmptyDataset(id: bigint, type: DatasetType): DatasetState {
  return {
    id,
    datasetType: type,
    connections: [],
    selectedFields: [],
    mockDataMap: {},
  };
}

export function SubProjectPage({ project, onBack }: Props) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSub, setSelectedSub] = useState<SubProject | null>(null);
  const [datasetMap, setDatasetMap] = useState<DatasetMap>({});

  const { data: subProjects = [], isLoading } = useQuery({
    queryKey: ["subprojects", project.id.toString()],
    queryFn: () => actor!.getSubProjects(project.id),
    enabled: !!actor,
  });

  const createMutation = useMutation({
    mutationFn: () => actor!.createSubProject(project.id, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subprojects", project.id.toString()],
      });
      setOpen(false);
      setName("");
      setDescription("");
      toast.success("Sub-project created");
    },
    onError: () => toast.error("Failed to create sub-project"),
  });

  const getOrCreateDatasetState = (
    sub: SubProject,
    type: "source" | "target",
  ): DatasetState => {
    const id = type === "source" ? sub.sourceDataset : sub.targetDataset;
    const key = id.toString();
    const dsType = type === "source" ? DatasetType.source : DatasetType.target;
    return datasetMap[key] ?? makeEmptyDataset(id, dsType);
  };

  const handleUpdateDataset = (updated: DatasetState) => {
    setDatasetMap((prev) => ({ ...prev, [updated.id.toString()]: updated }));
  };

  const handleSelectSub = (sub: SubProject) => {
    setSelectedSub(sub);
    const srcKey = sub.sourceDataset.toString();
    const tgtKey = sub.targetDataset.toString();
    setDatasetMap((prev) => ({
      ...prev,
      [srcKey]:
        prev[srcKey] ?? makeEmptyDataset(sub.sourceDataset, DatasetType.source),
      [tgtKey]:
        prev[tgtKey] ?? makeEmptyDataset(sub.targetDataset, DatasetType.target),
    }));
  };

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 -ml-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Projects
          </Button>
          <h2 className="text-sm font-semibold text-foreground truncate">
            {project.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {project.description}
          </p>
        </div>
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sub-Projects
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="w-5 h-5"
              onClick={() => setOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : subProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">
                No sub-projects yet
              </p>
            ) : (
              subProjects.map((sub) => (
                <button
                  type="button"
                  key={sub.id.toString()}
                  onClick={() => handleSelectSub(sub)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedSub?.id === sub.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{sub.name}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {!selectedSub ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <FolderKanban className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Select a sub-project to get started
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Sub-Project
            </Button>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                {selectedSub.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedSub.description}
              </p>
            </div>
            <Tabs defaultValue="source">
              <TabsList className="mb-5">
                <TabsTrigger value="source">Source Dataset</TabsTrigger>
                <TabsTrigger value="target">Target Dataset</TabsTrigger>
                <TabsTrigger value="comparison">Comparison</TabsTrigger>
                <TabsTrigger value="testcases">Test Cases</TabsTrigger>
              </TabsList>

              <TabsContent value="source">
                <div className="bg-card border border-border rounded-xl p-5">
                  <DatasetPanel
                    datasetState={getOrCreateDatasetState(
                      selectedSub,
                      "source",
                    )}
                    onUpdateDataset={handleUpdateDataset}
                  />
                </div>
              </TabsContent>

              <TabsContent value="target">
                <div className="bg-card border border-border rounded-xl p-5">
                  <DatasetPanel
                    datasetState={getOrCreateDatasetState(
                      selectedSub,
                      "target",
                    )}
                    onUpdateDataset={handleUpdateDataset}
                  />
                </div>
              </TabsContent>

              <TabsContent value="comparison">
                <div className="bg-card border border-border rounded-xl p-5">
                  <ComparisonPanel
                    sourceDataset={getOrCreateDatasetState(
                      selectedSub,
                      "source",
                    )}
                    targetDataset={getOrCreateDatasetState(
                      selectedSub,
                      "target",
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="testcases">
                <div className="bg-card border border-border rounded-xl p-5">
                  <TestCasesPanel
                    sourceDataset={getOrCreateDatasetState(
                      selectedSub,
                      "source",
                    )}
                    targetDataset={getOrCreateDatasetState(
                      selectedSub,
                      "target",
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Sub-Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sub-Project Name</Label>
              <Input
                placeholder="e.g. Customer Data Validation"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe this sub-project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
