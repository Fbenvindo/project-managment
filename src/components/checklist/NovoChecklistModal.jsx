import React, { useState, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { ActivityTimerContext } from '@/components/contexts/ActivityTimerContext';
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

  const getDefaultPeriodos = () => {
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const ano = now.getFullYear();
    return {
      inicio: `${mes}/${ano}`,
      fim: `12/${ano}`
    };
  };

  const defaultEmpDefaults = getDefaultsFromEmpreendimento(defaultEmpreendimentoId);
  const defaultPeriodos = getDefaultPeriodos();
  const defaultTecnico = userProfile?.nome || user?.full_name || '';

  const [formData, setFormData] = useState({
    tipo: 'Elétrica',
    empreendimento_id: defaultEmpreendimentoId || '',
    tecnico_responsavel: defaultTecnico,
    numero_os: defaultEmpDefaults.numero_os,
    cliente: defaultEmpDefaults.cliente,
    data_entrega: '',
    periodos_inicio: defaultPeriodos.inicio,
    periodos_fim: defaultPeriodos.fim
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

  const generatePeriodos = (inicio, fim) => {
    if (!inicio || !fim) return [];
    
    const periodos = [];
    const [mesInicio, anoInicio] = inicio.split('/').map(Number);
    const [mesFim, anoFim] = fim.split('/').map(Number);
    
    let mesAtual = mesInicio;
    let anoAtual = anoInicio;
    
    while (anoAtual < anoFim || (anoAtual === anoFim && mesAtual <= mesFim)) {
      const mesStr = mesAtual.toString().padStart(2, '0');
      periodos.push(`${mesStr}/${anoAtual}`);
      
      mesAtual++;
      if (mesAtual > 12) {
        mesAtual = 1;
        anoAtual++;
      }
    }
    
    return periodos;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const periodos = generatePeriodos(formData.periodos_inicio, formData.periodos_fim);
      
      if (periodos.length === 0) {
        alert('Por favor, defina os períodos (formato MM/AAAA)');
        setIsSaving(false);
        return;
      }

      const checklistData = {
        tipo: formData.tipo,
        empreendimento_id: formData.empreendimento_id || null,
        tecnico_responsavel: formData.tecnico_responsavel,
        numero_os: formData.numero_os,
        cliente: formData.cliente,
        data_entrega: formData.data_entrega || null,
        periodos: periodos,
        status: 'em_andamento'
      };

      const novoChecklist = await base44.entities.ChecklistPlanejamento.create(checklistData);

      // Criar apenas a seção correspondente ao tipo selecionado
      await base44.entities.ChecklistItem.create({
        checklist_id: novoChecklist.id,
        secao: formData.tipo,
        numero_item: '1.0',
        descricao: 'Seção criada automaticamente - adicione itens abaixo',
        ordem: 0,
        status_por_periodo: {}
      });

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

            <div>
              <Label>Período Início (MM/AAAA) *</Label>
              <Input
                placeholder="Ex: 01/2026"
                value={formData.periodos_inicio}
                onChange={(e) => setFormData({ ...formData, periodos_inicio: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Período Fim (MM/AAAA) *</Label>
              <Input
                placeholder="Ex: 12/2026"
                value={formData.periodos_fim}
                onChange={(e) => setFormData({ ...formData, periodos_fim: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <strong>Seções que serão criadas automaticamente:</strong>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              {SECOES_PADRAO.map((secao) => (
                <li key={secao}>{secao}</li>
              ))}
            </ul>
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