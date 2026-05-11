// @ts-nocheck
import React, { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronRight, LineChart, User } from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from 'framer-motion';
import { formatHours, normalizeActivityId, calculateActivityStatus } from './CalendarioUtils';

const DailyActivityGroup = ({ empreendimento, executor, atividades, isExpanded, onToggle, disciplinas, dayKey, onActivityDelete, onShowPrevisao, executorMap, allPlanejamentos, isReprogramando, canReprogram, selectedActivities, onToggleSelect, hasSelections, groupKey, provided, isDragging, ActivityItem }) => {
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
      else {
        if (horasExecutadasNoDia > 0) { horasDoDia = horasExecutadasNoDia; }
        else if (atividade.status === 'concluido' && tempoExecutado > 0 && Object.keys(atividade.horas_executadas_por_dia || {}).length === 0) {
          const diasPlanejados = Object.keys(atividade.horas_por_dia || {});
          horasDoDia = (diasPlanejados.length > 0 && diasPlanejados.includes(dayKey)) ? tempoExecutado / diasPlanejados.length : tempoExecutado;
        } else { horasDoDia = horasAlocadasDia; }
      }
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

  const canDragGroup = canReprogram &&
    empreendimentoNome !== 'Atividades Rápidas' &&
    !atividades.some(a => a.status === 'concluido' || a.isLegacyExecution);

  // Checkbox de grupo: selecionar/deselecionar todas as atividades do grupo
  const selectableIds = atividades
    .filter(a => a.status !== 'concluido' && !a.isLegacyExecution)
    .map(a => normalizeActivityId(a.id));
  const isGroupSelected = selectableIds.length > 0 && selectableIds.every(id => selectedActivities.has(id));
  const isGroupPartial = !isGroupSelected && selectableIds.some(id => selectedActivities.has(id));

  const handleGroupCheckbox = (e) => {
    e.stopPropagation();
    if (isGroupSelected) {
      selectableIds.forEach(id => { if (selectedActivities.has(id)) onToggleSelect(id); });
    } else {
      selectableIds.filter(id => !selectedActivities.has(id)).forEach(id => onToggleSelect(id));
    }
  };

  return (
    <div className="mb-1 group" ref={provided?.innerRef} {...(provided?.draggableProps || {})}>
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
        className={`p-2 rounded-lg hover:shadow-md transition-shadow duration-200 border relative ${isDragging ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-200'}`}
      >
        {/* Checkbox do grupo - canto superior direito, visível no hover ou quando há seleções */}
        {canReprogram && selectableIds.length > 0 && (
          <div className={`absolute right-1 top-1 z-20 transition-opacity ${isGroupSelected || isGroupPartial || hasSelections ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <input
              type="checkbox"
              checked={isGroupSelected}
              ref={el => { if (el) el.indeterminate = isGroupPartial; }}
              onChange={handleGroupCheckbox}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              title={isGroupSelected ? "Desselecionar todas do grupo" : "Selecionar todas do grupo"}
            />
          </div>
        )}

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
                <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              {disciplineColors.map(d => (
                <div key={d.name} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} title={d.name}></div>
              ))}
              <Button
                variant="ghost" size="icon"
                className="w-5 h-5 ml-auto text-purple-500 hover:bg-purple-100"
                onClick={(e) => { e.stopPropagation(); onShowPrevisao(atividades); }}
                title="Ver Previsão de Entrega"
              >
                <LineChart className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="font-bold text-xs truncate text-gray-800" title={empreendimentoNome}>{empreendimentoNome}</p>
            {empreendimentoNome !== 'Atividades Rápidas' && (
              <div className="flex items-center gap-1.5 mt-1">
                <User className="w-3 h-3 flex-shrink-0" />
                <p className="text-xs font-medium truncate" title={executorNome}>{executorNome}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="px-1.5 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: statusColor }}>
                {totalHoras > 0 ? `${formatHours(totalHoras)}h` : '0h'}
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
                draggableId={`${atividade.id}`}
                index={index}
                isDragDisabled={!canReprogram || atividade.status === 'concluido' || atividade.isLegacyExecution || normalizeActivityId(isReprogramando) === normalizeActivityId(atividade.id)}
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

export default DailyActivityGroup;