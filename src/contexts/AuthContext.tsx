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
      setLoading(false);

      if (!nextSession?.user) {
        setRole(null);
        setApprovalStatus(null);
        return;
      }

      // Evita deadlock do cliente de auth: não faça awaits de chamadas do backend
      // diretamente dentro do callback de onAuthStateChange.
      window.setTimeout(() => {
        if (!isMounted) return;
        fetchRoleAndApproval(nextSession.user.id);
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
