import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const shortcuts: Record<string, string> = {
  "d": "/painel",
  "p": "/painel/producao",
  "v": "/painel/vendas",
  "e": "/painel/estoque",
  "c": "/painel/clientes",
  "r": "/painel/relatorios",
  "m": "/painel/monitor-producao",
  "f": "/painel/funcionarios",
  "s": "/painel/sabores",
};

export default function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Only trigger with Alt key, ignore if user is typing in an input
      if (!e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();
      if (shortcuts[key]) {
        e.preventDefault();
        navigate(shortcuts[key]);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}
