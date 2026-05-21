import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, History, User, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  if (campo === 'status') return STATUS_LABELS[value] || value;
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

function ValueBadge({ campo, value }) {
  if (campo === 'status') {
    const colorClass = STATUS_COLORS[value] || 'bg-gray-100 text-gray-700';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{formatValue(campo, value)}</span>;
  }
  return <span className="font-medium text-gray-800 text-xs">{formatValue(campo, value)}</span>;
}

export default function HistoricoGeralTab() {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchHistorico = async () => {
    setLoading(true);
    try {
      const data = await HistoricoAtividade.list('-created_date', 200);
      setHistorico(data || []);
    } catch {
      setHistorico([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistorico(); }, []);

  const filtered = historico.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.descricao_atividade || '').toLowerCase().includes(q) ||
      (item.usuario_nome || '').toLowerCase().includes(q) ||
      (item.usuario_email || '').toLowerCase().includes(q) ||
      (CAMPO_LABELS[item.campo] || item.campo || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por atividade, usuário ou campo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistorico} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500">Carregando histórico...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Nenhum resultado encontrado.' : 'Nenhuma alteração registrada ainda.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{filtered.length} registro(s)</p>
          {filtered.map((item) => (
            <div key={item.id} className="border border-gray-100 rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.descricao_atividade && (
                    <span className="text-xs text-gray-700 font-semibold truncate max-w-[200px]" title={item.descricao_atividade}>
                      {item.descricao_atividade}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                    {CAMPO_LABELS[item.campo] || item.campo}
                  </span>
                </div>
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
                  <ValueBadge campo={item.campo} value={item.valor_anterior} />
                </div>
                <span className="text-gray-400">→</span>
                <div className="bg-green-50 border border-green-100 rounded px-2 py-1">
                  <span className="text-gray-400 text-[10px] block mb-0.5">Depois</span>
                  <ValueBadge campo={item.campo} value={item.valor_novo} />
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
  );
}