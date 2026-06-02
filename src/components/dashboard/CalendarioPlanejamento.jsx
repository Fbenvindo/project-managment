// @ts-nocheck
import React, { useState, useMemo, useEffect, useContext, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Filter, Trash2, CalendarDays, RefreshCw, Users, ListOrdered } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addWeeks, subWeeks, addDays, subDays, startOfDay, isValid, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import PrevisaoEntregaModal from './PrevisaoEntregaModal';
import { PlanejamentoAtividade, Atividade, Documento, Empreendimento, Execucao, PlanejamentoDocumento } from '@/entities/all';
import { ChevronsUpDown } from 'lucide-react';
import { isActivityOverdue as isOverdueShared, distribuirHorasPorDias, getNextWorkingDay } from '../utils/DateCalculator';
import { retryWithBackoff } from '../utils/apiUtils';
import ActivityItemCalendar from './ActivityItemCalendar';
import DailyActivityGroup from './DailyActivityGroup';
const ActivityItem = (p) => <ActivityItemCalendar {...p} />;

// Função para converter string de data para Date local corretamente
const parseLocalDate = (dateString) => {
  if (!dateString) return null;

  if (dateString instanceof Date) {
    return dateString;
  }

  if (typeof dateString === 'string') {
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    try {
      const parsedDate = parseISO(dateString);
      if (!isNaN(parsedDate.getTime())) {
        const localDate = new Date(parsedDate.getTime() + parsedDate.getTimezoneOffset() * 60000);
        return localDate;
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

  let foiReplanejadaParaIniciarMaisTarde = false;
  if (plano.inicio_ajustado && plano.inicio_planejado) {
    try {
      const ajustado = startOfDay(parseISO(plano.inicio_ajustado));
      const planejado = startOfDay(parseISO(plano.inicio_planejado));
      if (isValid(ajustado) && isValid(planejado) && isAfter(ajustado, planejado)) {
        foiReplanejadaParaIniciarMaisTarde = true;
      }
    } catch (e) {}
  }

  let predecessoraAtrasada = false;
  if (plano.predecessora_id) {
    const predecessora = allPlanejamentos.find(p => normalizeActivityId(p.id) === normalizeActivityId(plano.predecessora_id));
    if (predecessora && isActivityOverdue(predecessora)) predecessoraAtrasada = true;
  }

  if (foiReplanejadaParaIniciarMaisTarde || predecessoraAtrasada) return 'impactado_por_atraso';

  let wasReplannedLaterTermino = false;
  if (plano.termino_ajustado && plano.termino_planejado) {
    try {
      const ajustado = startOfDay(parseISO(plano.termino_ajustado));
      const planejado = startOfDay(parseISO(plano.termino_planejado));
      if (isValid(ajustado) && isValid(planejado) && isAfter(ajustado, planejado)) {
        wasReplannedLaterTermino = true;
      }
    } catch (e) {}
  }

  if (wasReplannedLaterTermino) return 'replanejado_atrasado';

  return plano.status || 'nao_iniciado';
};

// --- Sub-componente de Filtros ---
const CalendarFilters = ({
  users, disciplines, viewMode, onViewModeChange, filters, onFilterChange,
  onClearFilters, hasSelectedUser, isColaborador, isViewingAllUsers, isGestao,
  isApoio, podeVerOutros, usuariosPermitidos, currentUserEmail, viewType
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
                  if (podeVerOutros && Array.isArray(usuariosPermitidos)) return usuariosPermitidos.includes(u.email);
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


// --- ActivityContainer ---
const ActivityContainer = ({ activities, containerClass = "", disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder, activityOrder, activityStatusMap }) => {
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
    if (newExpanded.has(groupKey)) newExpanded.delete(groupKey);
    else newExpanded.add(groupKey);
    setExpandedGroups(newExpanded);
  };

  if (viewType === 'analitico') {
    const activitiesParaRenderizar = activities.filter(atividade => {
      const horasAlocadas = Number(atividade.horas_por_dia?.[dayKey]) || 0;
      const horasExecutadas = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
      const tempoExecutado = Number(atividade.tempo_executado) || 0;

      if (atividade.isLegacyExecution) return tempoExecutado >= 0.05;
      if (atividade.isQuickActivity || atividade.is_quick_activity) {
        return horasExecutadas >= 0.05 || horasAlocadas >= 0.05 || atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso' || atividade.status === 'em_andamento';
      }
      return horasAlocadas >= 0.05 || horasExecutadas >= 0.05 ||
        ((atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso') && !atividade.atividade_id) ||
        atividade._isExtended || atividade._isPushed;
    });

    const temOrdemCustomizada = !!(activities.length > 0 && activityOrder?.[dayKey]);

    return (
      <div className={`space-y-1 ${containerClass}`}>
        {modoOrdenacao && temOrdemCustomizada && (
          <div className="flex justify-end mb-1">
            <button
              onClick={() => onClearDayOrder && onClearDayOrder(dayKey)}
              className="text-xs text-amber-600 hover:text-amber-800 underline"
            >
              Restaurar ordem padrão
            </button>
          </div>
        )}
        {activitiesParaRenderizar.map((atividade, index) => (
          <Draggable
            key={`${atividade.id}-${dayKey}`}
            draggableId={`${atividade.id}-${dayKey}`}
            index={index}
            isDragDisabled={
              modoOrdenacao
                ? (atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso')
                : (!canReprogram || atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso' || atividade.isLegacyExecution || normalizeActivityId(isReprogramando) === normalizeActivityId(atividade.id))
            }
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
                isReprogramando={normalizeActivityId(isReprogramando) === normalizeActivityId(atividade.id)}
                isSelected={selectedActivities.has(normalizeActivityId(atividade.id))}
                onToggleSelect={onToggleSelect}
                hasSelections={hasSelections}
                orderIndex={index}
                realStatusOverride={activityStatusMap?.get(normalizeActivityId(atividade.id))}
              />
            )}
          </Draggable>
        ))}
      </div>
    );
  }

  const groupsComHoras = Object.entries(activityGroups).filter(([groupKey, groupData]) => {
    return groupData.atividades.some(atividade => {
      const horasAlocadas = Number(atividade.horas_por_dia?.[dayKey]) || 0;
      const horasExecutadas = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
      const tempoExecutado = Number(atividade.tempo_executado) || 0;
      if (atividade.isLegacyExecution) return tempoExecutado >= 0.05;
      if (atividade.isQuickActivity || atividade.is_quick_activity) {
        return horasExecutadas >= 0.05 || horasAlocadas >= 0.05 || atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso' || atividade.status === 'em_andamento';
      }
      return horasAlocadas >= 0.05 || horasExecutadas >= 0.05 || atividade._isExtended || atividade._isPushed;
    });
  });

  return (
    <div className={`space-y-1 ${containerClass}`}>
      {groupsComHoras.map(([groupKey, groupData]) => {
        const atividadesComHoras = groupData.atividades.filter(atividade => {
          const horasAlocadas = Number(atividade.horas_por_dia?.[dayKey]) || 0;
          const horasExecutadas = Number(atividade.horas_executadas_por_dia?.[dayKey]) || 0;
          const tempoExecutado = Number(atividade.tempo_executado) || 0;
          if (atividade.isLegacyExecution) return tempoExecutado >= 0.05;
          if (atividade.isQuickActivity || atividade.is_quick_activity) {
            return horasExecutadas >= 0.05 || horasAlocadas >= 0.05 || atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso' || atividade.status === 'em_andamento';
          }
          return horasAlocadas >= 0.05 || horasExecutadas >= 0.05 || atividade._isExtended || atividade._isPushed;
        });

        if (atividadesComHoras.length === 0) return null;

        const groupDataFiltrado = { ...groupData, atividades: atividadesComHoras };

        const canDragGroup = canReprogram &&
          groupDataFiltrado.empreendimento?.nome !== 'Atividades Rápidas' &&
          !groupDataFiltrado.atividades.some(a => a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.isLegacyExecution);

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
                  empreendimento={groupDataFiltrado.empreendimento}
                  executor={groupDataFiltrado.executor}
                  atividades={groupDataFiltrado.atividades}
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
              empreendimento={groupDataFiltrado.empreendimento}
              executor={groupDataFiltrado.executor}
              atividades={groupDataFiltrado.atividades}
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

// --- DayCell ---
const DayCell = ({ day, dayActivities, date, isToday, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, activityStatusMap }) => {
  const dayKey = format(day, 'yyyy-MM-dd');

  const hasMovableActivities = dayActivities.some(a =>
    !a.isLegacyExecution &&
    a.status !== 'concluido' && a.status !== 'concluido_com_atraso'
  );

  const canDragDay = canReprogram && hasMovableActivities && dayActivities.length > 0;

  return (
    <Droppable droppableId={dayKey}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`h-40 p-2 border border-gray-100 flex flex-col group ${
            isSameMonth(day, date) ? 'bg-white' : 'bg-gray-50'
          } ${isToday ? 'border-2 border-blue-500 bg-blue-50' : ''}
          ${snapshot.isDraggingOver ? 'bg-purple-100' : ''}`}
        >
          <div className="flex items-center justify-between mb-2 relative">
            {canDragDay && (
              <Draggable draggableId={`day-${dayKey}`} index={0} isDragDisabled={!canDragDay}>
                {(dayProvided, daySnapshot) => (
                  <div
                    ref={dayProvided.innerRef}
                    {...dayProvided.draggableProps}
                    className={`absolute top-0 left-0 right-0 z-20 ${daySnapshot.isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                  >
                    <div
                      {...dayProvided.dragHandleProps}
                      className={`flex items-center justify-center gap-2 p-1 rounded-b cursor-move ${daySnapshot.isDragging ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}
                      title="🖐️ Arrastar todas as atividades deste dia"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                      </svg>
                      <span className="text-xs font-bold">{dayActivities.length} ativ.</span>
                    </div>
                    {daySnapshot.isDragging && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-30">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm font-bold">Movendo {dayActivities.length} atividade{dayActivities.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="text-xs opacity-90 mt-1">De {format(day, 'd MMM', { locale: ptBR })}</div>
                      </div>
                    )}
                  </div>
                )}
              </Draggable>
            )}
            <span className={`font-semibold text-center flex-1 ${isSameMonth(day, date) ? 'text-gray-800' : 'text-gray-400'} ${isToday ? 'text-blue-700' : ''}`}>
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
              viewType={viewType}
              activityStatusMap={activityStatusMap}
            />
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
};

// --- MonthView ---
const MonthView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder, activityOrder, activityStatusMap }) => {
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
            viewType={viewType}
            activityStatusMap={activityStatusMap}
          />
        );
      })}
    </div>
  );
};

// --- WeekView ---
const WeekView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder, onToggleModoOrdenacao, activityOrder, activityStatusMap }) => {
  const [expandedDay, setExpandedDay] = useState(null);

  const weekDays = useMemo(() => {
    const start = startOfWeek(date, { locale: ptBR });
    const end = endOfWeek(date, { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [date]);

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
                <div
                  className={`flex flex-col p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 sticky top-0 z-10 ${isToday ? 'bg-blue-50' : 'bg-gray-50/50'}`}
                  onClick={() => toggleExpand(dayKey)}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700 capitalize">{format(day, 'EEE, d', { locale: ptBR })}</h3>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleModoOrdenacao && onToggleModoOrdenacao()}
                        className={`p-0.5 rounded transition-colors ${modoOrdenacao ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'}`}
                        title={modoOrdenacao ? "Sair da ordenação" : "Organizar ordem de execução"}
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                      </button>
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
                            if (ativ.isLegacyExecution) horasDia = tempoExecutado;
                            else if (ativ.isQuickActivity || ativ.is_quick_activity) horasDia = horasExecutadas > 0 ? horasExecutadas : horasAlocadas;
                            else if (horasExecutadas > 0) horasDia = horasExecutadas;
                            else if (ativ.status === 'concluido' && tempoExecutado > 0 && Object.keys(ativ.horas_executadas_por_dia || {}).length === 0) {
                              const diasPlanejados = Object.keys(ativ.horas_por_dia || {});
                              horasDia = diasPlanejados.length > 0 && diasPlanejados.includes(dayKey) ? tempoExecutado / diasPlanejados.length : 0;
                            } else horasDia = horasAlocadas;
                            total += horasDia;
                          });
                          return `${formatHours(total)}h`;
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-grow overflow-y-auto p-2">
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
                    viewType={viewType}
                    modoOrdenacao={modoOrdenacao}
                    onClearDayOrder={onClearDayOrder}
                    activityOrder={activityOrder}
                    activityStatusMap={activityStatusMap}
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

// --- DayView ---
const DayView = ({ date, activitiesByDay, disciplinas, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, viewType, modoOrdenacao, onClearDayOrder, onToggleModoOrdenacao, activityOrder, activityStatusMap }) => {
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
          <div className="flex items-center justify-center gap-3 mb-6">
            <h2 className="text-2xl font-bold capitalize">{format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</h2>
            <button
              onClick={() => onToggleModoOrdenacao && onToggleModoOrdenacao()}
              className={`p-1 rounded transition-colors ${modoOrdenacao ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'}`}
              title={modoOrdenacao ? "Sair da ordenação" : "Organizar ordem de execução"}
            >
              <ListOrdered className="w-5 h-5" />
            </button>
          </div>
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
                viewType={viewType}
                modoOrdenacao={modoOrdenacao}
                onClearDayOrder={onClearDayOrder}
                activityOrder={activityOrder}
                activityStatusMap={activityStatusMap}
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
    if (user?.email && !filters.user) {
      setFilters(prev => ({ ...prev, user: user.email }));
    }
  }, [user?.email, filters.user]);

  const effectiveUsuarios = (allUsers && allUsers.length > 0) ? allUsers : (usuarios || []);

  const executorMap = useMemo(() => {
    return effectiveUsuarios.reduce((acc, u) => {
      if (u.email) acc[u.email] = u;
      return acc;
    }, {});
  }, [effectiveUsuarios]);

  const [selectedActivities, setSelectedActivities] = useState(new Set());
  const [modoOrdenacao, setModoOrdenacao] = useState(false);

  const getStorageKey = useCallback((userEmail) => {
    return `calendar-activity-order-${userEmail || 'default'}`;
  }, []);

  const [activityOrder, setActivityOrder] = useState({});

  useEffect(() => {
    if (!filters.user) {
      setActivityOrder({});
      return;
    }
    const storageKey = getStorageKey(filters.user);
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      setActivityOrder(stored);
    } catch {
      setActivityOrder({});
    }
  }, [filters.user, getStorageKey]);

  const clearDayOrder = useCallback((dayKey) => {
    const storageKey = getStorageKey(filters.user);
    setActivityOrder(prev => {
      const updated = { ...prev };
      delete updated[dayKey];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    const dayActivities = enrichedData.filter(p =>
      !p.isLegacyExecution && p.horas_por_dia?.[dayKey] >= 0.05
    );
    dayActivities.forEach(plano => {
      const entity = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      const ordemAtual = (typeof plano.ordem_por_dia === 'object' && plano.ordem_por_dia) ? { ...plano.ordem_por_dia } : {};
      delete ordemAtual[dayKey];
      entity.update(plano.id, { ordem_por_dia: ordemAtual }).catch(() => {});
    });
  }, [filters.user, getStorageKey, enrichedData]);

  const toggleModoOrdenacao = useCallback(() => {
    setModoOrdenacao(prev => {
      if (!prev && viewType !== 'analitico') setViewType('analitico');
      return !prev;
    });
  }, [viewType]);

  const loadCalendarData = useCallback(async (userFilter) => {
    if (!userFilter) {
      setEnrichedData([]);
      return;
    }
    const storageKey = `calendar-activity-order-${userFilter}`;

    // FIX 1: Limpar imediatamente ao trocar usuário para não exibir dados do usuário
    // anterior enquanto o novo carregamento está em andamento.
    setEnrichedData([]);
    setActivityOrder({});
    setIsCalendarLoading(true);

    try {
      const execFilter = userFilter !== 'all' ? { usuario: userFilter } : {};

      const fetchPlanos = async (Entity, tag) => {
        if (userFilter === 'all') return retryWithBackoff(() => Entity.list(), 3, 1500, tag);
        const [byPrincipal, allList] = await Promise.all([
          retryWithBackoff(() => Entity.filter({ executor_principal: userFilter }), 3, 1500, tag+'p').catch(() => []),
          retryWithBackoff(() => Entity.list(), 3, 1500, tag+'l').catch(() => []),
        ]);
        const m = new Map((byPrincipal||[]).map(p=>[p.id,p]));
        // FIX 3: Só incluir atividades onde o usuário é executor secundário
        // se ele realmente tem horas alocadas (horas_por_dia >= 0.05h).
        // Evita "atividades fantasma" ao trocar de usuário.
        (allList||[])
          .filter(p => {
            if (!Array.isArray(p.executores) || !p.executores.includes(userFilter)) return false;
            if (m.has(p.id)) return false;
            if (p.horas_por_dia && typeof p.horas_por_dia === 'object') {
              return Object.values(p.horas_por_dia).some(h => Number(h) >= 0.05);
            }
            return true;
          })
          .forEach(p => { if(!m.has(p.id)) m.set(p.id,p); });
        return Array.from(m.values());
      };

      const [planosAtividade, planosDocumento, execs] = await Promise.all([
        fetchPlanos(PlanejamentoAtividade,'ca'),
        fetchPlanos(PlanejamentoDocumento,'cd'),
        retryWithBackoff(()=>Execucao.filter(execFilter),3,1500,'cal.exec'),
      ]);

      const planosAtividadeComTipo = (planosAtividade || []).map(p => ({ ...p, tipo_planejamento: 'atividade' }));
      const planosDocumentoComTipo = (planosDocumento || []).map(p => ({ ...p, tipo_planejamento: 'documento' }));
      const todosPlanejamentos = [...planosAtividadeComTipo, ...planosDocumentoComTipo];
      const empreendimentoIds = [...new Set(todosPlanejamentos.map(p => p.empreendimento_id).filter(Boolean))];
      const atividadeIds = [...new Set(todosPlanejamentos.map(p => p.atividade_id).filter(Boolean))];
      const documentoIdsArray = [...new Set(todosPlanejamentos.map(p => p.documento_id).filter(Boolean).map(String))];

      const [empreendimentosData, atividadesData, documentosData] = await Promise.all([
        empreendimentoIds.length > 0 ? retryWithBackoff(() => Empreendimento.filter({ id: { $in: empreendimentoIds } }), 3, 1000, 'enr.emp') : Promise.resolve([]),
        atividadeIds.length > 0 ? retryWithBackoff(() => Atividade.filter({ id: { $in: atividadeIds } }), 3, 1000, 'enr.ativ') : Promise.resolve([]),
        documentoIdsArray.length > 0 ? retryWithBackoff(() => Documento.filter({ id: { $in: documentoIdsArray } }), 3, 1000, 'enr.docs') : Promise.resolve([]),
      ]);

      const empreendimentosMap = new Map((empreendimentosData || []).map(item => [String(item.id), item]));
      const atividadesMap = new Map((atividadesData || []).map(item => [String(item.id), item]));
      const documentosMap = new Map((documentosData || []).map(item => [String(item.id), item]));

      const horasExecutadasPorPlanejamento = {};
      const observacaoPorPlanejamento = {};
      (execs || []).forEach(exec => {
        if (!exec.planejamento_id || !exec.inicio) return;
        const diaExec = format(parseLocalDate(exec.inicio), 'yyyy-MM-dd');
        const tempoExec = Number(exec.tempo_total) || 0;
        if (!horasExecutadasPorPlanejamento[exec.planejamento_id]) horasExecutadasPorPlanejamento[exec.planejamento_id] = {};
        horasExecutadasPorPlanejamento[exec.planejamento_id][diaExec] = (horasExecutadasPorPlanejamento[exec.planejamento_id][diaExec] || 0) + tempoExec;
        if (exec.observacao) observacaoPorPlanejamento[exec.planejamento_id] = exec.observacao;
      });

      const atividadesVirtuais = (execs || []).filter(exec => !exec.planejamento_id).map(exec => {
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
            const parts = []; if (numero) parts.push(numero); if (arquivo) parts.push(arquivo);
            documentoEnriquecido.numero_completo = parts.length ? parts.join(' - ') : (doc.titulo || doc.arquivo || null);
          }
          const storedHoras = (typeof plano.horas_executadas_por_dia === 'object' && plano.horas_executadas_por_dia) ? plano.horas_executadas_por_dia : {};
          const mergedHorasExec = Object.assign({}, storedHoras, horasExec);
          const observacaoExec = observacaoPorPlanejamento[plano.id] || null;
          return { ...plano, empreendimento: empreendimentosMap.get(String(plano.empreendimento_id)) || null, atividade: atividadesMap.get(String(plano.atividade_id)) || null, documento: documentoEnriquecido, horas_executadas_por_dia: mergedHorasExec, observacao: observacaoExec };
        }),
        ...atividadesVirtuais
      ];

      setEnrichedData(finalData);

      const orderByDay = {};
      finalData.forEach(plano => {
        if (plano.isLegacyExecution) return;
        if (plano.ordem_por_dia && typeof plano.ordem_por_dia === 'object') {
          Object.entries(plano.ordem_por_dia).forEach(([dayKey, ordemDia]) => {
            const ord = Number(ordemDia);
            if (ord < 1) return;
            if (!orderByDay[dayKey]) orderByDay[dayKey] = [];
            if (!orderByDay[dayKey].some(x => x.id === String(plano.id))) {
              orderByDay[dayKey].push({ id: String(plano.id), ordem: ord });
            }
          });
        } else if (plano.ordem && Number(plano.ordem) >= 1) {
          const diasSet = Object.keys(plano.horas_por_dia || {})
            .filter(d => Number(plano.horas_por_dia[d]) >= 0.05)
            .sort();
          if (diasSet.length > 0) {
            const primeirodia = diasSet[0];
            if (!orderByDay[primeirodia]) orderByDay[primeirodia] = [];
            if (!orderByDay[primeirodia].some(x => x.id === String(plano.id))) {
              orderByDay[primeirodia].push({ id: String(plano.id), ordem: Number(plano.ordem) });
            }
          }
        }
      });

      const newActivityOrder = {};
      for (const dayKey in orderByDay) {
        newActivityOrder[dayKey] = orderByDay[dayKey]
          .sort((a, b) => a.ordem - b.ordem)
          .map(x => x.id);
      }
      localStorage.setItem(storageKey, JSON.stringify(newActivityOrder));
      setActivityOrder(newActivityOrder);

    } catch (error) {
      setEnrichedData([]);
      alert("Erro ao carregar as atividades do calendário. Tente atualizar a página.");
    } finally {
      setIsCalendarLoading(false);
    }
  }, []);

  // FIX 2: Resetar estados do usuário anterior ANTES de iniciar o fetch do novo.
  // Sem isso há uma janela onde enrichedData = usuário A mas filters.user = B,
  // fazendo atividades do A aparecerem no calendário do B (ou sumirem do A).
  useEffect(() => {
    if (filters.user) {
      setEnrichedData([]);
      setActivityOrder({});
      setSelectedActivities(new Set());
      loadCalendarData(filters.user);
    } else {
      setEnrichedData([]);
      setActivityOrder({});
      setSelectedActivities(new Set());
      setIsCalendarLoading(false);
    }
  }, [filters.user]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevUpdateKeyRef = useRef(updateKey);
  useEffect(() => {
    if (updateKey === prevUpdateKeyRef.current) return;
    prevUpdateKeyRef.current = updateKey;
    if (!filters.user) return;
    const timer = setTimeout(() => { loadCalendarData(filters.user); }, 3000);
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
    if (update?.id) {
      setEnrichedData(prev => prev.map(item =>
        item.id === update.id ? { ...item, ...update } : item
      ));
    }
    if (hasSelectedUser) loadCalendarData(filters.user);
  }, [hasSelectedUser, filters.user, loadCalendarData]);

  const toggleActivitySelection = useCallback((activityId) => {
    const normalizedActivityId = normalizeActivityId(activityId);
    setSelectedActivities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(normalizedActivityId)) newSet.delete(normalizedActivityId);
      else newSet.add(normalizedActivityId);
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedActivities(new Set()), []);

  const handleReprogramarAtividade = useCallback(async (atividadeId, novaDataInicio, executorEmail) => {
    const normalizedActivityId = normalizeActivityId(atividadeId);
    setIsReprogramando(normalizedActivityId);
    try {
      const atividadeParaMover = (enrichedData || []).find(p => normalizeActivityId(p.id) === normalizedActivityId);
      if (!atividadeParaMover) throw new Error("Atividade não encontrada.");
      if (atividadeParaMover.isLegacyExecution) throw new Error("Execuções antigas não podem ser reprogramadas.");
      if (atividadeParaMover.status === 'concluido' || atividadeParaMover.status === 'concluido_com_atraso') throw new Error("Atividades concluídas não podem ser reprogramadas.");
      const entidadePlanejamento = atividadeParaMover.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      // Buscar carga de AMBAS as entidades para não ignorar atividades do outro tipo
      const [planosAtivExec, planosDocExec] = await Promise.all([
        retryWithBackoff(() => PlanejamentoAtividade.filter({ executor_principal: executorEmail }), 3, 1000, 'reprogram.a').catch(() => []),
        retryWithBackoff(() => PlanejamentoDocumento.filter({ executor_principal: executorEmail }), 3, 1000, 'reprogram.d').catch(() => []),
      ]);
      const planejamentosDoExecutor = [...(planosAtivExec || []), ...(planosDocExec || [])].filter(p => p.status !== 'concluido' && !p.isLegacyExecution);
      const cargaDiariaExistente = {};
      planejamentosDoExecutor.forEach(p => {
        if (normalizeActivityId(p.id) !== normalizedActivityId && p.horas_por_dia) {
          Object.entries(p.horas_por_dia).forEach(([data, horas]) => { cargaDiariaExistente[data] = (cargaDiariaExistente[data] || 0) + Number(horas || 0); });
        }
      });
      const { distribuicao, dataTermino } = distribuirHorasPorDias(parseLocalDate(novaDataInicio), atividadeParaMover.tempo_planejado, 8, cargaDiariaExistente);
      if (Object.keys(distribuicao).length === 0) throw new Error("Não foi possível alocar horas para a nova data.");
      const inicioPlanejado = Object.keys(distribuicao).sort()[0];
      const terminoPlanejado = dataTermino ? format(dataTermino, 'yyyy-MM-dd') : inicioPlanejado;
      await retryWithBackoff(() => entidadePlanejamento.update(atividadeParaMover.id, { inicio_planejado: inicioPlanejado, termino_planejado: terminoPlanejado, horas_por_dia: distribuicao }), 3, 1500, 'reprogram');
      if (hasSelectedUser) loadCalendarData(filters.user);
      if (triggerUpdate) triggerUpdate();
    } catch (error) {
      alert(`Erro ao reprogramar: ${error.message}`);
      throw error;
    } finally {
      setIsReprogramando(null);
    }
  }, [enrichedData, triggerUpdate, hasSelectedUser, filters.user, loadCalendarData]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const extractRealId = (dId, dKey) => {
      const suffix = `-${dKey}`;
      return dId.endsWith(suffix) ? dId.slice(0, -suffix.length) : dId;
    };
    if (destination.droppableId === source.droppableId) {
      if (!modoOrdenacao) return;
      const dayKey = source.droppableId;
      const dayActivities = activitiesByDay[dayKey] || [];
      const activitiesDesteDir = dayActivities.filter(a => {
        const horasAlocadas = Number(a.horas_por_dia?.[dayKey]) || 0;
        const horasExecutadas = Number(a.horas_executadas_por_dia?.[dayKey]) || 0;
        const tempoExecutado = Number(a.tempo_executado) || 0;
        if (a.isLegacyExecution) return tempoExecutado >= 0.05;
        if (a.isQuickActivity || a.is_quick_activity) {
          return horasExecutadas >= 0.05 || horasAlocadas >= 0.05 || a.status === 'concluido' || a.status === 'concluido_com_atraso' || a.status === 'em_andamento';
        }
        return horasAlocadas >= 0.05 || horasExecutadas >= 0.05 ||
          ((a.status === 'concluido' || a.status === 'concluido_com_atraso') && !a.atividade_id) ||
          a._isExtended || a._isPushed;
      });
      const reorderedIds = activitiesDesteDir.map(a => String(a.id));
      const [movedId] = reorderedIds.splice(source.index, 1);
      reorderedIds.splice(destination.index, 0, movedId);
      const newOrder = { ...activityOrder, [dayKey]: reorderedIds };
      const storageKey = getStorageKey(filters.user);
      localStorage.setItem(storageKey, JSON.stringify(newOrder));
      setActivityOrder(newOrder);
      reorderedIds.forEach((id, idx) => {
        const plano = dayActivities.find(a => String(a.id) === id);
        if (!plano || plano.isLegacyExecution) return;
        const entity = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
        const ordemPorDiaAtual = (typeof plano.ordem_por_dia === 'object' && plano.ordem_por_dia) ? { ...plano.ordem_por_dia } : {};
        ordemPorDiaAtual[dayKey] = idx + 1;
        entity.update(id, { ordem_por_dia: ordemPorDiaAtual }).catch(() => {});
      });
      return;
    }
    if (modoOrdenacao) return;
    if (!hasPermission('admin')) { alert("Você não tem permissão para replanejar atividades."); return; }
    const isDayDrag = draggableId.startsWith('day-');
    if (isDayDrag) {
      const sourceDayKey = draggableId.replace('day-', '');
      const dayActivities = activitiesByDay[sourceDayKey] || [];
      const movableActivities = dayActivities.filter(a => !a.isLegacyExecution && a.status !== 'concluido' && a.status !== 'concluido_com_atraso');
      if (movableActivities.length === 0) { alert("Nenhuma atividade pode ser movida."); return; }
      if (!window.confirm(`Mover ${movableActivities.length} atividade(s) de ${format(parseISO(sourceDayKey), 'd MMM', { locale: ptBR })} para ${format(parseISO(destination.droppableId), 'd MMM', { locale: ptBR })}?`)) return;
      (async () => {
        let ok = 0, err = 0;
        for (let i = 0; i < movableActivities.length; i++) {
          try { await handleReprogramarAtividade(movableActivities[i].id, destination.droppableId, movableActivities[i].executor_principal); ok++; if (i < movableActivities.length - 1) await new Promise(r => setTimeout(r, 500)); } catch { err++; }
        }
        if (ok > 0) { alert(`✅ ${ok} atividade(s) reprogramadas!${err > 0 ? `\n⚠️ ${err} falharam` : ''}`); clearSelection(); } else alert('❌ Nenhuma atividade pôde ser movida.');
      })();
      return;
    }
    const isGroupDrag = draggableId.startsWith('group-');
    if (isGroupDrag) {
      const parts = draggableId.replace('group-', '').split('-');
      const sourceDayKey = parts.pop();
      const groupKey = parts.join('-');
      const allActivitiesInSourceDay = (activitiesByDay[source.droppableId] || []);
      let groupActivities = [];
      if (groupKey.startsWith('virtual-')) groupActivities = allActivitiesInSourceDay.filter(a => a.isLegacyExecution && a.executor_principal === groupKey.replace('virtual-', ''));
      else if (groupKey.startsWith('geral-')) groupActivities = allActivitiesInSourceDay.filter(a => !a.empreendimento_id && a.executor_principal === groupKey.replace('geral-', '') && !a.isLegacyExecution);
      else { const [empId, executorEmail] = groupKey.split('|'); groupActivities = allActivitiesInSourceDay.filter(a => a.empreendimento_id === empId && a.executor_principal === executorEmail && !a.isLegacyExecution); }
      if (groupActivities.some(a => a.isLegacyExecution || a.status === 'concluido' || a.status === 'concluido_com_atraso')) { alert("Algumas atividades do grupo não podem ser reprogramadas."); return; }
      (async () => {
        let ok = 0, err = 0;
        for (const a of groupActivities) { try { await handleReprogramarAtividade(a.id, destination.droppableId, a.executor_principal); ok++; await new Promise(r => setTimeout(r, 500)); } catch { err++; } }
        if (ok > 0) { alert(`✅ ${ok} atividade(s) reprogramadas!${err > 0 ? `\n⚠️ ${err} falharam` : ''}`); clearSelection(); } else alert('❌ Erro ao mover atividades do grupo.');
      })();
      return;
    }
    const realDraggableId = extractRealId(draggableId, source.droppableId);
    const activitiesToMove = selectedActivities.has(realDraggableId) && selectedActivities.size > 1 ? Array.from(selectedActivities) : [realDraggableId];
    if (activitiesToMove.some(id => { const a = (enrichedData || []).find(p => normalizeActivityId(p.id) === normalizeActivityId(id)); return !a || a.isLegacyExecution || a.status === 'concluido' || a.status === 'concluido_com_atraso'; })) { alert("Algumas atividades não podem ser reprogramadas."); return; }
    (async () => {
      let ok = 0, err = 0;
      for (const activityId of activitiesToMove) {
        const atividadeMovida = (enrichedData || []).find(p => normalizeActivityId(p.id) === normalizeActivityId(activityId));
        if (!atividadeMovida) continue;
        try { await handleReprogramarAtividade(activityId, destination.droppableId, atividadeMovida.executor_principal); ok++; await new Promise(r => setTimeout(r, 500)); } catch { err++; }
      }
      if (ok > 0) { alert(`✅ ${ok} atividade(s) reprogramadas!${err > 0 ? `\n⚠️ ${err} falharam` : ''}`); clearSelection(); } else alert('❌ Erro ao mover atividades.');
    })();
  };

  const filteredPlanejamentos = useMemo(() => {
    if (!hasSelectedUser) return [];
    const base = enrichedData || [];
    if (filters.discipline !== 'all') {
      return base.filter(item => {
        if (item.tipo_planejamento === 'documento' && item.atividade_id === null) {
          return !!(item.documento?.subdisciplinas && item.documento.subdisciplinas.includes(filters.discipline));
        }
        return item.atividade?.disciplina === filters.discipline;
      });
    }
    return base;
  }, [enrichedData, filters.discipline, hasSelectedUser]);

  const activityStatusMap = useMemo(() => {
    const statusMap = new Map();
    const planMap = new Map(filteredPlanejamentos.map(p => [normalizeActivityId(p.id), p]));
    filteredPlanejamentos.forEach(plano => {
      const id = normalizeActivityId(plano.id);
      if (plano.isLegacyExecution) { statusMap.set(id, plano.status); return; }
      if (plano.status === 'concluido_com_atraso') { statusMap.set(id, 'concluido_com_atraso'); return; }
      if (plano.status === 'concluido') { statusMap.set(id, 'concluido'); return; }
      if (plano.status === 'atrasado' || isActivityOverdue(plano)) { statusMap.set(id, 'atrasado'); return; }
      let replanejadoTarde = false;
      try { if (plano.inicio_ajustado && plano.inicio_planejado) { const a = startOfDay(parseISO(plano.inicio_ajustado)), p = startOfDay(parseISO(plano.inicio_planejado)); if (isValid(a) && isValid(p) && isAfter(a, p)) replanejadoTarde = true; } } catch (_) {}
      const pred = plano.predecessora_id ? planMap.get(normalizeActivityId(plano.predecessora_id)) : null;
      if (replanejadoTarde || (pred && isActivityOverdue(pred))) { statusMap.set(id, 'impactado_por_atraso'); return; }
      let terminoAtrasado = false;
      try { if (plano.termino_ajustado && plano.termino_planejado) { const a = startOfDay(parseISO(plano.termino_ajustado)), p = startOfDay(parseISO(plano.termino_planejado)); if (isValid(a) && isValid(p) && isAfter(a, p)) terminoAtrasado = true; } } catch (_) {}
      if (terminoAtrasado) { statusMap.set(id, 'replanejado_atrasado'); return; }
      statusMap.set(id, plano.status || 'nao_iniciado');
    });
    return statusMap;
  }, [filteredPlanejamentos]);

  const activitiesByDay = useMemo(() => {
    if (!hasSelectedUser) return {};

    const grouped = {};
    const processedPlanIds = new Set();
    const hojeDate = startOfDay(new Date());
    const hojeKey = format(hojeDate, 'yyyy-MM-dd');
    const recentCutoff = addDays(hojeDate, -30);

    filteredPlanejamentos.forEach(plano => {
      processedPlanIds.add(plano.id);

      const diasParaExibir = new Set();
      const isQuickActivity = plano.is_quick_activity || plano.isQuickActivity;
      let _isExtendedToToday = false;

      if (isQuickActivity) {
        let hasSignificantExecutionHours = false;
        if (plano.horas_executadas_por_dia && typeof plano.horas_executadas_por_dia === 'object') {
          Object.keys(plano.horas_executadas_por_dia).forEach(dayKey => {
            const horasExec = Number(plano.horas_executadas_por_dia[dayKey]) || 0;
            if (horasExec > 0.01) { diasParaExibir.add(dayKey); hasSignificantExecutionHours = true; }
          });
          if (!hasSignificantExecutionHours && (plano.status === 'concluido' || plano.status === 'concluido_com_atraso' || plano.status === 'em_andamento')) {
            const dias = Object.keys(plano.horas_executadas_por_dia);
            if (dias.length > 0) {
              const ultimoDia = dias.sort().pop();
              const parsedUltimo = parseLocalDate(ultimoDia);
              diasParaExibir.add((parsedUltimo && isValid(parsedUltimo)) ? format(parsedUltimo, 'yyyy-MM-dd') : ultimoDia);
              hasSignificantExecutionHours = true;
            }
          }
        }
        if (!hasSignificantExecutionHours && plano.inicio_planejado) {
          const parsedInicio = parseLocalDate(plano.inicio_planejado);
          const diaFallback = (parsedInicio && isValid(parsedInicio)) ? format(parsedInicio, 'yyyy-MM-dd') : plano.inicio_planejado;
          diasParaExibir.add(diaFallback);
        }
      } else {
        const realStatus = activityStatusMap.get(normalizeActivityId(plano.id)) || plano.status || 'nao_iniciado';
        const foiExecutada = plano.horas_executadas_por_dia &&
          typeof plano.horas_executadas_por_dia === 'object' &&
          Object.keys(plano.horas_executadas_por_dia).length > 0;

        if (realStatus === 'concluido') {
          if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') {
            Object.keys(plano.horas_por_dia).forEach(dayKey => {
              if (Number(plano.horas_por_dia[dayKey]) >= 0.05) diasParaExibir.add(dayKey);
            });
          }
          if (foiExecutada) {
            Object.keys(plano.horas_executadas_por_dia).forEach(dayKey => {
              if (Number(plano.horas_executadas_por_dia[dayKey]) >= 0.05) diasParaExibir.add(dayKey);
            });
          }
          if (diasParaExibir.size === 0) {
            const dataRef = plano.termino_real || plano.inicio_planejado;
            if (dataRef) { const parsed = parseLocalDate(dataRef); if (parsed && isValid(parsed)) diasParaExibir.add(format(parsed, 'yyyy-MM-dd')); }
          }
        } else {
          if (foiExecutada) {
            Object.keys(plano.horas_executadas_por_dia).forEach(dayKey => {
              if (Number(plano.horas_executadas_por_dia[dayKey]) >= 0.05) diasParaExibir.add(dayKey);
            });
          }
          if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') {
            Object.keys(plano.horas_por_dia).forEach(dayKey => {
              if (Number(plano.horas_por_dia[dayKey]) >= 0.05) diasParaExibir.add(dayKey);
            });
          }
          if (plano.status !== 'concluido' && plano.status !== 'concluido_com_atraso' && isActivityOverdue(plano)) {
            const terminoRef = plano.termino_ajustado || plano.termino_planejado;
            if (terminoRef) {
              const terminoDate = parseLocalDate(terminoRef);
              const jaEstaHoje = !!(plano.horas_por_dia?.[hojeKey] && Number(plano.horas_por_dia[hojeKey]) >= 0.05);
              if (terminoDate && isValid(terminoDate) && terminoDate >= recentCutoff && !jaEstaHoje) {
                diasParaExibir.add(hojeKey);
                _isExtendedToToday = true;
              }
            }
          }
        }
      }

      diasParaExibir.forEach(dayKey => {
        if (!grouped[dayKey]) grouped[dayKey] = [];
        if (!grouped[dayKey].some(item => item.id === plano.id)) {
          grouped[dayKey].push({ ...plano, isQuickActivity: !!plano.is_quick_activity, isLegacyExecution: false, _isExtended: _isExtendedToToday && dayKey === hojeKey });
        }
      });
    });

    // Passo 1: Ordem customizada como prioridade absoluta
    for (const dayKey in grouped) {
      const customOrder = activityOrder[dayKey];
      if (customOrder && customOrder.length > 0) {
        const orderMap = new Map(customOrder.map((id, i) => [String(id), i]));
        const inOrder = [], outOfOrder = [];
        grouped[dayKey].forEach(item => {
          orderMap.has(String(item.id)) ? inOrder.push(item) : outOfOrder.push(item);
        });
        inOrder.sort((a, b) => (orderMap.get(String(a.id)) ?? 9999) - (orderMap.get(String(b.id)) ?? 9999));
        grouped[dayKey] = [...inOrder, ...outOfOrder];
      }
    }

    // Passo 2: Sort automático quando não há ordem customizada
    for (const dayKey in grouped) {
      const customOrder = activityOrder[dayKey];
      if (!customOrder || customOrder.length === 0) {
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
          if (inicioA && inicioB) { if (inicioA.getTime() < inicioB.getTime()) return -1; if (inicioA.getTime() > inicioB.getTime()) return 1; }
          else if (inicioA) return -1;
          else if (inicioB) return 1;
          const nameA = a.atividade?.atividade || a.documento?.numero_completo || a.descritivo || '';
          const nameB = b.atividade?.atividade || b.documento?.numero_completo || b.descritivo || '';
          return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        });
      }
    }

    // Passo 3: Ordenar documentos por predecessora
    for (const dayKey in grouped) {
      const customOrder = activityOrder[dayKey];
      if (!customOrder || customOrder.length === 0) {
        const activities = grouped[dayKey];
        const docIndices = [], docs = [];
        activities.forEach((a, i) => {
          if (a.tipo_planejamento === 'documento') { docIndices.push(i); docs.push(a); }
        });
        if (docs.length >= 2) {
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
          const sorted = [...docs].sort((a, b) =>
            (depths.get(normalizeActivityId(a.id)) || 0) - (depths.get(normalizeActivityId(b.id)) || 0)
          );
          docIndices.forEach((pos, i) => { activities[pos] = sorted[i]; });
        }
      }
    }

    // Passo 4: Não ultrapassar 8h por dia
    for (const dayKey in grouped) {
      let cargaTotal = 0;
      const atividades = grouped[dayKey];
      atividades.forEach(a => { cargaTotal += Number(a.horas_por_dia?.[dayKey]) || 0; });
      if (cargaTotal > 8) {
        const atividadesEstendidas = atividades.filter(a => a._isExtended);
        const atividadesNormais = atividades.filter(a => !a._isExtended);
        const cargaNormal = atividadesNormais.reduce((sum, a) => sum + (Number(a.horas_por_dia?.[dayKey]) || 0), 0);
        const capacidadeDisponivelParaEstendidas = 8 - cargaNormal;
        if (atividadesEstendidas.length > 0) {
          const atividadeEstendida = atividadesEstendidas[0];
          const horasEstendida = Number(atividadeEstendida.horas_por_dia?.[dayKey]) || 0;
          if (horasEstendida > capacidadeDisponivelParaEstendidas) {
            const horasQueCabem = Math.max(0, capacidadeDisponivelParaEstendidas);
            const horasSobram = horasEstendida - horasQueCabem;
            if (horasQueCabem > 0) {
              atividadeEstendida.horas_por_dia = { ...atividadeEstendida.horas_por_dia };
              atividadeEstendida.horas_por_dia[dayKey] = horasQueCabem;
            } else {
              atividades.splice(atividades.indexOf(atividadeEstendida), 1);
            }
            if (horasSobram > 0) {
              const proximoDiaUtil = getNextWorkingDay(parseISO(dayKey));
              const proximoDiaKey = format(proximoDiaUtil, 'yyyy-MM-dd');
              if (!grouped[proximoDiaKey]) grouped[proximoDiaKey] = [];
              const atividadeSaldo = { ...atividadeEstendida, horas_por_dia: { ...atividadeEstendida.horas_por_dia, [proximoDiaKey]: horasSobram }, _isPushed: true, _isPartitioned: true };
              if (!grouped[proximoDiaKey].some(a => a.id === atividadeEstendida.id && a._isPartitioned)) {
                grouped[proximoDiaKey].push(atividadeSaldo);
              }
            }
          }
        }
      }
    }

    return grouped;
  }, [filteredPlanejamentos, hasSelectedUser, activityOrder]);

  const cargaDiariaPorUsuario = useMemo(() => {
    if (!hasSelectedUser) return {};
    const carga = {};
    filteredPlanejamentos.forEach(plano => {
      if (!plano.executor_principal) return;
      if (!carga[plano.executor_principal]) carga[plano.executor_principal] = {};
      if (plano.horas_por_dia) Object.entries(plano.horas_por_dia).forEach(([d, h]) => { carga[plano.executor_principal][d] = (carga[plano.executor_principal][d] || 0) + Number(h); });
    });
    return carga;
  }, [filteredPlanejamentos, hasSelectedUser]);

  const handleDateChange = (direction) => {
    const fns = direction === 'next' ? { month: addMonths, week: addWeeks, day: addDays } : { month: subMonths, week: subWeeks, day: subDays };
    setCurrentDate(c => fns[viewMode](c, 1));
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
      if (atividade.isLegacyExecution) horasDia = tempoExecutado;
      else if (atividade.isQuickActivity || atividade.is_quick_activity) horasDia = horasExecutadasNoDia > 0 ? horasExecutadasNoDia : horasAlocadasDia;
      else if (horasExecutadasNoDia > 0) horasDia = horasExecutadasNoDia;
      else if ((atividade.status === 'concluido' || atividade.status === 'concluido_com_atraso') && tempoExecutado > 0 && Object.keys(atividade.horas_executadas_por_dia || {}).length === 0) {
        const diasPlanejados = Object.keys(atividade.horas_por_dia || {});
        horasDia = diasPlanejados.length > 0 && diasPlanejados.includes(dayKey) ? tempoExecutado / diasPlanejados.length : 0;
      } else horasDia = horasAlocadasDia;
      soma += horasDia;
    });
    return soma;
  }, [currentDate, activitiesByDay, viewMode]);

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
    const usuariosPermitidos = userProfile?.usuarios_permitidos_visualizar || [];
    const temPermissao = Array.isArray(usuariosPermitidos) && usuariosPermitidos.length > 0;
    if ((isGestao || isColaborador || isApoio) && !temPermissao) {
      setFilters(prev => ({ ...prev, discipline: 'all' }));
      clearSelection();
      return;
    }
    setFilters({ user: '', discipline: 'all' });
    clearSelection();
  };

  const handleShowPrevisao = (planos) => {
    setPlanejamentosParaPrevisao(planos);
    setShowPrevisaoModal(true);
  };

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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-blue-700 text-sm">💡 <strong>Dica:</strong> Para ver as atividades de todos, selecione "Todos os Usuários".</p>
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
    if (viewMode === 'month') return <MonthView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={clearDayOrder} activityOrder={activityOrder} activityStatusMap={activityStatusMap} />;
    if (viewMode === 'week') return <WeekView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={clearDayOrder} onToggleModoOrdenacao={toggleModoOrdenacao} activityOrder={activityOrder} activityStatusMap={activityStatusMap} />;
    if (viewMode === 'day') return <DayView date={currentDate} activitiesByDay={activitiesByDay} disciplinas={disciplinas} onActivityDelete={handleActivityDelete} onShowPrevisao={handleShowPrevisao} executorMap={executorMap} allPlanejamentos={enrichedData} isReprogramando={isReprogramando} canReprogram={canReprogram} selectedActivities={selectedActivities} onToggleSelect={toggleActivitySelection} hasSelections={hasSelections} viewType={viewType} modoOrdenacao={modoOrdenacao} onClearDayOrder={clearDayOrder} onToggleModoOrdenacao={toggleModoOrdenacao} activityOrder={activityOrder} activityStatusMap={activityStatusMap} />;
    return null;
  };

  const refreshAll = () => {
    if (onRefresh) onRefresh();
    if (hasSelectedUser) loadCalendarData(filters.user);
  };

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
                  {viewMode === 'day' && (
                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                      {formatHours(horasDoDia)}h planejadas
                    </span>
                  )}
                </div>
              ) : 'Calendário de Planejamento'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedActivities.size > 0 ? (
                <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <span className="text-sm font-medium text-indigo-700">
                    ✅ {selectedActivities.size} selecionada{selectedActivities.size > 1 ? 's' : ''} — arraste para replanejar
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100">Limpar</Button>
                </div>
              ) : hasSelectedUser && canReprogram && null}
              {hasSelectedUser && (
                <>
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
          users={effectiveUsuarios}
          disciplines={disciplinas}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          filters={filters}
          podeVerOutros={podeVisualizarOutros}
          currentUserEmail={user?.email}
          usuariosPermitidos={usuariosPermitidos}
          viewType={viewType}
          onFilterChange={(key, value) => {
            if (key === 'viewType') { setViewType(value); return; }
            const usuariosPermitidosLocal = userProfile?.usuarios_permitidos_visualizar || [];
            const temPermissao = Array.isArray(usuariosPermitidosLocal) && usuariosPermitidosLocal.length > 0;
            if ((isGestao || isColaborador || isApoio) && !temPermissao && key === 'user') return;
            setFilters(prev => ({ ...prev, [key]: value }));
          }}
          onClearFilters={handleClearFilters}
          hasSelectedUser={hasSelectedUser}
          isColaborador={isColaborador}
          isViewingAllUsers={isViewingAllUsers}
          isGestao={isGestao}
          isApoio={isApoio}
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
          execucoes={[]}
          cargaDiaria={planejamentosParaPrevisao.length > 0 && planejamentosParaPrevisao[0].executor_principal ? cargaDiariaPorUsuario[planejamentosParaPrevisao[0].executor_principal] || {} : {}}
        />
      )}
    </>
  );
}