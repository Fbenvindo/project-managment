import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, Download, Printer, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Empreendimento, Usuario, Documento } from "@/entities/all";
import { retryWithBackoff } from "@/components/utils/apiUtils";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/577f93874_logo_Interativa_versao_final_sem_fundo_0002.png";

const STATUS_OPTIONS = [
  { value: 'concluido', label: 'Concluído', color: 'bg-green-500' },
  { value: 'pendente', label: 'Pendente', color: 'bg-yellow-400' },
  { value: 'em_andamento', label: 'Em andamento', color: 'bg-orange-400' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-500' },
  { value: 'na', label: 'N/A', color: 'bg-gray-300' },
];

const PAUTA_ITEMS = [
  'Pendências da semana anterior',
  'Posição de produção Semanal (anterior e atual)',
  'Análise quanto a possíveis atrasos e impactos',
  'Planejamento de produção para semana seguinte',
  'Cobranças de terceiros',
  'Dúvidas Gerais',
];

export default function AtaPlanejamento() {
  const [isLoading, setIsLoading] = useState(true);
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  
  // Dados da ATA
  const [ataData, setAtaData] = useState({
    assunto: 'Reunião de Planejamento / Semanal',
    local: 'Home Office',
    data: format(new Date(), 'yyyy-MM-dd'),
    horario: '14h',
    participantes: [],
    folha: '1',
    rev: '00',
    controle: 'RG-PO-27',
  });

  const [providencias, setProvidencias] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [novaProvidencia, setNovaProvidencia] = useState({
    os: '',
    projeto: '',
    numProposta: '',
    providencias: '',
    gerencia: '',
    responsavel: '',
    dataReuniao: '',
    dataRetorno: '',
    status: 'pendente'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [emps, users, docs] = await Promise.all([
        retryWithBackoff(() => Empreendimento.list(), 3, 2000, 'AtaPlanejamento-Empreendimentos'),
        retryWithBackoff(() => Usuario.list(), 3, 2000, 'AtaPlanejamento-Usuarios'),
        retryWithBackoff(() => Documento.list(), 3, 2000, 'AtaPlanejamento-Documentos'),
      ]);
      setEmpreendimentos(emps || []);
      setUsuarios(users || []);
      setDocumentos(docs || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
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
    if (!novaProvidencia.providencias.trim()) return;
    
    setProvidencias(prev => [...prev, { ...novaProvidencia, id: Date.now() }]);
    setNovaProvidencia({
      os: '',
      projeto: '',
      numProposta: '',
      providencias: '',
      gerencia: '',
      responsavel: '',
      dataReuniao: '',
      dataRetorno: '',
      status: 'pendente'
    });
    setShowAddModal(false);
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
    return found ? found.color : 'bg-gray-300';
  };

  const getStatusLabel = (status) => {
    const found = STATUS_OPTIONS.find(s => s.value === status);
    return found ? found.label : status;
  };

  const handlePrint = () => {
    window.print();
  };

  // Agrupar providências por OS/Projeto
  const providenciasAgrupadas = useMemo(() => {
    const grupos = {};
    providencias.forEach(p => {
      const key = `${p.os}-${p.projeto}`;
      if (!grupos[key]) {
        grupos[key] = {
          os: p.os,
          projeto: p.projeto,
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

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Barra de Ações */}
      <div className="mb-4 flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-gray-800">ATA de Planejamento</h1>
        <div className="flex gap-2">
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

      {/* Documento ATA */}
      <div className="bg-white border border-gray-400 print:border-black">
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
            <div className="flex justify-between">
              <span>Controle:</span>
              <span className="font-medium">{ataData.controle}</span>
            </div>
            <div className="flex justify-between">
              <span>Folha:</span>
              <span>{ataData.folha} /</span>
            </div>
            <div className="flex justify-between">
              <span>Rev:</span>
              <span>: {ataData.rev}</span>
            </div>
            <div className="flex justify-between">
              <span>Emissão:</span>
              <span>: / /</span>
            </div>
          </div>
        </div>

        {/* Info da Reunião */}
        <div className="border-b border-gray-400">
          <div className="grid grid-cols-12">
            <div className="col-span-8 border-r border-gray-400 p-2 text-sm">
              <span className="font-medium">Assunto: </span>
              <input 
                type="text" 
                value={ataData.assunto}
                onChange={(e) => setAtaData(prev => ({ ...prev, assunto: e.target.value }))}
                className="border-none outline-none bg-transparent print:bg-transparent"
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
            <div className="p-2 text-sm space-y-1">
              {usuarios.slice(0, 8).map(user => (
                <div 
                  key={user.id} 
                  className={`cursor-pointer hover:bg-gray-100 px-2 py-0.5 rounded ${
                    ataData.participantes.includes(user.email) ? 'bg-blue-50 font-medium' : ''
                  }`}
                  onClick={() => toggleParticipante(user.email)}
                >
                  {user.nome || user.full_name}
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-4">
            <div className="bg-yellow-100 p-1 text-center text-sm font-medium border-b border-gray-400">
              Legenda Status
            </div>
            <div className="p-2 space-y-1">
              {STATUS_OPTIONS.map(status => (
                <div key={status.value} className="flex items-center gap-2 text-xs">
                  <div className={`w-20 text-center py-0.5 ${status.color} text-white rounded`}>
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

        {/* Cabeçalho da Tabela de Providências */}
        <div className="grid grid-cols-12 bg-yellow-100 border-b border-gray-400 text-xs font-medium">
          <div className="col-span-1 p-1 text-center border-r border-gray-400">OS ▼</div>
          <div className="col-span-1 p-1 text-center border-r border-gray-400">Projeto ▼</div>
          <div className="col-span-1 p-1 text-center border-r border-gray-400">Nº Proposta ▼</div>
          <div className="col-span-3 p-1 text-center border-r border-gray-400">Providências</div>
          <div className="col-span-1 p-1 text-center border-r border-gray-400">Gerência</div>
          <div className="col-span-1 p-1 text-center border-r border-gray-400">Responsável▼</div>
          <div className="col-span-1 p-1 text-center border-r border-gray-400">Data da reunião▼</div>
          <div className="col-span-1 p-1 text-center border-r border-gray-400">Data de retorno</div>
          <div className="col-span-2 p-1 text-center">Status / Ações</div>
        </div>

        {/* Linhas de Providências */}
        {providenciasAgrupadas.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Nenhuma providência cadastrada. Clique em "Adicionar Providência" para começar.
          </div>
        ) : (
          providenciasAgrupadas.map((grupo, gIdx) => (
            <React.Fragment key={gIdx}>
              {grupo.items.map((prov, pIdx) => (
                <div 
                  key={prov.id} 
                  className={`grid grid-cols-12 border-b border-gray-300 text-xs ${
                    gIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  {pIdx === 0 && (
                    <>
                      <div 
                        className="col-span-1 p-1 text-center border-r border-gray-300 font-medium bg-yellow-50"
                        style={{ gridRow: `span ${grupo.items.length}` }}
                      >
                        {grupo.os}
                      </div>
                      <div 
                        className="col-span-1 p-1 text-center border-r border-gray-300 bg-yellow-50"
                        style={{ gridRow: `span ${grupo.items.length}` }}
                      >
                        {grupo.projeto}
                      </div>
                    </>
                  )}
                  <div className="col-span-1 p-1 text-center border-r border-gray-300">{prov.numProposta}</div>
                  <div className="col-span-3 p-1 border-r border-gray-300 whitespace-pre-wrap">{prov.providencias}</div>
                  <div className="col-span-1 p-1 text-center border-r border-gray-300">{prov.gerencia}</div>
                  <div className="col-span-1 p-1 text-center border-r border-gray-300">{prov.responsavel}</div>
                  <div className="col-span-1 p-1 text-center border-r border-gray-300">
                    {prov.dataReuniao ? format(new Date(prov.dataReuniao), 'dd/MM/yyyy') : ''}
                  </div>
                  <div className="col-span-1 p-1 text-center border-r border-gray-300">
                    {prov.dataRetorno ? format(new Date(prov.dataRetorno), 'dd/MM/yyyy') : ''}
                  </div>
                  <div className="col-span-2 p-1 flex items-center justify-between gap-1">
                    <select
                      value={prov.status}
                      onChange={(e) => handleUpdateProvidencia(prov.id, 'status', e.target.value)}
                      className={`text-xs px-1 py-0.5 rounded text-white ${getStatusColor(prov.status)} print:bg-transparent print:text-black`}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => handleDeleteProvidencia(prov.id)}
                      className="text-red-500 hover:text-red-700 print:hidden"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Modal Adicionar Providência */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Providência</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">OS</label>
              <Input
                value={novaProvidencia.os}
                onChange={(e) => setNovaProvidencia(prev => ({ ...prev, os: e.target.value }))}
                placeholder="Ex: 813"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Projeto</label>
              <Select
                value={novaProvidencia.projeto}
                onValueChange={(value) => setNovaProvidencia(prev => ({ ...prev, projeto: value }))}
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
              <label className="text-sm font-medium">Nº Proposta</label>
              <Input
                value={novaProvidencia.numProposta}
                onChange={(e) => setNovaProvidencia(prev => ({ ...prev, numProposta: e.target.value }))}
                placeholder="Ex: PP24-1071-R3"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Gerência</label>
              <Input
                value={novaProvidencia.gerencia}
                onChange={(e) => setNovaProvidencia(prev => ({ ...prev, gerencia: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Responsável</label>
              <Select
                value={novaProvidencia.responsavel}
                onValueChange={(value) => setNovaProvidencia(prev => ({ ...prev, responsavel: value }))}
              >
                <SelectTrigger>
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
              <label className="text-sm font-medium">Status</label>
              <Select
                value={novaProvidencia.status}
                onValueChange={(value) => setNovaProvidencia(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Data da Reunião</label>
              <Input
                type="date"
                value={novaProvidencia.dataReuniao}
                onChange={(e) => setNovaProvidencia(prev => ({ ...prev, dataReuniao: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data de Retorno</label>
              <Input
                type="date"
                value={novaProvidencia.dataRetorno}
                onChange={(e) => setNovaProvidencia(prev => ({ ...prev, dataRetorno: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Providências</label>
              <Textarea
                value={novaProvidencia.providencias}
                onChange={(e) => setNovaProvidencia(prev => ({ ...prev, providencias: e.target.value }))}
                placeholder="Descreva as providências..."
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
            <Button onClick={handleAddProvidencia}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}