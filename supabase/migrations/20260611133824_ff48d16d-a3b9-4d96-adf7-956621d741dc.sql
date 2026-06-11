-- Reschedule daily cron to run hourly so missed/failed runs are recovered automatically
SELECT cron.unschedule('conversoes-prazo-diaria');
SELECT cron.schedule('conversoes-prazo-horaria', '15 * * * *', $$SELECT public.processar_conversoes_e_alertas_diarios();$$);

-- Run immediately to ensure no pending conversions remain
SELECT public.processar_conversoes_e_alertas_diarios();