import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "producao" | null;
type ApprovalStatus = "pendente" | "aprovado" | "rejeitado" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  approvalStatus: ApprovalStatus;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  approvalStatus: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);
  const [loading, setLoading] = useState(true);

  async function fetchRoleAndApproval(userId: string) {
    try {
      // Check role
      const { data: roleData } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (roleData?.role) {
        setRole(roleData.role);
        setApprovalStatus("aprovado");
        return;
      }

      // No role — check access_requests
      const { data: requestData } = await (supabase as any)
        .from("access_requests")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();
      
      setRole(null);
      setApprovalStatus(requestData?.status || null);
    } catch (error) {
      console.error("Erro ao buscar role/aprovação:", error);
      setRole(null);
      setApprovalStatus(null);
    }
  }

  useEffect(() => {
    let isMounted = true;

    const applyAuthState = (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setApprovalStatus(null);
        setLoading(false);
        return;
      }

      // Busca role em microtask para não bloquear o callback do auth,
      // mas só libera loading DEPOIS de concluir.
      window.setTimeout(async () => {
        if (!isMounted) return;
        try {
          await fetchRoleAndApproval(nextSession.user.id);
        } catch (e) {
          console.error("Erro ao buscar role:", e);
        } finally {
          if (isMounted) setLoading(false);
        }
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "TOKEN_REFRESHED" && !nextSession) {
        // Token refresh failed — session expired
        console.warn("Sessão expirada, redirecionando...");
        setUser(null);
        setSession(null);
        setRole(null);
        setApprovalStatus(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setRole(null);
        setApprovalStatus(null);
        setLoading(false);
        return;
      }
      applyAuthState(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        applyAuthState(currentSession);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Erro ao fazer logout:", e);
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setApprovalStatus(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, approvalStatus, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
