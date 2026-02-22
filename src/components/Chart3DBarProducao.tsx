import { useMemo } from "react";

const SABOR_COLORS: Record<string, { main: string; light: string; dark: string }> = {
  melancia:            { main: "#e53e3e", light: "#fc8181", dark: "#c53030" },
  morango:             { main: "#ed64a6", light: "#f687b3", dark: "#d53f8c" },
  "maçã verde":        { main: "#38a169", light: "#68d391", dark: "#276749" },
  "maça verde":        { main: "#38a169", light: "#68d391", dark: "#276749" },
  maracujá:            { main: "#ecc94b", light: "#f6e05e", dark: "#d69e2e" },
  "água de coco":      { main: "#81e6d9", light: "#b2f5ea", dark: "#319795" },
  "bob marley":        { main: "#48bb78", light: "#9ae6b4", dark: "#2f855a" },
  "abacaxi com hortelã": { main: "#68d391", light: "#9ae6b4", dark: "#38a169" },
  limão:               { main: "#c6f6d5", light: "#f0fff4", dark: "#68d391" },
  "limão com sal":     { main: "#b7e27f", light: "#d4edbc", dark: "#7ab33e" },
  pitaya:              { main: "#d53f8c", light: "#ed64a6", dark: "#97266d" },
  "blue ice":          { main: "#4299e1", light: "#63b3ed", dark: "#2b6cb0" },
};

function getColors(name: string) {
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(SABOR_COLORS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return { main: "#a0aec0", light: "#cbd5e0", dark: "#718096" };
}

interface Props {
  data: { nome: string; total: number }[];
}

export default function Chart3DBarProducao({ data }: Props) {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.total), 1), [data]);

  return (
    <div className="w-full py-4">
      <div
        className="relative flex items-end justify-center gap-4 md:gap-6"
        style={{
          perspective: "800px",
          minHeight: "280px",
          paddingBottom: "40px",
        }}
      >
        {data.map((item, i) => {
          const colors = getColors(item.nome);
          const heightPercent = (item.total / maxValue) * 100;
          const barHeight = Math.max(heightPercent * 2.2, 20);

          return (
            <div
              key={i}
              className="flex flex-col items-center gap-2 group"
              style={{ flex: "1 1 0", maxWidth: "120px" }}
            >
              {/* Value label */}
              <span
                className="text-xs font-bold transition-all duration-300 group-hover:scale-110"
                style={{ color: colors.dark }}
              >
                {item.total.toLocaleString("pt-BR")}
              </span>

              {/* 3D bar */}
              <div
                className="relative transition-all duration-500 ease-out group-hover:translate-y-[-4px]"
                style={{
                  width: "50px",
                  height: `${barHeight}px`,
                  transformStyle: "preserve-3d",
                  transform: "rotateX(-5deg) rotateY(-25deg)",
                }}
              >
                {/* Front face */}
                <div
                  className="absolute inset-0 rounded-t-md"
                  style={{
                    background: `linear-gradient(180deg, ${colors.light} 0%, ${colors.main} 100%)`,
                    transform: "translateZ(12px)",
                    boxShadow: `0 4px 20px ${colors.main}44`,
                  }}
                />
                {/* Right face */}
                <div
                  className="absolute top-0 right-0 rounded-tr-md"
                  style={{
                    width: "24px",
                    height: "100%",
                    background: `linear-gradient(180deg, ${colors.main} 0%, ${colors.dark} 100%)`,
                    transform: "rotateY(90deg) translateZ(26px) translateX(-12px)",
                    transformOrigin: "right",
                  }}
                />
                {/* Top face */}
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: "50px",
                    height: "24px",
                    background: `linear-gradient(135deg, ${colors.light} 0%, ${colors.main} 100%)`,
                    transform: "rotateX(90deg) translateZ(-12px) translateY(-12px)",
                    transformOrigin: "top",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
              </div>

              {/* Name label */}
              <span
                className="text-[10px] sm:text-xs font-semibold text-center leading-tight mt-1"
                style={{ color: colors.dark, maxWidth: "80px" }}
              >
                {item.nome}
              </span>
            </div>
          );
        })}
      </div>

      {/* Base / floor */}
      <div
        className="mx-auto rounded-lg"
        style={{
          width: "90%",
          height: "6px",
          background: "linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--border)) 50%, hsl(var(--muted)) 100%)",
          marginTop: "-36px",
          transform: "perspective(400px) rotateX(30deg)",
        }}
      />
    </div>
  );
}