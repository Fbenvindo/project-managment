import { startOfDay, parseISO, isValid, isAfter } from 'date-fns';

export const normalizeActivityId = (value) => String(value ?? '');
export const formatHours = (h) => Number(h).toFixed(1);

export const isActivityOverdueUtil = (plano) => {
  if (!plano || plano.isLegacyExecution) return false;
  if (plano.status === 'concluido' || plano.status === 'em_andamento' || plano.status === 'pausado') return false;
  if (!plano.termino_planejado) return false;
  try {
    const termino = startOfDay(parseISO(plano.termino_planejado));
    const hoje = startOfDay(new Date());
    return isValid(termino) && hoje > termino;
  } catch { return false; }
};

export const calculateActivityStatus = (plano, allPlanejamentos = []) => {
  if (plano.isLegacyExecution) return plano.status;
  if (plano.status === 'concluido') return 'concluido';

  const overdue = isActivityOverdueUtil(plano);
  if (plano.status === 'atrasado' || overdue) return 'atrasado';

  let foiReplanejadaParaIniciarMaisTarde = false;
  if (plano.inicio_ajustado && plano.inicio_planejado) {
    try {
      const ajustado = startOfDay(parseISO(plano.inicio_ajustado));
      const planejado = startOfDay(parseISO(plano.inicio_planejado));
      if (isValid(ajustado) && isValid(planejado) && isAfter(ajustado, planejado)) {
        foiReplanejadaParaIniciarMaisTarde = true;
      }
    } catch (_) {}
  }

  let predecessoraAtrasada = false;
  if (plano.predecessora_id) {
    const predecessora = allPlanejamentos.find(p => normalizeActivityId(p.id) === normalizeActivityId(plano.predecessora_id));
    if (predecessora && isActivityOverdueUtil(predecessora)) predecessoraAtrasada = true;
  }

  if (foiReplanejadaParaIniciarMaisTarde || predecessoraAtrasada) return 'impactado_por_atraso';

  let wasReplannedLaterTermino = false;
  if (plano.termino_ajustado && plano.termino_planejado) {
    try {
      const ajustado = startOfDay(parseISO(plano.termino_ajustado));
      const planejado = startOfDay(parseISO(plano.termino_planejado));
      if (isValid(ajustado) && isValid(planejado) && isAfter(ajustado, planejado)) wasReplannedLaterTermino = true;
    } catch (_) {}
  }

  if (wasReplannedLaterTermino) return 'replanejado_atrasado';
  return plano.status || 'nao_iniciado';
};