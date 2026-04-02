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
import type { Dataset, Project, SubProject } from "../backend";
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
  const [activeTab, setActiveTab] = useState<string>("comparison");

  // Add Dataset dialog state
  const [addDatasetOpen, setAddDatasetOpen] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [newDatasetType, setNewDatasetType] = useState<"source" | "target">(
    "source",
  );

  const { data: subProjects = [], isLoading } = useQuery({
    queryKey: ["subprojects", project.id.toString()],
    queryFn: () => actor!.getSubProjects(project.id),
    enabled: !!actor,
  });

  // Fetch datasets for the selected sub-project
  const { data: datasets = [], isLoading: datasetsLoading } = useQuery({
    queryKey: ["datasets", selectedSub?.id.toString()],
    queryFn: async (): Promise<Dataset[]> => {
      if (!selectedSub || !actor) return [];
      try {
        const result = await (actor as any).getDatasetsForSubProject(
          selectedSub.id,
        );
        if (Array.isArray(result) && result.length > 0) return result;
      } catch {
        // fall through to default
      }
      // Fallback: build Dataset objects from the two hardcoded IDs
      const fallback: Dataset[] = [
        {
          id: selectedSub.sourceDataset,
          subProjectId: selectedSub.id,
          name: "Source Dataset",
          datasetType: DatasetType.source,
          createdAt: selectedSub.createdAt,
          updatedAt: selectedSub.updatedAt,
        },
        {
          id: selectedSub.targetDataset,
          subProjectId: selectedSub.id,
          name: "Target Dataset",
          datasetType: DatasetType.target,
          createdAt: selectedSub.createdAt,
          updatedAt: selectedSub.updatedAt,
        },
      ];
      return fallback;
    },
    enabled: !!actor && !!selectedSub,
  });

  // Sorted: SOURCE first, TARGET second
  const sortedDatasets = [
    ...datasets.filter((d) => d.datasetType === DatasetType.source),
    ...datasets.filter((d) => d.datasetType === DatasetType.target),
  ];

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

  const addDatasetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSub || !actor) throw new Error("No sub-project selected");
      const dsType =
        newDatasetType === "source" ? { source: null } : { target: null };
      const newId = await (actor as any).createDataset(
        selectedSub.id,
        newDatasetName,
        dsType,
      );
      return newId as bigint;
    },
    onSuccess: (newId: bigint) => {
      queryClient.invalidateQueries({
        queryKey: ["datasets", selectedSub?.id.toString()],
      });
      setAddDatasetOpen(false);
      setNewDatasetName("");
      setNewDatasetType("source");
      // Pre-initialise dataset state
      const dsType =
        newDatasetType === "source" ? DatasetType.source : DatasetType.target;
      setDatasetMap((prev) => ({
        ...prev,
        [newId.toString()]: makeEmptyDataset(newId, dsType),
      }));
      setActiveTab(`dataset-${newId.toString()}`);
      toast.success("Dataset created");
    },
    onError: () => toast.error("Failed to create dataset"),
  });

  const getDatasetState = (dataset: Dataset): DatasetState => {
    const key = dataset.id.toString();
    return (
      datasetMap[key] ??
      makeEmptyDataset(
        dataset.id,
        dataset.datasetType === DatasetType.source
          ? DatasetType.source
          : DatasetType.target,
      )
    );
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
    // Default to first dataset tab
    setActiveTab(`dataset-${sub.sourceDataset.toString()}`);
  };

  const openEdit = (sub: SubProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(sub);
    setEditName(sub.name);
    setEditDescription(sub.description);
    setEditOpen(true);
  };

  // Determine which source/target datasets to use for comparison/test cases
  const defaultSourceDataset =
    selectedSub &&
    (datasetMap[selectedSub.sourceDataset.toString()] ??
      makeEmptyDataset(selectedSub.sourceDataset, DatasetType.source));
  const defaultTargetDataset =
    selectedSub &&
    (datasetMap[selectedSub.targetDataset.toString()] ??
      makeEmptyDataset(selectedSub.targetDataset, DatasetType.target));

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

            {datasetsLoading ? (
              <div
                className="flex items-center justify-center py-16"
                data-ocid="datasets.loading_state"
              >
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center gap-2 mb-5">
                  <TabsList className="flex-wrap h-auto gap-1">
                    {sortedDatasets.map((ds) => (
                      <TabsTrigger
                        key={ds.id.toString()}
                        value={`dataset-${ds.id.toString()}`}
                        data-ocid="dataset.tab"
                        className="gap-1.5"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full inline-block ${
                            ds.datasetType === DatasetType.source
                              ? "bg-blue-500"
                              : "bg-amber-500"
                          }`}
                        />
                        {ds.name}
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="comparison" data-ocid="comparison.tab">
                      Comparison
                    </TabsTrigger>
                    <TabsTrigger value="testcases" data-ocid="testcases.tab">
                      Test Cases
                    </TabsTrigger>
                  </TabsList>

                  {canEdit && (
                    <Button
                      size="icon"
                      variant="outline"
                      className="w-7 h-7 shrink-0"
                      title="Add Dataset"
                      onClick={() => setAddDatasetOpen(true)}
                      data-ocid="dataset.open_modal_button"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                {sortedDatasets.map((ds) => (
                  <TabsContent
                    key={ds.id.toString()}
                    value={`dataset-${ds.id.toString()}`}
                  >
                    <div className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            ds.datasetType === DatasetType.source
                              ? "border-blue-400 text-blue-600"
                              : "border-amber-400 text-amber-600"
                          }`}
                        >
                          {ds.datasetType === DatasetType.source
                            ? "SOURCE"
                            : "TARGET"}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">
                          {ds.name}
                        </span>
                      </div>
                      <DatasetPanel
                        datasetState={getDatasetState(ds)}
                        onUpdateDataset={handleUpdateDataset}
                      />
                    </div>
                  </TabsContent>
                ))}

                <TabsContent value="comparison">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <ComparisonPanel
                      sourceDataset={
                        defaultSourceDataset ||
                        makeEmptyDataset(0n, DatasetType.source)
                      }
                      targetDataset={
                        defaultTargetDataset ||
                        makeEmptyDataset(1n, DatasetType.target)
                      }
                    />
                  </div>
                </TabsContent>

                <TabsContent value="testcases">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <TestCasesPanel
                      sourceDataset={
                        defaultSourceDataset ||
                        makeEmptyDataset(0n, DatasetType.source)
                      }
                      targetDataset={
                        defaultTargetDataset ||
                        makeEmptyDataset(1n, DatasetType.target)
                      }
                    />
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </div>

      {/* Create Sub-Project Dialog */}
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
                data-ocid="subproject.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe this sub-project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                data-ocid="subproject.textarea"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              data-ocid="subproject.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
              data-ocid="subproject.submit_button"
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sub-Project Dialog */}
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
                data-ocid="edit_subproject.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Description..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                data-ocid="edit_subproject.textarea"
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
              data-ocid="edit_subproject.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={!editName.trim() || editMutation.isPending}
              data-ocid="edit_subproject.submit_button"
            >
              {editMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dataset Dialog */}
      <Dialog open={addDatasetOpen} onOpenChange={setAddDatasetOpen}>
        <DialogContent className="sm:max-w-md" data-ocid="dataset.dialog">
          <DialogHeader>
            <DialogTitle>Add Dataset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Dataset Name</Label>
              <Input
                placeholder="e.g. Orders Source"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                data-ocid="dataset.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dataset Type</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="datasetType"
                    value="source"
                    checked={newDatasetType === "source"}
                    onChange={() => setNewDatasetType("source")}
                    data-ocid="dataset.radio"
                    className="accent-primary"
                  />
                  <span className="text-sm">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1" />
                    Source
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="datasetType"
                    value="target"
                    checked={newDatasetType === "target"}
                    onChange={() => setNewDatasetType("target")}
                    data-ocid="dataset.radio"
                    className="accent-primary"
                  />
                  <span className="text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1" />
                    Target
                  </span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAddDatasetOpen(false);
                setNewDatasetName("");
                setNewDatasetType("source");
              }}
              data-ocid="dataset.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addDatasetMutation.mutate()}
              disabled={!newDatasetName.trim() || addDatasetMutation.isPending}
              data-ocid="dataset.submit_button"
            >
              {addDatasetMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Add Dataset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
