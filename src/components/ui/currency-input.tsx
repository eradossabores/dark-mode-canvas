import * as React from "react";
import { Input } from "@/components/ui/input";
import { maskBRL, parseBRL, numberToBRL } from "@/lib/currency-mask";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> {
  /** Valor numérico em reais (ex.: 2764.5). */
  value: number | null | undefined;
  /** Recebe o valor numérico em reais já parseado. */
  onValueChange: (value: number) => void;
  /** Máximo permitido em reais. Se exceder, é clampado. */
  max?: number;
}

/**
 * Input monetário BRL. Regra determinística: dígitos digitados são sempre centavos.
 * Ex.: digitar "27645000" → R$ 276.450,00 · digitar "276450" → R$ 2.764,50.
 * O placeholder e a formatação garantem que não há ambiguidade nem dígitos extras invisíveis.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, max, className, onFocus, onBlur, ...rest }, ref) => {
    const [display, setDisplay] = React.useState<string>(numberToBRL(value ?? 0));

    // Sincroniza display quando o valor externo muda (edição, reset).
    React.useEffect(() => {
      const parsed = parseBRL(display);
      if ((value ?? 0) !== parsed) {
        setDisplay(value ? numberToBRL(value) : "");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = maskBRL(e.target.value);
      const parsed = parseBRL(masked);
      if (max != null && parsed > max) {
        const clamped = numberToBRL(max);
        setDisplay(clamped);
        onValueChange(max);
        return;
      }
      setDisplay(masked);
      onValueChange(parsed);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={display}
        onChange={handleChange}
        onFocus={(e) => {
          // Seleciona tudo para facilitar sobrescrever sem gerar dígitos extras.
          e.currentTarget.select();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          // Normaliza no blur para garantir formato consistente.
          setDisplay(display ? numberToBRL(parseBRL(display)) : "");
          onBlur?.(e);
        }}
        className={cn("font-mono tabular-nums", className)}
        {...rest}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";