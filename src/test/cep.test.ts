import { describe, expect, it } from "vitest";
import { formatCep, isValidCep, normalizeCep } from "@/lib/cep";

describe("cep helpers", () => {
  it("accepts valid unformatted CEP", () => {
    expect(isValidCep("69317474")).toBe(true);
  });

  it("accepts valid formatted CEP", () => {
    expect(isValidCep("69317-474")).toBe(true);
  });

  it("rejects incomplete CEP", () => {
    expect(isValidCep("69317-47")).toBe(false);
  });

  it("normalizes and formats CEP consistently", () => {
    expect(normalizeCep("69317-474")).toBe("69317474");
    expect(formatCep("69317474")).toBe("69317-474");
  });
});
