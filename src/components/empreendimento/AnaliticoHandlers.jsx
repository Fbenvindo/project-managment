/**
 * Handlers de "Concluir Etapa Completa" e "Reverter Conclusão de Etapa"
 * extraídos do AnaliticoGlobalTab para reduzir o tamanho do arquivo.
 */
import { PlanejamentoAtividade, Atividade } from '@/entities/all';
import { retryWithBackoff, retryWithExtendedBackoff } from '../utils/apiUtils';
import { format } from 'date-fns';

export async function concluirEtapaCompleta({
  etapa, empreendimentoId, combinedActivities, documentos,
  setIsConcluindoEtapa, setEtapaParaConcluir, fetchData, onUpdate
}) {
  if (!etapa) { alert("Selecione uma etapa para concluir."); return; }

  let todosPlanejamentos = await retryWithBackoff(
    () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, etapa }),
    3, 500, `getTodosPlanejamentosEtapa-${etapa}`
  );

  if (todosPlanejamentos.length === 0) {
    const atividadesEtapaDedup = new Map();
    combinedActivities.filter(a => a.etapa === etapa && !a.isEditable).forEach(a => {
      const k = a.base_atividade_id || a.id;
      if (!atividadesEtapaDedup.has(k)) atividadesEtapaDedup.set(k, a);
    });
    const atividadesEtapa = Array.from(atividadesEtapaDedup.values());
    if (atividadesEtapa.length === 0) { alert(`Nenhuma atividade encontrada para a etapa "${etapa}".`); return; }
    const hoje = format(new Date(), 'yyyy-MM-dd');
    let novosPlanejamentos = [];
    const allAtivList = await retryWithBackoff(() => Atividade.list(), 3, 500, `getAllActivitiesForEtapa`);
    const atividadesOriginaisMap = new Map((allAtivList || []).map(a => [a.id, a]));
    for (const ativ of atividadesEtapa) {
      const atividadeId = ativ.base_atividade_id || ativ.id;
      const atividadeOriginal = atividadesOriginaisMap.get(atividadeId);
      if (!atividadeOriginal) continue;
      const documentosComAtividade = documentos.filter(doc =>
        doc.disciplina === atividadeOriginal.disciplina &&
        (doc.subdisciplinas || []).includes(atividadeOriginal.subdisciplina)
      );
      const docsParaCriar = documentosComAtividade.length > 0 ? documentosComAtividade.map(d => d.id) : [null];
      for (const docId of docsParaCriar) {
        const np = await retryWithBackoff(() => PlanejamentoAtividade.create({
          empreendimento_id: empreendimentoId, atividade_id: atividadeId, documento_id: docId,
          etapa, descritivo: atividadeOriginal.atividade, tempo_planejado: atividadeOriginal.tempo || 0,
          status: 'concluido', termino_real: hoje, horas_por_dia: {}
        }), 3, 500, `createEtapaPlan-${docId}-${atividadeId}`);
        novosPlanejamentos.push(np);
        // Criar marcador na entidade Atividade
        if (docId) {
          const doc = documentos.find(d => d.id === docId);
          const marcadores = await retryWithBackoff(
            () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0 }),
            3, 500, `checkMarcadorEtapa-${docId}-${atividadeId}`
          );
          if (!marcadores || marcadores.length === 0) {
            await retryWithBackoff(() => Atividade.create({
              etapa: atividadeOriginal.etapa, disciplina: atividadeOriginal.disciplina,
              subdisciplina: atividadeOriginal.subdisciplina,
              atividade: `(Concluída na folha ${doc?.numero || docId}) ${atividadeOriginal.atividade}`,
              empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0,
            }), 3, 500, `criarMarcadorEtapa-${docId}-${atividadeId}`);
          }
        }
      }
    }
    todosPlanejamentos = novosPlanejamentos;
  }

  const atividadesDedupMap = new Map();
  combinedActivities.filter(a => a.etapa === etapa && !a.isEditable).forEach(a => {
    const k = a.base_atividade_id || a.id;
    if (!atividadesDedupMap.has(k)) atividadesDedupMap.set(k, a);
  });
  const atividadesSemPlano = Array.from(atividadesDedupMap.values()).filter(a =>
    !todosPlanejamentos.some(p => p.atividade_id === (a.base_atividade_id || a.id))
  );

  if (!window.confirm(`Concluir etapa "${etapa}"?\n\n${todosPlanejamentos.length} planejamento(s) + ${atividadesSemPlano.length} atividade(s) disponível(is) serão concluídos.`)) return;

  setIsConcluindoEtapa(true);
  try {
    let totalConcluidos = 0;
    let jaFinalizados = 0;
    const hoje = format(new Date(), 'yyyy-MM-dd');

    for (const plano of todosPlanejamentos) {
      if (plano.status === 'concluido') { jaFinalizados++; continue; }
      await retryWithExtendedBackoff(() => PlanejamentoAtividade.update(plano.id, { status: 'concluido', termino_real: hoje }), `concluirPlan-${plano.id}`);
      // Criar marcador
      if (plano.documento_id) {
        const doc = documentos.find(d => d.id === plano.documento_id);
        const marcadores = await retryWithBackoff(
          () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: plano.atividade_id, documento_id: plano.documento_id, tempo: 0 }),
          3, 500, `checkMarcEtapa-${plano.documento_id}-${plano.atividade_id}`
        );
        if (!marcadores || marcadores.length === 0) {
          await retryWithBackoff(() => Atividade.create({
            etapa: plano.etapa || '', disciplina: '', subdisciplina: '',
            atividade: `(Concluída na folha ${doc?.numero || plano.documento_id}) ${plano.descritivo || ''}`,
            empreendimento_id: empreendimentoId, id_atividade: plano.atividade_id,
            documento_id: plano.documento_id, tempo: 0,
          }), 3, 500, `criarMarcEtapa-${plano.documento_id}-${plano.atividade_id}`);
        }
      }
      totalConcluidos++;
    }

    if (atividadesSemPlano.length > 0) {
      const allAtivExtra = await retryWithBackoff(() => Atividade.list(), 3, 500, `getAllActivitiesExtra`);
      const atividadesMapExtra = new Map((allAtivExtra || []).map(a => [a.id, a]));
      for (const ativ of atividadesSemPlano) {
        const atividadeId = ativ.base_atividade_id || ativ.id;
        const atividadeOriginal = atividadesMapExtra.get(atividadeId);
        if (!atividadeOriginal) continue;
        const docsCompativeis = documentos.filter(doc =>
          doc.disciplina === atividadeOriginal.disciplina &&
          (doc.subdisciplinas || []).includes(atividadeOriginal.subdisciplina)
        );
        const docsParaCriar = docsCompativeis.length > 0 ? docsCompativeis.map(d => d.id) : [null];
        for (const docId of docsParaCriar) {
          await retryWithExtendedBackoff(() => PlanejamentoAtividade.create({
            empreendimento_id: empreendimentoId, atividade_id: atividadeId, documento_id: docId,
            etapa, descritivo: atividadeOriginal.atividade, tempo_planejado: atividadeOriginal.tempo || 0,
            status: 'concluido', termino_real: hoje, horas_por_dia: {}
          }), `createConcluido-${docId}-${atividadeId}`);
          // Marcador
          if (docId) {
            const doc = documentos.find(d => d.id === docId);
            const marcadores = await retryWithBackoff(
              () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0 }),
              3, 500, `checkMarcSemPlano-${docId}-${atividadeId}`
            );
            if (!marcadores || marcadores.length === 0) {
              await retryWithBackoff(() => Atividade.create({
                etapa: atividadeOriginal.etapa, disciplina: atividadeOriginal.disciplina,
                subdisciplina: atividadeOriginal.subdisciplina,
                atividade: `(Concluída na folha ${doc?.numero || docId}) ${atividadeOriginal.atividade}`,
                empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0,
              }), 3, 500, `criarMarcSemPlano-${docId}-${atividadeId}`);
            }
          }
          totalConcluidos++;
        }
      }
    }

    await fetchData();
    if (onUpdate) onUpdate();
    alert(`✅ Etapa "${etapa}" concluída!\n${totalConcluidos} planejamento(s) concluído(s).${jaFinalizados > 0 ? `\n${jaFinalizados} já estava(m) finalizado(s).` : ''}`);
    setEtapaParaConcluir('');
  } catch (error) {
    alert("Erro ao concluir etapa: " + error.message);
  } finally {
    setIsConcluindoEtapa(false);
  }
}

export async function concluirEmTodasFolhas({
  atividade, empreendimentoId, documentos, setIsConcluindo, fetchData, onUpdate
}) {
  const atividadeId = atividade.base_atividade_id || atividade.id;
  if (!window.confirm(`Tem certeza que deseja CONCLUIR a atividade "${atividade.atividade}" em TODAS as folhas?`)) return;
  setIsConcluindo(prev => ({ ...prev, [atividadeId]: true }));
  try {
    const plans = await retryWithBackoff(() => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, atividade_id: atividadeId }), 3, 500, `getConcluirPlanejamentos-${atividadeId}`);
    const hoje = format(new Date(), 'yyyy-MM-dd');
    let concluidos = 0; let jaFinalizados = 0;
    if (plans.length === 0) {
      const atividadeOriginalArr = await retryWithBackoff(() => Atividade.filter({ id: atividadeId }), 3, 500, `getOriginalActivity-${atividadeId}`);
      if (!atividadeOriginalArr || atividadeOriginalArr.length === 0) throw new Error("Atividade original não encontrada.");
      const atividadeOriginal = atividadeOriginalArr[0];
      const documentosComAtividade = documentos.filter(doc => doc.disciplina === atividadeOriginal.disciplina && (doc.subdisciplinas || []).includes(atividadeOriginal.subdisciplina));
      for (const doc of documentosComAtividade) {
        await retryWithBackoff(() => PlanejamentoAtividade.create({ empreendimento_id: empreendimentoId, atividade_id: atividadeId, documento_id: doc.id, etapa: atividadeOriginal.etapa, descritivo: atividadeOriginal.atividade, tempo_planejado: atividadeOriginal.tempo || 0, status: 'concluido', termino_real: hoje, horas_por_dia: {} }), 3, 500, `createConcludedPlan-${doc.id}-${atividadeId}`);
        // Criar marcador
        const marcadores = await retryWithBackoff(() => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: doc.id, tempo: 0 }), 3, 500, `checkMarcConcluir-${doc.id}`);
        if (!marcadores || marcadores.length === 0) {
          await retryWithBackoff(() => Atividade.create({ etapa: atividadeOriginal.etapa, disciplina: atividadeOriginal.disciplina, subdisciplina: atividadeOriginal.subdisciplina, atividade: `(Concluída na folha ${doc.numero}) ${atividadeOriginal.atividade}`, empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: doc.id, tempo: 0 }), 3, 500, `criarMarcConcluir-${doc.id}`);
        }
        concluidos++;
      }
    } else {
      for (const plano of plans) {
        if (plano.status === 'concluido') { jaFinalizados++; continue; }
        await retryWithBackoff(() => PlanejamentoAtividade.update(plano.id, { status: 'concluido', termino_real: hoje }), 3, 500, `concluirPlan-${plano.id}`);
        // Criar marcador se houver documento vinculado
        if (plano.documento_id) {
          const doc = documentos.find(d => d.id === plano.documento_id);
          const marcadores = await retryWithBackoff(() => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: plano.documento_id, tempo: 0 }), 3, 500, `checkMarcUpdate-${plano.documento_id}`);
          if (!marcadores || marcadores.length === 0) {
            await retryWithBackoff(() => Atividade.create({ etapa: plano.etapa || '', disciplina: atividade.disciplina || '', subdisciplina: atividade.subdisciplina || '', atividade: `(Concluída na folha ${doc?.numero || plano.documento_id}) ${plano.descritivo || atividade.atividade || ''}`, empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: plano.documento_id, tempo: 0 }), 3, 500, `criarMarcUpdate-${plano.documento_id}`);
          }
        }
        concluidos++;
      }
    }
    await fetchData(); if (onUpdate) onUpdate();
    alert(`✅ Atividade "${atividade.atividade}" concluída!\n• ${concluidos} planejamento(s) concluído(s)${jaFinalizados > 0 ? `\n• ${jaFinalizados} já finalizado(s)` : ''}`);
  } catch (error) {
    alert("Erro ao concluir atividade: " + error.message);
  } finally {
    setIsConcluindo(prev => ({ ...prev, [atividadeId]: false }));
  }
}

export async function reverterEmTodasFolhas({
  atividade, empreendimentoId, setIsConcluindo, fetchData, onUpdate
}) {
  const atividadeId = atividade.base_atividade_id || atividade.id;
  if (!window.confirm(`Reverter conclusão de "${atividade.atividade}" em todas as folhas?`)) return;
  setIsConcluindo(prev => ({ ...prev, [atividadeId]: true }));
  try {
    const plans = await retryWithBackoff(
      () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, atividade_id: atividadeId }),
      3, 500, `getReverterPlanejamentos-${atividadeId}`
    );
    for (const plano of plans) {
      if (plano.inicio_planejado && plano.termino_planejado) {
        await retryWithBackoff(() => PlanejamentoAtividade.update(plano.id, { status: 'nao_iniciado', termino_real: null }), 3, 500, `reverterPlano-${plano.id}`);
      } else {
        await retryWithBackoff(() => PlanejamentoAtividade.delete(plano.id), 3, 500, `deletarPlanoReverter-${plano.id}`);
      }
    }
    // Remover marcadores de conclusão
    const marcadores = await retryWithBackoff(
      () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, tempo: 0 }),
      3, 500, `getMarcadoresReverterAtiv-${atividadeId}`
    );
    for (const m of (marcadores || [])) {
      await retryWithBackoff(() => Atividade.delete(m.id), 3, 500, `deletarMarcadorReverterAtiv-${m.id}`);
    }
    await fetchData();
    if (onUpdate) onUpdate();
  } catch (error) {
    alert("Erro ao reverter conclusão: " + error.message);
  } finally {
    setIsConcluindo(prev => ({ ...prev, [atividadeId]: false }));
  }
}

export async function reverterConclusaoEtapa({
  etapa, empreendimentoId, atividadesAgrupadas,
  setIsRevertendoEtapa, setEtapaParaReverter, fetchData, onUpdate
}) {
  if (!etapa) { alert("Selecione uma etapa para reverter."); return; }

  const atividadesDaEtapa = atividadesAgrupadas.filter(grupo =>
    grupo.baseAtividade.etapa === etapa && !grupo.baseAtividade.isEditable
  );
  if (atividadesDaEtapa.length === 0) { alert(`Nenhuma atividade encontrada para a etapa "${etapa}".`); return; }
  if (!window.confirm(`Tem certeza que deseja REVERTER a conclusão de todas as atividades da etapa "${etapa}"?\n\nTodas as atividades concluídas voltarão ao status "não iniciado".`)) return;

  setIsRevertendoEtapa(true);
  try {
    let totalRevertidos = 0;
    for (const grupo of atividadesDaEtapa) {
      const atividadeId = grupo.baseAtividade.base_atividade_id || grupo.baseAtividade.id;
      const planejamentosAtividade = await retryWithBackoff(
        () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, atividade_id: atividadeId }),
        3, 500, `getPlanejamentos-${atividadeId}`
      );
      for (const plano of planejamentosAtividade) {
        if (plano.status === 'concluido') {
          await retryWithBackoff(
            () => PlanejamentoAtividade.update(plano.id, { status: 'nao_iniciado', termino_real: null }),
            3, 500, `reverterPlan-${plano.id}`
          );
          totalRevertidos++;
        }
      }
      // Remover marcadores de conclusão ao reverter
      const marcadores = await retryWithBackoff(
        () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, tempo: 0 }),
        3, 500, `getMarcadoresReverter-${atividadeId}`
      );
      for (const m of (marcadores || [])) {
        await retryWithBackoff(() => Atividade.delete(m.id), 3, 500, `deletarMarcadorReverter-${m.id}`);
      }
    }
    await fetchData();
    if (onUpdate) onUpdate();
    alert(`✅ Conclusão da etapa "${etapa}" revertida!\n\n${totalRevertidos} planejamento(s) voltou(aram) para "não iniciado".`);
    setEtapaParaReverter('');
  } catch (error) {
    alert("Erro ao reverter conclusão da etapa: " + error.message);
  } finally {
    setIsRevertendoEtapa(false);
  }
}