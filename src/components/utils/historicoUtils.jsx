import { base44 } from '@/api/base44Client';
const HistoricoAtividade = base44.entities.HistoricoAtividade;

/**
 * Registra uma ou mais alterações no histórico de uma atividade.
 * @param {Object} params
 * @param {string} params.planejamentoId
 * @param {string} params.tipoPlanejamento - 'atividade' | 'documento'
 * @param {Object} params.dadosAnteriores - objeto com os campos antes da edição
 * @param {Object} params.dadosNovos - objeto com os campos depois da edição (apenas os alterados)
 * @param {Object} params.usuario - { email, nome }
 * @param {string} params.descricaoAtividade
 */
export async function registrarHistorico({ planejamentoId, tipoPlanejamento, dadosAnteriores, dadosNovos, usuario, descricaoAtividade }) {
  const camposMonitorados = [
    'status',
    'termino_planejado',
    'inicio_planejado',
    'termino_ajustado',
    'inicio_ajustado',
    'executor_principal',
    'tempo_planejado',
    'descritivo',
  ];

  const registros = [];

  for (const campo of camposMonitorados) {
    if (!(campo in dadosNovos)) continue;
    const anterior = dadosAnteriores?.[campo];
    const novo = dadosNovos[campo];
    const anteriorStr = anterior != null ? String(anterior) : 'null';
    const novoStr = novo != null ? String(novo) : 'null';
    if (anteriorStr === novoStr) continue;

    registros.push({
      planejamento_id: String(planejamentoId),
      tipo_planejamento: tipoPlanejamento || 'atividade',
      campo,
      valor_anterior: anteriorStr,
      valor_novo: novoStr,
      usuario_email: usuario?.email || '',
      usuario_nome: usuario?.nome || usuario?.full_name || usuario?.email || '',
      descricao_atividade: descricaoAtividade || '',
    });
  }

  if (registros.length === 0) return;

  // Salvar em paralelo
  await Promise.all(registros.map(r => HistoricoAtividade.create(r).catch(() => null)));
}