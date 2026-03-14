-- Criar função de validação que impede registros duplicados do checklist
-- no mesmo dia para o mesmo sabor e número de lote
CREATE OR REPLACE FUNCTION public.prevent_duplicate_checklist_producao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Só aplica para produções vindas do checklist
  IF NEW.observacoes IS NOT NULL AND NEW.observacoes LIKE '%Checklist produção diária%' THEN
    SELECT COUNT(*) INTO v_count
    FROM producoes
    WHERE sabor_id = NEW.sabor_id
      AND observacoes = NEW.observacoes
      AND created_at::date = CURRENT_DATE;
    
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Produção duplicada: lote "%" do sabor % já registrado hoje via checklist.',
        NEW.observacoes, NEW.sabor_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT
CREATE TRIGGER trg_prevent_duplicate_checklist
  BEFORE INSERT ON producoes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_checklist_producao();