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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          try {
            await fetchRoleAndApproval(session.user.id);
          } catch (e) {
            console.error("Erro onAuthStateChange:", e);
          }
        } else {
          setRole(null);
          setApprovalStatus(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          await fetchRoleAndApproval(session.user.id);
        } catch (e) {
          console.error("Erro getSession:", e);
        }
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    return () => {
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
