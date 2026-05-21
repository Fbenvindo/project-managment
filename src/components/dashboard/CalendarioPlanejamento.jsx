// @ts-nocheck
import React, { useState, useMemo, useEffect, useContext, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Filter, Trash2, CalendarDays, Play, RefreshCw, LineChart, Users, Loader2, Edit2, ListOrdered } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, parseISO, addWeeks, subWeeks, addDays, subDays, startOfDay,
  isValid, isAfter
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import PrevisaoEntregaModal from './PrevisaoEntregaModal';
import EditActivityModal from './EditActivityModal';
import ActivityItem from './CalendarioActivityItem';
import { PlanejamentoAtividade, Atividade, Documento, Empreendimento, Execucao, PlanejamentoDocumento } from '@/entities/all';
import { ChevronsUpDown } from 'lucide-react';
import { isActivityOverdue as isOverdueShared, distribuirHorasPorDias } from '../utils/DateCalculator';
import { retryWithBackoff } from '../utils/apiUtils';

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

const normalizeActivityId = (value) => String(value ?? '');
const formatHours = (h) => Number(h).toFixed(1);

const isActivityOverdue = (plano) => {
  if (plano.isLegacyExecution) return false;
  return isOverdueShared(plano);
};

export const calculateActivityStatus = (plano, allPlanejamentos = []) => {
  if (plano.isLegacyExecution) return plano.status;
  if (plano.status === 'concluido_com_atraso') return 'concluido_com_atraso';
  if (plano.status === 'concluido') return 'concluido';
  const dataRef = plano.termino_ajustado || plano.termino_planejado;
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const estaAtrasada = dataRef && hoje > dataRef;
  if (estaAtrasada && (!plano.status || plano.status === 'nao_iniciado' || plano.status === 'atrasado')) return 'nao_iniciado_atrasado';
  if (estaAtrasada && (plano.status === 'em_andamento' || plano.status === 'pausado')) return 'em_andamento_atrasado';
  if (isActivityOverdue(plano)) return 'nao_iniciado_atrasado';
  if (plano.inicio_ajustado && plano.inicio_planejado) {
    try { const aj=startOfDay(parseISO(plano.inicio_ajustado)),pl=startOfDay(parseISO(plano.inicio_planejado)); if(isValid(aj)&&isValid(pl)&&isAfter(aj,pl)) return 'impactado_por_atraso'; } catch(e){}
  }
  if (plano.predecessora_id) {
    const pred = allPlanejamentos.find(p => normalizeActivityId(p.id) === normalizeActivityId(plano.predecessora_id));
    if (pred && isActivityOverdue(pred)) return 'impactado_por_atraso';
  }
  if (plano.termino_ajustado && plano.termino_planejado) {
    try { const aj=startOfDay(parseISO(plano.termino_ajustado)),pl=startOfDay(parseISO(plano.termino_planejado)); if(isValid(aj)&&isValid(pl)&&isAfter(aj,pl)) return 'replanejado_atrasado'; } catch(e){}
  }
  return plano.status || 'nao_iniciado';
};

// --- Sub-componente de Filtros ---
const CalendarFilters = ({ users, disciplines, viewMode, onViewModeChange, filters, onFilterChange, onClearFilters, hasSelectedUser, isColaborador, isViewingAllUsers, isGestao, isApoio, podeVerOutros, usuariosPermitidos, currentUserEmail, viewType }) => {
  const usersOrdenados = useMemo(() => [...users].filter(u => u.nome || u.full_name).sort((a, b) => (a.nome||a.full_name||'').localeCompare(b.nome||b.full_name||'', 'pt-BR', { sensitivity: 'base' })), [users]);
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
              <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4 mr-2" />Limpar Filtros</Button>
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

// --- Sub-componente de Grupo de Atividades Diárias ---
const DailyActivityGroup = ({ empreendimento, executor, atividades, isExpanded, onToggle, disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, groupKey, provided, isDragging }) => {
  const totalHoras = useMemo(() => {
    if (!dayKey) return 0;
    let soma = 0;
    atividades.forEach((atividade) => {
      const horasAlocadasDia = Number(atividade.horas_por_dia?.[dayKey]) || 0;
      const horasExecutadasNoDia = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
      const tempoExecutado = Number(atividade.tempo_executado) || 0;
      let horasDoDia = 0;
      if (atividade.isLegacyExecution) { horasDoDia = tempoExecutado; }
      else if (atividade.isQuickActivity || atividade.is_quick_activity) { horasDoDia = horasExecutadasNoDia > 0 ? horasExecutadasNoDia : horasAlocadasDia; }
      else if (horasExecutadasNoDia > 0) { horasDoDia = horasExecutadasNoDia; }
      else if ((atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso') && tempoExecutado > 0 && Object.keys(atividade.horas_executadas_por_dia || {}).length === 0) {
        const dp = Object.keys(atividade.horas_por_dia || {});
        horasDoDia = dp.length > 0 && dp.includes(dayKey) ? tempoExecutado / dp.length : tempoExecutado;
      } else { horasDoDia = horasAlocadasDia; }
      soma += horasDoDia;
    });
    return soma;
  }, [atividades, dayKey]);

  const statusCounts = atividades.reduce((acc, atividade) => {
    const realStatus = calculateActivityStatus(atividade, allPlanejamentos);
    acc[realStatus] = (acc[realStatus] || 0) + 1;
    return acc;
  }, {});

  const disciplineColors = useMemo(() => {
    const disciplineMap = (disciplinas || []).reduce((acc, d) => { acc[d.nome] = d.cor; return acc; }, {});
    const uniqueDisciplines = [...new Set(atividades.map(a => a.atividade?.disciplina).filter(Boolean))];
    return uniqueDisciplines.map(dName => ({ name: dName, color: disciplineMap[dName] || '#A1A1AA' }));
  }, [atividades, disciplinas]);

  const getGroupStatus = () => {
    if (statusCounts['nao_iniciado_atrasado'] > 0 || statusCounts['atrasado'] > 0 || statusCounts['replanejado_atrasado'] > 0) return 'nao_iniciado_atrasado';
    if (statusCounts['em_andamento_atrasado'] > 0) return 'em_andamento_atrasado';
    if (statusCounts['impactado_por_atraso'] > 0) return 'impactado_por_atraso';
    if (statusCounts['em_andamento'] > 0) return 'em_andamento';
    const totalConcluidos = (statusCounts['concluido'] || 0) + (statusCounts['concluido_com_atraso'] || 0);
    if (atividades.length > 0 && totalConcluidos === atividades.length) return statusCounts['concluido_com_atraso'] > 0 ? 'concluido_com_atraso' : 'concluido';
    if (statusCounts['pausado'] > 0) return 'pausado';
    return 'nao_iniciado';
  };

  const getStatusColor = (s) => ({ em_andamento:'#3b82f6', pausado:'#f59e0b', concluido:'#10b981', concluido_com_atraso:'#ef4444', nao_iniciado_atrasado:'#ef4444', atrasado:'#ef4444', replanejado_atrasado:'#ef4444', em_andamento_atrasado:'#f59e0b', impactado_por_atraso:'#8b5cf6' }[s] || '#6b7280');

  const groupStatus = getGroupStatus();
  const statusColor = getStatusColor(groupStatus);
  const empreendimentoNome = empreendimento?.nome || empreendimento?.nome_fantasia || 'Sem Empreendimento';
  const planoExecutor = executor?.email ? executorMap[executor.email] : null;
  const executorNome = planoExecutor?.nome || planoExecutor?.email || 'Sem Executor';
  const canDragGroup = canReprogram && empreendimentoNome !== 'Atividades Rápidas' && !atividades.some(a => a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.isLegacyExecution);
  const selectableIds = atividades.filter(a => a.status !== 'concluido' && a.status !== 'concluido_com_atraso' && !a.isLegacyExecution).map(a => normalizeActivityId(a.id));
  const isGroupSelected = selectableIds.length > 0 && selectableIds.every(id => selectedActivities.has(id));
  const isGroupPartial = !isGroupSelected && selectableIds.some(id => selectedActivities.has(id));

  const handleGroupCheckbox = (e) => {
    e.stopPropagation();
    if (isGroupSelected) { selectableIds.forEach(id => { if (selectedActivities.has(id)) onToggleSelect(id); }); }
    else { selectableIds.forEach(id => { if (!selectedActivities.has(id)) onToggleSelect(id); }); }
  };

  return (
    <div className="mb-1 group" ref={provided?.innerRef} {...(provided?.draggableProps || {})}>
      <div onClick={onToggle} style={{
        borderLeft: `6px solid ${statusColor}`,
        backgroundColor: isDragging ? '#e0e7ff' :
          (groupStatus === 'concluido_com_atraso' || groupStatus === 'nao_iniciado_atrasado') ? '#fff1f2' :
          groupStatus === 'em_andamento_atrasado' ? '#fefce8' :
          groupStatus === 'impactado_por_atraso' ? '#f5f3ff' :
          groupStatus === 'em_andamento' ? '#eff6ff' :
          groupStatus === 'concluido' ? '#f0fdf4' :
          groupStatus === 'pausado' ? '#fefce8' : '#f8fafc',
        cursor: 'pointer',
        ...(isDragging && { boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', transform: 'rotate(1deg) scale(1.02)', transition: 'all 0.2s ease' })
      }} className={`p-2 rounded-lg hover:shadow-md transition-shadow duration-200 border relative ${isDragging ? 'border-indigo-400 ring-2 ring-indigo-200' : isGroupSelected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}>
        {selectableIds.length > 0 && (
          <div className={`absolute right-1 top-1 z-20 transition-opacity ${isGroupSelected || isGroupPartial || hasSelections ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={handleGroupCheckbox}>
            <input type="checkbox" checked={isGroupSelected} ref={el => { if (el) el.indeterminate = isGroupPartial; }} onChange={() => {}} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" title={isGroupSelected ? 'Desmarcar grupo' : 'Selecionar grupo'} />
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          {canDragGroup && (
            <div {...(provided?.dragHandleProps || {})} onClick={(e) => e.stopPropagation()} className="cursor-move p-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex-shrink-0 border border-gray-300" title="🖐️ Arrastar todo o grupo" style={{ minWidth: '20px', minHeight: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              {disciplineColors.map(d => <div key={d.name} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} title={d.name}></div>)}
              <Button variant="ghost" size="icon" className="w-5 h-5 ml-auto text-purple-500 hover:bg-purple-100" onClick={(e) => { e.stopPropagation(); onShowPrevisao(atividades); }} title="Ver Previsão de Entrega"><LineChart className="w-3.5 h-3.5" /></Button>
            </div>
            <p className="font-bold text-xs truncate text-gray-800" title={empreendimentoNome}>{empreendimentoNome}</p>
            {empreendimentoNome !== 'Atividades Rápidas' && (
              <div className="flex items-center gap-1.5 mt-1"><User className="w-3 h-3 flex-shrink-0" /><p className="text-xs font-medium truncate" title={executorNome}>{executorNome}</p></div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="px-1.5 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: statusColor }}>{totalHoras > 0 ? `${formatHours(totalHoras)}h` : '0h'}</div>
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
              <Draggable key={atividade.id} draggableId={`${atividade.id}`} index={index} isDragDisabled={!canReprogram || atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso' || atividade.isLegacyExecution || normalizeActivityId(isReprogramando) === normalizeActivityId(atividade.id)}>
                {(provided, snapshot) => (
                  <ActivityItem plano={atividade} dayKey={dayKey} onDelete={onActivityDelete} executorMap={executorMap} allPlanejamentos={allPlanejamentos} provided={provided} isDragging={snapshot.isDragging} isReprogramando={normalizeActivityId(isReprogramando) === normalizeActivityId(atividade.id)} isSelected={selectedActivities.has(normalizeActivityId(atividade.id))} onToggleSelect={onToggleSelect} hasSelections={hasSelections} />
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
const ActivityContainer = ({ activities, containerClass = "", disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder }) => {
  const [expandedGroups, setExpandedGroups] = useState(new Set());

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
    const activitiesParaRenderizar = modoOrdenacao ? activities : activities.filter(atividade => {
      const horasAlocadas = Number(atividade.horas_por_dia?.[dayKey]) || 0;
      const horasExecutadas = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
      const tempoExecutado = Number(atividade.tempo_executado) || 0;
      if (atividade.isLegacyExecution) return tempoExecutado >= 0.05;
      if (atividade.isQuickActivity || atividade.is_quick_activity) return horasExecutadas >= 0.05 || horasAlocadas >= 0.05 || atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso' || atividade.status === 'em_andamento';
      return horasAlocadas >= 0.05 || horasExecutadas >= 0.05 || ((atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso') && !atividade.atividade_id);
    });
    const temOrdemCustomizada = activities.length > 0 && (() => { try { const stored = JSON.parse(localStorage.getItem('calendar-activity-order') || '{}'); return !!stored[dayKey]; } catch { return false; } })();
    return (
      <div className={`space-y-1 ${containerClass}`}>
        {modoOrdenacao && temOrdemCustomizada && <div className="flex justify-end mb-1"><button onClick={() => onClearDayOrder && onClearDayOrder(dayKey)} className="text-xs text-amber-600 hover:text-amber-800 underline">Restaurar ordem padrão</button></div>}
        {activitiesParaRenderizar.map((atividade, index) => (
          <Draggable key={atividade.id} draggableId={`${atividade.id}`} index={index} isDragDisabled={modoOrdenacao ? (atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso') : (!canReprogram || atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso' || atividade.isLegacyExecution || normalizeActivityId(isReprogramando) === normalizeActivityId(atividade.id))}>
            {(provided, snapshot) => (
              <ActivityItem plano={atividade} dayKey={dayKey} onDelete={onActivityDelete} executorMap={executorMap} allPlanejamentos={allPlanejamentos} provided={provided} isDragging={snapshot.isDragging} isReprogramando={normalizeActivityId(isReprogramando) === normalizeActivityId(atividade.id)} isSelected={selectedActivities.has(normalizeActivityId(atividade.id))} onToggleSelect={onToggleSelect} hasSelections={hasSelections} orderIndex={index} />
            )}
          </Draggable>
        ))}
      </div>
    );
  }

  const groupsComHoras = Object.entries(activityGroups).filter(([_, groupData]) => groupData.atividades.some(atividade => {
    const horasAlocadas = Number(atividade.horas_por_dia?.[dayKey]) || 0;
    const horasExecutadas = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
    const tempoExecutado = Number(atividade.tempo_executado) || 0;
    if (atividade.isLegacyExecution) return tempoExecutado >= 0.05;
    if (atividade.isQuickActivity || atividade.is_quick_activity) return horasExecutadas >= 0.05 || horasAlocadas >= 0.05 || atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso' || atividade.status === 'em_andamento';
    return horasAlocadas >= 0.05 || horasExecutadas >= 0.05;
  }));

  return (
    <div className={`space-y-1 ${containerClass}`}>
      {groupsComHoras.map(([groupKey, groupData]) => {
        const atividadesComHoras = groupData.atividades.filter(atividade => {
          const horasAlocadas = Number(atividade.horas_por_dia?.[dayKey]) || 0;
          const horasExecutadas = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
          const tempoExecutado = Number(atividade.tempo_executado) || 0;
          if (atividade.isLegacyExecution) return tempoExecutado >= 0.05;
          if (atividade.isQuickActivity || atividade.is_quick_activity) return horasExecutadas >= 0.05 || horasAlocadas >= 0.05 || atividade.status === 'concluido' || atividade.status === 'em_andamento';
          return horasAlocadas >= 0.05 || horasExecutadas >= 0.05;
        });
        if (atividadesComHoras.length === 0) return null;
        const groupDataFiltrado = { ...groupData, atividades: atividadesComHoras };
        const canDragGroup = canReprogram && groupDataFiltrado.empreendimento?.nome !== 'Atividades Rápidas' && !groupDataFiltrado.atividades.some(a => a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.isLegacyExecution);
        if (canDragGroup) {
          return (
            <Draggable key={`group-${groupKey}-${dayKey}`} draggableId={`group-${groupKey}-${dayKey}`} index={0} isDragDisabled={!canDragGroup}>
              {(provided, snapshot) => (
                <DailyActivityGroup empreendimento={groupDataFiltrado.empreendimento} executor={groupDataFiltrado.executor} atividades={groupDataFiltrado.atividades} isExpanded={expandedGroups.has(groupKey)} onToggle={() => toggleGroup(groupKey)} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} groupKey={groupKey} provided={provided} isDragging={snapshot.isDragging} />
              )}
            </Draggable>
          );
        } else {
          return <DailyActivityGroup key={`group-${groupKey}-${dayKey}-static`} empreendimento={groupDataFiltrado.empreendimento} executor={groupDataFiltrado.executor} atividades={groupDataFiltrado.atividades} isExpanded={expandedGroups.has(groupKey)} onToggle={() => toggleGroup(groupKey)} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} groupKey={groupKey} />;
        }
      })}
    </div>
  );
};

// --- DayCell ---
const DayCell = ({ day, dayActivities, date, isToday, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType }) => {
  const dayKey = format(day, 'yyyy-MM-dd');
  const hasMovableActivities = dayActivities.some(a => !a.isLegacyExecution && a.status !== 'concluido' && a.status !== 'concluido_com_atraso');
  const canDragDay = canReprogram && hasMovableActivities && dayActivities.length > 0;
  return (
    <Droppable droppableId={dayKey}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps} className={`h-40 p-2 border border-gray-100 flex flex-col group ${isSameMonth(day, date) ? 'bg-white' : 'bg-gray-50'} ${isToday ? 'border-2 border-blue-500 bg-blue-50' : ''} ${snapshot.isDraggingOver ? 'bg-purple-100' : ''}`}>
          <div className="flex items-center justify-between mb-2 relative">
            {canDragDay && (
              <Draggable draggableId={`day-${dayKey}`} index={0} isDragDisabled={!canDragDay}>
                {(dayProvided, daySnapshot) => (
                  <div ref={dayProvided.innerRef} {...dayProvided.draggableProps} className={`absolute top-0 left-0 right-0 z-20 ${daySnapshot.isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <div {...dayProvided.dragHandleProps} className={`flex items-center justify-center gap-2 p-1 rounded-b cursor-move ${daySnapshot.isDragging ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`} title="🖐️ Arrastar todas as atividades deste dia">
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
            <ActivityContainer activities={dayActivities} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} />
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
};

// --- MonthView ---
const MonthView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType }) => {
  const monthDays = useMemo(() => { const start = startOfWeek(startOfMonth(date), { locale: ptBR }); const end = endOfWeek(endOfMonth(date), { locale: ptBR }); return eachDayOfInterval({ start, end }); }, [date]);
  const weekHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return (
    <div className="grid grid-cols-7 border-t border-gray-100">
      {weekHeaders.map(day => <div key={day} className="text-center font-medium text-sm text-gray-500 py-3 border-b border-gray-100 bg-gray-50">{day}</div>)}
      {monthDays.map(day => { const dayKey = format(day, 'yyyy-MM-dd'); const dayActivities = activitiesByDay[dayKey] || []; const isToday = isSameDay(day, new Date()); return <DayCell key={dayKey} day={day} dayActivities={dayActivities} date={date} isToday={isToday} disciplinas={disciplinas} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} />; })}
    </div>
  );
};

// --- WeekView ---
const WeekView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder, onToggleModoOrdenacao }) => {
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
              <div ref={provided.innerRef} {...provided.droppableProps} className={`flex flex-col border-r border-gray-100 transition-all duration-300 ease-in-out ${isExpanded ? 'flex-[2] min-w-[350px] bg-white shadow-2xl z-10' : 'flex-1 w-[14.28%] max-w-[200px]'} ${isToday && !isExpanded ? 'bg-blue-50' : ''} ${snapshot.isDraggingOver ? 'bg-purple-100' : 'bg-white'}`}>
                <div className={`flex flex-col p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 sticky top-0 z-10 ${isToday ? 'bg-blue-50' : 'bg-gray-50/50'}`} onClick={() => toggleExpand(dayKey)}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700 capitalize">{format(day, 'EEE, d', { locale: ptBR })}</h3>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onToggleModoOrdenacao && onToggleModoOrdenacao()} className={`p-0.5 rounded transition-colors ${modoOrdenacao ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'}`} title={modoOrdenacao ? "Sair da ordenação" : "Organizar ordem de execução"}><ListOrdered className="w-3.5 h-3.5" /></button>
                      <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  {dayActivities.length > 0 && (
                    <div className="mt-1 text-xs text-gray-600 font-medium">
                      <span className="inline-block px-2 py-0.5 bg-white rounded border border-gray-200">
                        {(() => {
                          let total = 0;
                          dayActivities.forEach(ativ => {
                            const horasAlocadas = Number(ativ.horas_por_dia?.[dayKey]) || 0;
                            const horasExecutadas = Number(ativ.horas_executadas_por_dia?.[dayKey]) || 0;
                            const tempoExecutado = Number(ativ.tempo_executado) || 0;
                            let horasDia = 0;
                            if (ativ.isLegacyExecution) { horasDia = tempoExecutado; }
                            else if (ativ.isQuickActivity || ativ.is_quick_activity) { horasDia = horasExecutadas > 0 ? horasExecutadas : horasAlocadas; }
                            else if (horasExecutadas > 0) { horasDia = horasExecutadas; }
                            else if (ativ.status === 'concluido' && tempoExecutado > 0 && Object.keys(ativ.horas_executadas_por_dia || {}).length === 0) {
                              const dp = Object.keys(ativ.horas_por_dia || {});
                              horasDia = dp.length > 0 && dp.includes(dayKey) ? tempoExecutado / dp.length : 0;
                            } else { horasDia = horasAlocadas; }
                            total += horasDia;
                          });
                          return `${formatHours(total)}h`;
                        })()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-grow overflow-y-auto p-2">
                  <ActivityContainer activities={dayActivities} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={onClearDayOrder} />
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
const DayView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder, onToggleModoOrdenacao }) => {
  const dayKey = format(date, 'yyyy-MM-dd');
  const activities = activitiesByDay[dayKey] || [];
  return (
    <Droppable droppableId={dayKey}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps} className={`border-t border-gray-100 p-6 ${snapshot.isDraggingOver ? 'bg-purple-100' : ''}`}>
          <div className="flex items-center justify-center gap-3 mb-6">
            <h2 className="text-2xl font-bold capitalize">{format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</h2>
            <button onClick={() => onToggleModoOrdenacao && onToggleModoOrdenacao()} className={`p-1 rounded transition-colors ${modoOrdenacao ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'}`} title={modoOrdenacao ? "Sair da ordenação" : "Organizar ordem de execução"}><ListOrdered className="w-5 h-5" /></button>
          </div>
          <div className="max-w-4xl mx-auto">
            {activities.length > 0 ? (
              <ActivityContainer activities={activities} containerClass="space-y-4" disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={onClearDayOrder} />
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
  const { user, userProfile, isColaborador, isGestao, hasPermission, triggerUpdate, perfilAtual, updateKey, completionKey, allUsers } = useContext(ActivityTimerContext);
  const [currentDate, setCurrentDate] = useState(() => startOfWeek(new Date(), { locale: ptBR }));
  const [viewMode, setViewMode] = useState('week');
  const isApoio = perfilAtual === 'apoio';
  const usuariosPermitidos = userProfile?.usuarios_permitidos_visualizar || [];
  const podeVisualizarOutros = Array.isArray(usuariosPermitidos) && usuariosPermitidos.length > 0;
  const [filters, setFilters] = useState({ user: '', discipline: 'all' });
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [enrichedData, setEnrichedData] = useState([]);
  const [showPrevisaoModal, setShowPrevisaoModal] = useState(false);
  const [planejamentosParaPrevisao, setPlanejamentosParaPrevisao] = useState([]);
  const [isReprogramando, setIsReprogramando] = useState(null);
  const [viewType, setViewType] = useState('analitico');
  const hasSelectedUser = !!filters.user;
  const isViewingAllUsers = filters.user === 'all';

  useEffect(() => {
    if (user?.email && !filters.user) setFilters(prev => ({ ...prev, user: user.email }));
  }, [user?.email, filters.user]);

  const effectiveUsuarios = (allUsers && allUsers.length > 0) ? allUsers : (usuarios || []);
  const executorMap = useMemo(() => effectiveUsuarios.reduce((acc, u) => { if (u.email) acc[u.email] = u; return acc; }, {}), [effectiveUsuarios]);

  const [selectedActivities, setSelectedActivities] = useState(new Set());
  const [modoOrdenacao, setModoOrdenacao] = useState(false);
  const [activityOrder, setActivityOrder] = useState(() => { try { return JSON.parse(localStorage.getItem('calendar-activity-order') || '{}'); } catch { return {}; } });

  const clearDayOrder = useCallback((dayKey) => {
    setActivityOrder(prev => { const updated = { ...prev }; delete updated[dayKey]; localStorage.setItem('calendar-activity-order', JSON.stringify(updated)); return updated; });
  }, []);

  const toggleModoOrdenacao = useCallback(() => {
    setModoOrdenacao(prev => { if (!prev && viewType !== 'analitico') setViewType('analitico'); return !prev; });
  }, [viewType]);

  const loadCalendarData = useCallback(async (userFilter) => {
    if (!userFilter) { setEnrichedData([]); return; }
    setIsCalendarLoading(true);
    try {
      const execFilter = userFilter !== 'all' ? { usuario: userFilter } : {};
      const [planosAtividade, planosDocumento, execs] = await Promise.all([
        userFilter !== 'all' ? retryWithBackoff(() => PlanejamentoAtividade.filter({ executor_principal: userFilter }), 3, 1500, 'calendar.loadPlansAtividade.principal') : retryWithBackoff(() => PlanejamentoAtividade.list(), 3, 1500, 'calendar.loadPlansAtividade'),
        userFilter !== 'all' ? retryWithBackoff(() => PlanejamentoDocumento.filter({ executor_principal: userFilter }), 3, 1500, 'calendar.loadPlansDocumento.principal') : retryWithBackoff(() => PlanejamentoDocumento.list(), 3, 1500, 'calendar.loadPlansDocumento'),
        retryWithBackoff(() => Execucao.filter(execFilter), 3, 1500, 'calendar.loadExecs'),
      ]);
      const planosAtividadeComTipo = (planosAtividade || []).map(p => ({ ...p, tipo_planejamento: 'atividade' }));
      const planosDocumentoComTipo = (planosDocumento || []).map(p => ({ ...p, tipo_planejamento: 'documento' }));
      const todosPlanejamentos = [...planosAtividadeComTipo, ...planosDocumentoComTipo];
      const empreendimentoIds = [...new Set(todosPlanejamentos.map(p => p.empreendimento_id).filter(Boolean))];
      const atividadeIds = [...new Set(todosPlanejamentos.map(p => p.atividade_id).filter(Boolean))];
      const documentoIdsArray = [...new Set(todosPlanejamentos.map(p => p.documento_id).filter(Boolean).map(String))];
      const [empreendimentosData, atividadesData, documentosData] = await Promise.all([
        empreendimentoIds.length > 0 ? retryWithBackoff(() => Empreendimento.filter({ id: { $in: empreendimentoIds } }), 3, 1000, 'enrich.empreendimentos') : Promise.resolve([]),
        atividadeIds.length > 0 ? retryWithBackoff(() => Atividade.filter({ id: { $in: atividadeIds } }), 3, 1000, 'enrich.atividades') : Promise.resolve([]),
        documentoIdsArray.length > 0 ? Promise.all(documentoIdsArray.map(docId => retryWithBackoff(() => Documento.get(docId), 3, 1000, `enrich.documento.${docId}`).catch(() => null))).then(results => results.filter(Boolean)) : Promise.resolve([]),
      ]);
      const empreendimentosMap = new Map((empreendimentosData || []).map(item => [String(item.id), item]));
      const atividadesMap = new Map((atividadesData || []).map(item => [String(item.id), item]));
      const documentosMap = new Map((documentosData || []).map(item => [String(item.id), item]));
      const horasExecutadasPorPlanejamento = {};
      (execs || []).forEach(exec => {
        if (!exec.planejamento_id || !exec.inicio) return;
        const diaExec = format(parseLocalDate(exec.inicio), 'yyyy-MM-dd');
        const tempoExec = Number(exec.tempo_total) || 0;
        if (!horasExecutadasPorPlanejamento[exec.planejamento_id]) horasExecutadasPorPlanejamento[exec.planejamento_id] = {};
        horasExecutadasPorPlanejamento[exec.planejamento_id][diaExec] = (horasExecutadasPorPlanejamento[exec.planejamento_id][diaExec] || 0) + tempoExec;
      });
      const execucoesSemPlanejamento = (execs || []).filter(exec => !exec.planejamento_id);
      const atividadesVirtuais = execucoesSemPlanejamento.map(exec => {
        const diaExec = exec.inicio ? format(parseLocalDate(exec.inicio), 'yyyy-MM-dd') : null;
        return { id: `exec-${exec.id}`, isLegacyExecution: true, isQuickActivity: true, tipo_planejamento: 'atividade', descritivo: exec.descritivo || 'Execução Rápida', tempo_executado: Number(exec.tempo_total) || 0, executor_principal: exec.usuario, status: 'concluido', horas_executadas_por_dia: diaExec ? { [diaExec]: Number(exec.tempo_total) || 0 } : {}, empreendimento: null, atividade: null, documento: null, os: exec.os || null, observacao: exec.observacao || null };
      });
      const finalData = [
        ...todosPlanejamentos.map(plano => {
          const horasExec = horasExecutadasPorPlanejamento[plano.id] || {};
          const doc = documentosMap.get(String(plano.documento_id)) || null;
          let documentoEnriquecido = null;
          if (doc) {
            documentoEnriquecido = { ...doc };
            const numero = String(doc.numero || '').trim();
            const arquivo = String(doc.arquivo || doc.titulo || '').trim();
            const parts = [];
            if (numero) parts.push(numero);
            if (arquivo) parts.push(arquivo);
            documentoEnriquecido.numero_completo = parts.length ? parts.join(' - ') : (doc.titulo || doc.arquivo || null);
          }
          const storedHoras = (typeof plano.horas_executadas_por_dia === 'object' && plano.horas_executadas_por_dia) ? plano.horas_executadas_por_dia : {};
          const mergedHorasExec = Object.assign({}, storedHoras, horasExec);
          return { ...plano, empreendimento: empreendimentosMap.get(String(plano.empreendimento_id)) || null, atividade: atividadesMap.get(String(plano.atividade_id)) || null, documento: documentoEnriquecido, horas_executadas_por_dia: mergedHorasExec };
        }),
        ...atividadesVirtuais
      ];
      setEnrichedData(finalData);
    } catch (error) {
      setEnrichedData([]);
      alert("Erro ao carregar as atividades do calendário. Tente atualizar a página.");
    } finally {
      setIsCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filters.user) loadCalendarData(filters.user);
    else { setEnrichedData([]); setIsCalendarLoading(false); }
  }, [filters.user]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevUpdateKeyRef = useRef(updateKey);
  useEffect(() => {
    if (updateKey === prevUpdateKeyRef.current) return;
    prevUpdateKeyRef.current = updateKey;
    if (!filters.user) return;
    const timer = setTimeout(() => loadCalendarData(filters.user), 3000);
    return () => clearTimeout(timer);
  }, [updateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevCompletionKeyRef = useRef(completionKey);
  useEffect(() => {
    if (completionKey === prevCompletionKeyRef.current) return;
    prevCompletionKeyRef.current = completionKey;
    if (!filters.user) return;
    loadCalendarData(filters.user);
  }, [completionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivityDelete = useCallback((update = null) => {
    if (update?.id) setEnrichedData(prev => prev.map(item => item.id === update.id ? { ...item, ...update } : item));
    if (hasSelectedUser) loadCalendarData(filters.user);
  }, [hasSelectedUser, filters.user, loadCalendarData]);

  const toggleActivitySelection = useCallback((activityId) => {
    const normalizedActivityId = normalizeActivityId(activityId);
    setSelectedActivities(prev => { const newSet = new Set(prev); if (newSet.has(normalizedActivityId)) newSet.delete(normalizedActivityId); else newSet.add(normalizedActivityId); return newSet; });
  }, []);

  const clearSelection = useCallback(() => setSelectedActivities(new Set()), []);

  // Reprogramar: usa campos ajustados e arrasta a última atividade por prioridade
  const handleReprogramarAtividade = useCallback(async (atividadeId, novaDataInicio, executorEmail) => {
    const normalizedActivityId = normalizeActivityId(atividadeId);
    setIsReprogramando(normalizedActivityId);
    try {
      const atividadeParaMover = (enrichedData || []).find(p => normalizeActivityId(p.id) === normalizedActivityId);
      if (!atividadeParaMover) throw new Error("Atividade não encontrada para reprogramar.");
      if (atividadeParaMover.isLegacyExecution) throw new Error("Atividades rápidas antigas não podem ser reprogramadas via arrastar e soltar.");
      if (atividadeParaMover.status === 'concluido' || atividadeParaMover.status === 'concluido_com_atraso') throw new Error("Atividades concluídas não podem ser reprogramadas.");

      const entidadePlanejamento = atividadeParaMover.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;

      const planejamentosDoExecutor = (await retryWithBackoff(() => entidadePlanejamento.filter({ executor_principal: executorEmail }), 3, 1000, 'fetchPlansForReprogram'))
        .filter(p => p.status !== 'concluido' && !p.isLegacyExecution);

      const cargaDiariaExistente = {};
      planejamentosDoExecutor.forEach(p => {
        if (normalizeActivityId(p.id) !== normalizedActivityId && p.horas_por_dia) {
          Object.entries(p.horas_por_dia).forEach(([data, horas]) => { cargaDiariaExistente[data] = (cargaDiariaExistente[data] || 0) + Number(horas || 0); });
        }
      });

      const { distribuicao, dataTermino } = distribuirHorasPorDias(parseLocalDate(novaDataInicio), atividadeParaMover.tempo_planejado, 8, cargaDiariaExistente);
      if (Object.keys(distribuicao).length === 0) throw new Error("Não foi possível alocar horas para a nova data.");

      // Usar campos AJUSTADOS (preserva os planejados originais)
      const novoInicio = Object.keys(distribuicao).sort()[0];
      const novoTermino = dataTermino ? format(dataTermino, 'yyyy-MM-dd') : novoInicio;

      await retryWithBackoff(() => entidadePlanejamento.update(atividadeParaMover.id, {
        inicio_ajustado: novoInicio,
        termino_ajustado: novoTermino,
        horas_por_dia: distribuicao,
      }), 3, 1500, 'updateReprogrammedPlan');

      // Arrastar a atividade de MAIOR ORDEM (última na fila) para o dia após o novo término
      const diaAposTermino = format(addDays(parseLocalDate(novoTermino), 1), 'yyyy-MM-dd');
      const candidatos = planejamentosDoExecutor.filter(p =>
        normalizeActivityId(p.id) !== normalizedActivityId &&
        p.status !== 'concluido' && p.status !== 'concluido_com_atraso' && !p.isLegacyExecution
      );

      if (candidatos.length > 0) {
        const comOrdem = candidatos.filter(p => p.ordem != null && p.ordem !== undefined);
        let ultimaAtividade = null;
        if (comOrdem.length > 0) {
          ultimaAtividade = comOrdem.reduce((prev, curr) => Number(curr.ordem) > Number(prev.ordem) ? curr : prev);
        } else {
          ultimaAtividade = candidatos.reduce((prev, curr) => {
            const dataP = prev.termino_ajustado || prev.termino_planejado || '';
            const dataC = curr.termino_ajustado || curr.termino_planejado || '';
            return dataC > dataP ? curr : prev;
          });
        }

        if (ultimaAtividade) {
          const entidadeUltima = ultimaAtividade.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
          const cargaSemAmbas = {};
          planejamentosDoExecutor.forEach(p => {
            if (normalizeActivityId(p.id) === normalizedActivityId || normalizeActivityId(p.id) === normalizeActivityId(ultimaAtividade.id)) return;
            if (p.horas_por_dia) Object.entries(p.horas_por_dia).forEach(([data, horas]) => { cargaSemAmbas[data] = (cargaSemAmbas[data] || 0) + Number(horas || 0); });
          });
          const { distribuicao: distUltima, dataTermino: terminoUltima } = distribuirHorasPorDias(parseLocalDate(diaAposTermino), ultimaAtividade.tempo_planejado, 8, cargaSemAmbas);
          if (Object.keys(distUltima).length > 0) {
            const novoInicioUltima = Object.keys(distUltima).sort()[0];
            const novoTerminoUltima = terminoUltima ? format(terminoUltima, 'yyyy-MM-dd') : novoInicioUltima;
            await retryWithBackoff(() => entidadeUltima.update(ultimaAtividade.id, {
              inicio_ajustado: novoInicioUltima,
              termino_ajustado: novoTerminoUltima,
              horas_por_dia: distUltima,
            }), 3, 1500, 'pushLastActivity');
          }
        }
      }

      if (hasSelectedUser) loadCalendarData(filters.user);
      if (triggerUpdate) triggerUpdate();
    } catch (error) {
      alert(`Erro ao reprogramar atividade: ${error.message}`);
      throw error;
    } finally {
      setIsReprogramando(null);
    }
  }, [enrichedData, triggerUpdate, hasSelectedUser, filters.user, loadCalendarData]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) {
      if (!modoOrdenacao) return;
      const dayKey = source.droppableId;
      const dayActivities = [...(activitiesByDay[dayKey] || [])];
      const [moved] = dayActivities.splice(source.index, 1);
      dayActivities.splice(destination.index, 0, moved);
      const newOrder = dayActivities.map(a => String(a.id));
      setActivityOrder(prev => { const updated = { ...prev, [dayKey]: newOrder }; localStorage.setItem('calendar-activity-order', JSON.stringify(updated)); return updated; });
      return;
    }
    if (modoOrdenacao) return;
    if (!hasPermission('admin')) { alert("Você não tem permissão para replanejar atividades."); return; }

    const isDayDrag = draggableId.startsWith('day-');
    if (isDayDrag) {
      const sourceDayKey = draggableId.replace('day-', '');
      const dayActivities = activitiesByDay[sourceDayKey] || [];
      const movableActivities = dayActivities.filter(a => !a.isLegacyExecution && a.status !== 'concluido' && a.status !== 'concluido_com_atraso');
      if (movableActivities.length === 0) { alert("Nenhuma atividade deste dia pode ser movida."); return; }
      if (!window.confirm(`Deseja mover todas as ${movableActivities.length} atividade(s) de ${format(parseISO(sourceDayKey), 'd MMM', { locale: ptBR })} para ${format(parseISO(destination.droppableId), 'd MMM', { locale: ptBR })}?`)) return;
      (async () => {
        let successCount = 0, errorCount = 0;
        for (let i = 0; i < movableActivities.length; i++) {
          try { await handleReprogramarAtividade(movableActivities[i].id, destination.droppableId, movableActivities[i].executor_principal); successCount++; if (i < movableActivities.length - 1) await new Promise(r => setTimeout(r, 500)); } catch { errorCount++; }
        }
        if (successCount > 0) { alert(`✅ ${successCount} atividade(s) reprogramadas!${errorCount > 0 ? `\n⚠️ ${errorCount} falharam` : ''}`); clearSelection(); }
        else alert('❌ Nenhuma atividade pôde ser movida.');
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
      if (groupKey.startsWith('virtual-')) { const eMail = groupKey.replace('virtual-', ''); groupActivities = allActivitiesInSourceDay.filter(a => a.isLegacyExecution && a.executor_principal === eMail); }
      else if (groupKey.startsWith('geral-')) { const eMail = groupKey.replace('geral-', ''); groupActivities = allActivitiesInSourceDay.filter(a => !a.empreendimento_id && a.executor_principal === eMail && !a.isLegacyExecution); }
      else { const [empId, eMail] = groupKey.split('|'); groupActivities = allActivitiesInSourceDay.filter(a => a.empreendimento_id === empId && a.executor_principal === eMail && !a.isLegacyExecution); }
      if (groupActivities.some(a => a.isLegacyExecution || a.status === 'concluido' || a.status === 'concluido_com_atraso')) { alert("Algumas atividades do grupo não podem ser reprogramadas."); return; }
      (async () => {
        let successCount = 0, errorCount = 0;
        for (const atividade of groupActivities) {
          try { await handleReprogramarAtividade(atividade.id, destination.droppableId, atividade.executor_principal); successCount++; await new Promise(r => setTimeout(r, 500)); } catch { errorCount++; }
        }
        if (successCount > 0) { alert(`✅ ${successCount} atividade(s) do grupo reprogramadas!${errorCount > 0 ? `\n⚠️ ${errorCount} falharam` : ''}`); clearSelection(); }
        else alert('❌ Erro ao mover atividades do grupo.');
      })();
      return;
    }

    const activitiesToMove = selectedActivities.has(draggableId) && selectedActivities.size > 1 ? Array.from(selectedActivities) : [draggableId];
    if (activitiesToMove.some(id => { const a = (enrichedData || []).find(p => normalizeActivityId(p.id) === normalizeActivityId(id)); return !a || a.isLegacyExecution || a.status === 'concluido' || a.status === 'concluido_com_atraso'; })) { alert("Algumas atividades não podem ser reprogramadas."); return; }
    (async () => {
      let successCount = 0, errorCount = 0;
      for (const activityId of activitiesToMove) {
        const atividadeMovida = (enrichedData || []).find(p => normalizeActivityId(p.id) === normalizeActivityId(activityId));
        if (!atividadeMovida) continue;
        try { await handleReprogramarAtividade(activityId, destination.droppableId, atividadeMovida.executor_principal); successCount++; await new Promise(r => setTimeout(r, 500)); } catch { errorCount++; }
      }
      if (successCount > 0) { alert(`✅ ${successCount} atividade(s) reprogramadas!${errorCount > 0 ? `\n⚠️ ${errorCount} falharam` : ''}`); clearSelection(); }
      else alert('❌ Erro ao mover atividades.');
    })();
  };

  const filteredPlanejamentos = useMemo(() => {
    if (!hasSelectedUser) return [];
    let basePlanejamentos = enrichedData || [];
    if (filters.discipline !== 'all') {
      return basePlanejamentos.filter(item => {
        if (item.tipo_planejamento === 'documento' && item.atividade_id === null) return item.documento?.subdisciplinas && item.documento.subdisciplinas.includes(filters.discipline);
        return item.atividade?.disciplina === filters.discipline;
      });
    }
    return basePlanejamentos;
  }, [enrichedData, filters.discipline, hasSelectedUser]);

  const activityStatusMap = useMemo(() => {
    const statusMap = new Map();
    const planMap = new Map(filteredPlanejamentos.map(p => [normalizeActivityId(p.id), p]));
    filteredPlanejamentos.forEach(plano => {
      if (plano.isLegacyExecution) { statusMap.set(normalizeActivityId(plano.id), plano.status); return; }
      if (plano.status === 'concluido_com_atraso') { statusMap.set(normalizeActivityId(plano.id), 'concluido_com_atraso'); return; }
      if (plano.status === 'concluido') { statusMap.set(normalizeActivityId(plano.id), 'concluido'); return; }
      const overdue = isActivityOverdue(plano);
      const dRef = plano.termino_ajustado || plano.termino_planejado;
      const hj = format(new Date(), 'yyyy-MM-dd');
      const atrasada = dRef && hj > dRef;
      if (atrasada && (plano.status === 'em_andamento' || plano.status === 'pausado')) { statusMap.set(normalizeActivityId(plano.id), 'em_andamento_atrasado'); return; }
      if (atrasada || plano.status === 'atrasado' || overdue) { statusMap.set(normalizeActivityId(plano.id), 'nao_iniciado_atrasado'); return; }
      let impactado = false;
      if (plano.inicio_ajustado && plano.inicio_planejado) { try { const aj=startOfDay(parseISO(plano.inicio_ajustado)),pl=startOfDay(parseISO(plano.inicio_planejado)); if(isValid(aj)&&isValid(pl)&&isAfter(aj,pl)) impactado=true; } catch(_){} }
      if (!impactado && plano.predecessora_id) { const pred=planMap.get(normalizeActivityId(plano.predecessora_id)); if(pred&&isActivityOverdue(pred)) impactado=true; }
      if (impactado) { statusMap.set(normalizeActivityId(plano.id), 'impactado_por_atraso'); return; }
      if (plano.termino_ajustado && plano.termino_planejado) { try { const aj=startOfDay(parseISO(plano.termino_ajustado)),pl=startOfDay(parseISO(plano.termino_planejado)); if(isValid(aj)&&isValid(pl)&&isAfter(aj,pl)){ statusMap.set(normalizeActivityId(plano.id),'replanejado_atrasado'); return; } } catch(_){} }
      statusMap.set(normalizeActivityId(plano.id), plano.status || 'nao_iniciado');
    });
    return statusMap;
  }, [filteredPlanejamentos]);

  const activitiesByDay = useMemo(() => {
    if (!hasSelectedUser) return {};
    const grouped = {};
    filteredPlanejamentos.forEach(plano => {
      const diasParaExibir = new Set();
      const isQuickActivity = plano.is_quick_activity || plano.isQuickActivity;
      if (isQuickActivity) {
        let hasSignificantExecutionHours = false;
        if (plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object') {
          Object.keys(plano.horas_executadas_por_dia).forEach(dayKey => {
            const horasExec = Number(plano.horas_executadas_por_dia[dayKey]) || 0;
            if (horasExec > 0.01) { diasParaExibir.add(dayKey); hasSignificantExecutionHours = true; }
          });
          if (!hasSignificantExecutionHours && (plano.status === 'concluido' || plano.status === 'concluido_com_atraso' || plano.status === 'em_andamento')) {
            const dias = Object.keys(plano.horas_executadas_por_dia);
            if (dias.length > 0) { const ultimoDia = dias.sort().pop(); const parsedUltimo = parseLocalDate(ultimoDia); diasParaExibir.add((parsedUltimo && isValid(parsedUltimo)) ? format(parsedUltimo, 'yyyy-MM-dd') : ultimoDia); hasSignificantExecutionHours = true; }
          }
        }
        if (!hasSignificantExecutionHours && plano.inicio_planejado) { const parsedInicio = parseLocalDate(plano.inicio_planejado); diasParaExibir.add((parsedInicio && isValid(parsedInicio)) ? format(parsedInicio, 'yyyy-MM-dd') : plano.inicio_planejado); }
      } else {
        const realStatus = activityStatusMap.get(normalizeActivityId(plano.id)) || plano.status || 'nao_iniciado';
        const foiExecutada = plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object' && Object.keys(plano.horas_executadas_por_dia).length > 0;
        if (realStatus === 'concluido') {
          if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') Object.keys(plano.horas_por_dia).forEach(dayKey => { if (Number(plano.horas_por_dia[dayKey]) >= 0.05) diasParaExibir.add(dayKey); });
          if (foiExecutada) Object.keys(plano.horas_executadas_por_dia).forEach(dayKey => { if (Number(plano.horas_executadas_por_dia[dayKey]) >= 0.05) diasParaExibir.add(dayKey); });
          if (diasParaExibir.size === 0) { const dataRef = plano.termino_real || plano.inicio_planejado; if (dataRef) { const parsed = parseLocalDate(dataRef); if (parsed && isValid(parsed)) diasParaExibir.add(format(parsed, 'yyyy-MM-dd')); } }
        } else {
          if (foiExecutada) Object.keys(plano.horas_executadas_por_dia).forEach(dayKey => { if (Number(plano.horas_executadas_por_dia[dayKey]) >= 0.05) diasParaExibir.add(dayKey); });
          if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') Object.keys(plano.horas_por_dia).forEach(dayKey => { if (Number(plano.horas_por_dia[dayKey]) >= 0.05) diasParaExibir.add(dayKey); });
        }
      }
      diasParaExibir.forEach(dayKey => {
        if (!grouped[dayKey]) grouped[dayKey] = [];
        if (!grouped[dayKey].some(item => item.id === plano.id)) grouped[dayKey].push({ ...plano, isQuickActivity: !!plano.is_quick_activity, isLegacyExecution: false });
      });
    });

    for (const dayKey in grouped) {
      grouped[dayKey].sort((a, b) => {
        if (a.isLegacyExecution && !b.isLegacyExecution) return 1;
        if (!a.isLegacyExecution && b.isLegacyExecution) return -1;
        const statusA = activityStatusMap.get(normalizeActivityId(a.id)) || a.status || 'nao_iniciado';
        const statusB = activityStatusMap.get(normalizeActivityId(b.id)) || b.status || 'nao_iniciado';
        const isConcludedA = statusA === 'concluido' || statusA === 'concluido_com_atraso';
        const isConcludedB = statusB === 'concluido' || statusB === 'concluido_com_atraso';
        if (isConcludedA && !isConcludedB) return 1;
        if (!isConcludedA && isConcludedB) return -1;
        if (statusA === 'pausado' && statusB === 'em_andamento') return 1;
        if (statusA !== 'pausado' && statusB === 'em_andamento') return -1;
        const inicioA = a.inicio_planejado ? parseISO(a.inicio_planejado) : null;
        const inicioB = b.inicio_planejado ? parseISO(b.inicio_planejado) : null;
        if (inicioA && inicioB) { if (inicioA.getTime() < inicioB.getTime()) return -1; if (inicioA.getTime() > inicioB.getTime()) return 1; } else if (inicioA) return -1; else if (inicioB) return 1;
        const nameA = a.atividade?.atividade || a.documento?.numero_completo || a.descritivo || '';
        const nameB = b.atividade?.atividade || b.documento?.numero_completo || b.descritivo || '';
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });
    }

    for (const dayKey in grouped) {
      const activities = grouped[dayKey];
      const docIndices = [], docs = [];
      activities.forEach((a, i) => { if (a.tipo_planejamento === 'documento') { docIndices.push(i); docs.push(a); } });
      if (docs.length < 2) continue;
      const docIdMap = new Map(docs.map(d => [normalizeActivityId(d.id), d]));
      const depths = new Map();
      const getDepth = (doc, seen = new Set()) => {
        const id = normalizeActivityId(doc.id);
        if (depths.has(id)) return depths.get(id);
        if (seen.has(id)) { depths.set(id, 0); return 0; }
        seen.add(id);
        if (!doc.predecessora_id) { depths.set(id, 0); return 0; }
        const pred = docIdMap.get(normalizeActivityId(doc.predecessora_id));
        if (!pred) { depths.set(id, 0); return 0; }
        const d = 1 + getDepth(pred, seen);
        depths.set(id, d);
        return d;
      };
      docs.forEach(d => getDepth(d));
      const sorted = [...docs].sort((a, b) => (depths.get(normalizeActivityId(a.id)) || 0) - (depths.get(normalizeActivityId(b.id)) || 0));
      docIndices.forEach((pos, i) => { activities[pos] = sorted[i]; });
    }

    for (const dayKey in grouped) {
      const customOrder = activityOrder[dayKey];
      if (customOrder && customOrder.length > 0) {
        const orderMap = new Map(customOrder.map((id, i) => [String(id), i]));
        grouped[dayKey].sort((a, b) => { const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : 9999; const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : 9999; return idxA - idxB; });
      }
    }
    return grouped;
  }, [filteredPlanejamentos, hasSelectedUser, activityOrder]);

  const cargaDiariaPorUsuario = useMemo(() => {
    if (!hasSelectedUser) return {};
    const carga = {};
    filteredPlanejamentos.forEach(plano => {
      const userEmail = plano.executor_principal;
      if (!userEmail) return;
      if (!carga[userEmail]) carga[userEmail] = {};
      if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') Object.entries(plano.horas_por_dia).forEach(([data, horas]) => { carga[userEmail][data] = (carga[userEmail][data] || 0) + Number(horas); });
    });
    return carga;
  }, [filteredPlanejamentos, hasSelectedUser]);

  const handleDateChange = (direction) => {
    const changeFn = direction === 'next' ? { month: addMonths, week: addWeeks, day: addDays } : { month: subMonths, week: subWeeks, day: subDays };
    setCurrentDate(current => changeFn[viewMode](current, 1));
  };

  const horasDoDia = useMemo(() => {
    const dayKey = format(currentDate, 'yyyy-MM-dd');
    const dayActivities = activitiesByDay[dayKey] || [];
    let soma = 0;
    dayActivities.forEach((atividade) => {
      const horasAlocadasDia = Number(atividade.horas_por_dia?.[dayKey]) || 0;
      const horasExecutadasNoDia = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
      const tempoExecutado = Number(atividade.tempo_executado) || 0;
      let horasDia = 0;
      if (atividade.isLegacyExecution) { horasDia = tempoExecutado; }
      else if (atividade.isQuickActivity || atividade.is_quick_activity) { horasDia = horasExecutadasNoDia > 0 ? horasExecutadasNoDia : horasAlocadasDia; }
      else if (horasExecutadasNoDia > 0) { horasDia = horasExecutadasNoDia; }
      else if ((atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso') && tempoExecutado > 0 && Object.keys(atividade.horas_executadas_por_dia || {}).length === 0) {
        const diasPlanejados = Object.keys(atividade.horas_por_dia || {});
        horasDia = diasPlanejados.length > 0 && diasPlanejados.includes(dayKey) ? tempoExecutado / diasPlanejados.length : 0;
      } else { horasDia = horasAlocadasDia; }
      soma += horasDia;
    });
    return soma;
  }, [currentDate, activitiesByDay, viewMode]);

  const headerTitle = useMemo(() => {
    switch (viewMode) {
      case 'month': return format(currentDate, 'MMMM yyyy', { locale: ptBR });
      case 'week': { const start = startOfWeek(currentDate, { locale: ptBR }); const end = endOfWeek(currentDate, { locale: ptBR }); return `${format(start, 'd MMM')} - ${format(end, 'd MMM, yyyy', { locale: ptBR })}`; }
      case 'day': return format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR });
      default: return '';
    }
  }, [currentDate, viewMode]);

  const handleClearFilters = () => {
    const usuariosPermitidosLocal = userProfile?.usuarios_permitidos_visualizar || [];
    const temPermissao = Array.isArray(usuariosPermitidosLocal) && usuariosPermitidosLocal.length > 0;
    if ((isGestao || isColaborador || isApoio) && !temPermissao) { setFilters(prev => ({ ...prev, discipline: 'all' })); clearSelection(); return; }
    setFilters({ user: '', discipline: 'all' });
    clearSelection();
  };

  const handleShowPrevisao = (planos) => { setPlanejamentosParaPrevisao(planos); setShowPrevisaoModal(true); };

  const selectedUserName = isViewingAllUsers ? 'Todos os Usuários' : executorMap[filters.user]?.nome || filters.user;
  const totalLoading = isDashboardRefreshing || isCalendarLoading;
  const canReprogram = hasPermission('admin');

  const renderContent = () => {
    if (!hasSelectedUser) {
      return (
        <div className="p-12 text-center min-h-[400px] flex flex-col justify-center items-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Selecione um Usuário</h3>
          <p className="text-gray-500 mb-6">Para começar, selecione um usuário no filtro acima para carregar o calendário.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto"><p className="text-blue-700 text-sm">💡 <strong>Dica:</strong> Para ver as atividades de todos, selecione "Todos os Usuários".</p></div>
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
    if (viewMode === 'month') return <MonthView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} />;
    if (viewMode === 'week') return <WeekView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={clearDayOrder} onToggleModoOrdenacao={toggleModoOrdenacao} />;
    if (viewMode === 'day') return <DayView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={clearDayOrder} onToggleModoOrdenacao={toggleModoOrdenacao} />;
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
                  {viewMode === 'day' && <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{formatHours(horasDoDia)}h planejadas</span>}
                </div>
              ) : 'Calendário de Planejamento'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedActivities.size > 0 ? (
                <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-sm font-medium text-indigo-700">✅ {selectedActivities.size} selecionada{selectedActivities.size > 1 ? 's' : ''} — arraste para replanejar</span>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100">Limpar</Button>
                </div>
              ) : null}
              {hasSelectedUser && (
                <>
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
        <CalendarFilters users={effectiveUsuarios} disciplines={disciplinas} viewMode={viewMode} onViewModeChange={setViewMode} filters={filters} podeVerOutros={podeVisualizarOutros} currentUserEmail={user?.email} usuariosPermitidos={usuariosPermitidos} viewType={viewType}
          onFilterChange={(key, value) => {
            if (key === 'viewType') { setViewType(value); return; }
            const usuariosPermitidosLocal = userProfile?.usuarios_permitidos_visualizar || [];
            const temPermissao = Array.isArray(usuariosPermitidosLocal) && usuariosPermitidosLocal.length > 0;
            if ((isGestao || isColaborador || isApoio) && !temPermissao && key === 'user') return;
            setFilters(prev => ({ ...prev, [key]: value }));
          }}
          onClearFilters={handleClearFilters} hasSelectedUser={hasSelectedUser} isColaborador={isColaborador} isViewingAllUsers={isViewingAllUsers} isGestao={isGestao} isApoio={isApoio}
        />
        <DragDropContext onDragEnd={onDragEnd}>
          <CardContent className="p-0 flex-1">{renderContent()}</CardContent>
        </DragDropContext>
      </Card>
      {hasSelectedUser && (
        <PrevisaoEntregaModal isOpen={showPrevisaoModal} onClose={() => setShowPrevisaoModal(false)} planejamentos={planejamentosParaPrevisao.length > 0 ? planejamentosParaPrevisao : filteredPlanejamentos} execucoes={[]} cargaDiaria={planejamentosParaPrevisao.length > 0 && planejamentosParaPrevisao[0].executor_principal ? cargaDiariaPorUsuario[planejamentosParaPrevisao[0].executor_principal] || {} : {}} />
      )}
    </>
  );
}