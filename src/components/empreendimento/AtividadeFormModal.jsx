import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Atividade, Documento } from '@/entities/all';
import { Loader2 } from 'lucide-react';

export default function AtividadeFormModal({ isOpen, onClose, empreendimentoId, disciplinas, atividade, onSuccess }) {
  const [formData, setFormData] = useState({
    etapa: '',
    disciplina: '',
    atividade: '',
    tempo: '',
    empreendimento_id: empreendimentoId,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allAtividades, setAllAtividades] = useState([]);
  const [selectedSubdisciplinas, setSelectedSubdisciplinas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [selectedDocumentoId, setSelectedDocumentoId] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ativs, docs] = await Promise.all([
          Atividade.list(),
          Documento.filter({ empreendimento_id: empreendimentoId })
        ]);
        setAllAtividades(ativs || []);
        setDocumentos(docs || []);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    
    if (isOpen) {
      loadData();
    }
  }, [isOpen, empreendimentoId]);

  useEffect(() => {
    if (isOpen) {
      if (atividade) {
        // Definir disciplina primeiro
        const disciplinaInicial = atividade.disciplina || '';
        
        setFormData({
          etapa: atividade.etapa || '',
          disciplina: disciplinaInicial,
          atividade: atividade.atividade || '',
          tempo: atividade.tempo?.toString() || '',
          empreendimento_id: empreendimentoId,
        });
        
        // Inicializar subdisciplinas selecionadas
        if (atividade.subdisciplinas && Array.isArray(atividade.subdisciplinas)) {
          // Vindo de uma folha específica com múltiplas subdisciplinas
          setSelectedSubdisciplinas(atividade.subdisciplinas);
        } else if (atividade.subdisciplina) {
          // Editando atividade existente com subdisciplina singular
          setSelectedSubdisciplinas([atividade.subdisciplina]);
        } else {
          setSelectedSubdisciplinas([]);
        }
        
        // Pré-selecionar documento/folha se fornecido
        if (atividade.documento_id) {
          setSelectedDocumentoId(atividade.documento_id);
        } else {
          setSelectedDocumentoId(null);
        }
      } else {
        // Reset form for new entry
        setFormData({
          etapa: '',
          disciplina: '',
          atividade: '',
          tempo: '',
          empreendimento_id: empreendimentoId,
        });
        setSelectedSubdisciplinas([]);
        setSelectedDocumentoId(null);
      }
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
          subdisciplina: selectedSubdisciplinas[0],
          tempo: formData.tempo ? Number(formData.tempo) : null,
          documento_id: selectedDocumentoId || null,
        };
        await Atividade.update(atividade.id, dataToSave);
      } else {
        // Criação - criar uma atividade para cada subdisciplina selecionada
        const createPromises = selectedSubdisciplinas.map(subdisciplina => {
          const dataToSave = {
            ...formData,
            subdisciplina: subdisciplina,
            tempo: formData.tempo ? Number(formData.tempo) : null,
            documento_id: selectedDocumentoId || null,
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
                  <div key={subdisciplina} className="flex items-center space-x-2 min-w-0">
                    <Checkbox
                      id={`subdisciplina-${subdisciplina}`}
                      checked={selectedSubdisciplinas.includes(subdisciplina)}
                      onCheckedChange={() => handleToggleSubdisciplina(subdisciplina)}
                      className="flex-shrink-0"
                    />
                    <label
                      htmlFor={`subdisciplina-${subdisciplina}`}
                      className="text-sm cursor-pointer truncate"
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
           <Label htmlFor="tempo">Tempo Padrão (horas)</Label>
           <Input id="tempo" name="tempo" type="number" step="0.1" value={formData.tempo} onChange={handleChange} />
          </div>

          <div className="space-y-2">
           <Label htmlFor="folha">Folha (Opcional)</Label>
           <Select value={selectedDocumentoId || 'sem_folha'} onValueChange={(value) => setSelectedDocumentoId(value === 'sem_folha' ? null : value)}>
             <SelectTrigger>
               <SelectValue placeholder="Selecione a folha" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="sem_folha">Sem folha específica</SelectItem>
               {documentos.map(doc => (
                 <SelectItem key={doc.id} value={doc.id}>
                   {doc.numero} - {doc.arquivo}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
           <p className="text-xs text-gray-500">
             Se selecionada, a atividade ficará vinculada apenas a esta folha.
           </p>
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