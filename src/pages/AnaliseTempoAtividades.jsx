import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart2, Search, TrendingUp, TrendingDown, Minus, Loader2, Clock, Activity } from "lucide-react";

const { Atividade, PlanejamentoAtividade } = base44.entities;

export default function AnaliseTempoAtividades() {
  const [search, setSearch] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('todas');
  const [filtroDisciplina, setFiltroDisciplina] = useState('todas');
  const [ordenacao, setOrdenacao] = useState('desvio_desc');

  const { data: atividades = [], isLoading: loadingAtiv } = useQuery({
    queryKey: ['atividades-base'],
    queryFn: () => Atividade.list('-created_date', 5000),
  });

  const { data: planejamentos = [], isLoading: loadingPlan } = useQuery({
    queryKey: ['planejamentos-analise'],
    queryFn: () => PlanejamentoAtividade.filter({ status: 'concluido' }, '-created_date', 5000),
  });

  const isLoading = loadingAtiv || loadingPlan;

  // Mapa de atividade_id -> dados da atividade base (sem empreendimento = atividade base/template)
  const atividadeMap = useMemo(() => {
    const map = new Map();
    atividades.forEach(a => {
      // Atividades base não têm empreendimento_id, mas têm id_atividade
      if (!a.empreendimento_id) {
        map.set(a.id, a);
        // Também indexar por id_atividade se existir
        if (a.id_atividade) map.set(a.id_atividade, a);
      }
    });
    return map;
  }, [atividades]);

  // Agrupa planejamentos concluídos por atividade_id e calcula médias
  const analise = useMemo(() => {
    const grupos = new Map();

    planejamentos.forEach(p => {
      if (!p.atividade_id || !p.tempo_executado || p.tempo_executado <= 0) return;
      if (p.status !== 'concluido') return;

      const atividadeBase = atividadeMap.get(p.atividade_id);
      if (!atividadeBase) return;

      if (!grupos.has(p.atividade_id)) {
        grupos.set(p.atividade_id, {
          atividade_id: p.atividade_id,
          nome: atividadeBase.atividade,
          etapa: atividadeBase.etapa,
          disciplina: atividadeBase.disciplina,
          subdisciplina: atividadeBase.subdisciplina,
          funcao: atividadeBase.funcao,
          tempo_base: atividadeBase.tempo || 0, // h/m²
          registros: [],
        });
      }

      grupos.get(p.atividade_id).registros.push({
        tempo_planejado: p.tempo_planejado || 0,
        tempo_executado: p.tempo_executado,
      });
    });

    return Array.from(grupos.values()).map(g => {
      const n = g.registros.length;
      const totalExecutado = g.registros.reduce((s, r) => s + r.tempo_executado, 0);
      const totalPlanejado = g.registros.reduce((s, r) => s + r.tempo_planejado, 0);
      const mediaExecutado = totalExecutado / n;
      const mediaPlanejado = totalPlanejado / n;
      const desvio = mediaPlanejado > 0 ? ((mediaExecutado - mediaPlanejado) / mediaPlanejado) * 100 : 0;

      return {
        ...g,
        n,
        mediaExecutado,
        mediaPlanejado,
        desvio, // % acima (+) ou abaixo (-) do planejado
      };
    });
  }, [planejamentos, atividadeMap]);

  const etapas = useMemo(() => [...new Set(analise.map(a => a.etapa).filter(Boolean))].sort(), [analise]);
  const disciplinas = useMemo(() => [...new Set(analise.map(a => a.disciplina).filter(Boolean))].sort(), [analise]);

  const filtrado = useMemo(() => {
    let lista = analise;
    if (filtroEtapa !== 'todas') lista = lista.filter(a => a.etapa === filtroEtapa);
    if (filtroDisciplina !== 'todas') lista = lista.filter(a => a.disciplina === filtroDisciplina);
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter(a => a.nome?.toLowerCase().includes(s) || a.subdisciplina?.toLowerCase().includes(s));
    }

    return lista.sort((a, b) => {
      switch (ordenacao) {
        case 'desvio_desc': return b.desvio - a.desvio;
        case 'desvio_asc': return a.desvio - b.desvio;
        case 'registros_desc': return b.n - a.n;
        case 'media_desc': return b.mediaExecutado - a.mediaExecutado;
        case 'nome_asc': return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        default: return 0;
      }
    });
  }, [analise, filtroEtapa, filtroDisciplina, search, ordenacao]);

  // Estatísticas resumo
  const stats = useMemo(() => {
    if (!filtrado.length) return null;
    const acimaDoPlanejado = filtrado.filter(a => a.desvio > 10).length;
    const abaixoDoPlanejado = filtrado.filter(a => a.desvio < -10).length;
    const dentroDoPlanejado = filtrado.filter(a => Math.abs(a.desvio) <= 10).length;
    const totalRegistros = filtrado.reduce((s, a) => s + a.n, 0);
    return { acimaDoPlanejado, abaixoDoPlanejado, dentroDoPlanejado, totalRegistros };
  }, [filtrado]);

  const getDesvioColor = (desvio) => {
    if (desvio > 20) return 'text-red-600 font-semibold';
    if (desvio > 10) return 'text-orange-500';
    if (desvio < -10) return 'text-green-600';
    return 'text-gray-600';
  };

  const getDesvioIcon = (desvio) => {
    if (desvio > 10) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (desvio < -10) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getDesvioBadge = (desvio) => {
    if (desvio > 20) return <Badge className="bg-red-100 text-red-700">{`+${desvio.toFixed(0)}%`}</Badge>;
    if (desvio > 10) return <Badge className="bg-orange-100 text-orange-700">{`+${desvio.toFixed(0)}%`}</Badge>;
    if (desvio < -10) return <Badge className="bg-green-100 text-green-700">{`${desvio.toFixed(0)}%`}</Badge>;
    return <Badge className="bg-gray-100 text-gray-600">{`${desvio > 0 ? '+' : ''}${desvio.toFixed(0)}%`}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Carregando análise...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <BarChart2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análise de Tempo por Atividade</h1>
          <p className="text-sm text-gray-500">Comparativo entre tempo planejado e executado — somente atividades concluídas</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-500 font-medium uppercase">Atividades analisadas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{filtrado.length}</p>
              <p className="text-xs text-gray-400">{stats.totalRegistros} execuções no total</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-red-500" />
                <span className="text-xs text-gray-500 font-medium uppercase">Acima do planejado</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.acimaDoPlanejado}</p>
              <p className="text-xs text-gray-400">Desvio &gt; 10%</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Minus className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium uppercase">Dentro do planejado</span>
              </div>
              <p className="text-2xl font-bold text-gray-700">{stats.dentroDoPlanejado}</p>
              <p className="text-xs text-gray-400">Desvio entre -10% e +10%</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-500 font-medium uppercase">Abaixo do planejado</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.abaixoDoPlanejado}</p>
              <p className="text-xs text-gray-400">Desvio &lt; -10%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar atividade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as etapas</SelectItem>
                {etapas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroDisciplina} onValueChange={setFiltroDisciplina}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as disciplinas</SelectItem>
                {disciplinas.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desvio_desc">Maior desvio primeiro</SelectItem>
                <SelectItem value="desvio_asc">Menor desvio primeiro</SelectItem>
                <SelectItem value="registros_desc">Mais execuções</SelectItem>
                <SelectItem value="media_desc">Maior tempo médio</SelectItem>
                <SelectItem value="nome_asc">Nome A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <p className="text-sm text-gray-500">{filtrado.length} atividades encontradas</p>
        </CardHeader>
        <CardContent className="p-0">
          {filtrado.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma atividade com dados suficientes encontrada.</p>
              <p className="text-sm mt-1">São necessárias atividades concluídas com tempo executado registrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-700">Atividade</TableHead>
                    <TableHead className="font-semibold text-gray-700">Etapa</TableHead>
                    <TableHead className="font-semibold text-gray-700">Disciplina</TableHead>
                    <TableHead className="font-semibold text-gray-700">Subdisciplina</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Execuções</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Média Planejada</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Média Executada</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-center">Desvio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrado.map(a => (
                    <TableRow key={a.atividade_id} className="hover:bg-gray-50">
                      <TableCell className="font-medium max-w-[280px]">
                        <span className="line-clamp-2 text-sm" title={a.nome}>{a.nome}</span>
                        {a.funcao && <span className="text-xs text-gray-400 block">{a.funcao}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">{a.etapa || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{a.disciplina || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-500">{a.subdisciplina || '-'}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-gray-800">{a.n}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-600">
                        {a.mediaPlanejado > 0 ? `${a.mediaPlanejado.toFixed(1)}h` : <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className={`font-semibold ${getDesvioColor(a.desvio)}`}>
                            {a.mediaExecutado.toFixed(1)}h
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getDesvioIcon(a.desvio)}
                          {getDesvioBadge(a.desvio)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}