import React, { useState, useContext } from 'react';
import { PlanejamentoAtividade, PlanejamentoDocumento } from '@/entities/all';
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import { distribuirHorasPorDias } from '../utils/DateCalculator';
import { format, parseISO, isValid } from 'date-fns';

const parseLocalDate = (s) => {
  if (!s) return null;
  if (s instanceof Date) return s;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const p = parseISO(s);
  return isValid(p) ? p : null;
};

const redistribuirPlanejamentosExecutor = async (executorEmail, planejamentoIdAlterado, novaPrioridade) => {
  // Buscar todos os planejamentos não concluídos do executor (ambos tipos)
  const [plansAtiv, plansDoc] = await Promise.all([
    PlanejamentoAtividade.filter({ executor_principal: executorEmail }),
    PlanejamentoDocumento.filter({ executor_principal: executorEmail }),
  ]);

  const todos = [
    ...(plansAtiv || []).map(p => ({ ...p, _tipo: 'atividade' })),
    ...(plansDoc || []).map(p => ({ ...p, _tipo: 'documento' })),
  ].filter(p => p.status !== 'concluido' && p.tempo_planejado > 0 && p.horas_por_dia && Object.keys(p.horas_por_dia).length > 0);

  if (todos.length === 0) return;

  // Aplicar a nova prioridade localmente para ordenação
  const comPrioridade = todos.map(p => ({
    ...p,
    prioridade: p.id === planejamentoIdAlterado ? novaPrioridade : (p.prioridade || 1),
  }));

  // Encontrar a data de início mais cedo do grupo
  let dataInicioGlobal = null;
  comPrioridade.forEach(p => {
    const d = parseLocalDate(p.inicio_planejado);
    if (d && (!dataInicioGlobal || d < dataInicioGlobal)) dataInicioGlobal = d;
  });

  if (!dataInicioGlobal) return;

  // Ordenar: prioridade maior primeiro, depois por data de início original
  comPrioridade.sort((a, b) => {
    const pDiff = (b.prioridade || 1) - (a.prioridade || 1);
    if (pDiff !== 0) return pDiff;
    const dA = parseLocalDate(a.inicio_planejado);
    const dB = parseLocalDate(b.inicio_planejado);
    if (dA && dB) return dA - dB;
    return 0;
  });

  // Redistribuir em sequência
  const cargaAcumulada = {};
  const updates = [];

  for (const plano of comPrioridade) {
    const { distribuicao, dataTermino } = distribuirHorasPorDias(
      dataInicioGlobal,
      plano.tempo_planejado,
      8,
      cargaAcumulada
    );

    const diasSorted = Object.keys(distribuicao).sort();
    const novoInicio = diasSorted[0];
    const novoTermino = format(dataTermino, 'yyyy-MM-dd');

    // Acumular carga para próximo planejamento
    Object.entries(distribuicao).forEach(([dia, h]) => {
      cargaAcumulada[dia] = (cargaAcumulada[dia] || 0) + h;
    });

    updates.push({ plano, novoInicio, novoTermino, distribuicao });
  }

  // Salvar todas as atualizações em paralelo
  await Promise.all(updates.map(({ plano, novoInicio, novoTermino, distribuicao }) => {
    const entity = plano._tipo === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
    return entity.update(plano.id, {
      inicio_planejado: novoInicio,
      termino_planejado: novoTermino,
      horas_por_dia: distribuicao,
    });
  }));
};

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
  const { triggerUpdate } = useContext(ActivityTimerContext);
  const prioridade = planejamento?.prioridade || 1;
  const config = getPrioridadeConfig(prioridade);

  const handleChange = async (novaP) => {
    if (novaP === prioridade || loading) return;
    setLoading(true);
    try {
      const entity = tipo === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      await entity.update(planejamento.id, { prioridade: novaP });

      // Redistribuir planejamentos do executor respeitando a nova prioridade
      const executorEmail = planejamento.executor_principal;
      if (executorEmail) {
        await redistribuirPlanejamentosExecutor(executorEmail, planejamento.id, novaP);
      }

      if (onUpdate) onUpdate({ ...planejamento, prioridade: novaP });
      if (triggerUpdate) triggerUpdate();
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