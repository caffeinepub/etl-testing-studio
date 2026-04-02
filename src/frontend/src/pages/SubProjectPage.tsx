import { Badge } from "@/components/ui/badge";
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
import {
  ChevronLeft,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  PowerOff,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Project, SubProject } from "../backend";
import { DatasetType } from "../backend";
import { ComparisonPanel } from "../components/ComparisonPanel";
import { DatasetPanel } from "../components/DatasetPanel";
import { TestCasesPanel } from "../components/TestCasesPanel";
import { useRole } from "../context/RoleContext";
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
    csvHeadersMap: {},
    fullDataMap: {},
    metadataMap: {},
    fieldSelectionMap: {},
  };
}

export function SubProjectPage({ project, onBack }: Props) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { isAdmin, canEdit } = useRole();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SubProject | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

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

  const editMutation = useMutation({
    mutationFn: () =>
      actor!.updateSubProject(editTarget!.id, editName, editDescription),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subprojects", project.id.toString()],
      });
      // Update selectedSub if it's the one being edited
      if (selectedSub && editTarget && selectedSub.id === editTarget.id) {
        setSelectedSub((prev) =>
          prev
            ? { ...prev, name: editName, description: editDescription }
            : prev,
        );
      }
      setEditOpen(false);
      setEditTarget(null);
      toast.success("Sub-project updated");
    },
    onError: () => toast.error("Failed to update sub-project"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: bigint; isActive: boolean }) =>
      actor!.toggleSubProjectActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subprojects", project.id.toString()],
      });
      toast.success("Sub-project status updated");
    },
    onError: () => toast.error("Failed to update status"),
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

  const openEdit = (sub: SubProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(sub);
    setEditName(sub.name);
    setEditDescription(sub.description);
    setEditOpen(true);
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
            {canEdit && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="w-5 h-5"
                onClick={() => setOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
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
                <div
                  key={sub.id.toString()}
                  className={`rounded-md transition-colors ${
                    selectedSub?.id === sub.id
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSub(sub)}
                    className="w-full text-left px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span
                        className={`truncate flex-1 ${
                          selectedSub?.id === sub.id
                            ? "text-accent-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {sub.name}
                      </span>
                    </div>
                    <div className="mt-1 pl-5 flex items-center gap-1">
                      <Badge
                        variant={sub.isActive ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {sub.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </button>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 px-2 pb-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5"
                        title="Edit sub-project"
                        onClick={(e) => openEdit(sub, e)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-5 h-5"
                          title={sub.isActive ? "Deactivate" : "Activate"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleActiveMutation.mutate({
                              id: sub.id,
                              isActive: !sub.isActive,
                            });
                          }}
                        >
                          {sub.isActive ? (
                            <PowerOff className="w-3 h-3 text-destructive" />
                          ) : (
                            <Zap className="w-3 h-3 text-green-600" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
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
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(true)}
                className="gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New Sub-Project
              </Button>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedSub.name}
                  </h2>
                  <Badge
                    variant={selectedSub.isActive ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {selectedSub.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedSub.description}
                </p>
              </div>
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

      {/* Create Dialog */}
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sub-Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sub-Project Name</Label>
              <Input
                placeholder="Sub-project name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Description..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEditOpen(false);
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={!editName.trim() || editMutation.isPending}
            >
              {editMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
