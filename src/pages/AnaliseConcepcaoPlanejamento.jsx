import React, { useState, useEffect, useMemo } from 'react';
import { Documento, PlanejamentoAtividade, Atividade, Execucao, Empreendimento } from '@/entities/all';
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
    const [selectedEtapas, setSelectedEtapas] = useState(["Concepção", "Planejamento"]);
    
    const [isStopModalOpen, setIsStopModalOpen] = useState(false);
    const [selectedExecucao, setSelectedExecucao] = useState(null);
    const [finalStatus, setFinalStatus] = useState("Finalizado");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [docsData, planejamentosData, ativsData, execsData, currentUser, empData] = await Promise.all([
                Documento.list(),
                PlanejamentoAtividade.list(),
                Atividade.list(),
                Execucao.list(),
                base44.auth.me(),
                Empreendimento.list()
            ]);

            const aMap = ativsData.reduce((acc, ativ) => { acc[ativ.id] = ativ; return acc; }, {});
            const eMap = execsData.reduce((acc, exec) => {
                if (!acc[exec.planejamento_id]) acc[exec.planejamento_id] = [];
                acc[exec.planejamento_id].push(exec);
                return acc;
            }, {});

            setAtividadesMap(aMap);
            setExecucoesMap(eMap);
            setDocumentos(docsData);
            setPlanejamentos(planejamentosData);
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
        
        await Execucao.create({
            planejamento_id: planejamentoId,
            descritivo: planejamento.descritivo || atividade?.atividade || 'Atividade',
            empreendimento_id: planejamento.empreendimento_id,
            usuario: user.email,
            inicio: new Date().toISOString(),
            status: "Em andamento"
        });
        await loadData();
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

        await Execucao.update(selectedExecucao.id, {
            status: finalStatus === "Finalizado" ? "Finalizado" : "Paralisado",
            termino: termino.toISOString(),
            tempo_total: tempoTotal
        });
        setIsStopModalOpen(false);
        setSelectedExecucao(null);
        setFinalStatus("Finalizado");
        await loadData();
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
        return planejamentos.filter(plan => {
            const atividade = atividadesMap[plan.atividade_id];
            if (!atividade) return false;
            
            const etapaMatch = selectedEtapas.includes(plan.etapa || atividade.etapa);
            const empreendimentoMatch = filterEmpreendimento === "todos" || plan.empreendimento_id === filterEmpreendimento;
            const disciplinaMatch = filterDisciplina === "todos" || atividade.disciplina === filterDisciplina;
            
            return etapaMatch && empreendimentoMatch && disciplinaMatch;
        });
    }, [planejamentos, atividadesMap, selectedEtapas, filterEmpreendimento, filterDisciplina]);

    const groupedByDocumento = useMemo(() => {
        const grouped = {};
        filteredPlanejamentos.forEach(plan => {
            if (!plan.documento_id) return;
            if (!grouped[plan.documento_id]) {
                const doc = documentos.find(d => d.id === plan.documento_id);
                if (doc) {
                    grouped[plan.documento_id] = { doc, planejamentos: [] };
                }
            }
            if (grouped[plan.documento_id]) {
                grouped[plan.documento_id].planejamentos.push(plan);
            }
        });
        return Object.values(grouped).sort((a,b) => {
            const disciplinaA = a.doc.disciplina || '';
            const disciplinaB = b.doc.disciplina || '';
            const numeroA = a.doc.numero || '';
            const numeroB = b.doc.numero || '';
            return disciplinaA.localeCompare(disciplinaB) || numeroA.localeCompare(numeroB);
        });
    }, [filteredPlanejamentos, documentos]);
    
    const disciplinasDisponiveis = [...new Set(Object.values(atividadesMap).map(a => a.disciplina))];
    const etapasDisponiveis = ["Concepção", "Planejamento"];

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
                    <Card className="bg-white border-0 shadow-lg">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                                <Table className="min-w-max">
                                    <TableHeader className="sticky top-0 bg-white z-10">
                                        <TableRow>
                                            <TableHead>Documento</TableHead>
                                            <TableHead>Atividade</TableHead>
                                            <TableHead className="text-center">Tempo Real</TableHead>
                                            <TableHead className="text-center">Tempo Executado</TableHead>
                                            <TableHead className="text-center">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedByDocumento.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                    Nenhuma atividade de Concepção ou Planejamento encontrada com os filtros selecionados.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            groupedByDocumento.map(({ doc, planejamentos: docPlanejamentos }) => (
                                                <React.Fragment key={doc.id}>
                                                    <TableRow className="bg-gray-50 hover:bg-gray-100">
                                                        <TableCell colSpan={5} className="font-semibold p-3">
                                                            <div className="flex flex-col">
                                                                <span>{doc.numero}</span>
                                                                <span className="text-xs text-gray-500 font-normal">{empreendimentos.find(e => e.id === doc.empreendimento_id)?.nome}</span>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                    {docPlanejamentos.map((planejamento, idx) => {
                                                        const atividade = atividadesMap[planejamento.atividade_id];
                                                        const execucoes = execucoesMap[planejamento.id] || [];
                                                        const tempoExecutadoTotal = execucoes
                                                            .filter(e => e.status === "Finalizado")
                                                            .reduce((sum, e) => sum + (e.tempo_total || 0), 0);
                                                        return (
                                                            <TableRow key={planejamento.id}>
                                                                <TableCell>{idx === 0 ? `${doc.disciplina || '-'}` : ""}</TableCell>
                                                                <TableCell>{planejamento.descritivo || atividade?.atividade || 'Atividade não encontrada'}</TableCell>
                                                                <TableCell className="text-center">{planejamento.tempo_planejado?.toFixed(1) || "0.0"}h</TableCell>
                                                                <TableCell className="text-center">{tempoExecutadoTotal.toFixed(1)}h</TableCell>
                                                                <TableCell className="text-center">{getStatusBadge(planejamento)}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
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