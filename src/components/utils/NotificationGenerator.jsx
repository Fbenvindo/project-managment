import { useEffect, useContext } from 'react';
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import { NotificacaoAtividade, AtividadeFuncao, Usuario } from '@/entities/all';
import { retryWithBackoff } from './apiUtils';
import { format, startOfWeek, isFriday } from 'date-fns';
import { base44 } from '@/api/base44Client';

/**
 * Hook que verifica e cria notificações de atividades ocasionais
 * quando o usuário acessa o sistema às sextas-feiras
 */
export default function NotificationGenerator() {
  const { user } = useContext(ActivityTimerContext);

  useEffect(() => {
    if (!user?.email || !user?.cargo) return;

    const gerarNotificacoes = async () => {
      try {
        const hoje = new Date();
        
        // Só processar às sextas-feiras
        if (!isFriday(hoje)) {
          return;
        }

        const inicioDaSemana = format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const hojeStr = format(hoje, 'yyyy-MM-dd');

        // Verificar se já existe notificação para este usuário nesta semana
        const notificacoesExistentes = await retryWithBackoff(
          () => NotificacaoAtividade.filter({
            usuario_email: user.email,
            data_notificacao: { $gte: inicioDaSemana }
          }),
          3, 1000, 'checkExistingNotifications'
        );

        if (notificacoesExistentes && notificacoesExistentes.length > 0) {
          console.log('✅ Notificações já criadas esta semana para', user.email);
          return;
        }

        // Buscar atividades ocasionais para o cargo do usuário
        const atividadesOcasionais = await retryWithBackoff(
          () => AtividadeFuncao.filter({
            funcao: user.cargo,
            frequencia: 'ocasional'
          }),
          3, 1000, 'getOccasionalActivities'
        );

        if (!atividadesOcasionais || atividadesOcasionais.length === 0) {
          console.log('ℹ️ Nenhuma atividade ocasional encontrada para o cargo:', user.cargo);
          return;
        }

        // Buscar o email de notificação do usuário
        let emailDestino = user.email;
        try {
          const usuariosCadastrados = await retryWithBackoff(
            () => Usuario.filter({ email: user.email }, null, 1),
            3, 1000, 'getUsuarioPerfil'
          );
          if (usuariosCadastrados?.[0]?.email_notificacao) {
            emailDestino = usuariosCadastrados[0].email_notificacao;
          }
        } catch (e) {
          console.warn('Não foi possível buscar email_notificacao, usando email padrão');
        }

        // Criar notificações para cada atividade ocasional
        const notificacoesCriadas = [];
        for (const atividade of atividadesOcasionais) {
          try {
            const novaNotificacao = await retryWithBackoff(
              () => NotificacaoAtividade.create({
                usuario_email: user.email,
                atividade_funcao_id: atividade.id,
                atividade_nome: atividade.atividade,
                tempo_estimado: atividade.tempo_estimado,
                status: 'pendente',
                data_notificacao: hojeStr
              }),
              3, 1000, 'createNotification'
            );
            notificacoesCriadas.push(novaNotificacao);
            console.log(`✅ Notificação criada: ${atividade.atividade} para ${user.email}`);
          } catch (error) {
            console.error(`❌ Erro ao criar notificação para ${atividade.atividade}:`, error);
          }
        }

        if (notificacoesCriadas.length > 0) {
          console.log(`🔔 ${notificacoesCriadas.length} notificação(ões) criada(s) para ${user.email}`);
          // Enviar email de notificação
          try {
            const nomeAtividades = notificacoesCriadas.map(n => `• ${n.atividade_nome} (${n.tempo_estimado}h)`).join('\n');
            await base44.integrations.Core.SendEmail({
              to: emailDestino,
              subject: `🔔 Atividades ocasionais para agendar esta semana`,
              body: `Olá${user.full_name ? `, ${user.full_name}` : ''}!\n\nVocê tem ${notificacoesCriadas.length} atividade(s) ocasional(is) para agendar esta semana:\n\n${nomeAtividades}\n\nAcesse o sistema para escolher quando deseja realizar cada atividade.\n\nAté mais!`
            });
            console.log(`📧 Email enviado para ${emailDestino}`);
          } catch (emailError) {
            console.error('❌ Erro ao enviar email de notificação:', emailError);
          }
        }

      } catch (error) {
        console.error('❌ Erro ao gerar notificações ocasionais:', error);
      }
    };

    // Executar após 2 segundos para dar tempo do sistema carregar
    const timer = setTimeout(gerarNotificacoes, 2000);

    return () => clearTimeout(timer);
  }, [user]);

  return null; // Componente invisível
}