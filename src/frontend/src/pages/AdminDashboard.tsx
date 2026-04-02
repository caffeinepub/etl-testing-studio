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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Copy, Info, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRole } from "../context/RoleContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { ETLRole, UserRecord } from "../types/rbac";

interface Props {
  onBack: () => void;
}

const ROLE_LABELS: Record<ETLRole, string> = {
  masterAdmin: "Master Admin",
  admin: "Admin",
  etlTester: "ETL Tester",
  apiTester: "API Tester",
  viewEtlTester: "View ETL",
  viewApiTester: "View API",
};

const ROLE_BADGE_CLASS: Record<ETLRole, string> = {
  masterAdmin: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  admin: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  etlTester: "bg-green-500/15 text-green-400 border-green-500/20",
  apiTester: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  viewEtlTester: "bg-muted text-muted-foreground border-border",
  viewApiTester: "bg-muted text-muted-foreground border-border",
};

const NON_ADMIN_ROLES: ETLRole[] = [
  "etlTester",
  "apiTester",
  "viewEtlTester",
  "viewApiTester",
];
const ALL_ROLES: ETLRole[] = [
  "masterAdmin",
  "admin",
  "etlTester",
  "apiTester",
  "viewEtlTester",
  "viewApiTester",
];

function RoleBadge({ role }: { role: ETLRole }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
        ROLE_BADGE_CLASS[role]
      }`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function truncatePrincipal(p: string) {
  if (p.length <= 16) return p;
  return `${p.slice(0, 8)}...${p.slice(-6)}`;
}

// Local user store (in-memory, until backend RBAC is fully deployed)
const LOCAL_USERS_KEY = "etl_rbac_users";

function loadLocalUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw, (k, v) =>
      k === "registeredAt" ? BigInt(v) : v,
    ) as UserRecord[];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: UserRecord[]) {
  localStorage.setItem(
    LOCAL_USERS_KEY,
    JSON.stringify(users, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

export function AdminDashboard({ onBack }: Props) {
  const { userRecord, isMasterAdmin } = useRole();
  const { identity } = useInternetIdentity();
  const myPrincipal = identity?.getPrincipal().toString() ?? "";

  const [users, setUsers] = useState<UserRecord[]>(() => {
    const stored = loadLocalUsers();
    // Ensure current user is in the list
    if (
      userRecord &&
      !stored.find((u) => u.principalText === userRecord.principalText)
    ) {
      const all = [userRecord, ...stored];
      saveLocalUsers(all);
      return all;
    }
    return stored.length > 0 ? stored : userRecord ? [userRecord] : [];
  });

  const [registerOpen, setRegisterOpen] = useState(false);
  const [newPrincipal, setNewPrincipal] = useState("");
  const [newRole, setNewRole] = useState<ETLRole>("etlTester");
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allowedRoles = isMasterAdmin ? ALL_ROLES : NON_ADMIN_ROLES;

  const updateUsers = (updated: UserRecord[]) => {
    setUsers(updated);
    saveLocalUsers(updated);
  };

  const handleRegister = () => {
    const pid = newPrincipal.trim();
    if (!pid) return;
    if (users.find((u) => u.principalText === pid)) {
      toast.error("User already registered");
      return;
    }
    const newUser: UserRecord = {
      principalText: pid,
      role: newRole,
      isActive: true,
      registeredAt: BigInt(Date.now()),
    };
    updateUsers([...users, newUser]);
    setRegisterOpen(false);
    setNewPrincipal("");
    setNewRole("etlTester");
    toast.success("User registered successfully");
  };

  const handleChangeRole = (pid: string, role: ETLRole) => {
    updateUsers(
      users.map((u) => (u.principalText === pid ? { ...u, role } : u)),
    );
    toast.success("Role updated");
  };

  const handleToggleActive = (pid: string) => {
    updateUsers(
      users.map((u) =>
        u.principalText === pid ? { ...u, isActive: !u.isActive } : u,
      ),
    );
    toast.success("Status updated");
  };

  const handleDelete = (pid: string) => {
    updateUsers(users.filter((u) => u.principalText !== pid));
    setDeleteTarget(null);
    toast.success("User removed");
  };

  const handleCopy = async (pid: string) => {
    await navigator.clipboard.writeText(pid);
    setCopiedId(pid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            data-ocid="admin.back_button"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-info" />
              <h1 className="text-xl font-semibold text-foreground">
                User Management
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage user access and roles
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setRegisterOpen(true)}
            data-ocid="admin.register_user_button"
          >
            <UserPlus className="w-4 h-4" />
            Register User
          </Button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 mb-4 bg-info/5 border border-info/20 rounded-lg text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
          <span>
            User registrations are stored locally until the full RBAC backend is
            deployed. Registered users will need to receive their Principal ID
            allowance from an admin.
          </span>
        </div>

        {/* Table */}
        <div
          className="rounded-xl border border-border overflow-hidden"
          data-ocid="admin.table"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">
                  Principal
                </TableHead>
                <TableHead className="text-muted-foreground font-medium">
                  Role
                </TableHead>
                <TableHead className="text-muted-foreground font-medium">
                  Status
                </TableHead>
                <TableHead className="text-muted-foreground font-medium">
                  Registered
                </TableHead>
                <TableHead className="text-muted-foreground font-medium w-16">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u, idx) => {
                const pid = u.principalText;
                const isMe = pid === myPrincipal;
                const regDate = new Date(
                  Number(u.registeredAt),
                ).toLocaleDateString();
                return (
                  <TableRow
                    key={pid}
                    className="border-border"
                    data-ocid={`admin.user.item.${idx + 1}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground">
                          {truncatePrincipal(pid)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-5 h-5 text-muted-foreground/50 hover:text-muted-foreground"
                          onClick={() => handleCopy(pid)}
                          data-ocid={`admin.copy_button.${idx + 1}`}
                        >
                          <Copy
                            className={`w-3 h-3 ${
                              copiedId === pid ? "text-success" : ""
                            }`}
                          />
                        </Button>
                        {isMe && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                          >
                            You
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isMe ? (
                        <RoleBadge role={u.role} />
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(val) =>
                            handleChangeRole(pid, val as ETLRole)
                          }
                        >
                          <SelectTrigger
                            className="h-7 text-xs w-36 border-border"
                            data-ocid={`admin.role_select.${idx + 1}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedRoles.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`text-xs h-6 px-2 ${
                          u.isActive
                            ? "text-success hover:text-success/80"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => handleToggleActive(pid)}
                        disabled={isMe}
                        data-ocid={`admin.status_toggle.${idx + 1}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {regDate}
                    </TableCell>
                    <TableCell>
                      {!isMe && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(u)}
                          data-ocid={`admin.delete_button.${idx + 1}`}
                        >
                          <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Register User Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-ocid="admin.register_dialog"
        >
          <DialogHeader>
            <DialogTitle>Register New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Principal ID</Label>
              <Input
                placeholder="xxxxx-xxxxx-..."
                value={newPrincipal}
                onChange={(e) => setNewPrincipal(e.target.value)}
                className="font-mono text-sm"
                data-ocid="admin.principal_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as ETLRole)}
              >
                <SelectTrigger data-ocid="admin.role_select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRegisterOpen(false)}
              data-ocid="admin.register_cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegister}
              disabled={!newPrincipal.trim()}
              data-ocid="admin.register_submit_button"
            >
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-sm" data-ocid="admin.delete_dialog">
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove this user? They will lose access
            immediately.
          </p>
          {deleteTarget && (
            <code className="text-xs font-mono bg-muted/50 rounded p-2 block break-all">
              {deleteTarget.principalText}
            </code>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              data-ocid="admin.delete_cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteTarget && handleDelete(deleteTarget.principalText)
              }
              data-ocid="admin.delete_confirm_button"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
