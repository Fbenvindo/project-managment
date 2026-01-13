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


          {/* Atividades Vinculadas do Empreendimento */}
          {atividadesVinculadas.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Atividades do Empreendimento</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {atividadesVinculadas.map(ativ => {
                  const status = controleOS.atividades_vinculadas?.[ativ.key] || 'NA';
                  return (
                    <div key={ativ.key}>
                      <label className="text-sm font-medium text-gray-700 mb-1 block truncate" title={ativ.nome}>
                        {ativ.nome}
                      </label>
                      <Select value={status} onValueChange={(v) => handleAtividadeChange(ativ.key, v)}>
                        <SelectTrigger className={getStatusColor(status)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          </div>

          <div className="border rounded-lg bg-white mt-4">
            <div className="p-4 bg-gray-800 text-white font-bold rounded-t-lg">ART</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="border border-gray-300 p-2 text-center font-bold bg-gray-600 text-white">EE/AIS</th>
                    <th className="border border-gray-300 p-2 text-center font-bold bg-gray-600 text-white">HID/IN</th>
                    <th className="border border-gray-300 p-2 text-center font-bold bg-gray-600 text-white">HVAC</th>
                    <th className="border border-gray-300 p-2 text-center font-bold bg-gray-600 text-white">BOMB</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-2">
                      <Select value={controleOS.art_ee_ais} onValueChange={(v) => handleFieldChange('art_ee_ais', v)}>
                        <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.art_ee_ais)}`}>
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
                      <Select value={controleOS.art_hid_in} onValueChange={(v) => handleFieldChange('art_hid_in', v)}>
                        <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.art_hid_in)}`}>
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
                      <Select value={controleOS.art_hvac} onValueChange={(v) => handleFieldChange('art_hvac', v)}>
                        <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.art_hvac)}`}>
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
                      <Select value={controleOS.art_bomb} onValueChange={(v) => handleFieldChange('art_bomb', v)}>
                        <SelectTrigger className={`h-8 text-xs ${getStatusColor(controleOS.art_bomb)}`}>
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
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ART - EE/AIS</label>
                <Select value={controleOS.art_ee_ais} onValueChange={(v) => handleFieldChange('art_ee_ais', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.art_ee_ais)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ART - HID/IN</label>
                <Select value={controleOS.art_hid_in} onValueChange={(v) => handleFieldChange('art_hid_in', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.art_hid_in)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ART - HVAC</label>
                <Select value={controleOS.art_hvac} onValueChange={(v) => handleFieldChange('art_hvac', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.art_hvac)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>



          {/* Planejamento */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Planejamento</h3>
            
            {/* Hidráulica */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Hidráulica</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Concepção</label>
                  <Select value={controleOS.planejamento?.hidraulica?.concepcao || 'NA'} onValueChange={(v) => handlePlanejamentoChange('hidraulica', 'concepcao', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.hidraulica?.concepcao || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Cálculo</label>
                  <Select value={controleOS.planejamento?.hidraulica?.calculo || 'NA'} onValueChange={(v) => handlePlanejamentoChange('hidraulica', 'calculo', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.hidraulica?.calculo || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Diagrama</label>
                  <Select value={controleOS.planejamento?.hidraulica?.diagrama || 'NA'} onValueChange={(v) => handlePlanejamentoChange('hidraulica', 'diagrama', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.hidraulica?.diagrama || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Elétrica */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Elétrica</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Concepção</label>
                  <Select value={controleOS.planejamento?.eletrica?.concepcao || 'NA'} onValueChange={(v) => handlePlanejamentoChange('eletrica', 'concepcao', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.eletrica?.concepcao || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Cálculo</label>
                  <Select value={controleOS.planejamento?.eletrica?.calculo || 'NA'} onValueChange={(v) => handlePlanejamentoChange('eletrica', 'calculo', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.eletrica?.calculo || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Diagrama</label>
                  <Select value={controleOS.planejamento?.eletrica?.diagrama || 'NA'} onValueChange={(v) => handlePlanejamentoChange('eletrica', 'diagrama', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.eletrica?.diagrama || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Incêndio */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Incêndio</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Concepção</label>
                  <Select value={controleOS.planejamento?.incendio?.concepcao || 'NA'} onValueChange={(v) => handlePlanejamentoChange('incendio', 'concepcao', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.incendio?.concepcao || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Cálculo</label>
                  <Select value={controleOS.planejamento?.incendio?.calculo || 'NA'} onValueChange={(v) => handlePlanejamentoChange('incendio', 'calculo', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.incendio?.calculo || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Diagrama</label>
                  <Select value={controleOS.planejamento?.incendio?.diagrama || 'NA'} onValueChange={(v) => handlePlanejamentoChange('incendio', 'diagrama', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.incendio?.diagrama || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sistemas Eletrônicos */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Sistemas Eletrônicos</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Concepção</label>
                  <Select value={controleOS.planejamento?.sistemas_eletronicos?.concepcao || 'NA'} onValueChange={(v) => handlePlanejamentoChange('sistemas_eletronicos', 'concepcao', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.sistemas_eletronicos?.concepcao || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Cálculo</label>
                  <Select value={controleOS.planejamento?.sistemas_eletronicos?.calculo || 'NA'} onValueChange={(v) => handlePlanejamentoChange('sistemas_eletronicos', 'calculo', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.sistemas_eletronicos?.calculo || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Diagrama</label>
                  <Select value={controleOS.planejamento?.sistemas_eletronicos?.diagrama || 'NA'} onValueChange={(v) => handlePlanejamentoChange('sistemas_eletronicos', 'diagrama', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.sistemas_eletronicos?.diagrama || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Ar Condicionado */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Ar Condicionado</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Concepção</label>
                  <Select value={controleOS.planejamento?.ar_condicionado?.concepcao || 'NA'} onValueChange={(v) => handlePlanejamentoChange('ar_condicionado', 'concepcao', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.ar_condicionado?.concepcao || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Cálculo</label>
                  <Select value={controleOS.planejamento?.ar_condicionado?.calculo || 'NA'} onValueChange={(v) => handlePlanejamentoChange('ar_condicionado', 'calculo', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.ar_condicionado?.calculo || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Diagrama</label>
                  <Select value={controleOS.planejamento?.ar_condicionado?.diagrama || 'NA'} onValueChange={(v) => handlePlanejamentoChange('ar_condicionado', 'diagrama', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.ar_condicionado?.diagrama || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Memorial */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Memorial</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Esp. Téc.</label>
                  <Select value={controleOS.planejamento?.memorial?.esp_tec || 'NA'} onValueChange={(v) => handlePlanejamentoChange('memorial', 'esp_tec', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.memorial?.esp_tec || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">MatLib</label>
                  <Select value={controleOS.planejamento?.memorial?.matlib || 'NA'} onValueChange={(v) => handlePlanejamentoChange('memorial', 'matlib', v)}>
                    <SelectTrigger className={getStatusColor(controleOS.planejamento?.memorial?.matlib || 'NA')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          </div>

          <div className="border rounded-lg bg-white mt-4">
            <div className="p-4 bg-gray-800 text-white font-bold rounded-t-lg">CONCESSIONÁRIAS</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Telefonia</th>
                    <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Gás</th>
                    <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Elétrica</th>
                    <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Hidráulica</th>
                    <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Água Pluvial</th>
                    <th className="border border-gray-300 p-2 text-center font-bold bg-blue-600 text-white">Incêndio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Telefonia</label>
                <Select value={controleOS.conc_telefonia} onValueChange={(v) => handleFieldChange('conc_telefonia', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.conc_telefonia)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Gás</label>
                <Select value={controleOS.conc_gas} onValueChange={(v) => handleFieldChange('conc_gas', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.conc_gas)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Elétrica</label>
                <Select value={controleOS.conc_eletrica} onValueChange={(v) => handleFieldChange('conc_eletrica', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.conc_eletrica)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Hidráulica</label>
                <Select value={controleOS.conc_hidraulica} onValueChange={(v) => handleFieldChange('conc_hidraulica', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.conc_hidraulica)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Água Pluvial</label>
                <Select value={controleOS.conc_agua_pluvial} onValueChange={(v) => handleFieldChange('conc_agua_pluvial', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.conc_agua_pluvial)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Incêndio</label>
                <Select value={controleOS.conc_incendio} onValueChange={(v) => handleFieldChange('conc_incendio', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.conc_incendio)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Avanço */}
          <div>
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="text-lg font-semibold text-gray-800">Avanço</h3>
              <Button onClick={handleAddAvancoItem} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Item
              </Button>
            </div>
            
            {controleOS.avanco && controleOS.avanco.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-800">
                      <TableHead className="text-white font-semibold">Etapa</TableHead>
                      <TableHead className="text-white font-semibold w-[200px]">Status</TableHead>
                      <TableHead className="text-white font-semibold">Observações</TableHead>
                      <TableHead className="text-white font-semibold w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {controleOS.avanco.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select 
                            value={item.etapa || ''} 
                            onValueChange={(v) => handleAvancoChange(index, 'etapa', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Nome da etapa" />
                            </SelectTrigger>
                            <SelectContent>
                              {ETAPAS_OPTIONS.map(etapa => (
                                <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={item.status || 'NA'} 
                            onValueChange={(v) => handleAvancoChange(index, 'status', v)}
                          >
                            <SelectTrigger className={getStatusColor(item.status || 'NA')}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={item.observacoes || ''}
                            onChange={(e) => handleAvancoChange(index, 'observacoes', e.target.value)}
                            placeholder="Observações"
                            className="min-h-[60px] w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAvancoItem(index)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                Nenhum item de avanço adicionado. Clique em "Adicionar Item" para começar.
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Observações</h3>
            <Textarea
              value={controleOS.observacoes || ''}
              onChange={(e) => handleFieldChange('observacoes', e.target.value)}
              placeholder="Adicione observações gerais sobre o controle de OS..."
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}