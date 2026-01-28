import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const SECOES_ELETRICA = [
  'MEMORIAL DESCRITIVO',
  'ENTRADA DE ENERGIA',
  'SISTEMA DE GERAÇÃO DE ENERGIA AUTÔNOMA',
  'SISTEMA DE ENERGIA ININTERRUPTA (UPS) - CARGAS CRÍTICAS',
  'DIAGRAMAS GERAIS DE MÉDIA TENSÃO',
  'DIAGRAMAS GERAIS DE BAIXA TENSÃO',
  'DIAGRAMAS DE ILUMINAÇÃO E TOMADAS',
  'DIAGRAMAS DE BOMBAS E MOTORES',
  'DISTRIBUIÇÃO DE ENERGIA - AUMENTADORES',
  'DISTRIBUIÇÃO DE TOMADAS, ILUMINAÇÃO NORMAIS E EMERGÊNCIA',
  'SISTEMAS DE PROTEÇÃO CONTRA DESCARGA ATMOSFÉRICA E ATERRAMENTOS'
];

export default function NovaSecaoModal({ isOpen, onClose, onSuccess, checklistId, tipoChecklist }) {
  const [isSaving, setIsSaving] = useState(false);
  const [nomeSecao, setNomeSecao] = useState('');
  const [usarPredefinida, setUsarPredefinida] = useState(tipoChecklist === 'Elétrica');

  const secoesDisponiveis = tipoChecklist === 'Elétrica' ? SECOES_ELETRICA : [];

  const handleSubmit = async (secao) => {
    setIsSaving(true);

    try {
      await base44.entities.ChecklistItem.create({
        checklist_id: checklistId,
        secao: secao.toUpperCase(),
        numero_item: '1.0',
        descricao: 'Item inicial - edite ou adicione mais itens',
        ordem: 0,
        status_por_periodo: {}
      });

      setNomeSecao('');
      onSuccess();
    } catch (error) {
      console.error('Erro ao criar seção:', error);
      alert('Erro ao criar seção: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Seção/Tabela</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome da Seção *</Label>
            <Input
              value={nomeSecao}
              onChange={(e) => setNomeSecao(e.target.value)}
              placeholder="Ex: SISTEMAS DE ILUMINAÇÃO"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              O nome será convertido para maiúsculas
            </p>
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
                'Criar Seção'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}