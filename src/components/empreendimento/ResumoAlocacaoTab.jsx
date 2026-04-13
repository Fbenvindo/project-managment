import React, { useMemo, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return null;
};

const formatDate = (dateStr) => {
  const d = parseLocalDate(dateStr);
  if (!d) return '-';
  return format(d, 'dd/MM/yy', { locale: ptBR });
};

export default function ResumoAlocacaoTab({ planejamentos = [], empreendimentos = [], documentos = [], usuarios = [] }) {
  const [filtroOS, setFiltroOS] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('todos');

  const empreendimentosMap = useMemo(() => {
    const map = {};
    empreendimentos.forEach(emp => { map[emp.id] = emp; });
    return map;
  }, [empreendimentos]);

  const usuariosMap = useMemo(() => {
    const map = {};
    usuarios.forEach(u => { map[u.email] = u; });
    return map;
  }, [usuarios]);

  // Processar: { [os_empId]: { os, empNome, usuarios: { [email]: { datas: Set<string> } } } }
  const dadosResumo = useMemo(() => {
    const resultado = {};

    (planejamentos || []).forEach(plan => {
      const executor = plan.executor_principal;
      if (!executor) return;

      const emp = empreendimentosMap[plan.empreendimento_id];
      const os = emp?.os || '-';
      const empNome = emp?.nome || 'Sem Empreendimento';
      const chave = `${plan.empreendimento_id}`;

      if (!resultado[chave]) resultado[chave] = { os, empNome, usuarios: {} };
      if (!resultado[chave].usuarios[executor]) {
        resultado[chave].usuarios[executor] = { datas: new Set() };
      }

      // Coletar datas com horas > 0 (planejado ou executado)
      const adicionarDatas = (horasPorDia) => {
        if (!horasPorDia || typeof horasPorDia !== 'object') return;
        Object.entries(horasPorDia).forEach(([dataStr, horas]) => {
          if (Number(horas) > 0) {
            resultado[chave].usuarios[executor].datas.add(dataStr);
          }
        });
      };

      adicionarDatas(plan.horas_por_dia);
      adicionarDatas(plan.horas_executadas_por_dia);

      // Fallback: usar datas de início/fim planejado
      if (resultado[chave].usuarios[executor].datas.size === 0) {
        const inicio = plan.inicio_planejado || plan.inicio_ajustado;
        const fim = plan.termino_planejado || plan.termino_ajustado;
        if (inicio) resultado[chave].usuarios[executor].datas.add(inicio.substring(0, 10));
        if (fim && fim !== inicio) resultado[chave].usuarios[executor].datas.add(fim.substring(0, 10));
      }
    });

    return resultado;
  }, [planejamentos, empreendimentosMap]);

  const usuariosDisponiveis = useMemo(() => {
    const emails = new Set();
    Object.values(dadosResumo).forEach(({ usuarios }) => {
      Object.keys(usuarios).forEach(email => emails.add(email));
    });
    return Array.from(emails).sort();
  }, [dadosResumo]);

  const linhas = useMemo(() => {
    const rows = [];
    Object.entries(dadosResumo).forEach(([, { os, empNome, usuarios: usrs }]) => {
      if (filtroOS && !os.toLowerCase().includes(filtroOS.toLowerCase()) && !empNome.toLowerCase().includes(filtroOS.toLowerCase())) return;

      Object.entries(usrs).forEach(([email, { datas }]) => {
        if (filtroUsuario !== 'todos' && email !== filtroUsuario) return;

        const usuario = usuariosMap[email];
        const nomeUsuario = usuario?.nome || usuario?.full_name || email;

        const datasOrdenadas = Array.from(datas).sort();
        const dataInicio = datasOrdenadas[0] || null;
        const dataFim = datasOrdenadas[datasOrdenadas.length - 1] || null;
        const totalDias = datasOrdenadas.length;

        rows.push({ os, empNome, email, nomeUsuario, dataInicio, dataFim, totalDias, datasOrdenadas });
      });
    });

    return rows.sort((a, b) => a.os.localeCompare(b.os) || a.nomeUsuario.localeCompare(b.nomeUsuario));
  }, [dadosResumo, filtroOS, filtroUsuario, usuariosMap]);

  const limparFiltros = () => {
    setFiltroOS('');
    setFiltroUsuario('todos');
  };

  const temFiltros = filtroOS || filtroUsuario !== 'todos';

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center p-3 bg-gray-50 rounded-lg border">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="flex-1 min-w-[180px] max-w-xs">
          <Input
            placeholder="Filtrar por OS ou empreendimento..."
            value={filtroOS}
            onChange={(e) => setFiltroOS(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="min-w-[200px]">
          <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Todos os usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os usuários</SelectItem>
              {usuariosDisponiveis.map(email => {
                const u = usuariosMap[email];
                return (
                  <SelectItem key={email} value={email}>
                    {u?.nome || u?.full_name || email}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        {temFiltros && (
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-8 text-red-500 hover:text-red-700">
            <X className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        )}
        <Badge variant="secondary">{linhas.length} registros</Badge>
      </div>

      {/* Tabela */}
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left p-3 font-semibold">OS</th>
              <th className="text-left p-3 font-semibold">Empreendimento</th>
              <th className="text-left p-3 font-semibold">Colaborador</th>
              <th className="text-center p-3 font-semibold">Data Início</th>
              <th className="text-center p-3 font-semibold">Data Fim</th>
              <th className="text-center p-3 font-semibold">Dias Trabalhados</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">
                  Nenhum dado encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              linhas.map((row, idx) => (
                <tr
                  key={`${row.os}-${row.email}-${idx}`}
                  className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                >
                  <td className="p-3">
                    <Badge variant="outline" className="font-mono text-xs">{row.os}</Badge>
                  </td>
                  <td className="p-3 text-gray-700 max-w-[220px] truncate" title={row.empNome}>{row.empNome}</td>
                  <td className="p-3 font-medium">{row.nomeUsuario}</td>
                  <td className="p-3 text-center tabular-nums text-gray-700">{formatDate(row.dataInicio)}</td>
                  <td className="p-3 text-center tabular-nums text-gray-700">{formatDate(row.dataFim)}</td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 font-semibold rounded-full px-2.5 py-0.5 text-xs">
                      {row.totalDias}d
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}