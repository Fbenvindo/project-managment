import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Building2, Filter, Trash2, CalendarDays, View, Play, RefreshCw, LineChart, Users, PlusCircle, ListMusic, Loader2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, parseISO, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay,
  isValid, isAfter
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import PrevisaoEntregaModal from './PrevisaoEntregaModal';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { PlanejamentoAtividade, Documento, Empreendimento, Execucao, PlanejamentoDocumento } from '@/api/entities';
import { ChevronsUpDown } from 'lucide-react';
import { isActivityOverdue as isOverdueShared, distribuirHorasPorDias } from '../utils/DateCalculator';
import { retryWithBackoff } from '../utils/apiUtils';
// Removed: import { useUserProfile } from '../hooks/useUserProfile'; // This hook is no longer used here

// Função para converter string de data para Date local corretamente
const parseLocalDate = (dateString) => {
  if (!dateString) return null;

  // Se já for um objeto Date, retornar como está
  if (dateString instanceof Date) {
    return dateString;
  }

  // Se for string no formato YYYY-MM-DD, criar Date local
  if (typeof dateString === 'string') {
    // Verificar se é formato de data ISO (YYYY-MM-DD)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day); // Cria data local
    }

    // Para outros formatos, usar parseISO mas ajustar para local
    try {
      const parsedDate = parseISO(dateString);
      if (!isNaN(parsedDate.getTime())) {
        // Ajustar para o fuso horário local para evitar mudança de dia
        // This adjustment aims to keep the "calendar day" consistent
        // even if the raw ISO string implies a time that would shift the day
        // when interpreted as UTC then converted to local.
        const localDate = new Date(parsedDate.getTime() + parsedDate.getTimezoneOffset() * 60000);
        return localDate;
      }
    } catch (e) {
      console.error('Erro ao parsear data:', dateString, e);
    }
  }

  return null;
};

// Função para verificar se uma atividade está atrasada (agora usando a compartilhada)
const isActivityOverdue = (plano) => {
  // Legacy executions (isLegacyExecution) are not overdue in the traditional sense
  // They are either 'concluido' or 'pausado' based on their execution status.
  if (plano.isLegacyExecution) return false;
  return isOverdueShared(plano);
};

// **CORRIGIDO**: Função para calcular o status real da atividade - PRIORIZAR CONCLUSÃO
const calculateActivityStatus = (plano, allPlanejamentos = []) => {
  // Se for uma atividade virtual (execução), seu status é direto
  if (plano.isLegacyExecution) {
    return plano.status;
  }

  // **PRIORIDADE 1**: Se está concluída, SEMPRE retorna concluída (não importa se estava atrasada)
  if (plano.status === 'concluido') {
    return 'concluido';
  }

  // **PRIORIDADE 2**: Se está marcada como atrasada manualmente OU automaticamente, retorna atrasado
  if (plano.status === 'atrasado' || isActivityOverdue(plano)) {
    return 'atrasado';
  }

  // **PRIORIDADE 3**: Verificar se foi replanejada para INICIAR mais tarde
  let foiReplanejadaParaIniciarMaisTarde = false;
  if (plano.inicio_ajustado && plano.inicio_planejado) {
    try {
      const ajustado = startOfDay(parseISO(plano.inicio_ajustado));
      const planejado = startOfDay(parseISO(plano.inicio_planejado));
      if (isValid(ajustado) && isValid(planejado) && isAfter(ajustado, planejado)) {
        foiReplanejadaParaIniciarMaisTarde = true;
      }
    } catch (e) {
      console.warn("Erro ao parsear datas de início para status de replanejamento:", plano.inicio_ajustado, plano.inicio_planejado, e);
    }
  }

  // Verificar se está em risco por causa de predecessora atrasada
  let predecessoraAtrasada = false;
  if (plano.predecessora_id) {
    const predecessora = allPlanejamentos.find(p => p.id === plano.predecessora_id);
    if (predecessora && isActivityOverdue(predecessora)) {
      predecessoraAtrasada = true;
    }
  }

  if (foiReplanejadaParaIniciarMaisTarde || predecessoraAtrasada) {
    return 'impactado_por_atraso';
  }

  // Manter verificação de TÉRMINO para o status amarelo (replanejado_atrasado)
  let wasReplannedLaterTermino = false;
  if (plano.termino_ajustado && plano.termino_planejado) {
    try {
      const ajustado = startOfDay(parseISO(plano.termino_ajustado));
      const planejado = startOfDay(parseISO(plano.termino_planejado));
      if (isValid(ajustado) && isValid(planejado) && isAfter(ajustado, planejado)) {
        wasReplannedLaterTermino = true;
      }
    } catch (e) {
      console.warn("Erro ao parsear datas de término para status de replanejamento:", plano.termino_ajustado, plano.termino_planejado, e);
    }
  }

  if (wasReplannedLaterTermino) {
    return 'replanejado_atrasado';
  }

  // Caso contrário, manter o status original ou 'nao_iniciado'
  return plano.status || 'nao_iniciado';
};

// --- Sub-componente de Filtros ---
const CalendarFilters = ({
  users,
  disciplines,
  viewMode,
  onViewModeChange,
  filters,
  onFilterChange,
  onClearFilters,
  hasSelectedUser,
  isColaborador,
  isViewingAllUsers,
  isGestao,
  isApoio,
  podeVerOutros,
  usuariosPermitidos,
  currentUserEmail
}) => {
  // Debug log
  console.log('🔍 CalendarFilters Debug:', {
    podeVerOutros,
    usuariosPermitidos: usuariosPermitidos?.length || 0,
    isColaborador,
    isGestao,
    isApoio,
    currentUserEmail
  });

  // **MODIFICADO**: Filtrar e ordenar apenas usuários com nome cadastrado
  const usersOrdenados = useMemo(() => {
    return [...users]
      .filter(u => u.nome || u.full_name)
      .sort((a, b) => {
        const nomeA = a.nome || a.full_name || '';
        const nomeB = b.nome || b.full_name || '';
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
      });
  }, [users]);

  // **MODIFICADO**: Dropdown bloqueado para colaboradores, gestão e APOIO (sem permissão especial)
  const isDropdownDisabled = (isColaborador || isGestao || isApoio) && !podeVerOutros;

  console.log('🔒 Dropdown disabled?', isDropdownDisabled);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-100 bg-gray-50/50">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4">
        <Filter className="w-5 h-5 text-gray-500" />
        <Select value={filters.user} onValueChange={(value) => onFilterChange('user', value)} disabled={isDropdownDisabled}>
          <SelectTrigger className={`w-48 ${!hasSelectedUser && filters.user === '' ? 'border-red-300 bg-red-50' : 'bg-white'} ${isDropdownDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <SelectValue placeholder="⚠️ Selecione um usuário" />
          </SelectTrigger>
          <SelectContent>
            {usersOrdenados
              .filter(u => {
                // Se for colaborador, gestão ou apoio, filtra por permissões
                if (isColaborador || isGestao || isApoio) {
                  // Sempre mostra o próprio usuário
                  if (u.email === currentUserEmail) return true;
                  // Se tem usuários permitidos, mostra apenas esses
                  if (podeVerOutros) {
                    return usuariosPermitidos.includes(u.email);
                  }
                  // Sem permissões especiais, não mostra outros usuários
                  return false;
                }
                // Admin, líder, direção veem todos
                return true;
              })
              .map(userItem => (
                <SelectItem key={userItem.id} value={userItem.email}>
                  {userItem.nome || userItem.full_name}
                </SelectItem>
              ))}
            {(!isColaborador && !isGestao && !isApoio) && usersOrdenados.length > 0 && (
              <SelectItem value="all">⚠️ Todos os Usuários (pode ser lento)</SelectItem>
            )}
          </SelectContent>
        </Select>
        {hasSelectedUser && (
          <>
            <Select value={filters.discipline} onValueChange={(value) => onFilterChange('discipline', value)}>
              <SelectTrigger className="w-48 bg-white">
                <SelectValue placeholder="Filtrar por disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Disciplinas</SelectItem>
                {disciplines.map(disc => (
                  <SelectItem key={disc.id} value={disc.nome}>{disc.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filters.discipline !== 'all' || filters.user !== '') && ((!isGestao && !isColaborador && !isApoio) || podeVerOutros) && (
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            )}
          </>
        )}
      </div>

      {/* Controles de Visualização */}
      {hasSelectedUser && (
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'day' ? 'default' : 'outline'} size="sm" onClick={() => onViewModeChange('day')}>Dia</Button>
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" onClick={() => onViewModeChange('week')}>Semana</Button>
          <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" onClick={() => onViewModeChange('month')}>Mês</Button>
        </div>
      )}
    </div>
  );
};


// --- Sub-componente de Itens de Atividade Individual ---
const ActivityItem = ({
  plano, dayKey, onDelete, onUpdate, executorMap, allPlanejamentos,
  provided, isDragging, isReprogramando, isSelected, onToggleSelect, hasSelections
}) => {
  const { activeExecution, startExecution, user, playlist, addToPlaylist, removeFromPlaylist, triggerUpdate, hasPermission } = useContext(ActivityTimerContext);

  const [isStarting, setIsStarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTimeAdjustModal, setShowTimeAdjustModal] = useState(false);
  const [adjustedTime, setAdjustedTime] = useState('');
  const [showObservacoes, setShowObservacoes] = useState(false);

  const realStatus = calculateActivityStatus(plano, allPlanejamentos);

  const getStatusColor = (status) => {
    switch (status) {
      case 'em_andamento': return '#3b82f6'; // Azul
      case 'pausado': return '#f59e0b'; // Amarelo
      case 'concluido': return '#10b981'; // Verde
      case 'atrasado':
      case 'replanejado_atrasado': return '#ef4444'; // Vermelho para atraso e replanejado com atraso
      case 'impactado_por_atraso': return '#8b5cf6'; // Roxo (violet-500)
      case 'nao_iniciado':
      default: return '#6b7280'; // Cinza
    }
  };

  // **MODIFICADO**: Melhorar exibição do nome para documentos
  const ActivityItem = ({ plano, dayKey, onDelete, onUpdate, executorMap, allPlanejamentos, provided, isDragging, isReprogramando, isSelected, onToggleSelect, hasSelections }) => {
    const { activeExecution, startExecution, user, playlist, addToPlaylist, removeFromPlaylist, triggerUpdate, hasPermission } = useContext(ActivityTimerContext);

    // Estados para modal unificado
    const [showEditModal, setShowEditModal] = useState(false);
    const [editDescricao, setEditDescricao] = useState(plano.descritivo || "");
    const [editTempo, setEditTempo] = useState(plano.tempo_executado || "");
    const [editOs, setEditOs] = useState(plano.os || "");
    const [isEditLoading, setIsEditLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isStarting, setIsStarting] = useState(false);

    const realStatus = calculateActivityStatus(plano, allPlanejamentos);
    const displayName = useMemo(() => plano.atividade?.atividade || plano.descritivo || 'Atividade não identificada', [plano]);
    const tempoExecutado = plano.tempo_executado || 0;
    const tempoPlanejado = plano.tempo_planejado || 0;
    const planoExecutor = plano.executor_principal ? executorMap[plano.executor_principal] : null;
    const isNaPlaylist = playlist.includes(plano.id);

    // Funções de permissão
    const shouldShowStartButton = () => realStatus !== 'concluido' && !activeExecution && !plano.isLegacyExecution;
    const shouldShowDeleteButton = () => hasPermission('coordenador');
    const shouldShowEditButton = () => hasPermission('coordenador') && !plano.isLegacyExecution && plano.status !== 'concluido';

    // Handlers
    const handleOpenEditModal = () => {
      setEditDescricao(plano.descritivo || "");
      setEditTempo(plano.tempo_executado || "");
      setEditOs(plano.os || "");
      setShowEditModal(true);
    };

    const handleSaveAll = async () => {
      setIsEditLoading(true);
      try {
        const entityToUpdate = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
        await retryWithBackoff(() => entityToUpdate.update(plano.id, {
          descritivo: editDescricao,
          tempo_executado: parseFloat(editTempo),
          tempo_planejado: parseFloat(editTempo),
          os: editOs,
          status: 'concluido',
          termino_real: format(new Date(), 'yyyy-MM-dd')
        }), 3, 1000, 'editAll');
        setShowEditModal(false);
        if (onDelete) onDelete();
      } catch (e) {
        alert("Erro ao salvar alterações. Tente novamente.");
      } finally {
        setIsEditLoading(false);
      }
    };

    const handleDeleteActivity = async () => {
      if (!window.confirm(`Tem certeza que deseja excluir "${displayName}"? Esta ação é irreversível.`)) return;
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
        alert("Erro ao excluir atividade. Tente novamente.");
      } finally {
        setIsDeleting(false);
      }
    };

    const handleStartActivity = async () => {
      if (activeExecution) {
        alert("Uma atividade já está em progresso. Pare a atividade atual antes de iniciar uma nova.");
        return;
      }
      if (realStatus === 'concluido') {
        alert("Esta atividade já foi concluída e não pode ser iniciada novamente.");
        return;
      }
      if (plano.isLegacyExecution) {
        alert("Esta é uma atividade executada sem planejamento (antiga) e não pode ser iniciada novamente.");
        return;
      }
      setIsStarting(true);
      try {
        await startExecution({ planejamento_id: plano.id, descritivo: displayName, empreendimento_id: plano.empreendimento_id, tipo_planejamento: plano.tipo_planejamento });
      } catch (error) {
        alert("Não foi possível iniciar a atividade.");
      } finally {
        setIsStarting(false);
      }
    };

    return (
      <>
        <div ref={provided.innerRef} {...provided.draggableProps} className="p-2 rounded border mb-1 text-xs group hover:shadow-md transition-shadow duration-200 relative">
          {/* ...restante da UI, igual ao original, exceto botões de ação... */}
          <div className="flex items-center gap-2">
            {shouldShowEditButton() && (
              <Button size="sm" variant="outline" onClick={handleOpenEditModal}>Editar</Button>
            )}
            {shouldShowDeleteButton() && (
              <Button size="sm" variant="destructive" onClick={handleDeleteActivity} disabled={isDeleting}>Excluir</Button>
            )}
            {shouldShowStartButton() && (
              <Button size="sm" variant="success" onClick={handleStartActivity} disabled={isStarting}>Iniciar</Button>
            )}
          </div>
          {/* ...demais campos da atividade... */}
        </div>
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Atividade</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-2">
              <div>
                <Label>Descrição</Label>
                <Textarea value={editDescricao} onChange={e => setEditDescricao(e.target.value)} rows={3} />
              </div>
              <div>
                <Label>Tempo (horas)</Label>
                <Input type="number" min="0" step="0.1" value={editTempo} onChange={e => setEditTempo(e.target.value)} />
              </div>
              <div>
                <Label>OS</Label>
                <Input value={editOs} onChange={e => setEditOs(e.target.value)} placeholder="Informe a OS" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isEditLoading}>Cancelar</Button>
              <Button onClick={handleSaveAll} loading={isEditLoading}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };


  const statusCounts = atividades.reduce((acc, atividade) => {
    const realStatus = calculateActivityStatus(atividade, allPlanejamentos);
    acc[realStatus] = (acc[realStatus] || 0) + 1;
    return acc;
  }, {});

  const disciplineColors = useMemo(() => {
    const disciplineMap = (disciplinas || []).reduce((acc, d) => {
      acc[d.nome] = d.cor;
      return acc;
    }, {});

    const uniqueDisciplines = [...new Set(atividades.map(a => a.atividade?.disciplina).filter(Boolean))];

    return uniqueDisciplines.map(dName => ({
      name: dName,
      color: disciplineMap[dName] || '#A1A1AA'
    }));
  }, [atividades, disciplinas]);

  const getGroupStatus = () => {
    if (statusCounts['atrasado'] > 0 || statusCounts['replanejado_atrasado'] > 0) return 'atrasado';
    if (statusCounts['impactado_por_atraso'] > 0) return 'impactado_por_atraso';
    if (statusCounts['em_andamento'] > 0) return 'em_andamento';
    if (atividades.length > 0 && statusCounts['concluido'] === atividades.length) return 'concluido';
    if (statusCounts['pausado'] > 0) return 'pausado';
    return 'nao_iniciado';
  };



  const groupStatus = getGroupStatus();
  const statusColor = getStatusColor(groupStatus);
  const empreendimentoNome = empreendimento?.nome || empreendimento?.nome_fantasia || 'Sem Empreendimento';
  const planoExecutor = executor?.email ? executorMap[executor.email] : null;
  const executorNome = planoExecutor?.nome || planoExecutor?.email || 'Sem Executor';

  const canDragGroup = canReprogram &&
    empreendimentoNome !== 'Atividades Rápidas' &&
    !atividades.some(a => a.status === 'concluido' || a.isLegacyExecution);

  return (
    <div
      className="mb-1"
      ref={provided?.innerRef}
      {...(provided?.draggableProps || {})}
    >
      <div
        onClick={onToggle}
        style={{
          borderLeft: `6px solid ${statusColor}`,
          backgroundColor: isDragging ? '#e0e7ff' :
            groupStatus === 'atrasado' ? '#fff1f2' :
              groupStatus === 'impactado_por_atraso' ? '#f5f3ff' :
                groupStatus === 'em_andamento' ? '#eff6ff' :
                  groupStatus === 'concluido' ? '#f0fdf4' :
                    groupStatus === 'pausado' ? '#fefce8' : '#f8fafc',
          cursor: 'pointer',
          ...(isDragging && {
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            transform: 'rotate(1deg) scale(1.02)',
            transition: 'all 0.2s ease'
          })
        }}
        className={`p-2 rounded-lg hover:shadow-md transition-shadow duration-200 border ${isDragging ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'
          }`}
      >
        <div className="flex items-center justify-between gap-2">
          {canDragGroup && (
            <div
              {...(provided?.dragHandleProps || {})}
              onClick={(e) => e.stopPropagation()}
              className="cursor-move p-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex-shrink-0 border border-gray-300"
              title="🖐️ Arrastar todo o grupo"
              style={{ minWidth: '20px', minHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg className="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              {disciplineColors.map(d => (
                <div
                  key={d.name}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: d.color }}
                  title={d.name}
                ></div>
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 ml-auto text-purple-500 hover:bg-purple-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowPrevisao(atividades);
                }}
                title="Ver Previsão de Entrega"
              >
                <LineChart className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="font-bold text-xs truncate text-gray-800" title={empreendimentoNome}>
              {empreendimentoNome}
            </p>
            {empreendimentoNome !== 'Atividades Rápidas' && (
              <div className="flex items-center gap-1.5 mt-1">
                <User className="w-3 h-3 flex-shrink-0" />
                <p className="text-xs font-medium truncate" title={executorNome}>{executorNome}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div
                className="px-1.5 py-0.5 rounded text-xs font-bold text-white"
                style={{ backgroundColor: statusColor }}
              >
                {totalHoras > 0 ? `${totalHoras.toFixed(1)}h` : '0h'}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{atividades.length} ativ.</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </div>

        {isDragging && (
          <div className="mt-2 flex items-center justify-center gap-2 bg-indigo-100 border-2 border-indigo-300 rounded p-2">
            <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">
              {atividades.length}
            </div>
            <span className="text-sm font-bold text-indigo-800">
              Movendo {atividades.length} atividade{atividades.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && !isDragging && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-2 mt-1 space-y-1"
          >
            {atividades.map((atividade, index) => (
              <Draggable
                key={atividade.id}
                draggableId={atividade.id}
                index={index}
                isDragDisabled={!canReprogram || atividade.status === 'concluido' || atividade.isLegacyExecution || isReprogramando === atividade.id}
              >
                {(provided, snapshot) => (
                  <ActivityItem
                    plano={atividade}
                    dayKey={dayKey}
                    onDelete={onActivityDelete}
                    executorMap={executorMap}
                    allPlanejamentos={allPlanejamentos}
                    provided={provided}
                    isDragging={snapshot.isDragging}
                    isReprogramando={isReprogramando === atividade.id}
                    isSelected={selectedActivities.has(atividade.id)}
                    onToggleSelect={onToggleSelect}
                    hasSelections={hasSelections}
                  />
                )}
              </Draggable>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-componente para Container de Atividades (reutilizável) ---
const ActivityContainer = ({ activities, containerClass = "", disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections }) => {
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const activityGroups = useMemo(() => {
    const groups = {};

    activities.forEach(atividade => {
      let groupKey;
      let empreendimentoParaGrupo;

      if (atividade.isLegacyExecution) {
        groupKey = `virtual-${atividade.executor_principal || 'sem-executor'}`;
        empreendimentoParaGrupo = { nome: 'Atividades Rápidas' };
      } else {
        const empKey = atividade.empreendimento_id || 'sem-empreendimento';
        const userKey = atividade.executor_principal || 'sem-executor';

        if (empKey === 'sem-empreendimento') {
          groupKey = `geral-${userKey}`;
          empreendimentoParaGrupo = atividade.empreendimento || { nome: 'Atividades Gerais' };
        } else {
          groupKey = `${empKey}|${userKey}`;
          empreendimentoParaGrupo = atividade.empreendimento;
        }
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          empreendimento: empreendimentoParaGrupo,
          executor: { email: atividade.executor_principal },
          atividades: []
        };
      }
      groups[groupKey].atividades.push(atividade);
    });

    return groups;
  }, [activities, dayKey]);

  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className={`space-y-1 ${containerClass}`}>
      {Object.entries(activityGroups).map(([groupKey, groupData]) => {
        // **CORRIGIDO**: Remover restrição de "Atividades Gerais", apenas bloquear "Atividades Rápidas" (Legado) e concluídas
        const canDragGroup = canReprogram &&
          groupData.empreendimento?.nome !== 'Atividades Rápidas' &&
          !groupData.atividades.some(a => a.status === 'concluido' || a.isLegacyExecution);

        // Se pode arrastar o grupo, envolve em Draggable
        if (canDragGroup) {
          return (
            <Draggable
              key={`group-${groupKey}-${dayKey}`}
              draggableId={`group-${groupKey}-${dayKey}`}
              index={0}
              isDragDisabled={!canDragGroup}
            >
              {(provided, snapshot) => (
                <DailyActivityGroup
                  empreendimento={groupData.empreendimento}
                  executor={groupData.executor}
                  atividades={groupData.atividades}
                  isExpanded={expandedGroups.has(groupKey)}
                  onToggle={() => toggleGroup(groupKey)}
                  disciplinas={disciplinas}
                  dayKey={dayKey}
                  onActivityDelete={onActivityDelete}
                  onShowPrevisao={onShowPrevisao}
                  executorMap={executorMap}
                  allPlanejamentos={allPlanejamentos}
                  isReprogramando={isReprogramando}
                  canReprogram={canReprogram}
                  selectedActivities={selectedActivities}
                  onToggleSelect={onToggleSelect}
                  hasSelections={hasSelections}
                  groupKey={groupKey}
                  provided={provided}
                  isDragging={snapshot.isDragging}
                />
              )}
            </Draggable>
          );
        } else {
          return (
            <DailyActivityGroup
              key={`group-${groupKey}-${dayKey}-static`}
              empreendimento={groupData.empreendimento}
              executor={groupData.executor}
              atividades={groupData.atividades}
              isExpanded={expandedGroups.has(groupKey)}
              onToggle={() => toggleGroup(groupKey)}
              disciplinas={disciplinas}
              dayKey={dayKey}
              onActivityDelete={onActivityDelete}
              onShowPrevisao={onShowPrevisao}
              executorMap={executorMap}
              allPlanejamentos={allPlanejamentos}
              isReprogramando={isReprogramando}
              canReprogram={canReprogram}
              selectedActivities={selectedActivities}
              onToggleSelect={onToggleSelect}
              hasSelections={hasSelections}
              groupKey={groupKey}
            />
          );
        }
      })}
    </div>
  );
};

// --- Sub-componente para Container de Atividades (reutilizável) ---
const DayCell = ({ day, dayActivities, date, isToday, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections }) => {
  const dayKey = format(day, 'yyyy-MM-dd');

  // **NOVO**: Verificar se pode arrastar o dia inteiro
  const hasMovableActivities = dayActivities.some(a =>
    !a.isLegacyExecution && // Exclude old quick activities (exec-)
    a.status !== 'concluido'
  );

  const canDragDay = canReprogram && hasMovableActivities && dayActivities.length > 0;

  return (
    <Droppable droppableId={dayKey}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`h-40 p-2 border border-gray-100 flex flex-col group ${ // ADDED group class here
            isSameMonth(day, date) ? 'bg-white' : 'bg-gray-50'
            } ${isToday ? 'border-2 border-blue-500 bg-blue-50' : ''}
            ${snapshot.isDraggingOver ? 'bg-purple-100' : ''}
          `}
        >
          {/* **NOVO**: Header do dia com drag handle */}
          <div className="flex items-center justify-between mb-2 relative"> {/* Added relative for absolute positioning inside */}
            {/* **NOVO**: Drag handle do dia inteiro */}
            {canDragDay && (
              <Draggable
                draggableId={`day-${dayKey}`}
                index={0}
                isDragDisabled={!canDragDay}
              >
                {(dayProvided, daySnapshot) => (
                  <div
                    ref={dayProvided.innerRef}
                    {...dayProvided.draggableProps}
                    className={`absolute top-0 left-0 right-0 z-20 ${daySnapshot.isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                  >
                    <div
                      {...dayProvided.dragHandleProps}
                      className={`flex items-center justify-center gap-2 p-1 rounded-b cursor-move ${daySnapshot.isDragging
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600'
                        }`}
                      title="🖐️ Arrastar todas as atividades deste dia"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5" />
                        <circle cx="15" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" />
                        <circle cx="15" cy="18" r="1.5" />
                      </svg>
                      <span className="text-xs font-bold">
                        {dayActivities.length} ativ.
                      </span>
                    </div>

                    {/* Badge quando arrastando */}
                    {daySnapshot.isDragging && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-30">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm font-bold">
                            Movendo {dayActivities.length} atividade{dayActivities.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-xs opacity-90 mt-1">
                          De {format(day, 'd MMM', { locale: ptBR })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Draggable>
            )}

            <span className={`font-semibold text-center flex-1 ${isSameMonth(day, date) ? 'text-gray-800' : 'text-gray-400'
              } ${isToday ? 'text-blue-700' : ''}`}>
              {format(day, 'd')}
            </span>
          </div>

          <div className="flex-grow overflow-y-auto pr-1">
            <ActivityContainer
              activities={dayActivities}
              disciplinas={disciplinas}
              dayKey={dayKey}
              onActivityDelete={onActivityDelete}
              onShowPrevisao={onShowPrevisao}
              executorMap={executorMap}
              allPlanejamentos={allPlanejamentos}
              isReprogramando={isReprogramando}
              canReprogram={canReprogram}
              selectedActivities={selectedActivities}
              onToggleSelect={onToggleSelect}
              hasSelections={hasSelections}
            />
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
};

// --- Sub-componente para a Visualização Mensal ---
const MonthView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections }) => {
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(date), { locale: ptBR });
    const end = endOfWeek(endOfMonth(date), { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [date]);

  const weekHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="grid grid-cols-7 border-t border-gray-100">
      {weekHeaders.map(day => (
        <div key={day} className="text-center font-medium text-sm text-gray-500 py-3 border-b border-gray-100 bg-gray-50">{day}</div>
      ))}
      {monthDays.map(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const dayActivities = activitiesByDay[dayKey] || [];
        const isToday = isSameDay(day, new Date());

        return (
          <DayCell
            key={dayKey}
            day={day}
            dayActivities={dayActivities}
            date={date}
            isToday={isToday}
            disciplinas={disciplinas}
            onActivityDelete={onActivityDelete}
            onShowPrevisao={onShowPrevisao}
            executorMap={executorMap}
            allPlanejamentos={allPlanejamentos}
            isReprogramando={isReprogramando}
            canReprogram={canReprogram}
            selectedActivities={selectedActivities}
            onToggleSelect={onToggleSelect}
            hasSelections={hasSelections}
          />
        );
      })}
    </div>
  );
};


// --- Sub-componente para a Visualização Semanal ---
const WeekView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections }) => {
  // NOVO: Estado para controlar o dia expandido
  const [expandedDay, setExpandedDay] = useState(null);

  const weekDays = useMemo(() => {
    const start = startOfWeek(date, { locale: ptBR });
    const end = endOfWeek(date, { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [date]);

  // NOVO: Função para alternar a expansão
  const toggleExpand = (dayKey) => {
    setExpandedDay(prev => (prev === dayKey ? null : dayKey));
  };

  return (
    <div className="flex border-t border-l border-gray-100 min-h-[60vh] bg-white">
      {weekDays.map(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const dayActivities = activitiesByDay[dayKey] || [];
        const isToday = isSameDay(day, new Date());
        const isExpanded = expandedDay === dayKey;

        return (
          <Droppable droppableId={dayKey} key={dayKey}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`
                  flex flex-col border-r border-gray-100 transition-all duration-300 ease-in-out
                  ${isExpanded ? 'flex-[2] min-w-[350px] bg-white shadow-2xl z-10' : 'flex-1 w-[14.28%] max-w-[200px]'}
                  ${isToday && !isExpanded ? 'bg-blue-50' : ''}
                  ${snapshot.isDraggingOver ? 'bg-purple-100' : 'bg-white'}
                `}
              >
                {/* Header do Dia Clicável */}
                <div
                  className={`flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 sticky top-0 z-10
                    ${isToday ? 'bg-blue-50' : 'bg-gray-50/50'}
                  `}
                  onClick={() => toggleExpand(dayKey)}
                >
                  <h3 className="font-semibold text-gray-700 capitalize">{format(day, 'EEE, d', { locale: ptBR })}</h3>
                  <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                </div>

                {/* Container das Atividades */}
                <div className={`flex-grow overflow-y-auto p-2`}>
                  <ActivityContainer
                    activities={dayActivities}
                    disciplinas={disciplinas}
                    dayKey={dayKey}
                    onActivityDelete={onActivityDelete}
                    onShowPrevisao={onShowPrevisao}
                    executorMap={executorMap}
                    allPlanejamentos={allPlanejamentos}
                    isReprogramando={isReprogramando}
                    canReprogram={canReprogram}
                    selectedActivities={selectedActivities}
                    onToggleSelect={onToggleSelect}
                    hasSelections={hasSelections}
                  />
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        );
      })}
    </div>
  );
};


// --- Sub-componente para a Visualização Diária ---
const DayView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections }) => {
  const dayKey = format(date, 'yyyy-MM-dd');
  const activities = activitiesByDay[dayKey] || [];

  return (
    <Droppable droppableId={dayKey}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`border-t border-gray-100 p-6 ${snapshot.isDraggingOver ? 'bg-purple-100' : ''}`}
        >
          <h2 className="text-2xl font-bold text-center mb-6">{format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</h2>
          <div className="max-w-4xl mx-auto">
            {activities.length > 0 ? (
              <ActivityContainer
                activities={activities}
                containerClass="space-y-4"
                disciplinas={disciplinas}
                dayKey={dayKey}
                onActivityDelete={onActivityDelete}
                onShowPrevisao={onShowPrevisao}
                executorMap={executorMap}
                allPlanejamentos={allPlanejamentos}
                isReprogramando={isReprogramando}
                canReprogram={canReprogram}
                selectedActivities={selectedActivities}
                onToggleSelect={onToggleSelect}
                hasSelections={hasSelections}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                Nenhuma atividade planejada para este dia.
              </div>
            )}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
};


// --- Componente Principal ---
export default function CalendarioPlanejamento({ usuarios, disciplinas, onRefresh, isDashboardRefreshing }) {
  const { user, userProfile, isColaborador, isGestao, hasPermission, triggerUpdate, perfilAtual, updateKey } = useContext(ActivityTimerContext);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');

  // **MODIFICADO**: Verificar se é apoio
  const isApoio = perfilAtual === 'apoio';

  // **MODIFICADO**: Verificar lista de usuários permitidos
  const usuariosPermitidos = userProfile?.usuarios_permitidos_visualizar || [];
  const podeVisualizarOutros = usuariosPermitidos.length > 0;

  // Debug log do userProfile
  console.log('👤 UserProfile no CalendarioPlanejamento:', {
    user: user?.email,
    userProfile,
    usuarios_permitidos_visualizar: userProfile?.usuarios_permitidos_visualizar,
    usuariosPermitidos,
    podeVisualizarOutros,
    perfilAtual,
    isColaborador,
    isGestao,
    isApoio,
    updateKey
  });

  // **CRÍTICO**: Se userProfile é null mas temos um usuário logado, alertar
  if (!userProfile && user?.email) {
    console.warn('⚠️ ATENÇÃO: userProfile está null, mas temos usuário logado. Isso pode indicar que o usuário não tem registro na entidade Usuario.');
  }

  // **MODIFICADO**: Se for gestão OU apoio (sem permissão especial), já inicia com o próprio email selecionado
  const [filters, setFilters] = useState({
    user: '', // Será definido no useEffect se for gestão ou apoio sem permissão
    discipline: 'all'
  });

  // NOVO: Estados locais para dados do calendário e loading
  const [planejamentos, setPlanejamentos] = useState([]);
  const [execucoes, setExecucoes] = useState([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [enrichedData, setEnrichedData] = useState([]);

  const [showPrevisaoModal, setShowPrevisaoModal] = useState(false);
  const [planejamentosParaPrevisao, setPlanejamentosParaPrevisao] = useState([]);
  const [isReprogramando, setIsReprogramando] = useState(null);

  const hasSelectedUser = !!filters.user;
  const isViewingAllUsers = filters.user === 'all';

  // **MODIFICADO**: useEffect para auto-selecionar usuário se for gestão, colaborador OU apoio (sem permissão especial)
  useEffect(() => {
    // Verifica se tem usuários permitidos
    const usuariosPermitidos = userProfile?.usuarios_permitidos_visualizar || [];
    const temPermissao = usuariosPermitidos.length > 0;

    if ((isGestao || isColaborador || isApoio) && !temPermissao && user?.email && !filters.user) {
      const tipoUsuario = isGestao ? 'gestão' : isColaborador ? 'colaborador' : 'apoio';
      console.log(`🔒 Perfil ${tipoUsuario} detectado (sem permissão especial) - auto-selecionando próprio usuário: ${user.email}`);
      setFilters(prev => ({ ...prev, user: user.email }));
    }
  }, [isGestao, isColaborador, isApoio, userProfile?.usuarios_permitidos_visualizar, user?.email, filters.user]);

  const executorMap = useMemo(() => {
    return usuarios.reduce((acc, u) => {
      if (u.email) acc[u.email] = u;
      return acc;
    }, {});
  }, [usuarios]);

  // **NOVO**: Estado para seleção múltipla
  const [selectedActivities, setSelectedActivities] = useState(new Set());

  // NOVO: Função para carregar dados do calendário sob demanda
  const loadCalendarData = useCallback(async (userFilter) => {
    if (!userFilter) {
      setPlanejamentos([]);
      setExecucoes([]);
      setEnrichedData([]); // Clear enriched data as well
      return;
    }

    setIsCalendarLoading(true);
    try {
      console.log(`📅 Carregando dados do calendário para: ${userFilter}`);

      const planFilter = userFilter !== 'all' ? { executor_principal: userFilter } : {};
      const execFilter = userFilter !== 'all' ? { usuario: userFilter } : {};

      const [planosAtividade, planosDocumento, execs] = await Promise.all([
        retryWithBackoff(() => PlanejamentoAtividade.filter(planFilter), 3, 1500, 'calendar.loadPlansAtividade'),
        retryWithBackoff(() => PlanejamentoDocumento.filter(planFilter), 3, 1500, 'calendar.loadPlansDocumento'),
        retryWithBackoff(() => Execucao.filter(execFilter), 3, 1500, 'calendar.loadExecs')
      ]);

      const planosAtividadeComTipo = (planosAtividade || []).map(p => ({ ...p, tipo_planejamento: 'atividade' }));
      const planosDocumentoComTipo = (planosDocumento || []).map(p => ({ ...p, tipo_planejamento: 'documento' }));
      const todosPlanejamentos = [...planosAtividadeComTipo, ...planosDocumentoComTipo];

      console.log(`✅ Dados carregados: ${todosPlanejamentos.length} planejamentos, ${execs?.length || 0} execuções`);

      setPlanejamentos(todosPlanejamentos);
      setExecucoes(execs || []);

    } catch (error) {
      console.error("❌ Erro ao carregar dados do calendário:", error);
      setPlanejamentos([]);
      setExecucoes([]);
      setEnrichedData([]); // Clear enriched data on error
      alert("Erro ao carregar as atividades do calendário. Tente atualizar a página.");
    } finally {
      setIsCalendarLoading(false); // Ensure loading state is reset
    }
  }, []);

  // NOVO: useEffect para disparar o carregamento de dados quando o filtro de usuário mudar OU quando updateKey mudar
  useEffect(() => {
    if (hasSelectedUser) {
      console.log(`🔄 Filtro de usuário mudou para: ${filters.user} ou updateKey: ${updateKey}`);
      loadCalendarData(filters.user);
    } else {
      console.log(`⚪ Nenhum usuário selecionado - limpando dados do calendário`);
      setPlanejamentos([]);
      setExecucoes([]);
      setEnrichedData([]); // Clear enriched data when no user is selected
      setIsCalendarLoading(false);
    }
  }, [filters.user, hasSelectedUser, loadCalendarData, updateKey]);

  // NOVO: useEffect para enriquecer os dados quando eles são carregados
  useEffect(() => {
    const enrichData = async () => {
      if (!planejamentos) {
        setEnrichedData([]);
        return;
      }

      if (planejamentos.length === 0 && execucoes.length === 0 && !isCalendarLoading) { // Only clear if not currently loading fresh data
        setEnrichedData([]);
        return;
      }

      try {
        const empreendimentoIds = [...new Set(planejamentos.map(p => p.empreendimento_id).filter(Boolean))];
        const atividadeIds = [...new Set(planejamentos.map(p => p.atividade_id).filter(Boolean))];
        const documentoIds = [...new Set(planejamentos.map(p => p.documento_id).filter(Boolean))];
        const planejamentoIds = planejamentos.map(p => p.id).filter(Boolean);

        const [empreendimentosData, atividadesData, documentosData, execucoesData] = await Promise.all([
          empreendimentoIds.length > 0 ? retryWithBackoff(() => Empreendimento.filter({ id: { $in: empreendimentoIds } }), 3, 1000, 'enrich.empreendimentos') : Promise.resolve([]),
          atividadeIds.length > 0 ? retryWithBackoff(() => Atividade.filter({ id: { $in: atividadeIds } }), 3, 1000, 'enrich.atividades') : Promise.resolve([]),
          documentoIds.length > 0 ? retryWithBackoff(() => Documento.filter({ id: { $in: documentoIds } }), 3, 1000, 'enrich.documentos') : Promise.resolve([]),
          planejamentoIds.length > 0 ? retryWithBackoff(() => Execucao.filter({ planejamento_id: { $in: planejamentoIds } }), 3, 1000, 'enrich.execucoes') : Promise.resolve([])
        ]);

        const empreendimentosMap = new Map((empreendimentosData || []).map(item => [item.id, item]));
        const atividadesMap = new Map((atividadesData || []).map(item => [item.id, item]));
        const documentosMap = new Map((documentosData || []).map(item => [item.id, item]));

        // Calcular horas executadas por dia para cada planejamento
        const horasExecutadasPorPlanejamento = {};
        (execucoesData || []).forEach(exec => {
          if (!exec.planejamento_id || !exec.inicio) return;

          // Usar a data de início da execução
          const diaExec = format(parseLocalDate(exec.inicio), 'yyyy-MM-dd');
          const tempoExec = Number(exec.tempo_total) || 0;

          if (!horasExecutadasPorPlanejamento[exec.planejamento_id]) {
            horasExecutadasPorPlanejamento[exec.planejamento_id] = {};
          }

          horasExecutadasPorPlanejamento[exec.planejamento_id][diaExec] =
            (horasExecutadasPorPlanejamento[exec.planejamento_id][diaExec] || 0) + tempoExec;
        });

        const finalData = planejamentos.map(plano => ({
          ...plano,
          empreendimento: empreendimentosMap.get(plano.empreendimento_id) || null,
          atividade: atividadesMap.get(plano.atividade_id) || null,
          documento: documentosMap.get(plano.documento_id) || null,
          horas_executadas_por_dia: horasExecutadasPorPlanejamento[plano.id] || {},
        }));

        setEnrichedData(finalData);

      } catch (error) {
        console.error("❌ Erro ao enriquecer dados do calendário:", error);
        setEnrichedData(planejamentos);
      }
    };

    enrichData();
  }, [planejamentos, execucoes, isCalendarLoading]); // Added isCalendarLoading to dependencies for consistency

  const handleActivityDelete = useCallback(() => {
    if (hasSelectedUser) {
      loadCalendarData(filters.user);
    }
    if (triggerUpdate) {
      triggerUpdate();
    }
  }, [triggerUpdate, hasSelectedUser, filters.user, loadCalendarData]);

  // **NOVO**: Função para alternar seleção de atividade
  const toggleActivitySelection = useCallback((activityId) => {
    setSelectedActivities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  }, []);

  // **NOVO**: Função para limpar seleção
  const clearSelection = useCallback(() => {
    setSelectedActivities(new Set());
  }, []);

  // **NOVO**: Função para reprogramar atividade
  const handleReprogramarAtividade = useCallback(async (atividadeId, novaDataInicio, executorEmail) => {
    setIsReprogramando(atividadeId);
    try {
      const atividadeParaMover = (enrichedData || []).find(p => p.id === atividadeId);
      if (!atividadeParaMover) {
        throw new Error("Atividade não encontrada para reprogramar.");
      }

      if (atividadeParaMover.isLegacyExecution) {
        throw new Error("Atividades rápidas antigas (não planejadas) não podem ser reprogramadas via arrastar e soltar.");
      }
      if (atividadeParaMover.status === 'concluido') {
        throw new Error("Atividades concluídas não podem ser reprogramadas.");
      }

      // Determinar a entidade correta baseada no tipo de planejamento
      const entidadePlanejamento = atividadeParaMover.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;

      // 2. Buscar TODOS os planejamentos do executor para calcular a carga
      // Filtra por executor principal e atividades não concluídas
      const planejamentosDoExecutor = (await retryWithBackoff(() => entidadePlanejamento.filter({ executor_principal: executorEmail }), 3, 1000, `fetchPlansForReprogram`))
        .filter(p => p.status !== 'concluido' && !p.isLegacyExecution);

      // 3. Montar o objeto de carga diária, EXCLUINDO a atividade que está sendo movida
      const cargaDiariaExistente = {};
      planejamentosDoExecutor.forEach(p => {
        if (p.id !== atividadeId && p.horas_por_dia) {
          Object.entries(p.horas_por_dia).forEach(([data, horas]) => {
            cargaDiariaExistente[data] = (cargaDiariaExistente[data] || 0) + Number(horas || 0);
          });
        }
      });

      // 4. Calcular a nova distribuição
      const { distribuicao, dataTermino } = distribuirHorasPorDias(
        parseLocalDate(novaDataInicio),
        atividadeParaMover.tempo_planejado,
        8, // Limite diário de 8h
        cargaDiariaExistente
      );

      if (Object.keys(distribuicao).length === 0) {
        throw new Error("Não foi possível alocar horas para a nova data. Verifique a capacidade do executor ou o tempo planejado da atividade.");
      }

      // 5. Preparar os dados para atualização
      const inicioPlanejado = Object.keys(distribuicao).sort()[0];
      const terminoPlanejado = dataTermino ? format(dataTermino, 'yyyy-MM-dd') : inicioPlanejado;

      const dadosUpdate = {
        inicio_planejado: inicioPlanejado,
        termino_planejado: terminoPlanejado,
        horas_por_dia: distribuicao,
        // Opcional: resetar datas ajustadas se existirem
        inicio_ajustado: null,
        termino_ajustado: null,
      };

      // 6. Atualizar a atividade no banco de dados, usando a entidade correta
      await retryWithBackoff(() => entidadePlanejamento.update(atividadeId, dadosUpdate), 3, 1500, `updateReprogrammedPlan`);

      console.log(`Atividade "${atividadeParaMover.atividade?.atividade || atividadeParaMover.descritivo || atividadeParaMover.documento?.numero_completo}" reprogramada com sucesso!`);

      // 7. Disparar refresh para buscar os dados mais recentes
      if (hasSelectedUser) {
        loadCalendarData(filters.user);
      }
      if (triggerUpdate) {
        triggerUpdate();
      }

    } catch (error) {
      console.error("❌ Erro ao reprogramar atividade:", error);
      alert(`Erro ao reprogramar atividade: ${error.message}`);
      throw error; // Re-throw to allow catch in onDragEnd for bulk operations
    } finally {
      setIsReprogramando(null);
    }
  }, [enrichedData, triggerUpdate, hasSelectedUser, filters.user, loadCalendarData]);

  // **MODIFICADO**: onDragEnd para detectar arraste de dia inteiro
  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    // **CORRIGIDO**: Usar hasPermission do context para Admin
    if (!hasPermission('admin')) {
      alert("Você não tem permissão para replanejar atividades.");
      return;
    }

    if (destination.droppableId === source.droppableId) {
      console.log(`Item ${draggableId} movido dentro do mesmo dia. Nenhuma ação de reprogramação.`);
      return;
    }

    // **NOVO**: Detectar se é um arraste de dia inteiro
    const isDayDrag = draggableId.startsWith('day-');

    if (isDayDrag) {
      // **NOVO**: Extrair o dia de origem
      const sourceDayKey = draggableId.replace('day-', '');
      const dayActivities = activitiesByDay[sourceDayKey] || [];

      console.log(`📅 [DIA COMPLETO] Iniciando movimentação do dia ${sourceDayKey} para ${destination.droppableId}`);
      console.log(`📦 Total de atividades no dia: ${dayActivities.length}`);

      // Filtrar apenas atividades que podem ser movidas
      const movableActivities = dayActivities.filter(a => {
        const canMove = !a.isLegacyExecution && a.status !== 'concluido';
        console.log(`   - ${a.descritivo || a.atividade?.atividade || 'Sem nome'}: ${canMove ? '✅ PODE MOVER' : '❌ NÃO PODE'} (isLegacy: ${a.isLegacyExecution}, status: ${a.status})`);
        return canMove;
      });

      console.log(`✅ Atividades que PODEM ser movidas: ${movableActivities.length}`);

      if (movableActivities.length === 0) {
        alert("Nenhuma atividade deste dia pode ser movida (todas estão concluídas ou são execuções antigas).");
        return;
      }

      // Confirmar ação
      const confirmed = window.confirm(
        `Deseja mover todas as ${movableActivities.length} atividade(s) de ${format(parseISO(sourceDayKey), 'd MMM', { locale: ptBR })} para ${format(parseISO(destination.droppableId), 'd MMM', { locale: ptBR })}?`
      );

      if (!confirmed) {
        console.log('❌ Usuário cancelou a operação');
        return;
      }

      // **CORRIGIDO**: Mover atividades em SEQUÊNCIA (não paralelo) para evitar rate limit
      const moveDayActivities = async () => {
        console.log(`🚀 Iniciando movimentação de ${movableActivities.length} atividades...`);
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < movableActivities.length; i++) {
          const atividade = movableActivities[i];
          console.log(`\n📍 [${i + 1}/${movableActivities.length}] Movendo: ${atividade.descritivo || atividade.atividade?.atividade || 'Sem nome'}`);

          try {
            await handleReprogramarAtividade(
              atividade.id,
              destination.droppableId,
              atividade.executor_principal
            );
            successCount++;
            console.log(`   ✅ Movida com sucesso!`);

            // Pequeno delay entre atividades para evitar rate limit (500ms)
            if (i < movableActivities.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            errorCount++;
            console.error(`   ❌ Erro ao mover atividade:`, error);
          }
        }

        console.log(`\n📊 RESULTADO FINAL:`);
        console.log(`   ✅ Sucesso: ${successCount}`);
        console.log(`   ❌ Erros: ${errorCount}`);

        if (successCount > 0) {
          alert(`✅ ${successCount} atividade(s) do dia foram reprogramadas com sucesso!${errorCount > 0 ? `\n⚠️ ${errorCount} falharam (veja o console)` : ''}`);
          clearSelection();
        } else {
          alert(`❌ Nenhuma atividade pôde ser movida. Verifique o console para mais detalhes.`);
        }
      };

      moveDayActivities();
      return;
    }

    // **EXISTENTE**: Detectar se é um grupo sendo arrastado
    const isGroupDrag = draggableId.startsWith('group-');

    if (isGroupDrag) {
      const parts = draggableId.replace('group-', '').split('-');
      const sourceDayKey = parts.pop();
      const groupKey = parts.join('-');

      const allActivitiesInSourceDay = (activitiesByDay[source.droppableId] || []);

      let groupActivities = [];

      if (groupKey.startsWith('virtual-')) {
        const executorEmail = groupKey.replace('virtual-', '');
        groupActivities = allActivitiesInSourceDay.filter(a => a.isLegacyExecution && a.executor_principal === executorEmail);
      } else if (groupKey.startsWith('geral-')) {
        const executorEmail = groupKey.replace('geral-', '');
        groupActivities = allActivitiesInSourceDay.filter(a => !a.empreendimento_id && a.executor_principal === executorEmail && !a.isLegacyExecution);
      } else {
        const [empId, executorEmail] = groupKey.split('|');
        groupActivities = allActivitiesInSourceDay.filter(a =>
          a.empreendimento_id === empId &&
          a.executor_principal === executorEmail &&
          !a.isLegacyExecution
        );
      }

      console.log(`➡️ Movendo grupo com ${groupActivities.length} atividade(s) de ${source.droppableId} para ${destination.droppableId}`);

      const invalidActivities = groupActivities.filter(a =>
        a.isLegacyExecution || a.status === 'concluido'
      );

      if (invalidActivities.length > 0) {
        alert("Algumas atividades do grupo não podem ser reprogramadas (concluídas ou execuções antigas).");
        return;
      }

      const moveGroupActivities = async () => {
        let successCount = 0;
        let errorCount = 0;

        for (const atividade of groupActivities) {
          try {
            await handleReprogramarAtividade(atividade.id, destination.droppableId, atividade.executor_principal);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            errorCount++;
            console.error("Erro ao mover atividade do grupo:", error);
          }
        }

        if (successCount > 0) {
          alert(`✅ ${successCount} atividade(s) do grupo foram reprogramadas!${errorCount > 0 ? `\n⚠️ ${errorCount} falharam` : ''}`);
          clearSelection();
        } else {
          alert(`❌ Erro ao mover atividades do grupo. Verifique o console.`);
        }
      };

      moveGroupActivities();
      return;
    }

    // **EXISTENTE**: Lógica para arrastar atividades individuais ou múltiplas selecionadas
    const activitiesToMove = selectedActivities.has(draggableId) && selectedActivities.size > 1
      ? Array.from(selectedActivities)
      : [draggableId];

    console.log(`➡️ Movendo ${activitiesToMove.length} atividade(s) de ${source.droppableId} para ${destination.droppableId}`);

    const invalidActivities = activitiesToMove.filter(id => {
      const atividade = (enrichedData || []).find(p => p.id === id);
      return !atividade || atividade.isLegacyExecution || atividade.status === 'concluido';
    });

    if (invalidActivities.length > 0) {
      alert("Algumas atividades selecionadas não podem ser reprogramadas (concluídas, execuções antigas, ou não são planejamentos).");
      return;
    }

    const moveActivities = async () => {
      let successCount = 0;
      let errorCount = 0;

      for (const activityId of activitiesToMove) {
        const atividadeMovida = (enrichedData || []).find(p => p.id === activityId);
        if (!atividadeMovida) {
          console.warn(`Atividade ${activityId} não encontrada para mover.`);
          continue;
        }

        try {
          await handleReprogramarAtividade(activityId, destination.droppableId, atividadeMovida.executor_principal);
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          errorCount++;
          console.error("Erro ao mover atividade:", error);
        }
      }

      if (successCount > 0) {
        alert(`✅ ${successCount} atividade(s) foram reprogramadas!${errorCount > 0 ? `\n⚠️ ${errorCount} falharam` : ''}`);
        clearSelection();
      } else {
        alert(`❌ Erro ao mover atividades. Verifique o console.`);
      }
    };

    moveActivities();
  };


  // **MODIFICADO**: Filtros agora aplicados sobre o estado local 'planejamentos'
  const filteredPlanejamentos = useMemo(() => {
    if (!hasSelectedUser) return [];

    let basePlanejamentos = enrichedData || []; // Usa o estado local ENRIQUECIDO

    // O filtro de usuário já foi aplicado na busca, então só aplicamos o de disciplina
    if (filters.discipline !== 'all') {
      return basePlanejamentos.filter(item => {
        // Se for um planejamento de documento sem atividade associada, não o filtra por disciplina.
        // Caso contrário, filtra pela disciplina da atividade.
        if (item.tipo_planejamento === 'documento' && item.atividade_id === null) {
          // If a document planning has no associated activity, its subdisciplinas are the primary categorisation.
          // So, if discipline filter is active, we check if any of the document's subdisciplines match.
          if (item.documento?.subdisciplinas && item.documento.subdisciplinas.includes(filters.discipline)) {
            return true;
          }
          return false; // Document plans without matching subdisciplines are filtered out.
        }
        return item.atividade?.disciplina === filters.discipline;
      });
    }

    return basePlanejamentos;
  }, [enrichedData, filters.discipline, hasSelectedUser]);

  const activitiesByDay = useMemo(() => {
    if (!hasSelectedUser) return {};

    const grouped = {};
    const processedPlanIds = new Set(); // Para não duplicar com execuções

    // 1. Processar todos os planejamentos (atividades planejadas, planejamentos de documento e rápidas com planejamento)
    filteredPlanejamentos.forEach(plano => {
      processedPlanIds.add(plano.id);

      // Determinar em quais dias a atividade deve aparecer
      // Para atividades rápidas: aparecer APENAS nos dias em que foi EXECUTADA (horas_executadas_por_dia)
      // Para atividades concluídas: aparecer nos dias em que foi EXECUTADA (horas_executadas_por_dia)
      // Para atividades não concluídas: aparecer nos dias PLANEJADOS (horas_por_dia)

      const diasParaExibir = new Set();
      const isQuickActivity = plano.is_quick_activity || plano.isQuickActivity;

      // Para atividades rápidas (concluídas ou não), usar APENAS horas_executadas_por_dia
      // Atividades rápidas não têm planejamento de dias - aparecem onde foram executadas
      if (isQuickActivity) {
        if (plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object') {
          Object.keys(plano.horas_executadas_por_dia).forEach(dayKey => {
            const horasExec = Number(plano.horas_executadas_por_dia[dayKey]) || 0;
            // Só mostrar no dia se houver horas significativas (> 0.01h = 36 segundos)
            // Isso evita mostrar atividades em dias onde só houve execuções muito curtas
            if (horasExec > 0.01) {
              diasParaExibir.add(dayKey);
            }
          });
        }
        // NÃO usar horas_por_dia para atividades rápidas - esse campo pode conter dados incorretos
      } else {
        // Para atividades normais (não rápidas)
        // Se a atividade foi executada, adicionar os dias com execução real
        if (plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object') {
          Object.keys(plano.horas_executadas_por_dia).forEach(dayKey => {
            const horasExec = Number(plano.horas_executadas_por_dia[dayKey]) || 0;
            if (horasExec > 0) {
              diasParaExibir.add(dayKey);
            }
          });
        }

        // Se não foi concluída OU não tem execuções, usar dias planejados
        if (plano.status !== 'concluido' || diasParaExibir.size === 0) {
          if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') {
            Object.keys(plano.horas_por_dia).forEach(dayKey => {
              const horas = Number(plano.horas_por_dia[dayKey]) || 0;
              if (horas > 0) {
                diasParaExibir.add(dayKey);
              }
            });
          }
        }
      }

      // Adicionar a atividade nos dias determinados
      diasParaExibir.forEach(dayKey => {
        if (!grouped[dayKey]) {
          grouped[dayKey] = [];
        }

        if (!grouped[dayKey].some(item => item.id === plano.id)) {
          const planoParaExibir = {
            ...plano,
            // Detecta apenas atividades rápidas com flag explícita
            isQuickActivity: !!plano.is_quick_activity,
            isLegacyExecution: false, // Explicitly set to false for actual PlanejamentoAtividade
          };
          grouped[dayKey].push(planoParaExibir);
        }
      });
    });

    // 2. Processar execuções muito antigas (sem planejamento associado ou não encontradas em planejamentos)
    (execucoes || []).forEach(exec => {
      if (exec.planejamento_id && processedPlanIds.has(exec.planejamento_id)) {
        return;
      }

      const diaExecucao = exec.inicio ? startOfDay(parseLocalDate(exec.inicio)) : null;
      if (diaExecucao && isValid(diaExecucao)) {
        const dayKey = format(diaExecucao, 'yyyy-MM-dd');
        if (!grouped[dayKey]) grouped[dayKey] = [];

        // Cria um "plano virtual" apenas para execuções antigas sem planejamento
        const legacyExecPlano = {
          id: `exec-${exec.id}`, // ID único para evitar colisões com PlanejamentoAtividade
          descritivo: exec.descritivo || 'Atividade rápida antiga', // Specific description
          tempo_executado: exec.tempo_total || 0,
          tempo_planejado: exec.tempo_total || 0, // Considera o tempo executado como o planejado
          status: exec.status === 'Finalizado' ? 'concluido' : 'pausado',
          executor_principal: exec.usuario,
          inicio_planejado: dayKey, // Apenas para este dia
          termino_planejado: dayKey,
          horas_por_dia: { [dayKey]: exec.tempo_total || 0 },
          isLegacyExecution: true, // Flag to identify as an old execution
          tipo_planejamento: 'atividade', // Treat as activity for consistency in timer
        };

        if (!grouped[dayKey].some(item => item.id === legacyExecPlano.id)) {
          grouped[dayKey].push(legacyExecPlano);
        }
      }
    });

    // Ordenar atividades dentro de cada dia
    for (const dayKey in grouped) {
      grouped[dayKey].sort((a, b) => {
        // Atividades legadas e concluídas por último
        if (a.isLegacyExecution && !b.isLegacyExecution) return 1;
        if (!a.isLegacyExecution && b.isLegacyExecution) return -1;

        const statusA = calculateActivityStatus(a, filteredPlanejamentos);
        const statusB = calculateActivityStatus(b, filteredPlanejamentos);

        if (statusA === 'concluido' && statusB !== 'concluido') return 1;
        if (statusA !== 'concluido' && statusB === 'concluido') return -1;

        if (statusA === 'pausado' && statusB === 'em_andamento') return 1;
        if (statusA !== 'pausado' && statusB === 'em_andamento') return -1;

        // Em seguida, pelo horário de início planejado (más cedo primeiro)
        const inicioA = a.inicio_planejado ? parseISO(a.inicio_planejado) : null;
        const inicioB = b.inicio_planejado ? parseISO(b.inicio_planejado) : null;
        if (inicioA && inicioB) {
          if (inicioA.getTime() < inicioB.getTime()) return -1;
          if (inicioA.getTime() > inicioB.getTime()) return 1;
        } else if (inicioA) {
          return -1; // Atividades com data de início vêm antes daquelas sem
        } else if (inicioB) {
          return 1;
        }

        // Finalmente, por nome
        const nameA = a.atividade?.atividade || a.documento?.numero_completo || a.descritivo || '';
        const nameB = b.atividade?.atividade || b.documento?.numero_completo || b.descritivo || '';
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });
    }

    return grouped;
  }, [filteredPlanejamentos, execucoes, hasSelectedUser]);

  const cargaDiariaPorUsuario = useMemo(() => {
    if (!hasSelectedUser) return {};

    const carga = {};
    filteredPlanejamentos.forEach(plano => {
      const userEmail = plano.executor_principal;
      if (!userEmail) return;
      if (!carga[userEmail]) carga[userEmail] = {};

      if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') {
        Object.entries(plano.horas_por_dia).forEach(([data, horas]) => {
          carga[userEmail][data] = (carga[userEmail][data] || 0) + Number(horas);
        });
      }
    });

    // Adicionar carga de execuções virtuais (legadas)
    (execucoes || []).forEach(exec => {
      // Somente execuções que não estão ligadas a um planejamento existente já considerado
      if (!(exec.planejamento_id && filteredPlanejamentos.some(p => p.id === exec.planejamento_id))) {
        const userEmail = exec.usuario;
        const dayKey = exec.inicio ? format(startOfDay(parseLocalDate(exec.inicio)), 'yyyy-MM-dd') : null;
        if (userEmail && dayKey) {
          if (!carga[userEmail]) carga[userEmail] = {};
          carga[userEmail][dayKey] = (carga[userEmail][dayKey] || 0) + (exec.tempo_total || 0);
        }
      }
    });

    return carga;
  }, [filteredPlanejamentos, execucoes, hasSelectedUser]);

  // Funções de navegação
  const handleDateChange = (direction) => {
    const changeFn = direction === 'next'
      ? { month: addMonths, week: addWeeks, day: addDays }
      : { month: subMonths, week: subWeeks, day: subDays };

    setCurrentDate(current => changeFn[viewMode](current, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  // Formatar o título do cabeçalho
  const headerTitle = useMemo(() => {
    switch (viewMode) {
      case 'month': return format(currentDate, 'MMMM yyyy', { locale: ptBR });
      case 'week':
        const start = startOfWeek(currentDate, { locale: ptBR });
        const end = endOfWeek(currentDate, { locale: ptBR });
        return `${format(start, 'd MMM')} - ${format(end, 'd MMM, yyyy', { locale: ptBR })}`;
      case 'day': return format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR });
      default: return '';
    }
  }, [currentDate, viewMode]);

  const handleClearFilters = () => {
    // **MODIFICADO**: Gestão, Colaboradores e APOIO (sem permissão especial) não podem limpar o filtro de usuário
    const usuariosPermitidos = userProfile?.usuarios_permitidos_visualizar || [];
    const temPermissao = usuariosPermitidos.length > 0;

    if ((isGestao || isColaborador || isApoio) && !temPermissao) {
      const tipoUsuario = isGestao ? 'gestão' : isColaborador ? 'colaborador' : 'apoio';
      console.log(`🔒 Perfil ${tipoUsuario} não pode limpar filtro de usuário`);
      setFilters(prev => ({ ...prev, discipline: 'all' })); // Só limpa disciplina
      clearSelection();
      return;
    }

    console.log('🧹 Limpando filtros e seleção de usuário...');
    setFilters({
      user: '', // Limpa seleção de usuário
      discipline: 'all'
    });
    clearSelection();
  };

  const handleShowPrevisao = (planos) => {
    setPlanejamentosParaPrevisao(planos);
    setShowPrevisaoModal(true);
  };

  const selectedUserName = isViewingAllUsers
    ? 'Todos os Usuários'
    : executorMap[filters.user]?.nome || filters.user;

  // **MODIFICADO**: Usa o estado de loading do calendário
  const totalLoading = isDashboardRefreshing || isCalendarLoading;

  // **MODIFICADO**: Permissão para replanejamento agora usa o hook hasPermission
  const canReprogram = hasPermission('admin');

  // **MODIFICADO**: renderContent para passar props de seleção
  const renderContent = () => {
    if (!hasSelectedUser) {
      return (
        <div className="p-12 text-center min-h-[400px] flex flex-col justify-center items-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Selecione um Usuário</h3>
          <p className="text-gray-500 mb-6">
            Para começar, selecione um usuário no filtro acima para carregar o calendário.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-blue-700 text-sm">
              💡 <strong>Dica:</strong> Para ver as atividades de todos, selecione "Todos os Usuários".
            </p>
          </div>
        </div>
      );
    }

    if (totalLoading) {
      return (
        <div className="flex justify-center items-center h-[400px]">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="ml-3 text-lg text-gray-600">Carregando atividades do calendário...</p>
        </div>
      );
    }

    const hasSelections = selectedActivities.size > 0;

    // **MODIFICADO**: Passa 'enrichedData' (que são todos) para as views em vez de 'planejamentos'
    if (viewMode === 'month') return <MonthView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} />;
    if (viewMode === 'week') return <WeekView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} />;
    if (viewMode === 'day') return <DayView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} />;
    return null;
  };

  // **MODIFICADO**: Refresh agora recarrega os dados do calendário se um usuário estiver selecionado
  const refreshAll = () => {
    if (onRefresh) {
      onRefresh();
    }
    if (hasSelectedUser) {
      loadCalendarData(filters.user);
    }
  };

  return (
    <>
      <Card className="bg-white shadow-lg border-0 h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-gray-900 capitalize">
              <Calendar className="w-6 h-6 text-blue-600" />
              {hasSelectedUser ? (
                `Calendário - ${selectedUserName} (${filteredPlanejamentos.length})`
              ) : (
                'Calendário de Planejamento'
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* **NOVO**: Mostrar contador e botão de limpar quando há seleções */}
              {selectedActivities.size > 0 && (
                <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-sm font-medium text-indigo-700">
                    {selectedActivities.size} selecionada{selectedActivities.size > 1 ? 's' : ''}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
                  >
                    Limpar
                  </Button>
                </div>
              )}
              {hasSelectedUser && (
                <>
                  {(!isColaborador && !isApoio) && (
                    <Button variant="outline" onClick={() => setShowPrevisaoModal(true)}>
                      <LineChart className="w-4 h-4 mr-2" />
                      Previsão de Entrega
                    </Button>
                  )}
                  <Button variant="outline" onClick={refreshAll} disabled={totalLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${totalLoading ? 'animate-spin' : ''}`} />
                    {totalLoading ? "Atualizando..." : "Atualizar"}
                  </Button>
                  <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDateChange('prev')}><ChevronLeft className="w-5 h-5" /></Button>
                  <h3 className="text-xl font-semibold w-64 text-center capitalize">{headerTitle}</h3>
                  <Button variant="ghost" size="icon" onClick={() => handleDateChange('next')}><ChevronRight className="w-5 h-5" /></Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CalendarFilters
          users={usuarios}
          disciplines={disciplinas}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          filters={filters}
          podeVerOutros={podeVisualizarOutros}
          currentUserEmail={user?.email}
          onFilterChange={(key, value) => {
            // **MODIFICADO**: Gestão, Colaboradores e APOIO (sem permissão especial) não podem mudar de usuário
            const usuariosPermitidosLocal = userProfile?.usuarios_permitidos_visualizar || [];
            const temPermissao = usuariosPermitidosLocal.length > 0;

            console.log('🔄 onFilterChange:', { key, value, temPermissao, usuariosPermitidos: usuariosPermitidosLocal });

            if ((isGestao || isColaborador || isApoio) && !temPermissao && key === 'user') {
              const tipoUsuario = isGestao ? 'gestão' : isColaborador ? 'colaborador' : 'apoio';
              console.log(`🔒 Perfil ${tipoUsuario} não pode mudar de usuário`);
              return;
            }
            setFilters(prev => ({ ...prev, [key]: value }));
          }}
          onClearFilters={handleClearFilters}
          hasSelectedUser={hasSelectedUser}
          isColaborador={isColaborador}
          isViewingAllUsers={isViewingAllUsers}
          isGestao={isGestao}
          isApoio={isApoio}
          usuariosPermitidos={usuariosPermitidos}
        />
        <DragDropContext onDragEnd={onDragEnd}>
          <CardContent className="p-0 flex-1">
            {renderContent()}
          </CardContent>
        </DragDropContext>
      </Card>

      {hasSelectedUser && (
        <PrevisaoEntregaModal
          isOpen={showPrevisaoModal}
          onClose={() => setShowPrevisaoModal(false)}
          planejamentos={planejamentosParaPrevisao.length > 0 ? planejamentosParaPrevisao : filteredPlanejamentos}
          execucoes={[]} // execucoes are not relevant for future delivery forecast
          cargaDiaria={planejamentosParaPrevisao.length > 0 && planejamentosParaPrevisao[0].executor_principal ? cargaDiariaPorUsuario[planejamentosParaPrevisao[0].executor_principal] || {} : {}}
        />
      )}
    </>
  );
}