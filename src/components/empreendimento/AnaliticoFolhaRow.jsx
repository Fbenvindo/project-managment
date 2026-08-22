// @ts-nocheck
import React, { useState, useCallback, useMemo } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, ChevronDown, CheckCircle2, CheckCircle, Loader2, Calendar, CalendarPlus, Users2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { PlanejamentoAtividade, Atividade } from '@/entities/all';
import { retryWithBackoff } from '../utils/apiUtils';
import PlanejamentoFolhaUnicaModal from './PlanejamentoFolhaUnicaModal';

function AnaliticoFolhaRow({
  folha,
  hasCheckboxColumn,
  planejamentos,
  empreendimentoId,
  onConcluirFolha,
  usuarios,
  atividade,
  folhasSelecionadas = new Set(),
  setFolhasSelecionadas = () => {},
  isExpanded,
  onToggleExpand,
  handleSaveFolhaExecutor,
  isSavingFolhaExecutor,
}) {
  const [isConc, setIsConc] = useState(false);
  const [showPlanejamentoModal, setShowPlanejamentoModal] = useState(false);

  const isConcluida = folha.status === 'Concluída';
  const isSelected = folhasSelecionadas.has(folha.source_documento_id);

  const plano = useMemo(() =>
    planejamentos?.find(p =>
      p.documento_id === folha.source_documento_id &&
      p.atividade_id === folha.base_atividade_id
    ),
    [planejamentos, folha.source_documento_id, folha.base_atividade_id]
  );

  const executorNome = useMemo(() => {
    const executorEmail = plano?.executor_principal || folha.executor_principal;
    if (!executorEmail) return null;
    return (usuarios || []).find(u => u.email === executorEmail)?.nome || executorEmail;
  }, [plano?.executor_principal, folha.executor_principal, usuarios]);

  const handleToggleSelecao = useCallback((checked) => {
    setFolhasSelecionadas(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(folha.source_documento_id);
      else newSet.delete(folha.source_documento_id);
      return newSet;
    });
  }, [folha.source_documento_id, setFolhasSelecionadas]);

  const handleToggleConclusao = useCallback(async () => {
    setIsConc(true);
    try {
      const _isConcluida = folha.status === 'Concluída';
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const atividadeId = folha.base_atividade_id || folha.id;
      const docId = folha.source_documento_id;

      const planos = await retryWithBackoff(
        () => PlanejamentoAtividade.filter({
          empreendimento_id: empreendimentoId,
          atividade_id: atividadeId,
          documento_id: docId,
        }),
        3, 500, `getPlanoFolha-${docId}-${atividadeId}`
      );

      if (_isConcluida) {
        if (planos.length > 0) {
          await retryWithBackoff(
            () => PlanejamentoAtividade.update(planos[0].id, { status: 'nao_iniciado', termino_real: null }),
            3, 500, `reverterFolha-${planos[0].id}`
          );
        }
        const marcadores = await retryWithBackoff(
          () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0 }),
          3, 500, `getMarcadorConclusao-${docId}-${atividadeId}`
        );
        for (const m of marcadores) {
          await retryWithBackoff(() => Atividade.delete(m.id), 3, 500, `deleteMarcadorConclusao-${m.id}`);
        }
      } else {
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
              horas_por_dia: {},
            }),
            3, 500, `createConcluirFolha-${docId}-${atividadeId}`
          );
        }
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
              tempo: 0,
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
  }, [folha, empreendimentoId, onConcluirFolha]);

  const handleOpenModal = useCallback(() => setShowPlanejamentoModal(true), []);
  const handleCloseModal = useCallback(() => setShowPlanejamentoModal(false), []);
  const handleModalSuccess = useCallback(() => {
    setShowPlanejamentoModal(false);
    if (onConcluirFolha) onConcluirFolha();
  }, [onConcluirFolha]);

  return (
    <>
      <TableRow className={isConcluida ? 'bg-blue-50/80' : 'bg-blue-50/30'}>
        {hasCheckboxColumn && (
          <TableCell>
            <Checkbox checked={isSelected} onCheckedChange={handleToggleSelecao} />
          </TableCell>
        )}
        <TableCell className="pl-12">
          {onToggleExpand ? (
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={onToggleExpand} title={isExpanded ? 'Recolher atividade' : 'Expandir atividade'}>
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400 inline mr-1" />
          )}
        </TableCell>
        <TableCell className="text-sm text-gray-600 min-w-[220px]">
          <span className="font-medium text-blue-700">{folha.source_documento_numero}</span>
          {folha.source_documento_arquivo && <span className="ml-1">— {folha.source_documento_arquivo}</span>}
          {folha.source_documento_pavimento && <span className="block text-xs text-gray-400 mt-0.5">{folha.source_documento_pavimento}</span>}
        </TableCell>
        <TableCell></TableCell>
        <TableCell>
          {isConcluida
            ? <Badge className="bg-blue-600 text-white font-semibold flex items-center gap-1 w-fit text-xs"><CheckCircle2 className="w-3 h-3" />Concluída</Badge>
            : folha.status === 'Planejada'
              ? <Badge className="bg-green-600 text-white font-semibold shadow-md flex items-center gap-1 w-fit text-xs"><CheckCircle2 className="w-3 h-3" />Planejada</Badge>
              : <Badge variant="outline" className="text-xs text-gray-600">{folha.status}</Badge>
          }
        </TableCell>
        <TableCell className="text-sm text-gray-500">{folha.etapa}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Select
              value={folha.executor_principal || '__none__'}
              onValueChange={(value) => {
                const email = value === '__none__' ? '' : value;
                const planosComExecutor = planejamentos?.filter(p =>
                  p.documento_id === folha.source_documento_id &&
                  p.executor_principal &&
                  p.executor_principal !== email
                ) || [];
                if (email && planosComExecutor.length > 0) {
                  if (!confirm(`Existem ${planosComExecutor.length} atividade(s) neste documento com executor específico diferente. Deseja realmente alterar o executor da folha? Isso pode sobrescrever as atribuições por atividade.`)) return;
                }
                handleSaveFolhaExecutor?.(folha, email);
              }}
              disabled={isSavingFolhaExecutor?.[folha.source_documento_id]}
            >
              <SelectTrigger className="h-7 text-xs w-[150px]">
                <Users2 className="w-3 h-3 mr-1 flex-shrink-0" />
                <SelectValue placeholder="Sem executor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs text-red-600">— Remover —</SelectItem>
                {(usuarios || []).filter(u => u.status === 'ativo').sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(u => (
                  <SelectItem key={u.email} value={u.email} className="text-xs">{u.nome || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSavingFolhaExecutor?.[folha.source_documento_id] && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
          </div>
        </TableCell>
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
            {folha.status !== 'Planejada' && !isConcluida && (
              <Button
                size="icon"
                variant="outline"
                onClick={handleOpenModal}
                title="Planejar esta folha"
                className="border-purple-400 text-purple-600 hover:bg-purple-50 h-7 w-7"
              >
                <CalendarPlus className="w-3 h-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={handleToggleConclusao}
              disabled={isConc || isConcluida}
              title="Marcar como realizado"
              className="bg-green-600 hover:bg-green-700 text-white h-7 disabled:opacity-100 disabled:bg-green-600/50"
            >
              {isConc ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Realizado
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {showPlanejamentoModal && (
        <PlanejamentoFolhaUnicaModal
          isOpen={showPlanejamentoModal}
          onClose={handleCloseModal}
          folha={folha}
          atividade={atividade}
          usuarios={usuarios || []}
          empreendimentoId={empreendimentoId}
          onSuccess={handleModalSuccess}
        />
      )}
    </>
  );
}

export default React.memo(AnaliticoFolhaRow, (prev, next) => {
  const prevSelected = prev.folhasSelecionadas.has(prev.folha.source_documento_id);
  const nextSelected = next.folhasSelecionadas.has(next.folha.source_documento_id);
  if (prevSelected !== nextSelected) return false;
  
  if (prev.folha.source_documento_id !== next.folha.source_documento_id) return false;
  if (prev.folha.base_atividade_id !== next.folha.base_atividade_id) return false;
  if (prev.folha.status !== next.folha.status) return false;
  if (prev.folha.tempo !== next.folha.tempo) return false;
  if (prev.folha.etapa !== next.folha.etapa) return false;
  
  // Planejamentos comparison — only check relevant planning for this folha
  const prevPlan = prev.planejamentos?.find(p => 
    p.documento_id === prev.folha.source_documento_id && 
    p.atividade_id === prev.folha.base_atividade_id
  );
  const nextPlan = next.planejamentos?.find(p => 
    p.documento_id === next.folha.source_documento_id && 
    p.atividade_id === next.folha.base_atividade_id
  );
  
  if (prevPlan?.executor_principal !== nextPlan?.executor_principal) return false;
  if (prev.folha.executor_principal !== next.folha.executor_principal) return false;
  if (prev.folha.source_documento_pavimento !== next.folha.source_documento_pavimento) return false;
  if (prevPlan?.inicio_planejado !== nextPlan?.inicio_planejado) return false;
  if (prevPlan?.termino_planejado !== nextPlan?.termino_planejado) return false;
  
  // Check usuarios only if executor changed
  if (prevPlan?.executor_principal || nextPlan?.executor_principal) {
    const prevUser = prev.usuarios?.find(u => u.email === prevPlan?.executor_principal);
    const nextUser = next.usuarios?.find(u => u.email === nextPlan?.executor_principal);
    if (prevUser?.nome !== nextUser?.nome) return false;
  }
  
  const prevSaving = prev.isSavingFolhaExecutor?.[prev.folha.source_documento_id];
  const nextSaving = next.isSavingFolhaExecutor?.[next.folha.source_documento_id];
  if (prevSaving !== nextSaving) return false;
  
  if (prev.hasCheckboxColumn !== next.hasCheckboxColumn) return false;
  if (prev.empreendimentoId !== next.empreendimentoId) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  
  return true;
});