import { PlanejamentoAtividade, PlanejamentoDocumento } from '@/entities/all';
import { retryWithBackoff } from './apiUtils';
import { format, addDays, parseISO } from 'date-fns';

/**
 * Realoca automaticamente atividades do dia seguinte quando sobram horas no dia atual
 * @param {string} executorEmail - Email do executor
 * @param {string} diaAtual - Data atual no formato 'yyyy-MM-dd'
 * @param {number} horasLiberadas - Quantidade de horas liberadas
 * @returns {Array} Lista de atividades realocadas
 */
export const realocarAtividadesDoDiaSeguinte = async (executorEmail, diaAtual, horasLiberadas) => {
  if (horasLiberadas <= 0.1) {
    console.log('ℹ️ Menos de 0.1h liberadas, não vale a pena realocar');
    return [];
  }

  console.log(`\n🔄 ========================================`);
  console.log(`🔄 REALOCAÇÃO AUTOMÁTICA INTELIGENTE`);
  console.log(`   Executor: ${executorEmail}`);
  console.log(`   Dia atual: ${diaAtual}`);
  console.log(`   Horas liberadas: ${horasLiberadas.toFixed(2)}h`);
  console.log(`🔄 ========================================\n`);

  try {
    const diaSeguinte = format(addDays(parseISO(diaAtual), 1), 'yyyy-MM-dd');
    
    console.log(`📅 Buscando atividades do dia ${diaSeguinte} para antecipar...`);

    // Buscar TODAS as atividades do executor que não estão concluídas
    const [planosAtividade, planosDocumento] = await Promise.all([
      retryWithBackoff(
        () => PlanejamentoAtividade.filter({
          executor_principal: executorEmail,
          status: { $ne: 'concluido' }
        }),
        3, 1000, 'realocar.buscarAtividades'
      ),
      retryWithBackoff(
        () => PlanejamentoDocumento.filter({
          executor_principal: executorEmail,
          status: { $ne: 'concluido' }
        }),
        3, 1000, 'realocar.buscarDocumentos'
      )
    ]);

    const todosPlanos = [
      ...(planosAtividade || []).map(p => ({ ...p, tipo_planejamento: 'atividade' })),
      ...(planosDocumento || []).map(p => ({ ...p, tipo_planejamento: 'documento' }))
    ];

    // Filtrar apenas atividades que TÊM horas no dia seguinte
    const candidatas = todosPlanos
      .filter(p => {
        const horasDiaSeguinte = Number(p.horas_por_dia?.[diaSeguinte]) || 0;
        return horasDiaSeguinte > 0.05; // Mínimo de 0.05h para valer a pena
      })
      .sort((a, b) => {
        // 1. Prioridade maior primeiro
        const prioA = a.prioridade || 1;
        const prioB = b.prioridade || 1;
        if (prioA !== prioB) return prioB - prioA;
        
        // 2. Atividades com menos horas primeiro (mais fácil de completar)
        const horasA = Number(a.horas_por_dia?.[diaSeguinte]) || 0;
        const horasB = Number(b.horas_por_dia?.[diaSeguinte]) || 0;
        return horasA - horasB;
      });

    console.log(`   ✅ Encontradas ${candidatas.length} atividades candidatas para antecipar`);

    if (candidatas.length === 0) {
      console.log(`   ℹ️ Nenhuma atividade disponível no dia seguinte`);
      return [];
    }

    let horasDisponiveis = horasLiberadas;
    const realocadas = [];

    for (const atividade of candidatas) {
      if (horasDisponiveis <= 0.05) break; // Para quando sobrar menos de 0.05h

      const horasNoDiaSeguinte = Number(atividade.horas_por_dia[diaSeguinte]) || 0;
      
      if (horasNoDiaSeguinte <= 0.05) continue;

      // Mover no máximo as horas disponíveis
      const horasParaMover = Math.min(horasNoDiaSeguinte, horasDisponiveis);
      
      const nomeAtividade = atividade.descritivo || 
                           atividade.atividade?.atividade || 
                           atividade.documento?.numero_completo || 
                           'Atividade';

      console.log(`\n   📋 Antecipando: ${nomeAtividade}`);
      console.log(`      ID: ${atividade.id}`);
      console.log(`      Horas no dia seguinte: ${horasNoDiaSeguinte.toFixed(2)}h`);
      console.log(`      Horas a antecipar: ${horasParaMover.toFixed(2)}h`);
      console.log(`      Horas_por_dia ANTES:`, atividade.horas_por_dia);

      // **CRÍTICO**: Criar uma CÓPIA do objeto horas_por_dia
      const novasHorasPorDia = { ...atividade.horas_por_dia };
      
      // ADICIONAR horas no dia atual (antecipar)
      const horasAtuaisHoje = Number(novasHorasPorDia[diaAtual]) || 0;
      novasHorasPorDia[diaAtual] = Number((horasAtuaisHoje + horasParaMover).toFixed(2));
      
      // REMOVER/REDUZIR horas do dia seguinte
      const novasHorasDiaSeguinte = horasNoDiaSeguinte - horasParaMover;
      
      if (novasHorasDiaSeguinte > 0.05) {
        // Se ainda sobrar tempo significativo, manter no dia seguinte
        novasHorasPorDia[diaSeguinte] = Number(novasHorasDiaSeguinte.toFixed(2));
        console.log(`      ⚠️ Mantendo ${novasHorasDiaSeguinte.toFixed(2)}h no dia seguinte`);
      } else {
        // Se sobrar muito pouco, remove completamente do dia seguinte
        delete novasHorasPorDia[diaSeguinte];
        console.log(`      🗑️ Removendo completamente do dia seguinte (resto muito pequeno)`);
      }

      console.log(`      Horas_por_dia DEPOIS:`, novasHorasPorDia);

      // **VALIDAÇÃO**: Garantir que a atividade tem pelo menos um dia com horas
      const diasComHoras = Object.keys(novasHorasPorDia).filter(dia => {
        const horas = Number(novasHorasPorDia[dia]) || 0;
        return horas > 0;
      });

      if (diasComHoras.length === 0) {
        console.error(`      ❌ ERRO: Atividade ficaria sem nenhum dia alocado! Abortando realocação desta atividade.`);
        continue; // Pular esta atividade
      }

      // Recalcular datas de início e término
      const diasAlocados = Object.keys(novasHorasPorDia).sort();
      const novoInicio = diasAlocados[0];
      const novoTermino = diasAlocados[diasAlocados.length - 1];

      console.log(`      📅 Nova data início: ${novoInicio}`);
      console.log(`      📅 Nova data término: ${novoTermino}`);
      console.log(`      📊 Total de dias alocados: ${diasAlocados.length}`);

      const updateData = {
        horas_por_dia: novasHorasPorDia,
        inicio_planejado: novoInicio,
        termino_planejado: novoTermino
      };

      const entityToUpdate = atividade.tipo_planejamento === 'documento' 
        ? PlanejamentoDocumento 
        : PlanejamentoAtividade;

      console.log(`      💾 Atualizando ${atividade.tipo_planejamento} no banco...`);

      await retryWithBackoff(
        () => entityToUpdate.update(atividade.id, updateData),
        3, 1000, `realocar.update-${atividade.id}`
      );

      console.log(`      ✅ Atualização confirmada no banco!`);

      realocadas.push({
        nome: nomeAtividade,
        horas: horasParaMover,
        tipo: atividade.tipo_planejamento,
        diaAnterior: diaSeguinte,
        novaData: diaAtual
      });

      horasDisponiveis -= horasParaMover;
      
      console.log(`      ✅ Antecipação concluída!`);
      console.log(`      Horas ainda disponíveis: ${horasDisponiveis.toFixed(2)}h`);
    }

    console.log(`\n✅ ========================================`);
    console.log(`✅ REALOCAÇÃO CONCLUÍDA COM SUCESSO`);
    console.log(`   Total antecipado: ${realocadas.length} atividade(s)`);
    console.log(`   Horas ainda disponíveis: ${horasDisponiveis.toFixed(2)}h`);
    
    if (realocadas.length > 0) {
      console.log(`\n   📋 Atividades movidas:`);
      realocadas.forEach((ativ, idx) => {
        console.log(`   ${idx + 1}. ${ativ.nome}`);
        console.log(`      De: ${ativ.diaAnterior} → Para: ${ativ.novaData}`);
        console.log(`      Horas: ${ativ.horas.toFixed(2)}h`);
      });
    }
    
    console.log(`✅ ========================================\n`);

    return realocadas;

  } catch (error) {
    console.error('❌ ========================================');
    console.error('❌ ERRO na realocação automática:', error);
    console.error('❌ Stack:', error.stack);
    console.error('❌ ========================================');
    return [];
  }
};