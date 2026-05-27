// @ts-nocheck
/**
 * Handlers do AnaliticoGlobalTab
 * Extraídos para reduzir o tamanho do arquivo principal
 */
import { Atividade, PlanejamentoAtividade } from '@/entities/all';
import { retryWithBackoff, retryWithExtendedBackoff } from '../utils/apiUtils';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { isValid, parseISO } from 'date-fns';
import { addDays } from 'date-fns';
import { getNextWorkingDay, distribuirHorasPorDias, isWorkingDay, calculateEndDate, ensureWorkingDay } from '../utils/DateCalculator';

export const handleSaveExecutorHandler = async ({ atividade, executorEmail, dataInicioCustom, empreendimentoId, documentos, combinedActivities, setCombinedActivities, setPlanejamentos, setIsSavingExecutor, atividadeId }) => {
  setIsSavingExecutor(prev => ({ ...prev, [atividadeId]: true }));
  
  try {
    // Buscar atividade original
    const atividadeOriginalArr = await retryWithBackoff(
      () => Atividade.filter({ id: atividadeId }),
      3, 500, `getOriginalActivity-${atividadeId}`
    );
    
    if (!atividadeOriginalArr || atividadeOriginalArr.length === 0) {
      throw new Error("Atividade original não encontrada.");
    }
    
    const atividadeOriginal = atividadeOriginalArr[0];
    // Verificar se já existe override global para esta atividade
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
    
    // Se não há executor, remover planejamentos existentes
    if (!executorEmail) {
      // Buscar e remover planejamentos desta atividade
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
      
      // Atualizar combinedActivities de forma otimista e completa
      setCombinedActivities(prev => prev.map(ativ => {
        if (ativ.base_atividade_id === atividadeId || ativ.id === atividadeId) {
          return { ...ativ, executor_principal: null, status: 'Disponível' };
        }
        return ativ;
      }));

      // Remover os planejamentos desta atividade do estado imediatamente
      const idsRemovidos = new Set((planejamentosParaRemover || []).map(p => p.id));
      setPlanejamentos(prev => prev.filter(p => !idsRemovidos.has(p.id)));
      return;
    }
    
    return { sucesso: true, atividadeOriginal };
  } catch (error) {
    console.error("Erro no handleSaveExecutor:", error);
    throw error;
  } finally {
    setIsSavingExecutor(prev => ({ ...prev, [atividadeId]: false }));
  }
};

export const handleReverterAtividadeHandler = async ({ atividadeId, empreendimentoId, fetchData, onUpdate }) => {
  // atividadeId aqui é o base_atividade_id (ID da atividade do catálogo)
  const { reverterAtividades } = await import('./AnaliticoHandlers');
  reverterAtividades({ atividadeIds: [atividadeId], empreendimentoId, fetchData, onUpdate });
};