import React, { useState, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { ActivityTimerContext } from '@/components/contexts/ActivityTimerContext';
import {
  ITEMS_ELETRICA_COMERCIAL,
  ITEMS_HIDRAULICA_COMERCIAL,
  ITEMS_HVAC_COMERCIAL,
  ITEMS_COMPATIBILIZACAO,
  ITEMS_INICIO_DE_PROJETO,
} from './checklistTemplates';

const CHECKLIST_TEMPLATES = {
  'Elétrica': ITEMS_ELETRICA_COMERCIAL,
  'Hidráulica': ITEMS_HIDRAULICA_COMERCIAL,
  'HVAC': ITEMS_HVAC_COMERCIAL,
  'Incêndio': ITEMS_COMPATIBILIZACAO,
  'Sistemas Eletrônicos': ITEMS_INICIO_DE_PROJETO,
};
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const SECOES_PADRAO = [
  'Sistemas Eletrônicos',
  'Incêndio',
  'HVAC',
  'Hidráulica',
  'Elétrica'
];

export default function NovoChecklistModal({ isOpen, onClose, onSuccess, empreendimentos, defaultEmpreendimentoId }) {
  const [isSaving, setIsSaving] = useState(false);
  const { userProfile, user } = useContext(ActivityTimerContext);

  const getDefaultsFromEmpreendimento = (empId) => {
    const emp = empreendimentos?.find(e => e.id === empId);
    return {
      cliente: emp?.cliente || '',
      numero_os: emp?.os || ''
    };
  };

  const defaultEmpDefaults = getDefaultsFromEmpreendimento(defaultEmpreendimentoId);
  const defaultTecnico = userProfile?.nome || user?.full_name || '';

  const [formData, setFormData] = useState({
    tipo: 'Elétrica',
    empreendimento_id: defaultEmpreendimentoId || '',
    tecnico_responsavel: defaultTecnico,
    numero_os: defaultEmpDefaults.numero_os,
    cliente: defaultEmpDefaults.cliente,
    data_entrega: ''
  });

  const handleEmpreendimentoChange = (empId) => {
    const defaults = getDefaultsFromEmpreendimento(empId);
    setFormData(prev => ({
      ...prev,
      empreendimento_id: empId,
      cliente: defaults.cliente,
      numero_os: defaults.numero_os
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const checklistData = {
        tipo: formData.tipo,
        empreendimento_id: formData.empreendimento_id || null,
        tecnico_responsavel: formData.tecnico_responsavel,
        numero_os: formData.numero_os,
        cliente: formData.cliente,
        data_entrega: formData.data_entrega || null,
        periodos: [],
        status: 'em_andamento'
      };

      const novoChecklist = await base44.entities.ChecklistPlanejamento.create(checklistData);

      // Criar itens a partir do template ou uma seção padrão vazia
      const templateItems = CHECKLIST_TEMPLATES[formData.tipo];
      if (templateItems && templateItems.length > 0) {
        const itemsToCreate = templateItems.map((t, i) => ({
          checklist_id: novoChecklist.id,
          secao: t.secao || formData.tipo,
          numero_item: t.numero_item,
          descricao: t.descricao,
          ordem: i,
          status_por_periodo: {}
        }));
        await base44.entities.ChecklistItem.bulkCreate(itemsToCreate);
      } else {
        await base44.entities.ChecklistItem.create({
          checklist_id: novoChecklist.id,
          secao: formData.tipo,
          numero_item: '1.0',
          descricao: 'Seção criada automaticamente - adicione itens abaixo',
          ordem: 0,
          status_por_periodo: {}
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao criar checklist:', error);
      alert('Erro ao criar checklist: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Checklist de Planejamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Elétrica">Elétrica</SelectItem>
                  <SelectItem value="Hidráulica">Hidráulica</SelectItem>
                  <SelectItem value="HVAC">HVAC</SelectItem>
                  <SelectItem value="Incêndio">Incêndio</SelectItem>
                  <SelectItem value="Sistemas Eletrônicos">Sistemas Eletrônicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Empreendimento</Label>
              <Select
                value={formData.empreendimento_id}
                onValueChange={handleEmpreendimentoChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {empreendimentos.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cliente *</Label>
              <Input
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Número da OS</Label>
              <Input
                value={formData.numero_os}
                onChange={(e) => setFormData({ ...formData, numero_os: e.target.value })}
              />
            </div>

            <div>
              <Label>Técnico Responsável</Label>
              <Input
                value={formData.tecnico_responsavel}
                onChange={(e) => setFormData({ ...formData, tecnico_responsavel: e.target.value })}
              />
            </div>

            <div>
              <Label>Data de Entrega</Label>
              <Input
                type="date"
                value={formData.data_entrega}
                onChange={(e) => setFormData({ ...formData, data_entrega: e.target.value })}
              />
            </div>


          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            As colunas de STATUS serão geradas automaticamente com base nos documentos/folhas cadastrados no empreendimento.
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Checklist'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}