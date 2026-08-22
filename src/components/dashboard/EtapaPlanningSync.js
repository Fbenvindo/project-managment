// src/components/dashboard/EtapaPlanningSync.js
import { format, addDays } from 'date-fns';

const parseLocalDateOnly = (iso) => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
};

const isWeekday = (date) => {
  const d = date.getDay();
  return d !== 0 && d !== 6;
};

/**
 * Calcula o empacotamento de folhas (uma por dia útil, 8h/dia) para um
 * PlanoDataEtapa, determina o executor vinculado às folhas e detecta
 * conflitos de datas com planejamentos já existentes do executor.
 *
 * Usado na página de planejamento da etapa (AnaliticoRenderContent) para
 * gerar planejamentos reais por folha e disparar a tela de resolução de
 * conflitos no momento do planejamento.
 *
 * @param {Object} params
 * @param {Object} params.plano                  - registro de PlanoDataEtapa
 * @param {Array}  params.documentos             - documentos do empreendimento
 * @param {Array}  params.pavimentos              - pavimentos (para ordem_execucao)
 * @param {Array}  params.existingPlanejamentos   - planejamentos já existentes (para executor e conflito)
 * @returns {{ folhas: Array, conflicts: Array, executor: string|null }}
 */
export function computeEtapaFolhaPacking({ plano, documentos, pavimentos, existingPlanejamentos }) {
  if (!plano || !plano.data_inicio || !plano.horas_totais) return { folhas: [], conflicts: [], executor: null };

  const pavimentoMap = new Map((pavimentos || []).map(p => [String(p.id), p]));

  // Ocupação por dia por executor (para detectar conflitos)
  const ocupacaoPorExecutor = {};
  (existingPlanejamentos || []).forEach(p => {
    if (!p.executor_principal || !p.horas_por_dia) return;
    if (!ocupacaoPorExecutor[p.executor_principal]) ocupacaoPorExecutor[p.executor_principal] = {};
    Object.entries(p.horas_por_dia).forEach(([d, h]) => {
      if (Number(h) < 0.05) return;
      if (!ocupacaoPorExecutor[p.executor_principal][d]) ocupacaoPorExecutor[p.executor_principal][d] = [];
      ocupacaoPorExecutor[p.executor_principal][d].push({ id: p.id, tipo: p.tipo_planejamento, horas: Number(h) });
    });
  });

  // Executor por documento (a partir dos planejamentos existentes das folhas)
  const executorsByDocId = {};
  (existingPlanejamentos || []).forEach(p => {
    if (!p.documento_id || !p.executor_principal) return;
    const key = String(p.documento_id);
    if (!executorsByDocId[key]) executorsByDocId[key] = {};
    executorsByDocId[key][p.executor_principal] = (executorsByDocId[key][p.executor_principal] || 0) + 1;
  });

  const docsEmp = documentos || [];
  const folhasMatch = docsEmp
    .map((doc, idx) => ({ doc, seq: idx }))
    .filter(({ doc }) => {
      const subs = Array.isArray(doc.subdisciplinas) ? doc.subdisciplinas : [];
      if (!subs.includes(plano.subdisciplina)) return false;
      if (plano.disciplina && Array.isArray(doc.disciplinas) && doc.disciplinas.length > 0 && !doc.disciplinas.includes(plano.disciplina)) return false;
      return true;
    });

  if (folhasMatch.length === 0) return { folhas: [], conflicts: [], executor: null };

  // Folhas ordenadas pela ordem de execução do pavimento; sem pavimento, usa
  // a ordem de sequência na pasta de documentos.
  const folhasOrdenadas = [...folhasMatch].sort(({ doc: a, seq: sa }, { doc: b, seq: sb }) => {
    const pa = a.pavimento_id ? pavimentoMap.get(String(a.pavimento_id)) : null;
    const pb = b.pavimento_id ? pavimentoMap.get(String(b.pavimento_id)) : null;
    const oa = pa && pa.ordem_execucao != null ? Number(pa.ordem_execucao) : (sa + 1);
    const ob = pb && pb.ordem_execucao != null ? Number(pb.ordem_execucao) : (sb + 1);
    return oa - ob;
  });

  // Executor: o mais frequente entre as folhas
  const execCount = {};
  folhasOrdenadas.forEach(({ doc }) => {
    const docExecs = executorsByDocId[String(doc.id)];
    if (docExecs) {
      Object.entries(docExecs).forEach(([email, n]) => { execCount[email] = (execCount[email] || 0) + n; });
    }
    if (doc.executor_principal) {
      execCount[doc.executor_principal] = (execCount[doc.executor_principal] || 0) + 1;
    }
  });
  const executores = Object.entries(execCount).sort((a, b) => b[1] - a[1]);
  if (executores.length === 0) return { folhas: [], conflicts: [], executor: null };
  const executor = executores[0][0];

  const horasTotais = Number(plano.horas_totais) || 0;
  const inicioDate = parseLocalDateOnly(plano.data_inicio);
  if (!inicioDate) return { folhas: [], conflicts: [], executor };

  const folhasCount = folhasOrdenadas.length;
  const horasPorFolha = folhasCount > 0 ? horasTotais / folhasCount : horasTotais;
  const ocupacaoExecutor = ocupacaoPorExecutor[executor] || {};

  let cursor = new Date(inicioDate);
  while (!isWeekday(cursor)) cursor = addDays(cursor, 1);
  let dayKey = format(cursor, 'yyyy-MM-dd');
  let dayUsed = 0;

  const folhas = [];
  const conflicts = [];
  const seenIds = new Set();

  folhasOrdenadas.forEach(({ doc }) => {
    const allocatedDays = {};
    let remaining = horasPorFolha;
    while (remaining > 0.01) {
      let avail = 8 - dayUsed;
      if (avail <= 0.01) {
        do { cursor = addDays(cursor, 1); } while (!isWeekday(cursor));
        dayKey = format(cursor, 'yyyy-MM-dd');
        dayUsed = 0;
        avail = 8;
      }
      const h = Math.min(avail, remaining);
      allocatedDays[dayKey] = Number(((allocatedDays[dayKey] || 0) + h).toFixed(2));
      dayUsed += h;
      remaining -= h;
    }
    const dias = Object.keys(allocatedDays).sort();
    if (dias.length === 0) return;

    const parts = [];
    if (doc.numero) parts.push(doc.numero);
    if (doc.arquivo) parts.push(doc.arquivo);
    const folhaDesc = parts.join(' - ') || doc.arquivo || doc.numero || 'Folha';

    dias.forEach(d => {
      (ocupacaoExecutor[d] || []).forEach(o => {
        if (!seenIds.has(o.id)) { seenIds.add(o.id); conflicts.push({ ...o, dia: d }); }
      });
    });

    folhas.push({
      doc,
      folhaDesc,
      allocatedDays,
      inicio: dias[0],
      termino: dias[dias.length - 1],
      horas: Number(horasPorFolha.toFixed(2)),
    });
  });

  return { folhas, conflicts, executor };
}