import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "super_admin" | "admin" | "factory_owner" | "producao" | null;
type ApprovalStatus = "pendente" | "aprovado" | "rejeitado" | null;

interface SubscriptionInfo {
  status: string; // trial, active, overdue, blocked
  daysUntilDue: number | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
}

interface FactoryBranding {
  logoUrl: string | null;
  theme: {
    primary?: string;
    secondary?: string;
    accent?: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  approvalStatus: ApprovalStatus;
  loading: boolean;
  factoryId: string | null;
  factoryName: string | null;
  subscription: SubscriptionInfo | null;
  branding: FactoryBranding | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  approvalStatus: null,
  loading: true,
  factoryId: null,
  factoryName: null,
  subscription: null,
  branding: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);
  const [loading, setLoading] = useState(true);
  const [factoryId, setFactoryId] = useState<string | null>(null);
  const [factoryName, setFactoryName] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [branding, setBranding] = useState<FactoryBranding | null>(null);

  async function fetchRoleAndApproval(userId: string) {
    try {
      // Check role
      const { data: roleData } = await (supabase as any)
        .from("user_roles")
        .select("role, factory_id")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (roleData?.role) {
        setRole(roleData.role);
        setApprovalStatus("aprovado");
        setFactoryId(roleData.factory_id || null);

        // Fetch factory name if factory_id exists
        if (roleData.factory_id) {
          const { data: factoryData } = await (supabase as any)
            .from("factories")
            .select("name, logo_url, theme")
            .eq("id", roleData.factory_id)
            .maybeSingle();
          setFactoryName(factoryData?.name || null);
          setBranding({
            logoUrl: factoryData?.logo_url || null,
            theme: factoryData?.theme && Object.keys(factoryData.theme).length > 0 ? factoryData.theme : null,
          });

          // Fetch subscription info
          await fetchSubscription(roleData.factory_id);
        }
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

  async function fetchSubscription(fId: string) {
    try {
      const { data } = await (supabase as any)
        .from("subscriptions")
        .select("*")
        .eq("factory_id", fId)
        .maybeSingle();

      if (!data) {
        setSubscription(null);
        return;
      }

      const now = new Date();
      let daysUntilDue: number | null = null;

      if (data.status === "trial" && data.trial_start) {
        const trialEnd = new Date(data.trial_start);
        trialEnd.setDate(trialEnd.getDate() + 30);
        daysUntilDue = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else if (data.current_period_end) {
        const periodEnd = new Date(data.current_period_end);
        daysUntilDue = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      setSubscription({
        status: data.status,
        daysUntilDue,
        trialEnd: data.trial_start ? new Date(new Date(data.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
        currentPeriodEnd: data.current_period_end,
        graceUntil: data.grace_until,
      });
    } catch (error) {
      console.error("Erro ao buscar assinatura:", error);
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
        setFactoryId(null);
        setFactoryName(null);
        setSubscription(null);
        setBranding(null);
        setLoading(false);
        return;
      }

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

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "TOKEN_REFRESHED" && !nextSession) {
        console.warn("Sessão expirada, redirecionando...");
        setUser(null);
        setSession(null);
        setRole(null);
        setApprovalStatus(null);
        setFactoryId(null);
        setFactoryName(null);
        setSubscription(null);
        setBranding(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setRole(null);
        setApprovalStatus(null);
        setFactoryId(null);
        setFactoryName(null);
        setSubscription(null);
        setBranding(null);
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
      authSub.unsubscribe();
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
      setFactoryId(null);
      setFactoryName(null);
      setSubscription(null);
      setBranding(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, approvalStatus, loading, factoryId, factoryName, subscription, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
