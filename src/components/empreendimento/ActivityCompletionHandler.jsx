import { retryWithBackoff } from '@/components/utils/apiUtils';
import { base44 } from '@/api/base44Client';

export const createActivityCompletionHandler = (empreendimento, doc, onUpdate) => {
  return async (activityObj) => {
    console.log(`\n✅ ========================================`);
    console.log(`✅ MARCAR COMO CONCLUÍDA`);
    console.log(`✅ ========================================`);
    console.log(`   Objeto da atividade:`, activityObj);
    console.log(`   id: ${activityObj.id}`);
    console.log(`   id_atividade: ${activityObj.id_atividade}`);
    console.log(`   Atividade: "${activityObj.atividade}"`);
    console.log(`   Folha: ${doc.numero} (ID: ${doc.id})`);
    console.log(`   Empreendimento: ${empreendimento.id}`);
    console.log(`✅ ========================================\n`);

    try {
      const agora = new Date().toISOString();
      
      // Tentar ambos os IDs
      const idParaFiltro = activityObj.id_atividade || activityObj.id;
      
      console.log(`🔍 Buscando AtividadesEmpreendimento com:`);
      console.log(`   empreendimento_id: ${empreendimento.id}`);
      console.log(`   id_atividade: ${idParaFiltro}`);
      console.log(`   documento_id: ${doc.id}`);

      // Verificar registros em AtividadesEmpreendimento para esta atividade neste documento
      const atividadesEmp = await retryWithBackoff(
        () => base44.entities.AtividadesEmpreendimento.filter({
          empreendimento_id: empreendimento.id,
          id_atividade: idParaFiltro,
          documento_id: doc.id
        }),
        3, 1000, `checkAtividadeEmpStatus-${activityObj.id}-${doc.id}`
      );

      console.log(`📊 Resultado: ${atividadesEmp?.length || 0} registro(s) encontrado(s)`);
      
      if (atividadesEmp && atividadesEmp.length > 0) {
        console.log(`✅ Registros encontrados:`, atividadesEmp);
        
        // Atualizar status em AtividadesEmpreendimento
        for (const atividadeEmp of atividadesEmp) {
          const isConcluida = atividadeEmp.status_planejamento === 'concluida';
          
          const novoStatus = isConcluida ? 'nao_planejada' : 'concluida';
          const novaDataConclusao = isConcluida ? null : agora;

          console.log(`\n💾 Atualizando registro ID: ${atividadeEmp.id}`);
          console.log(`   Status atual: ${atividadeEmp.status_planejamento}`);
          console.log(`   Novo status: ${novoStatus}`);

          const resultado = await retryWithBackoff(
            () => base44.entities.AtividadesEmpreendimento.update(atividadeEmp.id, {
              status_planejamento: novoStatus,
              data_conclusao: novaDataConclusao
            }),
            3, 1000, `updateAtividadeEmpStatus-${atividadeEmp.id}`
          );
          
          console.log(`✅ Atualizado com sucesso:`, resultado);
        }
      } else {
        console.warn(`⚠️ Nenhum registro encontrado em AtividadesEmpreendimento com este filtro`);
      }

      // Recarregar dados para atualizar status visual
      console.log(`\n🔄 Recarregando dados...`);
      await onUpdate();
      console.log(`✅ Dados recarregados!`);
      
    } catch (error) {
      console.error("❌ Erro ao marcar atividade como concluída:", error);
      console.error("Stack:", error.stack);
      alert("Erro ao atualizar o status da atividade: " + error.message);
    }
  };
};