import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const motivationalMessages = [
  { emoji: "\u{1F525}", text: "Hoje \u00e9 dia de fazer acontecer! Cada gelo produzido \u00e9 um cliente feliz." },
  { emoji: "\u{1F4AA}", text: "Sua dedica\u00e7\u00e3o faz a diferen\u00e7a! Vamos bater mais um recorde?" },
  { emoji: "\u{1F680}", text: "O sucesso \u00e9 constru\u00eddo um dia de cada vez. E hoje \u00e9 mais um grande dia!" },
  { emoji: "\u2B50", text: "Voc\u00ea \u00e9 pe\u00e7a fundamental nessa equipe! Continue brilhando!" },
  { emoji: "\u{1F3AF}", text: "Foco, for\u00e7a e gelo! Vamos conquistar mais um dia incr\u00edvel!" },
  { emoji: "\u2744\uFE0F", text: "Cada sabor que produzimos leva alegria pra algu\u00e9m. Que orgulho!" },
  { emoji: "\u{1F3C6}", text: "Campe\u00f5es se fazem no dia a dia. E voc\u00ea \u00e9 um deles!" },
  { emoji: "\u2728", text: "A excel\u00eancia mora nos detalhes. Continue caprichando!" },
  { emoji: "\u{1F31F}", text: "Sua energia transforma o ambiente! Obrigado por estar aqui!" },
  { emoji: "\u{1F48E}", text: "Trabalho duro + paix\u00e3o = resultados extraordin\u00e1rios!" },
  { emoji: "\u{1F389}", text: "Mais um dia pra mostrar do que somos capazes. Bora!" },
  { emoji: "\u{1F9CA}", text: "Refrescando o mundo, um gelo de cada vez. Orgulho da equipe!" },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getDailyMessage(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  let hash = 0;
  const seed = today + userId;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return motivationalMessages[Math.abs(hash) % motivationalMessages.length];
}

/** Banner animado de boas-vindas exibido no painel inicial. */
export function WelcomeBanner() {
  const { user } = useAuth();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!user) return;
      try {
        const { data } = await (supabase as any)
          .from("profiles")
          .select("nome")
          .eq("id", user.id)
          .maybeSingle();
        if (ativo) setUserName(data?.nome || user.email?.split("@")[0] || "Colaborador");
      } catch {
        if (ativo) setUserName(user.email?.split("@")[0] || "Colaborador");
      }
    })();
    return () => { ativo = false; };
  }, [user?.id]);

  const dailyMessage = useMemo(() => getDailyMessage(user?.id || "default"), [user?.id]);

  return (
      <div className="mb-4 sm:mb-6 relative overflow-hidden rounded-xl sm:rounded-2xl border border-primary/20 bg-gradient-to-b from-background via-background to-primary/5">
        {/* Lamp glow effect - centered top (teal/cyan theme) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Main conic rays - left */}
          <motion.div
            initial={{ opacity: 0, width: "6rem" }}
            animate={{ opacity: 0.45, width: "22rem" }}
            transition={{ delay: 0.1, duration: 1.2, ease: "easeOut" }}
            style={{ backgroundImage: `conic-gradient(from 70deg at center top, hsl(174, 50%, 45%), transparent, transparent)` }}
            className="absolute -top-4 right-1/2 h-28"
          >
            <div className="absolute w-full left-0 bg-background/80 h-16 bottom-0 [mask-image:linear-gradient(to_top,white,transparent)]" />
            <div className="absolute w-16 h-full left-0 bg-background/80 bottom-0 [mask-image:linear-gradient(to_right,white,transparent)]" />
          </motion.div>
          {/* Main conic rays - right */}
          <motion.div
            initial={{ opacity: 0, width: "6rem" }}
            animate={{ opacity: 0.45, width: "22rem" }}
            transition={{ delay: 0.1, duration: 1.2, ease: "easeOut" }}
            style={{ backgroundImage: `conic-gradient(from 290deg at center top, transparent, transparent, hsl(174, 50%, 45%))` }}
            className="absolute -top-4 left-1/2 h-28"
          >
            <div className="absolute w-16 h-full right-0 bg-background/80 bottom-0 [mask-image:linear-gradient(to_left,white,transparent)]" />
            <div className="absolute w-full right-0 bg-background/80 h-16 bottom-0 [mask-image:linear-gradient(to_top,white,transparent)]" />
          </motion.div>
          {/* Soft glow blob */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.25, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 rounded-full blur-3xl"
            style={{ background: "hsl(174, 45%, 45%)" }}
          />
          {/* Thin light bar */}
          <motion.div
            initial={{ width: "4rem", opacity: 0 }}
            animate={{ width: "14rem", opacity: 0.6 }}
            transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px]"
            style={{ background: "linear-gradient(to right, transparent, hsl(174, 50%, 50%), transparent)" }}
          />
          {/* Bottom fade to blend */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-20 px-4 py-3 sm:px-6 sm:py-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
            className="space-y-1 sm:space-y-1.5"
          >
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="text-xl sm:text-2xl">{dailyMessage.emoji}</span>
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                {getGreeting()}, <span className="text-primary">{userName || "Colaborador"}</span>!
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed pl-8 sm:pl-[2.75rem]">
              {dailyMessage.text}
            </p>
            <div className="pl-8 sm:pl-[2.75rem]">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground/50 tracking-wide uppercase">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
  );
}

export default WelcomeBanner;
