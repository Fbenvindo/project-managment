import React, { useState, useEffect, useMemo } from "react";
import { FileText, Loader2, Plus, Pencil, Search } from "lucide-react";
import { Comercial } from "@/entities/all";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { retryWithBackoff } from "@/components/utils/apiUtils";
import { format, parseISO } from "date-fns";

const formatCurrency = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
import EscopoForm from "@/components/comercial/EscopoForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusColors = {
  solicitado: "bg-gray-100 text-gray-800",
  em_analise: "bg-yellow-100 text-yellow-800",
  aprovado: "bg-green-100 text-green-800",
  reprovado: "bg-red-100 text-red-800"
};

const statusLabels = {
  solicitado: "Solicitado",
  em_analise: "Aguardando Aprovação",
  aprovado: "Aprovado",
  reprovado: "Não Aprovado"
};

const renderStatusLabel = (status) => {
  if (status === 'em_analise') {
    return (
      <span className="leading-tight">
        <span>Aguardando</span>
        <br />
        <span>Aprovação</span>
      </span>
    );
  }
  return statusLabels[status] || status;
};

export default function PropostasPage() {
  const [propostas, setPropostas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [formData, setFormData] = useState({
    numero: '',
    data_solicitacao: '',
    solicitante: '',
    cliente: '',
    empreendimento: '',
    tipo_empreendimento: '',
    tipo_obra: '',
    utilizacao: '',
    parceiros: [],
    disciplinas: [],
    codisciplinas: [],
    pavimentos: [],
    escopo: '',
    area: '',
    estado: '',
    valor_bim: '',
    valor_cad: '',
    data_aprovacao: '',
    status: 'solicitado',
    email: '',
    telefone: '',
    observacao: ''
  });

  useEffect(() => { loadPropostas(); }, []);

  const loadPropostas = async () => {
    setIsLoading(true);
    try {
      const data = await retryWithBackoff(
        () => Comercial.list('-updated_date'),
        3, 2000, 'loadPropostas'
      );
      const sorted = (data || []).reverse().sort((a, b) =>
        (b.numero || '').localeCompare(a.numero || '', 'pt-BR')
      );
      setPropostas(sorted);
    } catch (error) {
      console.error('Erro ao carregar propostas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = () => {
    setEditingId(null);
    setFormData({
      numero: '',
      data_solicitacao: format(new Date(), 'yyyy-MM-dd'),
      solicitante: '',
      cliente: '',
      empreendimento: '',
      tipo_empreendimento: '',
      tipo_obra: '',
      utilizacao: '',
      parceiros: [],
      disciplinas: [],
      codisciplinas: [],
      pavimentos: [],
      escopo: '',
      area: '',
      estado: '',
      valor_bim: '',
      valor_cad: '',
      data_aprovacao: '',
      status: 'solicitado',
      email: '',
      telefone: '',
      observacao: ''
    });
    setIsModalOpen(true);
  };

  const handleEditProposta = (proposta) => {
    setEditingId(proposta.id);
    setFormData({
      numero: proposta.numero || '',
      data_solicitacao: proposta.data_solicitacao || '',
      solicitante: proposta.solicitante || '',
      cliente: proposta.cliente || '',
      empreendimento: proposta.empreendimento || '',
      tipo_empreendimento: proposta.tipo_empreendimento || '',
      tipo_obra: proposta.tipo_obra || '',
      utilizacao: proposta.utilizacao || '',
      parceiros: proposta.parceiros || [],
      disciplinas: proposta.disciplinas || [],
      codisciplinas: proposta.codisciplinas || [],
      pavimentos: proposta.pavimentos || [],
      escopo: proposta.escopo || '',
      area: proposta.area?.toString() || '',
      estado: proposta.estado || '',
      valor_bim: proposta.valor_bim?.toString() || '',
      valor_cad: proposta.valor_cad?.toString() || '',
      data_aprovacao: proposta.data_aprovacao || '',
      status: proposta.status || 'solicitado',
      email: proposta.email || '',
      telefone: proposta.telefone || '',
      observacao: proposta.observacao || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.numero || !formData.cliente || !formData.empreendimento) {
      alert('Preencha os campos obrigatórios: Número, Cliente e Empreendimento');
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        area: formData.area ? Number(formData.area) : undefined,
        valor_bim: formData.valor_bim ? Number(formData.valor_bim) : undefined,
        valor_cad: formData.valor_cad ? Number(formData.valor_cad) : undefined
      };

      if (editingId) {
        await retryWithBackoff(
          () => Comercial.update(editingId, dataToSave),
          3, 2000, 'updateProposta'
        );
      } else {
        await retryWithBackoff(
          () => Comercial.create(dataToSave),
          3, 2000, 'createProposta'
        );
      }

      setIsModalOpen(false);
      setEditingId(null);
      loadPropostas();
    } catch (error) {
      console.error('Erro ao salvar proposta:', error);
      alert('Erro ao salvar proposta: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPropostas = propostas.filter((proposta) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      proposta.numero?.toLowerCase().includes(searchLower) ||
      proposta.cliente?.toLowerCase().includes(searchLower) ||
      proposta.empreendimento?.toLowerCase().includes(searchLower) ||
      proposta.solicitante?.toLowerCase().includes(searchLower) ||
      proposta.email?.toLowerCase().includes(searchLower)
    );
  });

  const resumoMensal = useMemo(() => {
    const groups = {};
    const getDateForGrouping = (p) => p.data_proposta || p.data_solicitacao || p.created_at || p.updated_date || p.updated_at || null;

    (propostas || []).forEach(p => {
      const raw = getDateForGrouping(p);
      let monthKey = 'Sem Data';
      let dateObj = null;
      if (raw) {
        try {
          dateObj = typeof raw === 'string' ? parseISO(raw) : new Date(raw);
          if (!isNaN(dateObj.getTime())) {
            monthKey = format(dateObj, 'yyyy-MM');
          }
        } catch {
          monthKey = 'Sem Data';
        }
      }
      if (!groups[monthKey]) groups[monthKey] = {
        items: [],
        totalBim: 0,
        totalCad: 0,
        byStatus: {
          solicitado: { count: 0, bim: 0, cad: 0 },
          em_analise: { count: 0, bim: 0, cad: 0 },
          aprovado: { count: 0, bim: 0, cad: 0 },
          reprovado: { count: 0, bim: 0, cad: 0 }
        }
      };
      groups[monthKey].items.push(p);
      const bim = Number(p.valor_bim || 0);
      const cad = Number(p.valor_cad || 0);
      groups[monthKey].totalBim += isNaN(bim) ? 0 : bim;
      groups[monthKey].totalCad += isNaN(cad) ? 0 : cad;
      const status = p.status || 'solicitado';
      if (!groups[monthKey].byStatus[status]) {
        groups[monthKey].byStatus[status] = { count: 0, bim: 0, cad: 0 };
      }
      groups[monthKey].byStatus[status].count += 1;
      groups[monthKey].byStatus[status].bim += isNaN(bim) ? 0 : bim;
      groups[monthKey].byStatus[status].cad += isNaN(cad) ? 0 : cad;
    });

    const ordered = Object.keys(groups).sort((a, b) => a < b ? 1 : -1).map(k => ({ month: k, ...groups[k] }));
    return ordered;
  }, [propostas]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Propostas</h1>
                <p className="text-gray-600">Apresentação de propostas comerciais ({propostas.length})</p>
              </div>
            </div>
            <Button onClick={handleOpenModal} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Proposta
            </Button>
          </div>


          <div className="mt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="inline-flex rounded-md bg-white p-1 shadow-sm">
                <TabsTrigger value="list" className="px-3 py-1">Lista</TabsTrigger>
                <TabsTrigger value="summary" className="px-3 py-1">Resumo Mensal</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="mt-4">
            <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div className="w-1/3">
                <div className="text-sm text-gray-500">Resumo (mês mais recente)</div>
                <div className="text-xl font-semibold">{resumoMensal[0] ? (resumoMensal[0].month === 'Sem Data' ? 'Sem Data' : format(parseISO(resumoMensal[0].month + '-01'), 'MMMM yyyy')) : '—'}</div>
              </div>

              <div className="w-1/3 px-4">
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="text-left">Aprovados: {resumoMensal[0]?.byStatus?.aprovado?.count || 0}</div>
                    <div className="text-left">Valor BIM: R$ {formatCurrency(resumoMensal[0]?.byStatus?.aprovado?.bim || 0)}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-left">Não aprovados: {resumoMensal[0]?.byStatus?.reprovado?.count || 0}</div>
                    <div className="text-left">Valor CAD: R$ {formatCurrency(resumoMensal[0]?.byStatus?.reprovado?.cad || 0)}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <span>Aguardando</span>
                      <br />
                      <span>Aprovação: {resumoMensal[0]?.byStatus?.em_analise?.count || 0}</span>
                    </div>
                    <div className="text-left">BIM: R$ {formatCurrency(resumoMensal[0]?.byStatus?.em_analise?.bim || 0)} • CAD: R$ {formatCurrency(resumoMensal[0]?.byStatus?.em_analise?.cad || 0)}</div>
                  </div>
                </div>
              </div>

              <div className="w-1/3 text-right">
                <div className="text-lg font-bold">{resumoMensal[0] ? `${resumoMensal[0].items.length} propostas` : '0 propostas'}</div>
                <div className="text-sm text-gray-500">
                  <div>Valor BIM: R$ {resumoMensal[0] ? formatCurrency(resumoMensal[0].totalBim) : '0,00'}</div>
                  <div>Valor CAD: R$ {resumoMensal[0] ? formatCurrency(resumoMensal[0].totalCad) : '0,00'}</div>
                </div>
                <div className="mt-2">
                  <Button onClick={() => setActiveTab('summary')} variant="outline">Abrir Resumo</Button>
                </div>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
            <TabsContent value="list">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle>Lista de Propostas</CardTitle>
                    <div className="relative w-80">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Pesquisar por número, cliente, empreendimento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-gray-50"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {propostas.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma proposta cadastrada</p>
                    </div>
                  ) : filteredPropostas.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma proposta encontrada para "{searchTerm}"</p>
                    </div>
                  ) : (
                    <div className="max-h-[calc(100vh-300px)] overflow-y-auto space-y-4">
                      {filteredPropostas.map((proposta) => (
                        <Card key={proposta.id} className="border-l-4" style={{ borderLeftColor: proposta.status === 'aprovado' ? '#10b981' : proposta.status === 'reprovado' ? '#ef4444' : '#6b7280' }}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <h3 className="font-bold text-lg text-gray-900">{proposta.numero || '-'}</h3>
                                <Badge className={statusColors[proposta.status]}>
                                  {renderStatusLabel(proposta.status)}
                                </Badge>
                                {proposta.tipo_empreendimento && (
                                  <Badge variant="outline" className="text-xs">
                                    {proposta.tipo_empreendimento}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditProposta(proposta)}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              <div>
                                <span className="font-semibold text-gray-600">Cliente:</span>
                                <p className="text-gray-900">{proposta.cliente || '-'}</p>
                              </div>

                              <div>
                                <span className="font-semibold text-gray-600">Empreendimento:</span>
                                <p className="text-gray-900">{proposta.empreendimento || '-'}</p>
                              </div>

                              <div>
                                <span className="font-semibold text-gray-600">Solicitante:</span>
                                <p className="text-gray-900">{proposta.solicitante || '-'}</p>
                              </div>

                              <div>
                                <span className="font-semibold text-gray-600">Data Solicitação:</span>
                                <p className="text-gray-900">
                                  {proposta.data_solicitacao ?
                                    format(new Date(proposta.data_solicitacao), 'dd/MM/yyyy')
                                    : '-'}
                                </p>
                              </div>

                              <div>
                                <span className="font-semibold text-gray-600">Data Aprovação:</span>
                                <p className="text-gray-900">
                                  {proposta.data_aprovacao ?
                                    format(new Date(proposta.data_aprovacao), 'dd/MM/yyyy')
                                    : '-'}
                                </p>
                              </div>

                              <div>
                                <span className="font-semibold text-gray-600">Área:</span>
                                <p className="text-gray-900">
                                  {proposta.area ?
                                    `${Number(proposta.area).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²`
                                    : '-'}
                                </p>
                              </div>

                              <div>
                                <span className="font-semibold text-gray-600">Estado:</span>
                                <p className="text-gray-900">{proposta.estado || '-'}</p>
                              </div>

                              <div>
                                <span className="font-semibold text-gray-600">Email:</span>
                                <p className="text-gray-900 truncate" title={proposta.email}>{proposta.email || '-'}</p>
                              </div>

                              <div>
                                <span className="font-semibold text-gray-600">Telefone:</span>
                                <p className="text-gray-900">{proposta.telefone || '-'}</p>
                              </div>
                            </div>

                            {proposta.escopo && (
                              <div className="mt-3 pt-3 border-t">
                                <span className="font-semibold text-gray-600 text-sm">Escopo:</span>
                                <p className="text-gray-900 text-sm mt-1">{proposta.escopo}</p>
                              </div>
                            )}

                            <div className="mt-3 pt-3 border-t flex items-center justify-between">
                              <div className="flex gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600">Valor BIM:</span>
                                  <span className="ml-2 font-semibold text-blue-600">
                                    {proposta.valor_bim ?
                                      `R$ ${Number(proposta.valor_bim).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                      : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Valor CAD:</span>
                                  <span className="ml-2 font-semibold text-blue-600">
                                    {proposta.valor_cad ?
                                      `R$ ${Number(proposta.valor_cad).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                      : '-'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-600 text-sm">Valor Total:</span>
                                <p className="font-bold text-lg text-green-600">
                                  {(proposta.valor_bim || proposta.valor_cad) ?
                                    `R$ ${(Number(proposta.valor_bim || 0) + Number(proposta.valor_cad || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : '-'}
                                </p>
                              </div>
                            </div>

                            {proposta.observacao && (
                              <div className="mt-3 pt-3 border-t">
                                <span className="font-semibold text-gray-600 text-sm">Observações:</span>
                                <p className="text-gray-900 text-sm mt-1">{proposta.observacao}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary">
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Resumo Mensal de Propostas</h2>
                {resumoMensal.length === 0 && (
                  <p className="text-gray-500">Nenhuma proposta disponível para resumo.</p>
                )}
                {resumoMensal.map(group => (
                  <div key={group.month} className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-lg font-medium">{group.month === 'Sem Data' ? 'Sem Data' : format(parseISO(group.month + '-01'), 'MMMM yyyy')}</div>
                      <div className="text-sm text-gray-600 space-y-1 text-right">
                        <div>Total: {group.items.length} propostas</div>
                        <div>
                          {['aprovado', 'reprovado', 'em_analise', 'solicitado'].map(s => (
                            <div key={s} className="flex justify-between whitespace-nowrap">
                              <div className="mr-2">{statusLabels[s] || s}:</div>
                              <div>{group.byStatus?.[s]?.count || 0} — BIM: R$ {formatCurrency(group.byStatus?.[s]?.bim || 0)} • CAD: R$ {formatCurrency(group.byStatus?.[s]?.cad || 0)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map(item => (
                        <div key={item.id} className="p-3 border rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold">{item.numero || item.nome || item.titulo || 'Sem Nome'}</div>
                              <div className="text-sm text-gray-500">{item.cliente || item.contato || ''}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">BIM: R$ {formatCurrency(item.valor_bim || 0)}</div>
                              <div className="font-bold">CAD: R$ {formatCurrency(item.valor_cad || 0)}</div>
                              <div className="text-xs text-gray-500">{(item.data_solicitacao || item.data_proposta || item.created_at || item.updated_date) ? (format(parseISO((item.data_solicitacao || item.data_proposta || item.created_at || item.updated_date).slice(0, 10)), 'dd/MM/yyyy')) : ''}</div>
                            </div>
                          </div>
                          <div className="mt-2 text-sm">
                            <Badge className={statusColors[item.status] || 'bg-gray-100 text-gray-800'}>
                              {renderStatusLabel(item.status) || item.status || '—'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Proposta' : 'Nova Proposta'}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    placeholder="Ex: 2024-001"
                  />
                </div>

                <div>
                  <Label htmlFor="data_solicitacao">Data Solicitação *</Label>
                  <Input
                    id="data_solicitacao"
                    type="date"
                    value={formData.data_solicitacao}
                    onChange={(e) => setFormData({ ...formData, data_solicitacao: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Input
                    id="cliente"
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                    placeholder="Nome do cliente"
                  />
                </div>

                <div>
                  <Label htmlFor="empreendimento">Empreendimento *</Label>
                  <Input
                    id="empreendimento"
                    value={formData.empreendimento}
                    onChange={(e) => setFormData({ ...formData, empreendimento: e.target.value })}
                    placeholder="Nome do empreendimento"
                  />
                </div>

                <div>
                  <Label htmlFor="solicitante">Solicitante</Label>
                  <Input
                    id="solicitante"
                    value={formData.solicitante}
                    onChange={(e) => setFormData({ ...formData, solicitante: e.target.value })}
                    placeholder="Nome do solicitante"
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_empreendimento">Tipo de Empreendimento</Label>
                  <Select value={formData.tipo_empreendimento} onValueChange={(value) => setFormData({ ...formData, tipo_empreendimento: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Residencial">Residencial</SelectItem>
                      <SelectItem value="Comercial">Comercial</SelectItem>
                      <SelectItem value="Corporativo">Corporativo</SelectItem>
                      <SelectItem value="Shopping">Shopping</SelectItem>
                      <SelectItem value="Logística">Logística</SelectItem>
                      <SelectItem value="Hotelaria">Hotelaria</SelectItem>
                      <SelectItem value="Hospitalar">Hospitalar</SelectItem>
                      <SelectItem value="Industrial">Industrial</SelectItem>
                      <SelectItem value="Laboratório">Laboratório</SelectItem>
                      <SelectItem value="Data Center">Data Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <EscopoForm formData={formData} setFormData={setFormData} />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="escopo">Descrição do Escopo</Label>
                  <Textarea
                    id="escopo"
                    value={formData.escopo}
                    onChange={(e) => setFormData({ ...formData, escopo: e.target.value })}
                    placeholder="Descrição adicional do escopo do projeto"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="area">Área (m²)</Label>
                  <Input
                    id="area"
                    type="number"
                    step="0.01"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado (UF)</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    placeholder="Ex: SP"
                    maxLength={2}
                  />
                </div>

                <div>
                  <Label htmlFor="valor_bim">Valor BIM (R$)</Label>
                  <Input
                    id="valor_bim"
                    type="number"
                    step="0.01"
                    value={formData.valor_bim}
                    onChange={(e) => setFormData({ ...formData, valor_bim: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="valor_cad">Valor CAD (R$)</Label>
                  <Input
                    id="valor_cad"
                    type="number"
                    step="0.01"
                    value={formData.valor_cad}
                    onChange={(e) => setFormData({ ...formData, valor_cad: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@exemplo.com"
                  />
                </div>

                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solicitado">Solicitado</SelectItem>
                      <SelectItem value="em_analise">Aguardando Aprovação</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="reprovado">Não Aprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="data_aprovacao">Data Aprovação</Label>
                  <Input
                    id="data_aprovacao"
                    type="date"
                    value={formData.data_aprovacao}
                    onChange={(e) => setFormData({ ...formData, data_aprovacao: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="observacao">Observações</Label>
                  <Textarea
                    id="observacao"
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    placeholder="Observações adicionais"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingId ? 'Atualizar Proposta' : 'Salvar Proposta'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
