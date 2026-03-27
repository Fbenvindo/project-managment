import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { retryWithBackoff, delay } from '../components/utils/apiUtils';
import RelatorioMediaSubdisciplinas from '@/components/relatorios/RelatorioMediaSubdisciplinas';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const fetchAll = async (entity, name) => {
    try {
        await delay(300);
        return await retryWithBackoff(() => entity.list(null, 5000), 3, 1000, name);
    } catch { return []; }
};

export default function MediaSubdisciplinas() {
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [planejamentos, setPlanejamentos] = useState([]);
    const [documentos, setDocumentos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [filters, setFilters] = useState({ usuario: 'all', empreendimento: 'all' });
    const [agrupamento, setAgrupamento] = useState('subdisciplina');

    useEffect(() => {
        Promise.all([
            fetchAll(base44.entities.Empreendimento, 'emp'),
            fetchAll(base44.entities.User, 'users'),
            fetchAll(base44.entities.Usuario, 'usuariosCustom'),
        ]).then(([emps, users, usuariosCustom]) => {
            setEmpreendimentos(emps || []);
            // Filtrar apenas usuários ativos
            const emailsAtivos = new Set(
                (usuariosCustom || []).filter(u => u.status === 'ativo').map(u => u.email)
            );
            const usuariosFiltrados = emailsAtivos.size > 0
                ? (users || []).filter(u => emailsAtivos.has(u.email))
                : (users || []);
            setUsuarios(usuariosFiltrados);
        });
    }, []);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setHasSearched(true);
        try {
            let paQuery, pdQuery;
            if (filters.usuario === 'all') {
                paQuery = base44.entities.PlanejamentoAtividade.list(null, 5000);
                pdQuery = base44.entities.PlanejamentoDocumento.list(null, 5000);
            } else {
                paQuery = base44.entities.PlanejamentoAtividade.filter({ executor_principal: filters.usuario }, null, 5000);
                pdQuery = base44.entities.PlanejamentoDocumento.filter({ executor_principal: filters.usuario }, null, 5000);
            }
            const [pa, pd, docs] = await Promise.all([
                retryWithBackoff(() => paQuery, 3, 1000, 'pa'),
                retryWithBackoff(() => pdQuery, 3, 1000, 'pd'),
                fetchAll(base44.entities.Documento, 'docs'),
            ]);

            const docMap = (docs || []).reduce((acc, d) => { acc[d.id] = d; return acc; }, {});
            const combined = [
                ...(pa || []).map(p => ({ ...p, documento: docMap[p.documento_id] || null })),
                ...(pd || []).map(p => ({ ...p, documento: docMap[p.documento_id] || null })),
            ];

            let filtered = combined;
            if (filters.empreendimento !== 'all') {
                filtered = filtered.filter(p => p.empreendimento_id === filters.empreendimento);
            }

            setDocumentos(docs || []);
            setPlanejamentos(filtered);
        } catch (e) {
            console.error(e);
            alert('Erro ao carregar dados.');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    const usuariosOrdenados = useMemo(() => [...usuarios].sort((a, b) => (a.nome || a.full_name || '').localeCompare(b.nome || b.full_name || '', 'pt-BR')), [usuarios]);
    const empreendimentosOrdenados = useMemo(() => [...empreendimentos].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')), [empreendimentos]);

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Média de Horas por Subdisciplina</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Filtros */}
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-1">
                            <Label>Usuário</Label>
                            <Select value={filters.usuario} onValueChange={v => setFilters(f => ({ ...f, usuario: v }))}>
                                <SelectTrigger className="w-52 bg-white"><SelectValue placeholder="Todos os usuários" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os usuários</SelectItem>
                                    {usuariosOrdenados.map(u => <SelectItem key={u.id} value={u.email}>{u.nome || u.full_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Empreendimento</Label>
                            <Select value={filters.empreendimento} onValueChange={v => setFilters(f => ({ ...f, empreendimento: v }))}>
                                <SelectTrigger className="w-64 bg-white"><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os empreendimentos</SelectItem>
                                    {empreendimentosOrdenados.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Agrupar por</Label>
                            <Select value={agrupamento} onValueChange={setAgrupamento}>
                                <SelectTrigger className="w-48 bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="subdisciplina">Subdisciplina</SelectItem>
                                    <SelectItem value="folha">Folha</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={loadData} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                            {isLoading ? (
                                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Carregando...</>
                            ) : (
                                <><Search className="w-4 h-4 mr-2" />Buscar</>
                            )}
                        </Button>
                    </div>

                    {!hasSearched && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                            <Search className="w-10 h-10 text-blue-500 mx-auto mb-3" />
                            <p className="text-gray-700 font-medium">Selecione os filtros e clique em Buscar para carregar os dados.</p>
                        </div>
                    )}

                    {hasSearched && !isLoading && (
                        <RelatorioMediaSubdisciplinas planejamentos={planejamentos} agrupamento={agrupamento} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}