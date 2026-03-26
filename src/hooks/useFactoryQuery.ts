import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook that returns a function to create factory-filtered Supabase queries.
 * Usage:
 *   const { factoryQuery } = useFactoryQuery();
 *   const { data } = await factoryQuery("clientes").select("*").order("nome");
 */
export function useFactoryQuery() {
  const { factoryId } = useAuth();

  function factoryQuery(table: string) {
    let query = (supabase as any).from(table);
    // We return a proxy-like object that auto-appends factory_id filter
    return {
      ...query,
      select: (...args: any[]) => {
        let q = query.select(...args);
        if (factoryId) q = q.eq("factory_id", factoryId);
        return q;
      },
    };
  }

  return { factoryId, factoryQuery };
}
