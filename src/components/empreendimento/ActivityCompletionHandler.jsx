import { retryWithBackoff } from '@/components/utils/apiUtils';
import { base44 } from '@/api/base44Client';

export const createActivityCompletionHandler = (empreendimento, doc, onUpdate) => {
  return async (activityObj) => {
    try {
      const agora = new Date().toISOString();
      const idParaFiltro = activityObj.id_atividade || activityObj.id;

      const atividadesEmp = await retryWithBackoff(
        () => base44.entities.AtividadesEmpreendimento.filter({
          empreendimento_id: empreendimento.id,
          id_atividade: idParaFiltro,
          documento_id: doc.id
        }),
        3, 1000, `checkAtividadeEmpStatus-${activityObj.id}-${doc.id}`
      );
      
      if (atividadesEmp && atividadesEmp.length > 0) {
        for (const atividadeEmp of atividadesEmp) {
          const isConcluida = atividadeEmp.status_planejamento === 'concluida';
          await retryWithBackoff(
            () => base44.entities.AtividadesEmpreendimento.update(atividadeEmp.id, {
              status_planejamento: isConcluida ? 'nao_planejada' : 'concluida',
              data_conclusao: isConcluida ? null : agora
            }),
            3, 1000, `updateAtividadeEmpStatus-${atividadeEmp.id}`
          );
        }
      }
      await onUpdate();
    } catch (error) {
      console.error("❌ Erro ao marcar atividade como concluída:", error);
      alert("Erro ao atualizar o status da atividade: " + error.message);
    }
  };
};