import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar as CalendarIcon, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlanejamentoAtividade } from '@/entities/all';
import { retryWithBackoff } from '../utils/apiUtils';

export default function PlanejarRapidoModal({ isOpen, onClose, atividade, empreendimentoId, documentos, usuarios, onSuccess }) {
  const [selectedExecutor, setSelectedExecutor] = useState('');
  const [selectedFolhas, setSelectedFolhas] = useState(new Set());
  const [dataInicio, setDataInicio] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filtrar documentos que têm essa atividade
  const documentosDisponiveis = useMemo(() => {
    if (!documentos || !atividade) return [];
    
    return documentos.filter(doc => {
      const disciplinaMatch = doc.disciplina === atividade.disciplina;
      const subdisciplinasDoc = doc.subdisciplinas || [];
      const subdisciplinaMatch = subdisciplinasDoc.includes(atividade.subdisciplina);
      
      return disciplinaMatch && subdisciplinaMatch;
    }).sort((a, b) => {
      const arquivoA = (a.arquivo || '').trim().toLowerCase();
      const arquivoB = (b.arquivo || '').trim().toLowerCase();
      return arquivoA.localeCompare(arquivoB, 'pt-BR', { numeric: true });
    });
  }, [documentos, atividade]);

  useEffect(() => {
    if (isOpen) {
      setSelectedExecutor('');
      setSelectedFolhas(new Set());
      setDataInicio(null);
    }
  }, [isOpen]);

  const handleToggleFolha = (docId) => {
    setSelectedFolhas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedFolhas.size === documentosDisponiveis.length) {
      setSelectedFolhas(new Set());
    } else {
      setSelectedFolhas(new Set(documentosDisponiveis.map(d => d.id)));
    }
  };

  const handleSalvar = async () => {
    if (!selectedExecutor) {
      alert('Selecione um executor.');
      return;
    }

    if (selectedFolhas.size === 0) {
      alert('Selecione pelo menos uma folha.');
      return;
    }

    if (!dataInicio) {
      alert('Selecione uma data de início.');
      return;
    }

    setIsSaving(true);

    try {
      const baseAtividadeId = atividade.base_atividade_id || atividade.id;
      const dataInicioFormatted = format(dataInicio, 'yyyy-MM-dd');
      
      // Criar planejamentos para cada folha selecionada
      const planejamentosParaCriar = [];
      
      for (const docId of selectedFolhas) {
        const doc = documentosDisponiveis.find(d => d.id === docId);
        if (!doc) continue;

        const fatorDificuldade = doc.fator_dificuldade || 1;
        const tempoBase = Number(atividade.tempo) || 0;
        const tempoPlanejado = tempoBase * fatorDificuldade;

        planejamentosParaCriar.push({
          atividade_id: baseAtividadeId,
          documento_id: docId,
          empreendimento_id: empreendimentoId,
          etapa: atividade.etapa,
          executor_principal: selectedExecutor,
          executores: [selectedExecutor],
          tempo_planejado: tempoPlanejado,
          inicio_planejado: dataInicioFormatted,
          termino_planejado: dataInicioFormatted,
          horas_por_dia: { [dataInicioFormatted]: tempoPlanejado },
          status: 'nao_iniciado',
          descritivo: atividade.atividade
        });
      }

      // Criar todos os planejamentos
      for (const plano of planejamentosParaCriar) {
        await retryWithBackoff(
          () => PlanejamentoAtividade.create(plano),
          3, 500, `createPlanejamentoRapido-${plano.documento_id}`
        );
      }

      alert(`✅ ${planejamentosParaCriar.length} planejamento(s) criado(s) com sucesso!`);
      
      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      console.error('Erro ao criar planejamentos:', error);
      alert('Erro ao criar planejamentos: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!atividade) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-purple-600" />
            Planejar Atividade: {atividade.atividade}
          </DialogTitle>
          <DialogDescription>
            Configure o executor, as folhas e a data de início para o planejamento.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Seleção de Executor */}
          <div className="space-y-2">
            <Label htmlFor="executor" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Executor
            </Label>
            <Select value={selectedExecutor} onValueChange={setSelectedExecutor}>
              <SelectTrigger id="executor">
                <SelectValue placeholder="Selecione o executor" />
              </SelectTrigger>
              <SelectContent>
                {usuarios
                  .filter(u => u.nome || u.full_name)
                  .sort((a, b) => {
                    const nomeA = a.nome || a.full_name || '';
                    const nomeB = b.nome || b.full_name || '';
                    return nomeA.localeCompare(nomeB, 'pt-BR');
                  })
                  .map(user => (
                    <SelectItem key={user.id} value={user.email}>
                      {user.nome || user.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de Data */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Data de Início
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Seleção de Folhas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Folhas para Planejar</Label>
              <Badge variant="secondary">
                {documentosDisponiveis.length} folha(s) disponível(eis)
              </Badge>
            </div>

            {documentosDisponiveis.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                <p>Nenhuma folha disponível com esta atividade.</p>
                <p className="text-sm mt-2">
                  Disciplina: {atividade.disciplina} | Subdisciplina: {atividade.subdisciplina}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="select-all-folhas"
                      checked={selectedFolhas.size === documentosDisponiveis.length && documentosDisponiveis.length > 0}
                      onCheckedChange={handleSelectAll}
                      disabled={isSaving}
                    />
                    <label htmlFor="select-all-folhas" className="text-sm font-medium cursor-pointer">
                      Selecionar todas ({documentosDisponiveis.length} folhas)
                    </label>
                  </div>
                  {selectedFolhas.size > 0 && (
                    <Badge variant="default" className="bg-purple-600">
                      {selectedFolhas.size} selecionada{selectedFolhas.size !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-2">
                  {documentosDisponiveis.map(doc => (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer hover:bg-gray-50 ${
                        selectedFolhas.has(doc.id) ? 'bg-purple-50 border-purple-300' : 'bg-white'
                      }`}
                      onClick={() => handleToggleFolha(doc.id)}
                    >
                      <Checkbox
                        checked={selectedFolhas.has(doc.id)}
                        onCheckedChange={() => handleToggleFolha(doc.id)}
                        disabled={isSaving}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{doc.numero} - {doc.arquivo}</div>
                        <div className="text-xs text-gray-500">
                          Disciplina: {doc.disciplina} | Fator: {doc.fator_dificuldade || 1}x
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={isSaving || !selectedExecutor || selectedFolhas.size === 0 || !dataInicio}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <CalendarIcon className="w-4 h-4 mr-2" />
                Criar {selectedFolhas.size} Planejamento{selectedFolhas.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}