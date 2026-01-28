import React, { useState, useEffect } from "react";
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
import { format } from "date-fns";

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

export default function PropostasPage() {
  const [propostas, setPropostas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    numero: '',
    data_solicitacao: '',
    solicitante: '',
    cliente: '',
    empreendimento: '',
    tipo_empreendimento: '',
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

  useEffect(() => {
    loadPropostas();
  }, []);

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

          <Card>
            <CardHeader>
              <CardTitle>Lista de Propostas</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {propostas.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma proposta cadastrada</p>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto space-y-4">
                  {propostas.map((proposta) => (
                    <Card key={proposta.id} className="border-l-4" style={{ borderLeftColor: proposta.status === 'aprovado' ? '#10b981' : proposta.status === 'reprovado' ? '#ef4444' : '#6b7280' }}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-gray-900">{proposta.numero || '-'}</h3>
                            <Badge className={statusColors[proposta.status]}>
                              {statusLabels[proposta.status]}
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
        </div>
      </div>

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
                onChange={(e) => setFormData({...formData, numero: e.target.value})}
                placeholder="Ex: 2024-001"
              />
            </div>

            <div>
              <Label htmlFor="data_solicitacao">Data Solicitação *</Label>
              <Input
                id="data_solicitacao"
                type="date"
                value={formData.data_solicitacao}
                onChange={(e) => setFormData({...formData, data_solicitacao: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="cliente">Cliente *</Label>
              <Input
                id="cliente"
                value={formData.cliente}
                onChange={(e) => setFormData({...formData, cliente: e.target.value})}
                placeholder="Nome do cliente"
              />
            </div>

            <div>
              <Label htmlFor="empreendimento">Empreendimento *</Label>
              <Input
                id="empreendimento"
                value={formData.empreendimento}
                onChange={(e) => setFormData({...formData, empreendimento: e.target.value})}
                placeholder="Nome do empreendimento"
              />
            </div>

            <div>
              <Label htmlFor="solicitante">Solicitante</Label>
              <Input
                id="solicitante"
                value={formData.solicitante}
                onChange={(e) => setFormData({...formData, solicitante: e.target.value})}
                placeholder="Nome do solicitante"
              />
            </div>

            <div>
              <Label htmlFor="tipo_empreendimento">Tipo de Empreendimento</Label>
              <Select value={formData.tipo_empreendimento} onValueChange={(value) => setFormData({...formData, tipo_empreendimento: value})}>
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
              <Label htmlFor="escopo">Escopo</Label>
              <Textarea
                id="escopo"
                value={formData.escopo}
                onChange={(e) => setFormData({...formData, escopo: e.target.value})}
                placeholder="Descrição do escopo do projeto"
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
                onChange={(e) => setFormData({...formData, area: e.target.value})}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input
                id="estado"
                value={formData.estado}
                onChange={(e) => setFormData({...formData, estado: e.target.value})}
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
                onChange={(e) => setFormData({...formData, valor_bim: e.target.value})}
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
                onChange={(e) => setFormData({...formData, valor_cad: e.target.value})}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="contato@exemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
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
                onChange={(e) => setFormData({...formData, data_aprovacao: e.target.value})}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="observacao">Observações</Label>
              <Textarea
                id="observacao"
                value={formData.observacao}
                onChange={(e) => setFormData({...formData, observacao: e.target.value})}
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
  );
}