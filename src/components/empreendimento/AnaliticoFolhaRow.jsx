import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, CheckCircle2, CheckCircle, Loader2, Calendar, CalendarPlus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PlanejamentoAtividade, Atividade } from '@/entities/all';
import { retryWithBackoff } from '../utils/apiUtils';
import PlanejamentoFolhaUnicaModal from './PlanejamentoFolhaUnicaModal';

export default function AnaliticoFolhaRow({
  folha,
  hasCheckboxColumn,
  planejamentos,
  atividadesSelecionadasParaExcluir,
  setAtividadesSelecionadasParaExcluir,
  empreendimentoId,
  onConcluirFolha,
  usuarios,
  atividade,
}) {
  const [isConc, setIsConc] = useState(false);
  const [showPlanejamentoModal, setShowPlanejamentoModal] = useState(false);

  const handleToggleConclusao = async () => {
    setIsConc(true);
    try {
      const isConcluida = folha.status === 'Concluída';
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const atividadeId = folha.base_atividade_id || folha.id;
      const docId = folha.source_documento_id;

      // buscar planejamento existente
      const planos = await retryWithBackoff(
        () => PlanejamentoAtividade.filter({
          empreendimento_id: empreendimentoId,
          atividade_id: atividadeId,
          documento_id: docId
        }),
        3, 500, `getPlanoFolha-${docId}-${atividadeId}`
      );

      if (isConcluida) {
        // reverter: atualizar PlanejamentoAtividade e remover marcador de conclusão no Documento
        if (planos.length > 0) {
          await retryWithBackoff(
            () => PlanejamentoAtividade.update(planos[0].id, { status: 'nao_iniciado', termino_real: null }),
            3, 500, `reverterFolha-${planos[0].id}`
          );
        }
        // Remover marcador de conclusão (tempo: 0) na entidade Atividade
        const marcadores = await retryWithBackoff(
          () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0 }),
          3, 500, `getMarcadorConclusao-${docId}-${atividadeId}`
        );
        for (const m of marcadores) {
          await retryWithBackoff(() => Atividade.delete(m.id), 3, 500, `deleteMarcadorConclusao-${m.id}`);
        }
      } else {
        // concluir: atualizar PlanejamentoAtividade
        if (planos.length > 0) {
          await retryWithBackoff(
            () => PlanejamentoAtividade.update(planos[0].id, { status: 'concluido', termino_real: hoje }),
            3, 500, `concluirFolha-${planos[0].id}`
          );
        } else {
          await retryWithBackoff(
            () => PlanejamentoAtividade.create({
              empreendimento_id: empreendimentoId,
              atividade_id: atividadeId,
              documento_id: docId,
              etapa: folha.etapa,
              descritivo: folha.atividade,
              tempo_planejado: folha.tempo || 0,
              status: 'concluido',
              termino_real: hoje,
              horas_por_dia: {}
            }),
            3, 500, `createConcluirFolha-${docId}-${atividadeId}`
          );
        }
        // Criar marcador de conclusão (tempo: 0) na entidade Atividade para o DocumentoItem exibir corretamente
        const marcadoresExistentes = await retryWithBackoff(
          () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0 }),
          3, 500, `checkMarcadorConclusao-${docId}-${atividadeId}`
        );
        if (!marcadoresExistentes || marcadoresExistentes.length === 0) {
          await retryWithBackoff(
            () => Atividade.create({
              etapa: folha.etapa,
              disciplina: folha.disciplina,
              subdisciplina: folha.subdisciplina,
              atividade: `(Concluída na folha ${folha.source_documento_numero || docId}) ${String(folha.atividade || '')}`,
              empreendimento_id: empreendimentoId,
              id_atividade: atividadeId,
              documento_id: docId,
              tempo: 0
            }),
            3, 500, `createMarcadorConclusao-${docId}-${atividadeId}`
          );
        }
      }

      if (onConcluirFolha) onConcluirFolha();
    } catch (err) {
      alert('Erro ao atualizar status da folha: ' + err.message);
    } finally {
      setIsConc(false);
    }
  };

  const plano = planejamentos?.find(p =>
    p.documento_id === folha.source_documento_id &&
    p.atividade_id === folha.base_atividade_id
  );
  const isConcluida = folha.status === 'Concluída';

  return (
    <>
    <TableRow key={folha.uniqueId} className={isConcluida ? 'bg-blue-50/80' : 'bg-blue-50/30'}>
      {hasCheckboxColumn && <TableCell></TableCell>}
      <TableCell className="pl-12">
        <ChevronRight className="w-3 h-3 text-gray-400 inline mr-1" />
      </TableCell>
      <TableCell className="text-sm text-gray-600 min-w-[220px]">
        <span className="font-medium text-blue-700">{folha.source_documento_numero}</span>
        {folha.source_documento_arquivo && <span className="ml-1">— {folha.source_documento_arquivo}</span>}
      </TableCell>
      <TableCell></TableCell>
      <TableCell>
        {isConcluida
          ? <Badge className="bg-blue-600 text-white font-semibold flex items-center gap-1 w-fit text-xs"><CheckCircle2 className="w-3 h-3"/>Concluída</Badge>
          : folha.status === 'Planejada'
            ? <Badge className="bg-green-600 text-white font-semibold shadow-md flex items-center gap-1 w-fit text-xs"><CheckCircle2 className="w-3 h-3"/>Planejada</Badge>
            : <Badge variant="outline" className="text-xs text-gray-600">{folha.status}</Badge>
        }
      </TableCell>
      <TableCell className="text-sm text-gray-500">{folha.etapa}</TableCell>
      <TableCell></TableCell>
      <TableCell>
        {(folha.status === 'Planejada' || isConcluida) && plano?.inicio_planejado && plano?.termino_planejado ? (
          <div className="flex items-center gap-1 text-gray-600 text-xs">
            <Calendar className="w-3 h-3" />
            <span>{format(parseISO(plano.inicio_planejado), 'dd/MM')} - {format(parseISO(plano.termino_planejado), 'dd/MM')}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </TableCell>
      <TableCell className="text-sm">{folha.tempo ? `${Number(folha.tempo).toFixed(1)}h` : '-'}</TableCell>
      <TableCell className="text-sm">{folha.tempo ? `${Number(folha.tempo).toFixed(1)}h` : '-'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {folha.status !== 'Planejada' && folha.status !== 'Concluída' && (
            <Button
              size="icon"
              variant="outline"
              onClick={() => setShowPlanejamentoModal(true)}
              title="Planejar esta folha"
              className="border-purple-400 text-purple-600 hover:bg-purple-50 h-7 w-7"
            >
              <CalendarPlus className="w-3 h-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            onClick={handleToggleConclusao}
            disabled={isConc}
            title={isConcluida ? 'Reverter conclusão desta folha' : 'Concluir esta folha'}
            className={isConcluida
              ? 'border-blue-500 text-blue-600 hover:bg-blue-50 h-7 w-7'
              : 'border-gray-300 text-gray-400 hover:border-green-500 hover:text-green-600 h-7 w-7'
            }
          >
            {isConc ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <Checkbox
          checked={atividadesSelecionadasParaExcluir.has(folha.base_atividade_id || folha.id)}
          onCheckedChange={(checked) => {
            setAtividadesSelecionadasParaExcluir(prev => {
              const newSet = new Set(prev);
              const id = folha.base_atividade_id || folha.id;
              if (checked) newSet.add(id); else newSet.delete(id);
              return newSet;
            });
          }}
        />
      </TableCell>
      <TableCell></TableCell>
    </TableRow>
    {showPlanejamentoModal && (
      <PlanejamentoFolhaUnicaModal
        isOpen={showPlanejamentoModal}
        onClose={() => setShowPlanejamentoModal(false)}
        folha={folha}
        atividade={atividade}
        usuarios={usuarios || []}
        empreendimentoId={empreendimentoId}
        onSuccess={() => { setShowPlanejamentoModal(false); if (onConcluirFolha) onConcluirFolha(); }}
      />
    )}
  </>
  );
}