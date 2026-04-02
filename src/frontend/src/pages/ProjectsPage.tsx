import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Edit2,
  FolderOpen,
  Loader2,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Project } from "../backend";
import { useRole } from "../context/RoleContext";
import { useActor } from "../hooks/useActor";

interface Props {
  onSelectProject: (project: Project) => void;
}

export function ProjectsPage({ onSelectProject }: Props) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { isAdmin } = useRole();

  // New Project dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Edit Project dialog
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => actor!.getProjects(),
    enabled: !!actor,
  });

  const createMutation = useMutation({
    mutationFn: () => actor!.createProject(newName, newDescription),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setNewOpen(false);
      setNewName("");
      setNewDescription("");
      toast.success("Project created");
    },
    onError: (err: Error) =>
      toast.error(err?.message ?? "Failed to create project"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: bigint) => actor!.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTarget(null);
      toast.success("Project deleted");
    },
    onError: (err: Error) => {
      setDeleteTarget(null);
      const msg = err?.message ?? "";
      if (
        msg.toLowerCase().includes("sub-project") ||
        msg.toLowerCase().includes("subproject")
      ) {
        toast.error(
          "Cannot delete a project that has sub-projects. Remove all sub-projects first.",
        );
      } else {
        toast.error("Failed to delete project");
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: bigint; isActive: boolean }) =>
      actor!.toggleProjectActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project status updated");
    },
    onError: () => toast.error("Failed to update project status"),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      actor!.updateProject(editProject!.id, editName, editDescription),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditProject(null);
      toast.success("Project updated");
    },
    onError: () => toast.error("Failed to update project"),
  });

  function openEdit(e: React.MouseEvent, project: Project) {
    e.stopPropagation();
    setEditProject(project);
    setEditName(project.name);
    setEditDescription(project.description);
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your ETL test projects
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setNewOpen(true)}
              size="sm"
              className="gap-1.5"
              data-ocid="projects.new_project_button"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          )}
        </div>

        {isLoading ? (
          <div
            className="flex items-center justify-center h-40"
            data-ocid="projects.loading_state"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-60 border border-dashed border-border rounded-xl gap-3"
            data-ocid="projects.empty_state"
          >
            <FolderOpen className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No projects yet. Create your first one.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-ocid="projects.list"
          >
            {projects.map((project, idx) => (
              <Card
                key={project.id.toString()}
                className="cursor-pointer hover:border-info/50 transition-colors group"
                onClick={() => onSelectProject(project)}
                data-ocid={`projects.item.${idx + 1}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium text-foreground group-hover:text-info transition-colors flex-1 min-w-0">
                      {project.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-muted-foreground hover:text-primary"
                            title="Edit project"
                            onClick={(e) => openEdit(e, project)}
                            data-ocid={`projects.edit_button.${idx + 1}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`w-6 h-6 ${
                              project.isActive
                                ? "text-green-500 hover:text-yellow-500"
                                : "text-muted-foreground hover:text-green-500"
                            }`}
                            title={project.isActive ? "Deactivate" : "Activate"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMutation.mutate({
                                id: project.id,
                                isActive: !project.isActive,
                              });
                            }}
                            data-ocid={`projects.toggle.${idx + 1}`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-muted-foreground hover:text-destructive"
                            title="Delete project"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(project);
                            }}
                            data-ocid={`projects.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-info transition-colors" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {project.description || "No description"}
                  </p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {project.subProjects.length} sub-project
                      {project.subProjects.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge
                      variant={project.isActive ? "default" : "outline"}
                      className={`text-xs ${
                        project.isActive
                          ? "bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20"
                          : "text-muted-foreground"
                      }`}
                    >
                      {project.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-ocid="projects.new_project_dialog"
        >
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input
                placeholder="e.g. Sales Data Validation"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-ocid="projects.project_name_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe this project..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                data-ocid="projects.project_description_textarea"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setNewOpen(false)}
              data-ocid="projects.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              data-ocid="projects.submit_button"
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog
        open={!!editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
      >
        <DialogContent
          className="sm:max-w-md"
          data-ocid="projects.edit_project_dialog"
        >
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input
                placeholder="e.g. Sales Data Validation"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-ocid="projects.edit_name_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe this project..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                data-ocid="projects.edit_description_textarea"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditProject(null)}
              data-ocid="projects.edit_cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editName.trim() || updateMutation.isPending}
              data-ocid="projects.edit_save_button"
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="projects.delete_dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="projects.delete_cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
              data-ocid="projects.delete_confirm_button"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
