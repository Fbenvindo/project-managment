// @ts-nocheck
/**
 * Handlers do AnaliticoGlobalTab
 * Extraídos para reduzir o tamanho do arquivo principal
 */
import { Atividade, PlanejamentoAtividade, PlanejamentoDocumento } from '@/entities/all';
import { retryWithBackoff, retryWithExtendedBackoff } from '../utils/apiUtils';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { isValid, parseISO } from 'date-fns';
import { addDays } from 'date-fns';
import { getNextWorkingDay, distribuirHorasPorDias, isWorkingDay, calculateEndDate, ensureWorkingDay } from '../utils/DateCalculator';

export async function handleSaveExecutorHandler({
  atividade,
  executorEmail,
  dataInicioCustom,
  empreendimentoId,
  documentos,
  setIsSavingExecutor,
  atividadeId,
  setCombinedActivities,
  setPlanejamentos,
  combinedActivities,
  fetchData
}) {
  try {
    const atividadeOriginalArr = await retryWithBackoff(
      () => Atividade.filter({ id: atividadeId }),
      3, 500, `getOriginalActivity-${atividadeId}`
    );
    
    if (!atividadeOriginalArr || atividadeOriginalArr.length === 0) {
      throw new Error("Atividade original não encontrada.");
    }
    
    const atividadeOriginal = atividadeOriginalArr[0];
    const existingOverrides = await retryWithBackoff(
      () => Atividade.filter({
        empreendimento_id: empreendimentoId,
        id_atividade: atividadeId,
        documento_id: null,
        tempo: { operator: '!=', value: -999 }
      }),
      3, 500, `checkExistingExecutorOverride-${atividadeId}`
    );
    
    if (existingOverrides && existingOverrides.length > 0) {
      await retryWithBackoff(() => Atividade.update(existingOverrides[0].id, { executor_principal: executorEmail || null }), 3, 500, `updateExecutorOverride-${existingOverrides[0].id}`);
    } else if (executorEmail) {
      await retryWithBackoff(() => Atividade.create({ ...atividadeOriginal, id: undefined, empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: null, executor_principal: executorEmail }), 3, 500, `createExecutorOverride-${atividadeId}`);
    }
    
    if (!executorEmail) {
      const planejamentosParaRemover = await retryWithBackoff(
        () => PlanejamentoAtividade.filter({
          empreendimento_id: empreendimentoId,
          atividade_id: atividadeId
        }),
        3, 500, `getPlanejamentosParaRemover-${atividadeId}`
      );
      
      if (planejamentosParaRemover && planejamentosParaRemover.length > 0) {
        await Promise.all(
          planejamentosParaRemover.map(p => 
            retryWithBackoff(
              () => PlanejamentoAtividade.delete(p.id),
              3, 500, `deletePlan-${p.id}`
            )
          )
        );
      }
      
      setCombinedActivities(prev => prev.map(ativ => {
        if (ativ.base_atividade_id === atividadeId || ativ.id === atividadeId) {
          return { ...ativ, executor_principal: null, status: 'Disponível' };
        }
        return ativ;
      }));

      const idsRemovidos = new Set((planejamentosParaRemover || []).map(p => p.id));
      setPlanejamentos(prev => prev.filter(p => !idsRemovidos.has(p.id)));
      return;
    }
    
    const [planosAtividade, planosDocumento] = await Promise.all([
      retryWithExtendedBackoff(
        () => PlanejamentoAtividade.filter({ executor_principal: executorEmail }),
        'loadAllPlansAtividade'
      ),
      retryWithExtendedBackoff(
        () => PlanejamentoDocumento.filter({ executor_principal: executorEmail }),
        'loadAllPlansDocumento'
      )
    ]);
    
    const todosOsPlanos = [...(planosAtividade || []), ...(planosDocumento || [])];
    const hoje = new Date();
    const hojeMidnight = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const cargaDiaria = {};

    todosOsPlanos.forEach((plano) => {
      if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') {
        Object.entries(plano.horas_por_dia).forEach(([data, horas]) => {
          try {
            const dataObj = parseISO(data);
            if (isValid(dataObj) && dataObj >= hojeMidnight) {
              const diaKey = format(dataObj, 'yyyy-MM-dd');
              const horasValidas = Number(horas) || 0;
              
              if (horasValidas > 0 && horasValidas <= 12) {
                cargaDiaria[diaKey] = (cargaDiaria[diaKey] || 0) + horasValidas;
              }
            }
          } catch (erro) {
            console.warn(`Erro ao processar data ${data}:`, erro);
          }
        });
      }
    });
    
    const docIdsVinculados = atividade.documento_ids?.length > 0 ? atividade.documento_ids : (atividade.documento_id ? [atividade.documento_id] : null);
    const documentosComAtividade = docIdsVinculados ? documentos.filter(doc => docIdsVinculados.includes(doc.id)) : documentos.filter(doc => doc.disciplina === atividadeOriginal.disciplina && (doc.subdisciplinas || []).includes(atividadeOriginal.subdisciplina));
    
    let planejamentosCriados = 0;
    let planejamentosJaExistentes = 0;
    
    if (documentosComAtividade.length === 0) {
      const planejamentosExistentes = await retryWithBackoff(
        () => PlanejamentoAtividade.filter({
          empreendimento_id: empreendimentoId,
          atividade_id: atividadeId,
          documento_id: null
        }),
        3, 500, `checkExistingGeneralPlan-${atividadeId}`
      );
      
      if (planejamentosExistentes && planejamentosExistentes.length > 0) {
        await retryWithBackoff(() => PlanejamentoAtividade.update(planejamentosExistentes[0].id, { executor_principal: executorEmail, executores: [executorEmail] }), 3, 500, `updateGeneralPlanExecutor-${planejamentosExistentes[0].id}`);
        planejamentosJaExistentes++;
      } else {
        const tempoCalculado = atividadeOriginal.tempo || 0;
        let dataInicio = dataInicioCustom ? new Date(dataInicioCustom) : new Date(hojeMidnight);
        
        if (dataInicioCustom) {
          if (!isWorkingDay(dataInicio)) dataInicio = getNextWorkingDay(dataInicio);
        } else {
          let t = 0;
          while (t < 365) { if (isWorkingDay(dataInicio) && (8 - (cargaDiaria[format(dataInicio,'yyyy-MM-dd')] || 0)) >= 0.5) break; dataInicio = addDays(dataInicio, 1); t++; }
          if (t >= 365) throw new Error(`Não foi possível encontrar data disponível.`);
        }
        const resultadoDistribuicao = distribuirHorasPorDias(dataInicio, tempoCalculado, 8, cargaDiaria, false);
        if (!resultadoDistribuicao?.distribuicao || !Object.keys(resultadoDistribuicao.distribuicao).length) throw new Error(`Não foi possível distribuir as horas.`);
        const { distribuicao, dataTermino } = resultadoDistribuicao;
        const diasUtilizados = Object.keys(distribuicao).sort();
        await retryWithBackoff(() => PlanejamentoAtividade.create({ empreendimento_id: empreendimentoId, atividade_id: atividadeId, documento_id: null, etapa: atividadeOriginal.etapa, descritivo: atividadeOriginal.atividade, tempo_planejado: tempoCalculado, executor_principal: executorEmail, executores: [executorEmail], inicio_planejado: diasUtilizados[0], termino_planejado: format(dataTermino, 'yyyy-MM-dd'), horas_por_dia: distribuicao, status: 'nao_iniciado' }), 3, 500, `createGeneralPlan-${atividadeId}`);
        planejamentosCriados++;
      }
    } else {
      for (const doc of documentosComAtividade) {
        const planejamentosExistentes = await retryWithBackoff(
          () => PlanejamentoAtividade.filter({
            empreendimento_id: empreendimentoId,
            atividade_id: atividadeId,
            documento_id: doc.id
          }),
          3, 500, `checkExistingPlan-${doc.id}-${atividadeId}`
        );
        
        if (planejamentosExistentes && planejamentosExistentes.length > 0) {
          await retryWithBackoff(() => PlanejamentoAtividade.update(planejamentosExistentes[0].id, { executor_principal: executorEmail, executores: [executorEmail] }), 3, 500, `updatePlanExecutor-${planejamentosExistentes[0].id}`);
          planejamentosJaExistentes++;
        } else {
          const fatorDificuldade = atividade.isEditable ? 1 : (doc.fator_dificuldade || 1);
          const tempoCalculado = (atividadeOriginal.tempo || 0) * fatorDificuldade;
          let dataInicio = dataInicioCustom ? new Date(dataInicioCustom) : new Date(hojeMidnight);
          if (dataInicioCustom) { if (!isWorkingDay(dataInicio)) dataInicio = getNextWorkingDay(dataInicio); }
          else { let t = 0; while (t < 365) { if (isWorkingDay(dataInicio) && (8 - (cargaDiaria[format(dataInicio,'yyyy-MM-dd')] || 0)) >= 0.5) break; dataInicio = addDays(dataInicio, 1); t++; } if (t >= 365) throw new Error(`Sem data disponível.`); }
          const resultadoDistribuicao = distribuirHorasPorDias(dataInicio, tempoCalculado, 8, cargaDiaria, false);
          if (!resultadoDistribuicao?.distribuicao || !Object.keys(resultadoDistribuicao.distribuicao).length) throw new Error(`Não foi possível distribuir as horas.`);
          const { distribuicao, dataTermino, novaCargaDiaria } = resultadoDistribuicao;
          const diasUtilizados = Object.keys(distribuicao).sort();
          await retryWithBackoff(() => PlanejamentoAtividade.create({ empreendimento_id: empreendimentoId, atividade_id: atividadeId, documento_id: doc.id, etapa: atividadeOriginal.etapa, descritivo: atividadeOriginal.atividade, tempo_planejado: tempoCalculado, executor_principal: executorEmail, executores: [executorEmail], inicio_planejado: diasUtilizados[0], termino_planejado: format(dataTermino, 'yyyy-MM-dd'), horas_por_dia: distribuicao, status: 'nao_iniciado' }), 3, 500, `createPlan-${doc.id}-${atividadeId}`);
          planejamentosCriados++;
          
          Object.assign(cargaDiaria, novaCargaDiaria);
        }
      }
    }
    
    setCombinedActivities(prev => {
      return prev.map(ativ => {
        if (ativ.base_atividade_id === atividadeId || ativ.id === atividadeId) {
          return { 
            ...ativ, 
            executor_principal: executorEmail,
            status: executorEmail ? 'Planejada' : 'Disponível'
          };
        }
        return ativ;
      });
    });
    
    setTimeout(() => {
      retryWithBackoff(
        () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId }),
        3, 500, 'refreshPlanejamentosOnly'
      ).then(planejamentosAtualizados => {
        setPlanejamentos(planejamentosAtualizados || []);
      }).catch(err => {
        console.warn("Erro ao atualizar planejamentos em background:", err);
      });
    }, 100);
    
  } catch (error) {
    alert("Erro ao salvar executor e criar planejamentos: " + error.message);
    setIsSavingExecutor(prev => ({ ...prev, [atividadeId]: false }));
  } finally {
    setIsSavingExecutor(prev => ({ ...prev, [atividadeId]: false }));
  }
}