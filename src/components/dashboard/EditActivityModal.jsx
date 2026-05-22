import React, { useState, useEffect, useContext } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlanejamentoAtividade, PlanejamentoDocumento } from "@/entities/all";
import { Loader2 } from "lucide-react";
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';

export default function EditActivityModal({ plano, isOpen, onClose, onSave }) {
  const { allUsers } = useContext(ActivityTimerContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    descritivo: '',
    tempo_planejado: '',
    executor_principal: '',
    inicio_planejado: '',
    termino_planejado: '',
  });

  useEffect(() => {
    if (plano && isOpen) {
      setForm({
        descritivo: plano.descritivo || '',
        tempo_planejado: plano.tempo_planejado != null ? String(plano.tempo_planejado) : '',
        executor_principal: plano.executor_principal || '',
        inicio_planejado: plano.inicio_planejado || '',
        termino_planejado: plano.termino_planejado || '',
      });
    }
  }, [plano, isOpen]);

  if (!plano) return null;

  const handleSave = async () => {
    if (!form.descritivo || !form.tempo_planejado || Number(form.tempo_planejado) <= 0) {
      alert("Preencha a descrição e o tempo planejado.");
      return;
    }
    setIsSubmitting(true);
    try {
      const entity = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
      const updateData = {
        descritivo: form.descritivo,
        tempo_planejado: Number(form.tempo_planejado),
        executor_principal: form.executor_principal || plano.executor_principal,
        ...(form.inicio_planejado ? { inicio_planejado: form.inicio_planejado } : {}),
        ...(form.termino_planejado ? { termino_planejado: form.termino_planejado } : {}),
      };
      await entity.update(plano.id, updateData);
      onSave?.();
      onClose();
    } catch (error) {
      alert("Erro ao salvar: " + (error.message || "Tente novamente."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const usuariosOrdenados = [...(allUsers || [])].sort((a, b) =>
    (a.nome || a.email || '').localeCompare(b.nome || b.email || '', 'pt-BR', { sensitivity: 'base' })
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Atividade</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 -mt-2">
          <span className="font-medium">Atividade:</span> {plano.descritivo}
        </p>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Descrição / Título</Label>
            <Textarea
              value={form.descritivo}
              onChange={(e) => setForm(prev => ({ ...prev, descritivo: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tempo Planejado (h)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={form.tempo_planejado}
                onChange={(e) => setForm(prev => ({ ...prev, tempo_planejado: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Executor Principal</Label>
              <Select
                value={form.executor_principal}
                onValueChange={(v) => setForm(prev => ({ ...prev, executor_principal: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {usuariosOrdenados.map(u => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.nome || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Início Planejado</Label>
              <Input
                type="date"
                value={form.inicio_planejado}
                onChange={(e) => setForm(prev => ({ ...prev, inicio_planejado: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Término Planejado</Label>
              <Input
                type="date"
                value={form.termino_planejado}
                onChange={(e) => setForm(prev => ({ ...prev, termino_planejado: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}