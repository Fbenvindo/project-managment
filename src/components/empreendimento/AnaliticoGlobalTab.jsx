import { useState, useEffect, useMemo, useCallback } from 'react';
import { Atividade, Disciplina, PlanejamentoAtividade, Documento, AlteracaoEtapa, Empreendimento } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, Loader2, PackageOpen, Layers, XCircle, FileX, RefreshCw, Edit2, ChevronRight, ChevronDown } from 'lucide-react';
import AtividadeFormModal from './AtividadeFormModal';
import { debounce } from 'lodash';
import { Badge } from '@/components/ui/badge';
import { retryWithBackoff } from '../utils/apiUtils';
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PDFListaDesenvolvimento from '../configuracoes/PDFListaDesenvolvimento';

const EtapaEditModal = ({ isOpen, onClose, atividade, onSave }) => {
  const [newEtapa, setNewEtapa] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const etapas = ['Estudo Preliminar', 'Ante-Projeto', 'Projeto Básico', 'Projeto Executivo', 'Liberado para Obra', 'Concepção', 'Planejamento'];

  useEffect(() => {
    if (isOpen && atividade) {
      setNewEtapa(atividade.etapa || '');
    }
  }, [isOpen, atividade]);

  const handleSave = async () => {
    if (!newEtapa) {
      alert("Por favor, selecione uma etapa.");
      return;
    }
    setIsSaving(true);
    try {
      await onSave(newEtapa);
      onClose();
    } catch (error) {
      console.error("Failed to save etapa:", error);
      alert("Erro ao salvar a etapa. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        {atividade ? (
          <>
            <DialogHeader>
              <DialogTitle>Editar Etapa da Atividade no Empreendimento</DialogTitle>
              <DialogDescription>
                A etapa será alterada para todas as ocorrências de "{atividade.atividade}" neste empreendimento.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="etapa">Nova Etapa</Label>
                <Select value={newEtapa} onValueChange={setNewEtapa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a nova etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {etapas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
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

const EditarEtapaEmFolhasModal = ({ isOpen, onClose, atividade, documentos, empreendimentoId, onSuccess }) => {
  const [selectedDocumentos, setSelectedDocumentos] = useState(new Set());
  const [novaEtapa, setNovaEtapa] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const etapas = ['Estudo Preliminar', 'Ante-Projeto', 'Projeto Básico', 'Projeto Executivo', 'Liberado para Obra', 'Concepção', 'Planejamento'];

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
      setNovaEtapa(atividade?.etapa || '');
    }
  }, [isOpen, atividade]);

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

    if (!novaEtapa) {
      alert("Selecione uma etapa.");
      return;
    }

    const confirmMsg = selectedDocumentos.size === documentosComAtividade.length
      ? `Tem certeza que deseja alterar a etapa de "${atividade.atividade}" para "${novaEtapa}" em TODAS as ${selectedDocumentos.size} folhas?`
      : `Tem certeza que deseja alterar a etapa de "${atividade.atividade}" para "${novaEtapa}" em ${selectedDocumentos.size} folha(s) selecionada(s)?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsSaving(true);

    try {
      // Registrar alteração
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

      const atividadeOriginalArr = await retryWithBackoff(
        () => Atividade.filter({ id: baseAtividadeId }),
        3, 500, `getOriginalActivityForEtapaEdit-${baseAtividadeId}`
      );

      if (!atividadeOriginalArr || atividadeOriginalArr.length === 0) {
        throw new Error("Atividade original não encontrada.");
      }

      const atividadeOriginal = atividadeOriginalArr[0];

      const allPlanejamentos = await retryWithBackoff(
        () => PlanejamentoAtividade.filter({
          empreendimento_id: empreendimentoId,
          atividade_id: baseAtividadeId
        }),
        3, 500, 'fetchPlanejamentosForEtapaEdit'
      );

      const planejamentosParaAtualizar = allPlanejamentos.filter(p => 
        selectedDocumentos.has(p.documento_id)
      );

      let planejamentosAtualizados = 0;
      let overridesAtualizados = 0;

      if (planejamentosParaAtualizar.length > 0) {
        const updatePromises = planejamentosParaAtualizar.map(plano => 
          retryWithBackoff(
            () => PlanejamentoAtividade.update(plano.id, { etapa: novaEtapa }),
            3, 500, `updateEtapaDocEspecifico-${plano.id}`
          )
        );

        await Promise.all(updatePromises);
        planejamentosAtualizados = planejamentosParaAtualizar.length;
      }

      const folhasSemPlanejamento = Array.from(selectedDocumentos).filter(
        docId => !planejamentosParaAtualizar.some(p => p.documento_id === docId)
      );

      if (folhasSemPlanejamento.length > 0) {
        console.log(`📝 Criando/atualizando overrides para ${folhasSemPlanejamento.length} folhas sem planejamento...`);

        for (const docId of folhasSemPlanejamento) {
          const existingOverrides = await retryWithBackoff(
            () => Atividade.filter({
              empreendimento_id: empreendimentoId,
              id_atividade: baseAtividadeId,
              documento_id: docId,
              tempo: { operator: '!=', value: -999 }
            }),
            3, 500, `checkExistingOverrideForDoc-${docId}-${baseAtividadeId}`
          );

          if (existingOverrides && existingOverrides.length > 0) {
            await retryWithBackoff(
              () => Atividade.update(existingOverrides[0].id, { etapa: novaEtapa }),
              3, 500, `updateOverrideEtapa-${existingOverrides[0].id}`
            );
            overridesAtualizados++;
          } else {
            await retryWithBackoff(
              () => Atividade.create({
                ...atividadeOriginal,
                id: undefined,
                empreendimento_id: empreendimentoId,
                id_atividade: baseAtividadeId,
                documento_id: docId,
                etapa: novaEtapa,
                atividade: atividadeOriginal.atividade
              }),
              3, 500, `createOverrideForDocEtapa-${docId}-${baseAtividadeId}`
            );
            overridesAtualizados++;
          }
        }
      }

      const folhasNames = Array.from(selectedDocumentos)
        .map(docId => {
          const doc = documentosComAtividade.find(d => d.id === docId);
          return doc ? `${doc.numero} - ${doc.arquivo}` : docId;
        })
        .filter(Boolean)
        .join(', ');

      let mensagem = `✅ Etapa de "${atividade.atividade}" foi alterada para "${novaEtapa}":\n`;
      if (planejamentosAtualizados > 0) {
        mensagem += `\n• ${planejamentosAtualizados} planejamento(s) já criado(s) atualizado(s)`;
      }
      if (overridesAtualizados > 0) {
        mensagem += `\n• ${overridesAtualizados} folha(s) com atividade 'Disponível' configurada(s)`;
      }
      mensagem += `\n\nFolhas: ${folhasNames}`;

      alert(mensagem);
      
      // Recarregar alterações
      const alteracoes = await AlteracaoEtapa.filter({ empreendimento_id: empreendimentoId });
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
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-blue-600" />
            Editar Etapa em Folhas Específicas
          </DialogTitle>
          <DialogDescription>
            Selecione em quais folhas você deseja alterar a etapa da atividade "{atividade.atividade}".
            <br />
            <span className="text-blue-600 font-medium">Funciona tanto para atividades já planejadas quanto apenas disponíveis.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-etapa">Nova Etapa</Label>
            <Select value={novaEtapa} onValueChange={setNovaEtapa}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a nova etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

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
                    id="select-all-docs-etapa"
                    checked={selectedDocumentos.size === documentosComAtividade.length && documentosComAtividade.length > 0}
                    onCheckedChange={handleSelectAll}
                    disabled={isSaving}
                  />
                  <label htmlFor="select-all-docs-etapa" className="text-sm font-medium cursor-pointer">
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
                {documentosComAtividade.map(doc => (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer hover:bg-gray-50 ${
                      selectedDocumentos.has(doc.id) ? 'bg-blue-50 border-blue-300' : 'bg-white'
                    }`}
                    onClick={() => handleToggleDocumento(doc.id)}
                  >
                    <Checkbox
                      checked={selectedDocumentos.has(doc.id)}
                      onCheckedChange={() => handleToggleDocumento(doc.id)}
                      disabled={isSaving}
                    />
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
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={isSaving || selectedDocumentos.size === 0 || !novaEtapa}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4 mr-2" />
                Alterar em {selectedDocumentos.size} Folha{selectedDocumentos.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ExcluirDeFolhasModal = ({ isOpen, onClose, atividade, documentos, empreendimentoId, onSuccess }) => {
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

  const handleExcluir = async () => {
    if (selectedDocumentos.size === 0) {
      alert("Selecione pelo menos uma folha.");
      return;
    }

    const confirmMsg = selectedDocumentos.size === documentosComAtividade.length
      ? `Tem certeza que deseja excluir "${atividade.atividade}" de TODAS as ${selectedDocumentos.size} folhas? Isso é equivalente a excluir do empreendimento inteiro.`
      : `Tem certeza que deseja excluir "${atividade.atividade}" de ${selectedDocumentos.size} folha(s) selecionada(s)?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsDeleting(true);

    try {
      const baseAtividadeId = atividade.base_atividade_id || atividade.id;

      const atividadeOriginalArr = await retryWithBackoff(
        () => Atividade.filter({ id: baseAtividadeId }),
        3, 500, `getOriginalActivity-${baseAtividadeId}`
      );

      if (!atividadeOriginalArr || atividadeOriginalArr.length === 0) {
        throw new Error("Atividade original não encontrada.");
      }

      const atividadeOriginal = atividadeOriginalArr[0];

      const criacoes = [];
      for (const docId of selectedDocumentos) {
        const existingMarkers = await retryWithBackoff(
          () => Atividade.filter({
            empreendimento_id: empreendimentoId,
            id_atividade: baseAtividadeId,
            documento_id: docId,
            tempo: -999
          }),
          3, 500, `checkExistingMarker-${docId}-${baseAtividadeId}`
        );

        if (!existingMarkers || existingMarkers.length === 0) {
          const doc = documentosComAtividade.find(d => d.id === docId);
          criacoes.push(
            retryWithBackoff(
              () => Atividade.create({
                ...atividadeOriginal,
                id: undefined,
                empreendimento_id: empreendimentoId,
                id_atividade: baseAtividadeId,
                documento_id: docId,
                tempo: -999,
                atividade: `(Excluída da folha ${doc?.numero}) ${atividadeOriginal.atividade}`
              }),
              3, 500, `createExclusionMarker-${docId}-${baseAtividadeId}`
            )
          );
        }
      }

      await Promise.all(criacoes);

      const folhasNames = Array.from(selectedDocumentos)
        .map(docId => documentosComAtividade.find(d => d.id === docId)?.numero)
        .filter(Boolean)
        .join(', ');

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
          <DialogTitle className="flex items-center gap-2">
            <FileX className="w-5 h-5 text-orange-600" />
            Excluir Atividade de Folhas Específicas
          </DialogTitle>
          <DialogDescription>
            Selecione de quais folhas você deseja excluir a atividade "{atividade.atividade}".
            A atividade não aparecerá mais como "Disponível" nas folhas selecionadas.
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
                    id="select-all-docs"
                    checked={selectedDocumentos.size === documentosComAtividade.length && documentosComAtividade.length > 0}
                    onCheckedChange={handleSelectAll}
                    disabled={isDeleting}
                  />
                  <label htmlFor="select-all-docs" className="text-sm font-medium cursor-pointer">
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
                {documentosComAtividade.map(doc => (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer hover:bg-gray-50 ${
                      selectedDocumentos.has(doc.id) ? 'bg-blue-50 border-blue-300' : 'bg-white'
                    }`}
                    onClick={() => handleToggleDocumento(doc.id)}
                  >
                    <Checkbox
                      checked={selectedDocumentos.has(doc.id)}
                      onCheckedChange={() => handleToggleDocumento(doc.id)}
                      disabled={isDeleting}
                    />
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
                    <div className="text-sm text-yellow-800">
                      <strong>Atenção:</strong> Você está prestes a excluir esta atividade de TODAS as folhas. 
                      Se preferir, use a opção "Excluir de Todas as Folhas" no menu para o mesmo efeito.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleExcluir}
            disabled={isDeleting || selectedDocumentos.size === 0}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <FileX className="w-4 h-4 mr-2" />
                Excluir de {selectedDocumentos.size} Folha{selectedDocumentos.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function AnaliticoGlobalTab({ empreendimentoId, onUpdate }) {
  const [combinedActivities, setCombinedActivities] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', disciplina: 'all', etapa: 'all' });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAtividade, setSelectedAtividade] = useState(null);
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false);
  const [isExcluirDeFolhasModalOpen, setIsExcluirDeFolhasModalOpen] = useState(false);
  const [isEditarEtapaEmFolhasModalOpen, setIsEditarEtapaEmFolhasModalOpen] = useState(false);
  
  const [isDeletingActivity, setIsDeletingActivity] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [isRestoringGlobal, setIsRestoringGlobal] = useState(false);
  const [expandedAtividades, setExpandedAtividades] = useState({});
  
  // Estados para rastreamento de alterações
  const [alteracoesEtapa, setAlteracoesEtapa] = useState([]);
  const [empreendimentoNome, setEmpreendimentoNome] = useState("");

  const documentosMap = useMemo(() => {
    return new Map((documentos || []).map(doc => [doc.id, doc]));
  }, [documentos]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        projectActivities, 
        planejamentos,
        allActivities,
        documentosData,
        disciplinasData,
        empreendimentoData,
        alteracoesData
      ] = await Promise.all([
        retryWithBackoff(() => Atividade.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchProjectActivities'),
        retryWithBackoff(() => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchPlanejamentos'),
        retryWithBackoff(() => Atividade.list(), 3, 500, 'fetchAllActivities'),
        retryWithBackoff(() => Documento.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchDocumentos'),
        retryWithBackoff(() => Disciplina.list(), 3, 500, 'fetchDisciplinas'),
        retryWithBackoff(() => Empreendimento.filter({ id: empreendimentoId }), 3, 500, 'fetchEmpreendimento'),
        retryWithBackoff(() => AlteracaoEtapa.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchAlteracoes')
      ]);

      setDocumentos(documentosData || []);
      setEmpreendimentoNome((empreendimentoData && empreendimentoData[0]?.nome) || "");
      setAlteracoesEtapa(alteracoesData || []);

      // MODIFICADO: Criar dois mapas - um global e um por documento
      const overrideActivitiesGlobalMap = new Map(); // Overrides sem documento_id específico
      const overrideActivitiesByDocMap = new Map(); // Overrides com documento_id específico (chave: "docId|atividadeId")
      const excludedActivitiesSet = new Set();
      const excludedFromDocumentMap = new Map();
      
      (projectActivities || []).forEach(pa => {
          if (pa.id_atividade) {
              if (pa.tempo === -999) {
                  if (pa.documento_id) {
                    if (!excludedFromDocumentMap.has(pa.id_atividade)) {
                      excludedFromDocumentMap.set(pa.id_atividade, new Set());
                    }
                    excludedFromDocumentMap.get(pa.id_atividade).add(pa.documento_id);
                  } else {
                    excludedActivitiesSet.add(pa.id_atividade);
                  }
              } else {
                  // MODIFICADO: Separar overrides por documento
                  if (pa.documento_id) {
                    const key = `${pa.documento_id}|${pa.id_atividade}`;
                    overrideActivitiesByDocMap.set(key, pa);
                  } else {
                    overrideActivitiesGlobalMap.set(pa.id_atividade, pa);
                  }
              }
          }
      });
      
      const allGenericActivitiesMap = new Map((allActivities || [])
        .filter(a => !a.empreendimento_id)
        .map(a => [a.id, a])
      );
      
      const planejamentosMap = new Map((planejamentos || []).map(p => [`${p.documento_id}-${p.atividade_id}`, p]));

      const normalizedProjectActivities = (projectActivities || [])
        .filter(pa => !pa.id_atividade && pa.tempo !== -999)
        .map(ativ => ({
          ...ativ,
          uniqueId: `proj-${ativ.id}`,
          source: 'Projeto',
          status: 'N/A',
          isEditable: true,
          base_atividade_id: ativ.id,
      }));

      let documentActivities = [];
      (documentosData || []).forEach(doc => {
        const subdisciplinasDoc = doc.subdisciplinas || [];
        const disciplinaDoc = doc.disciplina;
        const fatorDificuldade = doc.fator_dificuldade || 1;

        // Adicionar atividades específicas vinculadas a este documento
        const atividadesVinculadasDoc = (projectActivities || []).filter(pa => 
          pa.documento_id === doc.id && 
          !pa.id_atividade && 
          pa.tempo !== -999
        );
        
        atividadesVinculadasDoc.forEach(atividadeVinculada => {
          const planKey = `${doc.id}-${atividadeVinculada.id}`;
          const existingPlan = planejamentosMap.get(planKey);
          const sourceDisplay = `Folha: ${doc.numero} - ${doc.arquivo || 'Sem Nome'}`;
          
          if (existingPlan) {
            documentActivities.push({
              ...atividadeVinculada,
              id: existingPlan.id,
              uniqueId: `plano-${existingPlan.id}`,
              atividade: existingPlan.descritivo || atividadeVinculada.atividade,
              tempo: existingPlan.tempo_planejado,
              source: sourceDisplay,
              source_documento_id: doc.id,
              source_documento_numero: doc.numero,
              source_documento_arquivo: doc.arquivo,
              status: 'Planejada',
              isEditable: false,
              etapa: existingPlan.etapa || atividadeVinculada.etapa,
              base_atividade_id: atividadeVinculada.id,
            });
          } else {
            documentActivities.push({
              ...atividadeVinculada,
              uniqueId: `avail-${doc.id}-${atividadeVinculada.id}`,
              id: atividadeVinculada.id,
              tempo: atividadeVinculada.tempo || 0,
              source: sourceDisplay,
              source_documento_id: doc.id,
              source_documento_numero: doc.numero,
              source_documento_arquivo: doc.arquivo,
              status: 'Disponível',
              isEditable: false,
              etapa: atividadeVinculada.etapa,
              base_atividade_id: atividadeVinculada.id,
            });
          }
        });
        
        allGenericActivitiesMap.forEach(baseAtividade => {
          const isExcludedFromProject = excludedActivitiesSet.has(baseAtividade.id);
          const isExcludedFromThisDoc = excludedFromDocumentMap.has(baseAtividade.id) && 
                                        excludedFromDocumentMap.get(baseAtividade.id).has(doc.id);
          
          if (isExcludedFromProject || isExcludedFromThisDoc) {
            return;
          }

          const disciplinaMatch = baseAtividade.disciplina === disciplinaDoc;
          const subdisciplinaMatch = subdisciplinasDoc.includes(baseAtividade.subdisciplina);

          if (disciplinaMatch && subdisciplinaMatch) {
            const planKey = `${doc.id}-${baseAtividade.id}`;
            const existingPlan = planejamentosMap.get(planKey);
            
            // MODIFICADO: Buscar override específico do documento primeiro, depois global
            const overrideKey = `${doc.id}|${baseAtividade.id}`;
            const overrideEspecifico = overrideActivitiesByDocMap.get(overrideKey);
            const overrideGlobal = overrideActivitiesGlobalMap.get(baseAtividade.id);
            const override = overrideEspecifico || overrideGlobal;
            
            const etapaCorreta = override ? override.etapa : baseAtividade.etapa;

            const sourceDisplay = `Folha: ${doc.numero} - ${doc.arquivo || 'Sem Nome'}`;

            if (existingPlan) {
              documentActivities.push({
                ...baseAtividade,
                id: existingPlan.id,
                uniqueId: `plano-${existingPlan.id}`,
                atividade: existingPlan.descritivo || baseAtividade.atividade,
                tempo: existingPlan.tempo_planejado,
                source: sourceDisplay,
                source_documento_id: doc.id,
                source_documento_numero: doc.numero,
                source_documento_arquivo: doc.arquivo,
                status: 'Planejada',
                isEditable: false,
                etapa: existingPlan.etapa || etapaCorreta,
                base_atividade_id: baseAtividade.id,
              });
            } else {
              documentActivities.push({
                ...baseAtividade,
                uniqueId: `avail-${doc.id}-${baseAtividade.id}`,
                id: baseAtividade.id,
                tempo: (baseAtividade.tempo || 0) * fatorDificuldade,
                source: sourceDisplay,
                source_documento_id: doc.id,
                source_documento_numero: doc.numero,
                source_documento_arquivo: doc.arquivo,
                status: 'Disponível',
                isEditable: false,
                etapa: etapaCorreta,
                base_atividade_id: baseAtividade.id,
              });
            }
          }
        });
      });

      setCombinedActivities([...normalizedProjectActivities, ...documentActivities]);
      setDisciplinas(disciplinasData || []);

    } catch (error) {
      console.error("Erro ao buscar dados do catálogo:", error);
      setCombinedActivities([]);
      setDisciplinas([]);
      setDocumentos([]);
    } finally {
      setIsLoading(false);
    }
  }, [empreendimentoId]);

  useEffect(() => {
    if (empreendimentoId) {
      fetchData();
    }
  }, [fetchData, empreendimentoId]);

  const debouncedSetSearch = useCallback(debounce((value) => {
    setFilters(prev => ({ ...prev, search: value }));
  }, 300), []);

  const atividadesAgrupadas = useMemo(() => {
    const filtered = combinedActivities.filter(ativ => {
      const searchLower = filters.search.toLowerCase();
      const searchMatch = !filters.search ||
        ativ.atividade?.toLowerCase().includes(searchLower) ||
        ativ.disciplina?.toLowerCase().includes(searchLower) ||
        ativ.subdisciplina?.toLowerCase().includes(searchLower) ||
        ativ.etapa?.toLowerCase().includes(searchLower) ||
        ativ.source?.toLowerCase().includes(searchLower) ||
        ativ.status?.toLowerCase().includes(searchLower);
      
      const disciplinaMatch = filters.disciplina === 'all' || ativ.disciplina === filters.disciplina;
      const etapaMatch = filters.etapa === 'all' || ativ.etapa === 'all' || ativ.etapa === filters.etapa;

      return searchMatch && disciplinaMatch && etapaMatch;
    });

    // Agrupar por atividade base
    const grupos = new Map();
    
    filtered.forEach(ativ => {
      const key = `${ativ.base_atividade_id}-${ativ.etapa}-${ativ.disciplina}-${ativ.subdisciplina}`;
      
      if (!grupos.has(key)) {
        grupos.set(key, {
          baseAtividade: ativ,
          folhas: []
        });
      }
      
      if (ativ.source_documento_id) {
        grupos.get(key).folhas.push(ativ);
      }
    });

    return Array.from(grupos.values());
  }, [combinedActivities, filters]);

  const atividadesPorDisciplina = useMemo(() => {
    const grupos = {};
    
    atividadesAgrupadas.forEach(grupo => {
      const disciplina = grupo.baseAtividade.disciplina || 'Sem Disciplina';
      if (!grupos[disciplina]) {
        grupos[disciplina] = [];
      }
      grupos[disciplina].push(grupo);
    });

    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
  }, [atividadesAgrupadas]);
  
  const etapasUnicas = useMemo(() => [...new Set(combinedActivities.map(a => a.etapa).filter(Boolean))], [combinedActivities]);

  const handleOpenModal = (atividade = null) => {
    setSelectedAtividade(atividade);
    setIsModalOpen(true);
  };
  
  const handleOpenEtapaModal = (atividade) => {
    setSelectedAtividade(atividade);
    setIsEtapaModalOpen(true);
  };

  const handleOpenEditarEtapaEmFolhasModal = (atividade) => {
    setSelectedAtividade(atividade);
    setIsEditarEtapaEmFolhasModalOpen(true);
  };

  const handleSaveEtapa = async (newEtapa) => {
    if (!selectedAtividade || !selectedAtividade.base_atividade_id) {
      alert("Não foi possível identificar a atividade base para atualização.");
      return;
    }
  
    try {
      const allPlanejamentos = await retryWithBackoff(() => PlanejamentoAtividade.filter({ 
        empreendimento_id: empreendimentoId,
        atividade_id: selectedAtividade.base_atividade_id
      }), 3, 500, 'findPlanosForEtapaUpdate');
  
      // Registrar alteração antes de aplicar
      const user = await base44.auth.me();
      const etapaAnterior = selectedAtividade.etapa;
      
      await AlteracaoEtapa.create({
        atividade_id: selectedAtividade.base_atividade_id,
        id_atividade: selectedAtividade.id_atividade || "",
        nome_atividade: selectedAtividade.atividade,
        disciplina: selectedAtividade.disciplina,
        subdisciplina: selectedAtividade.subdisciplina || "",
        etapa_anterior: etapaAnterior,
        etapa_nova: newEtapa,
        empreendimento_id: empreendimentoId,
        empreendimento_nome: empreendimentoNome,
        data_alteracao: new Date().toISOString(),
        usuario_email: user.email,
        usuario_nome: user.full_name || user.nome || user.email
      });
  
      if (allPlanejamentos.length === 0) {
        const baseAtividadeArr = await retryWithBackoff(() => Atividade.filter({ id: selectedAtividade.base_atividade_id }), 3, 500, 'findBaseAtividade');
        
        if (!baseAtividadeArr || baseAtividadeArr.length === 0) {
            throw new Error("Atividade base original não encontrada para criar a nova versão.");
        }
        
        const atividadeOriginal = baseAtividadeArr[0];

        const existingOverride = await retryWithBackoff(() => Atividade.filter({
            empreendimento_id: empreendimentoId,
            id_atividade: selectedAtividade.base_atividade_id,
            documento_id: null,
            tempo: { operator: '!=', value: -999 } 
        }), 3, 500, 'findExistingOverride');

        const foundOverride = existingOverride.find(o => o.id_atividade === selectedAtividade.base_atividade_id && o.empreendimento_id === empreendimentoId);

        if (foundOverride) {
            await retryWithBackoff(() => Atividade.update(foundOverride.id, { etapa: newEtapa }), 3, 500, 'updateAtividadeOverride');
            alert(`A etapa para "${selectedAtividade.atividade}" foi atualizada para "${newEtapa}" para todo este empreendimento.`);
        } else {
            const overrideAtividade = {
                ...atividadeOriginal,
                id_atividade: selectedAtividade.base_atividade_id,
                etapa: newEtapa,
                empreendimento_id: empreendimentoId,
                documento_id: null,
            };
            delete overrideAtividade.id;

            await retryWithBackoff(() => Atividade.create(overrideAtividade), 3, 500, 'createAtividadeOverride');
            alert(`A etapa para "${selectedAtividade.atividade}" foi definida como "${newEtapa}" para todo este empreendimento. Futuros planejamentos e visualizações de atividades "Disponíveis" usarão esta nova etapa.`);
        }

      } else {
        const updatePromises = allPlanejamentos.map(plano => 
          retryWithBackoff(() => PlanejamentoAtividade.update(plano.id, { etapa: newEtapa }), 3, 500, `updateEtapa-${plano.id}`)
        );
        
        await Promise.all(updatePromises);
        
        alert(`${allPlanejamentos.length} ocorrência(s) da atividade foram atualizadas para a etapa "${newEtapa}".`);
      }
      
      // Recarregar alterações
      const alteracoes = await AlteracaoEtapa.filter({ empreendimento_id: empreendimentoId });
      setAlteracoesEtapa(alteracoes || []);
  
      fetchData();
      if(onUpdate) onUpdate();
  
    } catch (error) {
      console.error("Erro ao atualizar etapa:", error);
      alert("Ocorreu um erro ao atualizar a etapa da atividade.");
      throw error;
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta atividade do projeto? Atividades de folhas não são afetadas.")) {
      try {
        await retryWithBackoff(() => Atividade.delete(id), 3, 500, 'deleteAtividade');
        fetchData(); 
        if(onUpdate) onUpdate();
      } catch (error) {
        console.error("Erro ao excluir atividade:", error);
        alert("Não foi possível excluir a atividade.");
      }
    }
  };

  const handleExcluirAtividade = async (atividade) => {
    const genericAtividadeIdToExclude = atividade.base_atividade_id || atividade.id;
    
    if (!window.confirm(`Tem certeza que deseja excluir a atividade "${atividade.atividade}" de TODAS as folhas deste empreendimento? Ela não aparecerá mais como "Disponível" ou "Planejada" em nenhuma folha.`)) {
      return;
    }

    setIsDeletingActivity(prev => ({ ...prev, [genericAtividadeIdToExclude]: true }));

    try {
      console.log(`🗑️ Marcando atividade genérica ${genericAtividadeIdToExclude} como excluída para empreendimento ${empreendimentoId}`);
      
      const existingMarkers = await retryWithBackoff(
        () => Atividade.filter({ 
          empreendimento_id: empreendimentoId,
          id_atividade: genericAtividadeIdToExclude,
          tempo: -999,
          documento_id: null
        }),
        3, 500, `checkExistingExclusionMarker-${genericAtividadeIdToExclude}`
      );

      if (existingMarkers && existingMarkers.length > 0) {
        alert("Esta atividade já está marcada como excluída para este empreendimento.");
        setIsDeletingActivity(prev => ({ ...prev, [genericAtividadeIdToExclude]: false }));
        return;
      }

      const atividadeOriginalArr = await retryWithBackoff(
        () => Atividade.filter({ id: genericAtividadeIdToExclude }),
        3, 500, `getOriginalGenericActivity-${genericAtividadeIdToExclude}`
      );

      if (!atividadeOriginalArr || atividadeOriginalArr.length === 0) {
        throw new Error("Atividade genérica original não encontrada.");
      }
      const atividadeOriginal = atividadeOriginalArr[0];

      await retryWithBackoff(
        () => Atividade.create({
          ...atividadeOriginal,
          id: undefined,
          empreendimento_id: empreendimentoId,
          id_atividade: genericAtividadeIdToExclude,
          tempo: -999,
          documento_id: null,
          atividade: `(Excluída) ${atividadeOriginal.atividade}`
        }),
        3, 500, `createExclusionMarker-${genericAtividadeIdToExclude}`
      );

      console.log(`✅ Marcador de exclusão criado com sucesso para atividade genérica ${genericAtividadeIdToExclude}`);
      
      await fetchData();
      if (onUpdate) onUpdate();
      
      alert(`Atividade "${atividade.atividade}" foi marcada como excluída de todas as folhas deste empreendimento.`);

    } catch (error) {
      console.error("Erro ao marcar atividade para exclusão:", error);
      alert("Erro ao marcar atividade para exclusão. Tente novamente: " + error.message);
    } finally {
      setIsDeletingActivity(prev => ({ ...prev, [genericAtividadeIdToExclude]: false }));
    }
  };

  const handleOpenExcluirDeFolhasModal = (atividade) => {
    setSelectedAtividade(atividade);
    setIsExcluirDeFolhasModalOpen(true);
  };

  const handleSelectItem = (uniqueId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uniqueId)) {
        newSet.delete(uniqueId);
      } else {
        newSet.add(uniqueId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      const projectActivityIds = atividadesAgrupadas
        .filter(grupo => grupo.baseAtividade.isEditable)
        .map(grupo => grupo.baseAtividade.uniqueId);
      setSelectedIds(new Set(projectActivityIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleAtividadeExpansion = (key) => {
    setExpandedAtividades(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDeleteSelected = async () => {
    const count = selectedIds.size;
    if (count === 0) return;

    if (!window.confirm(`Tem certeza que deseja excluir ${count} atividade(s) selecionada(s)?`)) {
      return;
    }

    setIsDeletingMultiple(true);

    try {
      const idsArray = Array.from(selectedIds);
      const results = {
        deleted: 0,
        notFound: 0,
        errors: 0
      };

      for (const uniqueId of idsArray) {
        try {
          const grupo = atividadesAgrupadas.find(g => g.baseAtividade.uniqueId === uniqueId);
          if (!grupo || !grupo.baseAtividade.isEditable) {
            console.warn('Atividade não editável ou não encontrada:', uniqueId);
            continue;
          }

          await retryWithBackoff(() => Atividade.delete(grupo.baseAtividade.id), 3, 500, `deleteAtividade-${grupo.baseAtividade.id}`);
          results.deleted++;
          
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          if (error.message?.includes("Object not found") || 
              error.message?.includes("ObjectNotFoundError") ||
              error.response?.status === 404) {
            results.notFound++;
          } else {
            results.errors++;
            console.error('Erro ao excluir atividade:', uniqueId, error);
          }
        }
      }

      setSelectedIds(new Set());
      fetchData();
      if (onUpdate) onUpdate();

      if (results.errors === 0) {
        if (results.notFound > 0) {
          alert(`${results.deleted} atividades foram excluídas. ${results.notFound} já haviam sido excluídas anteriormente.`);
        } else {
          alert(`${results.deleted} atividades foram excluídas com sucesso.`);
        }
      } else {
        alert(`Processo concluído: ${results.deleted} excluídas, ${results.notFound} já excluídas, ${results.errors} erros.`);
      }

    } catch (error) {
      console.error("Erro durante exclusão em lote:", error);
      alert("Ocorreu um erro durante a exclusão em lote.");
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const handleRestaurarExclusoesGlobais = async () => {
    if (!window.confirm("Tem certeza que deseja RESTAURAR todas as atividades que foram excluídas globalmente por engano?\n\nIsso irá remover todos os marcadores de exclusão global (documento_id = null) e as atividades voltarão a aparecer em TODOS os documentos.")) {
      return;
    }

    setIsRestoringGlobal(true);

    try {
      console.log("🔄 Buscando marcadores de exclusão global...");
      
      const marcadoresGlobais = await retryWithBackoff(
        () => Atividade.filter({
          empreendimento_id: empreendimentoId,
          tempo: -999,
          documento_id: null
        }),
        3, 1000, 'buscarMarcadoresGlobais'
      );

      if (!marcadoresGlobais || marcadoresGlobais.length === 0) {
        alert("Nenhum marcador de exclusão global encontrado. Todas as atividades já estão disponíveis!");
        return;
      }

      console.log(`✅ Encontrados ${marcadoresGlobais.length} marcadores globais a serem removidos:`, marcadoresGlobais);

      let deletados = 0;
      let erros = 0;

      for (const marcador of marcadoresGlobais) {
        try {
          await retryWithBackoff(
            () => Atividade.delete(marcador.id),
            3, 500, `deleteMarcadorGlobal-${marcador.id}`
          );
          deletados++;
          console.log(`✅ Marcador ${marcador.id} deletado (atividade "${marcador.atividade}")`);
        } catch (error) {
          erros++;
          console.error(`❌ Erro ao deletar marcador ${marcador.id}:`, error);
        }
      }

      console.log(`\n✅ Processo concluído:`);
      console.log(`   Deletados: ${deletados}`);
      console.log(`   Erros: ${erros}`);

      if (erros === 0) {
        alert(`✅ Sucesso! ${deletados} atividade(s) foram restauradas e agora estão disponíveis em todos os documentos.`);
      } else {
        alert(`⚠️ Processo concluído com avisos:\n${deletados} restauradas\n${erros} erros\n\nAtualize a página para ver as mudanças.`);
      }

      fetchData();
      if (onUpdate) onUpdate();

    } catch (error) {
      console.error("❌ Erro ao restaurar exclusões globais:", error);
      alert("Erro ao restaurar atividades. Tente novamente.");
    } finally {
      setIsRestoringGlobal(false);
    }
  };


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <p className="ml-4 text-gray-600">Carregando catálogo de atividades...</p>
        </div>
      );
    }

    if (atividadesAgrupadas.length === 0 && !isLoading) {
      return (
        <div className="text-center py-16 px-6 bg-gray-50 rounded-lg">
          <PackageOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800">Catálogo Vazio</h3>
          <p className="text-gray-500 mt-2 mb-6">Nenhuma atividade encontrada para este empreendimento (verificando atividades do projeto e das folhas).</p>
          <Button onClick={() => handleOpenModal()}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Criar Atividade de Projeto
          </Button>
        </div>
      );
    }

    const editableActivities = atividadesAgrupadas.filter(grupo => grupo.baseAtividade.isEditable);

    return (
      <div className="space-y-6">
        {editableActivities.length > 0 && (
          <div className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <Checkbox
                id="selectAll"
                checked={selectedIds.size === editableActivities.length && editableActivities.length > 0}
                onCheckedChange={handleSelectAll}
                disabled={editableActivities.length === 0 || isDeletingMultiple}
              />
              <label htmlFor="selectAll" className="text-sm font-medium text-gray-700 cursor-pointer">
                Selecionar todas as {editableActivities.length} atividades de projeto
              </label>
            </div>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isDeletingMultiple}
              >
                {isDeletingMultiple ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir Selecionadas ({selectedIds.size})
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {atividadesPorDisciplina.map(([disciplina, grupos]) => (
          <div key={disciplina} className="border rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b">
              <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                {disciplina}
                <Badge variant="secondary" className="ml-2">
                  {grupos.length} {grupos.length === 1 ? 'atividade' : 'atividades'}
                </Badge>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    {editableActivities.length > 0 && <TableHead className="w-[50px]"></TableHead>}
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Folhas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Subdisciplina</TableHead>
                    <TableHead>Tempo Padrão</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map(grupo => {
                    const ativ = grupo.baseAtividade;
                    const key = `${ativ.base_atividade_id}-${ativ.etapa}-${ativ.disciplina}-${ativ.subdisciplina}`;
                    const isExpanded = expandedAtividades[key];
                    const genericAtividadeIdToExclude = ativ.base_atividade_id || ativ.id;
                    const uniqueKey = ativ.source_documento_id ? `${genericAtividadeIdToExclude}-${ativ.source_documento_id}` : genericAtividadeIdToExclude;
                    const isDeleting = isDeletingActivity[uniqueKey] || isDeletingActivity[genericAtividadeIdToExclude];

                    return (
                      <>
                        <TableRow key={key} className="hover:bg-gray-50">
                          {editableActivities.length > 0 && (
                            <TableCell>
                              {ativ.isEditable && (
                                <Checkbox
                                  checked={selectedIds.has(ativ.uniqueId)}
                                  onCheckedChange={() => handleSelectItem(ativ.uniqueId)}
                                  disabled={isDeletingMultiple}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            {grupo.folhas.length > 0 && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => toggleAtividadeExpansion(key)}
                                className="h-8 w-8"
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{ativ.atividade}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {grupo.folhas.length} {grupo.folhas.length === 1 ? 'folha' : 'folhas'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {grupo.folhas.length === 0 ? (
                              <Badge variant={ativ.source === 'Projeto' ? 'default' : 'secondary'}>
                                {ativ.source === 'Projeto' ? 'Projeto' : 'Disponível'}
                              </Badge>
                            ) : (
                              <div className="flex gap-1">
                                {grupo.folhas.some(f => f.status === 'Planejada') && (
                                  <Badge variant="success">Planejada</Badge>
                                )}
                                {grupo.folhas.some(f => f.status === 'Disponível') && (
                                  <Badge variant="outline">Disponível</Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{ativ.etapa}</TableCell>
                          <TableCell>{ativ.subdisciplina}</TableCell>
                          <TableCell>{ativ.tempo ? `${Number(ativ.tempo).toFixed(1)}h` : '-'}</TableCell>
                          <TableCell>{ativ.funcao}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isDeleting || isDeletingMultiple}>
                                  {isDeleting || isDeletingMultiple ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {ativ.isEditable ? (
                                  <>
                                    <DropdownMenuItem onClick={() => handleOpenModal(ativ)}>
                                      <Edit className="w-4 h-4 mr-2" /> Editar Atividade
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(ativ.id)} className="text-red-600">
                                      <Trash2 className="w-4 h-4 mr-2" /> Excluir Atividade de Projeto
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuItem onClick={() => handleOpenEtapaModal(ativ)}>
                                      <Layers className="w-4 h-4 mr-2 text-blue-600" /> Editar Etapa (Empreendimento)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenEditarEtapaEmFolhasModal(ativ)} className="text-blue-600">
                                      <Edit2 className="w-4 h-4 mr-2" /> Editar Etapa em Folhas Específicas
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleOpenExcluirDeFolhasModal(ativ)} 
                                      className="text-orange-600"
                                    >
                                      <FileX className="w-4 h-4 mr-2" /> Excluir de Folhas Específicas
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleExcluirAtividade(ativ)} 
                                      className="text-red-600"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" /> Excluir de Todas as Folhas (Empreendimento)
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {isExpanded && grupo.folhas.map(folha => (
                          <TableRow key={folha.uniqueId} className="bg-blue-50/50">
                            {editableActivities.length > 0 && <TableCell></TableCell>}
                            <TableCell className="pl-12">
                              <ChevronRight className="w-3 h-3 text-gray-400 inline mr-1" />
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {folha.source_documento_numero} - {folha.source_documento_arquivo}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell>
                              <Badge variant={folha.status === 'Planejada' ? 'success' : 'outline'} className="text-xs">
                                {folha.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">{folha.etapa}</TableCell>
                            <TableCell className="text-sm text-gray-500">{folha.subdisciplina}</TableCell>
                            <TableCell className="text-sm">{folha.tempo ? `${Number(folha.tempo).toFixed(1)}h` : '-'}</TableCell>
                            <TableCell className="text-sm text-gray-500">{folha.funcao}</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const limparAlteracoes = async () => {
    if (!confirm("Deseja limpar o registro de alterações deste empreendimento? Esta ação não pode ser desfeita.")) {
      return;
    }
    
    try {
      await Promise.all(alteracoesEtapa.map(alt => AlteracaoEtapa.delete(alt.id)));
      setAlteracoesEtapa([]);
      alert("✅ Registro de alterações limpo com sucesso!");
    } catch (error) {
      console.error("Erro ao limpar alterações:", error);
      alert("Erro ao limpar alterações: " + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Catálogo de Atividades do Empreendimento</h2>
          <p className="text-gray-500">Visualize todas as atividades planejadas e gerencie as atividades específicas do projeto.</p>
          {alteracoesEtapa.length > 0 && (
            <p className="text-sm text-purple-600 mt-1">
              {alteracoesEtapa.length} alteração(ões) de etapa registrada(s)
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {alteracoesEtapa.length > 0 && (
            <>
              <PDFListaDesenvolvimento alteracoes={alteracoesEtapa} />
              <Button
                variant="outline"
                onClick={limparAlteracoes}
                className="border-red-500 text-red-600 hover:bg-red-50"
              >
                Limpar Registro
              </Button>
            </>
          )}
          <Button
            onClick={handleRestaurarExclusoesGlobais}
            variant="outline"
            className="border-green-500 text-green-700 hover:bg-green-50"
            disabled={isRestoringGlobal}
          >
            {isRestoringGlobal ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Restaurando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Restaurar Exclusões Globais
              </>
            )}
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Nova Atividade de Projeto
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg border shadow-sm">
        <div className="relative flex-grow min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Buscar por descrição, origem, status..."
            className="pl-10"
            onChange={(e) => debouncedSetSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={filters.etapa} onValueChange={(value) => setFilters(prev => ({ ...prev, etapa: value }))}>
                <SelectTrigger className="w-auto md:w-48"><SelectValue placeholder="Filtrar por Etapa" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as Etapas</SelectItem>
                    {etapasUnicas.map(etapa => <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={filters.disciplina} onValueChange={(value) => setFilters(prev => ({ ...prev, disciplina: value }))}>
                <SelectTrigger className="w-auto md:w-48"><SelectValue placeholder="Filtrar por Disciplina" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as Disciplinas</SelectItem>
                    {disciplinas.map(d => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>
      
      {renderContent()}

      {isModalOpen && (
        <AtividadeFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          empreendimentoId={empreendimentoId}
          disciplinas={disciplinas}
          atividade={selectedAtividade}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchData();
            if(onUpdate) onUpdate();
          }}
        />
      )}

      <EtapaEditModal 
        isOpen={isEtapaModalOpen}
        onClose={() => setIsEtapaModalOpen(false)}
        atividade={selectedAtividade}
        onSave={handleSaveEtapa}
      />

      <EditarEtapaEmFolhasModal
        isOpen={isEditarEtapaEmFolhasModalOpen}
        onClose={() => {
          setIsEditarEtapaEmFolhasModalOpen(false);
          setSelectedAtividade(null);
        }}
        atividade={selectedAtividade}
        documentos={documentos}
        empreendimentoId={empreendimentoId}
        onSuccess={() => {
          fetchData();
          if (onUpdate) onUpdate();
        }}
      />

      <ExcluirDeFolhasModal
        isOpen={isExcluirDeFolhasModalOpen}
        onClose={() => {
          setIsExcluirDeFolhasModalOpen(false);
          setSelectedAtividade(null);
        }}
        atividade={selectedAtividade}
        documentos={documentos}
        empreendimentoId={empreendimentoId}
        onSuccess={() => {
          fetchData();
          if (onUpdate) onUpdate();
        }}
      />
    </div>
  );
}