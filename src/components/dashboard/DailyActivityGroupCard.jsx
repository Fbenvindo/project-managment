import React from 'react';
import { User, LineChart, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DailyActivityGroupCard({
  groupStatus,
  statusColor,
  isDragging,
  isExpanded,
  onToggle,
  empreendimentoNome,
  executorNome,
  totalHoras,
  atividades,
  disciplineColors,
  onShowPrevisao,
  canDragGroup
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        borderLeft: `6px solid ${statusColor}`,
        backgroundColor: isDragging ? '#e0e7ff' :
          groupStatus === 'concluido_com_atraso' ? '#fff1f2' :
          groupStatus === 'atrasado' ? '#fff1f2' :
            groupStatus === 'impactado_por_atraso' ? '#f8fafc' :
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
      <div className="flex items-center justify-between gap-2">
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
              className="px-1.5 py-0.5 rounded text-xs font-bold text-white flex items-center gap-1"
              style={{ backgroundColor: statusColor }}
            >
              {totalHoras > 0 ? `${totalHoras}h` : '0h'}
              {(groupStatus === 'concluido' || groupStatus === 'concluido_com_atraso') && (
                <Check className="w-3 h-3" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{atividades.length} ativ.</p>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
    </div>
  );
}