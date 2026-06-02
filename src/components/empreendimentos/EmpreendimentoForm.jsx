import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Upload, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { motion } from "framer-motion";
import { UploadFile } from "@/integrations/Core";

const ETAPAS_DEFAULT = [
  "Estudo Preliminar",
  "Ante-Projeto",
  "Projeto Básico",
  "Projeto Executivo",
  "Liberado para Obra"
];

export default function EmpreendimentoForm({ empreendimento, onSubmit, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    nome: empreendimento?.nome || "",
    cliente: empreendimento?.cliente || "",
    endereco: empreendimento?.endereco || "",
    num_proposta: empreendimento?.num_proposta || "",
    status: empreendimento?.status || "em_planejamento",
    foto_url: empreendimento?.foto_url || "",
    etapas: empreendimento?.etapas || ETAPAS_DEFAULT,
    tipo_empreendimento_checklist: empreendimento?.tipo_empreendimento_checklist || "",
    disciplinas_checklist: empreendimento?.disciplinas_checklist || []
  });
  
  const [etapasEditaveis, setEtapasEditaveis] = useState(
    empreendimento?.etapas?.length > 0 ? empreendimento.etapas : ETAPAS_DEFAULT
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEtapaChange = (index, valor) => {
    const novasEtapas = [...etapasEditaveis];
    novasEtapas[index] = valor;
    setEtapasEditaveis(novasEtapas);
    const etapasPreenchidas = novasEtapas.filter(e => e.trim() !== "");
    setFormData(prev => ({ ...prev, etapas: etapasPreenchidas }));
  };

  const handleAddEtapa = () => {
    const novasEtapas = [...etapasEditaveis, ""];
    setEtapasEditaveis(novasEtapas);
  };

  const handleRemoveEtapa = (index) => {
    const novasEtapas = etapasEditaveis.filter((_, i) => i !== index);
    setEtapasEditaveis(novasEtapas);
    const etapasPreenchidas = novasEtapas.filter(e => e.trim() !== "");
    setFormData(prev => ({ ...prev, etapas: etapasPreenchidas }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData(prev => ({ ...prev, foto_url: file_url }));
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      alert("Erro ao fazer upload da imagem. Tente novamente.");
    }
    setIsUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // **CORREÇÃO**: Verificar se onSubmit é uma função válida
    if (!onSubmit || typeof onSubmit !== 'function') {
      console.error('EmpreendimentoForm: onSubmit não é uma função válida');
      alert('Erro interno: função de submissão não encontrada');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSubmit(formData);
      // **CORREÇÃO**: Chamar onSuccess apenas se fornecido
      if (onSuccess && typeof onSuccess === 'function') {
        await onSuccess();
      }
    } catch (error) {
      console.error('Erro no handleSubmit:', error);
      // O erro já é tratado na função onSubmit da página pai
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl flex flex-col max-h-[90vh]"
      >
        <Card className="bg-white shadow-2xl flex flex-col overflow-hidden">
          <CardHeader className="border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">
                {empreendimento ? "Editar Empreendimento" : "Novo Empreendimento"}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 overflow-y-auto flex-1">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Empreendimento *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleInputChange("nome", e.target.value)}
                    placeholder="Digite o nome do empreendimento"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Input
                    id="cliente"
                    value={formData.cliente}
                    onChange={(e) => handleInputChange("cliente", e.target.value)}
                    placeholder="Nome do cliente"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleInputChange("endereco", e.target.value)}
                  placeholder="Endereço completo do empreendimento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="num_proposta">Nº Proposta</Label>
                <Input
                  id="num_proposta"
                  value={formData.num_proposta}
                  onChange={(e) => handleInputChange("num_proposta", e.target.value)}
                  placeholder="Ex: PP24-1071-R3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_planejamento">Em Planejamento</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Etapas do Empreendimento</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddEtapa} className="text-xs h-7">
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Etapa
                  </Button>
                </div>
                <div className="space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {etapasEditaveis.map((etapa, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{index + 1}.</span>
                      <Input
                        value={etapa}
                        onChange={(e) => handleEtapaChange(index, e.target.value)}
                        placeholder="Ex: Revisão Executivo, Estudo Preliminar..."
                        className="h-8 text-sm flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        onClick={() => handleRemoveEtapa(index)}
                        title="Remover etapa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {etapasEditaveis.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Nenhuma etapa configurada. Clique em "Adicionar Etapa".</p>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Adicione quantas etapas precisar, incluindo revisões (ex: "Revisão Executivo").
                </p>
              </div>

              {/* Configuração de Checklist */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Configuração de Checklist</h3>

                <div className="space-y-2">
                  <Label htmlFor="tipo_checklist">Tipo de Empreendimento</Label>
                  <Select
                    value={formData.tipo_empreendimento_checklist}
                    onValueChange={(value) => handleInputChange("tipo_empreendimento_checklist", value)}
                  >
                    <SelectTrigger id="tipo_checklist">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Residencial">Residencial</SelectItem>
                      <SelectItem value="Comercial">Comercial</SelectItem>
                      <SelectItem value="Galpão Logístico">Galpão Logístico</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Define qual template de checklist será usado para cada disciplina.</p>
                </div>

                <div className="space-y-2">
                  <Label>Disciplinas do Checklist</Label>
                  <div className="border border-gray-200 rounded-md p-3 bg-white space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Disciplinas Técnicas</p>
                      <div className="grid grid-cols-2 gap-2">
                        {['Elétrica', 'Hidráulica', 'HVAC', 'Incêndio', 'Sistemas Eletrônicos', ...(formData.tipo_empreendimento_checklist === 'Residencial' ? ['Gás'] : [])].map(disc => (
                          <div key={disc} className="flex items-center gap-2">
                            <Checkbox
                              id={`disc-${disc}`}
                              checked={formData.disciplinas_checklist.includes(disc)}
                              onCheckedChange={(checked) => {
                                const atual = formData.disciplinas_checklist;
                                handleInputChange("disciplinas_checklist",
                                  checked ? [...atual, disc] : atual.filter(d => d !== disc)
                                );
                              }}
                            />
                            <label htmlFor={`disc-${disc}`} className="text-sm cursor-pointer">{disc}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Planejamento</p>
                      <div className="space-y-2">
                        {['Planejamento - INÍCIO DE PROJETO', 'Planejamento - BASES E FOLHAS', 'Planejamento - COMPATIBILIZAÇÃO'].map(disc => (
                          <div key={disc} className="flex items-center gap-2">
                            <Checkbox
                              id={`disc-${disc}`}
                              checked={formData.disciplinas_checklist.includes(disc)}
                              onCheckedChange={(checked) => {
                                const atual = formData.disciplinas_checklist;
                                handleInputChange("disciplinas_checklist",
                                  checked ? [...atual, disc] : atual.filter(d => d !== disc)
                                );
                              }}
                            />
                            <label htmlFor={`disc-${disc}`} className="text-sm cursor-pointer">{disc}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Selecione as disciplinas que serão utilizadas nos checklists deste empreendimento.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Foto do Empreendimento</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="foto-upload"
                  />
                  <label htmlFor="foto-upload">
                    <Button 
                      type="button" 
                      variant="outline"
                      disabled={isUploading}
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploading ? "Enviando..." : "Escolher Foto"}
                      </span>
                    </Button>
                  </label>
                  {formData.foto_url && (
                    <img 
                      src={formData.foto_url} 
                      alt="Preview" 
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                </div>
              </div>

            </form>
          </CardContent>
          <div className="flex justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit"
              form="empreendimento-form"
              disabled={isSubmitting || isUploading}
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmit}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}