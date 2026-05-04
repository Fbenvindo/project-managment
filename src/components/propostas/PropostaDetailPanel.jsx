import React from "react";
import { format } from "date-fns";
import { X, Pencil, Building2, User, MapPin, Calendar, Mail, Phone, FileText, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import PropostaStatusBadge from "./PropostaStatusBadge";

const formatCurrency = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-sm text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function PropostaDetailPanel({ proposta, onClose, onEdit }) {
  if (!proposta) return null;

  const total = Number(proposta.valor_bim || 0) + Number(proposta.valor_cad || 0);

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900">{proposta.numero || '—'}</h2>
            <PropostaStatusBadge status={proposta.status} />
          </div>
          <p className="text-sm text-gray-500">{proposta.empreendimento || '—'}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => onEdit(proposta)} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className="w-8 h-8 text-gray-400">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Values highlight */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
          <div className="bg-white p-3 text-center">
            <p className="text-xs text-gray-500">BIM</p>
            <p className="text-sm font-bold text-blue-700">R$ {formatCurrency(proposta.valor_bim || 0)}</p>
          </div>
          <div className="bg-white p-3 text-center">
            <p className="text-xs text-gray-500">CAD</p>
            <p className="text-sm font-bold text-blue-700">R$ {formatCurrency(proposta.valor_cad || 0)}</p>
          </div>
          <div className="bg-green-50 p-3 text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-bold text-green-700">R$ {formatCurrency(total)}</p>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <InfoRow icon={User} label="Cliente" value={proposta.cliente} />
        <InfoRow icon={User} label="Solicitante" value={proposta.solicitante} />
        <InfoRow icon={Building2} label="Tipo" value={proposta.tipo_empreendimento} />
        <InfoRow icon={MapPin} label="Estado" value={proposta.estado} />
        <InfoRow icon={Calendar} label="Data Solicitação" value={
          proposta.data_solicitacao
            ? format(new Date(proposta.data_solicitacao), 'dd/MM/yyyy')
            : null
        } />
        <InfoRow icon={Calendar} label="Data Aprovação" value={
          proposta.data_aprovacao
            ? format(new Date(proposta.data_aprovacao), 'dd/MM/yyyy')
            : null
        } />
        <InfoRow icon={Mail} label="Email" value={proposta.email} />
        <InfoRow icon={Phone} label="Telefone" value={proposta.telefone} />
        {proposta.area && (
          <InfoRow icon={Building2} label="Área" value={
            `${Number(proposta.area).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²`
          } />
        )}

        {proposta.escopo && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Escopo</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap mt-0.5">{proposta.escopo}</p>
              </div>
            </div>
          </div>
        )}

        {proposta.observacao && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-1">Observações</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{proposta.observacao}</p>
          </div>
        )}
      </div>
    </div>
  );
}