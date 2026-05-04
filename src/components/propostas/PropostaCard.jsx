import React from "react";
import { format } from "date-fns";
import { Pencil, MapPin, User, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import PropostaStatusBadge, { normalizeStatus } from "./PropostaStatusBadge";

const formatCurrency = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const borderColor = {
  aprovado: '#10b981',
  reprovado: '#ef4444',
  em_analise: '#f59e0b',
  solicitado: '#9ca3af',
};

export default function PropostaCard({ proposta, isSelected, onClick, onEdit }) {
  const status = normalizeStatus(proposta.status);
  const total = (Number(proposta.valor_bim || 0) + Number(proposta.valor_cad || 0));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`border-l-4 rounded-lg p-4 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
        isSelected
          ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-200'
          : 'bg-white hover:bg-gray-50 hover:shadow-sm'
      }`}
      style={{ borderLeftColor: isSelected ? '#3b82f6' : borderColor[status] }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{proposta.numero || '—'}</span>
            <PropostaStatusBadge status={proposta.status} />
            {proposta.tipo_empreendimento && (
              <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                {proposta.tipo_empreendimento}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-700 mt-1 truncate">{proposta.empreendimento || '—'}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
            {proposta.cliente && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {proposta.cliente}
              </span>
            )}
            {proposta.data_solicitacao && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(proposta.data_solicitacao), 'dd/MM/yyyy')}
              </span>
            )}
            {proposta.estado && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {proposta.estado}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {total > 0 && (
            <span className="text-sm font-semibold text-green-700">
              R$ {formatCurrency(total)}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-gray-400 hover:text-gray-700"
            onClick={(e) => { e.stopPropagation(); onEdit(proposta); }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}