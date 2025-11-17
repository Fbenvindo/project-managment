import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Atividade } from '@/entities/all';
import { Loader2 } from 'lucide-react';

export default function AtividadeFormModal({ isOpen, onClose, empreendimentoId, disciplinas, atividade, onSuccess }) {
  const [formData, setFormData] = useState({
    id_atividade: '',
    etapa: '',
    disciplina: '',
    subdisciplina: '',
    atividade: '',
    predecessora: '',
    tempo: '',
    funcao: '',
    empreendimento_id: empreendimentoId,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (atividade) {
      setFormData({
        id_atividade: atividade.id_atividade || '',
        etapa: atividade.etapa || '',
        disciplina: atividade.disciplina || '',
        subdisciplina: atividade.subdisciplina || '',
        atividade: atividade.atividade || '',
        predecessora: atividade.predecessora || '',
        tempo: atividade.tempo?.toString() || '',
        funcao: atividade.funcao || '',
        empreendimento_id: empreendimentoId,
      });
    } else {
      // Reset form for new entry
      setFormData({
        id_atividade: '',
        etapa: '',
        disciplina: '',
        subdisciplina: '',
        atividade: '',
        predecessora: '',
        tempo: '',
        funcao: '',
        empreendimento_id: empreendimentoId,
      });
    }
  }, [atividade, empreendimentoId, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const dataToSave = {
      ...formData,
      tempo: formData.tempo ? Number(formData.tempo) : null,
    };

    try {
      if (atividade && atividade.id) {
        await Atividade.update(atividade.id, dataToSave);
      } else {
        await Atividade.create(dataToSave);
      }
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar atividade:", error);
      alert("Não foi possível salvar a atividade. Verifique o console para mais detalhes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{atividade ? 'Editar Atividade' : 'Nova Atividade no Empreendimento'}</DialogTitle>
          <DialogDescription>
            Preencha os detalhes da atividade específica para este projeto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="atividade">Descrição da Atividade</Label>
            <Input id="atividade" name="atividade" value={formData.atividade} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="etapa">Etapa</Label>
            <Input id="etapa" name="etapa" value={formData.etapa} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disciplina">Disciplina</Label>
            <Select name="disciplina" value={formData.disciplina} onValueChange={(v) => handleSelectChange('disciplina', v)} required>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {disciplinas.map(d => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subdisciplina">Subdisciplina</Label>
            <Input id="subdisciplina" name="subdisciplina" value={formData.subdisciplina} onChange={handleChange} required />
          </div>
           <div className="space-y-2">
            <Label htmlFor="funcao">Função Responsável</Label>
            <Input id="funcao" name="funcao" value={formData.funcao} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tempo">Tempo Padrão (horas)</Label>
            <Input id="tempo" name="tempo" type="number" step="0.1" value={formData.tempo} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="id_atividade">ID da Atividade (Opcional)</Label>
            <Input id="id_atividade" name="id_atividade" value={formData.id_atividade} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="predecessora">ID Predecessora (Opcional)</Label>
            <Input id="predecessora" name="predecessora" value={formData.predecessora} onChange={handleChange} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Atividade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}