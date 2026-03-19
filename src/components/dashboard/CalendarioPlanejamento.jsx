import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Building2, Filter, Trash2, CalendarDays, View, Play, RefreshCw, LineChart, Users, PlusCircle, ListMusic, Loader2, Edit2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, parseISO, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay,
  isValid, isAfter, parseISO as parseDateISO
} from "date-fns";
import { Input } from "@/components/ui/input";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import PrevisaoEntregaModal from './PrevisaoEntregaModal';
import ActivityItem from './ActivityItem';

import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown } from 'lucide-react';
import { isActivityOverdue as isOverdueShared, distribuirHorasPorDias } from '../utils/DateCalculator';
import { retryWithBackoff } from '../utils/apiUtils';

import { PlanejamentoAtividade, Atividade, Documento, Empreendimento, Execucao, PlanejamentoDocumento } from '@/entities/all';

const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString === 'string') {
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    try {
      const parsedDate = parseISO(dateString);
      if (!isNaN(parsedDate.getTime())) {
        return new Date(parsedDate.getTime() + parsedDate.getTimezoneOffset() * 60000);
      }
    } catch (e) {}
  }
  return null;
};

const isActivityOverdue = (plano) => {
  if (plano.isLegacyExecution) return false;
  return isOverdueShared(plano);
};

const calculateActivityStatus = (plano, allPlanejamentos = []) => {
  if (plano.isLegacyExecution) return plano.status;
  if (plano.status === 'concluido') return 'concluido';
  if (plano.status === 'atrasado' || isActivityOverdue(plano)) return 'atrasado';
  if (plano.predecessora_id) {
    const pred = allPlanejamentos.find(p => p.id === plano.predecessora_id);
    if (pred && isActivityOverdue(pred)) return 'impactado_por_atraso';
  }
  let wasReplannedLater = false;
  if (plano.termino_ajustado && plano.termino_planejado) {
    try {
      const aj = startOfDay(parseISO(plano.termino_ajustado));
      const pl = startOfDay(parseISO(plano.termino_planejado));
      if (isValid(aj) && isValid(pl) && isAfter(aj, pl)) wasReplannedLater = true;
    } catch (e) {}
  }
  if (wasReplannedLater) return 'replanejado_atrasado';
  let foiReplanejadaParaIniciarMaisTarde = false;
  if (plano.inicio_ajustado && plano.inicio_planejado) {
    try {
      const aj = startOfDay(parseISO(plano.inicio_ajustado));
      const pl = startOfDay(parseISO(plano.inicio_planejado));
      if (isValid(aj) && isValid(pl) && isAfter(aj, pl)) foiReplanejadaParaIniciarMaisTarde = true;
    } catch (e) {}
  }
  if (foiReplanejadaParaIniciarMaisTarde) return 'impactado_por_atraso';
  return plano.status || 'nao_iniciado';
};

// Ordenação topológica respeitando predecessoras dentro do mesmo dia
const sortActivitiesTopological = (items, allPlanejamentos) => {
  if (!items || items.length === 0) return items;
  const legadas = items.filter(a => a.isLegacyExecution);
  const naoLegadas = items.filter(a => !a.isLegacyExecution);
  const ativas = naoLegadas.filter(a => calculateActivityStatus(a, allPlanejamentos) !== 'concluido');
  const concluidas = naoLegadas.filter(a => calculateActivityStatus(a, allPlanejamentos) === 'concluido');
  const topoSort = (list) => {
    if (list.length === 0) return list;
    const idSet = new Set(list.map(a => a.id));
    const inDegree = {};
    const adjList = {};
    const idToItem = {};
    list.forEach(a => { inDegree[a.id] = 0; adjList[a.id] = []; idToItem[a.id] = a; });
    list.forEach(a => {
      if (a.predecessora_id && idSet.has(a.predecessora_id)) {
        adjList[a.predecessora_id].push(a.id);
        inDegree[a.id]++;
      }
    });
    const byInicio = (a, b) => (a.inicio_planejado || '').localeCompare(b.inicio_planejado || '');
    const queue = list.filter(a => inDegree[a.id] === 0).sort(byInicio);
    const result = [];
    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);
      (adjList[current.id] || []).forEach(succId => {
        inDegree[succId]--;
        if (inDegree[succId] === 0) queue.push(idToItem[succId]);
        queue.sort(byInicio);
      });
    }
    list.forEach(a => { if (!result.find(r => r.id === a.id)) result.push(a); });
    return result;
  };
  return [...topoSort(ativas), ...topoSort(concluidas), ...legadas];
};

// --- Sub-componente de Filtros ---
const CalendarFilters = ({
  users, disciplines, viewMode, onViewModeChange, filters, onFilterChange, onClearFilters,
  hasSelectedUser, isColaborador, isViewingAllUsers, isGestao, isApoio, podeVerOutros, usuariosPermitidos, currentUserEmail, viewType
}) => {
  const usersOrdenados = useMemo(() => {
    return [...users].filter(u => u.nome || u.full_name).sort((a, b) => {
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
            {usersOrdenados.filter(u => {
              if (isColaborador || isGestao || isApoio) {
                if (u.email === currentUserEmail) return true;
                if (podeVerOutros && Array.isArray(usuariosPermitidos)) return usuariosPermitidos.includes(u.email);
                return false;
              }
              return true;
            }).map(userItem => (
              <SelectItem key={userItem.id} value={userItem.email}>{userItem.nome || userItem.full_name}</SelectItem>
            ))}
            {(!isColaborador && !isGestao && !isApoio) && usersOrdenados.length > 0 && (
              <SelectItem value="all">⚠️ Todos os Usuários (pode ser lento)</SelectItem>
            )}
          </SelectContent>
        </Select>
        {hasSelectedUser && (
          <>
            <Select value={filters.discipline} onValueChange={(value) => onFilterChange('discipline', value)}>
              <SelectTrigger className="w-48 bg-white"><SelectValue placeholder="Filtrar por disciplina" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Disciplinas</SelectItem>
                {disciplines.map(disc => <SelectItem key={disc.id} value={disc.nome}>{disc.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filters.discipline !== 'all' || filters.user !== '') && ((!isGestao && !isColaborador && !isApoio) || podeVerOutros) && (
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />Limpar Filtros
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
            <Button variant={viewType === 'sintetico' ? 'default' : 'outline'} size="sm" onClick={() => onFilterChange('viewType', 'sintetico')} className={viewType === 'sintetico' ? 'bg-purple-600 hover:bg-purple-700' : ''}>Sintético</Button>
            <Button variant={viewType === 'analitico' ? 'default' : 'outline'} size="sm" onClick={() => onFilterChange('viewType', 'analitico')} className={viewType === 'analitico' ? 'bg-purple-600 hover:bg-purple-700' : ''}>Analítico</Button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- DailyActivityGroup ---
const DailyActivityGroup = ({ empreendimento, executor, atividades, isExpanded, onToggle, disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, groupKey, provided, isDragging, onSelectAllOS, allActivitiesForOS }) => {
  const totalHoras = useMemo(() => {
    let soma = 0;
    atividades.forEach((atividade) => {
      const horasAlocadasDia = Number(atividade.horas_por_dia?.[dayKey]) || 0;
      const horasExecutadasNoDia = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
      const tempoExecutado = Number(atividade.tempo_executado) || 0;
      let h = 0;
      if (atividade.isLegacyExecution) h = tempoExecutado;
      else if (atividade.isQuickActivity || atividade.is_quick_activity) h = horasExecutadasNoDia > 0 ? horasExecutadasNoDia : horasAlocadasDia;
      else if (horasExecutadasNoDia > 0) h = horasExecutadasNoDia;
      else if (atividade.status === 'concluido' && tempoExecutado > 0 && Object.keys(atividade.horas_executadas_por_dia || {}).length === 0) {
        const dp = Object.keys(atividade.horas_por_dia || {});
        h = dp.length > 0 && dp.includes(dayKey) ? tempoExecutado / dp.length : tempoExecutado;
      } else h = horasAlocadasDia;
      soma += h;
    });
    return Math.ceil(soma * 10) / 10;
  }, [atividades, dayKey]);

  const statusCounts = atividades.reduce((acc, a) => {
    const s = calculateActivityStatus(a, allPlanejamentos);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const disciplineColors = useMemo(() => {
    const disciplineMap = (disciplinas || []).reduce((acc, d) => { acc[d.nome] = d.cor; return acc; }, {});
    return [...new Set(atividades.map(a => a.atividade?.disciplina).filter(Boolean))].map(dName => ({ name: dName, color: disciplineMap[dName] || '#A1A1AA' }));
  }, [atividades, disciplinas]);

  const getGroupStatus = () => {
    if (statusCounts['atrasado'] > 0 || statusCounts['replanejado_atrasado'] > 0) return 'atrasado';
    if (statusCounts['impactado_por_atraso'] > 0) return 'impactado_por_atraso';
    if (statusCounts['em_andamento'] > 0) return 'em_andamento';
    if (atividades.length > 0 && statusCounts['concluido'] === atividades.length) return 'concluido';
    if (statusCounts['pausado'] > 0) return 'pausado';
    return 'nao_iniciado';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'em_andamento': return '#3b82f6';
      case 'pausado': return '#f59e0b';
      case 'concluido': return '#10b981';
      case 'atrasado': return '#ef4444';
      case 'impactado_por_atraso': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const groupStatus = getGroupStatus();
  const statusColor = getStatusColor(groupStatus);
  const empreendimentoNome = empreendimento?.nome || empreendimento?.nome_fantasia || 'Sem Empreendimento';
  const planoExecutor = executor?.email ? executorMap[executor.email] : null;
  const executorNome = planoExecutor?.nome || planoExecutor?.email || 'Sem Executor';
  const canDragGroup = canReprogram && empreendimentoNome !== 'Atividades Rápidas' && !atividades.some(a => a.status === 'concluido' || a.isLegacyExecution);

  return (
    <div className="mb-1" ref={provided?.innerRef} {...(provided?.draggableProps || {})}>
      <div onClick={onToggle}
        style={{ borderLeft: `6px solid ${statusColor}`, backgroundColor: isDragging ? '#e0e7ff' : groupStatus === 'atrasado' ? '#fff1f2' : groupStatus === 'impactado_por_atraso' ? '#f5f3ff' : groupStatus === 'em_andamento' ? '#eff6ff' : groupStatus === 'concluido' ? '#f0fdf4' : groupStatus === 'pausado' ? '#fefce8' : '#f8fafc', cursor: 'pointer', ...(isDragging && { boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', transform: 'rotate(1deg) scale(1.02)', transition: 'all 0.2s ease' }) }}
        className={`p-2 rounded-lg hover:shadow-md transition-shadow duration-200 border ${isDragging ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between gap-2">
          {canDragGroup && (
            <div {...(provided?.dragHandleProps || {})} onClick={(e) => e.stopPropagation()}
              className="cursor-move p-1 bg-gray-100 hover:bg-gray-200 rounded flex-shrink-0 border border-gray-300"
              style={{ minWidth: '20px', minHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              {disciplineColors.map(d => <div key={d.name} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} title={d.name}></div>)}
              <Button variant="ghost" size="icon" className="w-5 h-5 ml-auto text-purple-500 hover:bg-purple-100" onClick={(e) => { e.stopPropagation(); onShowPrevisao(atividades); }} title="Ver Previsão de Entrega">
                <LineChart className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <p className="font-bold text-xs truncate text-gray-800 flex-1">{empreendimentoNome}</p>
              {canReprogram && onSelectAllOS && empreendimentoNome !== 'Atividades Rápidas' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectAllOS(); }}
                  className="text-xs px-1 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium flex-shrink-0 border border-indigo-200"
                  title="Selecionar todas as atividades desta OS"
                >
                  + OS
                </button>
              )}
            </div>
            {empreendimentoNome !== 'Atividades Rápidas' && (
              <div className="flex items-center gap-1.5 mt-1"><User className="w-3 h-3 flex-shrink-0" /><p className="text-xs font-medium truncate">{executorNome}</p></div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="px-1.5 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: statusColor }}>{totalHoras > 0 ? `${Math.ceil(totalHoras * 10) / 10}h` : '0h'}</div>
              <p className="text-xs text-gray-500 mt-0.5">{atividades.length} ativ.</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </div>
        {isDragging && (
          <div className="mt-2 flex items-center justify-center gap-2 bg-indigo-100 border-2 border-indigo-300 rounded p-2">
            <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">{atividades.length}</div>
            <span className="text-sm font-bold text-indigo-800">Movendo {atividades.length} atividade{atividades.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isExpanded && !isDragging && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="ml-2 mt-1 space-y-1">
            {atividades.map((atividade, index) => (
              <Draggable key={atividade.id} draggableId={atividade.id} index={index} isDragDisabled={!canReprogram || atividade.status === 'concluido' || atividade.isLegacyExecution || isReprogramando === atividade.id}>
                {(provided, snapshot) => (
                  <ActivityItem plano={atividade} dayKey={dayKey} onDelete={onActivityDelete} executorMap={executorMap} allPlanejamentos={allPlanejamentos} provided={provided} isDragging={snapshot.isDragging} isReprogramando={isReprogramando === atividade.id} isSelected={selectedActivities.has(atividade.id)} onToggleSelect={onToggleSelect} hasSelections={hasSelections} />
                )}
              </Draggable>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- ActivityContainer ---
const ActivityContainer = ({ activities, containerClass = "", disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, onSelectAllOS, allActivitiesByEmp }) => {
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const hasHoras = (atividade) => {
    const horasAlocadas = Number(atividade.horas_por_dia?.[dayKey]) || 0;
    const horasExecutadas = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
    const tempoExecutado = Number(atividade.tempo_executado) || 0;
    if (atividade.isLegacyExecution) return tempoExecutado >= 0.05;
    if (atividade.isQuickActivity || atividade.is_quick_activity) return horasExecutadas >= 0.05 || horasAlocadas >= 0.05;
    return horasAlocadas >= 0.05 || horasExecutadas >= 0.05;
  };

  const activityGroups = useMemo(() => {
    const groups = {};
    activities.forEach(atividade => {
      let groupKey, empreendimentoParaGrupo;
      if (atividade.isLegacyExecution) { groupKey = `virtual-${atividade.executor_principal || 'sem-executor'}`; empreendimentoParaGrupo = { nome: 'Atividades Rápidas' }; }
      else {
        const empKey = atividade.empreendimento_id || 'sem-empreendimento';
        const userKey = atividade.executor_principal || 'sem-executor';
        if (empKey === 'sem-empreendimento') { groupKey = `geral-${userKey}`; empreendimentoParaGrupo = atividade.empreendimento || { nome: 'Atividades Gerais' }; }
        else { groupKey = `${empKey}|${userKey}`; empreendimentoParaGrupo = atividade.empreendimento; }
      }
      if (!groups[groupKey]) groups[groupKey] = { empreendimento: empreendimentoParaGrupo, executor: { email: atividade.executor_principal }, atividades: [] };
      groups[groupKey].atividades.push(atividade);
    });
    return groups;
  }, [activities, dayKey]);

  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) newExpanded.delete(groupKey); else newExpanded.add(groupKey);
    setExpandedGroups(newExpanded);
  };

  if (viewType === 'analitico') {
    const activitiesComHoras = activities.filter(hasHoras);
    return (
      <div className={`space-y-1 ${containerClass}`}>
        {activitiesComHoras.map((atividade, index) => (
          <Draggable key={atividade.id} draggableId={atividade.id} index={index} isDragDisabled={!canReprogram || atividade.status === 'concluido' || atividade.isLegacyExecution || isReprogramando === atividade.id}>
            {(provided, snapshot) => (
              <ActivityItem plano={atividade} dayKey={dayKey} onDelete={onActivityDelete} executorMap={executorMap} allPlanejamentos={allPlanejamentos} provided={provided} isDragging={snapshot.isDragging} isReprogramando={isReprogramando === atividade.id} isSelected={selectedActivities.has(atividade.id)} onToggleSelect={onToggleSelect} hasSelections={hasSelections} />
            )}
          </Draggable>
        ))}
      </div>
    );
  }

  const groupsComHoras = Object.entries(activityGroups).filter(([, groupData]) => groupData.atividades.some(hasHoras));

  return (
    <div className={`space-y-1 ${containerClass}`}>
      {groupsComHoras.map(([groupKey, groupData]) => {
        const atividadesComHoras = groupData.atividades.filter(hasHoras);
        if (atividadesComHoras.length === 0) return null;
        const groupDataFiltrado = { ...groupData, atividades: atividadesComHoras };
        const canDragGroup = canReprogram && groupDataFiltrado.empreendimento?.nome !== 'Atividades Rápidas' && !groupDataFiltrado.atividades.some(a => a.status === 'concluido' || a.isLegacyExecution);
        const empId = groupDataFiltrado.empreendimento?.id || groupDataFiltrado.atividades[0]?.empreendimento_id;
        const handleSelectAllOS = onSelectAllOS && empId ? () => onSelectAllOS(empId, groupDataFiltrado.executor?.email) : null;

        if (canDragGroup) {
          return (
            <Draggable key={`group-${groupKey}-${dayKey}`} draggableId={`group-${groupKey}-${dayKey}`} index={0} isDragDisabled={!canDragGroup}>
              {(provided, snapshot) => (
                <DailyActivityGroup empreendimento={groupDataFiltrado.empreendimento} executor={groupDataFiltrado.executor} atividades={groupDataFiltrado.atividades} isExpanded={expandedGroups.has(groupKey)} onToggle={() => toggleGroup(groupKey)} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} groupKey={groupKey} provided={provided} isDragging={snapshot.isDragging} onSelectAllOS={handleSelectAllOS} />
              )}
            </Draggable>
          );
        }
        return (
          <DailyActivityGroup key={`group-${groupKey}-${dayKey}-static`} empreendimento={groupDataFiltrado.empreendimento} executor={groupDataFiltrado.executor} atividades={groupDataFiltrado.atividades} isExpanded={expandedGroups.has(groupKey)} onToggle={() => toggleGroup(groupKey)} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} groupKey={groupKey} onSelectAllOS={handleSelectAllOS} />
        );
      })}
    </div>
  );
};

// --- DayCell ---
const DayCell = ({ day, dayActivities, date, isToday, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, onSelectAllOS }) => {
  const dayKey = format(day, 'yyyy-MM-dd');
  const hasMovableActivities = dayActivities.some(a => !a.isLegacyExecution && a.status !== 'concluido');
  const canDragDay = canReprogram && hasMovableActivities && dayActivities.length > 0;

  return (
    <Droppable droppableId={dayKey}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps}
          className={`h-40 p-2 border border-gray-100 flex flex-col group ${isSameMonth(day, date) ? 'bg-white' : 'bg-gray-50'} ${isToday ? 'border-2 border-blue-500 bg-blue-50' : ''} ${snapshot.isDraggingOver ? 'bg-purple-100' : ''}`}>
          <div className="flex items-center justify-between mb-2 relative">
            {canDragDay && (
              <Draggable draggableId={`day-${dayKey}`} index={0} isDragDisabled={!canDragDay}>
                {(dayProvided, daySnapshot) => (
                  <div ref={dayProvided.innerRef} {...dayProvided.draggableProps}
                    className={`absolute top-0 left-0 right-0 z-20 ${daySnapshot.isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <div {...dayProvided.dragHandleProps} className={`flex items-center justify-center gap-2 p-1 rounded-b cursor-move ${daySnapshot.isDragging ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
                      <span className="text-xs font-bold">{dayActivities.length} ativ.</span>
                    </div>
                    {daySnapshot.isDragging && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-30">
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span className="text-sm font-bold">Movendo {dayActivities.length} atividade{dayActivities.length > 1 ? 's' : ''}</span></div>
                        <div className="text-xs opacity-90 mt-1">De {format(day, 'd MMM', { locale: ptBR })}</div>
                      </div>
                    )}
                  </div>
                )}
              </Draggable>
            )}
            <span className={`font-semibold text-center flex-1 ${isSameMonth(day, date) ? 'text-gray-800' : 'text-gray-400'} ${isToday ? 'text-blue-700' : ''}`}>{format(day, 'd')}</span>
          </div>
          <div className="flex-grow overflow-y-auto pr-1">
            <ActivityContainer activities={dayActivities} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} onSelectAllOS={onSelectAllOS} />
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
};

// --- MonthView ---
const MonthView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, onSelectAllOS }) => {
  const monthDays = useMemo(() => { const start = startOfWeek(startOfMonth(date), { locale: ptBR }); const end = endOfWeek(endOfMonth(date), { locale: ptBR }); return eachDayOfInterval({ start, end }); }, [date]);
  const weekHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return (
    <div className="grid grid-cols-7 border-t border-gray-100">
      {weekHeaders.map(day => <div key={day} className="text-center font-medium text-sm text-gray-500 py-3 border-b border-gray-100 bg-gray-50">{day}</div>)}
      {monthDays.map(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        return <DayCell key={dayKey} day={day} dayActivities={activitiesByDay[dayKey] || []} date={date} isToday={isSameDay(day, new Date())} disciplinas={disciplinas} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} onSelectAllOS={onSelectAllOS} />;
      })}
    </div>
  );
};

// --- WeekView ---
const WeekView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, onSelectAllOS }) => {
  const [expandedDay, setExpandedDay] = useState(null);
  const weekDays = useMemo(() => { const start = startOfWeek(date, { locale: ptBR }); const end = endOfWeek(date, { locale: ptBR }); return eachDayOfInterval({ start, end }); }, [date]);
  const toggleExpand = (dayKey) => setExpandedDay(prev => (prev === dayKey ? null : dayKey));

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
              <div ref={provided.innerRef} {...provided.droppableProps}
                className={`flex flex-col border-r border-gray-100 transition-all duration-300 ease-in-out ${isExpanded ? 'flex-[2] min-w-[350px] bg-white shadow-2xl z-10' : 'flex-1 w-[14.28%] max-w-[200px]'} ${isToday && !isExpanded ? 'bg-blue-50' : ''} ${snapshot.isDraggingOver ? 'bg-purple-100' : 'bg-white'}`}>
                <div className={`flex flex-col p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 sticky top-0 z-10 ${isToday ? 'bg-blue-50' : 'bg-gray-50/50'}`} onClick={() => toggleExpand(dayKey)}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700 capitalize">{format(day, 'EEE, d', { locale: ptBR })}</h3>
                    <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                  {dayActivities.length > 0 && (
                    <div className="mt-1 text-xs text-gray-600 font-medium">
                      <span className="inline-block px-2 py-0.5 bg-white rounded border border-gray-200">
                        {(() => {
                          let total = 0;
                          dayActivities.forEach(ativ => {
                            const ha = Number(ativ.horas_por_dia?.[dayKey]) || 0;
                            const he = Number(ativ.horas_executadas_por_dia?.[dayKey]) || 0;
                            const te = Number(ativ.tempo_executado) || 0;
                            let h = 0;
                            if (ativ.isLegacyExecution) h = te;
                            else if (ativ.isQuickActivity || ativ.is_quick_activity) h = he > 0 ? he : ha;
                            else if (he > 0) h = he;
                            else if (ativ.status === 'concluido' && te > 0 && Object.keys(ativ.horas_executadas_por_dia || {}).length === 0) { const dp = Object.keys(ativ.horas_por_dia || {}); h = dp.length > 0 && dp.includes(dayKey) ? te / dp.length : 0; }
                            else h = ha;
                            total += h;
                          });
                          return `${Math.ceil(total * 10) / 10}h`;
                        })()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-grow overflow-y-auto p-2">
                  <ActivityContainer activities={dayActivities} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} onSelectAllOS={onSelectAllOS} />
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

// --- DayView ---
const DayView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, onSelectAllOS }) => {
  const dayKey = format(date, 'yyyy-MM-dd');
  const activities = activitiesByDay[dayKey] || [];
  return (
    <Droppable droppableId={dayKey}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps} className={`border-t border-gray-100 p-6 ${snapshot.isDraggingOver ? 'bg-purple-100' : ''}`}>
          <h2 className="text-2xl font-bold text-center mb-6">{format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</h2>
          <div className="max-w-4xl mx-auto">
            {activities.length > 0 ? (
              <ActivityContainer activities={activities} containerClass="space-y-4" disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} onSelectAllOS={onSelectAllOS} />
            ) : (
              <div className="text-center py-12 text-gray-500"><CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />Nenhuma atividade planejada para este dia.</div>
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
  const [currentDate, setCurrentDate] = useState(() => startOfWeek(new Date(), { locale: ptBR }));
  const [viewMode, setViewMode] = useState('week');
  const isApoio = perfilAtual === 'apoio';
  const usuariosPermitidos = userProfile?.usuarios_permitidos_visualizar || [];
  const podeVisualizarOutros = Array.isArray(usuariosPermitidos) && usuariosPermitidos.length > 0;
  const [filters, setFilters] = useState({ user: '', discipline: 'all' });
  const [planejamentos, setPlanejamentos] = useState([]);
  const [execucoes, setExecucoes] = useState([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [enrichedData, setEnrichedData] = useState([]);
  const [showPrevisaoModal, setShowPrevisaoModal] = useState(false);
  const [planejamentosParaPrevisao, setPlanejamentosParaPrevisao] = useState([]);
  const [isReprogramando, setIsReprogramando] = useState(null);
  const [viewType, setViewType] = useState('analitico');
  const [selectedActivities, setSelectedActivities] = useState(new Set());
  const [selectedOSEmpreendimentoId, setSelectedOSEmpreendimentoId] = useState(null);
  const [showMoverOSModal, setShowMoverOSModal] = useState(false);
  const [moverOSData, setMoverOSData] = useState({ novaData: '', isMoving: false });

  const hasSelectedUser = !!filters.user;
  const isViewingAllUsers = filters.user === 'all';

  useEffect(() => {
    if (user?.email && !filters.user) setFilters(prev => ({ ...prev, user: user.email }));
  }, [user?.email, filters.user]);

  const executorMap = useMemo(() => usuarios.reduce((acc, u) => { if (u.email) acc[u.email] = u; return acc; }, {}), [usuarios]);

  const loadCalendarData = useCallback(async (userFilter) => {
    if (!userFilter) { setPlanejamentos([]); setExecucoes([]); setEnrichedData([]); return; }
    setIsCalendarLoading(true);
    try {
      let planosAtividade = [], planosDocumento = [];
      if (userFilter !== 'all') {
        const [planosExecPrincipal, planosDocExecPrincipal, todosPlanos, todosDocPlanos] = await Promise.all([
          retryWithBackoff(() => PlanejamentoAtividade.filter({ executor_principal: userFilter }), 3, 1500, 'cal.pa'),
          retryWithBackoff(() => PlanejamentoDocumento.filter({ executor_principal: userFilter }), 3, 1500, 'cal.pd'),
          retryWithBackoff(() => PlanejamentoAtividade.list(), 3, 1500, 'cal.pa.all'),
          retryWithBackoff(() => PlanejamentoDocumento.list(), 3, 1500, 'cal.pd.all'),
        ]);
        const planosComExecutor = todosPlanos.filter(p => p.executores?.includes(userFilter) && p.executor_principal !== userFilter);
        const docPlanosComExecutor = todosDocPlanos.filter(p => p.executores?.includes(userFilter) && p.executor_principal !== userFilter);
        planosAtividade = [...planosExecPrincipal, ...planosComExecutor];
        planosDocumento = [...planosDocExecPrincipal, ...docPlanosComExecutor];
      } else {
        [planosAtividade, planosDocumento] = await Promise.all([
          retryWithBackoff(() => PlanejamentoAtividade.list(), 3, 1500, 'cal.pa'),
          retryWithBackoff(() => PlanejamentoDocumento.list(), 3, 1500, 'cal.pd'),
        ]);
      }
      const execFilter = userFilter !== 'all' ? { usuario: userFilter } : {};
      const execs = await retryWithBackoff(() => Execucao.filter(execFilter), 3, 1500, 'cal.execs');
      const planosAtividadeComTipo = (planosAtividade || []).map(p => ({ ...p, tipo_planejamento: 'atividade' }));
      const planosDocumentoComTipo = (planosDocumento || []).map(p => ({ ...p, tipo_planejamento: 'documento' }));
      setPlanejamentos([...planosAtividadeComTipo, ...planosDocumentoComTipo]);
      setExecucoes(execs || []);
    } catch (error) {
      console.error("Erro ao carregar dados do calendário:", error);
      setPlanejamentos([]); setExecucoes([]); setEnrichedData([]);
      alert("Erro ao carregar as atividades do calendário. Tente atualizar a página.");
    } finally {
      setIsCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasSelectedUser) loadCalendarData(filters.user);
    else { setPlanejamentos([]); setExecucoes([]); setEnrichedData([]); setIsCalendarLoading(false); }
  }, [filters.user, hasSelectedUser, loadCalendarData, updateKey]);

  useEffect(() => {
    const enrichData = async () => {
      if (!planejamentos || (planejamentos.length === 0 && execucoes.length === 0 && !isCalendarLoading)) { setEnrichedData([]); return; }
      try {
        const empreendimentoIds = [...new Set(planejamentos.map(p => p.empreendimento_id).filter(Boolean))];
        const atividadeIds = [...new Set(planejamentos.map(p => p.atividade_id).filter(Boolean))];
        const documentoIds = [...new Set(planejamentos.map(p => p.documento_id).filter(Boolean))];
        const [empreendimentosData, atividadesData, documentosData] = await Promise.all([
          empreendimentoIds.length > 0 ? retryWithBackoff(() => Empreendimento.filter({ id: { $in: empreendimentoIds } }), 3, 1000, 'enrich.emp') : Promise.resolve([]),
          atividadeIds.length > 0 ? retryWithBackoff(() => Atividade.filter({ id: { $in: atividadeIds } }), 3, 1000, 'enrich.ativ') : Promise.resolve([]),
          documentoIds.length > 0 ? retryWithBackoff(() => Documento.filter({ id: { $in: documentoIds } }), 3, 1000, 'enrich.docs') : Promise.resolve([]),
        ]);
        const empreendimentosMap = new Map((empreendimentosData || []).map(item => [item.id, item]));
        const atividadesMap = new Map((atividadesData || []).map(item => [item.id, item]));
        const documentosMap = new Map((documentosData || []).map(item => [item.id, item]));
        const horasExecutadasPorPlanejamento = {};
        (execucoes || []).forEach(exec => {
          if (!exec.planejamento_id || !exec.inicio) return;
          const diaExec = format(parseLocalDate(exec.inicio), 'yyyy-MM-dd');
          const tempoExec = Number(exec.tempo_total) || 0;
          if (!horasExecutadasPorPlanejamento[exec.planejamento_id]) horasExecutadasPorPlanejamento[exec.planejamento_id] = {};
          horasExecutadasPorPlanejamento[exec.planejamento_id][diaExec] = (horasExecutadasPorPlanejamento[exec.planejamento_id][diaExec] || 0) + tempoExec;
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
        console.error("Erro ao enriquecer dados:", error);
        setEnrichedData(planejamentos);
      }
    };
    enrichData();
  }, [planejamentos, execucoes, isCalendarLoading]);

  const handleActivityDelete = useCallback(() => {
    if (hasSelectedUser) loadCalendarData(filters.user);
    if (triggerUpdate) triggerUpdate();
  }, [triggerUpdate, hasSelectedUser, filters.user, loadCalendarData]);

  const toggleActivitySelection = useCallback((activityId) => {
    setSelectedActivities(prev => { const newSet = new Set(prev); if (newSet.has(activityId)) newSet.delete(activityId); else newSet.add(activityId); return newSet; });
  }, []);

  const clearSelection = useCallback(() => { setSelectedActivities(new Set()); setSelectedOSEmpreendimentoId(null); }, []);

  const handleSelectAllOS = useCallback((empId, executorEmail) => {
    setEnrichedData(current => {
      const atividadesDaOS = (current || []).filter(p =>
        p.empreendimento_id === empId &&
        !p.isLegacyExecution &&
        p.status !== 'concluido' &&
        (!executorEmail || p.executor_principal === executorEmail)
      );
      if (atividadesDaOS.length > 0) {
        setSelectedActivities(new Set(atividadesDaOS.map(a => a.id)));
        setSelectedOSEmpreendimentoId(empId);
      }
      return current;
    });
  }, []);

  const handleReprogramarAtividade = useCallback(async (atividadeId, novaDataInicio, executorEmail) => {
    setIsReprogramando(atividadeId);
    try {
      const atividadeParaMover = (enrichedData || []).find(p => p.id === atividadeId);
      if (!atividadeParaMover) throw new Error("Atividade não encontrada.");
      if (atividadeParaMover.isLegacyExecution) throw new Error("Atividades antigas não podem ser reprogramadas.");
      if (atividadeParaMover.status === 'concluido') throw new Error("Atividades concluídas não podem ser reprogramadas.");
      const entidadePlanejamento = atividadeParaMover.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      const planejamentosDoExecutor = (await retryWithBackoff(() => entidadePlanejamento.filter({ executor_principal: executorEmail }), 3, 1000, 'fetchPlans')).filter(p => p.status !== 'concluido' && !p.isLegacyExecution);
      const cargaDiariaExistente = {};
      planejamentosDoExecutor.forEach(p => {
        if (p.id !== atividadeId && p.horas_por_dia) Object.entries(p.horas_por_dia).forEach(([data, horas]) => { cargaDiariaExistente[data] = (cargaDiariaExistente[data] || 0) + Number(horas || 0); });
      });
      const { distribuicao, dataTermino } = distribuirHorasPorDias(parseLocalDate(novaDataInicio), atividadeParaMover.tempo_planejado, 8, cargaDiariaExistente);
      if (Object.keys(distribuicao).length === 0) throw new Error("Não foi possível alocar horas para a nova data.");
      const inicioPlanejado = Object.keys(distribuicao).sort()[0];
      const terminoPlanejado = dataTermino ? format(dataTermino, 'yyyy-MM-dd') : inicioPlanejado;
      await retryWithBackoff(() => entidadePlanejamento.update(atividadeId, { inicio_planejado: inicioPlanejado, termino_planejado: terminoPlanejado, horas_por_dia: distribuicao, inicio_ajustado: null, termino_ajustado: null }), 3, 1500, 'updatePlan');
      if (hasSelectedUser) loadCalendarData(filters.user);
      if (triggerUpdate) triggerUpdate();
    } catch (error) {
      console.error("Erro ao reprogramar:", error);
      alert(`Erro ao reprogramar: ${error.message}`);
      throw error;
    } finally {
      setIsReprogramando(null);
    }
  }, [enrichedData, triggerUpdate, hasSelectedUser, filters.user, loadCalendarData]);

  const handleMoverOSConfirm = useCallback(async () => {
    if (!moverOSData.novaData) return;
    const atividadesParaMover = Array.from(selectedActivities)
      .map(id => (enrichedData || []).find(p => p.id === id))
      .filter(Boolean)
      .filter(a => !a.isLegacyExecution && a.status !== 'concluido');
    if (atividadesParaMover.length === 0) return;

    // Ordenação topológica para mover predecessoras primeiro
    const idSet = new Set(atividadesParaMover.map(p => p.id));
    const inDeg = {}; const adj = {};
    atividadesParaMover.forEach(p => { inDeg[p.id] = 0; adj[p.id] = []; });
    atividadesParaMover.forEach(p => {
      if (p.predecessora_id && idSet.has(p.predecessora_id)) { adj[p.predecessora_id].push(p.id); inDeg[p.id]++; }
    });
    const topoOrder = new Map();
    const queue = atividadesParaMover.filter(p => inDeg[p.id] === 0).sort((a, b) => (a.inicio_planejado || '').localeCompare(b.inicio_planejado || ''));
    let order = 0;
    while (queue.length > 0) {
      const cur = queue.shift();
      topoOrder.set(cur.id, order++);
      (adj[cur.id] || []).forEach(sId => { inDeg[sId]--; if (inDeg[sId] === 0) { const s = atividadesParaMover.find(p => p.id === sId); if (s) queue.push(s); } });
      queue.sort((a, b) => (a.inicio_planejado || '').localeCompare(b.inicio_planejado || ''));
    }
    const sorted = [...atividadesParaMover].sort((a, b) => (topoOrder.get(a.id) ?? 999) - (topoOrder.get(b.id) ?? 999));

    setMoverOSData(prev => ({ ...prev, isMoving: true }));
    let ok = 0, fail = 0;
    for (const a of sorted) {
      try { await handleReprogramarAtividade(a.id, moverOSData.novaData, a.executor_principal); ok++; await new Promise(r => setTimeout(r, 400)); }
      catch { fail++; }
    }
    setMoverOSData({ novaData: '', isMoving: false });
    setShowMoverOSModal(false);
    if (ok > 0) { alert(`✅ ${ok} atividade(s) reprogramadas!${fail > 0 ? `\n⚠️ ${fail} falharam` : ''}`); clearSelection(); }
    else alert('❌ Nenhuma atividade pôde ser movida.');
  }, [selectedActivities, enrichedData, moverOSData.novaData, handleReprogramarAtividade, clearSelection]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (!hasPermission('admin')) { alert("Você não tem permissão para replanejar."); return; }
    if (destination.droppableId === source.droppableId) return;

    const isDayDrag = draggableId.startsWith('day-');
    if (isDayDrag) {
      const sourceDayKey = draggableId.replace('day-', '');
      const dayActivities = activitiesByDay[sourceDayKey] || [];
      const movableActivities = dayActivities.filter(a => !a.isLegacyExecution && a.status !== 'concluido');
      if (movableActivities.length === 0) { alert("Nenhuma atividade pode ser movida."); return; }
      if (!window.confirm(`Mover ${movableActivities.length} atividade(s) para ${format(parseISO(destination.droppableId), 'd MMM', { locale: ptBR })}?`)) return;
      (async () => {
        let ok = 0, fail = 0;
        for (let i = 0; i < movableActivities.length; i++) {
          try { await handleReprogramarAtividade(movableActivities[i].id, destination.droppableId, movableActivities[i].executor_principal); ok++; if (i < movableActivities.length - 1) await new Promise(r => setTimeout(r, 500)); }
          catch { fail++; }
        }
        if (ok > 0) { alert(`✅ ${ok} atividade(s) reprogramadas!${fail > 0 ? `\n⚠️ ${fail} falharam` : ''}`); clearSelection(); }
        else alert(`❌ Nenhuma atividade pôde ser movida.`);
      })();
      return;
    }

    const isGroupDrag = draggableId.startsWith('group-');
    if (isGroupDrag) {
      const parts = draggableId.replace('group-', '').split('-');
      const sourceDayKey = parts.pop();
      const groupKey = parts.join('-');
      const allActivitiesInSourceDay = activitiesByDay[source.droppableId] || [];
      let groupActivities = [];
      if (groupKey.startsWith('virtual-')) { const e = groupKey.replace('virtual-', ''); groupActivities = allActivitiesInSourceDay.filter(a => a.isLegacyExecution && a.executor_principal === e); }
      else if (groupKey.startsWith('geral-')) { const e = groupKey.replace('geral-', ''); groupActivities = allActivitiesInSourceDay.filter(a => !a.empreendimento_id && a.executor_principal === e && !a.isLegacyExecution); }
      else { const [empId, e] = groupKey.split('|'); groupActivities = allActivitiesInSourceDay.filter(a => a.empreendimento_id === empId && a.executor_principal === e && !a.isLegacyExecution); }
      if (groupActivities.some(a => a.isLegacyExecution || a.status === 'concluido')) { alert("Algumas atividades não podem ser reprogramadas."); return; }
      (async () => {
        let ok = 0, fail = 0;
        for (const a of groupActivities) { try { await handleReprogramarAtividade(a.id, destination.droppableId, a.executor_principal); ok++; await new Promise(r => setTimeout(r, 500)); } catch { fail++; } }
        if (ok > 0) { alert(`✅ ${ok} atividade(s) reprogramadas!${fail > 0 ? `\n⚠️ ${fail} falharam` : ''}`); clearSelection(); } else alert(`❌ Erro ao mover atividades.`);
      })();
      return;
    }

    const activitiesToMove = selectedActivities.has(draggableId) && selectedActivities.size > 1 ? Array.from(selectedActivities) : [draggableId];
    if (activitiesToMove.some(id => { const a = (enrichedData || []).find(p => p.id === id); return !a || a.isLegacyExecution || a.status === 'concluido'; })) { alert("Algumas atividades não podem ser reprogramadas."); return; }
    (async () => {
      let ok = 0, fail = 0;
      for (const activityId of activitiesToMove) {
        const a = (enrichedData || []).find(p => p.id === activityId);
        if (!a) continue;
        try { await handleReprogramarAtividade(activityId, destination.droppableId, a.executor_principal); ok++; await new Promise(r => setTimeout(r, 500)); } catch { fail++; }
      }
      if (ok > 0) { alert(`✅ ${ok} atividade(s) reprogramadas!${fail > 0 ? `\n⚠️ ${fail} falharam` : ''}`); clearSelection(); } else alert(`❌ Erro ao mover atividades.`);
    })();
  };

  const filteredPlanejamentos = useMemo(() => {
    if (!hasSelectedUser) return [];
    const base = enrichedData || [];
    if (filters.discipline !== 'all') {
      return base.filter(item => {
        if (item.tipo_planejamento === 'documento' && item.atividade_id === null) return item.documento?.subdisciplinas?.includes(filters.discipline) || false;
        return item.atividade?.disciplina === filters.discipline;
      });
    }
    return base;
  }, [enrichedData, filters.discipline, hasSelectedUser]);

  const activitiesByDay = useMemo(() => {
    if (!hasSelectedUser) return {};
    const grouped = {};
    const processedPlanIds = new Set();

    filteredPlanejamentos.forEach(plano => {
      processedPlanIds.add(plano.id);
      const diasParaExibir = new Set();
      const isQuickActivity = plano.is_quick_activity || plano.isQuickActivity;

      if (isQuickActivity) {
        if (plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object') {
          Object.keys(plano.horas_executadas_por_dia).forEach(dk => { if ((Number(plano.horas_executadas_por_dia[dk]) || 0) > 0.01) diasParaExibir.add(dk); });
        }
      } else {
        const realStatus = calculateActivityStatus(plano, filteredPlanejamentos);
        const foiExecutada = plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object' && Object.keys(plano.horas_executadas_por_dia).length > 0;
        if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') {
          Object.keys(plano.horas_por_dia).forEach(dk => { if ((Number(plano.horas_por_dia[dk]) || 0) >= 0.05) diasParaExibir.add(dk); });
        }
        if (foiExecutada) {
          Object.keys(plano.horas_executadas_por_dia).forEach(dk => { if ((Number(plano.horas_executadas_por_dia[dk]) || 0) >= 0.05) diasParaExibir.add(dk); });
        }
      }

      diasParaExibir.forEach(dk => {
        if (!grouped[dk]) grouped[dk] = [];
        if (!grouped[dk].some(item => item.id === plano.id)) {
          grouped[dk].push({ ...plano, isQuickActivity: !!plano.is_quick_activity, isLegacyExecution: false });
        }
      });
    });

    (execucoes || []).forEach(exec => {
      if (exec.planejamento_id && processedPlanIds.has(exec.planejamento_id)) return;
      const diaExecucao = exec.inicio ? startOfDay(parseLocalDate(exec.inicio)) : null;
      if (diaExecucao && isValid(diaExecucao)) {
        const dk = format(diaExecucao, 'yyyy-MM-dd');
        if (!grouped[dk]) grouped[dk] = [];
        const legacyExecPlano = {
          id: `exec-${exec.id}`, descritivo: exec.descritivo || 'Atividade rápida antiga',
          tempo_executado: exec.tempo_total || 0, tempo_planejado: exec.tempo_total || 0,
          status: exec.status === 'Finalizado' ? 'concluido' : exec.status === 'Em andamento' ? 'em_andamento' : 'pausado',
          executor_principal: exec.usuario, inicio_planejado: dk, termino_planejado: dk,
          horas_por_dia: { [dk]: exec.tempo_total || 0 }, isLegacyExecution: true, tipo_planejamento: 'atividade',
        };
        if (!grouped[dk].some(item => item.id === legacyExecPlano.id)) grouped[dk].push(legacyExecPlano);
      }
    });

    // Calcular ordem topológica global (para ordenar cards dentro do dia)
    const topoOrderMap = new Map();
    const buildGlobalTopoOrder = (allPlanos) => {
      const idSet = new Set(allPlanos.map(p => p.id));
      const inDegree = {};
      const adjList = {};
      allPlanos.forEach(p => { inDegree[p.id] = 0; adjList[p.id] = []; });
      allPlanos.forEach(p => {
        if (p.predecessora_id && idSet.has(p.predecessora_id)) {
          adjList[p.predecessora_id].push(p.id);
          inDegree[p.id]++;
        }
      });
      const byInicio = (a, b) => (a.inicio_planejado || '').localeCompare(b.inicio_planejado || '');
      const queue = allPlanos.filter(p => inDegree[p.id] === 0).sort(byInicio);
      let order = 0;
      while (queue.length > 0) {
        const current = queue.shift();
        topoOrderMap.set(current.id, order++);
        (adjList[current.id] || []).forEach(succId => {
          inDegree[succId]--;
          if (inDegree[succId] === 0) {
            const succItem = allPlanos.find(p => p.id === succId);
            if (succItem) queue.push(succItem);
          }
          queue.sort(byInicio);
        });
      }
      allPlanos.forEach(p => { if (!topoOrderMap.has(p.id)) topoOrderMap.set(p.id, order++); });
    };

    const allGroupedItems = Object.values(grouped).flat();
    buildGlobalTopoOrder(allGroupedItems);

    // Ordenar cada dia pela ordem topológica global
    for (const dk in grouped) {
      grouped[dk] = grouped[dk].sort((a, b) => {
        const oA = topoOrderMap.get(a.id) ?? 999999;
        const oB = topoOrderMap.get(b.id) ?? 999999;
        if (oA !== oB) return oA - oB;
        return (a.inicio_planejado || '').localeCompare(b.inicio_planejado || '');
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
      if (plano.horas_por_dia) Object.entries(plano.horas_por_dia).forEach(([data, horas]) => { carga[userEmail][data] = (carga[userEmail][data] || 0) + Number(horas); });
    });
    (execucoes || []).forEach(exec => {
      if (exec.planejamento_id && filteredPlanejamentos.some(p => p.id === exec.planejamento_id)) return;
      const userEmail = exec.usuario;
      const dk = exec.inicio ? format(startOfDay(parseLocalDate(exec.inicio)), 'yyyy-MM-dd') : null;
      if (userEmail && dk) { if (!carga[userEmail]) carga[userEmail] = {}; carga[userEmail][dk] = (carga[userEmail][dk] || 0) + (exec.tempo_total || 0); }
    });
    return carga;
  }, [filteredPlanejamentos, execucoes, hasSelectedUser]);

  const handleDateChange = (direction) => {
    const changeFn = direction === 'next' ? { month: addMonths, week: addWeeks, day: addDays } : { month: subMonths, week: subWeeks, day: subDays };
    setCurrentDate(current => changeFn[viewMode](current, 1));
  };

  const horasDoDia = useMemo(() => {
    const dk = format(currentDate, 'yyyy-MM-dd');
    let soma = 0;
    (activitiesByDay[dk] || []).forEach(a => {
      const ha = Number(a.horas_por_dia?.[dk]) || 0;
      const he = Number(a.horas_executadas_por_dia?.[dk]) || 0;
      const te = Number(a.tempo_executado) || 0;
      let h = 0;
      if (a.isLegacyExecution) h = te;
      else if (a.isQuickActivity || a.is_quick_activity) h = he > 0 ? he : ha;
      else if (he > 0) h = he;
      else if (a.status === 'concluido' && te > 0 && Object.keys(a.horas_executadas_por_dia || {}).length === 0) { const dp = Object.keys(a.horas_por_dia || {}); h = dp.length > 0 && dp.includes(dk) ? te / dp.length : 0; }
      else h = ha;
      soma += h;
    });
    return Math.ceil(soma * 10) / 10;
  }, [currentDate, activitiesByDay, viewMode]);

  const headerTitle = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    if (viewMode === 'week') { const s = startOfWeek(currentDate, { locale: ptBR }); const e = endOfWeek(currentDate, { locale: ptBR }); return `${format(s, 'd MMM')} - ${format(e, 'd MMM, yyyy', { locale: ptBR })}`; }
    return format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR });
  }, [currentDate, viewMode]);

  const handleClearFilters = () => {
    const up = userProfile?.usuarios_permitidos_visualizar || [];
    const temPermissao = Array.isArray(up) && up.length > 0;
    if ((isGestao || isColaborador || isApoio) && !temPermissao) { setFilters(prev => ({ ...prev, discipline: 'all' })); clearSelection(); return; }
    setFilters({ user: '', discipline: 'all' }); clearSelection();
  };

  const selectedUserName = isViewingAllUsers ? 'Todos os Usuários' : executorMap[filters.user]?.nome || filters.user;
  const totalLoading = isDashboardRefreshing || isCalendarLoading;
  const canReprogram = hasPermission('admin');

  const renderContent = () => {
    if (!hasSelectedUser) return (
      <div className="p-12 text-center min-h-[400px] flex flex-col justify-center items-center">
        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Selecione um Usuário</h3>
        <p className="text-gray-500 mb-6">Para começar, selecione um usuário no filtro acima para carregar o calendário.</p>
      </div>
    );
    if (totalLoading) return <div className="flex justify-center items-center h-[400px]"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /><p className="ml-3 text-lg text-gray-600">Carregando atividades do calendário...</p></div>;
    const hasSelections = selectedActivities.size > 0;
    const sharedProps = { activitiesByDay, disciplinas, onActivityDelete: handleActivityDelete, onShowPrevisao: (planos) => { setPlanejamentosParaPrevisao(planos); setShowPrevisaoModal(true); }, executorMap, allPlanejamentos: enrichedData, isReprogramando, canReprogram, selectedActivities, onToggleSelect: toggleActivitySelection, hasSelections, viewType, onSelectAllOS: canReprogram ? handleSelectAllOS : null };
    if (viewMode === 'month') return <MonthView date={currentDate} {...sharedProps} />;
    if (viewMode === 'week') return <WeekView date={currentDate} {...sharedProps} />;
    if (viewMode === 'day') return <DayView date={currentDate} {...sharedProps} />;
    return null;
  };

  const refreshAll = () => { if (onRefresh) onRefresh(); if (hasSelectedUser) loadCalendarData(filters.user); };

  return (
    <>
      <Card className="bg-white shadow-lg border-0 h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-gray-900 capitalize">
              <Calendar className="w-6 h-6 text-blue-600" />
              {hasSelectedUser ? (
                <div className="flex items-center gap-3">
                  <span>{`Calendário - ${selectedUserName} (${filteredPlanejamentos.length})`}</span>
                  {viewMode === 'day' && <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{horasDoDia}h planejadas</span>}
                </div>
              ) : 'Calendário de Planejamento'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedActivities.size > 0 && canReprogram && (
                <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-sm font-medium text-indigo-700">{selectedActivities.size} atividade{selectedActivities.size > 1 ? 's' : ''} selecionada{selectedActivities.size > 1 ? 's' : ''}</span>
                  <Button size="sm" onClick={() => setShowMoverOSModal(true)} className="h-6 px-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                    Mover OS
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100">✕</Button>
                </div>
              )}
              {hasSelectedUser && (
                <>
                  {(!isColaborador && !isApoio) && <Button variant="outline" onClick={() => setShowPrevisaoModal(true)}><LineChart className="w-4 h-4 mr-2" />Previsão de Entrega</Button>}
                  <Button variant="outline" onClick={refreshAll} disabled={totalLoading}><RefreshCw className={`w-4 h-4 mr-2 ${totalLoading ? 'animate-spin' : ''}`} />{totalLoading ? "Atualizando..." : "Atualizar"}</Button>
                  <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDateChange('prev')}><ChevronLeft className="w-5 h-5" /></Button>
                  <h3 className="text-xl font-semibold w-64 text-center capitalize">{headerTitle}</h3>
                  <Button variant="ghost" size="icon" onClick={() => handleDateChange('next')}><ChevronRight className="w-5 h-5" /></Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CalendarFilters users={usuarios} disciplines={disciplinas} viewMode={viewMode} onViewModeChange={setViewMode} filters={filters} podeVerOutros={podeVisualizarOutros} currentUserEmail={user?.email} usuariosPermitidos={usuariosPermitidos} viewType={viewType}
          onFilterChange={(key, value) => {
            if (key === 'viewType') { setViewType(value); return; }
            const up = userProfile?.usuarios_permitidos_visualizar || [];
            const temPermissao = Array.isArray(up) && up.length > 0;
            if ((isGestao || isColaborador || isApoio) && !temPermissao && key === 'user') return;
            setFilters(prev => ({ ...prev, [key]: value }));
          }}
          onClearFilters={handleClearFilters} hasSelectedUser={hasSelectedUser} isColaborador={isColaborador} isViewingAllUsers={isViewingAllUsers} isGestao={isGestao} isApoio={isApoio} />
        <DragDropContext onDragEnd={onDragEnd}>
          <CardContent className="p-0 flex-1">{renderContent()}</CardContent>
        </DragDropContext>
      </Card>
      {hasSelectedUser && (
        <PrevisaoEntregaModal isOpen={showPrevisaoModal} onClose={() => setShowPrevisaoModal(false)}
          planejamentos={planejamentosParaPrevisao.length > 0 ? planejamentosParaPrevisao : filteredPlanejamentos}
          execucoes={[]}
          cargaDiaria={planejamentosParaPrevisao.length > 0 && planejamentosParaPrevisao[0].executor_principal ? cargaDiariaPorUsuario[planejamentosParaPrevisao[0].executor_principal] || {} : {}} />
      )}
    </>
  );
}