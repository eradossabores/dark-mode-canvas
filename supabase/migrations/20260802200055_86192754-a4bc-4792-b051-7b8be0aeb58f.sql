UPDATE public.estoque_gelos SET quantidade = 0, updated_at = now() WHERE quantidade < 0;
UPDATE public.materias_primas SET estoque_atual = 0, updated_at = now() WHERE estoque_atual < 0;
UPDATE public.embalagens SET estoque_atual = 0, updated_at = now() WHERE estoque_atual < 0;

CREATE OR REPLACE FUNCTION public.clamp_estoque_nao_negativo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'estoque_gelos' THEN
    IF NEW.quantidade < 0 THEN NEW.quantidade := 0; END IF;
  ELSE
    IF NEW.estoque_atual < 0 THEN NEW.estoque_atual := 0; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clamp_estoque_gelos ON public.estoque_gelos;
CREATE TRIGGER trg_clamp_estoque_gelos BEFORE INSERT OR UPDATE ON public.estoque_gelos
FOR EACH ROW EXECUTE FUNCTION public.clamp_estoque_nao_negativo();

DROP TRIGGER IF EXISTS trg_clamp_materias_primas ON public.materias_primas;
CREATE TRIGGER trg_clamp_materias_primas BEFORE INSERT OR UPDATE ON public.materias_primas
FOR EACH ROW EXECUTE FUNCTION public.clamp_estoque_nao_negativo();

DROP TRIGGER IF EXISTS trg_clamp_embalagens ON public.embalagens;
CREATE TRIGGER trg_clamp_embalagens BEFORE INSERT OR UPDATE ON public.embalagens
FOR EACH ROW EXECUTE FUNCTION public.clamp_estoque_nao_negativo();