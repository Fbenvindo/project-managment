import React, { useState } from 'react';
import { PlanejamentoAtividade, PlanejamentoDocumento } from '@/entities/all';

const PRIORIDADES = [
  { value: 5, label: '5 – Urgente', color: 'bg-red-500', textColor: 'text-red-700', bg: 'bg-red-50 border-red-300', bgColor: 'bg-red-100' },
  { value: 4, label: '4 – Alta', color: 'bg-orange-500', textColor: 'text-orange-700', bg: 'bg-orange-50 border-orange-300', bgColor: 'bg-orange-100' },
  { value: 3, label: '3 – Média', color: 'bg-yellow-500', textColor: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300', bgColor: 'bg-yellow-100' },
  { value: 2, label: '2 – Baixa', color: 'bg-blue-400', textColor: 'text-blue-700', bg: 'bg-blue-50 border-blue-300', bgColor: 'bg-blue-100' },
  { value: 1, label: '1 – Normal', color: 'bg-gray-400', textColor: 'text-gray-600', bg: 'bg-gray-50 border-gray-300', bgColor: 'bg-gray-100' },
];

export const PRIORIDADE_CONFIG = PRIORIDADES;

export const getPrioridadeConfig = (value) => {
  return PRIORIDADES.find(p => p.value === value) || PRIORIDADES[4];
};

export const PrioridadeBadge = ({ prioridade }) => {
  const config = getPrioridadeConfig(prioridade);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.textColor}`}>
      <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
      P{config.value}
    </span>
  );
};

export default function PrioridadeSelector({ planejamento, tipo, onUpdate, compact = false }) {
  const [loading, setLoading] = useState(false);
  const prioridade = planejamento?.prioridade || 1;
  const config = getPrioridadeConfig(prioridade);

  const handleChange = async (novaP) => {
    if (novaP === prioridade || loading) return;
    setLoading(true);
    try {
      const entity = tipo === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      await entity.update(planejamento.id, { prioridade: novaP });
      if (onUpdate) onUpdate({ ...planejamento, prioridade: novaP });
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {PRIORIDADES.slice().reverse().map(p => (
          <button
            key={p.value}
            onClick={() => handleChange(p.value)}
            disabled={loading}
            title={p.label}
            className={`w-6 h-6 rounded-full border-2 transition-all ${prioridade === p.value ? `${p.color} border-transparent scale-125 shadow` : 'bg-white border-gray-300 hover:border-gray-500'} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 mr-1 whitespace-nowrap">Prioridade:</span>
      {PRIORIDADES.slice().reverse().map(p => (
        <button
          key={p.value}
          onClick={() => handleChange(p.value)}
          disabled={loading}
          title={p.label}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all
            ${prioridade === p.value
              ? `${p.color} text-white border-transparent scale-110 shadow-md`
              : 'bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:scale-105'}
            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {p.value}
        </button>
      ))}
    </div>
  );
}