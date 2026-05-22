import { Atividade, PlanejamentoAtividade } from '@/entities/all';

/**
 * Processa atividades do projeto para exibição no analítico
 * Separa overrides globais, por documento e exclusões
 */
export function processOverrides(projectActivities) {
  const overrideActivitiesGlobalMap = new Map(); // Overrides sem documento_id específico
  const overrideActivitiesByDocMap = new Map(); // Overrides com documento_id específico (chave: "docId|atividadeId")
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

  return {
    overrideActivitiesGlobalMap,
    overrideActivitiesByDocMap,
    excludedActivitiesSet,
    excludedFromDocumentMap
  };
}

/**
 * Normaliza atividades específicas do projeto (sem id_atividade)
 */
export function normalizeProjectActivities(activitiesToProcess) {
  return (activitiesToProcess || [])
    .filter(pa => !pa.id_atividade && pa.tempo !== -999)
    .map(ativ => ({
      ...ativ,
      uniqueId: `proj-${ativ.id}`,
      source: 'Projeto',
      status: 'N/A',
      isEditable: true,
      base_atividade_id: ativ.id,
  }));
}

/**
 * Processa atividades de documentação (disciplinas específicas)
 */
export function processDocumentacaoActivities({
  allGenericActivitiesMap,
  excludedActivitiesSet,
  overrideActivitiesGlobalMap,
  planejamentosMap,
  disciplinasDocumentacao = ['Planejamento', 'Gestão', 'BIM', 'Apoio', 'Coordenação']
}) {
  const atividadesDocumentacao = [];
  
  allGenericActivitiesMap.forEach(baseAtividade => {
    if (disciplinasDocumentacao.includes(baseAtividade.disciplina)) {
      const isExcludedFromProject = excludedActivitiesSet.has(baseAtividade.id);
      if (!isExcludedFromProject) {
        const override = overrideActivitiesGlobalMap.get(baseAtividade.id);
        const etapaCorreta = override ? override.etapa : baseAtividade.etapa;
        
        const planKey = `null-${baseAtividade.id}`;
        const existingPlan = planejamentosMap.get(planKey);
        
        if (existingPlan) {
          atividadesDocumentacao.push({
            ...baseAtividade,
            id: existingPlan.id,
            uniqueId: `plano-${existingPlan.id}`,
            atividade: existingPlan.descritivo || baseAtividade.atividade,
            tempo: existingPlan.tempo_planejado,
            source: 'Catálogo',
            source_documento_id: null,
            status: existingPlan.status === 'concluido' ? 'Concluída' : 'Planejada',
            isEditable: false,
            etapa: existingPlan.etapa || etapaCorreta,
            executor_principal: existingPlan.executor_principal,
            base_atividade_id: baseAtividade.id,
          });
        } else {
          const executorPrincipal = override ? override.executor_principal : baseAtividade.executor_principal;
          const tempoFinal = override?.tempo !== undefined && override?.tempo !== null 
            ? override.tempo 
            : (baseAtividade.tempo || 0);

          atividadesDocumentacao.push({
            ...baseAtividade,
            uniqueId: `doc-${baseAtividade.id}`,
            id: baseAtividade.id,
            tempo: tempoFinal,
            source: 'Catálogo',
            source_documento_id: null,
            status: 'Disponível',
            isEditable: false,
            etapa: etapaCorreta,
            executor_principal: executorPrincipal,
            base_atividade_id: baseAtividade.id,
          });
        }
      }
    }
  });

  return atividadesDocumentacao;
}

/**
 * Processa atividades vinculadas a documentos
 * CORREÇÃO: Agora respeita documento_ids ao invés de mostrar em todos os documentos
 */
export function processDocumentActivities({
  documentos,
  projectActivities,
  allGenericActivitiesMap,
  excludedActivitiesSet,
  excludedFromDocumentMap,
  overrideActivitiesGlobalMap,
  overrideActivitiesByDocMap,
  planejamentosMap
}) {
  let documentActivities = [];
  
  (documentos || []).forEach(doc => {
    const subdisciplinasDoc = doc.subdisciplinas || [];
    const disciplinasDoc = doc.disciplinas?.length > 0 ? doc.disciplinas : [doc.disciplina].filter(Boolean);
    const fatorDificuldade = doc.fator_dificuldade || 1;

    // Adicionar atividades específicas vinculadas a este documento
    const atividadesVinculadasDoc = (projectActivities || []).filter(pa => {
      const temDocumentoIdSingular = pa.documento_id === doc.id;
      const temDocumentoIdArray = pa.documento_ids && Array.isArray(pa.documento_ids) && pa.documento_ids.includes(doc.id);
      return !pa.id_atividade && pa.tempo !== -999 && (temDocumentoIdSingular || temDocumentoIdArray);
    });
    
    atividadesVinculadasDoc.forEach(atividadeVinculada => {
      const planKey = `${doc.id}-${atividadeVinculada.id}`;
      const existingPlan = planejamentosMap.get(planKey);
      const sourceDisplay = `Folha: ${doc.numero} - ${doc.arquivo || 'Sem Nome'}`;
      
      if (existingPlan) {
        documentActivities.push({
          ...atividadeVinculada,
          id: existingPlan.id,
          uniqueId: `plano-${existingPlan.id}`,
          atividade: existingPlan.descritivo || atividadeVinculada.atividade,
          tempo: existingPlan.tempo_planejado,
          source: sourceDisplay,
          source_documento_id: doc.id,
          source_documento_numero: doc.numero,
          source_documento_arquivo: doc.arquivo,
          status: existingPlan.status === 'concluido' ? 'Concluída' : 'Planejada',
          isEditable: false,
          etapa: existingPlan.etapa || atividadeVinculada.etapa,
          executor_principal: existingPlan.executor_principal,
          base_atividade_id: atividadeVinculada.id,
        });
      } else {
        documentActivities.push({
          ...atividadeVinculada,
          uniqueId: `avail-${doc.id}-${atividadeVinculada.id}`,
          id: atividadeVinculada.id,
          tempo: atividadeVinculada.tempo || 0,
          source: sourceDisplay,
          source_documento_id: doc.id,
          source_documento_numero: doc.numero,
          source_documento_arquivo: doc.arquivo,
          status: 'Disponível',
          isEditable: false,
          etapa: atividadeVinculada.etapa,
          base_atividade_id: atividadeVinculada.id,
        });
      }
    });
    
    // Processar atividades genéricas que correspondem a este documento
    allGenericActivitiesMap.forEach(baseAtividade => {
      const isExcludedFromProject = excludedActivitiesSet.has(baseAtividade.id);
      const isExcludedFromThisDoc = excludedFromDocumentMap.has(baseAtividade.id) && excludedFromDocumentMap.get(baseAtividade.id).has(doc.id);
      if (isExcludedFromProject || isExcludedFromThisDoc) return;

      const disciplinaMatch = disciplinasDoc.includes(baseAtividade.disciplina);
      const subdisciplinaMatch = subdisciplinasDoc.includes(baseAtividade.subdisciplina);

      if (disciplinaMatch && subdisciplinaMatch) {
        const planKey = `${doc.id}-${baseAtividade.id}`;
        const existingPlan = planejamentosMap.get(planKey);
        const overrideKey = `${doc.id}|${baseAtividade.id}`;
        const override = overrideActivitiesByDocMap.get(overrideKey) || overrideActivitiesGlobalMap.get(baseAtividade.id);
        const etapaCorreta = override ? override.etapa : baseAtividade.etapa;
        const executorPrincipal = override ? override.executor_principal : baseAtividade.executor_principal;

        const sourceDisplay = `Folha: ${doc.numero} - ${doc.arquivo || 'Sem Nome'}`;

        if (existingPlan) {
          documentActivities.push({
            ...baseAtividade,
            id: existingPlan.id,
            uniqueId: `plano-${existingPlan.id}`,
            atividade: existingPlan.descritivo || baseAtividade.atividade,
            tempo: existingPlan.tempo_planejado,
            source: sourceDisplay,
            source_documento_id: doc.id,
            source_documento_numero: doc.numero,
            source_documento_arquivo: doc.arquivo,
            status: existingPlan.status === 'concluido' ? 'Concluída' : 'Planejada',
            isEditable: false,
            etapa: existingPlan.etapa || etapaCorreta,
            executor_principal: existingPlan.executor_principal || executorPrincipal,
            base_atividade_id: baseAtividade.id,
          });
        } else {
          const tempoComOverride = override?.tempo !== undefined && override?.tempo !== null
            ? override.tempo
            : (baseAtividade.tempo || 0);
          const tempoFinal = tempoComOverride * fatorDificuldade;

          documentActivities.push({
            ...baseAtividade,
            uniqueId: `avail-${doc.id}-${baseAtividade.id}`,
            id: baseAtividade.id,
            tempo: tempoFinal,
            source: sourceDisplay,
            source_documento_id: doc.id,
            source_documento_numero: doc.numero,
            source_documento_arquivo: doc.arquivo,
            status: 'Disponível',
            isEditable: false,
            etapa: etapaCorreta,
            executor_principal: executorPrincipal,
            base_atividade_id: baseAtividade.id,
          });
        }
      }
    });
  });

  return documentActivities;
}