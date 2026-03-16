import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, TrendingUp, Clock, Users, Target, ChevronDown, ChevronUp } from "lucide-react";
import { retryWithBackoff, delay } from '../components/utils/apiUtils';

const fetchAll = async (entity, name) => {
    try {
        await delay(300);
        return await retryWithBackoff(() => entity.list(null, 5000), 3, 1000, name);
    } catch {
        return [];
    }
};

export default function MediaAtividades() {
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [usuarios, setUsuarios] = useState([]);
    const [filtroUsuario, setFiltroUsuario] = useState('all');
    const [filtroAtividade, setFiltroAtividade] = useState('');
    const [filtroEtapa, setFiltroEtapa] = useState('all');
    const [viewMode, setViewMode] = useState('atividade'); // 'atividade' | 'usuario'
    const [expandedRows, setExpandedRows] = useState({});

    const [dadosBrutos, setDadosBrutos] = useState({
        planejamentos: [],
        atividades: [],
        execucoes: [],
    });

    useEffect(() => {
        base44.entities.User.list().then(u => setUsuarios(u || []));
    }, []);

    const handleBuscar = async () => {
        setIsLoading(true);
        setHasSearched(true);
        try {
            let planejamentosQuery = filtroUsuario === 'all'
                ? base44.entities.PlanejamentoAtividade.list()
                : base44.entities.PlanejamentoAtividade.filter({ executor_principal: filtroUsuario });

            let execucoesQuery = filtroUsuario === 'all'
                ? base44.entities.Execucao.list()
                : base44.entities.Execucao.filter({ usuario: filtroUsuario });

            const [planejamentos, atividades, execucoes] = await Promise.all([
                retryWithBackoff(() => planejamentosQuery, 3, 1000, 'mediaAtividades.planejamentos'),
                fetchAll(base44.entities.Atividade, 'mediaAtividades.atividades'),
                retryWithBackoff(() => execucoesQuery, 3, 1000, 'mediaAtividades.execucoes'),
            ]);

            // Apenas planejamentos concluídos com tempo executado
            const concluidos = (planejamentos || []).filter(p =>
                p.status === 'concluido' && p.atividade_id && (p.tempo_executado > 0 || p.tempo_planejado > 0)
            );

            setDadosBrutos({
                planejamentos: concluidos,
                atividades: atividades || [],
                execucoes: execucoes || [],
            });
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const atividadesMap = useMemo(() =>
        dadosBrutos.atividades.reduce((acc, a) => ({ ...acc, [a.id]: a }), {}),
        [dadosBrutos.atividades]
    );

    const usuariosMap = useMemo(() =>
        usuarios.reduce((acc, u) => ({ ...acc, [u.email]: u }), {}),
        [usuarios]
    );

    // Etapas únicas para filtro
    const etapas = useMemo(() => {
        const set = new Set(dadosBrutos.atividades.map(a => a.etapa).filter(Boolean));
        return [...set].sort();
    }, [dadosBrutos.atividades]);

    // Dados enriquecidos + filtrados
    const planejamentosEnriquecidos = useMemo(() => {
        return dadosBrutos.planejamentos
            .map(p => ({
                ...p,
                atividade: atividadesMap[p.atividade_id],
                usuario: usuariosMap[p.executor_principal],
            }))
            .filter(p => {
                if (!p.atividade) return false;
                if (filtroEtapa !== 'all' && p.atividade.etapa !== filtroEtapa) return false;
                if (filtroAtividade && !p.atividade.atividade?.toLowerCase().includes(filtroAtividade.toLowerCase())) return false;
                return true;
            });
    }, [dadosBrutos.planejamentos, atividadesMap, usuariosMap, filtroEtapa, filtroAtividade]);

    // Agrupamento POR ATIVIDADE
    const mediasPorAtividade = useMemo(() => {
        const grupos = {};
        planejamentosEnriquecidos.forEach(p => {
            const key = p.atividade_id;
            if (!grupos[key]) {
                grupos[key] = {
                    atividade_id: key,
                    nome: p.atividade?.atividade || 'N/A',
                    etapa: p.atividade?.etapa || 'N/A',
                    disciplina: p.atividade?.disciplina || 'N/A',
                    tempo_base: p.atividade?.tempo || 0,
                    registros: [],
                };
            }
            grupos[key].registros.push(p);
        });

        return Object.values(grupos).map(g => {
            const tempos = g.registros.map(r => r.tempo_executado || 0).filter(t => t > 0);
            const media = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
            const min = tempos.length > 0 ? Math.min(...tempos) : 0;
            const max = tempos.length > 0 ? Math.max(...tempos) : 0;
            const planejado_medio = g.registros.reduce((s, r) => s + (r.tempo_planejado || 0), 0) / g.registros.length;
            const desvio = media > 0 && planejado_medio > 0 ? ((media - planejado_medio) / planejado_medio) * 100 : 0;

            return { ...g, media, min, max, planejado_medio, desvio, count: tempos.length };
        }).sort((a, b) => b.count - a.count);
    }, [planejamentosEnriquecidos]);

    // Agrupamento POR USUÁRIO
    const mediasPorUsuario = useMemo(() => {
        const grupos = {};
        planejamentosEnriquecidos.forEach(p => {
            const key = p.executor_principal || 'N/A';
            if (!grupos[key]) {
                grupos[key] = {
                    email: key,
                    nome: p.usuario?.full_name || p.usuario?.nome || key,
                    registros: [],
                };
            }
            grupos[key].registros.push(p);
        });

        return Object.values(grupos).map(g => {
            const tempos = g.registros.map(r => r.tempo_executado || 0).filter(t => t > 0);
            const media = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
            const total = tempos.reduce((a, b) => a + b, 0);

            // Subgrupos por atividade para este usuário
            const subGrupos = {};
            g.registros.forEach(r => {
                const ak = r.atividade_id;
                if (!subGrupos[ak]) subGrupos[ak] = { nome: r.atividade?.atividade || 'N/A', tempos: [] };
                if (r.tempo_executado > 0) subGrupos[ak].tempos.push(r.tempo_executado);
            });

            const atividadesDoUsuario = Object.values(subGrupos).map(s => ({
                nome: s.nome,
                media: s.tempos.length > 0 ? s.tempos.reduce((a, b) => a + b, 0) / s.tempos.length : 0,
                count: s.tempos.length,
            })).sort((a, b) => b.count - a.count);

            return { ...g, media, total, count: tempos.length, atividadesDoUsuario };
        }).sort((a, b) => b.count - a.count);
    }, [planejamentosEnriquecidos]);

    const toggleExpand = (key) => setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));

    const Desviobadge = ({ desvio }) => {
        if (Math.abs(desvio) < 5) return <Badge className="bg-green-100 text-green-800">±OK</Badge>;
        if (desvio > 0) return <Badge className="bg-red-100 text-red-800">+{desvio.toFixed(0)}%</Badge>;
        return <Badge className="bg-blue-100 text-blue-800">{desvio.toFixed(0)}%</Badge>;
    };

    // Tela inicial
    if (!hasSearched) {
        return (
            <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
                <Card className="shadow-lg max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-blue-600" />
                            Média por Atividade e Usuário
                        </CardTitle>
                        <p className="text-gray-500 text-sm mt-1">
                            Analise o tempo médio executado por tipo de atividade para calibrar os tempos ideais de planejamento.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Filtrar por usuário</label>
                            <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um usuário" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os usuários</SelectItem>
                                    {usuarios.map(u => (
                                        <SelectItem key={u.email} value={u.email}>
                                            {u.full_name || u.nome || u.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleBuscar} className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                            <Search className="w-4 h-4 mr-2" />
                            Calcular Médias
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 bg-gray-50 min-h-screen space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-blue-600" />
                            Média por Atividade e Usuário
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {planejamentosEnriquecidos.length} execuções concluídas analisadas
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => { setHasSearched(false); }}>
                        <Search className="w-4 h-4 mr-2" />
                        Nova Busca
                    </Button>
                </div>

                {/* Cards de resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-gray-500">Atividades distintas</span>
                        </div>
                        <p className="text-2xl font-bold">{mediasPorAtividade.length}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-gray-500">Usuários</span>
                        </div>
                        <p className="text-2xl font-bold">{mediasPorUsuario.length}</p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-gray-500">Média geral (h)</span>
                        </div>
                        <p className="text-2xl font-bold">
                            {planejamentosEnriquecidos.length > 0
                                ? (planejamentosEnriquecidos.reduce((s, p) => s + (p.tempo_executado || 0), 0) / planejamentosEnriquecidos.filter(p => p.tempo_executado > 0).length || 0).toFixed(1)
                                : '0.0'}h
                        </p>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-gray-500">Total executado (h)</span>
                        </div>
                        <p className="text-2xl font-bold">
                            {planejamentosEnriquecidos.reduce((s, p) => s + (p.tempo_executado || 0), 0).toFixed(0)}h
                        </p>
                    </Card>
                </div>

                {/* Filtros */}
                <Card className="p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar atividade..."
                                value={filtroAtividade}
                                onChange={e => setFiltroAtividade(e.target.value)}
                            />
                        </div>
                        <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Filtrar por etapa" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as etapas</SelectItem>
                                {etapas.map(e => (
                                    <SelectItem key={e} value={e}>{e}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                            <Button
                                variant={viewMode === 'atividade' ? 'default' : 'outline'}
                                onClick={() => setViewMode('atividade')}
                                size="sm"
                            >
                                <Target className="w-4 h-4 mr-1" />
                                Por Atividade
                            </Button>
                            <Button
                                variant={viewMode === 'usuario' ? 'default' : 'outline'}
                                onClick={() => setViewMode('usuario')}
                                size="sm"
                            >
                                <Users className="w-4 h-4 mr-1" />
                                Por Usuário
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Tabela por Atividade */}
                {viewMode === 'atividade' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Médias por Tipo de Atividade</CardTitle>
                            <p className="text-sm text-gray-500">
                                Comparativo entre tempo planejado médio e tempo real executado médio.
                                O desvio indica se as atividades costumam demorar mais ou menos que o planejado.
                            </p>
                        </CardHeader>
                        <CardContent className="p-0">
                            {mediasPorAtividade.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">Nenhum dado encontrado com os filtros selecionados.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-gray-50">
                                            <TableRow>
                                                <TableHead className="min-w-[220px]">Atividade</TableHead>
                                                <TableHead>Etapa</TableHead>
                                                <TableHead>Disciplina</TableHead>
                                                <TableHead className="text-center">Execuções</TableHead>
                                                <TableHead className="text-center">Tempo Base (h/m²)</TableHead>
                                                <TableHead className="text-center">Planejado Médio (h)</TableHead>
                                                <TableHead className="text-center">Executado Médio (h)</TableHead>
                                                <TableHead className="text-center">Mín (h)</TableHead>
                                                <TableHead className="text-center">Máx (h)</TableHead>
                                                <TableHead className="text-center">Desvio vs Planejado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {mediasPorAtividade.map(g => (
                                                <TableRow
                                                    key={g.atividade_id}
                                                    className="cursor-pointer hover:bg-gray-50"
                                                    onClick={() => toggleExpand(g.atividade_id)}
                                                >
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {expandedRows[g.atividade_id]
                                                                ? <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                            }
                                                            {g.nome}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">{g.etapa}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-gray-600">{g.disciplina}</TableCell>
                                                    <TableCell className="text-center font-semibold">{g.count}</TableCell>
                                                    <TableCell className="text-center text-gray-500 font-mono text-sm">
                                                        {g.tempo_base > 0 ? `${g.tempo_base}` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-sm text-blue-700">
                                                        {g.planejado_medio > 0 ? `${g.planejado_medio.toFixed(1)}h` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono font-bold text-gray-900">
                                                        {g.media > 0 ? `${g.media.toFixed(1)}h` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-sm text-green-700">
                                                        {g.min > 0 ? `${g.min.toFixed(1)}h` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-sm text-red-700">
                                                        {g.max > 0 ? `${g.max.toFixed(1)}h` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {g.count > 0 ? <Desviobage desvio={g.desvio} /> : '-'}

                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Tabela por Usuário */}
                {viewMode === 'usuario' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Médias por Usuário</CardTitle>
                            <p className="text-sm text-gray-500">
                                Desempenho individual de cada colaborador com detalhe por atividade executada.
                            </p>
                        </CardHeader>
                        <CardContent className="p-0">
                            {mediasPorUsuario.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">Nenhum dado encontrado com os filtros selecionados.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-gray-50">
                                            <TableRow>
                                                <TableHead className="min-w-[180px]">Usuário</TableHead>
                                                <TableHead className="text-center">Atividades concluídas</TableHead>
                                                <TableHead className="text-center">Média por atividade (h)</TableHead>
                                                <TableHead className="text-center">Total executado (h)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {mediasPorUsuario.map(g => (
                                                <React.Fragment key={g.email}>
                                                    <TableRow
                                                        className="cursor-pointer hover:bg-gray-50 bg-white"
                                                        onClick={() => toggleExpand(g.email)}
                                                    >
                                                        <TableCell className="font-semibold">
                                                            <div className="flex items-center gap-2">
                                                                {expandedRows[g.email]
                                                                    ? <ChevronUp className="w-3 h-3 text-gray-400" />
                                                                    : <ChevronDown className="w-3 h-3 text-gray-400" />
                                                                }
                                                                {g.nome}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold">{g.count}</TableCell>
                                                        <TableCell className="text-center font-mono font-bold">
                                                            {g.media > 0 ? `${g.media.toFixed(1)}h` : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center font-mono text-blue-700 font-semibold">
                                                            {g.total.toFixed(1)}h
                                                        </TableCell>
                                                    </TableRow>
                                                    {expandedRows[g.email] && g.atividadesDoUsuario.map((a, i) => (
                                                        <TableRow key={i} className="bg-blue-50/40">
                                                            <TableCell className="pl-10 text-sm text-gray-700" colSpan={1}>
                                                                ↳ {a.nome}
                                                            </TableCell>
                                                            <TableCell className="text-center text-sm text-gray-600">{a.count}</TableCell>
                                                            <TableCell className="text-center font-mono text-sm font-medium">
                                                                {a.media > 0 ? `${a.media.toFixed(1)}h` : '-'}
                                                            </TableCell>
                                                            <TableCell />
                                                        </TableRow>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

// componente interno para badge de desvio
function Desviobage({ desvio }) {
    if (Math.abs(desvio) < 5) return <Badge className="bg-green-100 text-green-800">±OK</Badge>;
    if (desvio > 0) return <Badge className="bg-red-100 text-red-800">+{desvio.toFixed(0)}%</Badge>;
    return <Badge className="bg-blue-100 text-blue-800">{desvio.toFixed(0)}%</Badge>;
}