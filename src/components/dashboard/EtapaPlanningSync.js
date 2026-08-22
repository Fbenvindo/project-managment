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
 * Constrói entradas virtuais de calendário a partir dos planejamentos por etapa
 * (PlanoDataEtapa), vinculando cada etapa ao executor dos documentos (folhas).
 *
 * Cada entrada representa um bloco planejado por etapa/subdisciplina e lista as
 * folhas (documentos) ordenadas pela ordem de execução do pavimento.
 *
 * @param {Object} params
 * @param {Array}  params.planoDataEtapas        - registros de PlanoDataEtapa
 * @param {Array}  params.documentos              - documentos dos empreendimentos relacionados
 * @param {Array}  params.pavimentos               - pavimentos (para ordem_execucao)
 * @param {Map}    params.empreendimentosMap       - id -> empreendimento
 * @param {Array}  params.existingPlanejamentos   - planejamentos já carregados (para conflito)
 * @param {String} params.userFilter              - email do usuário filtrado ou 'all'
 */
export function buildEtapaCalendarEntries({ planoDataEtapas, documentos, pavimentos, empreendimentosMap, existingPlanejamentos, userFilter }) {
  if (!planoDataEtapas || planoDataEtapas.length === 0) return [];

  const docsByEmpreendimento = {};
  (documentos || []).forEach(doc => {
    if (!doc.empreendimento_id) return;
    if (!docsByEmpreendimento[doc.empreendimento_id]) docsByEmpreendimento[doc.empreendimento_id] = [];
    docsByEmpreendimento[doc.empreendimento_id].push(doc);
  });

  const pavimentoMap = new Map((pavimentos || []).map(p => [String(p.id), p]));

  // Dias já ocupados por executor (para detecção de conflito de datas)
  const diasOcupadosPorExecutor = {};
  (existingPlanejamentos || []).forEach(p => {
    if (!p.executor_principal || !p.horas_por_dia) return;
    if (!diasOcupadosPorExecutor[p.executor_principal]) diasOcupadosPorExecutor[p.executor_principal] = new Set();
    Object.keys(p.horas_por_dia).forEach(d => {
      if (Number(p.horas_por_dia[d]) >= 0.05) diasOcupadosPorExecutor[p.executor_principal].add(d);
    });
  });

  // Ocupação por dia por executor (para listar as atividades em conflito)
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

  // Mapa documento_id -> executors (a partir dos planejamentos existentes das folhas)
  const executorsByDocId = {};
  (existingPlanejamentos || []).forEach(p => {
    if (!p.documento_id || !p.executor_principal) return;
    const key = String(p.documento_id);
    if (!executorsByDocId[key]) executorsByDocId[key] = {};
    executorsByDocId[key][p.executor_principal] = (executorsByDocId[key][p.executor_principal] || 0) + 1;
  });

  const entries = [];

  (planoDataEtapas || []).forEach(plano => {
    if (!plano.data_inicio || !plano.horas_totais) return;
    const emp = empreendimentosMap.get(String(plano.empreendimento_id));
    if (!emp) return;

    const docsEmp = docsByEmpreendimento[plano.empreendimento_id] || [];
    // seq = ordem de sequência da folha na pasta de documentos (fallback quando não há pavimento)
    const folhasMatch = docsEmp
      .map((doc, idx) => ({ doc, seq: idx }))
      .filter(({ doc }) => {
        const subs = Array.isArray(doc.subdisciplinas) ? doc.subdisciplinas : [];
        if (!subs.includes(plano.subdisciplina)) return false;
        if (plano.disciplina && Array.isArray(doc.disciplinas) && doc.disciplinas.length > 0 && !doc.disciplinas.includes(plano.disciplina)) return false;
        return true;
      });

    if (folhasMatch.length === 0) return;

    // Folhas ordenadas pela ordem de execução do pavimento; quando a folha não tem
    // pavimento atribuído, usa a ordem de sequência na pasta de documentos.
    const folhasOrdenadas = [...folhasMatch].sort(({ doc: a, seq: sa }, { doc: b, seq: sb }) => {
      const pa = a.pavimento_id ? pavimentoMap.get(String(a.pavimento_id)) : null;
      const pb = b.pavimento_id ? pavimentoMap.get(String(b.pavimento_id)) : null;
      const oa = pa && pa.ordem_execucao != null ? Number(pa.ordem_execucao) : (sa + 1);
      const ob = pb && pb.ordem_execucao != null ? Number(pb.ordem_execucao) : (sb + 1);
      return oa - ob;
    });

    // Executor: o mais frequente entre as folhas. Vinculado ao executor do documento,
    // lendo primeiro dos planejamentos existentes (PlanejamentoAtividade) e, como
    // fallback, do campo executor_principal do próprio documento.
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
    if (executores.length === 0) return;
    const executor = executores[0][0];

    if (userFilter && userFilter !== 'all' && executor !== userFilter) return;

    const horasTotais = Number(plano.horas_totais) || 0;
    const inicioDate = parseLocalDateOnly(plano.data_inicio);
    if (!inicioDate) return;

    // Cada folha recebe uma fatia igual das horas da etapa, empacotada em dias
    // úteis (8h/dia) a partir de data_inicio, na ordem de execução (pavimento
    // ou sequência da pasta de documentos). Assim cada folha tem sua própria
    // data planejada dentro do período global da subdisciplina.
    const folhasCount = folhasOrdenadas.length;
    const horasPorFolha = folhasCount > 0 ? horasTotais / folhasCount : horasTotais;
    const diasOcupados = diasOcupadosPorExecutor[executor] || new Set();

    let cursor = new Date(inicioDate);
    while (!isWeekday(cursor)) cursor = addDays(cursor, 1);
    let dayKey = format(cursor, 'yyyy-MM-dd');
    let dayUsed = 0;

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
      const ocupacaoExecutor = ocupacaoPorExecutor[executor] || {};
      const conflitos = [];
      const seenIds = new Set();
      dias.forEach(d => {
        (ocupacaoExecutor[d] || []).forEach(o => {
          if (!seenIds.has(o.id)) { seenIds.add(o.id); conflitos.push({ ...o, dia: d }); }
        });
      });
      const hasConflict = conflitos.length > 0;

      const parts = [];
      if (doc.numero) parts.push(doc.numero);
      if (doc.arquivo) parts.push(doc.arquivo);
      const folhaDesc = parts.join(' - ') || doc.arquivo || doc.numero || 'Folha';

      entries.push({
        id: `etapa-${plano.id}-folha-${doc.id}`,
        tipo_planejamento: 'etapa',
        isEtapaPlanning: true,
        isVirtual: true,
        isLegacyExecution: false,
        isQuickActivity: false,
        empreendimento_id: plano.empreendimento_id,
        empreendimento: emp,
        disciplina: plano.disciplina,
        subdisciplina: plano.subdisciplina,
        etapa: plano.etapa,
        executor_principal: executor,
        inicio_planejado: dias[0],
        termino_planejado: dias[dias.length - 1],
        tempo_planejado: Number(horasPorFolha.toFixed(2)),
        horas_por_dia: allocatedDays,
        horas_executadas_por_dia: {},
        tempo_executado: 0,
        status: 'nao_iniciado',
        folhas: [folhaDesc],
        _hasDateConflict: hasConflict,
        _conflictWith: conflitos,
        _planoId: plano.id,
        _horasTotais: horasTotais,
      });
    });
  });

  return entries;
}