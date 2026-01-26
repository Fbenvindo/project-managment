import React, { useState, useEffect, useMemo } from 'react';
import { Documento, PlanejamentoAtividade, PlanejamentoDocumento, Atividade, Execucao, Empreendimento } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Square, Filter, ClipboardList, CheckSquare } from "lucide-react";

export default function AnaliseConcepcaoPlanejamento() {
    const [documentos, setDocumentos] = useState([]);
    const [planejamentos, setPlanejamentos] = useState([]);
    const [atividadesMap, setAtividadesMap] = useState({});
    const [execucoesMap, setExecucoesMap] = useState({});
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    
    // Filters
    const [filterEmpreendimento, setFilterEmpreendimento] = useState("todos");
    const [filterDisciplina, setFilterDisciplina] = useState("todas");
    const [selectedEtapas, setSelectedEtapas] = useState([]);
    
    const [isStopModalOpen, setIsStopModalOpen] = useState(false);
    const [selectedExecucao, setSelectedExecucao] = useState(null);
    const [finalStatus, setFinalStatus] = useState("Finalizado");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [docsData, planejamentosAtivData, planejamentosDocData, ativsData, execsData, currentUser, empData] = await Promise.all([
                Documento.list(),
                PlanejamentoAtividade.list(),
                PlanejamentoDocumento.list(),
                Atividade.list(),
                Execucao.list(),
                base44.auth.me(),
                Empreendimento.list()
            ]);

            // Combinar planejamentos de atividade e documento
            const planosAtivComTipo = planejamentosAtivData.map(p => ({ ...p, tipo_planejamento: 'atividade' }));
            const planosDocComTipo = planejamentosDocData.map(p => ({ ...p, tipo_planejamento: 'documento' }));
            const todosPlanejamentos = [...planosAtivComTipo, ...planosDocComTipo];

            const aMap = ativsData.reduce((acc, ativ) => { acc[ativ.id] = ativ; return acc; }, {});
            const eMap = execsData.reduce((acc, exec) => {
                if (!acc[exec.planejamento_id]) acc[exec.planejamento_id] = [];
                acc[exec.planejamento_id].push(exec);
                return acc;
            }, {});

            setAtividadesMap(aMap);
            setExecucoesMap(eMap);
            setDocumentos(docsData);
            setPlanejamentos(todosPlanejamentos);
            setEmpreendimentos(empData);
            setUser(currentUser);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        }
        setIsLoading(false);
    };

    const handleStartExecution = async (planejamentoId) => {
        const planejamento = planejamentos.find(a => a.id === planejamentoId);
        if (!planejamento || !user) return;
        const atividade = atividadesMap[planejamento.atividade_id];
        
        const execucao = await Execucao.create({
            planejamento_id: planejamentoId,
            descritivo: planejamento.descritivo || atividade?.atividade || 'Atividade',
            empreendimento_id: planejamento.empreendimento_id,
            usuario: user.email,
            inicio: new Date().toISOString(),
            status: "Em andamento"
        });
        
        setExecucoesMap(prev => ({
            ...prev,
            [planejamentoId]: [...(prev[planejamentoId] || []), execucao]
        }));
    };

    const openStopModal = (execucao) => {
        setSelectedExecucao(execucao);
        setIsStopModalOpen(true);
    };

    const handleConfirmStop = async () => {
        if (!selectedExecucao) return;
        const inicio = new Date(selectedExecucao.inicio);
        const termino = new Date();
        const tempoTotal = (termino - inicio) / (1000 * 60 * 60);

        // Atualizar Execucao
        await Execucao.update(selectedExecucao.id, {
            status: finalStatus === "Finalizado" ? "Finalizado" : "Paralisado",
            termino: termino.toISOString(),
            tempo_total: tempoTotal
        });

        // Atualizar PlanejamentoAtividade com horas_executadas_por_dia
        const planejamento = planejamentos.find(p => p.id === selectedExecucao.planejamento_id);
        if (planejamento) {
            const diaKey = new Date(selectedExecucao.inicio).toISOString().split('T')[0]; // YYYY-MM-DD
            const horasExecutadasPorDia = planejamento.horas_executadas_por_dia || {};
            horasExecutadasPorDia[diaKey] = (horasExecutadasPorDia[diaKey] || 0) + tempoTotal;

            // Calcular tempo_executado como soma total de horas_executadas_por_dia
            const totalTempoExecutado = Object.values(horasExecutadasPorDia).reduce((sum, h) => sum + (Number(h) || 0), 0);

            // Se horas_por_dia estiver vazio, preencher com as horas_executadas_por_dia
            let horasPorDia = planejamento.horas_por_dia;
            if (!horasPorDia || Object.keys(horasPorDia).length === 0) {
              horasPorDia = horasExecutadasPorDia;
            }

            // Atualizar o tipo correto de planejamento
            const EntityToUpdate = planejamento.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
            await EntityToUpdate.update(planejamento.id, {
                horas_por_dia: horasPorDia,
                horas_executadas_por_dia: horasExecutadasPorDia,
                tempo_executado: totalTempoExecutado,
                tempo_planejado: totalTempoExecutado,
                is_quick_activity: true
            });

            // Atualizar estado local
            setPlanejamentos(prev => prev.map(p => 
                p.id === planejamento.id 
                    ? { ...p, horas_por_dia: horasPorDia, horas_executadas_por_dia: horasExecutadasPorDia, tempo_executado: totalTempoExecutado }
                    : p
            ));
        }
        
        setExecucoesMap(prev => ({
            ...prev,
            [selectedExecucao.planejamento_id]: prev[selectedExecucao.planejamento_id].map(e => 
                e.id === selectedExecucao.id 
                    ? { ...e, status: finalStatus === "Finalizado" ? "Finalizado" : "Paralisado", termino: termino.toISOString(), tempo_total: tempoTotal }
                    : e
            )
        }));
        
        setIsStopModalOpen(false);
        setSelectedExecucao(null);
        setFinalStatus("Finalizado");
    };
    
    const getStatusBadge = (planejamento) => {
        const execucoes = execucoesMap[planejamento.id] || [];
        const execucaoAtiva = execucoes.find(e => e.status === "Em andamento" && e.usuario === user?.email);

        if (execucaoAtiva) {
            return (
                <Button size="sm" variant="destructive" onClick={() => openStopModal(execucaoAtiva)}>
                    <Square className="w-4 h-4 mr-2" /> Parar
                </Button>
            );
        }
        return (
            <Button size="sm" onClick={() => handleStartExecution(planejamento.id)}>
                <Play className="w-4 h-4 mr-2" /> Iniciar
            </Button>
        );
    };

    const filteredPlanejamentos = useMemo(() => {
        const disciplinasExcluidas = ['Planejamento', 'Gestão', 'BIM', 'Apoio'];
        
        return planejamentos.filter(plan => {
            const atividade = atividadesMap[plan.atividade_id];
            if (!atividade && !plan.descritivo) return false;
            
            // Excluir disciplinas específicas
            if (atividade?.disciplina && disciplinasExcluidas.includes(atividade.disciplina)) {
                return false;
            }
            
            const etapaPlan = plan.etapa || atividade?.etapa;
            const etapaMatch = selectedEtapas.length === 0 || selectedEtapas.includes(etapaPlan);
            const empreendimentoMatch = filterEmpreendimento === "todos" || plan.empreendimento_id === filterEmpreendimento;
            const disciplinaMatch = filterDisciplina === "todos" || atividade?.disciplina === filterDisciplina;
            
            return etapaMatch && empreendimentoMatch && disciplinaMatch;
        });
    }, [planejamentos, atividadesMap, selectedEtapas, filterEmpreendimento, filterDisciplina]);

    const groupedByDisciplina = useMemo(() => {
        const grouped = {};
        
        filteredPlanejamentos.forEach(plan => {
            const atividade = atividadesMap[plan.atividade_id];
            const disciplina = atividade?.disciplina || 'Documentação';
            
            if (!grouped[disciplina]) {
                grouped[disciplina] = [];
            }
            grouped[disciplina].push({ plan, atividade });
        });
        
        // Ordenar as disciplinas e os planejamentos dentro de cada disciplina
        return Object.entries(grouped)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([disciplina, items]) => {
                const sortedItems = items.sort((a, b) => {
                    const empA = empreendimentos.find(e => e.id === a.plan.empreendimento_id);
                    const empB = empreendimentos.find(e => e.id === b.plan.empreendimento_id);
                    const docA = documentos.find(d => d.id === a.plan.documento_id);
                    const docB = documentos.find(d => d.id === b.plan.documento_id);
                    
                    // Primeiro por empreendimento, depois por documento
                    const empCompare = (empA?.nome || '').localeCompare(empB?.nome || '');
                    if (empCompare !== 0) return empCompare;
                    
                    return (docA?.numero || '').localeCompare(docB?.numero || '');
                });
                return { disciplina, items: sortedItems };
            });
    }, [filteredPlanejamentos, documentos, atividadesMap, empreendimentos]);
    
    const disciplinasDisponiveis = [...new Set(Object.values(atividadesMap).map(a => a.disciplina))];
    
    // Coletar todas as etapas existentes nos planejamentos
    const etapasDisponiveis = useMemo(() => {
        const etapasSet = new Set();
        planejamentos.forEach(plan => {
            const atividade = atividadesMap[plan.atividade_id];
            const etapa = plan.etapa || atividade?.etapa;
            if (etapa) etapasSet.add(etapa);
        });
        return Array.from(etapasSet).sort();
    }, [planejamentos, atividadesMap]);

    const toggleEtapa = (etapa) => {
        setSelectedEtapas(prev => 
            prev.includes(etapa) ? prev.filter(e => e !== etapa) : [...prev, etapa]
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <ClipboardList className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Análise de Concepção e Planejamento</h1>
                        <p className="text-gray-600">Visão consolidada das etapas iniciais de todos os projetos.</p>
                    </div>
                </div>

                <Card className="bg-white border-0 shadow-lg mb-8">
                    <CardHeader className="border-b border-gray-100">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Filter className="w-5 h-5 text-blue-600"/> Filtros
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Etapas</label>
                            <div className="flex flex-wrap gap-2">
                                {etapasDisponiveis.map(etapa => (
                                    <Button key={etapa} variant={selectedEtapas.includes(etapa) ? "default" : "outline"} onClick={() => toggleEtapa(etapa)}>
                                        {selectedEtapas.includes(etapa) && <CheckSquare className="w-4 h-4 mr-2" />}
                                        {etapa}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <Select value={filterEmpreendimento} onValueChange={setFilterEmpreendimento}>
                            <SelectTrigger><SelectValue placeholder="Filtrar por Empreendimento" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os Empreendimentos</SelectItem>
                                {empreendimentos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterDisciplina} onValueChange={setFilterDisciplina}>
                            <SelectTrigger><SelectValue placeholder="Filtrar por Disciplina" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todas as Disciplinas</SelectItem>
                                {disciplinasDisponiveis.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {isLoading ? <Skeleton className="h-96 w-full" /> : (
                    <div className="space-y-6">
                        {groupedByDisciplina.length === 0 ? (
                            <Card className="bg-white border-0 shadow-lg">
                                <CardContent className="p-8 text-center text-gray-500">
                                    Nenhuma atividade de Concepção ou Planejamento encontrada com os filtros selecionados.
                                </CardContent>
                            </Card>
                        ) : (
                            groupedByDisciplina.map(({ disciplina, items }) => (
                                <div key={disciplina} className="border rounded-lg overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b">
                                        <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                                            <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                                            {disciplina}
                                            <Badge variant="secondary" className="ml-2">
                                                {items.length} {items.length === 1 ? 'atividade' : 'atividades'}
                                            </Badge>
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Documento</TableHead>
                                                    <TableHead>Empreendimento</TableHead>
                                                    <TableHead>Atividade</TableHead>
                                                    <TableHead className="text-center">Tempo Real</TableHead>
                                                    <TableHead className="text-center">Tempo Executado</TableHead>
                                                    <TableHead className="text-center">Ações</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map(({ plan: planejamento, atividade }) => {
                                                    const doc = documentos.find(d => d.id === planejamento.documento_id);
                                                    const empreendimento = empreendimentos.find(e => e.id === planejamento.empreendimento_id);
                                                    const execucoes = execucoesMap[planejamento.id] || [];
                                                    const tempoExecutadoTotal = execucoes
                                                        .filter(e => e.status === "Finalizado")
                                                        .reduce((sum, e) => sum + (e.tempo_total || 0), 0);
                                                    const tempoExibir = planejamento.tempo_executado || tempoExecutadoTotal;

                                                    return (
                                                        <TableRow key={planejamento.id}>
                                                            <TableCell>{doc ? doc.numero : '-'}</TableCell>
                                                            <TableCell className="text-sm text-gray-600">{empreendimento?.nome || '-'}</TableCell>
                                                            <TableCell>{planejamento.descritivo || atividade?.atividade || 'Atividade não encontrada'}</TableCell>
                                                            <TableCell className="text-center">{(planejamento.tempo_planejado || 0).toFixed(1)}h</TableCell>
                                                            <TableCell className="text-center">{tempoExibir.toFixed(1)}h</TableCell>
                                                            <TableCell className="text-center">{getStatusBadge(planejamento)}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <Dialog open={isStopModalOpen} onOpenChange={setIsStopModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Finalizar Execução</DialogTitle></DialogHeader>
                    <p>Como deseja finalizar esta atividade?</p>
                    <Select value={finalStatus} onValueChange={setFinalStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Finalizado">Finalizado</SelectItem>
                            <SelectItem value="Paralisado">Paralisado</SelectItem>
                        </SelectContent>
                    </Select>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStopModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleConfirmStop}>Confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}