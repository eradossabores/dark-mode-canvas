import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL = 60_000; // 1 minute

/**
 * Tracks user session time by creating a session record on mount
 * and updating duration_minutes periodically via heartbeat.
 */
export function useSessionTracker(userId: string | null, factoryId: string | null) {
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!userId || !factoryId) return;

    let interval: ReturnType<typeof setInterval>;

    async function startSession() {
      try {
        const { data, error } = await (supabase as any)
          .from("user_sessions")
          .insert({
            user_id: userId,
            factory_id: factoryId,
            started_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            duration_minutes: 0,
          })
          .select("id")
          .single();

        if (!error && data) {
          sessionIdRef.current = data.id;
          startTimeRef.current = new Date();
        }
      } catch (e) {
        console.error("Session tracker start error:", e);
      }
    }

    async function heartbeat() {
      if (!sessionIdRef.current || !startTimeRef.current) return;
      const now = new Date();
      const minutes = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 60_000);
      try {
        await (supabase as any)
          .from("user_sessions")
          .update({
            last_seen_at: now.toISOString(),
            duration_minutes: minutes,
          })
          .eq("id", sessionIdRef.current);
      } catch (e) {
        // Silent fail on heartbeat
      }
    }

    startSession();
    interval = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    // Final update on unmount / tab close
    const handleUnload = () => {
      if (!sessionIdRef.current || !startTimeRef.current) return;
      const minutes = Math.floor((Date.now() - startTimeRef.current.getTime()) / 60_000);
      
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`;
      const body = JSON.stringify({ last_seen_at: new Date().toISOString(), duration_minutes: minutes });
      
      // Use fetch with keepalive for reliability on page close
      fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal",
        },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      // Final heartbeat on cleanup
      heartbeat();
    };
  }, [userId, factoryId]);
}
