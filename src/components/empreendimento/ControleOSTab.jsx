import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, ClipboardList } from "lucide-react";
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

const getStatusColor = (status) => {
  const option = STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.color || "bg-gray-200 text-gray-800";
};

export default function ControleOSTab({ empreendimento, atividades }) {
  const [controleOS, setControleOS] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    loadControleOS();
  }, [empreendimento?.id]);

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
          gestao: 'NA',
          formalizacao: 'NA',
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Controle de Ordem de Serviço
          </CardTitle>
          <Button onClick={handleSave} disabled={isSaving}>
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
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campos Fixos */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Gestão Geral</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Gestão</label>
                <Select value={controleOS.gestao} onValueChange={(v) => handleFieldChange('gestao', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.gestao)}>
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
                <label className="text-sm font-medium text-gray-700 mb-1 block">Formalização</label>
                <Select value={controleOS.formalizacao} onValueChange={(v) => handleFieldChange('formalizacao', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.formalizacao)}>
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
                <label className="text-sm font-medium text-gray-700 mb-1 block">Abertura OS - Servidor</label>
                <Select value={controleOS.abertura_os_servidor} onValueChange={(v) => handleFieldChange('abertura_os_servidor', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.abertura_os_servidor)}>
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
                <label className="text-sm font-medium text-gray-700 mb-1 block">Atividades Planejamento</label>
                <Select value={controleOS.atividades_planejamento} onValueChange={(v) => handleFieldChange('atividades_planejamento', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.atividades_planejamento)}>
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
                <label className="text-sm font-medium text-gray-700 mb-1 block">Kick off com Cliente</label>
                <Select value={controleOS.kickoff_cliente} onValueChange={(v) => handleFieldChange('kickoff_cliente', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.kickoff_cliente)}>
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

          {/* ART (Manual) */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">ART</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ART - BOMB</label>
                <Select value={controleOS.art_bomb} onValueChange={(v) => handleFieldChange('art_bomb', v)}>
                  <SelectTrigger className={getStatusColor(controleOS.art_bomb)}>
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

          {/* Concessionárias */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Concessionárias</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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