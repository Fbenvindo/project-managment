import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [allAtividades, setAllAtividades] = useState([]);
  const [selectedSubdisciplinas, setSelectedSubdisciplinas] = useState([]);

  useEffect(() => {
    const loadAtividades = async () => {
      try {
        const ativs = await Atividade.list();
        setAllAtividades(ativs || []);
      } catch (error) {
        console.error("Erro ao carregar atividades:", error);
      }
    };
    
    if (isOpen) {
      loadAtividades();
    }
  }, [isOpen]);

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
      // Se for edição, inicializar subdisciplinas selecionadas
      if (atividade.subdisciplina) {
        setSelectedSubdisciplinas([atividade.subdisciplina]);
      }
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
      setSelectedSubdisciplinas([]);
    }
  }, [atividade, empreendimentoId, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpar subdisciplinas quando mudar a disciplina
    if (name === 'disciplina') {
      setSelectedSubdisciplinas([]);
    }
  };

  const subdisciplinasDisponiveis = useMemo(() => {
    if (!formData.disciplina) return [];
    
    const subdisciplinasSet = new Set();
    allAtividades.forEach(ativ => {
      if (ativ.disciplina === formData.disciplina && ativ.subdisciplina) {
        subdisciplinasSet.add(ativ.subdisciplina);
      }
    });
    
    return Array.from(subdisciplinasSet).sort();
  }, [formData.disciplina, allAtividades]);

  const handleToggleSubdisciplina = (subdisciplina) => {
    setSelectedSubdisciplinas(prev => {
      if (prev.includes(subdisciplina)) {
        return prev.filter(s => s !== subdisciplina);
      } else {
        return [...prev, subdisciplina];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.disciplina) {
      alert("Por favor, selecione uma disciplina.");
      return;
    }
    
    if (selectedSubdisciplinas.length === 0) {
      alert("Por favor, selecione pelo menos uma subdisciplina.");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (atividade && atividade.id) {
        // Edição - atualiza apenas uma atividade
        const dataToSave = {
          ...formData,
          subdisciplina: selectedSubdisciplinas[0], // Na edição, usar apenas a primeira
          tempo: formData.tempo ? Number(formData.tempo) : null,
        };
        await Atividade.update(atividade.id, dataToSave);
      } else {
        // Criação - criar uma atividade para cada subdisciplina selecionada
        const createPromises = selectedSubdisciplinas.map(subdisciplina => {
          const dataToSave = {
            ...formData,
            subdisciplina: subdisciplina,
            tempo: formData.tempo ? Number(formData.tempo) : null,
          };
          return Atividade.create(dataToSave);
        });
        
        await Promise.all(createPromises);
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
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="disciplina">Disciplina</Label>
            <Select name="disciplina" value={formData.disciplina} onValueChange={(v) => handleSelectChange('disciplina', v)} required>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {disciplinas.map(d => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          {formData.disciplina && subdisciplinasDisponiveis.length > 0 && (
            <div className="space-y-2 md:col-span-2">
              <Label>Subdisciplina</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-md max-h-48 overflow-y-auto">
                {subdisciplinasDisponiveis.map(subdisciplina => (
                  <div key={subdisciplina} className="flex items-center space-x-2">
                    <Checkbox
                      id={`subdisciplina-${subdisciplina}`}
                      checked={selectedSubdisciplinas.includes(subdisciplina)}
                      onCheckedChange={() => handleToggleSubdisciplina(subdisciplina)}
                    />
                    <label
                      htmlFor={`subdisciplina-${subdisciplina}`}
                      className="text-sm cursor-pointer"
                    >
                      {subdisciplina}
                    </label>
                  </div>
                ))}
              </div>
              {selectedSubdisciplinas.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {selectedSubdisciplinas.length} subdisciplina(s) selecionada(s)
                  {!atividade && selectedSubdisciplinas.length > 1 && ": será criada uma atividade para cada subdisciplina"}
                </p>
              )}
            </div>
          )}
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