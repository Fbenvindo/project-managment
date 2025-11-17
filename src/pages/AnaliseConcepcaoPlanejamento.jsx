import React, { useState, useEffect, useMemo } from 'react';
import { Documento, Analitico, Atividade, Execucao, User, Empreendimento } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Square, Filter, ClipboardList, CheckSquare } from "lucide-react";

export default function AnaliseConcepcaoPlanejamento() {
    const [documentos, setDocumentos] = useState([]);
    const [analiticos, setAnaliticos] = useState([]);
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
            const [docsData, analsData, ativsData, execsData, currentUser, empData] = await Promise.all([
                Documento.list(),
                Analitico.list(),
                Atividade.list(),
                Execucao.list(),
                User.me(),
                Empreendimento.list()
            ]);

            const aMap = ativsData.reduce((acc, ativ) => { acc[ativ.id] = ativ; return acc; }, {});
            const eMap = execsData.reduce((acc, exec) => {
                if (!acc[exec.analitico_id]) acc[exec.analitico_id] = [];
                acc[exec.analitico_id].push(exec);
                return acc;
            }, {});

            setAtividadesMap(aMap);
            setExecucoesMap(eMap);
            setDocumentos(docsData);
            setAnaliticos(analsData);
            setEmpreendimentos(empData);
            setUser(currentUser);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        }
        setIsLoading(false);
    };

    const handleStartExecution = async (analiticoId) => {
        const analitico = analiticos.find(a => a.id === analiticoId);
        if (!analitico || !user) return;
        const atividade = atividadesMap[analitico.atividade_id];
        
        await Execucao.create({
            analitico_id: analiticoId,
            descritivo: atividade.atividade,
            empreendimento_id: analitico.empreendimento_id,
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
            status: finalStatus,
            termino: termino.toISOString(),
            tempo_total: tempoTotal
        });
        setIsStopModalOpen(false);
        setSelectedExecucao(null);
        await loadData();
    };
    
    const getStatusBadge = (analitico) => {
        const execucoes = execucoesMap[analitico.id] || [];
        const execucaoAtiva = execucoes.find(e => e.status === "Em andamento" && e.usuario === user?.email);

        if (execucaoAtiva) {
            return (
                <Button size="sm" variant="destructive" onClick={() => openStopModal(execucaoAtiva)}>
                    <Square className="w-4 h-4 mr-2" /> Parar
                </Button>
            );
        }
        return (
            <Button size="sm" onClick={() => handleStartExecution(analitico.id)}>
                <Play className="w-4 h-4 mr-2" /> Iniciar
            </Button>
        );
    };

    const filteredAnaliticos = useMemo(() => {
        return analiticos.filter(anal => {
            const atividade = atividadesMap[anal.atividade_id];
            if (!atividade) return false;
            
            const etapaMatch = selectedEtapas.includes(atividade.etapa);
            const empreendimentoMatch = filterEmpreendimento === "todos" || anal.empreendimento_id === filterEmpreendimento;
            const disciplinaMatch = filterDisciplina === "todos" || atividade.disciplina === filterDisciplina;
            
            return etapaMatch && empreendimentoMatch && disciplinaMatch;
        });
    }, [analiticos, atividadesMap, selectedEtapas, filterEmpreendimento, filterDisciplina]);

    const groupedByDocumento = useMemo(() => {
        const grouped = {};
        filteredAnaliticos.forEach(anal => {
            if (!grouped[anal.documento_id]) {
                const doc = documentos.find(d => d.id === anal.documento_id);
                if (doc) {
                    grouped[anal.documento_id] = { doc, analiticos: [] };
                }
            }
            if (grouped[anal.documento_id]) {
                grouped[anal.documento_id].analiticos.push(anal);
            }
        });
        return Object.values(grouped).sort((a,b) => a.doc.disciplina.localeCompare(b.doc.disciplina) || a.doc.numero.localeCompare(b.doc.numero));
    }, [filteredAnaliticos, documentos]);
    
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
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Documento</TableHead>
                                        <TableHead>Atividade</TableHead>
                                        <TableHead className="text-center">Tempo Real</TableHead>
                                        <TableHead className="text-center">Tempo Executado</TableHead>
                                        <TableHead className="text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedByDocumento.map(({ doc, analiticos: docAnaliticos }) => (
                                        <React.Fragment key={doc.id}>
                                            <TableRow className="bg-gray-50 hover:bg-gray-100">
                                                <TableCell colSpan={5} className="font-semibold p-3">
                                                    <div className="flex flex-col">
                                                        <span>{doc.numero}</span>
                                                        <span className="text-xs text-gray-500 font-normal">{empreendimentos.find(e => e.id === doc.empreendimento_id)?.nome}</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {docAnaliticos.map((analitico, idx) => {
                                                const atividade = atividadesMap[analitico.atividade_id];
                                                const execucoes = execucoesMap[analitico.id] || [];
                                                const tempoExecutadoTotal = execucoes.reduce((sum, e) => sum + (e.tempo_total || 0), 0);
                                                return (
                                                    <TableRow key={analitico.id}>
                                                        <TableCell>{idx === 0 ? `${doc.disciplina}` : ""}</TableCell>
                                                        <TableCell>{atividade?.atividade || 'Atividade não encontrada'}</TableCell>
                                                        <TableCell className="text-center">{analitico.tempo_real?.toFixed(1) || "0.0"}h</TableCell>
                                                        <TableCell className="text-center">{tempoExecutadoTotal.toFixed(1)}h</TableCell>
                                                        <TableCell className="text-center">{getStatusBadge(analitico)}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
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