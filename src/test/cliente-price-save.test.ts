import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { shouldGeocodeClienteAddress } from "@/lib/geocoding";

describe("customer price-only updates", () => {
  const address = { endereco: "Rua Francisco Expedito da Silva, 645", bairro: "", cidade: "Boa Vista", estado: "RR" };

  it("does not request geocoding when saving Gold's 1.95 price without changing its address", () => {
    const updated = { ...address, preco_padrao_personalizado: 1.95 };
    expect(shouldGeocodeClienteAddress(updated, address)).toBe(false);
  });

  it("requests geocoding when the address actually changes", () => {
    expect(shouldGeocodeClienteAddress({ ...address, endereco: "Rua nova, 100" }, address)).toBe(true);
  });
});