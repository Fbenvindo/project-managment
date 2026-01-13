import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Loader2, ClipboardList, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_OPTIONS = [
  { value: "NA", label: "N/A", color: "bg-gray-200 text-gray-800" },
  { value: "Concluído", label: "Concluído", color: "bg-green-200 text-green-800" },
  { value: "Pendente", label: "Pendente", color: "bg-red-200 text-red-800" },
  { value: "Em andamento", label: "Em andamento", color: "bg-yellow-200 text-yellow-800" },
  { value: "Hold", label: "Hold", color: "bg-orange-200 text-orange-800" },
  { value: "Paralisado", label: "Paralisado", color: "bg-orange-300 text-orange-900" },
  { value: "Técnico", label: "Técnico", color: "bg-blue-200 text-blue-800" },
  { value: "Ag. Liberação", label: "Ag. Liberação", color: "bg-cyan-200 text-cyan-800" },
  { value: "Finalizado", label: "Finalizado", color: "bg-purple-200 text-purple-800" },
  { value: "Em aprovação", label: "Em aprovação", color: "bg-yellow-300 text-yellow-900" }
];

const ETAPAS_OPTIONS = [
  "Pré-Executivo",
  "Projeto Executivo",
  "Liberado Obra",
  "Acompanhamento Obra",
  "Anis Projeto",
  "Emissão Executivo",
  "As Projetado"
];

const getStatusColor = (status) => {
  const option = STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.color || "bg-gray-200 text-gray-800";
};

export default function ControleOSTab({ empreendimento, atividades }) {
  const [controleOS, setControleOS] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [usuarios, setUsuarios] = useState([]);

  // Identificar atividades do empreendimento que devem aparecer como colunas
  const atividadesVinculadas = useMemo(() => {
    if (!atividades || !empreendimento) return [];
    
    const atividadesEspecificas = atividades.filter(ativ => 
      ativ.empreendimento_id === empreendimento.id &&
      ativ.disciplina === 'Gestão'
    );

    return atividadesEspecificas.map(ativ => ({
      id: ativ.id,
      nome: ativ.atividade || ativ.subdisciplina,
      key: `ativ_${ativ.id}`
    }));
  }, [atividades, empreendimento]);

  useEffect(() => {
    loadUsuarios();
    loadControleOS();
  }, [empreendimento?.id]);

  useEffect(() => {
    if (controleOS && atividades) {
      updateMarkupStatus();
    }
  }, [atividades, controleOS?.id]);

  const loadUsuarios = async () => {
    try {
      const usuariosData = await base44.entities.Usuario.list();
      setUsuarios(usuariosData || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const mapStatusToControleOS = (status) => {
    const statusMap = {
      'nao_iniciado': 'Pendente',
      'em_andamento': 'Em andamento',
      'concluido': 'Concluído',
      'atrasado': 'Pendente',
      'pausado': 'Hold'
    };
    return statusMap[status?.toLowerCase()] || 'NA';
  };

  const updateMarkupStatus = () => {
    if (!atividades || !empreendimento) return;
    
    const markupAtividade = atividades.find(ativ => 
      ativ.empreendimento_id === empreendimento.id &&
      ativ.atividade?.toLowerCase().includes('markup')
    );
    
    const cronogramaAtividade = atividades.find(ativ => 
      ativ.empreendimento_id === empreendimento.id &&
      ativ.atividade?.toLowerCase().includes('cronograma')
    );
    
    setControleOS(prev => {
      let updated = { ...prev };
      
      if (markupAtividade && markupAtividade.status) {
        const novoStatus = mapStatusToControleOS(markupAtividade.status);
        if (novoStatus !== prev.markup) {
          updated.markup = novoStatus;
        }
      }
      
      if (cronogramaAtividade && cronogramaAtividade.status) {
        const novoStatus = mapStatusToControleOS(cronogramaAtividade.status);
        if (novoStatus !== prev.cronograma) {
          updated.cronograma = novoStatus;
        }
      }
      
      return updated;
    });
  };

  const loadControleOS = async () => {
    if (!empreendimento?.id) return;
    
    setIsLoading(true);
    try {
      const existing = await base44.entities.ControleOS.filter({
        empreendimento_id: empreendimento.id
      });

      if (existing && existing.length > 0) {
        setControleOS(existing[0]);
      } else {
        // Criar registro inicial
        const inicial = {
          empreendimento_id: empreendimento.id,
          os: empreendimento.os || '',
          gestao: '',
          formalizacao: '',
          cronograma: 'NA',
          markup: 'NA',
          abertura_os_servidor: 'NA',
          atividades_planejamento: 'NA',
          kickoff_cliente: 'NA',
          art_ee_ais: 'NA',
          art_hid_in: 'NA',
          art_hvac: 'NA',
          art_bomb: 'NA',
          conc_telefonia: 'NA',
          conc_gas: 'NA',
          conc_eletrica: 'NA',
          conc_hidraulica: 'NA',
          conc_agua_pluvial: 'NA',
          conc_incendio: 'NA',
          atividades_vinculadas: {},
          planejamento: {
            hidraulica: { concepcao: 'NA', calculo: 'NA', diagrama: 'NA' },
            eletrica: { concepcao: 'NA', calculo: 'NA', diagrama: 'NA' },
            incendio: { concepcao: 'NA', calculo: 'NA', diagrama: 'NA' },
            sistemas_eletronicos: { concepcao: 'NA', calculo: 'NA', diagrama: 'NA' },
            ar_condicionado: { concepcao: 'NA', calculo: 'NA', diagrama: 'NA' },
            memorial: { esp_tec: 'NA', matlib: 'NA' }
          },
          avanco: [],
          observacoes: ''
        };
        
        const created = await base44.entities.ControleOS.create(inicial);
        setControleOS(created);
      }
    } catch (error) {
      console.error('Erro ao carregar Controle OS:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setControleOS(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAtividadeChange = (atividadeKey, status) => {
    setControleOS(prev => ({
      ...prev,
      atividades_vinculadas: {
        ...(prev.atividades_vinculadas || {}),
        [atividadeKey]: status
      }
    }));
  };

  const handlePlanejamentoChange = (disciplina, campo, status) => {
    setControleOS(prev => ({
      ...prev,
      planejamento: {
        ...(prev.planejamento || {}),
        [disciplina]: {
          ...(prev.planejamento?.[disciplina] || {}),
          [campo]: status
        }
      }
    }));
  };

  const handleAddAvancoItem = () => {
    setControleOS(prev => ({
      ...prev,
      avanco: [...(prev.avanco || []), { etapa: '', status: 'NA', observacoes: '' }]
    }));
  };

  const handleRemoveAvancoItem = (index) => {
    setControleOS(prev => ({
      ...prev,
      avanco: prev.avanco.filter((_, i) => i !== index)
    }));
  };

  const handleAvancoChange = (index, field, value) => {
    setControleOS(prev => ({
      ...prev,
      avanco: prev.avanco.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSave = async () => {
    if (!controleOS) return;
    
    setIsSaving(true);
    try {
      await base44.entities.ControleOS.update(controleOS.id, controleOS);
      alert('Controle de OS salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar Controle de OS');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!controleOS) {
    return (
      <div className="text-center py-8 text-gray-500">
        Erro ao carregar dados de Controle de OS
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg bg-white">
        <div className="flex items-center justify-between p-4 bg-gray-800 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            <h2 className="text-lg font-bold">Controle de Ordem de Serviço</h2>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="border border-gray-300 p-2 text-left font-bold bg-gray-800 text-white w-16">OS</th>
                <th className="border border-gray-300 p-2 text-left font-bold bg-gray-600 text-white">Gestão</th>
                <th className="border border-gray-300 p-2 text-left font-bold bg-gray-600 text-white">Formalização</th>
                <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Abertura</th>
                <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Atividades Planej.</th>
                <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Kick off</th>
                <th className="border border-gray-300 p-2 text-center font-bold bg-purple-600 text-white">Cronograma</th>
                <th className="border border-gray-300 p-2 text-center font-bold bg-purple-600 text-white">Markup</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-gray-50">
                <td className="border border-gray-300 p-2 font-semibold bg-gray-50">{controleOS.os}</td>
                <td className="border border-gray-300 p-2">
                  <Select value={controleOS.gestao} onValueChange={(v) => handleFieldChange('gestao', v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map(user => (
                        <SelectItem key={user.email} value={user.nome || user.email}>
                          {user.nome || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2">
                  <input 
                    type="text"
                    value={controleOS.formalizacao} 
                    onChange={(e) => handleFieldChange('formalizacao', e.target.value)}
                    className="w-full h-8 px-2 text-xs border border-gray-300 rounded"
                    placeholder="-"
                  />
                </td>
                <td className="border border-gray-300 p-2">
                  <Select value={controleOS.abertura_os_servidor} onValueChange={(v) => handleFieldChange('abertura_os_servidor', v)}>
                    <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.abertura_os_servidor)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2">
                  <Select value={controleOS.atividades_planejamento} onValueChange={(v) => handleFieldChange('atividades_planejamento', v)}>
                    <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.atividades_planejamento)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2">
                  <Select value={controleOS.kickoff_cliente} onValueChange={(v) => handleFieldChange('kickoff_cliente', v)}>
                    <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.kickoff_cliente)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2">
                  <Select value={controleOS.cronograma} onValueChange={(v) => handleFieldChange('cronograma', v)}>
                    <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.cronograma)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="border border-gray-300 p-2">
                  <Select value={controleOS.markup} onValueChange={(v) => handleFieldChange('markup', v)}>
                    <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.markup)}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </div>
        </div>
        );
        }