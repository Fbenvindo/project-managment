import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, History, User, Clock } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from '@/api/base44Client';
const HistoricoAtividade = base44.entities.HistoricoAtividade;

const CAMPO_LABELS = {
  status: 'Status',
  termino_planejado: 'Término Planejado',
  inicio_planejado: 'Início Planejado',
  termino_ajustado: 'Término Ajustado',
  inicio_ajustado: 'Início Ajustado',
  executor_principal: 'Executor Principal',
  tempo_planejado: 'Tempo Planejado',
  descritivo: 'Descrição',
};

const STATUS_LABELS = {
  nao_iniciado: 'Não Iniciado',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  concluido_com_atraso: 'Concluído c/ Atraso',
  atrasado: 'Atrasado',
  pausado: 'Pausado',
};

const STATUS_COLORS = {
  nao_iniciado: 'bg-gray-100 text-gray-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  concluido: 'bg-green-100 text-green-700',
  concluido_com_atraso: 'bg-red-100 text-red-700',
  atrasado: 'bg-red-100 text-red-700',
  pausado: 'bg-yellow-100 text-yellow-700',
};

function formatValue(campo, value) {
  if (!value || value === 'null' || value === 'undefined') return '—';

  if (campo === 'status') {
    return STATUS_LABELS[value] || value;
  }

  if (['termino_planejado', 'inicio_planejado', 'termino_ajustado', 'inicio_ajustado'].includes(campo)) {
    try {
      const d = parseISO(value);
      if (isValid(d)) return format(d, "dd/MM/yyyy", { locale: ptBR });
    } catch {}
  }

  if (campo === 'tempo_planejado') {
    const n = parseFloat(value);
    if (!isNaN(n)) return `${n.toFixed(1)}h`;
  }

  return value;
}

function StatusBadge({ campo, value }) {
  if (campo === 'status') {
    const colorClass = STATUS_COLORS[value] || 'bg-gray-100 text-gray-700';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{formatValue(campo, value)}</span>;
  }
  return <span className="font-medium text-gray-800">{formatValue(campo, value)}</span>;
}

export default function HistoricoAtividadeModal({ isOpen, onClose, planejamentoId, displayName }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !planejamentoId) return;
    setLoading(true);
    HistoricoAtividade.filter({ planejamento_id: String(planejamentoId) }, '-created_date', 50)
      .then(data => setHistorico(data || []))
      .catch(() => setHistorico([]))
      .finally(() => setLoading(false));
  }, [isOpen, planejamentoId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            Histórico de Alterações
          </DialogTitle>
          {displayName && <p className="text-sm text-gray-500 mt-1 truncate">{displayName}</p>}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Carregando histórico...</span>
            </div>
          ) : historico.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma alteração registrada ainda.</p>
              <p className="text-xs mt-1 text-gray-300">As próximas edições serão exibidas aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      {CAMPO_LABELS[item.campo] || item.campo}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      {item.created_date
                        ? format(new Date(item.created_date), "dd/MM/yy HH:mm", { locale: ptBR })
                        : '—'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <div className="bg-red-50 border border-red-100 rounded px-2 py-1">
                      <span className="text-gray-400 text-[10px] block mb-0.5">Antes</span>
                      <StatusBadge campo={item.campo} value={item.valor_anterior} />
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="bg-green-50 border border-green-100 rounded px-2 py-1">
                      <span className="text-gray-400 text-[10px] block mb-0.5">Depois</span>
                      <StatusBadge campo={item.campo} value={item.valor_novo} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <User className="w-3 h-3" />
                    <span>{item.usuario_nome || item.usuario_email || 'Usuário desconhecido'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}