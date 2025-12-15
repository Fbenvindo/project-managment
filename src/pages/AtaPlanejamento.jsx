import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, Download, Printer, Save, Loader2, Check, FolderOpen, FilePlus, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Empreendimento, Usuario, Documento, AtaReuniao } from "@/entities/all";
import { retryWithBackoff } from "@/components/utils/apiUtils";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/577f93874_logo_Interativa_versao_final_sem_fundo_0002.png";

const STATUS_OPTIONS = [
  { value: 'concluido', label: 'Concluído', color: 'bg-green-600', textColor: 'text-white' },
  { value: 'pendente', label: 'Pendente', color: 'bg-amber-300', textColor: 'text-amber-900' },
  { value: 'em_andamento', label: 'Em andamento', color: 'bg-orange-300', textColor: 'text-orange-900' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-400', textColor: 'text-white' },
  { value: 'na', label: 'N/A', color: 'bg-gray-400', textColor: 'text-white' },
];

const PAUTA_ITEMS = [
  'Pendências da semana anterior',
  'Posição de produção Semanal (anterior e atual)',
  'Análise quanto a possíveis atrasos e impactos',
  'Planejamento de produção para semana seguinte',
  'Cobranças de terceiros',
  'Dúvidas Gerais',
];

// Estilos de impressão
const printStyles = `
@media print {
  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-sizing: border-box !important;
  }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
  }

  .print\\:hidden, .no-print {
    display: none !important;
  }

  /* Esconde sidebar e elementos do layout */
  aside, nav, header, footer, [data-sidebar], [data-radix-popper-content-wrapper] {
    display: none !important;
  }

  main {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    position: static !important;
  }

  main > div {
    overflow: visible !important;
    height: auto !important;
    width: 100% !important;
  }

  /* Esconde botões flutuantes (playlist, timer, etc) */
  [class*="fixed"], button[class*="fixed"], div[class*="fixed"] {
    display: none !important;
  }

  /* Container principal */
  .p-6.bg-gray-100 {
    padding: 0 !important;
    margin: 0 !important;
    background: white !important;
    width: 100% !important;
    height: auto !important;
    min-height: auto !important;
    display: block !important;
  }

  /* Container da ATA na impressão */
  .max-w-\\[297mm\\] {
    max-width: 100% !important;
    width: 100% !important;
    height: auto !important;
    box-shadow: none !important;
    border: 1px solid black !important;
    overflow: visible !important;
  }

  /* Remove barras de rolamento */
  ::-webkit-scrollbar {
    display: none !important;
  }

  * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  /* Grid de 12 colunas - manter estrutura */
  .grid-cols-12 {
    display: grid !important;
    grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
  }

  /* Colunas específicas */
  .col-span-1 { grid-column: span 1 / span 1 !important; }
  .col-span-2 { grid-column: span 2 / span 2 !important; }
  .col-span-3 { grid-column: span 3 / span 3 !important; }
  .col-span-4 { grid-column: span 4 / span 4 !important; }
  .col-span-7 { grid-column: span 7 / span 7 !important; }
  .col-span-8 { grid-column: span 8 / span 8 !important; }
  .col-span-11 { grid-column: span 11 / span 11 !important; }

  /* Bordas */
  .border-r { border-right: 1px solid #9ca3af !important; }
  .border-b { border-bottom: 1px solid #9ca3af !important; }
  .border-gray-400 { border-color: #9ca3af !important; }
  .border-gray-300 { border-color: #d1d5db !important; }

  /* Cores de fundo */
  .bg-yellow-100 { background-color: #fef9c3 !important; }
  .bg-yellow-50 { background-color: #fefce8 !important; }
  .bg-gray-50 { background-color: #f9fafb !important; }
  .bg-white { background-color: white !important; }

  /* Texto - mantém tamanhos legíveis */
  .text-center { text-align: center !important; }
  .text-sm { font-size: 9px !important; }
  .text-xs { font-size: 8px !important; }
  .font-medium { font-weight: 500 !important; }
  .font-bold { font-weight: 700 !important; }

  /* Padding */
  .p-1 { padding: 2px !important; }
  .p-2 { padding: 4px !important; }

  /* Permitir quebra de texto */
  .whitespace-pre-wrap {
    white-space: pre-wrap !important;
    word-break: break-word !important;
  }

  /* Esconder inputs na impressão, mostrar só valor */
  input {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    font-size: 9px !important;
  }

  select {
    -webkit-appearance: none !important;
    appearance: none !important;
    border: none !important;
    background: transparent !important;
  }

  /* Tabela de providências */
  table {
    width: 100% !important;
    table-layout: fixed !important;
    font-size: 8px !important;
  }

  td, th {
    padding: 2px !important;
    word-wrap: break-word !important;
    font-size: 8px !important;
  }

  /* Cabeçalho da tabela */
  .flex.bg-yellow-100 {
    font-size: 8px !important;
  }

  .flex.bg-yellow-100 > div {
    padding: 2px !important;
  }
}
`;

export default function AtaPlanejamento() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [atasRegistradas, setAtasRegistradas] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'edit', 'new'
  const [currentAtaId, setCurrentAtaId] = useState(null);
  
  // Dados da ATA
  const [ataData, setAtaData] = useState({
    assunto: 'Reunião de Planejamento / Semanal',
    local: 'Home Office',
    data: format(new Date(), 'yyyy-MM-dd'),
    horario: '14h',
    participantes: [],
    folha: '1/',
    rev: '00',
    controle: 'RG-PO-27',
    emissao: '/ /',
    status: 'rascunho'
  });

  const [providencias, setProvidencias] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [novaProvidencia, setNovaProvidencia] = useState({
    os: '',
    projeto: '',
    numProposta: '',
    linhas: [{ providencias: '', gerencia: '', responsaveis: [], dataReuniao: '', dataRetorno: '', status: 'pendente' }]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [emps, users, docs, atas] = await Promise.all([
        retryWithBackoff(() => Empreendimento.list(), 3, 2000, 'AtaPlanejamento-Empreendimentos'),
        retryWithBackoff(() => Usuario.list(), 3, 2000, 'AtaPlanejamento-Usuarios'),
        retryWithBackoff(() => Documento.list(), 3, 2000, 'AtaPlanejamento-Documentos'),
        retryWithBackoff(() => AtaReuniao.list('-created_date'), 3, 2000, 'AtaPlanejamento-Atas'),
      ]);
      setEmpreendimentos(emps || []);
      setUsuarios(users || []);
      setDocumentos(docs || []);
      setAtasRegistradas(atas || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAta = async () => {
    setIsSaving(true);
    try {
      const ataToSave = {
        ...ataData,
        providencias: providencias.map(p => ({
          os: p.os,
          projeto: p.projeto,
          numProposta: p.numProposta,
          providencias: p.providencias,
          gerencia: p.gerencia,
          responsaveis: p.responsaveis,
          dataReuniao: p.dataReuniao,
          dataRetorno: p.dataRetorno,
          status: p.status
        }))
      };

      if (currentAtaId) {
        await AtaReuniao.update(currentAtaId, ataToSave);
      } else {
        const newAta = await AtaReuniao.create(ataToSave);
        setCurrentAtaId(newAta.id);
      }
      
      await loadData();
      alert('ATA salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar ATA:', error);
      alert('Erro ao salvar ATA. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewAta = () => {
    setCurrentAtaId(null);
    setAtaData({
      assunto: 'Reunião de Planejamento / Semanal',
      local: 'Home Office',
      data: format(new Date(), 'yyyy-MM-dd'),
      horario: '14h',
      participantes: [],
      folha: '1/',
      rev: '00',
      controle: 'RG-PO-27',
      emissao: '/ /',
      status: 'rascunho'
    });
    setProvidencias([]);
    setViewMode('edit');
  };

  const handleOpenAta = (ata) => {
    setCurrentAtaId(ata.id);
    setAtaData({
      assunto: ata.assunto || '',
      local: ata.local || '',
      data: ata.data || format(new Date(), 'yyyy-MM-dd'),
      horario: ata.horario || '',
      participantes: ata.participantes || [],
      folha: ata.folha || '1/',
      rev: ata.rev || '00',
      controle: ata.controle || 'RG-PO-27',
      emissao: ata.emissao || '/ /',
      status: ata.status || 'rascunho'
    });
    setProvidencias((ata.providencias || []).map((p, idx) => ({ ...p, id: Date.now() + idx })));
    setViewMode('edit');
  };

  const handleDeleteAta = async (ataId) => {
    if (!confirm('Deseja excluir esta ATA?')) return;
    try {
      await AtaReuniao.delete(ataId);
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir ATA:', error);
      alert('Erro ao excluir ATA.');
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setCurrentAtaId(null);
  };

  const toggleParticipante = (email) => {
    setAtaData(prev => ({
      ...prev,
      participantes: prev.participantes.includes(email)
        ? prev.participantes.filter(p => p !== email)
        : [...prev.participantes, email]
    }));
  };

  const handleAddProvidencia = () => {
    const linhasValidas = novaProvidencia.linhas.filter(l => l.providencias.trim());
    if (linhasValidas.length === 0) return;
    
    const novasProvidencias = linhasValidas.map((linha, idx) => ({
      id: Date.now() + idx,
      os: novaProvidencia.os,
      projeto: novaProvidencia.projeto,
      numProposta: novaProvidencia.numProposta,
      providencias: linha.providencias,
      gerencia: linha.gerencia,
      responsaveis: linha.responsaveis,
      dataReuniao: linha.dataReuniao,
      dataRetorno: linha.dataRetorno,
      status: linha.status
    }));
    
    setProvidencias(prev => [...prev, ...novasProvidencias]);
    setNovaProvidencia({
      os: '',
      projeto: '',
      numProposta: '',
      linhas: [{ providencias: '', gerencia: '', responsaveis: [], dataReuniao: '', dataRetorno: '', status: 'pendente' }]
    });
    setShowAddModal(false);
  };

  const handleInsertProvidenciaAfter = (provId) => {
    const index = providencias.findIndex(p => p.id === provId);
    if (index === -1) return;
    
    const provAnterior = providencias[index];
    const novaProvidencia = {
      id: Date.now(),
      os: provAnterior.os,
      projeto: provAnterior.projeto,
      numProposta: provAnterior.numProposta,
      providencias: '',
      gerencia: '',
      responsaveis: [],
      dataReuniao: '',
      dataRetorno: '',
      status: 'pendente'
    };
    
    const novasProvidencias = [
      ...providencias.slice(0, index + 1),
      novaProvidencia,
      ...providencias.slice(index + 1)
    ];
    
    setProvidencias(novasProvidencias);
  };

  const handleAddLinha = () => {
    setNovaProvidencia(prev => ({
      ...prev,
      linhas: [...prev.linhas, { providencias: '', gerencia: '', responsaveis: [], dataReuniao: '', dataRetorno: '', status: 'pendente' }]
    }));
  };

  const handleRemoveLinha = (idx) => {
    if (novaProvidencia.linhas.length <= 1) return;
    setNovaProvidencia(prev => ({
      ...prev,
      linhas: prev.linhas.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateLinha = (idx, field, value) => {
    setNovaProvidencia(prev => ({
      ...prev,
      linhas: prev.linhas.map((linha, i) => i === idx ? { ...linha, [field]: value } : linha)
    }));
  };

  const handleUpdateProvidencia = (id, field, value) => {
    setProvidencias(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleDeleteProvidencia = (id) => {
    if (confirm('Deseja excluir esta providência?')) {
      setProvidencias(prev => prev.filter(p => p.id !== id));
    }
  };

  const getStatusColor = (status) => {
    const found = STATUS_OPTIONS.find(s => s.value === status);
    return found ? `${found.color} ${found.textColor}` : 'bg-gray-300 text-white';
  };

  const getStatusLabel = (status) => {
    const found = STATUS_OPTIONS.find(s => s.value === status);
    return found ? found.label : status;
  };

  const handlePrint = () => {
    window.print();
  };

  // Agrupar providências por OS/Projeto/NumProposta
  const providenciasAgrupadas = useMemo(() => {
    const grupos = {};
    providencias.forEach(p => {
      const key = `${p.os}-${p.projeto}-${p.numProposta}`;
      if (!grupos[key]) {
        grupos[key] = {
          os: p.os,
          projeto: p.projeto,
          numProposta: p.numProposta,
          items: []
        };
      }
      grupos[key].items.push(p);
    });
    return Object.values(grupos);
  }, [providencias]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Tela de Lista de ATAs
  if (viewMode === 'list') {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">ATAs de Reunião</h1>
            <Button onClick={handleNewAta} className="bg-blue-600 hover:bg-blue-700">
              <FilePlus className="w-4 h-4 mr-2" />
              Nova ATA
            </Button>
          </div>

          {atasRegistradas.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Nenhuma ATA registrada</h3>
              <p className="text-gray-500 mb-4">Clique em "Nova ATA" para criar sua primeira ata de reunião.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {atasRegistradas.map(ata => (
                <div key={ata.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <h3 className="font-medium text-gray-800">{ata.assunto}</h3>
                        <p className="text-sm text-gray-500">
                          {ata.data ? format(new Date(ata.data), 'dd/MM/yyyy', { locale: ptBR }) : 'Sem data'} 
                          {ata.horario && ` às ${ata.horario}`}
                          {ata.local && ` - ${ata.local}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${ata.status === 'finalizada' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {ata.status === 'finalizada' ? 'Finalizada' : 'Rascunho'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {ata.providencias?.length || 0} providência(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenAta(ata)}>
                      <FolderOpen className="w-4 h-4 mr-1" />
                      Abrir
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteAta(ata.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{printStyles}</style>
      <div className="p-6 bg-gray-100 min-h-screen print:p-0 print:bg-white print:min-h-0 flex flex-col items-center print:overflow-visible">
      {/* Barra de Ações */}
                <div className="mb-4 flex justify-between items-center no-print w-full max-w-[297mm]">
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={handleBackToList} className="p-2">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-800">
                      {currentAtaId ? 'Editar ATA' : 'Nova ATA'}
                    </h1>
                  </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveAta} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Providência
          </Button>
        </div>
      </div>

      {/* Documento ATA - Formato A4 Paisagem */}
                <div className="bg-white border border-gray-400 print:border-black print:text-[10px] w-full max-w-[297mm] shadow-lg">
        {/* Cabeçalho */}
        <div className="grid grid-cols-12 border-b border-gray-400">
          <div className="col-span-2 border-r border-gray-400 p-2 flex items-center justify-center">
            <img src={LOGO_URL} alt="Logo" className="h-16" />
          </div>
          <div className="col-span-7 border-r border-gray-400">
            <div className="text-center py-1 text-sm font-medium border-b border-gray-400">
              Sistema de Gestão da Qualidade
            </div>
            <div className="text-center py-1 text-sm font-bold border-b border-gray-400">
              REGISTRO
            </div>
            <div className="text-center py-1 text-sm font-bold">
              Ata de Reunião
            </div>
          </div>
          <div className="col-span-3 text-xs p-2">
                            <div className="flex justify-between items-center">
                              <span>Controle:</span>
                              <input 
                                type="text" 
                                value={ataData.controle}
                                onChange={(e) => setAtaData(prev => ({ ...prev, controle: e.target.value }))}
                                className="border-none outline-none bg-transparent text-right font-medium w-20 print:bg-transparent"
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Folha:</span>
                              <input 
                                type="text" 
                                value={ataData.folha}
                                onChange={(e) => setAtaData(prev => ({ ...prev, folha: e.target.value }))}
                                className="border-none outline-none bg-transparent text-right w-12 print:bg-transparent"
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Rev:</span>
                              <input 
                                type="text" 
                                value={ataData.rev}
                                onChange={(e) => setAtaData(prev => ({ ...prev, rev: e.target.value }))}
                                className="border-none outline-none bg-transparent text-right w-12 print:bg-transparent"
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Emissão:</span>
                              <input 
                                type="text" 
                                value={ataData.emissao}
                                onChange={(e) => setAtaData(prev => ({ ...prev, emissao: e.target.value }))}
                                className="border-none outline-none bg-transparent text-right w-16 print:bg-transparent"
                              />
                            </div>
                          </div>
        </div>

        {/* Info da Reunião */}
        <div className="border-b border-gray-400">
          <div className="grid grid-cols-12">
            <div className="col-span-8 border-r border-gray-400 p-2 text-sm flex items-center">
                                <span className="font-medium whitespace-nowrap">Assunto: </span>
                                <input 
                                  type="text" 
                                  value={ataData.assunto}
                                  onChange={(e) => setAtaData(prev => ({ ...prev, assunto: e.target.value }))}
                                  className="border-none outline-none bg-transparent print:bg-transparent flex-1 w-full"
                                />
                              </div>
            <div className="col-span-4 p-2 text-sm">
              <span className="font-medium">Data: </span>
              <input 
                type="text" 
                value={format(new Date(), "EEEE", { locale: ptBR })}
                className="border-none outline-none bg-transparent capitalize print:bg-transparent"
                readOnly
              />
            </div>
          </div>
          <div className="grid grid-cols-12 border-t border-gray-400">
            <div className="col-span-8 border-r border-gray-400 p-2 text-sm">
              <span className="font-medium">Local: </span>
              <input 
                type="text" 
                value={ataData.local}
                onChange={(e) => setAtaData(prev => ({ ...prev, local: e.target.value }))}
                className="border-none outline-none bg-transparent print:bg-transparent"
              />
            </div>
            <div className="col-span-4 p-2 text-sm">
              <span className="font-medium">Horário: </span>
              <input 
                type="text" 
                value={ataData.horario}
                onChange={(e) => setAtaData(prev => ({ ...prev, horario: e.target.value }))}
                className="border-none outline-none bg-transparent print:bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Participantes e Legenda */}
        <div className="grid grid-cols-12 border-b border-gray-400">
          <div className="col-span-8 border-r border-gray-400">
            <div className="bg-yellow-100 p-1 text-center text-sm font-medium border-b border-gray-400">
              Participantes
            </div>
            <div className="p-2 text-sm">
              {/* Participantes selecionados */}
              <div className="space-y-1 print:space-y-0">
                {ataData.participantes.map(email => {
                  const user = usuarios.find(u => u.email === email);
                  return user ? (
                    <div 
                      key={user.id} 
                      className="cursor-pointer hover:bg-red-50 px-2 py-0.5 rounded flex items-center gap-2 bg-green-100 font-medium no-print"
                      onClick={() => toggleParticipante(user.email)}
                      title="Clique para remover"
                    >
                      <div className="w-4 h-4 border rounded flex items-center justify-center bg-green-500 border-green-500 text-white">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-green-800">{user.nome || user.full_name}</span>
                    </div>
                  ) : null;
                })}
                {/* Lista para impressão */}
                {ataData.participantes.map(email => {
                  const user = usuarios.find(u => u.email === email);
                  return user ? (
                    <div key={`print-${user.id}`} className="hidden print:block py-0.5">
                      {user.nome || user.full_name}
                    </div>
                  ) : null;
                })}
              </div>
              {/* Dropdown para adicionar */}
              <div className="mt-2 no-print">
                <Select onValueChange={(email) => toggleParticipante(email)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Adicionar participante" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios
                      .filter(u => !ataData.participantes.includes(u.email))
                      .map(user => (
                        <SelectItem key={user.id} value={user.email}>
                          {user.nome || user.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="col-span-4">
            <div className="bg-yellow-100 p-1 text-center text-sm font-medium border-b border-gray-400">
              Legenda Status
            </div>
            <div className="p-2 space-y-1">
              {STATUS_OPTIONS.map(status => (
                <div key={status.value} className="flex items-center gap-2 text-xs">
                  <div className={`w-20 text-center py-0.5 ${status.color} ${status.textColor} rounded`}>
                    {status.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pauta */}
        <div className="border-b border-gray-400">
          <div className="grid grid-cols-12 bg-yellow-100 border-b border-gray-400">
            <div className="col-span-1 p-1 text-center text-sm font-medium border-r border-gray-400">Item</div>
            <div className="col-span-11 p-1 text-sm font-medium">Pauta</div>
          </div>
          {PAUTA_ITEMS.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 border-b border-gray-300 last:border-b-0">
              <div className="col-span-1 p-1 text-center text-sm border-r border-gray-300">{idx + 1}</div>
              <div className="col-span-11 p-1 text-sm">{item}</div>
            </div>
          ))}
        </div>

        {/* Tabela de Providências */}
        {providenciasAgrupadas.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Nenhuma providência cadastrada. Clique em "Adicionar Providência" para começar.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-yellow-100 border-b border-gray-400 text-xs font-medium">
                <th className="w-[6%] p-1 text-center border-r border-gray-400">OS ▼</th>
                <th className="w-[10%] p-1 text-center border-r border-gray-400">Projeto ▼</th>
                <th className="w-[8%] p-1 text-center border-r border-gray-400">Nº Proposta ▼</th>
                <th className="w-[30%] p-1 text-center border-r border-gray-400">Providências</th>
                <th className="w-[8%] p-1 text-center border-r border-gray-400">Gerência</th>
                <th className="w-[10%] p-1 text-center border-r border-gray-400">Responsável▼</th>
                <th className="w-[8%] p-1 text-center border-r border-gray-400">Data da reunião▼</th>
                <th className="w-[8%] p-1 text-center border-r border-gray-400">Data de retorno</th>
                <th className="w-[12%] p-1 text-center">Status / Ações</th>
              </tr>
            </thead>
            <tbody>
              {providenciasAgrupadas.map((grupo, gIdx) => (
                grupo.items.map((prov, pIdx) => (
                  <tr 
                    key={prov.id} 
                    className={`border-b border-gray-300 ${gIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    {pIdx === 0 && (
                      <>
                        <td 
                          rowSpan={grupo.items.length}
                          className="w-[6%] p-1 text-center border-r border-gray-300 font-medium bg-yellow-50 align-middle"
                        >
                          {grupo.os}
                        </td>
                        <td 
                          rowSpan={grupo.items.length}
                          className="w-[10%] p-1 text-center border-r border-gray-300 bg-yellow-50 align-middle"
                        >
                          {grupo.projeto}
                        </td>
                        <td 
                          rowSpan={grupo.items.length}
                          className="w-[8%] p-1 text-center border-r border-gray-300 bg-yellow-50 align-middle"
                        >
                          {grupo.numProposta}
                        </td>
                      </>
                    )}
                    <td className="w-[30%] p-1 border-r border-gray-300">
                      <Textarea
                        value={prov.providencias}
                        onChange={(e) => handleUpdateProvidencia(prov.id, 'providencias', e.target.value)}
                        className="min-h-[60px] text-xs print:hidden"
                      />
                      <span className="hidden print:inline whitespace-pre-wrap">{prov.providencias}</span>
                    </td>
                    <td className="w-[8%] p-1 border-r border-gray-300">
                      <Input
                        value={prov.gerencia}
                        onChange={(e) => handleUpdateProvidencia(prov.id, 'gerencia', e.target.value)}
                        className="h-8 text-xs print:hidden"
                      />
                      <span className="hidden print:inline">{prov.gerencia}</span>
                    </td>
                    <td className="w-[10%] p-1 border-r border-gray-300">
                      <Select
                        value={prov.responsaveis?.[0] || ''}
                        onValueChange={(value) => handleUpdateProvidencia(prov.id, 'responsaveis', [value])}
                      >
                        <SelectTrigger className="h-8 text-xs print:hidden">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {usuarios.map(user => (
                            <SelectItem key={user.id} value={user.nome || user.full_name}>
                              {user.nome || user.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="hidden print:inline">
                        {Array.isArray(prov.responsaveis) ? prov.responsaveis.join(', ') : ''}
                      </span>
                    </td>
                    <td className="w-[8%] p-1 border-r border-gray-300">
                      <Input
                        type="date"
                        value={prov.dataReuniao}
                        onChange={(e) => handleUpdateProvidencia(prov.id, 'dataReuniao', e.target.value)}
                        className="h-8 text-xs print:hidden"
                      />
                      <span className="hidden print:inline">
                        {prov.dataReuniao ? format(new Date(prov.dataReuniao), 'dd/MM/yyyy') : ''}
                      </span>
                    </td>
                    <td className="w-[8%] p-1 border-r border-gray-300">
                      <Input
                        type="date"
                        value={prov.dataRetorno}
                        onChange={(e) => handleUpdateProvidencia(prov.id, 'dataRetorno', e.target.value)}
                        className="h-8 text-xs print:hidden"
                      />
                      <span className="hidden print:inline">
                        {prov.dataRetorno ? format(new Date(prov.dataRetorno), 'dd/MM/yyyy') : ''}
                      </span>
                    </td>
                    <td className="w-[12%] p-1">
                      <div className="flex items-center justify-between gap-1">
                        <select
                          value={prov.status}
                          onChange={(e) => handleUpdateProvidencia(prov.id, 'status', e.target.value)}
                          className={`text-xs px-2 py-1 rounded ${getStatusColor(prov.status)} print:hidden flex-1`}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <span className={`hidden print:inline text-xs px-2 py-1 rounded ${getStatusColor(prov.status)}`}>
                          {getStatusLabel(prov.status)}
                        </span>
                        <button 
                          onClick={() => handleInsertProvidenciaAfter(prov.id)}
                          className="text-green-600 hover:text-green-800 no-print"
                          title="Inserir providência após esta"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handleDeleteProvidencia(prov.id)}
                          className="text-red-500 hover:text-red-700 no-print"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Adicionar Providência */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Providências</DialogTitle>
          </DialogHeader>
          
          {/* Dados do Projeto (compartilhados) */}
          <div className="grid grid-cols-3 gap-4 pb-4 border-b">
            <div>
              <label className="text-sm font-medium">Projeto</label>
              <Select
                value={novaProvidencia.projeto}
                onValueChange={(value) => {
                  const empSelecionado = empreendimentos.find(e => e.nome === value);
                  const osExtraida = empSelecionado?.nome?.match(/^\d+/)?.[0] || empSelecionado?.os || '';
                  setNovaProvidencia(prev => ({ 
                    ...prev, 
                    projeto: value,
                    os: osExtraida,
                    numProposta: empSelecionado?.num_proposta || ''
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {empreendimentos.map(emp => (
                    <SelectItem key={emp.id} value={emp.nome}>{emp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">OS</label>
              <Input
                value={novaProvidencia.os}
                onChange={(e) => setNovaProvidencia(prev => ({ ...prev, os: e.target.value }))}
                placeholder="Ex: 813"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nº Proposta</label>
              <Input
                value={novaProvidencia.numProposta}
                onChange={(e) => setNovaProvidencia(prev => ({ ...prev, numProposta: e.target.value }))}
                placeholder="Ex: PP24-1071-R3"
              />
            </div>
          </div>

          {/* Lista de Providências */}
          <div className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Providências</label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLinha}>
                <Plus className="w-3 h-3 mr-1" />
                Adicionar Linha
              </Button>
            </div>
            
            {novaProvidencia.linhas.map((linha, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Providência {idx + 1}</span>
                  {novaProvidencia.linhas.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 h-6 px-2" onClick={() => handleRemoveLinha(idx)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                
                <div>
                  <Textarea
                    value={linha.providencias}
                    onChange={(e) => handleUpdateLinha(idx, 'providencias', e.target.value)}
                    placeholder="Descreva a providência..."
                    rows={2}
                  />
                </div>
                
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Gerência</label>
                    <Input
                      value={linha.gerencia}
                      onChange={(e) => handleUpdateLinha(idx, 'gerencia', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Responsável</label>
                    <Select
                      value={linha.responsaveis?.[0] || ''}
                      onValueChange={(value) => handleUpdateLinha(idx, 'responsaveis', [value])}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {usuarios.map(user => (
                          <SelectItem key={user.id} value={user.nome || user.full_name}>
                            {user.nome || user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Data Reunião</label>
                    <Input
                      type="date"
                      value={linha.dataReuniao}
                      onChange={(e) => handleUpdateLinha(idx, 'dataReuniao', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Data Retorno</label>
                    <Input
                      type="date"
                      value={linha.dataRetorno}
                      onChange={(e) => handleUpdateLinha(idx, 'dataRetorno', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <Select
                      value={linha.status}
                      onValueChange={(value) => handleUpdateLinha(idx, 'status', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
            <Button onClick={handleAddProvidencia}>Adicionar {novaProvidencia.linhas.filter(l => l.providencias.trim()).length} Providência(s)</Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}