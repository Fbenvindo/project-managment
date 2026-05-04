import React from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, Clock, CheckCircle, XCircle } from "lucide-react";
import { statusCardStyles, statusDotStyles, statusLabels } from "./PropostaStatusBadge";

const formatCurrency = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const statusIcons = {
  aprovado: CheckCircle,
  reprovado: XCircle,
  em_analise: Clock,
  solicitado: TrendingUp,
};

export default function ResumoMensalStrip({ resumoMensal, selectedMonth, onSelectMonth }) {
  if (!resumoMensal || resumoMensal.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Month selector pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {resumoMensal.map(group => {
          const label = group.month === 'Sem Data'
            ? 'Sem Data'
            : format(parseISO(group.month + '-01'), 'MMM yyyy', { locale: ptBR });
          const isSelected = selectedMonth === group.month;
          return (
            <button
              key={group.month}
              onClick={() => onSelectMonth(group.month)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {label}
              <span className={`ml-2 text-xs ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                ({group.items.length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Status cards for selected month */}
      {resumoMensal
        .filter(g => g.month === selectedMonth)
        .map(group => (
          <div key={group.month} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['aprovado', 'reprovado', 'em_analise', 'solicitado'].map(key => {
              const s = group.byStatus?.[key] || { count: 0, bim: 0, cad: 0 };
              const Icon = statusIcons[key];
              const total = (s.bim || 0) + (s.cad || 0);
              return (
                <div key={key} className={`p-4 border rounded-xl ${statusCardStyles[key]} shadow-sm`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                      {key === 'em_analise' ? 'Ag. Aprovação' : statusLabels[key]}
                    </span>
                    <div className={`w-2.5 h-2.5 rounded-full ${statusDotStyles[key]}`} />
                  </div>
                  <div className="text-3xl font-bold">{s.count}</div>
                  <div className="text-xs opacity-60 mt-0.5">{s.count === 1 ? 'proposta' : 'propostas'}</div>
                  {total > 0 && (
                    <div className="mt-2 text-xs font-medium opacity-80">
                      R$ {formatCurrency(total)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}