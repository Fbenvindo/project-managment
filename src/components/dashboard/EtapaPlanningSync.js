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

    // Distribuir horas em dias úteis dentro do período [data_inicio, data_termino]
    const inicioDate = parseLocalDateOnly(plano.data_inicio);
    const terminoDate = parseLocalDateOnly(plano.data_termino || plano.data_inicio);
    if (!inicioDate) return;
    const diasUteis = [];
    let cur = new Date(inicioDate);
    const end = terminoDate || inicioDate;
    let safety = 0;
    while (cur <= end && safety < 400) {
      if (isWeekday(cur)) diasUteis.push(format(cur, 'yyyy-MM-dd'));
      cur = addDays(cur, 1);
      safety++;
    }
    if (diasUteis.length === 0) diasUteis.push(format(inicioDate, 'yyyy-MM-dd'));

    const horasTotais = Number(plano.horas_totais) || 0;
    const horasPorDia = Math.min(8, horasTotais / diasUteis.length);
    const distribuicao = {};
    diasUteis.forEach(d => { distribuicao[d] = Number(horasPorDia.toFixed(2)); });

    const termino = plano.data_termino || diasUteis[diasUteis.length - 1];

    // Conflito de datas: algum dia do etapa já ocupado pelo executor
    const diasOcupados = diasOcupadosPorExecutor[executor] || new Set();
    const hasConflict = diasUteis.some(d => diasOcupados.has(d));

    const folhasDesc = folhasOrdenadas.map(({ doc }) => {
      const parts = [];
      if (doc.numero) parts.push(doc.numero);
      if (doc.arquivo) parts.push(doc.arquivo);
      return parts.join(' - ') || doc.arquivo || doc.numero || 'Folha';
    });

    entries.push({
      id: `etapa-${plano.id}`,
      tipo_planejamento: 'etapa',
      isEtapaPlanning: true,
      isVirtual: true, // não dispara lógica de atraso/extensão do calendário
      isLegacyExecution: false,
      isQuickActivity: false,
      empreendimento_id: plano.empreendimento_id,
      empreendimento: emp,
      disciplina: plano.disciplina,
      subdisciplina: plano.subdisciplina,
      etapa: plano.etapa,
      executor_principal: executor,
      inicio_planejado: plano.data_inicio,
      termino_planejado: termino,
      tempo_planejado: horasTotais,
      horas_por_dia: distribuicao,
      horas_executadas_por_dia: {},
      tempo_executado: 0,
      status: 'nao_iniciado',
      folhas: folhasDesc,
      _hasDateConflict: hasConflict,
    });
  });

  return entries;
}