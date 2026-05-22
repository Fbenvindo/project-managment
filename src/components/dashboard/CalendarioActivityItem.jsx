// @ts-nocheck
import React, { useState, useContext, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, Play, Trash2, RefreshCw, Edit2, Loader2 } from "lucide-react";
import { format, startOfDay, parseISO, isValid, isAfter } from "date-fns";
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import EditActivityModal from './EditActivityModal';
import { PlanejamentoAtividade, Execucao, PlanejamentoDocumento } from '@/entities/all';
import { retryWithBackoff } from '../utils/apiUtils';

const formatHours = (h) => Number(h).toFixed(1);

export const calculateActivityStatus = (plano, allPlanejamentos = []) => {
  const normalizeId = (v) => String(v ?? '');
  if (plano.isLegacyExecution) return plano.status;
  if (plano.status === 'concluido_com_atraso') return 'concluido_com_atraso';
  if (plano.status === 'concluido') return 'concluido';

  const dataRef = plano.termino_ajustado || plano.termino_planejado;
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const estaAtrasada = dataRef && hoje > dataRef;

  if (estaAtrasada && (!plano.status || plano.status === 'nao_iniciado' || plano.status === 'atrasado')) return 'nao_iniciado_atrasado';
  if (estaAtrasada && (plano.status === 'em_andamento' || plano.status === 'pausado')) return 'em_andamento_atrasado';

  if (plano.inicio_ajustado && plano.inicio_planejado) {
    try {
      const aj = startOfDay(parseISO(plano.inicio_ajustado)), pl = startOfDay(parseISO(plano.inicio_planejado));
      if (isValid(aj) && isValid(pl) && isAfter(aj, pl)) return 'impactado_por_atraso';
    } catch (e) {}
  }
  if (plano.predecessora_id) {
    const pred = allPlanejamentos.find(p => normalizeId(p.id) === normalizeId(plano.predecessora_id));
    if (pred) {
      const predRef = pred.termino_ajustado || pred.termino_planejado;
      if (predRef && hoje > predRef && pred.status !== 'concluido' && pred.status !== 'concluido_com_atraso') return 'impactado_por_atraso';
    }
  }
  if (plano.termino_ajustado && plano.termino_planejado) {
    try {
      const aj = startOfDay(parseISO(plano.termino_ajustado)), pl = startOfDay(parseISO(plano.termino_planejado));
      if (isValid(aj) && isValid(pl) && isAfter(aj, pl)) return 'replanejado_atrasado';
    } catch (e) {}
  }
  return plano.status || 'nao_iniciado';
};

export default function ActivityItem({ plano, dayKey, onDelete, onUpdate, executorMap, allPlanejamentos, provided, isDragging, isReprogramando, isSelected, onToggleSelect, hasSelections, orderIndex }) {
  const { activeExecution, startExecution, user, playlist, addToPlaylist, removeFromPlaylist, triggerUpdate, hasPermission } = useContext(ActivityTimerContext);

  const [isStarting, setIsStarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTimeAdjustModal, setShowTimeAdjustModal] = useState(false);
  const [adjustedTime, setAdjustedTime] = useState('');
  const [showEditDescricaoModal, setShowEditDescricaoModal] = useState(false);

  const realStatus = calculateActivityStatus(plano, allPlanejamentos);

  const getStatusColor = (s) => ({ em_andamento:'#3b82f6', pausado:'#f59e0b', concluido:'#10b981', concluido_com_atraso:'#ef4444', nao_iniciado_atrasado:'#ef4444', atrasado:'#ef4444', replanejado_atrasado:'#ef4444', em_andamento_atrasado:'#f59e0b', impactado_por_atraso:'#8b5cf6' }[s] || '#6b7280');

  const displayName = useMemo(() => {
    if (plano.tipo_planejamento === 'documento') {
      const etapa = plano.etapa || 'Sem Etapa';
      const numero = plano.documento?.numero;
      const arquivo = plano.documento?.arquivo;
      if (numero || arquivo) return [numero, arquivo, etapa].filter(Boolean).join(' - ');
      const desc = plano.descritivo?.trim();
      if (desc && desc !== etapa) return desc;
      return etapa;
    }
    return plano.atividade?.atividade || plano.descritivo || 'Atividade não identificada';
  }, [plano]);

  const subdisciplina = plano.atividade?.subdisciplina;
  const tempoExecutado = Number(plano.tempo_executado) || 0;
  const tempoPlanejado = Number(plano.tempo_planejado) || 0;
  const planoExecutor = plano.executor_principal ? executorMap[plano.executor_principal] : null;

  let horasDoDia = 0;
  const horasAlocadasDia = Number(plano.horas_por_dia?.[dayKey]) || 0;
  const horasExecutadasNoDia = Number(plano.horas_executadas_por_dia?.[dayKey]) || 0;

  if (plano.isLegacyExecution) {
    horasDoDia = tempoExecutado;
  } else if (plano.isQuickActivity || plano.is_quick_activity) {
    horasDoDia = horasExecutadasNoDia > 0 ? horasExecutadasNoDia : tempoExecutado;
  } else {
    if (horasExecutadasNoDia > 0) {
      horasDoDia = horasExecutadasNoDia;
    } else if ((plano.status === 'concluido' || plano.status === 'concluido_com_atraso') && tempoExecutado > 0 && Object.keys(plano.horas_executadas_por_dia || {}).length === 0) {
      const diasPlanejados = Object.keys(plano.horas_por_dia || {});
      horasDoDia = diasPlanejados.length > 0 && diasPlanejados.includes(dayKey)
        ? tempoExecutado / diasPlanejados.length : tempoExecutado;
    } else {
      horasDoDia = horasAlocadasDia;
    }
  }

  const getDocumentoDisplay = () => {
    if (!plano.documento_id) return null;
    if (!plano.documento) return 'Carregando...';
    const campos = [plano.documento.numero_completo, plano.documento.arquivo, plano.documento.numero].filter(Boolean);
    return campos.length > 0 ? campos[0] : 'Sem documento';
  };

  const documentoDisplay = getDocumentoDisplay();
  const observacao = plano.observacao || null;

  const handleDeleteActivity = async () => {
    const confirmed = window.confirm(`Tem certeza que deseja excluir "${displayName}"? Esta ação é irreversível.`);
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      if (plano.isLegacyExecution) {
        const execId = plano.id.split('-')[1];
        await retryWithBackoff(() => Execucao.delete(execId), 3, 1000, 'deleteExecution');
      } else if (plano.tipo_planejamento === 'documento') {
        await retryWithBackoff(() => PlanejamentoDocumento.delete(plano.id), 3, 1000, 'deleteDocumentPlanning');
      } else {
        await retryWithBackoff(() => PlanejamentoAtividade.delete(plano.id), 3, 1000, 'deleteActivity');
      }
      if (onDelete) onDelete();
    } catch (error) {
      const is404 = error.message?.includes("404") || (error.response && error.response.status === 404);
      if (is404) {
        if (onDelete) onDelete();
      } else {
        alert("Erro ao excluir atividade. Tente novamente.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const isConcluded = realStatus === 'concluido' || realStatus === 'concluido_com_atraso';

  const handleStartActivity = async () => {
    if (activeExecution) { alert("Uma atividade já está em progresso."); return; }
    if (isConcluded) { alert("Esta atividade já foi concluída."); return; }
    if (plano.isLegacyExecution) { alert("Execução antiga não pode ser reiniciada."); return; }
    const hasIdentifier = plano.analitico_id || plano.descritivo || plano.atividade?.atividade || (plano.tipo_planejamento === 'documento' && plano.documento?.numero_completo);
    if (!hasIdentifier) { alert("Erro: A atividade não pôde ser iniciada por falta de identificador."); return; }
    setIsStarting(true);
    try {
      await startExecution({
        planejamento_id: plano.id,
        descritivo: `${displayName}${plano.empreendimento?.nome ? ` - ${plano.empreendimento.nome}` : ''}`,
        empreendimento_id: plano.empreendimento_id,
        tipo_planejamento: plano.tipo_planejamento
      });
    } catch (error) {
      alert("Não foi possível iniciar a atividade.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleAdjustTime = async () => {
    const timeValue = parseFloat(adjustedTime);
    if (isNaN(timeValue) || timeValue < 0) { alert("Tempo inválido."); return; }
    try {
      if (plano.isLegacyExecution) { alert("Não é possível ajustar tempo para execuções antigas."); return; }
      const entityToUpdate = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      const diasPlanejados = Object.keys(plano.horas_por_dia || {});
      const novasHorasPorDia = {};
      if (diasPlanejados.length > 0) {
        const horasPorDia = timeValue / diasPlanejados.length;
        diasPlanejados.forEach(dia => { novasHorasPorDia[dia] = horasPorDia; });
      } else {
        novasHorasPorDia[format(new Date(), 'yyyy-MM-dd')] = timeValue;
      }
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const terminoPlanejado = plano.termino_ajustado || plano.termino_planejado;
      const statusFinal = terminoPlanejado && hoje > terminoPlanejado ? 'concluido_com_atraso' : 'concluido';
      await retryWithBackoff(() => entityToUpdate.update(plano.id, {
        tempo_executado: timeValue, horas_executadas_por_dia: novasHorasPorDia, status: statusFinal, termino_real: hoje
      }), 3, 1000, 'adjustTime');
      setShowTimeAdjustModal(false);
      setAdjustedTime('');
      if (onDelete) onDelete({ id: plano.id, status: statusFinal, tempo_executado: timeValue, horas_executadas_por_dia: novasHorasPorDia });
    } catch (error) {
      alert("Erro ao ajustar tempo.");
    }
  };

  const shouldShowAdjustButton = () => hasPermission('coordenador') && !plano.isLegacyExecution && plano.status !== 'concluido';

  return (
    <>
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        style={{
          ...provided.draggableProps.style,
          backgroundColor: isSelected ? '#e0e7ff' :
            (realStatus === 'concluido_com_atraso' || realStatus === 'nao_iniciado_atrasado' || realStatus === 'atrasado' || realStatus === 'replanejado_atrasado') ? '#fef2f2' :
            (realStatus === 'em_andamento_atrasado' || realStatus === 'pausado') ? '#fffbeb' :
            realStatus === 'impactado_por_atraso' ? '#f5f3ff' :
            realStatus === 'em_andamento' ? '#eff6ff' :
            realStatus === 'concluido' ? '#f0fdf4' : '#ffffff',
          ...(isDragging && { boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' })
        }}
        className={`p-2 rounded border mb-1 text-xs group hover:shadow-md transition-shadow duration-200 relative overflow-visible ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}
      >
        {orderIndex !== undefined && (
          <span className="absolute -left-2 -top-2 z-20 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow pointer-events-none leading-none">{orderIndex + 1}</span>
        )}
        {isReprogramando && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded z-10">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          </div>
        )}
        {plano.status !== 'concluido' && plano.status !== 'concluido_com_atraso' && !plano.isLegacyExecution && (
          <div className={`absolute right-1 top-1 z-20 transition-opacity ${hasSelections || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); onToggleSelect(plano.id); }} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" title="Selecionar para mover em grupo" />
          </div>
        )}
        <div {...provided.dragHandleProps} className="absolute top-0 bottom-9 w-6 flex items-center justify-center cursor-move opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-gray-100 to-transparent left-0" title="Arrastar para mover">
          <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 mr-2 overflow-hidden">
            {plano.empreendimento?.nome && (
              <p className="text-xs text-gray-500 mb-0.5 font-medium truncate" title={plano.empreendimento.nome}>📋 {plano.empreendimento.nome}</p>
            )}
            <p className="font-medium text-gray-800 leading-tight truncate" title={displayName}>{displayName}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {plano.isQuickActivity && <Badge variant="outline" className="px-1 py-0.5 text-xs bg-gray-100 text-gray-600 border-gray-300">Execução Rápida</Badge>}
              {plano.tipo_planejamento === 'documento' && <Badge variant="outline" className="px-1 py-0.5 text-xs bg-blue-100 text-blue-600 border-blue-300">Planejamento Doc.</Badge>}
            </div>
          </div>
        </div>
        {plano.tipo_planejamento === 'documento' && plano.documento?.subdisciplinas && plano.documento.subdisciplinas.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {plano.documento.subdisciplinas.map((sub, idx) => (
              <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200">{sub}</Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap mb-1.5">
          {subdisciplina && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-blue-600 font-medium">{subdisciplina}</span>
            </div>
          )}
        </div>
        {plano.tipo_planejamento !== 'documento' && documentoDisplay && (
          <p className="text-gray-600 font-mono mb-1.5 break-words" title={`Documento: ${documentoDisplay}`}>{documentoDisplay}</p>
        )}
        {plano.os && <p className="text-blue-600 font-semibold text-xs mb-1.5">OS: {plano.os}</p>}
        {observacao && (
          <div className="mt-1.5 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
            <p className="text-gray-700 italic"><span className="font-semibold text-gray-600">💬 Obs:</span> {observacao}</p>
          </div>
        )}
        <div className="flex gap-2 mt-2 items-center justify-between">
          <div className="flex gap-2 items-center">
            <button
              onClick={handleStartActivity}
              disabled={!!activeExecution || isStarting || isConcluded}
              className={`p-1.5 rounded-md transition-colors ${
                activeExecution?.planejamento_id === plano.id ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse' :
                (realStatus === 'concluido' || realStatus === 'concluido_com_atraso') ? 'bg-green-500 cursor-not-allowed' :
                realStatus === 'nao_iniciado_atrasado' ? 'bg-red-500 hover:bg-red-600' :
                realStatus === 'em_andamento_atrasado' ? 'bg-yellow-500 hover:bg-yellow-600' :
                'bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
              }`}
              title={
                activeExecution?.planejamento_id === plano.id ? "Em andamento" :
                (realStatus === 'concluido' || realStatus === 'concluido_com_atraso') ? "Concluída" :
                realStatus === 'nao_iniciado_atrasado' ? "Não iniciada – prazo vencido" :
                realStatus === 'em_andamento_atrasado' ? "Em andamento – prazo vencido" :
                isStarting ? "Iniciando..." : "Iniciar atividade"
              }
            >
              {activeExecution?.planejamento_id === plano.id ? <Clock className="w-3.5 h-3.5 text-white" /> :
               (realStatus === 'concluido' || realStatus === 'concluido_com_atraso') ? <span className="text-white text-xs font-bold">✓</span> :
               realStatus === 'nao_iniciado_atrasado' ? <span className="text-white text-xs font-bold">✕</span> :
               <Play className="w-3.5 h-3.5 text-white" fill="white" />}
            </button>
            <button onClick={handleDeleteActivity} disabled={isDeleting || !!activeExecution} className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Excluir">
              {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
            <button onClick={() => setShowEditDescricaoModal(true)} className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors" title="Editar descrição">
              <Edit2 className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {shouldShowAdjustButton() ? (
              <button onClick={() => { setAdjustedTime(tempoExecutado.toString()); setShowTimeAdjustModal(true); }} className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" title="Ajustar tempo">
                <span className="font-semibold text-sm">{formatHours(horasAlocadasDia)}/{formatHours(horasExecutadasNoDia)}h{(plano.horas_por_dia && Object.keys(plano.horas_por_dia).length > 1 && Object.keys(plano.horas_por_dia).sort().indexOf(dayKey) < Object.keys(plano.horas_por_dia).length - 1) ? ' ...' : ''}</span>
              </button>
            ) : (
              <div className="font-mono text-blue-600">
                <span className="font-semibold text-sm">{formatHours(horasAlocadasDia)}/{formatHours(horasExecutadasNoDia)}h{(plano.horas_por_dia && Object.keys(plano.horas_por_dia).length > 1 && Object.keys(plano.horas_por_dia).sort().indexOf(dayKey) < Object.keys(plano.horas_por_dia).length - 1) ? ' ...' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showTimeAdjustModal} onOpenChange={setShowTimeAdjustModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar Tempo Executado</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600"><strong>Atividade:</strong> {displayName}</p>
            <p className="text-sm text-gray-600">Tempo atual: {tempoExecutado.toFixed(1)}h</p>
            <div className="space-y-2">
              <Label htmlFor="adjustedTime">Novo Tempo (horas)</Label>
              <Input id="adjustedTime" type="number" step="0.1" min="0" value={adjustedTime} onChange={(e) => setAdjustedTime(e.target.value)} placeholder="Ex: 2.5" />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-700 text-sm font-medium">ℹ️ A atividade será marcada como <strong>concluída</strong>.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeAdjustModal(false)}>Cancelar</Button>
            <Button onClick={handleAdjustTime} className="bg-blue-600 hover:bg-blue-700">Ajustar e Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditActivityModal
        plano={plano}
        displayName={displayName}
        isOpen={showEditDescricaoModal}
        onClose={() => setShowEditDescricaoModal(false)}
        onSave={() => { if (onDelete) onDelete(); }}
      />
    </>
  );
}