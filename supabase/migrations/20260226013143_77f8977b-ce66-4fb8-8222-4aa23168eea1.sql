
-- Marcar como pagas: SELADORA-André, SELADORA 1-Lourdete, FREEZER-Lourdete, CONTADORA, DAS, CELULAR
UPDATE contas_a_pagar SET pago_mes = true WHERE id IN (
  'db3da21f-f2b2-42ff-88b3-a31f55011339',  -- SELADORA André
  '0b9e3f1b-e327-43a4-b419-45ee924e9cf5',  -- SELADORA 1 Lourdete
  'c2081410-2b08-4dc7-8a25-bb285626ed2f',  -- FREEZER Lourdete
  '28de4811-d64e-44f6-87a7-6c432e374e4e',  -- CONTADORA
  'cd79687a-52fc-4e5d-8983-58339f2c14ba',  -- DAS
  '9107b674-1cbb-4b27-8389-4ce05a528d2a'   -- CELULAR
);
