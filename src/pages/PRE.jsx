import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Printer, Save, FileText, Loader2 } from "lucide-react";
import { Empreendimento, ItemPRE } from "@/entities/all";
import { format } from "date-fns";
import { retryWithBackoff } from "@/components/utils/apiUtils";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/577f93874_logo_Interativa_versao_final_sem_fundo_0002.png";

const STATUS_COLORS = {
  "Em andamento": "bg-yellow-200",
  "Pendente": "bg-orange-200",
  "Concluído": "bg-green-200",
  "Cancelado": "bg-red-200"
};

const printStyles = `
@media print {
  @page {
    size: A4 landscape;
    margin: 8mm;
  }
  
  .no-print {
    display: none !important;
  }
  
  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;

export default function PRE() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [items, setItems] = useState([]);
  const [headerData, setHeaderData] = useState({
    cliente: '',
    obra: '',
    descricao: '',
    data: format(new Date(), 'dd/MM/yyyy'),
    rev: 'Arquivo'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedEmp) {
      loadItems(selectedEmp);
      const emp = empreendimentos.find(e => e.id === selectedEmp);
      if (emp) {
        setHeaderData(prev => ({
          ...prev,
          cliente: emp.cliente || '',
          obra: emp.nome || ''
        }));
      }
    }
  }, [selectedEmp, empreendimentos]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const emps = await retryWithBackoff(() => Empreendimento.list(), 3, 2000, 'PRE-Empreendimentos');
      setEmpreendimentos(emps || []);
    } catch (error) {
      console.error('Erro ao carregar empreendimentos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadItems = async (empId) => {
    try {
      const itemsList = await retryWithBackoff(
        () => ItemPRE.filter({ empreendimento_id: empId }), 
        3, 2000, 
        'PRE-Items'
      );
      setItems(itemsList || []);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      setItems([]);
    }
  };

  const handleAddItem = () => {
    const newItem = {
      id: `temp-${Date.now()}`,
      empreendimento_id: selectedEmp,
      item: String(items.length + 1),
      data: format(new Date(), 'yyyy-MM-dd'),
      de: '',
      descritiva: '',
      localizacao: '',
      assunto: '',
      comentario: '',
      status: 'Em andamento',
      resposta: '',
      isNew: true
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id, field, value) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Deseja excluir este item?')) return;
    
    try {
      if (!id.toString().startsWith('temp-')) {
        await retryWithBackoff(() => ItemPRE.delete(id), 3, 2000, `PRE-Delete-${id}`);
      }
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      alert('Erro ao excluir item.');
    }
  };

  const handleSave = async () => {
    if (!selectedEmp) {
      alert('Selecione um empreendimento primeiro.');
      return;
    }

    setIsSaving(true);
    try {
      for (const item of items) {
        const itemData = {
          empreendimento_id: selectedEmp,
          item: item.item,
          data: item.data,
          de: item.de,
          descritiva: item.descritiva,
          localizacao: item.localizacao,
          assunto: item.assunto,
          comentario: item.comentario,
          status: item.status,
          resposta: item.resposta
        };

        if (item.isNew || item.id.toString().startsWith('temp-')) {
          await retryWithBackoff(() => ItemPRE.create(itemData), 3, 2000, 'PRE-Create');
        } else {
          await retryWithBackoff(() => ItemPRE.update(item.id, itemData), 3, 2000, `PRE-Update-${item.id}`);
        }
      }
      
      await loadItems(selectedEmp);
      alert('Dados salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <>
      <style>{printStyles}</style>
      <div className="p-6 bg-gray-50 min-h-screen print:p-0 print:bg-white">
        {/* Barra de Ações */}
        <div className="mb-4 flex justify-between items-center no-print">
          <h1 className="text-2xl font-bold text-gray-800">PRE - Emails, ATA e Documentos</h1>
          <div className="flex gap-2">
            <Select value={selectedEmp || ''} onValueChange={setSelectedEmp}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecione o empreendimento" />
              </SelectTrigger>
              <SelectContent>
                {empreendimentos.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSave} disabled={isSaving || !selectedEmp}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!selectedEmp}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handleAddItem} disabled={!selectedEmp}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
          </div>
        </div>

        {!selectedEmp ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Selecione um Empreendimento</h3>
              <p className="text-gray-500">Escolha um empreendimento no menu acima para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white border border-gray-400 shadow-lg">
            {/* Cabeçalho */}
            <div className="border-b-2 border-gray-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={LOGO_URL} alt="Interativa" className="h-16" />
              </div>
              <div className="text-center flex-1">
                <h2 className="text-xl font-bold text-gray-800">Emails, ATA e Documentos</h2>
              </div>
              <div className="text-right text-sm">
                <div>{headerData.data}</div>
                <div>Rev: {headerData.rev}</div>
              </div>
            </div>

            {/* Info do Cliente */}
            <div className="border-b border-gray-400 p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Cliente:</label>
                <Input
                  value={headerData.cliente}
                  onChange={(e) => setHeaderData(prev => ({ ...prev, cliente: e.target.value }))}
                  className="mt-1 print:border-none print:bg-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Descrição:</label>
                <Input
                  value={headerData.descricao}
                  onChange={(e) => setHeaderData(prev => ({ ...prev, descricao: e.target.value }))}
                  className="mt-1 print:border-none print:bg-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Obra:</label>
                <Input
                  value={headerData.obra}
                  onChange={(e) => setHeaderData(prev => ({ ...prev, obra: e.target.value }))}
                  className="mt-1 print:border-none print:bg-transparent"
                />
              </div>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-blue-900 text-white">
                    <th className="border border-gray-400 p-2 w-[5%]">Item</th>
                    <th className="border border-gray-400 p-2 w-[8%]">Data</th>
                    <th className="border border-gray-400 p-2 w-[8%]">De</th>
                    <th className="border border-gray-400 p-2 w-[10%]">Descritiva</th>
                    <th className="border border-gray-400 p-2 w-[10%]">Localização</th>
                    <th className="border border-gray-400 p-2 w-[20%]">Assunto</th>
                    <th className="border border-gray-400 p-2 w-[15%]">Comentário</th>
                    <th className="border border-gray-400 p-2 w-[10%]">Status</th>
                    <th className="border border-gray-400 p-2 w-[12%]">Resposta</th>
                    <th className="border border-gray-400 p-2 w-[2%] no-print">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center p-8 text-gray-500">
                        Nenhum item cadastrado. Clique em "Adicionar Item" para começar.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-1 text-center">
                          <Input
                            value={item.item}
                            onChange={(e) => handleUpdateItem(item.id, 'item', e.target.value)}
                            className="h-8 text-xs text-center print:border-none print:bg-transparent"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <Input
                            type="date"
                            value={item.data}
                            onChange={(e) => handleUpdateItem(item.id, 'data', e.target.value)}
                            className="h-8 text-xs print:border-none print:bg-transparent"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <Input
                            value={item.de}
                            onChange={(e) => handleUpdateItem(item.id, 'de', e.target.value)}
                            className="h-8 text-xs print:border-none print:bg-transparent"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <Textarea
                            value={item.descritiva}
                            onChange={(e) => handleUpdateItem(item.id, 'descritiva', e.target.value)}
                            className="min-h-[100px] text-xs print:border-none print:bg-transparent resize-y"
                            rows={4}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <Input
                            value={item.localizacao}
                            onChange={(e) => handleUpdateItem(item.id, 'localizacao', e.target.value)}
                            className="h-8 text-xs print:border-none print:bg-transparent"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <Textarea
                            value={item.assunto}
                            onChange={(e) => handleUpdateItem(item.id, 'assunto', e.target.value)}
                            className="min-h-[100px] text-xs print:border-none print:bg-transparent resize-y"
                            rows={4}
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <Textarea
                            value={item.comentario}
                            onChange={(e) => handleUpdateItem(item.id, 'comentario', e.target.value)}
                            className="min-h-[100px] text-xs print:border-none print:bg-transparent resize-y"
                            rows={4}
                          />
                        </td>
                        <td className={`border border-gray-300 p-1 ${STATUS_COLORS[item.status] || ''}`}>
                          <Select
                            value={item.status}
                            onValueChange={(value) => handleUpdateItem(item.id, 'status', value)}
                          >
                            <SelectTrigger className="h-8 text-xs print:border-none print:bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Em andamento">Em andamento</SelectItem>
                              <SelectItem value="Pendente">Pendente</SelectItem>
                              <SelectItem value="Concluído">Concluído</SelectItem>
                              <SelectItem value="Cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border border-gray-300 p-1">
                          <Textarea
                            value={item.resposta}
                            onChange={(e) => handleUpdateItem(item.id, 'resposta', e.target.value)}
                            className="min-h-[100px] text-xs print:border-none print:bg-transparent resize-y"
                            rows={4}
                          />
                        </td>
                        <td className="border border-gray-300 p-1 text-center no-print">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item.id)}
                            className="h-6 w-6 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}