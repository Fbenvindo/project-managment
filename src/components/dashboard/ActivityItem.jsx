import React, { useState, useMemo, useContext } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, Trash2, RefreshCw, Edit2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import { PlanejamentoAtividade, PlanejamentoDocumento, Execucao, Empreendimento } from '@/entities/all';
import { retryWithBackoff } from '../utils/apiUtils';

const calculateActivityStatus = (plano, allPlanejamentos = []) => {
  if (plano.isLegacyExecution) return plano.status;
  if (plano.status === 'concluido') return 'concluido';
  const { isActivityOverdue: isOverdueShared } = require('../utils/DateCalculator');
  const isActivityOverdue = (p) => p.isLegacyExecution ? false : isOverdueShared(p);
  if (plano.status === 'atrasado' || isActivityOverdue(plano)) return 'atrasado';
  // predecessora atrasada
  if (plano.predecessora_id) {
    const pred = allPlanejamentos.find(p => p.id === plano.predecessora_id);
    if (pred && isActivityOverdue(pred)) return 'impactado_por_atraso';
  }
  return plano.status || 'nao_iniciado';
};

export default function ActivityItem({ plano, dayKey, onDelete, onUpdate, executorMap, allPlanejamentos, provided, isDragging, isReprogramando, isSelected, onToggleSelect, hasSelections }) {
  const { activeExecution, startExecution, user, playlist, addToPlaylist, removeFromPlaylist, triggerUpdate, hasPermission } = useContext(ActivityTimerContext);

  const [isStarting, setIsStarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTimeAdjustModal, setShowTimeAdjustModal] = useState(false);
  const [adjustedTime, setAdjustedTime] = useState('');
  const [showEditDescricaoModal, setShowEditDescricaoModal] = useState(false);
  const [editDescricao, setEditDescricao] = useState('');
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [empreendimentosList, setEmpreendimentosList] = useState([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState('none');

  const realStatus = calculateActivityStatus(plano, allPlanejamentos);

  const getStatusColor = (status) => {
    switch (status) {
      case 'em_andamento': return '#3b82f6';
      case 'pausado': return '#f59e0b';
      case 'concluido': return '#10b981';
      case 'atrasado':
      case 'replanejado_atrasado': return '#ef4444';
      case 'impactado_por_atraso': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const displayName = useMemo(() => {
    if (plano.tipo_planejamento === 'documento') {
      const numeroFolha = plano.documento?.numero || (plano.descritivo?.includes(' - ') ? plano.descritivo.split(' - ')[0] : null) || 'Número';
      const nomeArquivo = plano.documento?.arquivo || (plano.descritivo?.includes(' - ') ? plano.descritivo.split(' - ')[1] : null) || 'Documento';
      return `${numeroFolha} - ${nomeArquivo} - ${plano.etapa || 'Sem Etapa'}`;
    }
    return plano.atividade?.atividade || plano.descritivo || 'Atividade não identificada';
  }, [plano]);

  const subdisciplina = plano.atividade?.subdisciplina;
  const tempoExecutado = plano.tempo_executado || 0;
  const tempoPlanejado = plano.tempo_planejado || 0;
  const horasAlocadasDia = Number(plano.horas_por_dia?.[dayKey]) || 0;
  const horasExecutadasNoDia = Number(plano.horas_executadas_por_dia?.[dayKey]) || 0;

  let horasDoDia = 0;
  if (plano.isLegacyExecution) {
    horasDoDia = tempoExecutado;
  } else if (plano.isQuickActivity || plano.is_quick_activity) {
    horasDoDia = horasExecutadasNoDia > 0 ? horasExecutadasNoDia : tempoExecutado;
  } else {
    if (horasExecutadasNoDia > 0) horasDoDia = horasExecutadasNoDia;
    else if (plano.status === 'concluido' && tempoExecutado > 0 && Object.keys(plano.horas_executadas_por_dia || {}).length === 0) {
      const diasPlanejados = Object.keys(plano.horas_por_dia || {});
      horasDoDia = diasPlanejados.length > 0 && diasPlanejados.includes(dayKey) ? tempoExecutado / diasPlanejados.length : tempoExecutado;
    } else {
      horasDoDia = horasAlocadasDia;
    }
  }

  const getDocumentoDisplay = () => {
    if (!plano.documento_id) return null;
    if (!plano.documento) return 'Carregando...';
    return [plano.documento.numero_completo, plano.documento.arquivo, plano.documento.numero].filter(Boolean)[0] || 'Sem documento';
  };
  const documentoDisplay = getDocumentoDisplay();

  const handleDeleteActivity = async () => {
    if (!window.confirm(`Tem certeza que deseja excluir "${displayName}"?`)) return;
    setIsDeleting(true);
    try {
      if (plano.isLegacyExecution) await retryWithBackoff(() => Execucao.delete(plano.id.split('-')[1]), 3, 1000, 'deleteExecution');
      else if (plano.tipo_planejamento === 'documento') await retryWithBackoff(() => PlanejamentoDocumento.delete(plano.id), 3, 1000, 'deleteDocumentPlanning');
      else await retryWithBackoff(() => PlanejamentoAtividade.delete(plano.id), 3, 1000, 'deleteActivity');
      if (onDelete) onDelete();
    } catch (error) {
      const is404 = error.message?.includes("404") || error.response?.status === 404;
      if (is404) { if (onDelete) onDelete(); }
      else alert("Erro ao excluir atividade. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartActivity = async () => {
    if (activeExecution) { alert("Uma atividade já está em progresso."); return; }
    if (realStatus === 'concluido') { alert("Esta atividade já foi concluída."); return; }
    if (plano.isLegacyExecution) { alert("Esta é uma atividade antiga e não pode ser iniciada novamente."); return; }
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
      if (plano.isLegacyExecution) { alert("Não é possível ajustar atividades antigas."); return; }
      const entityToUpdate = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      const diasPlanejados = Object.keys(plano.horas_por_dia || {});
      const novasHorasPorDia = {};
      if (diasPlanejados.length > 0) {
        const hpd = timeValue / diasPlanejados.length;
        diasPlanejados.forEach(d => novasHorasPorDia[d] = hpd);
      } else {
        novasHorasPorDia[format(new Date(), 'yyyy-MM-dd')] = timeValue;
      }
      await retryWithBackoff(() => entityToUpdate.update(plano.id, {
        tempo_executado: timeValue, tempo_planejado: timeValue,
        horas_por_dia: novasHorasPorDia, status: 'concluido',
        termino_real: format(new Date(), 'yyyy-MM-dd')
      }), 3, 1000, 'adjustTime');
      setShowTimeAdjustModal(false);
      setAdjustedTime('');
      if (onDelete) onDelete();
    } catch (error) {
      alert("Erro ao ajustar tempo.");
    }
  };

  const handleOpenEditDescricao = () => {
    setEditDescricao(plano.descritivo || '');
    setSelectedEmpreendimento(plano.empreendimento_id ? plano.empreendimento_id.toString() : 'none');
    if (!empreendimentosList.length) {
      retryWithBackoff(() => Empreendimento.list(), 3, 1000, 'loadEmps').then(list => setEmpreendimentosList(Array.isArray(list) ? list : [])).catch(() => {});
    }
    setShowEditDescricaoModal(true);
  };

  const handleSaveDescricao = async () => {
    if (!editDescricao.trim()) { alert('Descrição não pode estar vazia'); return; }
    setIsEditLoading(true);
    try {
      const empId = selectedEmpreendimento && selectedEmpreendimento !== 'none'
        ? (isNaN(Number(selectedEmpreendimento)) ? selectedEmpreendimento : Number(selectedEmpreendimento)) : null;
      if (plano.isLegacyExecution) {
        await Execucao.update(plano.id.split('-')[1], { descritivo: editDescricao.trim(), empreendimento_id: empId });
      } else {
        const entity = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
        await entity.update(plano.id, { descritivo: editDescricao.trim(), empreendimento_id: empId });
      }
      setShowEditDescricaoModal(false);
      if (onDelete) onDelete();
    } catch (error) {
      alert('Erro ao atualizar descrição: ' + (error.message || ''));
    } finally {
      setIsEditLoading(false);
    }
  };

  const shouldShowAdjustButton = () => hasPermission('coordenador') && !plano.isLegacyExecution && plano.status !== 'concluido';
  const observacao = plano.observacao || null;

  return (
    <>
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        style={{
          ...provided.draggableProps.style,
          borderLeft: `3px solid ${getStatusColor(realStatus)}`,
          backgroundColor: isSelected ? '#e0e7ff' :
            realStatus === 'atrasado' || realStatus === 'replanejado_atrasado' ? '#fef2f2' :
              realStatus === 'impactado_por_atraso' ? '#f5f3ff' :
                realStatus === 'em_andamento' ? '#eff6ff' :
                  realStatus === 'concluido' ? '#f0fdf4' :
                    realStatus === 'pausado' ? '#fffbeb' : '#ffffff',
          ...(isDragging && { boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', transform: 'rotate(2deg)' })
        }}
        className={`p-2 rounded border mb-1 text-xs group hover:shadow-md transition-shadow duration-200 relative overflow-visible ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}
      >
        {isReprogramando && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded z-10">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          </div>
        )}

        {(hasSelections || isSelected) && plano.status !== 'concluido' && !plano.isLegacyExecution && (
          <div className="absolute left-1 top-1 z-20">
            <input type="checkbox" checked={isSelected}
              onChange={(e) => { e.stopPropagation(); onToggleSelect(plano.id); }}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
            />
          </div>
        )}

        <div {...provided.dragHandleProps}
          className={`absolute top-0 bottom-0 w-6 flex items-center justify-center cursor-move opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-gray-100 to-transparent ${hasSelections || isSelected ? 'left-6' : 'left-0'}`}>
          <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
          </svg>
        </div>

        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 mr-2 overflow-hidden">
            {plano.empreendimento?.nome && (
              <p className="text-xs text-gray-500 mb-0.5 font-medium truncate">📋 {plano.empreendimento.nome}</p>
            )}
            <p className="font-medium text-gray-800 leading-tight truncate" title={displayName}>{displayName}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {plano.isQuickActivity && <Badge variant="outline" className="px-1 py-0.5 text-xs bg-gray-100 text-gray-600 border-gray-300">Execução Rápida</Badge>}
              {plano.tipo_planejamento === 'documento' && <Badge variant="outline" className="px-1 py-0.5 text-xs bg-blue-100 text-blue-600 border-blue-300">Planejamento Doc.</Badge>}
            </div>
          </div>
        </div>

        {plano.tipo_planejamento === 'documento' && plano.documento?.subdisciplinas?.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {plano.documento.subdisciplinas.map((sub, idx) => (
              <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200">{sub}</Badge>
            ))}
          </div>
        )}

        {subdisciplina && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span className="text-blue-600 font-medium">{subdisciplina}</span>
          </div>
        )}

        {plano.tipo_planejamento !== 'documento' && documentoDisplay && (
          <p className="text-gray-600 font-mono mb-1.5 break-words">{documentoDisplay}</p>
        )}

        {plano.os && <p className="text-blue-600 font-semibold text-xs mb-1.5">OS: {plano.os}</p>}

        {observacao && (
          <div className="mt-1.5 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
            <p className="text-gray-700 italic"><span className="font-semibold text-gray-600">💬 Obs:</span> {observacao}</p>
          </div>
        )}

        <div className="flex gap-2 mt-2 items-center justify-between">
          <div className="flex gap-2 items-center">
            <button onClick={handleStartActivity}
              disabled={!!activeExecution || isStarting || realStatus === 'concluido'}
              className={`p-1.5 rounded-md transition-colors ${activeExecution?.planejamento_id === plano.id ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse' : (realStatus === 'atrasado' || realStatus === 'replanejado_atrasado') ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed'}`}>
              {activeExecution?.planejamento_id === plano.id ? <Clock className="w-3.5 h-3.5 text-white" /> :
                (realStatus === 'atrasado' || realStatus === 'replanejado_atrasado') ? <span className="text-white text-xs font-bold">✕</span> :
                  <Play className="w-3.5 h-3.5 text-white" fill="white" />}
            </button>
            <button onClick={handleDeleteActivity} disabled={isDeleting || !!activeExecution}
              className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
            <button onClick={handleOpenEditDescricao}
              className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors">
              <Edit2 className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {shouldShowAdjustButton() ? (
              <button onClick={() => { setAdjustedTime(tempoExecutado.toString()); setShowTimeAdjustModal(true); }}
                className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                <span className="font-semibold text-sm">
                  {Math.ceil(horasAlocadasDia * 10) / 10}/{Math.ceil(horasExecutadasNoDia * 10) / 10}h
                  {(plano.horas_por_dia && Object.keys(plano.horas_por_dia).length > 1 && Object.keys(plano.horas_por_dia).sort().indexOf(dayKey) < Object.keys(plano.horas_por_dia).length - 1) ? ' ...' : ''}
                </span>
              </button>
            ) : (
              <div className="font-mono text-blue-600">
                <span className="font-semibold text-sm">
                  {Math.ceil(horasAlocadasDia * 10) / 10}/{Math.ceil(horasExecutadasNoDia * 10) / 10}h
                  {(plano.horas_por_dia && Object.keys(plano.horas_por_dia).length > 1 && Object.keys(plano.horas_por_dia).sort().indexOf(dayKey) < Object.keys(plano.horas_por_dia).length - 1) ? ' ...' : ''}
                </span>
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
              <Input id="adjustedTime" type="number" step="0.1" min="0" value={adjustedTime} onChange={(e) => setAdjustedTime(e.target.value)} />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-700 text-sm">A atividade será marcada como <strong>concluída</strong>.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeAdjustModal(false)}>Cancelar</Button>
            <Button onClick={handleAdjustTime} className="bg-blue-600 hover:bg-blue-700">Ajustar e Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDescricaoModal} onOpenChange={setShowEditDescricaoModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Descrição</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600"><strong>Atividade:</strong> {displayName}</p>
            <div className="space-y-2">
              <Label>Empreendimento</Label>
              <Select value={selectedEmpreendimento || 'none'} onValueChange={setSelectedEmpreendimento}>
                <SelectTrigger className="w-full bg-white"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {empreendimentosList.map(emp => (
                    <SelectItem key={emp.id} value={emp.id?.toString()}>{emp.nome || `#${emp.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Descrição</Label>
              <Textarea value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} className="min-h-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDescricaoModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveDescricao} disabled={isEditLoading} className="bg-blue-600 hover:bg-blue-700">
              {isEditLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}