import React, { useMemo, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ResumoAlocacaoTab({ planejamentos = [], empreendimentos = [], documentos = [], usuarios = [] }) {
  const [filtroOS, setFiltroOS] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('todos');

  // Mapa de empreendimentos por ID
  const empreendimentosMap = useMemo(() => {
    const map = {};
    empreendimentos.forEach(emp => { map[emp.id] = emp; });
    return map;
  }, [empreendimentos]);

  // Mapa de usuários por email
  const usuariosMap = useMemo(() => {
    const map = {};
    usuarios.forEach(u => { map[u.email] = u; });
    return map;
  }, [usuarios]);

  // Processar dados: { [os]: { [email]: { planejado: h, realizado: h, empNome, empId } } }
  const dadosResumo = useMemo(() => {
    const resultado = {};

    (planejamentos || []).forEach(plan => {
      const executor = plan.executor_principal;
      if (!executor) return;

      const emp = empreendimentosMap[plan.empreendimento_id];
      const os = emp?.os || plan.empreendimento_id?.substring(0, 8) || 'Sem OS';
      const empNome = emp?.nome || 'Sem Empreendimento';
      const empId = plan.empreendimento_id;

      if (!resultado[os]) resultado[os] = { empNome, empId, usuarios: {} };
      if (!resultado[os].usuarios[executor]) {
        resultado[os].usuarios[executor] = { planejado: 0, realizado: 0 };
      }

      // Somar horas planejadas
      if (plan.horas_por_dia && typeof plan.horas_por_dia === 'object') {
        const total = Object.values(plan.horas_por_dia).reduce((acc, h) => acc + Number(h || 0), 0);
        resultado[os].usuarios[executor].planejado += total;
      } else if (plan.tempo_planejado) {
        resultado[os].usuarios[executor].planejado += Number(plan.tempo_planejado || 0);
      }

      // Somar horas realizadas
      if (plan.horas_executadas_por_dia && typeof plan.horas_executadas_por_dia === 'object') {
        const total = Object.values(plan.horas_executadas_por_dia).reduce((acc, h) => acc + Number(h || 0), 0);
        resultado[os].usuarios[executor].realizado += total;
      } else if (plan.tempo_executado) {
        resultado[os].usuarios[executor].realizado += Number(plan.tempo_executado || 0);
      }
    });

    return resultado;
  }, [planejamentos, empreendimentosMap]);

  // Lista de OSs únicas para o filtro
  const osDisponiveis = useMemo(() => Object.keys(dadosResumo).sort(), [dadosResumo]);

  // Lista de usuários únicos para o filtro
  const usuariosDisponiveis = useMemo(() => {
    const emails = new Set();
    Object.values(dadosResumo).forEach(({ usuarios }) => {
      Object.keys(usuarios).forEach(email => emails.add(email));
    });
    return Array.from(emails).sort();
  }, [dadosResumo]);

  // Linhas filtradas
  const linhas = useMemo(() => {
    const rows = [];
    Object.entries(dadosResumo).forEach(([os, { empNome, usuarios: usrs }]) => {
      // Filtro por OS
      if (filtroOS && !os.toLowerCase().includes(filtroOS.toLowerCase()) && !empNome.toLowerCase().includes(filtroOS.toLowerCase())) return;

      Object.entries(usrs).forEach(([email, { planejado, realizado }]) => {
        // Filtro por usuário
        if (filtroUsuario !== 'todos' && email !== filtroUsuario) return;

        const usuario = usuariosMap[email];
        const nomeUsuario = usuario?.nome || usuario?.full_name || email;
        rows.push({ os, empNome, email, nomeUsuario, planejado, realizado });
      });
    });

    // Ordenar por OS, depois por usuário
    return rows.sort((a, b) => a.os.localeCompare(b.os) || a.nomeUsuario.localeCompare(b.nomeUsuario));
  }, [dadosResumo, filtroOS, filtroUsuario, usuariosMap]);

  // Totais
  const totais = useMemo(() => ({
    planejado: linhas.reduce((acc, r) => acc + r.planejado, 0),
    realizado: linhas.reduce((acc, r) => acc + r.realizado, 0),
  }), [linhas]);

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
              <th className="text-right p-3 font-semibold">Horas Planejadas</th>
              <th className="text-right p-3 font-semibold">Horas Realizadas</th>
              <th className="text-right p-3 font-semibold">% Conclusão</th>
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
              linhas.map((row, idx) => {
                const pct = row.planejado > 0 ? Math.min(100, Math.round((row.realizado / row.planejado) * 100)) : 0;
                const isEven = idx % 2 === 0;
                return (
                  <tr key={`${row.os}-${row.email}`} className={`border-t ${isEven ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-xs">{row.os}</Badge>
                    </td>
                    <td className="p-3 text-gray-700 max-w-[200px] truncate" title={row.empNome}>{row.empNome}</td>
                    <td className="p-3 font-medium">{row.nomeUsuario}</td>
                    <td className="p-3 text-right tabular-nums">
                      <span className="text-blue-700 font-medium">{row.planejado.toFixed(1)}h</span>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      <span className={row.realizado > 0 ? 'text-green-700 font-medium' : 'text-gray-400'}>
                        {row.realizado.toFixed(1)}h
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${pct >= 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium w-8 text-right ${pct >= 100 ? 'text-green-600' : 'text-gray-600'}`}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="bg-gray-800 text-white font-semibold border-t-2">
                <td colSpan={3} className="p-3">Total</td>
                <td className="p-3 text-right tabular-nums">{totais.planejado.toFixed(1)}h</td>
                <td className="p-3 text-right tabular-nums">{totais.realizado.toFixed(1)}h</td>
                <td className="p-3 text-right text-xs">
                  {totais.planejado > 0 ? Math.round((totais.realizado / totais.planejado) * 100) : 0}%
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}