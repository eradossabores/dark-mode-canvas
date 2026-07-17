import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { StickyNote, Check } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface Props {
  factoryId?: string | null;
}

export default function NotaRapidaCard({ factoryId }: Props) {
  const storageKey = `dashboard_nota_rapida::${factoryId || "default"}`;
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    try {
      setText(localStorage.getItem(storageKey) || "");
    } catch {}
  }, [storageKey]);

  function handleChange(v: string) {
    setText(v);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, v);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1200);
      } catch {}
    }, 400);
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: 0.32 }}
      className="relative self-start overflow-hidden rounded-2xl p-[2px]"
    >
      <GlowingEffect
        spread={58}
        glow
        disabled={false}
        proximity={88}
        inactiveZone={0.01}
        borderWidth={5}
        className="saturate-150"
      />

      <div className="relative min-h-[160px] h-full rounded-[inherit] border-2 border-yellow-200 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-900/40 p-5 flex flex-col">
        {/* Wave decoration top */}
        <svg className="absolute top-0 left-0 right-0 w-full" viewBox="0 0 300 20" preserveAspectRatio="none" style={{ height: "14px" }}>
          <path d="M0,10 Q30,0 60,10 T120,10 T180,10 T240,10 T300,10 L300,0 L0,0 Z" fill="currentColor" className="text-background/30" />
        </svg>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-yellow-700 dark:text-yellow-300" />
            <span className="text-xs font-extrabold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
              Bloco de Notas
            </span>
          </div>
          {saved && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> salvo
            </span>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Escreva um lembrete..."
          className="flex-1 w-full resize-none bg-transparent text-sm font-medium text-foreground placeholder:text-foreground/40 outline-none leading-snug"
        />
      </div>
    </motion.div>
  );
}