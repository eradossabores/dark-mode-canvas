import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ReciboVenda from "@/components/vendas/ReciboVenda";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ factoryName: "D'PRAIA ICE", branding: {} }) }));
vi.mock("@/hooks/use-pdf-logo", () => ({ usePdfLogo: () => "" }));

describe("envio do recibo sem logo disponível", () => {
  it("permite compartilhar o PDF mesmo quando a imagem da fábrica falha", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    render(<ReciboVenda open onOpenChange={() => {}} data={{
      cliente_nome: "PORÃO", data: "06/11/2026", forma_pagamento: "Dinheiro",
      total: 1170, status: "pendente",
      itens: [{ sabor_nome: "Melancia", quantidade: 600, preco_unitario: 1.95, subtotal: 1170 }],
    }} />);
    fireEvent.click(screen.getByRole("button", { name: /WhatsApp/i }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const payload = share.mock.calls[0][0];
    expect(payload.files[0].type).toBe("application/pdf");
    expect(payload.files[0].size).toBeGreaterThan(100);
    expect(payload.text).toContain("1170.00");
  });
});