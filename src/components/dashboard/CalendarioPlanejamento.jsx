// @ts-nocheck
// This file re-exports the split version. All logic was extracted to sub-files.
// Main calendar component after refactoring.
import React, { useState, useMemo, useEffect, useContext, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Filter, Trash2, CalendarDays, Play, RefreshCw, LineChart, Users, Loader2, Edit2, ListOrdered, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, parseISO, addWeeks, subWeeks, addDays, subDays, startOfDay, endOfDay,
  isValid, isAfter, differenceInDays
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
import { isActivityOverdue as isOverdueShared, distribuirHorasPorDias, getNextWorkingDay } from '../utils/DateCalculator';
import { retryWithBackoff } from '../utils/apiUtils';

// ActivityItem is now in its own file with history support
import ActivityItem from './CalendarioActivityItem2.jsx';

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

const calculateActivityStatus = (plano, allPlanejamentos = []) => {
  if (plano.isLegacyExecution) return plano.status;
  if (plano.status === 'concluido_com_atraso') return 'concluido_com_atraso';
  if (plano.status === 'concluido') return 'concluido';
  if (plano.status === 'atrasado' || isActivityOverdue(plano)) return 'atrasado';
  let foiReplanejada = false;
  if (plano.inicio_ajustado && plano.inicio_planejado) {
    try { const aj=startOfDay(parseISO(plano.inicio_ajustado)),pl=startOfDay(parseISO(plano.inicio_planejado)); if(isValid(aj)&&isValid(pl)&&isAfter(aj,pl)) foiReplanejada=true; } catch(e){}
  }
  let predecessoraAtrasada = false;
  if (plano.predecessora_id) {
    const predecessora = allPlanejamentos.find(p => normalizeActivityId(p.id) === normalizeActivityId(plano.predecessora_id));
    if (predecessora && isActivityOverdue(predecessora)) predecessoraAtrasada = true;
  }
  if (foiReplanejada || predecessoraAtrasada) return 'impactado_por_atraso';
  if (plano.termino_ajustado && plano.termino_planejado) {
    try { const aj=startOfDay(parseISO(plano.termino_ajustado)),pl=startOfDay(parseISO(plano.termino_planejado)); if(isValid(aj)&&isValid(pl)&&isAfter(aj,pl)) return 'replanejado_atrasado'; } catch(e){}
  }
  return plano.status || 'nao_iniciado';
};

// --- Filtros ---
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
            }).map(userItem => <SelectItem key={userItem.id} value={userItem.email}>{userItem.nome || userItem.full_name}</SelectItem>)}
            {(!isColaborador && !isGestao && !isApoio) && usersOrdenados.length > 0 && <SelectItem value="all">⚠️ Todos os Usuários (pode ser lento)</SelectItem>}
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

// --- Grupo de Atividades ---
const DailyActivityGroup = ({ empreendimento, executor, atividades, isExpanded, onToggle, disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, groupKey, provided, isDragging }) => {
  const totalHoras = useMemo(() => {
    if (!dayKey) return 0;
    let soma = 0;
    atividades.forEach((a) => {
      const hA = Number(a.horas_por_dia?.[dayKey]) || 0;
      const hE = Number(a.horas_executadas_por_dia?.[dayKey]) || 0;
      const tE = Number(a.tempo_executado) || 0;
      let h = 0;
      if (a.isLegacyExecution) h = tE;
      else if (a.isQuickActivity || a.is_quick_activity) h = hE > 0 ? hE : hA;
      else if (hE > 0) h = hE;
      else if ((a.status === 'concluido' || a.status === 'concluido_com_atraso') && tE > 0 && Object.keys(a.horas_executadas_por_dia || {}).length === 0) {
        const dp = Object.keys(a.horas_por_dia || {});
        h = dp.length > 0 && dp.includes(dayKey) ? tE / dp.length : tE;
      } else h = hA;
      soma += h;
    });
    return soma;
  }, [atividades, dayKey]);

  const statusCounts = atividades.reduce((acc, a) => { const s = calculateActivityStatus(a, allPlanejamentos); acc[s] = (acc[s] || 0) + 1; return acc; }, {});
  const disciplineColors = useMemo(() => {
    const dm = (disciplinas || []).reduce((acc, d) => { acc[d.nome] = d.cor; return acc; }, {});
    return [...new Set(atividades.map(a => a.atividade?.disciplina).filter(Boolean))].map(n => ({ name: n, color: dm[n] || '#A1A1AA' }));
  }, [atividades, disciplinas]);

  const getGroupStatus = () => {
    if (statusCounts['atrasado'] > 0 || statusCounts['replanejado_atrasado'] > 0) return 'atrasado';
    if (statusCounts['impactado_por_atraso'] > 0) return 'impactado_por_atraso';
    if (statusCounts['em_andamento'] > 0) return 'em_andamento';
    const tc = (statusCounts['concluido'] || 0) + (statusCounts['concluido_com_atraso'] || 0);
    if (atividades.length > 0 && tc === atividades.length) return statusCounts['concluido_com_atraso'] > 0 ? 'concluido_com_atraso' : 'concluido';
    if (statusCounts['pausado'] > 0) return 'pausado';
    return 'nao_iniciado';
  };
  const getStatusColor = (s) => ({ em_andamento:'#3b82f6', pausado:'#f59e0b', concluido:'#10b981', concluido_com_atraso:'#ef4444', atrasado:'#ef4444', impactado_por_atraso:'#8b5cf6' }[s] || '#6b7280');
  const groupStatus = getGroupStatus();
  const statusColor = getStatusColor(groupStatus);
  const emNome = empreendimento?.nome || 'Sem Empreendimento';
  const executorNome = executor?.email ? (executorMap[executor.email]?.nome || executor.email) : 'Sem Executor';
  const canDragGroup = canReprogram && emNome !== 'Atividades Rápidas' && !atividades.some(a => a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.isLegacyExecution);
  const selectableIds = atividades.filter(a => a.status !== 'concluido' && a.status !== 'concluido_com_atraso' && !a.isLegacyExecution).map(a => normalizeActivityId(a.id));
  const isGroupSelected = selectableIds.length > 0 && selectableIds.every(id => selectedActivities.has(id));
  const isGroupPartial = !isGroupSelected && selectableIds.some(id => selectedActivities.has(id));
  const handleGroupCheckbox = (e) => { e.stopPropagation(); if (isGroupSelected) selectableIds.forEach(id => { if (selectedActivities.has(id)) onToggleSelect(id); }); else selectableIds.forEach(id => { if (!selectedActivities.has(id)) onToggleSelect(id); }); };

  return (
    <div className="mb-1 group" ref={provided?.innerRef} {...(provided?.draggableProps || {})}>
      <div onClick={onToggle} style={{ borderLeft: `6px solid ${statusColor}`, backgroundColor: isDragging ? '#e0e7ff' : groupStatus === 'concluido_com_atraso' ? '#fff1f2' : groupStatus === 'atrasado' ? '#fff1f2' : groupStatus === 'impactado_por_atraso' ? '#f5f3ff' : groupStatus === 'em_andamento' ? '#eff6ff' : groupStatus === 'concluido' ? '#f0fdf4' : groupStatus === 'pausado' ? '#fefce8' : '#f8fafc', cursor: 'pointer', ...(isDragging && { boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', transform: 'rotate(1deg) scale(1.02)', transition: 'all 0.2s ease' }) }} className={`p-2 rounded-lg hover:shadow-md transition-shadow duration-200 border relative ${isDragging ? 'border-indigo-400 ring-2 ring-indigo-200' : isGroupSelected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}>
        {selectableIds.length > 0 && (
          <div className={`absolute right-1 top-1 z-20 transition-opacity ${isGroupSelected || isGroupPartial || hasSelections ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={handleGroupCheckbox}>
            <input type="checkbox" checked={isGroupSelected} ref={el => { if (el) el.indeterminate = isGroupPartial; }} onChange={() => {}} className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer" />
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          {canDragGroup && <div {...(provided?.dragHandleProps || {})} onClick={(e) => e.stopPropagation()} className="cursor-move p-1 bg-gray-100 hover:bg-gray-200 rounded flex-shrink-0 border border-gray-300" style={{ minWidth:'20px',minHeight:'20px',display:'flex',alignItems:'center',justifyContent:'center' }} title="Arrastar grupo"><svg className="w-3 h-3 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></div>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              {disciplineColors.map(d => <div key={d.name} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} title={d.name}></div>)}
              <Button variant="ghost" size="icon" className="w-5 h-5 ml-auto text-purple-500 hover:bg-purple-100" onClick={(e) => { e.stopPropagation(); onShowPrevisao(atividades); }} title="Ver Previsão"><LineChart className="w-3.5 h-3.5" /></Button>
            </div>
            <p className="font-bold text-xs truncate text-gray-800" title={emNome}>{emNome}</p>
            {emNome !== 'Atividades Rápidas' && <div className="flex items-center gap-1.5 mt-1"><User className="w-3 h-3 flex-shrink-0" /><p className="text-xs font-medium truncate">{executorNome}</p></div>}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="px-1.5 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: statusColor }}>{totalHoras > 0 ? `${formatHours(totalHoras)}h` : '0h'}</div>
              <p className="text-xs text-gray-500 mt-0.5">{atividades.length} ativ.</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </div>
        {isDragging && <div className="mt-2 flex items-center justify-center gap-2 bg-indigo-100 border-2 border-indigo-300 rounded p-2"><div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">{atividades.length}</div><span className="text-sm font-bold text-indigo-800">Movendo {atividades.length} atividade{atividades.length > 1 ? 's' : ''}</span></div>}
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

// --- Container de Atividades ---
const ActivityContainer = ({ activities, containerClass = "", disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder }) => {
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const activityGroups = useMemo(() => {
    const groups = {};
    activities.forEach(a => {
      let gk, emp;
      if (a.isLegacyExecution) { gk = `virtual-${a.executor_principal||'sem-executor'}`; emp = { nome: 'Atividades Rápidas' }; }
      else { const ek = a.empreendimento_id||'sem-empreendimento'; const uk = a.executor_principal||'sem-executor'; if (ek === 'sem-empreendimento') { gk = `geral-${uk}`; emp = a.empreendimento || { nome: 'Atividades Gerais' }; } else { gk = `${ek}|${uk}`; emp = a.empreendimento; } }
      if (!groups[gk]) groups[gk] = { empreendimento: emp, executor: { email: a.executor_principal }, atividades: [] };
      groups[gk].atividades.push(a);
    });
    return groups;
  }, [activities, dayKey]);
  const toggleGroup = (k) => { const n = new Set(expandedGroups); if (n.has(k)) n.delete(k); else n.add(k); setExpandedGroups(n); };

  if (viewType === 'analitico') {
    const toRender = modoOrdenacao ? activities : activities.filter(a => {
      const hA = Number(a.horas_por_dia?.[dayKey]) || 0; const hE = Number(a.horas_executadas_por_dia?.[dayKey]) || 0; const tE = Number(a.tempo_executado) || 0;
      if (a.isLegacyExecution) return tE >= 0.05;
      if (a.isQuickActivity || a.is_quick_activity) return hE >= 0.05 || hA >= 0.05 || a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.status === 'em_andamento';
      return hA >= 0.05 || hE >= 0.05 || ((a.status === 'concluido' || a.status === 'concluido_com_atraso') && !a.atividade_id) || a._isExtended || a._isPushed;
    });
    const temOrdem = activities.length > 0 && (() => { try { return !!JSON.parse(localStorage.getItem('calendar-activity-order') || '{}')[dayKey]; } catch { return false; } })();
    return (
      <div className={`space-y-1 ${containerClass}`}>
        {modoOrdenacao && temOrdem && <div className="flex justify-end mb-1"><button onClick={() => onClearDayOrder && onClearDayOrder(dayKey)} className="text-xs text-amber-600 hover:text-amber-800 underline">Restaurar ordem padrão</button></div>}
        {toRender.map((a, i) => (
          <Draggable key={a.id} draggableId={`${a.id}`} index={i} isDragDisabled={modoOrdenacao ? (a.status === 'concluido' || a.status === 'concluido_com_atraso') : (!canReprogram || a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.isLegacyExecution || normalizeActivityId(isReprogramando) === normalizeActivityId(a.id))}>
            {(provided, snapshot) => <ActivityItem plano={a} dayKey={dayKey} onDelete={onActivityDelete} executorMap={executorMap} allPlanejamentos={allPlanejamentos} provided={provided} isDragging={snapshot.isDragging} isReprogramando={normalizeActivityId(isReprogramando) === normalizeActivityId(a.id)} isSelected={selectedActivities.has(normalizeActivityId(a.id))} onToggleSelect={onToggleSelect} hasSelections={hasSelections} orderIndex={i} />}
          </Draggable>
        ))}
      </div>
    );
  }

  const groupsComHoras = Object.entries(activityGroups).filter(([, gd]) => gd.atividades.some(a => {
    const hA = Number(a.horas_por_dia?.[dayKey]) || 0; const hE = Number(a.horas_executadas_por_dia?.[dayKey]) || 0; const tE = Number(a.tempo_executado) || 0;
    if (a.isLegacyExecution) return tE >= 0.05;
    if (a.isQuickActivity || a.is_quick_activity) return hE >= 0.05 || hA >= 0.05 || a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.status === 'em_andamento';
    return hA >= 0.05 || hE >= 0.05 || a._isExtended || a._isPushed;
  }));

  return (
    <div className={`space-y-1 ${containerClass}`}>
      {groupsComHoras.map(([gk, gd]) => {
        const af = gd.atividades.filter(a => { const hA=Number(a.horas_por_dia?.[dayKey])||0; const hE=Number(a.horas_executadas_por_dia?.[dayKey])||0; const tE=Number(a.tempo_executado)||0; if(a.isLegacyExecution) return tE>=0.05; if(a.isQuickActivity||a.is_quick_activity) return hE>=0.05||hA>=0.05||a.status==='concluido'||a.status==='em_andamento'; return hA>=0.05||hE>=0.05||a._isExtended||a._isPushed; });
        if (af.length === 0) return null;
        const gdf = { ...gd, atividades: af };
        const cdg = canReprogram && gdf.empreendimento?.nome !== 'Atividades Rápidas' && !gdf.atividades.some(a => a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.isLegacyExecution);
        if (cdg) return (
          <Draggable key={`group-${gk}-${dayKey}`} draggableId={`group-${gk}-${dayKey}`} index={0} isDragDisabled={false}>
            {(provided, snapshot) => <DailyActivityGroup empreendimento={gdf.empreendimento} executor={gdf.executor} atividades={gdf.atividades} isExpanded={expandedGroups.has(gk)} onToggle={() => toggleGroup(gk)} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} groupKey={gk} provided={provided} isDragging={snapshot.isDragging} />}
          </Draggable>
        );
        return <DailyActivityGroup key={`group-${gk}-${dayKey}-static`} empreendimento={gdf.empreendimento} executor={gdf.executor} atividades={gdf.atividades} isExpanded={expandedGroups.has(gk)} onToggle={() => toggleGroup(gk)} disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} groupKey={gk} />;
      })}
    </div>
  );
};

// --- DayCell ---
const DayCell = ({ day, dayActivities, date, isToday, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType }) => {
  const dayKey = format(day, 'yyyy-MM-dd');
  const canDragDay = canReprogram && dayActivities.some(a => !a.isLegacyExecution && a.status !== 'concluido' && a.status !== 'concluido_com_atraso') && dayActivities.length > 0;
  return (
    <Droppable droppableId={dayKey}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps} className={`h-40 p-2 border border-gray-100 flex flex-col group ${isSameMonth(day, date) ? 'bg-white' : 'bg-gray-50'} ${isToday ? 'border-2 border-blue-500 bg-blue-50' : ''} ${snapshot.isDraggingOver ? 'bg-purple-100' : ''}`}>
          <div className="flex items-center justify-between mb-2 relative">
            {canDragDay && (
              <Draggable draggableId={`day-${dayKey}`} index={0} isDragDisabled={false}>
                {(dp, ds) => (
                  <div ref={dp.innerRef} {...dp.draggableProps} className={`absolute top-0 left-0 right-0 z-20 ${ds.isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <div {...dp.dragHandleProps} className={`flex items-center justify-center gap-2 p-1 rounded-b cursor-move ${ds.isDragging ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`} title="Arrastar dia">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                      <span className="text-xs font-bold">{dayActivities.length} ativ.</span>
                    </div>
                    {ds.isDragging && <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-30"><div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span className="text-sm font-bold">Movendo {dayActivities.length} atividade{dayActivities.length > 1 ? 's' : ''}</span></div><div className="text-xs opacity-90 mt-1">De {format(day, 'd MMM', { locale: ptBR })}</div></div>}
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
  const monthDays = useMemo(() => { const s = startOfWeek(startOfMonth(date), { locale: ptBR }); const e = endOfWeek(endOfMonth(date), { locale: ptBR }); return eachDayOfInterval({ start: s, end: e }); }, [date]);
  return (
    <div className="grid grid-cols-7 border-t border-gray-100">
      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <div key={d} className="text-center font-medium text-sm text-gray-500 py-3 border-b border-gray-100 bg-gray-50">{d}</div>)}
      {monthDays.map(day => { const dk = format(day, 'yyyy-MM-dd'); return <DayCell key={dk} day={day} dayActivities={activitiesByDay[dk] || []} date={date} isToday={isSameDay(day, new Date())} disciplinas={disciplinas} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} />; })}
    </div>
  );
};

// --- WeekView ---
const WeekView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder, onToggleModoOrdenacao }) => {
  const [expandedDay, setExpandedDay] = useState(null);
  const weekDays = useMemo(() => { const s = startOfWeek(date, { locale: ptBR }); const e = endOfWeek(date, { locale: ptBR }); return eachDayOfInterval({ start: s, end: e }); }, [date]);
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
                <div className={`flex flex-col p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 sticky top-0 z-10 ${isToday ? 'bg-blue-50' : 'bg-gray-50/50'}`} onClick={() => setExpandedDay(prev => prev === dayKey ? null : dayKey)}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700 capitalize">{format(day, 'EEE, d', { locale: ptBR })}</h3>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onToggleModoOrdenacao && onToggleModoOrdenacao()} className={`p-0.5 rounded transition-colors ${modoOrdenacao ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'}`} title={modoOrdenacao ? "Sair da ordenação" : "Ordenar"}><ListOrdered className="w-3.5 h-3.5" /></button>
                      <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  {dayActivities.length > 0 && (
                    <div className="mt-1 text-xs text-gray-600 font-medium">
                      <span className="inline-block px-2 py-0.5 bg-white rounded border border-gray-200">
                        {(() => { let t = 0; dayActivities.forEach(a => { const hA=Number(a.horas_por_dia?.[dayKey])||0; const hE=Number(a.horas_executadas_por_dia?.[dayKey])||0; const tE=Number(a.tempo_executado)||0; let h=0; if(a.isLegacyExecution) h=tE; else if(a.isQuickActivity||a.is_quick_activity) h=hE>0?hE:hA; else if(hE>0) h=hE; else if(a.status==='concluido'&&tE>0&&Object.keys(a.horas_executadas_por_dia||{}).length===0){const dp=Object.keys(a.horas_por_dia||{});h=dp.length>0&&dp.includes(dayKey)?tE/dp.length:0;} else h=hA; t+=h; }); return `${formatHours(t)}h`; })()}
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
            <button onClick={() => onToggleModoOrdenacao && onToggleModoOrdenacao()} className={`p-1 rounded transition-colors ${modoOrdenacao ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'}`} title={modoOrdenacao ? "Sair da ordenação" : "Ordenar"}><ListOrdered className="w-5 h-5" /></button>
          </div>
          <div className="max-w-4xl mx-auto">
            {activities.length > 0 ? <ActivityContainer activities={activities} containerClass="space-y-4" disciplinas={disciplinas} dayKey={dayKey} onActivityDelete={onActivityDelete} onShowPrevisao={onShowPrevisao} executorMap={executorMap} allPlanejamentos={allPlanejamentos} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={onToggleSelect} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={onClearDayOrder} /> : <div className="text-center py-12 text-gray-500"><CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />Nenhuma atividade planejada para este dia.</div>}
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

  useEffect(() => { if (user?.email && !filters.user) setFilters(prev => ({ ...prev, user: user.email })); }, [user?.email, filters.user]);

  const effectiveUsuarios = (allUsers && allUsers.length > 0) ? allUsers : (usuarios || []);
  const executorMap = useMemo(() => effectiveUsuarios.reduce((acc, u) => { if (u.email) acc[u.email] = u; return acc; }, {}), [effectiveUsuarios]);

  const [selectedActivities, setSelectedActivities] = useState(new Set());
  const [modoOrdenacao, setModoOrdenacao] = useState(false);
  const [activityOrder, setActivityOrder] = useState(() => { try { return JSON.parse(localStorage.getItem('calendar-activity-order') || '{}'); } catch { return {}; } });

  const clearDayOrder = useCallback((dayKey) => { setActivityOrder(prev => { const u = { ...prev }; delete u[dayKey]; localStorage.setItem('calendar-activity-order', JSON.stringify(u)); return u; }); }, []);
  const toggleModoOrdenacao = useCallback(() => { setModoOrdenacao(prev => { if (!prev && viewType !== 'analitico') setViewType('analitico'); return !prev; }); }, [viewType]);

  const loadCalendarData = useCallback(async (userFilter) => {
    if (!userFilter) { setEnrichedData([]); return; }
    setIsCalendarLoading(true);
    try {
      const execFilter = userFilter !== 'all' ? { usuario: userFilter } : {};
      const [planosAtividade, planosDocumento, execs] = await Promise.all([
        userFilter !== 'all' ? retryWithBackoff(() => PlanejamentoAtividade.filter({ executor_principal: userFilter }), 3, 1500, 'cal.ativ') : retryWithBackoff(() => PlanejamentoAtividade.list(), 3, 1500, 'cal.ativAll'),
        userFilter !== 'all' ? retryWithBackoff(() => PlanejamentoDocumento.filter({ executor_principal: userFilter }), 3, 1500, 'cal.doc') : retryWithBackoff(() => PlanejamentoDocumento.list(), 3, 1500, 'cal.docAll'),
        retryWithBackoff(() => Execucao.filter(execFilter), 3, 1500, 'cal.execs'),
      ]);
      const planosAtividadeComTipo = (planosAtividade || []).map(p => ({ ...p, tipo_planejamento: 'atividade' }));
      const planosDocumentoComTipo = (planosDocumento || []).map(p => ({ ...p, tipo_planejamento: 'documento' }));
      const todosPlanejamentos = [...planosAtividadeComTipo, ...planosDocumentoComTipo];
      const empIds = [...new Set(todosPlanejamentos.map(p => p.empreendimento_id).filter(Boolean))];
      const atIds = [...new Set(todosPlanejamentos.map(p => p.atividade_id).filter(Boolean))];
      const docIds = [...new Set(todosPlanejamentos.map(p => p.documento_id).filter(Boolean).map(String))];
      const [emps, ats, docs] = await Promise.all([
        empIds.length > 0 ? retryWithBackoff(() => Empreendimento.filter({ id: { $in: empIds } }), 3, 1000, 'enrich.emp') : Promise.resolve([]),
        atIds.length > 0 ? retryWithBackoff(() => Atividade.filter({ id: { $in: atIds } }), 3, 1000, 'enrich.at') : Promise.resolve([]),
        docIds.length > 0 ? Promise.all(docIds.map(id => retryWithBackoff(() => Documento.get(id), 3, 1000, `enrich.doc.${id}`).catch(() => null))).then(r => r.filter(Boolean)) : Promise.resolve([]),
      ]);
      const empMap = new Map((emps || []).map(i => [String(i.id), i]));
      const atMap = new Map((ats || []).map(i => [String(i.id), i]));
      const docMap = new Map((docs || []).map(i => [String(i.id), i]));
      const horasExecPorPlan = {};
      (execs || []).forEach(exec => {
        if (!exec.planejamento_id || !exec.inicio) return;
        const d = format(parseLocalDate(exec.inicio), 'yyyy-MM-dd');
        if (!horasExecPorPlan[exec.planejamento_id]) horasExecPorPlan[exec.planejamento_id] = {};
        horasExecPorPlan[exec.planejamento_id][d] = (horasExecPorPlan[exec.planejamento_id][d] || 0) + Number(exec.tempo_total || 0);
      });
      const atividadesVirtuais = (execs || []).filter(e => !e.planejamento_id).map(exec => {
        const diaExec = exec.inicio ? format(parseLocalDate(exec.inicio), 'yyyy-MM-dd') : null;
        return { id: `exec-${exec.id}`, isLegacyExecution: true, isQuickActivity: true, tipo_planejamento: 'atividade', descritivo: exec.descritivo || 'Execução Rápida', tempo_executado: Number(exec.tempo_total) || 0, executor_principal: exec.usuario, status: 'concluido', horas_executadas_por_dia: diaExec ? { [diaExec]: Number(exec.tempo_total) || 0 } : {}, empreendimento: null, atividade: null, documento: null, os: exec.os || null, observacao: exec.observacao || null };
      });
      const finalData = [
        ...todosPlanejamentos.map(plano => {
          const hE = horasExecPorPlan[plano.id] || {};
          const doc = docMap.get(String(plano.documento_id)) || null;
          let docEnr = null;
          if (doc) { docEnr = { ...doc }; const n = String(doc.numero || '').trim(); const a = String(doc.arquivo || doc.titulo || '').trim(); const p = []; if (n) p.push(n); if (a) p.push(a); docEnr.numero_completo = p.length ? p.join(' - ') : (doc.titulo || doc.arquivo || null); }
          const stored = (typeof plano.horas_executadas_por_dia === 'object' && plano.horas_executadas_por_dia) ? plano.horas_executadas_por_dia : {};
          return { ...plano, empreendimento: empMap.get(String(plano.empreendimento_id)) || null, atividade: atMap.get(String(plano.atividade_id)) || null, documento: docEnr, horas_executadas_por_dia: Object.assign({}, stored, hE) };
        }),
        ...atividadesVirtuais
      ];
      setEnrichedData(finalData);
    } catch (error) { setEnrichedData([]); alert("Erro ao carregar as atividades do calendário."); }
    finally { setIsCalendarLoading(false); }
  }, []);

  useEffect(() => { if (filters.user) loadCalendarData(filters.user); else { setEnrichedData([]); setIsCalendarLoading(false); } }, [filters.user]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevUpdateKeyRef = useRef(updateKey);
  useEffect(() => { if (updateKey === prevUpdateKeyRef.current) return; prevUpdateKeyRef.current = updateKey; if (!filters.user) return; const t = setTimeout(() => loadCalendarData(filters.user), 3000); return () => clearTimeout(t); }, [updateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevCompletionKeyRef = useRef(completionKey);
  useEffect(() => { if (completionKey === prevCompletionKeyRef.current) return; prevCompletionKeyRef.current = completionKey; if (!filters.user) return; loadCalendarData(filters.user); }, [completionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivityDelete = useCallback((update = null) => { if (update?.id) setEnrichedData(prev => prev.map(item => item.id === update.id ? { ...item, ...update } : item)); if (hasSelectedUser) loadCalendarData(filters.user); }, [hasSelectedUser, filters.user, loadCalendarData]);
  const toggleActivitySelection = useCallback((id) => { const n = normalizeActivityId(id); setSelectedActivities(prev => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; }); }, []);
  const clearSelection = useCallback(() => setSelectedActivities(new Set()), []);

  const handleReprogramarAtividade = useCallback(async (atividadeId, novaDataInicio, executorEmail) => {
    const normId = normalizeActivityId(atividadeId);
    setIsReprogramando(normId);
    try {
      const atv = (enrichedData || []).find(p => normalizeActivityId(p.id) === normId);
      if (!atv) throw new Error("Atividade não encontrada.");
      if (atv.isLegacyExecution) throw new Error("Atividades rápidas antigas não podem ser reprogramadas.");
      if (atv.status === 'concluido' || atv.status === 'concluido_com_atraso') throw new Error("Atividades concluídas não podem ser reprogramadas.");
      const entity = atv.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      const planos = (await retryWithBackoff(() => entity.filter({ executor_principal: executorEmail }), 3, 1000, 'fetchForReprogram')).filter(p => p.status !== 'concluido' && !p.isLegacyExecution);
      const carga = {};
      planos.forEach(p => { if (normalizeActivityId(p.id) !== normId && p.horas_por_dia) Object.entries(p.horas_por_dia).forEach(([d, h]) => { carga[d] = (carga[d] || 0) + Number(h || 0); }); });
      const { distribuicao, dataTermino } = distribuirHorasPorDias(parseLocalDate(novaDataInicio), atv.tempo_planejado, 8, carga);
      if (Object.keys(distribuicao).length === 0) throw new Error("Não foi possível alocar horas para a nova data.");
      const inicio = Object.keys(distribuicao).sort()[0];
      const termino = dataTermino ? format(dataTermino, 'yyyy-MM-dd') : inicio;
      await retryWithBackoff(() => entity.update(atv.id, { inicio_planejado: inicio, termino_planejado: termino, horas_por_dia: distribuicao }), 3, 1500, 'updateReprogram');
      if (hasSelectedUser) loadCalendarData(filters.user);
      if (triggerUpdate) triggerUpdate();
    } catch (error) { alert(`Erro ao reprogramar: ${error.message}`); throw error; }
    finally { setIsReprogramando(null); }
  }, [enrichedData, triggerUpdate, hasSelectedUser, filters.user, loadCalendarData]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) {
      if (!modoOrdenacao) return;
      const dayKey = source.droppableId;
      const da = [...(activitiesByDay[dayKey] || [])];
      const [moved] = da.splice(source.index, 1);
      da.splice(destination.index, 0, moved);
      setActivityOrder(prev => { const u = { ...prev, [dayKey]: da.map(a => String(a.id)) }; localStorage.setItem('calendar-activity-order', JSON.stringify(u)); return u; });
      return;
    }
    if (modoOrdenacao) return;
    if (!hasPermission('admin')) { alert("Sem permissão para replanejar."); return; }

    const isDayDrag = draggableId.startsWith('day-');
    if (isDayDrag) {
      const sdk = draggableId.replace('day-', '');
      const movable = (activitiesByDay[sdk] || []).filter(a => !a.isLegacyExecution && a.status !== 'concluido' && a.status !== 'concluido_com_atraso');
      if (movable.length === 0) { alert("Nenhuma atividade pode ser movida."); return; }
      if (!window.confirm(`Mover ${movable.length} atividade(s) de ${format(parseISO(sdk), 'd MMM', { locale: ptBR })} para ${format(parseISO(destination.droppableId), 'd MMM', { locale: ptBR })}?`)) return;
      (async () => { let s = 0, e = 0; for (let i = 0; i < movable.length; i++) { try { await handleReprogramarAtividade(movable[i].id, destination.droppableId, movable[i].executor_principal); s++; if (i < movable.length - 1) await new Promise(r => setTimeout(r, 500)); } catch { e++; } } if (s > 0) { alert(`✅ ${s} reprogramada(s)!${e > 0 ? `\n⚠️ ${e} falharam` : ''}`); clearSelection(); } else alert('❌ Nenhuma pôde ser movida.'); })();
      return;
    }

    const isGroupDrag = draggableId.startsWith('group-');
    if (isGroupDrag) {
      const parts = draggableId.replace('group-', '').split('-');
      const sdk = parts.pop();
      const gk = parts.join('-');
      const allInDay = activitiesByDay[source.droppableId] || [];
      let ga = [];
      if (gk.startsWith('virtual-')) { const em = gk.replace('virtual-', ''); ga = allInDay.filter(a => a.isLegacyExecution && a.executor_principal === em); }
      else if (gk.startsWith('geral-')) { const em = gk.replace('geral-', ''); ga = allInDay.filter(a => !a.empreendimento_id && a.executor_principal === em && !a.isLegacyExecution); }
      else { const [eid, em] = gk.split('|'); ga = allInDay.filter(a => a.empreendimento_id === eid && a.executor_principal === em && !a.isLegacyExecution); }
      if (ga.some(a => a.isLegacyExecution || a.status === 'concluido' || a.status === 'concluido_com_atraso')) { alert("Algumas atividades do grupo não podem ser reprogramadas."); return; }
      (async () => { let s = 0, e = 0; for (const a of ga) { try { await handleReprogramarAtividade(a.id, destination.droppableId, a.executor_principal); s++; await new Promise(r => setTimeout(r, 500)); } catch { e++; } } if (s > 0) { alert(`✅ ${s} reprogramada(s)!${e > 0 ? `\n⚠️ ${e} falharam` : ''}`); clearSelection(); } else alert('❌ Erro.'); })();
      return;
    }

    const toMove = selectedActivities.has(draggableId) && selectedActivities.size > 1 ? Array.from(selectedActivities) : [draggableId];
    if (toMove.some(id => { const a = (enrichedData || []).find(p => normalizeActivityId(p.id) === normalizeActivityId(id)); return !a || a.isLegacyExecution || a.status === 'concluido' || a.status === 'concluido_com_atraso'; })) { alert("Algumas atividades não podem ser reprogramadas."); return; }
    (async () => { let s = 0, e = 0; for (const id of toMove) { const a = (enrichedData || []).find(p => normalizeActivityId(p.id) === normalizeActivityId(id)); if (!a) continue; try { await handleReprogramarAtividade(id, destination.droppableId, a.executor_principal); s++; await new Promise(r => setTimeout(r, 500)); } catch { e++; } } if (s > 0) { alert(`✅ ${s} reprogramada(s)!${e > 0 ? `\n⚠️ ${e} falharam` : ''}`); clearSelection(); } else alert('❌ Erro.'); })();
  };

  const filteredPlanejamentos = useMemo(() => {
    if (!hasSelectedUser) return [];
    let base = enrichedData || [];
    if (filters.discipline !== 'all') {
      return base.filter(item => {
        if (item.tipo_planejamento === 'documento' && item.atividade_id === null) return item.documento?.subdisciplinas?.includes(filters.discipline) || false;
        return item.atividade?.disciplina === filters.discipline;
      });
    }
    return base;
  }, [enrichedData, filters.discipline, hasSelectedUser]);

  const activityStatusMap = useMemo(() => {
    const sm = new Map();
    const pm = new Map(filteredPlanejamentos.map(p => [normalizeActivityId(p.id), p]));
    filteredPlanejamentos.forEach(plano => {
      if (plano.isLegacyExecution) { sm.set(normalizeActivityId(plano.id), plano.status); return; }
      if (plano.status === 'concluido_com_atraso') { sm.set(normalizeActivityId(plano.id), 'concluido_com_atraso'); return; }
      if (plano.status === 'concluido') { sm.set(normalizeActivityId(plano.id), 'concluido'); return; }
      if (plano.status === 'atrasado' || isActivityOverdue(plano)) { sm.set(normalizeActivityId(plano.id), 'atrasado'); return; }
      let repl = false;
      if (plano.inicio_ajustado && plano.inicio_planejado) { try { const aj=startOfDay(parseISO(plano.inicio_ajustado)),pl=startOfDay(parseISO(plano.inicio_planejado)); if(isValid(aj)&&isValid(pl)&&isAfter(aj,pl)) repl=true; } catch(_){} }
      let predAtrasada = false;
      if (plano.predecessora_id) { const pred = pm.get(normalizeActivityId(plano.predecessora_id)); if (pred && isActivityOverdue(pred)) predAtrasada = true; }
      if (repl || predAtrasada) { sm.set(normalizeActivityId(plano.id), 'impactado_por_atraso'); return; }
      if (plano.termino_ajustado && plano.termino_planejado) { try { const aj=startOfDay(parseISO(plano.termino_ajustado)),pl=startOfDay(parseISO(plano.termino_planejado)); if(isValid(aj)&&isValid(pl)&&isAfter(aj,pl)) { sm.set(normalizeActivityId(plano.id),'replanejado_atrasado'); return; } } catch(_){} }
      sm.set(normalizeActivityId(plano.id), plano.status || 'nao_iniciado');
    });
    return sm;
  }, [filteredPlanejamentos]);

  const activitiesByDay = useMemo(() => {
    if (!hasSelectedUser) return {};
    const grouped = {};
    const hojeDate = startOfDay(new Date());
    const hojeKey = format(hojeDate, 'yyyy-MM-dd');
    const recentCutoff = addDays(hojeDate, -30);

    filteredPlanejamentos.forEach(plano => {
      const diasParaExibir = new Set();
      const isQuick = plano.is_quick_activity || plano.isQuickActivity;
      let _isExtended = false;

      if (isQuick) {
        let hasHours = false;
        if (plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object') {
          Object.keys(plano.horas_executadas_por_dia).forEach(dk => { if (Number(plano.horas_executadas_por_dia[dk]) > 0.01) { diasParaExibir.add(dk); hasHours = true; } });
          if (!hasHours && (plano.status === 'concluido' || plano.status === 'em_andamento')) { const dias = Object.keys(plano.horas_executadas_por_dia); if (dias.length > 0) { const u = dias.sort().pop(); const p = parseLocalDate(u); diasParaExibir.add((p && isValid(p)) ? format(p, 'yyyy-MM-dd') : u); hasHours = true; } }
        }
        if (!hasHours && plano.inicio_planejado) { const p = parseLocalDate(plano.inicio_planejado); diasParaExibir.add((p && isValid(p)) ? format(p, 'yyyy-MM-dd') : plano.inicio_planejado); }
      } else {
        const realStatus = activityStatusMap.get(normalizeActivityId(plano.id)) || plano.status || 'nao_iniciado';
        const foiExecutada = plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object' && Object.keys(plano.horas_executadas_por_dia).length > 0;
        if (realStatus === 'concluido') {
          if (plano.horas_por_dia) Object.keys(plano.horas_por_dia).forEach(dk => { if (Number(plano.horas_por_dia[dk]) >= 0.05) diasParaExibir.add(dk); });
          if (foiExecutada) Object.keys(plano.horas_executadas_por_dia).forEach(dk => { if (Number(plano.horas_executadas_por_dia[dk]) >= 0.05) diasParaExibir.add(dk); });
          if (diasParaExibir.size === 0) { const dr = plano.termino_real || plano.inicio_planejado; if (dr) { const p = parseLocalDate(dr); if (p && isValid(p)) diasParaExibir.add(format(p, 'yyyy-MM-dd')); } }
        } else {
          if (foiExecutada) Object.keys(plano.horas_executadas_por_dia).forEach(dk => { if (Number(plano.horas_executadas_por_dia[dk]) >= 0.05) diasParaExibir.add(dk); });
          if (plano.horas_por_dia) Object.keys(plano.horas_por_dia).forEach(dk => { if (Number(plano.horas_por_dia[dk]) >= 0.05) diasParaExibir.add(dk); });
          if (isActivityOverdue(plano)) { const tr = plano.termino_ajustado || plano.termino_planejado; if (tr) { const td = parseLocalDate(tr); const jaHoje = !!(plano.horas_por_dia?.[hojeKey] && Number(plano.horas_por_dia[hojeKey]) >= 0.05); if (td && isValid(td) && td >= recentCutoff && !jaHoje) { diasParaExibir.add(hojeKey); _isExtended = true; } } }
        }
      }

      diasParaExibir.forEach(dk => {
        if (!grouped[dk]) grouped[dk] = [];
        if (!grouped[dk].some(i => i.id === plano.id)) grouped[dk].push({ ...plano, isQuickActivity: !!plano.is_quick_activity, isLegacyExecution: false, _isExtended: _isExtended && dk === hojeKey });
      });
    });

    for (const dk in grouped) {
      grouped[dk].sort((a, b) => {
        if (a.isLegacyExecution && !b.isLegacyExecution) return 1;
        if (!a.isLegacyExecution && b.isLegacyExecution) return -1;
        const sA = activityStatusMap.get(normalizeActivityId(a.id)) || a.status || 'nao_iniciado';
        const sB = activityStatusMap.get(normalizeActivityId(b.id)) || b.status || 'nao_iniciado';
        const cA = sA === 'concluido' || sA === 'concluido_com_atraso';
        const cB = sB === 'concluido' || sB === 'concluido_com_atraso';
        if (cA && !cB) return 1; if (!cA && cB) return -1;
        const iA = a.inicio_planejado ? parseISO(a.inicio_planejado) : null;
        const iB = b.inicio_planejado ? parseISO(b.inicio_planejado) : null;
        if (iA && iB) return iA.getTime() - iB.getTime();
        if (iA) return -1; if (iB) return 1;
        return (a.atividade?.atividade || a.descritivo || '').localeCompare(b.atividade?.atividade || b.descritivo || '', 'pt-BR', { sensitivity: 'base' });
      });
    }

    for (const dk in grouped) {
      const customOrder = activityOrder[dk];
      if (customOrder?.length > 0) {
        const om = new Map(customOrder.map((id, i) => [String(id), i]));
        grouped[dk].sort((a, b) => (om.has(String(a.id)) ? om.get(String(a.id)) : 9999) - (om.has(String(b.id)) ? om.get(String(b.id)) : 9999));
      }
    }

    if (grouped[hojeKey] && grouped[hojeKey].some(a => a._isExtended)) {
      const eligible = grouped[hojeKey].filter(a => { const s = activityStatusMap.get(normalizeActivityId(a.id)) || a.status || 'nao_iniciado'; return !a._isExtended && !a.isLegacyExecution && !a.isQuickActivity && s !== 'concluido' && s !== 'concluido_com_atraso'; });
      if (eligible.length > 0) {
        const last = eligible[eligible.length - 1];
        grouped[hojeKey] = grouped[hojeKey].filter(a => a.id !== last.id);
        const nextDay = getNextWorkingDay(hojeDate);
        const nextKey = format(nextDay, 'yyyy-MM-dd');
        if (!grouped[nextKey]) grouped[nextKey] = [];
        if (!grouped[nextKey].some(a => a.id === last.id)) grouped[nextKey].push({ ...last, _isPushed: true });
      }
    }

    return grouped;
  }, [filteredPlanejamentos, hasSelectedUser, activityOrder]);

  const cargaDiariaPorUsuario = useMemo(() => {
    if (!hasSelectedUser) return {};
    const carga = {};
    filteredPlanejamentos.forEach(plano => { const ue = plano.executor_principal; if (!ue) return; if (!carga[ue]) carga[ue] = {}; if (plano.horas_por_dia) Object.entries(plano.horas_por_dia).forEach(([d, h]) => { carga[ue][d] = (carga[ue][d] || 0) + Number(h); }); });
    return carga;
  }, [filteredPlanejamentos, hasSelectedUser]);

  const handleDateChange = (dir) => { const fn = dir === 'next' ? { month: addMonths, week: addWeeks, day: addDays } : { month: subMonths, week: subWeeks, day: subDays }; setCurrentDate(c => fn[viewMode](c, 1)); };

  const horasDoDia = useMemo(() => {
    const dk = format(currentDate, 'yyyy-MM-dd');
    let s = 0;
    (activitiesByDay[dk] || []).forEach(a => { const hA=Number(a.horas_por_dia?.[dk])||0; const hE=Number(a.horas_executadas_por_dia?.[dk])||0; const tE=Number(a.tempo_executado)||0; let h=0; if(a.isLegacyExecution) h=tE; else if(a.isQuickActivity||a.is_quick_activity) h=hE>0?hE:hA; else if(hE>0) h=hE; else if((a.status==='concluido'||a.status==='concluido_com_atraso')&&tE>0&&Object.keys(a.horas_executadas_por_dia||{}).length===0){const dp=Object.keys(a.horas_por_dia||{});h=dp.length>0&&dp.includes(dk)?tE/dp.length:0;} else h=hA; s+=h; });
    return s;
  }, [currentDate, activitiesByDay, viewMode]);

  const headerTitle = useMemo(() => {
    switch (viewMode) {
      case 'month': return format(currentDate, 'MMMM yyyy', { locale: ptBR });
      case 'week': { const s = startOfWeek(currentDate, { locale: ptBR }); const e = endOfWeek(currentDate, { locale: ptBR }); return `${format(s, 'd MMM')} - ${format(e, 'd MMM, yyyy', { locale: ptBR })}`; }
      case 'day': return format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR });
      default: return '';
    }
  }, [currentDate, viewMode]);

  const handleClearFilters = () => {
    const up = userProfile?.usuarios_permitidos_visualizar || [];
    const tp = Array.isArray(up) && up.length > 0;
    if ((isGestao || isColaborador || isApoio) && !tp) { setFilters(prev => ({ ...prev, discipline: 'all' })); clearSelection(); return; }
    setFilters({ user: '', discipline: 'all' }); clearSelection();
  };

  const totalLoading = isDashboardRefreshing || isCalendarLoading;
  const canReprogram = hasPermission('admin');
  const selectedUserName = isViewingAllUsers ? 'Todos os Usuários' : executorMap[filters.user]?.nome || filters.user;

  const renderContent = () => {
    if (!hasSelectedUser) return (
      <div className="p-12 text-center min-h-[400px] flex flex-col justify-center items-center">
        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Selecione um Usuário</h3>
        <p className="text-gray-500 mb-6">Para começar, selecione um usuário no filtro acima.</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto"><p className="text-blue-700 text-sm">💡 <strong>Dica:</strong> Para ver todos, selecione "Todos os Usuários".</p></div>
      </div>
    );
    if (totalLoading) return <div className="flex justify-center items-center h-[400px]"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /><p className="ml-3 text-lg text-gray-600">Carregando atividades...</p></div>;
    const hasSelections = selectedActivities.size > 0;
    if (viewMode === 'month') return <MonthView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={(p) => { setPlanejamentosParaPrevisao(p); setShowPrevisaoModal(true); }} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} />;
    if (viewMode === 'week') return <WeekView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={(p) => { setPlanejamentosParaPrevisao(p); setShowPrevisaoModal(true); }} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={clearDayOrder} onToggleModoOrdenacao={toggleModoOrdenacao} />;
    if (viewMode === 'day') return <DayView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={(p) => { setPlanejamentosParaPrevisao(p); setShowPrevisaoModal(true); }} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={clearDayOrder} onToggleModoOrdenacao={toggleModoOrdenacao} />;
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
              {selectedActivities.size > 0 && (
                <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-sm font-medium text-indigo-700">✅ {selectedActivities.size} selecionada{selectedActivities.size > 1 ? 's' : ''} — arraste para replanejar</span>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100">Limpar</Button>
                </div>
              )}
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
            const up = userProfile?.usuarios_permitidos_visualizar || [];
            const tp = Array.isArray(up) && up.length > 0;
            if ((isGestao || isColaborador || isApoio) && !tp && key === 'user') return;
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