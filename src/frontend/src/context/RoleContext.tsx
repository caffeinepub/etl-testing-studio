import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { ETLRole, UserRecord } from "../types/rbac";

interface RoleContextValue {
  userRecord: UserRecord | null;
  isLoading: boolean;
  isMasterAdmin: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  isReadOnly: boolean;
  refetchRole: () => void;
}

export const RoleContext = createContext<RoleContextValue>({
  userRecord: null,
  isLoading: true,
  isMasterAdmin: false,
  isAdmin: false,
  canEdit: false,
  isReadOnly: false,
  refetchRole: () => {},
});

// Map the existing UserRole (admin/user/guest) to ETLRole
function mapBackendRole(backendRole: string): ETLRole {
  if (backendRole === "admin") return "masterAdmin";
  if (backendRole === "user") return "etlTester";
  return "viewEtlTester";
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { identity } = useInternetIdentity();
  const { actor, isFetching } = useActor();
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = useCallback(() => {
    if (!actor || isFetching) return;
    setIsLoading(true);
    actor
      .getCallerUserRole()
      .then((role) => {
        const principal = identity?.getPrincipal().toString() ?? "";
        setUserRecord({
          principalText: principal,
          role: mapBackendRole(role),
          isActive: true,
          registeredAt: BigInt(Date.now()),
        });
      })
      .catch(() => {
        setUserRecord(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [actor, isFetching, identity]);

  useEffect(() => {
    if (!identity) {
      setIsLoading(false);
      return;
    }
    fetchRole();
  }, [identity, fetchRole]);

  const role = userRecord?.role;
  const isMasterAdmin = role === "masterAdmin";
  const isAdmin = role === "masterAdmin" || role === "admin";
  const canEdit =
    role === "masterAdmin" ||
    role === "admin" ||
    role === "etlTester" ||
    role === "apiTester";
  const isReadOnly = role === "viewEtlTester" || role === "viewApiTester";

  return (
    <RoleContext.Provider
      value={{
        userRecord,
        isLoading,
        isMasterAdmin,
        isAdmin,
        canEdit,
        isReadOnly,
        refetchRole: fetchRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
