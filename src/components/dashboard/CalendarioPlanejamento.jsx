// ...existing code...
import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Building2, Filter, Trash2, CalendarDays, View, Play, RefreshCw, LineChart, Users, PlusCircle, ListMusic, Loader2, Edit2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

import { PlanejamentoAtividade, Atividade, Documento, Empreendimento, Execucao, PlanejamentoDocumento } from '@/entities/all';
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
  if (plano.isLegacyExecution) return false;
  return isOverdueShared(plano);
};

// Função para calcular status (mantida conforme original)
const calculateActivityStatus = (plano, allPlanejamentos = []) => {
  if (plano.isLegacyExecution) {
    return plano.status;
  }
  if (plano.status === 'concluido') {
    return 'concluido';
  }
  if (plano.status === 'atrasado' || isActivityOverdue(plano)) {
    return 'atrasado';
  }

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
  currentUserEmail,
  viewType
}) => {
  const usersOrdenados = useMemo(() => {
    return [...users]
      .filter(u => u.nome || u.full_name)
      .sort((a, b) => {
        const nomeA = a.nome || a.full_name || '';
        const nomeB = b.nome || b.full_name || '';
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
      });
  }, [users]);

  const isDropdownDisabled = (isColaborador || isGestao || isApoio) && !podeVerOutros;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex flex-wrap items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <Select value={filters.user} onValueChange={(value) => onFilterChange('user', value)} disabled={isDropdownDisabled}>
                <SelectTrigger className={`w-48 ${!hasSelectedUser && filters.user === '' ? 'border-red-300 bg-red-50' : 'bg-white'} ${isDropdownDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <SelectValue placeholder="⚠️ Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                    {usersOrdenados
                      .filter(u => {
                        if (isColaborador || isGestao || isApoio) {
                          if (u.email === currentUserEmail) return true;
                          if (podeVerOutros && Array.isArray(usuariosPermitidos)) {
                            return usuariosPermitidos.includes(u.email);
                          }
                          return false;
                        }
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

        {hasSelectedUser && (
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant={viewMode === 'day' ? 'default' : 'outline'} size="sm" onClick={() => onViewModeChange('day')}>Dia</Button>
                <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" onClick={() => onViewModeChange('week')}>Semana</Button>
                <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" onClick={() => onViewModeChange('month')}>Mês</Button>
              </div>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <Button 
                  variant={viewType === 'sintetico' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => onFilterChange('viewType', 'sintetico')}
                  className={viewType === 'sintetico' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                >
                  Sintético
                </Button>
                <Button 
                  variant={viewType === 'analitico' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => onFilterChange('viewType', 'analitico')}
                  className={viewType === 'analitico' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                >
                  Analítico
                </Button>
              </div>
          </div>
        )}
    </div>
  );
};


// --- Sub-componente de Itens de Atividade Individual ---
const ActivityItem = ({ plano, dayKey, onDelete, onUpdate, executorMap, allPlanejamentos, provided, isDragging, isReprogramando, isSelected, onToggleSelect, hasSelections }) => {
  const { activeExecution, startExecution, user, playlist, addToPlaylist, removeFromPlaylist, triggerUpdate, hasPermission } = useContext(ActivityTimerContext);
  
  const [isStarting, setIsStarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTimeAdjustModal, setShowTimeAdjustModal] = useState(false);
  const [adjustedTime, setAdjustedTime] = useState('');
  const [showObservacoes, setShowObservacoes] = useState(false);
  const [showEditDescricaoModal, setShowEditDescricaoModal] = useState(false);
  const [editDescricao, setEditDescricao] = useState('');
  const [isEditLoading, setIsEditLoading] = useState(false);

  // NOVO: estados para alterar empreendimento
  const [empreendimentosList, setEmpreendimentosList] = useState([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState(plano?.empreendimento_id || '');
  const [isEmpLoading, setIsEmpLoading] = useState(false);

  const realStatus = calculateActivityStatus(plano, allPlanejamentos);

  const getStatusColor = (status) => {
    switch (status) {
      case 'em_andamento': return '#3b82f6';
      case 'pausado': return '#f59e0b';
      case 'concluido': return '#10b981';
      case 'atrasado':
      case 'replanejado_atrasado': return '#ef4444';
      case 'impactado_por_atraso': return '#8b5cf6';
      case 'nao_iniciado':
      default: return '#6b7280';
    }
  };

  const displayName = useMemo(() => {
    if (plano.tipo_planejamento === 'documento') {
      const numeroFolha = plano.documento?.numero || 
                         (plano.descritivo && plano.descritivo.includes(' - ') ? plano.descritivo.split(' - ')[0] : null) || 
                         'Número';
      const nomeArquivo = plano.documento?.arquivo || 
                         (plano.descritivo && plano.descritivo.includes(' - ') ? plano.descritivo.split(' - ')[1] : null) || 
                         'Documento';
      const etapa = plano.etapa || 'Sem Etapa';
      
      return `${numeroFolha} - ${nomeArquivo} - ${etapa}`;
    }
    return plano.atividade?.atividade || plano.descritivo || 'Atividade não identificada';
  }, [plano]);
  
  const subdisciplina = plano.atividade?.subdisciplina;
  const tempoExecutado = plano.tempo_executado || 0;
  const tempoPlanejado = plano.tempo_planejado || 0;
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
    } else if (plano.status === 'concluido' && tempoExecutado > 0 && Object.keys(plano.horas_executadas_por_dia || {}).length === 0) {
      const diasPlanejados = Object.keys(plano.horas_por_dia || {});
      if (diasPlanejados.length > 0 && diasPlanejados.includes(dayKey)) {
        horasDoDia = tempoExecutado / diasPlanejados.length;
      } else {
        horasDoDia = tempoExecutado;
      }
    } else {
      horasDoDia = horasAlocadasDia;
    }
  }

  const isNaPlaylist = playlist.includes(plano.id);

  const getDocumentoDisplay = () => {
    if (!plano.documento_id) {
      return null;
    }
    if (!plano.documento) {
      return 'Carregando...';
    }
    const campos = [
      plano.documento.numero_completo,
      plano.documento.arquivo,
      plano.documento.numero,
    ].filter(Boolean);
    return campos.length > 0 ? campos[0] : 'Sem documento';
  };

  const documentoDisplay = getDocumentoDisplay();

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
      
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error("❌ Erro ao excluir atividade:", error);
      const is404 = error.message?.includes("404") || (error.response && error.response.status === 404);
      if (is404) {
        if (onDelete) onDelete();
      } else {
        let errorMessage = "Erro ao excluir atividade do banco de dados. Tente novamente.";
        if (error.message?.includes("403") || (error.response && error.response.status === 403)) {
          errorMessage = "Você não tem permissão para excluir esta atividade.";
        } else if (error.message?.includes("500") || error.response?.status >= 500) {
          errorMessage = "Erro no servidor ao tentar excluir. Tente novamente mais tarde.";
        } else if (error.message?.includes("Network Error") || error.message?.includes("Failed to fetch")) {
          errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
        } else if (error.response && error.response.data && error.response.data.message) {
          errorMessage = `Erro: ${error.response.data.message}`;
        }
        alert(errorMessage);
        console.error("📋 Detalhes completos do erro:", {
          message: error.message,
          response: error.response,
          stack: error.stack
        });
      }
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
    
    const hasIdentifier = plano.analitico_id || plano.descritivo || plano.atividade?.atividade || (plano.tipo_planejamento === 'documento' && plano.documento?.numero_completo);
    if (!hasIdentifier) {
      alert("Erro: A atividade não pôde ser iniciada por falta de identificador.");
      return;
    }

    setIsStarting(true);
    try {
      const activityDescription = `${displayName}${plano.empreendimento?.nome ? ` - ${plano.empreendimento.nome}` : ''}`;
      await startExecution({
        planejamento_id: plano.id,
        descritivo: activityDescription,
        empreendimento_id: plano.empreendimento_id,
        tipo_planejamento: plano.tipo_planejamento 
      });
    } catch (error) {
      console.error("Erro ao iniciar atividade:", error);
      alert("Não foi possível iniciar a atividade. Verifique o console para mais detalhes.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleAdjustTime = async () => {
    const timeValue = parseFloat(adjustedTime);
    if (isNaN(timeValue) || timeValue < 0) {
      alert("Por favor, insira um tempo válido.");
      return;
    }

    try {
      if (plano.isLegacyExecution) {
        alert("Não é possível ajustar o tempo para atividades rápidas antigas (não planejadas).");
        return;
      }

      const entityToUpdate = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      
      const diasPlanejados = Object.keys(plano.horas_por_dia || {});
      const novasHorasPorDia = {};
      
      if (diasPlanejados.length > 0) {
        const horasPorDia = timeValue / diasPlanejados.length;
        diasPlanejados.forEach(dia => {
          novasHorasPorDia[dia] = horasPorDia;
        });
      } else {
        const hoje = format(new Date(), 'yyyy-MM-dd');
        novasHorasPorDia[hoje] = timeValue;
      }

      await retryWithBackoff(
        () => entityToUpdate.update(plano.id, {
          tempo_executado: timeValue,
          tempo_planejado: timeValue,
          horas_por_dia: novasHorasPorDia,
          status: 'concluido',
          termino_real: format(new Date(), 'yyyy-MM-dd')
        }),
        3, 1000, 'adjustTime'
      );
      
      setShowTimeAdjustModal(false);
      setAdjustedTime('');
      if (onDelete) { onDelete(); }
    } catch (error) {
      console.error("Erro ao ajustar tempo:", error);
      alert("Erro ao ajustar tempo. Tente novamente.");
    }
  };

  const shouldShowStartButton = () => realStatus !== 'concluido' && !activeExecution && !plano.isLegacyExecution;
  
  const shouldShowDeleteButton = () => {
    return hasPermission('admin') || hasPermission('coordenador') || hasPermission('lider') || hasPermission('direcao') || hasPermission('gestao');
  };
  const shouldShowAdjustButton = () => {
    return hasPermission('coordenador') && !plano.isLegacyExecution && plano.status !== 'concluido';
  };

  const shouldShowEditDescricaoButton = () => {
    return (hasPermission('admin') || hasPermission('lider') || hasPermission('direcao')) && (plano.status === 'concluido' || plano.status === 'nao_iniciado');
  };

  // Atualiza estado e abre modal
  const handleOpenEditDescricao = () => {
    setEditDescricao(plano.descritivo || '');
    setSelectedEmpreendimento(plano?.empreendimento_id || '');
    setShowEditDescricaoModal(true);
  };

  // Buscar empreendimentos quando abrir modal de edição
  useEffect(() => {
    let mounted = true;
    const loadEmpreendimentos = async () => {
      if (!showEditDescricaoModal) return;
      setIsEmpLoading(true);
      try {
        const res = await retryWithBackoff(() => Empreendimento.list(), 3, 1000, 'loadEmpreendimentos');
        if (!mounted) return;
        setEmpreendimentosList(res || []);
      } catch (e) {
        console.error('Erro ao carregar empreendimentos:', e);
        setEmpreendimentosList([]);
      } finally {
        if (mounted) setIsEmpLoading(false);
      }
    };
    loadEmpreendimentos();
    return () => { mounted = false; };
  }, [showEditDescricaoModal]);

  const handleSaveDescricao = async () => {
    if (!editDescricao.trim()) {
      alert('Descrição não pode estar vazia');
      return;
    }

    setIsEditLoading(true);
    try {
      if (plano.isLegacyExecution) {
        const execId = plano.id.split('-')[1];
        await Execucao.update(execId, {
          descritivo: editDescricao.trim()
        });
      } else {
        const entityToUpdate = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
        const payload = { descritivo: editDescricao.trim() };
        // Envia empreedimento_id (pode ser '' para null)
        if (selectedEmpreendimento === '' || selectedEmpreendimento === null) {
          payload.empreendimento_id = null;
        } else {
          payload.empreendimento_id = selectedEmpreendimento;
        }
        await entityToUpdate.update(plano.id, payload);
      }
      
      alert('✅ Descrição atualizada com sucesso!');
      setShowEditDescricaoModal(false);
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error('Erro ao salvar descrição:', error);
      alert('Erro ao atualizar descrição: ' + (error.message || 'Tente novamente.'));
    } finally {
      setIsEditLoading(false);
    }
  };

  const observacao = useMemo(() => {
    if (plano.observacao) {
      return plano.observacao;
    }
    return null;
  }, [plano]);

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
          ...(isDragging && { boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', transform: 'rotate(2deg)'})
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
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(plano.id);
              }}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              title="Selecionar para mover em grupo"
            />
          </div>
        )}

        <div
          {...provided.dragHandleProps}
          className={`absolute top-0 bottom-0 w-6 flex items-center justify-center cursor-move opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-gray-100 to-transparent ${hasSelections || isSelected ? 'left-6' : 'left-0'}`}
          title={isSelected && hasSelections ? "Arrastar atividades selecionadas" : "Arrastar para mover"}
        >
          <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/>
            <circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/>
            <circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>

        {isSelected && hasSelections && isDragging && (
          <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg z-30">
            {onUpdate?.selectedCount || ''}
          </div>
        )}

        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 mr-2 overflow-hidden">
            {plano.empreendimento?.nome && (
              <p className="text-xs text-gray-500 mb-0.5 font-medium truncate" title={plano.empreendimento.nome}>
                📋 {plano.empreendimento.nome}
              </p>
            )}
            <p className="font-medium text-gray-800 leading-tight truncate" title={displayName}>
              {displayName}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {plano.isQuickActivity && (
                <Badge variant="outline" className="px-1 py-0.5 text-xs bg-gray-100 text-gray-600 border-gray-300">Execução Rápida</Badge>
              )}
              {plano.tipo_planejamento === 'documento' && (
                <Badge variant="outline" className="px-1 py-0.5 text-xs bg-blue-100 text-blue-600 border-blue-300">Planejamento Doc.</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center shrink-0 gap-2">
          </div>
        </div>

        {plano.tipo_planejamento === 'documento' && plano.documento?.subdisciplinas && plano.documento.subdisciplinas.length > 0 && (
          <div className="mb-1.5">
            <div className="flex flex-wrap gap-1">
              {plano.documento.subdisciplinas.map((sub, idx) => (
                <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200">
                  {sub}
                </Badge>
              ))}
            </div>
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
          <p className="text-gray-600 font-mono mb-1.5 break-words" title={`Documento: ${documentoDisplay}`}>
            {documentoDisplay}
          </p>
        )}
        
        {plano.os && (
          <p className="text-blue-600 font-semibold text-xs mb-1.5">
            OS: {plano.os}
          </p>
        )}

        {observacao && (
          <div className="mt-1.5 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
            <p className="text-gray-700 italic">
              <span className="font-semibold text-gray-600">💬 Obs:</span> {observacao}
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-2 items-center justify-between">
          <div className="flex gap-2 items-center">
            <button
              onClick={handleStartActivity}
              disabled={!!activeExecution || isStarting || realStatus === 'concluido'}
              className={`p-1.5 rounded-md transition-colors ${activeExecution?.planejamento_id === plano.id ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse' : (realStatus === 'atrasado' || realStatus === 'replanejado_atrasado') ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed'}`}
              title={activeExecution?.planejamento_id === plano.id ? "Atividade em andamento" : (realStatus === 'atrasado' || realStatus === 'replanejado_atrasado') ? "Atividade atrasada" : isStarting ? "Iniciando..." : "Iniciar atividade"}
            >
              {activeExecution?.planejamento_id === plano.id ? (
                <Clock className="w-3.5 h-3.5 text-white" />
              ) : (realStatus === 'atrasado' || realStatus === 'replanejado_atrasado') ? (
                <span className="text-white text-xs font-bold">✕</span>
              ) : (
                <Play className="w-3.5 h-3.5 text-white" fill="white" />
              )}
            </button>
            
            <button
              onClick={handleDeleteActivity}
              disabled={isDeleting || !!activeExecution}
              className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={plano.isLegacyExecution ? "Excluir Execução Rápida Antiga" : plano.tipo_planejamento === 'documento' ? "Excluir Planejamento de Documento" : "Excluir Atividade"}
            >
              {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
            
            <button
              onClick={handleOpenEditDescricao}
              className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
              title="Editar descrição da atividade"
            >
              <Edit2 className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {shouldShowAdjustButton() ? (
              <button
                onClick={() => {
                  setAdjustedTime(tempoExecutado.toString());
                  setShowTimeAdjustModal(true);
                }}
                className="font-mono text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                title="Clique para ajustar o tempo (Coordenador ou superior)"
              >
                <span className="font-semibold text-sm">
                  {Math.ceil(horasAlocadasDia * 10) / 10}/{Math.ceil(horasExecutadasNoDia * 10) / 10}h{(plano.horas_por_dia && Object.keys(plano.horas_por_dia).length > 1 && Object.keys(plano.horas_por_dia).sort().indexOf(dayKey) < Object.keys(plano.horas_por_dia).length - 1) ? ' ...' : ''}
                </span>
              </button>
            ) : (
               <div className="font-mono text-blue-600">
                 <span className="font-semibold text-sm" title={horasAlocadasDia > 0 && Object.keys(plano.horas_por_dia || {}).length > 1 ? "Planejado / Executado (continua em outros dias)" : "Planejado / Executado"}>
                   {Math.ceil(horasAlocadasDia * 10) / 10}/{Math.ceil(horasExecutadasNoDia * 10) / 10}h{(plano.horas_por_dia && Object.keys(plano.horas_por_dia).length > 1 && Object.keys(plano.horas_por_dia).sort().indexOf(dayKey) < Object.keys(plano.horas_por_dia).length - 1) ? ' ...' : ''}
                 </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para ajustar tempo */}
      <Dialog open={showTimeAdjustModal} onOpenChange={setShowTimeAdjustModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Tempo Executado</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2"><strong>Atividade:</strong> {displayName}</p>
              <p className="text-sm text-gray-600 mb-4">Tempo atual: {tempoExecutado.toFixed(1)}h executadas</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustedTime">Novo Tempo Executado (horas)</Label>
              <Input
                id="adjustedTime"
                type="number"
                step="0.1"
                min="0"
                value={adjustedTime}
                onChange={(e) => setAdjustedTime(e.target.value)}
                placeholder="Ex: 2.5"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-700 text-sm font-medium">ℹ️ A atividade será automaticamente marcada como <strong>concluída</strong> após o ajuste.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeAdjustModal(false)}>Cancelar</Button>
            <Button onClick={handleAdjustTime} className="bg-blue-600 hover:bg-blue-700">Ajustar e Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para editar descrição e empreendimento */}
      <Dialog open={showEditDescricaoModal} onOpenChange={setShowEditDescricaoModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Descrição da Atividade</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2"><strong>Atividade:</strong> {displayName}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescricao">Descrição</Label>
              <Textarea
                id="editDescricao"
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                placeholder="Digite a descrição da atividade"
                className="min-h-24"
              />

              {/* Select de Empreendimento */}
              <div>
                <Label htmlFor="selectEmp">Empreendimento</Label>
                <Select value={selectedEmpreendimento ?? ''} onValueChange={(v) => setSelectedEmpreendimento(v)} disabled={isEmpLoading || plano.isLegacyExecution}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={plano.isLegacyExecution ? "Não disponível para execuções antigas" : "Selecione um empreendimento"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem Empreendimento</SelectItem>
                    {empreendimentosList.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.nome || emp.nome_fantasia || emp.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEmpLoading && <p className="text-xs text-gray-500 mt-1">Carregando empreendimentos...</p>}
                {plano.isLegacyExecution && <p className="text-xs text-gray-500 mt-1 italic">Empreendimento não pode ser alterado em execuções legadas.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDescricaoModal(false)}>Cancelar</Button>
            <Button 
              onClick={handleSaveDescricao} 
              disabled={isEditLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isEditLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ...existing code (the rest of the file remains unchanged)...
export default function CalendarioPlanejamento({ usuarios, disciplinas, onRefresh, isDashboardRefreshing }) {
  // ...existing code continues unchanged (same implementation as provided)...
  // For brevity, the remainder of the component file is unchanged from the version you provided.
}