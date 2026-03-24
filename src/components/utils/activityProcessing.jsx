/**
 * Processa atividades do catálogo, expandindo-as por etapas múltiplas
 */
export function processDocumentationActivities(
  allGenericActivitiesMap,
  planejamentosData,
  etapasCadastradas,
  overrideActivitiesGlobalMap,
  excludedActivitiesSet
) {
  const atividadesDocumentacao = [];

  allGenericActivitiesMap.forEach(baseAtividade => {
    const isExcludedFromProject = excludedActivitiesSet.has(baseAtividade.id);
    if (isExcludedFromProject) return;

    const override = overrideActivitiesGlobalMap.get(baseAtividade.id);

    const planejamentosGeraisDaAtividade = (planejamentosData || []).filter(
      p =>
        p.atividade_id === baseAtividade.id &&
        (p.documento_id === undefined || p.documento_id === null || p.documento_id === 'null')
    );

    if (planejamentosGeraisDaAtividade.length > 0) {
      const etapasUnicasDaAtividade = [...new Set(planejamentosGeraisDaAtividade.map(p => p.etapa))];

      etapasUnicasDaAtividade.forEach(etapa => {
        const planosNaEtapa = planejamentosGeraisDaAtividade.filter(p => p.etapa === etapa);
        const primeiroPlano = planosNaEtapa[0];

        atividadesDocumentacao.push({
          ...baseAtividade,
          id: primeiroPlano.id,
          uniqueId: `plano-${primeiroPlano.id}`,
          atividade: primeiroPlano.descritivo || baseAtividade.atividade,
          tempo: primeiroPlano.tempo_planejado,
          source: 'Catálogo',
          source_documento_id: null,
          status: primeiroPlano.status === 'concluido' ? 'Concluída' : 'Planejada',
          isEditable: false,
          etapa: etapa,
          executor_principal: primeiroPlano.executor_principal,
          base_atividade_id: baseAtividade.id
        });
      });
    } else {
      const executorPrincipal = override ? override.executor_principal : baseAtividade.executor_principal;
      const tempoFinal = override?.tempo !== undefined && override?.tempo !== null
        ? override.tempo
        : baseAtividade.tempo || 0;

      const etapaOriginal = baseAtividade.etapa;
      const etapaExisteNasCadastradas = etapasCadastradas.includes(etapaOriginal);
      const etapasParaExpandir = etapaExisteNasCadastradas
        ? [etapaOriginal]
        : (etapasCadastradas.length > 0 ? etapasCadastradas : [baseAtividade.etapa]);

      etapasParaExpandir.forEach((etapa, idx) => {
        const etapaCorreta = override ? override.etapa : etapa;

        atividadesDocumentacao.push({
          ...baseAtividade,
          uniqueId: `doc-${baseAtividade.id}-${etapa}-${idx}`,
          id: baseAtividade.id,
          tempo: tempoFinal,
          source: 'Catálogo',
          source_documento_id: null,
          status: 'Disponível',
          isEditable: false,
          etapa: etapaCorreta,
          executor_principal: executorPrincipal,
          base_atividade_id: baseAtividade.id
        });
      });
    }
  });

  return atividadesDocumentacao;
}

/**
 * Processa atividades de documentos, expandindo-as por etapas múltiplas
 */
export function processDocumentActivities(
  documentosData,
  allGenericActivitiesMap,
  planejamentosData,
  etapasCadastradas,
  projectActivities,
  overrideActivitiesByDocMap,
  overrideActivitiesGlobalMap,
  excludedActivitiesSet,
  excludedFromDocumentMap
) {
  let documentActivities = [];

  (documentosData || []).forEach(doc => {
    const subdisciplinasDoc = doc.subdisciplinas || [];
    const disciplinasDoc = doc.disciplinas && doc.disciplinas.length > 0
      ? doc.disciplinas
      : [doc.disciplina].filter(Boolean);
    const fatorDificuldade = doc.fator_dificuldade || 1;

    const atividadesVinculadasDoc = (projectActivities || []).filter(
      pa => pa.documento_id === doc.id && !pa.id_atividade && pa.tempo !== -999
    );

    atividadesVinculadasDoc.forEach(atividadeVinculada => {
      const planejamentosComDatas = (planejamentosData || []).filter(
        p => p.documento_id === doc.id && p.atividade_id === atividadeVinculada.id
      );
      const sourceDisplay = `Folha: ${doc.numero} - ${doc.arquivo || 'Sem Nome'}`;

      if (planejamentosComDatas.length > 0) {
        planejamentosComDatas.forEach(existingPlan => {
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
            base_atividade_id: atividadeVinculada.id
          });
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
          base_atividade_id: atividadeVinculada.id
        });
      }
    });

    allGenericActivitiesMap.forEach(baseAtividade => {
      const isExcludedFromProject = excludedActivitiesSet.has(baseAtividade.id);
      const isExcludedFromThisDoc =
        excludedFromDocumentMap.has(baseAtividade.id) &&
        excludedFromDocumentMap.get(baseAtividade.id).has(doc.id);
      if (isExcludedFromProject || isExcludedFromThisDoc) return;

      const disciplinaMatch = disciplinasDoc.includes(baseAtividade.disciplina);
      const subdisciplinaMatch = subdisciplinasDoc.includes(baseAtividade.subdisciplina);
      if (!disciplinaMatch || !subdisciplinaMatch) return;

      const overrideKey = `${doc.id}|${baseAtividade.id}`;
      const override =
        overrideActivitiesByDocMap.get(overrideKey) ||
        overrideActivitiesGlobalMap.get(baseAtividade.id);

      const sourceDisplay = `Folha: ${doc.numero} - ${doc.arquivo || 'Sem Nome'}`;

      const planejamentosComDatas = (planejamentosData || []).filter(
        p => p.documento_id === doc.id && p.atividade_id === baseAtividade.id
      );

      if (planejamentosComDatas.length > 0) {
        planejamentosComDatas.forEach(existingPlan => {
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
            etapa: existingPlan.etapa || baseAtividade.etapa,
            executor_principal:
              existingPlan.executor_principal ||
              (override ? override.executor_principal : baseAtividade.executor_principal),
            base_atividade_id: baseAtividade.id
          });
        });
      } else {
        const tempoComOverride = override?.tempo !== undefined && override?.tempo !== null
          ? override.tempo
          : baseAtividade.tempo || 0;
        const tempoFinal = tempoComOverride * fatorDificuldade;
        const executorPrincipal = override ? override.executor_principal : baseAtividade.executor_principal;

        const etapaOriginal = baseAtividade.etapa;
        const etapaExisteNasCadastradas = etapasCadastradas.includes(etapaOriginal);
        const etapasParaExpandir = etapaExisteNasCadastradas
          ? [etapaOriginal]
          : (etapasCadastradas.length > 0 ? etapasCadastradas : [baseAtividade.etapa]);

        etapasParaExpandir.forEach((etapa, idx) => {
          const etapaCorreta = override ? override.etapa : etapa;

          documentActivities.push({
            ...baseAtividade,
            uniqueId: `avail-${doc.id}-${baseAtividade.id}-${etapa}-${idx}`,
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
            base_atividade_id: baseAtividade.id
          });
        });
      }
    });
  });

  return documentActivities;
}