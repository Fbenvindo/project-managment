import React, { useState, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { ActivityTimerContext } from '@/components/contexts/ActivityTimerContext';
import {
  ITEMS_ELETRICA_COMERCIAL,
  ITEMS_ELETRICA_RESIDENCIAL,
  ITEMS_ELETRICA_GALPAO,
  ITEMS_HIDRAULICA_COMERCIAL,
  ITEMS_HIDRAULICA_RESIDENCIAL,
  ITEMS_HIDRAULICA_GALPAO,
  ITEMS_HVAC_COMERCIAL,
  ITEMS_HVAC_RESIDENCIAL,
  ITEMS_INCENDIO_COMERCIAL,
  ITEMS_INCENDIO_RESIDENCIAL,
  ITEMS_GAS_RESIDENCIAL,
  ITEMS_COMPATIBILIZACAO,
  ITEMS_INICIO_DE_PROJETO,
  ITEMS_BASES_E_FOLHAS,
} from './checklistTemplates';

const CHECKLIST_TEMPLATES = {
  'Residencial': {
    'Elétrica': ITEMS_ELETRICA_RESIDENCIAL,
    'Hidráulica': ITEMS_HIDRAULICA_RESIDENCIAL,
    'HVAC': ITEMS_HVAC_RESIDENCIAL,
    'Incêndio': ITEMS_INCENDIO_RESIDENCIAL,
    'Gás': ITEMS_GAS_RESIDENCIAL,
    'Sistemas': ITEMS_INICIO_DE_PROJETO,
    'Planejamento - INÍCIO DE PROJETO': ITEMS_INICIO_DE_PROJETO,
    'Planejamento - BASES E FOLHAS': ITEMS_BASES_E_FOLHAS,
    'Planejamento - COMPATIBILIZAÇÃO': ITEMS_COMPATIBILIZACAO,
  },
  'Comercial': {
    'Elétrica': ITEMS_ELETRICA_COMERCIAL,
    'Hidráulica': ITEMS_HIDRAULICA_COMERCIAL,
    'HVAC': ITEMS_HVAC_COMERCIAL,
    'Incêndio': ITEMS_INCENDIO_COMERCIAL,
    'Sistemas': ITEMS_INICIO_DE_PROJETO,
    'Planejamento - INÍCIO DE PROJETO': ITEMS_INICIO_DE_PROJETO,
    'Planejamento - BASES E FOLHAS': ITEMS_BASES_E_FOLHAS,
    'Planejamento - COMPATIBILIZAÇÃO': ITEMS_COMPATIBILIZACAO,
  },
  'Galpão Logístico': {
    'Elétrica': ITEMS_ELETRICA_GALPAO,
    'Hidráulica': ITEMS_HIDRAULICA_GALPAO,
    'HVAC': ITEMS_HVAC_COMERCIAL,
    'Incêndio': ITEMS_INCENDIO_COMERCIAL,
    'Sistemas': ITEMS_INICIO_DE_PROJETO,
    'Planejamento - INÍCIO DE PROJETO': ITEMS_INICIO_DE_PROJETO,
    'Planejamento - BASES E FOLHAS': ITEMS_BASES_E_FOLHAS,
    'Planejamento - COMPATIBILIZAÇÃO': ITEMS_COMPATIBILIZACAO,
  },
};
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const SECOES_PADRAO = [
  'Sistemas',
  'Incêndio',
  'HVAC',
  'Hidráulica',
  'Elétrica'
];

const ALL_TIPOS = ['Elétrica', 'Hidráulica', 'HVAC', 'Incêndio', 'Sistemas', 'Planejamento - INÍCIO DE PROJETO', 'Planejamento - BASES E FOLHAS', 'Planejamento - COMPATIBILIZAÇÃO'];

export default function NovoChecklistModal({ isOpen, onClose, onSuccess, empreendimentos, defaultEmpreendimentoId }) {
  const [isSaving, setIsSaving] = useState(false);
  const { userProfile, user } = useContext(ActivityTimerContext);

  const getDefaultsFromEmpreendimento = (empId) => {
    const emp = empreendimentos?.find(e => e.id === empId);
    const rawDisciplinas = emp?.disciplinas_checklist?.length > 0 ? emp.disciplinas_checklist : ALL_TIPOS;
    // Normaliza nome legado e remove duplicatas
    const disciplinas = [...new Set(rawDisciplinas.map(d => d === 'Sistemas Eletrônicos' ? 'Sistemas' : d))];
    return {
      cliente: emp?.cliente || '',
      numero_os: emp?.os || '',
      disciplinas
    };
  };

  const defaultEmpDefaults = getDefaultsFromEmpreendimento(defaultEmpreendimentoId);
  const defaultTecnico = userProfile?.nome || user?.full_name || '';

  const [formData, setFormData] = useState({
    tipo: defaultEmpDefaults.disciplinas[0] || 'Elétrica',
    empreendimento_id: defaultEmpreendimentoId || '',
    tecnico_responsavel: defaultTecnico,
    numero_os: defaultEmpDefaults.numero_os,
    cliente: defaultEmpDefaults.cliente,
    data_entrega: ''
  });
  const [tiposDisponiveis, setTiposDisponiveis] = useState(defaultEmpDefaults.disciplinas);

  const handleEmpreendimentoChange = (empId) => {
    const defaults = getDefaultsFromEmpreendimento(empId);
    setTiposDisponiveis(defaults.disciplinas);
    setFormData(prev => ({
      ...prev,
      empreendimento_id: empId,
      cliente: defaults.cliente,
      numero_os: defaults.numero_os,
      tipo: defaults.disciplinas[0] || prev.tipo
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
      const emp = empreendimentos?.find(e => e.id === formData.empreendimento_id);
      const tipoEmp = emp?.tipo_empreendimento_checklist || 'Comercial';
      const templatesPorTipo = CHECKLIST_TEMPLATES[tipoEmp] || CHECKLIST_TEMPLATES['Comercial'];
      const templateItems = templatesPorTipo[formData.tipo];
      if (templateItems && templateItems.length > 0) {
        const itemsToCreate = templateItems.map((t, i) => ({
          checklist_id: novoChecklist.id,
          secao: t.secao || formData.tipo,
          numero_item: t.numero_item,
          descricao: t.descricao,
          ordem: i,
          status_por_periodo: {}
        }));
        // Criar em lotes de 50 para evitar limite da API
        const BATCH_SIZE = 50;
        for (let i = 0; i < itemsToCreate.length; i += BATCH_SIZE) {
          await base44.entities.ChecklistItem.bulkCreate(itemsToCreate.slice(i, i + BATCH_SIZE));
        }
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
                {tiposDisponiveis.map(tipo => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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