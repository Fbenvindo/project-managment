import { getEtapasPadrao } from '../utils/EtapaUtils';

export function processAtividadesCatalogo(
  projectActivities,
  allActivities,
  planejamentosData,
  documentosData,
  empreendimentoData,
  allEmpreendimentos,
  empreendimentoId
) {
  const overrideActivitiesGlobalMap = new Map();
  const overrideActivitiesByDocMap = new Map();
  const excludedActivitiesSet = new Set();
  const excludedFromDocumentMap = new Map();

  (projectActivities || []).forEach(pa => {
    if (pa.id_atividade) {
      if (pa.tempo === -999) {
        if (pa.documento_id) {
          if (!excludedFromDocumentMap.has(pa.id_atividade)) {
            excludedFromDocumentMap.set(pa.id_atividade, new Set());
          }
          excludedFromDocumentMap.get(pa.id_atividade).add(pa.documento_id);
        } else {
          excludedActivitiesSet.add(pa.id_atividade);
        }
      } else {
        if (pa.documento_id) {
          const key = `${pa.documento_id}|${pa.id_atividade}`;
          overrideActivitiesByDocMap.set(key, pa);
        } else {
          overrideActivitiesGlobalMap.set(pa.id_atividade, pa);
        }
      }
    }
  });

  const empreendimento = (empreendimentoData && empreendimentoData[0]) || null;
  const etapasCadastradas = getEtapasPadrao(empreendimento?.etapas);

  return {
    overrideActivitiesGlobalMap,
    overrideActivitiesByDocMap,
    excludedActivitiesSet,
    excludedFromDocumentMap,
    empreendimento,
    etapasCadastradas
  };
}