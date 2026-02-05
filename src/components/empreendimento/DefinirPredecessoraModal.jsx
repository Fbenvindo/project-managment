import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, FileX } from 'lucide-react';
import { PlanejamentoAtividade } from '@/entities/all';
import { retryWithBackoff } from '../utils/apiUtils';

export default function DefinirPredecessoraModal({ 
  isOpen, 
  onClose, 
  atividade, 
  documentos, 
  empreendimentoId, 
  planejamentos,
  onSuccess 
}) {
  const [selectedDocumentos, setSelectedDocumentos] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const documentosComAtividade = useMemo(() => {
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
      setSelectedDocumentos(new Set());
    }
  }, [isOpen]);

  const handleToggleDocumento = (docId) => {
    setSelectedDocumentos(prev => {
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
    if (selectedDocumentos.size === documentosComAtividade.length) {
      setSelectedDocumentos(new Set());
    } else {
      setSelectedDocumentos(new Set(documentosComAtividade.map(d => d.id)));
    }
  };

  const handleSalvar = async () => {
    if (selectedDocumentos.size === 0) {
      alert("Selecione pelo menos uma folha.");
      return;
    }

    const confirmMsg = selectedDocumentos.size === documentosComAtividade.length
      ? `Tem certeza que deseja definir "${atividade.atividade}" como PREDECESSORA em TODAS as ${selectedDocumentos.size} folhas?`
      : `Tem certeza que deseja definir "${atividade.atividade}" como PREDECESSORA em ${selectedDocumentos.size} folha(s) selecionada(s)?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsSaving(true);

    try {
      const baseAtividadeId = atividade.base_atividade_id || atividade.id;
      
      // Buscar os planejamentos que precisam ter predecessora definida
      const allPlanejamentos = await retryWithBackoff(
        () => PlanejamentoAtividade.filter({
          empreendimento_id: empreendimentoId,
          atividade_id: baseAtividadeId
        }),
        3, 500, 'fetchPlanejamentosForPredecessora'
      );

      const planejamentosParaAtualizar = allPlanejamentos.filter(p => 
        selectedDocumentos.has(p.documento_id)
      );

      if (planejamentosParaAtualizar.length === 0) {
        alert('Nenhum planejamento encontrado para as folhas selecionadas. As atividades precisam estar planejadas primeiro.');
        return;
      }

      let atualizados = 0;

      for (const plano of planejamentosParaAtualizar) {
        // Buscar o documento para saber a predecessora
        const doc = documentos.find(d => d.id === plano.documento_id);
        
        if (doc && doc.predecessora_id) {
          // Buscar o planejamento do documento predecessor
          const planoPredecessor = await retryWithBackoff(
            () => PlanejamentoAtividade.filter({
              empreendimento_id: empreendimentoId,
              documento_id: doc.predecessora_id,
              atividade_id: baseAtividadeId
            }),
            3, 500, `findPredecessorPlan-${doc.predecessora_id}-${baseAtividadeId}`
          );

          if (planoPredecessor && planoPredecessor.length > 0) {
            await retryWithBackoff(
              () => PlanejamentoAtividade.update(plano.id, {
                predecessora_id: planoPredecessor[0].id
              }),
              3, 500, `updatePredecessora-${plano.id}`
            );
            atualizados++;
            console.log(`✅ Predecessora definida para planejamento ${plano.id} -> ${planoPredecessor[0].id}`);
          } else {
            console.warn(`⚠️ Documento ${doc.numero} tem predecessora, mas o planejamento predecessor não foi encontrado.`);
          }
        } else {
          console.warn(`⚠️ Documento ${doc?.numero} não tem predecessora definida.`);
        }
      }

      const folhasNames = Array.from(selectedDocumentos)
        .map(docId => {
          const doc = documentosComAtividade.find(d => d.id === docId);
          return doc ? `${doc.numero} - ${doc.arquivo}` : docId;
        })
        .filter(Boolean)
        .join(', ');

      let mensagem = `✅ Predecessora definida para "${atividade.atividade}":\n`;
      mensagem += `\n• ${atualizados} planejamento(s) atualizado(s) com predecessora`;
      mensagem += `\n\nFolhas: ${folhasNames}`;

      alert(mensagem);
      
      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      console.error("Erro ao definir predecessora:", error);
      alert("Erro ao definir predecessora: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!atividade) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-600" />
            Definir como Predecessora em Folhas
          </DialogTitle>
          <DialogDescription>
            Selecione em quais folhas você deseja definir "{atividade.atividade}" como predecessora.
            <br />
            <span className="text-purple-600 font-medium">A predecessora será baseada no documento predecessor de cada folha.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {documentosComAtividade.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileX className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhuma folha encontrada com esta atividade.</p>
              <p className="text-sm mt-2">
                Disciplina: {atividade.disciplina} | Subdisciplina: {atividade.subdisciplina}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="select-all-docs-pred"
                    checked={selectedDocumentos.size === documentosComAtividade.length && documentosComAtividade.length > 0}
                    onCheckedChange={handleSelectAll}
                    disabled={isSaving}
                  />
                  <label htmlFor="select-all-docs-pred" className="text-sm font-medium cursor-pointer">
                    Selecionar todas ({documentosComAtividade.length} folhas)
                  </label>
                </div>
                {selectedDocumentos.size > 0 && (
                  <Badge variant="secondary">
                    {selectedDocumentos.size} selecionada{selectedDocumentos.size !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {documentosComAtividade.map(doc => {
                  const hasPredecessora = doc.predecessora_id;
                  
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer hover:bg-gray-50 ${
                        selectedDocumentos.has(doc.id) ? 'bg-blue-50 border-blue-300' : 'bg-white'
                      } ${!hasPredecessora ? 'opacity-50' : ''}`}
                      onClick={() => hasPredecessora && handleToggleDocumento(doc.id)}
                    >
                      <Checkbox
                        checked={selectedDocumentos.has(doc.id)}
                        onCheckedChange={() => handleToggleDocumento(doc.id)}
                        disabled={isSaving || !hasPredecessora}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{doc.numero} - {doc.arquivo}</div>
                        <div className="text-xs text-gray-500">
                          {hasPredecessora ? (
                            <span className="text-purple-600">✓ Tem documento predecessor</span>
                          ) : (
                            <span className="text-red-500">✗ Sem documento predecessor</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 mt-0.5">ℹ️</div>
                  <div className="text-sm text-blue-800">
                    <strong>Como funciona:</strong> Para cada folha selecionada, o sistema irá:
                    <ul className="list-disc ml-5 mt-1">
                      <li>Buscar o documento predecessor configurado na folha</li>
                      <li>Encontrar o planejamento desta mesma atividade no documento predecessor</li>
                      <li>Definir esse planejamento como predecessora</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={isSaving || selectedDocumentos.size === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 mr-2" />
                Definir em {selectedDocumentos.size} Folha{selectedDocumentos.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}