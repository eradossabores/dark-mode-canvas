// Edge function: Check subscriptions and update statuses
// Runs daily via cron, also can be invoked manually by super_admin.
// Logic:
//   - trial: trial_start + 30 days → vencimento
//   - active: current_period_end → vencimento
//   - Tolerância: 1 dia após vencimento (status overdue)
//   - Após tolerância: status blocked
// IMPORTANT: NEVER deletes data. Only updates subscription.status.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const TOLERANCIA_DIAS = 1;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("id, factory_id, status, trial_start, current_period_end, grace_until");

    if (error) throw error;

    let atualizadas = 0;
    let bloqueadas = 0;
    let pendentes = 0;
    const detalhes: any[] = [];

    for (const sub of subs || []) {
      // Calcula vencimento de acordo com o estado
      let vencimento: Date | null = null;

      if (sub.status === "trial" && sub.trial_start) {
        vencimento = new Date(sub.trial_start);
        vencimento.setDate(vencimento.getDate() + 30);
      } else if (sub.current_period_end) {
        vencimento = new Date(sub.current_period_end + "T23:59:59");
      }

      if (!vencimento) continue;

      const venc = new Date(vencimento.getFullYear(), vencimento.getMonth(), vencimento.getDate());
      const limiteBloqueio = new Date(venc);
      limiteBloqueio.setDate(limiteBloqueio.getDate() + TOLERANCIA_DIAS);

      let novoStatus: string | null = null;
      const updates: Record<string, any> = {};

      if (today <= venc) {
        // Dentro do prazo → ATIVO (mantém trial se trial)
        if (sub.status === "blocked" || sub.status === "overdue") {
          novoStatus = sub.status === "trial" ? "trial" : "active";
        }
      } else if (today <= limiteBloqueio) {
        // PENDENTE / overdue
        if (sub.status !== "overdue" && sub.status !== "blocked") {
          novoStatus = "overdue";
          updates.grace_until = limiteBloqueio.toISOString().split("T")[0];
          pendentes++;
        }
      } else {
        // BLOQUEADO
        if (sub.status !== "blocked") {
          novoStatus = "blocked";
          updates.blocked_at = now.toISOString();
          bloqueadas++;
        }
      }

      if (novoStatus) {
        updates.status = novoStatus;
        const { error: upErr } = await supabase
          .from("subscriptions")
          .update(updates)
          .eq("id", sub.id);
        if (!upErr) {
          atualizadas++;
          detalhes.push({ factory_id: sub.factory_id, novo_status: novoStatus });
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_verificadas: subs?.length || 0,
        atualizadas,
        bloqueadas,
        pendentes,
        detalhes,
        executed_at: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});