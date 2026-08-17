import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Normaliza nomes para comparação (sem acentos, minúsculo, sem espaços extras). */
function norm(v: string): string {
  return (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/** Deriva o setor do colaborador a partir dos perfis do usuário. */
function setorFromRoles(roles: string[]): "producao" | "vendas" | "entregas" | null {
  if (roles.includes("producao")) return "producao";
  if (roles.includes("vendedor")) return "vendas";
  if (roles.includes("auxiliar_externo")) return "entregas";
  return null;
}

/**
 * Garante que o usuário logado tenha um cadastro de Colaborador na sua fábrica,
 * criando-o automaticamente no setor correto quando ainda não existir.
 * Silencioso em caso de erro (RLS/permissão) — nunca bloqueia o login.
 */
export function useAutoColaborador(
  userId: string | null,
  factoryId: string | null,
  roles: string[],
) {
  useEffect(() => {
    if (!userId || !factoryId) return;
    const setor = setorFromRoles(roles);
    if (!setor) return;

    let cancelled = false;

    (async () => {
      try {
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("nome, email")
          .eq("id", userId)
          .maybeSingle();

        const displayName =
          (profile?.nome || (profile?.email || "").split("@")[0] || "").trim();
        if (!displayName || cancelled) return;

        const { data: existentes } = await (supabase as any)
          .from("funcionarios")
          .select("id, nome, setor, ativo")
          .eq("factory_id", factoryId);

        const alvo = norm(displayName);
        const emailLocal = norm((profile?.email || "").split("@")[0]);
        const found = (existentes ?? []).find((f: any) => {
          const fn = norm(f.nome);
          if (!fn) return false;
          return fn === alvo || (!!emailLocal && (fn === emailLocal || fn.split(" ")[0] === emailLocal));
        });

        if (cancelled) return;

        if (!found) {
          await (supabase as any).from("funcionarios").insert({
            nome: displayName,
            setor,
            tipo_pagamento: "diaria",
            valor_pagamento: 0,
            ativo: true,
            factory_id: factoryId,
          });
          return;
        }

        // Reativa quem já existe mas está inativo (mantém setor cadastrado manualmente).
        if (found.ativo === false) {
          await (supabase as any)
            .from("funcionarios")
            .update({ ativo: true })
            .eq("id", found.id);
        }
      } catch {
        // silencioso
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, factoryId, roles.join(",")]);
}
