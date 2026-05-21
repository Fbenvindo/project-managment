import { useState, useEffect, useMemo } from 'react';
import { Atividade, PlanejamentoAtividade, AlteracaoEtapa, Empreendimento } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, FileX, Edit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { retryWithBackoff } from '../utils/apiUtils';
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';

const PlanejamentoAtividadeEntity = base44.entities.PlanejamentoAtividade;

export const EtapaEditModal = ({ isOpen, onClose, atividade, onSave, documentos, empreendimento }) => {
  const [newEtapa, setNewEtapa] = useState('');
  const [escopo, setEscopo] = useState('empreendimento');
  const [selectedFolha, setSelectedFolha] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const etapasBase = ['Estudo Preliminar', 'Ante-Projeto', 'Projeto Básico', 'Projeto Executivo', 'Liberado para Obra', 'Concepção', 'Planejamento'];
  const etapas = useMemo(() => {
    if (empreendimento?.etapas && empreendimento.etapas.length > 0) {
      // Merge: etapas do empreendimento + etapas base que não estejam já incluídas
      const merged = [...empreendimento.etapas];
      etapasBase.forEach(e => { if (!merged.includes(e)) merged.push(e); });
      return merged;
    }
    return etapasBase;
  }, [empreendimento?.etapas]);

  const folhasComAtividade = useMemo(() => {
    if (!atividade || !documentos) return [];
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
  }, [atividade, documentos]);

  useEffect(() => {
    if (isOpen && atividade) {
      setNewEtapa(atividade.etapa || '');
      setEscopo('empreendimento');
      setSelectedFolha('');
    }
  }, [isOpen, atividade]);

  const handleSave = async () => {
    if (!newEtapa) { alert("Por favor, selecione uma etapa."); return; }
    if (escopo === 'folha' && !selectedFolha) { alert("Por favor, selecione uma folha."); return; }
    setIsSaving(true);
    try {
      await onSave(newEtapa, escopo, selectedFolha);
      onClose();
    } catch (error) {
      console.error("Failed to save etapa:", error);
      alert("Erro ao salvar a etapa. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const temFolhas = folhasComAtividade && folhasComAtividade.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        {atividade ? (
          <>
            <DialogHeader>
              <DialogTitle>Editar Etapa da Atividade</DialogTitle>
              <DialogDescription>Selecione a nova etapa e o escopo da alteração.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="etapa">Nova Etapa</Label>
                <Select value={newEtapa} onValueChange={setNewEtapa}>
                  <SelectTrigger><SelectValue placeholder="Selecione a nova etapa" /></SelectTrigger>
                  <SelectContent>
                    {etapas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                <Label className="font-semibold">Escopo da Alteração</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input type="radio" id="escopo-empreendimento" name="escopo" value="empreendimento" checked={escopo === 'empreendimento'} onChange={(e) => setEscopo(e.target.value)} className="w-4 h-4" />
                    <label htmlFor="escopo-empreendimento" className="cursor-pointer flex-1">
                      <div className="font-medium text-sm">Em todo o Empreendimento</div>
                      <div className="text-xs text-gray-500">Altera a etapa em todas as folhas</div>
                    </label>
                  </div>
                  {temFolhas && (
                    <div className="flex items-start gap-3">
                      <input type="radio" id="escopo-folha" name="escopo" value="folha" checked={escopo === 'folha'} onChange={(e) => setEscopo(e.target.value)} className="w-4 h-4 mt-2" />
                      <div className="flex-1">
                        <label htmlFor="escopo-folha" className="cursor-pointer">
                          <div className="font-medium text-sm">Apenas em Folhas Específicas</div>
                          <div className="text-xs text-gray-500">Selecione qual(is) folha(s)</div>
                        </label>
                        {escopo === 'folha' && (
                          <div className="mt-2">
                            <Select value={selectedFolha} onValueChange={setSelectedFolha}>
                              <SelectTrigger><SelectValue placeholder="Selecione a folha" /></SelectTrigger>
                              <SelectContent>
                                {folhasComAtividade.map(doc => (
                                  <SelectItem key={doc.id} value={doc.id}>{doc.numero} - {doc.arquivo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Etapa
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export const EditarEtapaEmFolhasModal = ({ isOpen, onClose, atividade, documentos, empreendimentoId, onSuccess, empreendimento }) => {
  const [selectedDocumentos, setSelectedDocumentos] = useState(new Set());
  const [novaEtapa, setNovaEtapa] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const etapasBase = ['Estudo Preliminar', 'Ante-Projeto', 'Projeto Básico', 'Projeto Executivo', 'Liberado para Obra', 'Concepção', 'Planejamento'];
  const etapas = useMemo(() => {
    if (empreendimento?.etapas && empreendimento.etapas.length > 0) {
      const merged = [...empreendimento.etapas];
      etapasBase.forEach(e => { if (!merged.includes(e)) merged.push(e); });
      return merged;
    }
    return etapasBase;
  }, [empreendimento?.etapas]);

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
    if (isOpen) { setSelectedDocumentos(new Set()); setNovaEtapa(atividade?.etapa || ''); }
  }, [isOpen, atividade]);

  const handleToggleDocumento = (docId) => {
    setSelectedDocumentos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) newSet.delete(docId); else newSet.add(docId);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDocumentos.size === documentosComAtividade.length) setSelectedDocumentos(new Set());
    else setSelectedDocumentos(new Set(documentosComAtividade.map(d => d.id)));
  };

  const handleSalvar = async () => {
    if (selectedDocumentos.size === 0) { alert("Selecione pelo menos uma folha."); return; }
    if (!novaEtapa) { alert("Selecione uma etapa."); return; }

    const confirmMsg = selectedDocumentos.size === documentosComAtividade.length
      ? `Tem certeza que deseja alterar a etapa de "${atividade.atividade}" para "${novaEtapa}" em TODAS as ${selectedDocumentos.size} folhas?`
      : `Tem certeza que deseja alterar a etapa de "${atividade.atividade}" para "${novaEtapa}" em ${selectedDocumentos.size} folha(s) selecionada(s)?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);

    try {
      const user = await base44.auth.me();
      const empreendimento = await Empreendimento.filter({ id: empreendimentoId });
      
      await AlteracaoEtapa.create({
        atividade_id: atividade.base_atividade_id || atividade.id,
        id_atividade: atividade.id_atividade || "",
        nome_atividade: atividade.atividade,
        disciplina: atividade.disciplina,
        subdisciplina: atividade.subdisciplina || "",
        etapa_anterior: atividade.etapa,
        etapa_nova: novaEtapa,
        empreendimento_id: empreendimentoId,
        empreendimento_nome: (empreendimento && empreendimento[0]?.nome) || "",
        data_alteracao: new Date().toISOString(),
        usuario_email: user.email,
        usuario_nome: user.full_name || user.nome || user.email
      });
      
      const baseAtividadeId = atividade.base_atividade_id || atividade.id;
      const atividadeOriginalArr = await retryWithBackoff(() => Atividade.filter({ id: baseAtividadeId }), 3, 500, `getOriginalActivityForEtapaEdit-${baseAtividadeId}`);

      if (!atividadeOriginalArr || atividadeOriginalArr.length === 0) throw new Error("Atividade original não encontrada.");

      const atividadeOriginal = atividadeOriginalArr[0];
      const allPlanejamentos = await retryWithBackoff(() => PlanejamentoAtividadeEntity.filter({ empreendimento_id: empreendimentoId, atividade_id: baseAtividadeId }), 3, 500, 'fetchPlanejamentosForEtapaEdit');
      const planejamentosParaAtualizar = allPlanejamentos.filter(p => selectedDocumentos.has(p.documento_id));

      let planejamentosAtualizados = 0;
      let overridesAtualizados = 0;

      if (planejamentosParaAtualizar.length > 0) {
        await Promise.all(planejamentosParaAtualizar.map(plano => retryWithBackoff(() => PlanejamentoAtividadeEntity.update(plano.id, { etapa: novaEtapa }), 3, 500, `updateEtapaDocEspecifico-${plano.id}`)));
        planejamentosAtualizados = planejamentosParaAtualizar.length;
      }

      const folhasSemPlanejamento = Array.from(selectedDocumentos).filter(docId => !planejamentosParaAtualizar.some(p => p.documento_id === docId));

      for (const docId of folhasSemPlanejamento) {
        const existingOverrides = await retryWithBackoff(() => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: baseAtividadeId, documento_id: docId, tempo: { operator: '!=', value: -999 } }), 3, 500, `checkExistingOverrideForDoc-${docId}-${baseAtividadeId}`);
        if (existingOverrides && existingOverrides.length > 0) {
          await retryWithBackoff(() => Atividade.update(existingOverrides[0].id, { etapa: novaEtapa }), 3, 500, `updateOverrideEtapa-${existingOverrides[0].id}`);
        } else {
          await retryWithBackoff(() => Atividade.create({ ...atividadeOriginal, id: undefined, empreendimento_id: empreendimentoId, id_atividade: baseAtividadeId, documento_id: docId, etapa: novaEtapa, atividade: atividadeOriginal.atividade }), 3, 500, `createOverrideForDocEtapa-${docId}-${baseAtividadeId}`);
        }
        overridesAtualizados++;
      }

      let mensagem = `✅ Etapa de "${atividade.atividade}" foi alterada para "${novaEtapa}":\n`;
      if (planejamentosAtualizados > 0) mensagem += `\n• ${planejamentosAtualizados} planejamento(s) já criado(s) atualizado(s)`;
      if (overridesAtualizados > 0) mensagem += `\n• ${overridesAtualizados} folha(s) com atividade 'Disponível' configurada(s)`;

      alert(mensagem);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao editar etapa em folhas específicas:", error);
      alert("Erro ao editar etapa nas folhas selecionadas: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!atividade) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-600" />Editar Etapa em Folhas Específicas</DialogTitle>
          <DialogDescription>Selecione em quais folhas você deseja alterar a etapa da atividade "{atividade.atividade}".</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-etapa">Nova Etapa</Label>
            <Select value={novaEtapa} onValueChange={setNovaEtapa}>
              <SelectTrigger><SelectValue placeholder="Selecione a nova etapa" /></SelectTrigger>
              <SelectContent>{etapas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {documentosComAtividade.length === 0 ? (
            <div className="text-center py-8 text-gray-500"><FileX className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p>Nenhuma folha encontrada.</p></div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Checkbox id="select-all-docs-etapa" checked={selectedDocumentos.size === documentosComAtividade.length && documentosComAtividade.length > 0} onCheckedChange={handleSelectAll} disabled={isSaving} />
                  <label htmlFor="select-all-docs-etapa" className="text-sm font-medium cursor-pointer">Selecionar todas ({documentosComAtividade.length} folhas)</label>
                </div>
                {selectedDocumentos.size > 0 && <Badge variant="secondary">{selectedDocumentos.size} selecionada{selectedDocumentos.size !== 1 ? 's' : ''}</Badge>}
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {documentosComAtividade.map(doc => (
                  <div key={doc.id} className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer hover:bg-gray-50 ${selectedDocumentos.has(doc.id) ? 'bg-blue-50 border-blue-300' : 'bg-white'}`} onClick={() => handleToggleDocumento(doc.id)}>
                    <Checkbox checked={selectedDocumentos.has(doc.id)} onCheckedChange={() => handleToggleDocumento(doc.id)} disabled={isSaving} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{doc.numero} - {doc.arquivo}</div>
                      <div className="text-xs text-gray-500">Disciplina: {doc.disciplina}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={isSaving || selectedDocumentos.size === 0 || !novaEtapa} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : <><Edit2 className="w-4 h-4 mr-2" />Alterar em {selectedDocumentos.size} Folha{selectedDocumentos.size !== 1 ? 's' : ''}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ExcluirDeFolhasModal = ({ isOpen, onClose, atividade, documentos, empreendimentoId, onSuccess }) => {
  const [selectedDocumentos, setSelectedDocumentos] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

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

  useEffect(() => { if (isOpen) setSelectedDocumentos(new Set()); }, [isOpen]);

  const handleToggleDocumento = (docId) => {
    setSelectedDocumentos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) newSet.delete(docId); else newSet.add(docId);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDocumentos.size === documentosComAtividade.length) setSelectedDocumentos(new Set());
    else setSelectedDocumentos(new Set(documentosComAtividade.map(d => d.id)));
  };

  const handleExcluir = async () => {
    if (selectedDocumentos.size === 0) { alert("Selecione pelo menos uma folha."); return; }
    const confirmMsg = selectedDocumentos.size === documentosComAtividade.length
      ? `Tem certeza que deseja excluir "${atividade.atividade}" de TODAS as ${selectedDocumentos.size} folhas?`
      : `Tem certeza que deseja excluir "${atividade.atividade}" de ${selectedDocumentos.size} folha(s) selecionada(s)?`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      const baseAtividadeId = atividade.base_atividade_id || atividade.id;
      const atividadeOriginalArr = await retryWithBackoff(() => Atividade.filter({ id: baseAtividadeId }), 3, 500, `getOriginalActivity-${baseAtividadeId}`);
      if (!atividadeOriginalArr || atividadeOriginalArr.length === 0) throw new Error("Atividade original não encontrada.");
      const atividadeOriginal = atividadeOriginalArr[0];

      const criacoes = [];
      for (const docId of selectedDocumentos) {
        const existingMarkers = await retryWithBackoff(() => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: baseAtividadeId, documento_id: docId, tempo: -999 }), 3, 500, `checkExistingMarker-${docId}-${baseAtividadeId}`);
        if (!existingMarkers || existingMarkers.length === 0) {
          const doc = documentosComAtividade.find(d => d.id === docId);
          criacoes.push(retryWithBackoff(() => Atividade.create({ ...atividadeOriginal, id: undefined, empreendimento_id: empreendimentoId, id_atividade: baseAtividadeId, documento_id: docId, tempo: -999, atividade: `(Excluída da folha ${doc?.numero}) ${atividadeOriginal.atividade}` }), 3, 500, `createExclusionMarker-${docId}-${baseAtividadeId}`));
        }
      }
      await Promise.all(criacoes);

      const folhasNames = Array.from(selectedDocumentos).map(docId => documentosComAtividade.find(d => d.id === docId)?.numero).filter(Boolean).join(', ');
      alert(`✅ Atividade "${atividade.atividade}" foi excluída das seguintes folhas:\n${folhasNames}`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao excluir atividade de folhas:", error);
      alert("Erro ao excluir atividade das folhas selecionadas: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!atividade) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileX className="w-5 h-5 text-orange-600" />Excluir Atividade de Folhas Específicas</DialogTitle>
          <DialogDescription>Selecione de quais folhas você deseja excluir a atividade "{atividade.atividade}".</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {documentosComAtividade.length === 0 ? (
            <div className="text-center py-8 text-gray-500"><FileX className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p>Nenhuma folha encontrada.</p></div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Checkbox id="select-all-docs" checked={selectedDocumentos.size === documentosComAtividade.length && documentosComAtividade.length > 0} onCheckedChange={handleSelectAll} disabled={isDeleting} />
                  <label htmlFor="select-all-docs" className="text-sm font-medium cursor-pointer">Selecionar todas ({documentosComAtividade.length} folhas)</label>
                </div>
                {selectedDocumentos.size > 0 && <Badge variant="secondary">{selectedDocumentos.size} selecionada{selectedDocumentos.size !== 1 ? 's' : ''}</Badge>}
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {documentosComAtividade.map(doc => (
                  <div key={doc.id} className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer hover:bg-gray-50 ${selectedDocumentos.has(doc.id) ? 'bg-blue-50 border-blue-300' : 'bg-white'}`} onClick={() => handleToggleDocumento(doc.id)}>
                    <Checkbox checked={selectedDocumentos.has(doc.id)} onCheckedChange={() => handleToggleDocumento(doc.id)} disabled={isDeleting} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{doc.numero}</div>
                      <div className="text-xs text-gray-500 truncate">{doc.arquivo}</div>
                    </div>
                  </div>
                ))}
              </div>
              {selectedDocumentos.size === documentosComAtividade.length && documentosComAtividade.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="text-yellow-600 mt-0.5">⚠️</div>
                    <div className="text-sm text-yellow-800"><strong>Atenção:</strong> Você está prestes a excluir esta atividade de TODAS as folhas.</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancelar</Button>
          <Button variant="destructive" onClick={handleExcluir} disabled={isDeleting || selectedDocumentos.size === 0}>
            {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</> : <><FileX className="w-4 h-4 mr-2" />Excluir de {selectedDocumentos.size} Folha{selectedDocumentos.size !== 1 ? 's' : ''}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};