import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Search, Calendar } from "lucide-react";
import { Atividade } from "@/entities/all";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
    TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AplicarAtividadeModal from "./AplicarAtividadeModal";
import PlanejamentoAtividadeModal from "./PlanejamentoAtividadeModal";
import AtividadesProjetoFilters from "./AtividadesProjetoFilters";

const initialState = {
  etapa: '',
  disciplina: '',
  subdisciplina: '',
  atividade: '',
  funcao: '',
  tempo: 0,
};

const AtividadeFormDialog = ({ open, setOpen, empreendimentoId, disciplinas, onUpdate, atividadeToEdit, documentos }) => {
  const [atividade, setAtividade] = useState(atividadeToEdit || initialState);
  const [selectedDocumentoId, setSelectedDocumentoId] = useState(null);
  
  React.useEffect(() => {
    setAtividade(atividadeToEdit || initialState);
    setSelectedDocumentoId(atividadeToEdit?.documento_id || null);
  }, [atividadeToEdit, open]);

  const handleSubmit = async () => {
    if (!empreendimentoId) {
      alert("ID do empreendimento não encontrado");
      return;
    }
    
    try {
      if (atividade.id) {
        // EDIÇÃO: Apenas atualiza a atividade existente
        const payload = { 
          ...atividade, 
          tempo: Number(atividade.tempo) || 0, 
          empreendimento_id: empreendimentoId,
          documento_id: selectedDocumentoId || atividade.documento_id
        };
        await Atividade.update(atividade.id, payload);
        onUpdate();
        setOpen(false);
      } else {
        // CRIAÇÃO: Cria atividade vinculada à folha selecionada
        const payload = { 
          ...atividade, 
          tempo: Number(atividade.tempo) || 0, 
          empreendimento_id: empreendimentoId,
          documento_id: selectedDocumentoId || null
        };
        await Atividade.create(payload);
        onUpdate();
        setOpen(false);
      }
    } catch (error) {
      console.error("Erro ao salvar atividade:", error);
      alert("Erro ao salvar atividade");
    }
  };

  const etapas = ['Estudo Preliminar', 'Ante-Projeto', 'Projeto Básico', 'Projeto Executivo', 'Liberado para Obra', 'Concepção', 'Planejamento'];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{atividade.id ? 'Editar Atividade' : 'Nova Atividade do Projeto'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div className="space-y-2">
            <Label htmlFor="atividade">Atividade</Label>
            <Textarea 
              id="atividade" 
              value={atividade.atividade || ''} 
              onChange={(e) => setAtividade({ ...atividade, atividade: e.target.value })} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="etapa">Etapa</Label>
              <Select value={atividade.etapa || ''} onValueChange={(value) => setAtividade({ ...atividade, etapa: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {etapas.map(etapa => (
                    <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disciplina">Disciplina</Label>
              <Select value={atividade.disciplina || ''} onValueChange={(value) => setAtividade({ ...atividade, disciplina: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {(disciplinas || []).map(d => (
                    <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subdisciplina">Subdisciplina</Label>
            <Input 
              id="subdisciplina" 
              value={atividade.subdisciplina || ''} 
              onChange={(e) => setAtividade({ ...atividade, subdisciplina: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="folha">Folha (Opcional)</Label>
            <Select value={selectedDocumentoId || 'sem_folha'} onValueChange={(value) => setSelectedDocumentoId(value === 'sem_folha' ? null : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a folha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_folha">Sem folha específica</SelectItem>
                {(documentos || []).map(doc => (
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="funcao">Função</Label>
              <Input 
                id="funcao" 
                value={atividade.funcao || ''} 
                onChange={(e) => setAtividade({ ...atividade, funcao: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempo">Tempo (h)</Label>
              <Input 
                id="tempo" 
                type="number" 
                step="0.1"
                value={atividade.tempo || 0} 
                onChange={(e) => setAtividade({ ...atividade, tempo: e.target.value })} 
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>
            {atividade.id ? 'Salvar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function AtividadesProjetoTab({ empreendimentoId, atividades = [], disciplinas = [], onUpdate, isLoading, documentos = [], usuarios = [], planejamentos = [] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [etapaFilter, setEtapaFilter] = useState("");
  const [disciplinaFilter, setDisciplinaFilter] = useState("");
  const [subdisciplinaFilter, setSubdisciplinaFilter] = useState("");
  const [showAplicarModal, setShowAplicarModal] = useState(false);
  const [atividadeParaAplicar, setAtividadeParaAplicar] = useState(null);
  const [showPlanejamentoModal, setShowPlanejamentoModal] = useState(false);
  const [atividadeParaPlanejar, setAtividadeParaPlanejar] = useState(null);

  const handleEdit = (atividade) => {
    setEditingAtividade(atividade);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta atividade específica do projeto?")) {
      try {
        await Atividade.delete(id);
        onUpdate();
      } catch (error) {
        console.error("Erro ao excluir atividade:", error);
        alert("Erro ao excluir atividade");
      }
    }
  };

  const handleAplicarADocumentos = (atividade) => {
    setAtividadeParaAplicar(atividade);
    setShowAplicarModal(true);
  };

  const handlePlanejarDiretamente = async (atividade) => {
    try {
      const atividadeComPlanejamento = {
        ...atividade,
        tempo_planejado: Number(atividade.tempo) || 0 
      };

      console.log("🎯 Abrindo modal de planejamento para atividade:", atividadeComPlanejamento);
      
      setAtividadeParaPlanejar(atividadeComPlanejamento);
      setShowPlanejamentoModal(true);
    } catch (error) {
      console.error("Erro ao preparar atividade para planejamento:", error);
      alert("Erro ao preparar atividade para planejamento");
    }
  };

  // The handlePlanejamentoSubmit function has been removed from AtividadesProjetoTab
  // because PlanejamentoAtividadeModal is now responsible for its own submission logic
  // via its internal state and `onSuccess` callback.

  // Pegar IDs dos documentos que pertencem a este empreendimento
  const documentoIdsDoEmpreendimento = useMemo(() => {
    const ids = (documentos || [])
      .filter(d => d.empreendimento_id === empreendimentoId)
      .map(d => d.id);
    console.log("📄 Documentos do empreendimento:", ids.length, ids);
    return ids;
  }, [documentos, empreendimentoId]);

  // MODIFICADO: Filtrar atividades específicas do projeto ou vinculadas aos documentos do empreendimento
  const filteredAtividades = useMemo(() => {
    const todasAtividades = (atividades || [])
      .filter(a => {
        // Incluir atividades específicas do projeto OR atividades vinculadas a documentos deste empreendimento
        const ehDoEmpreendimento = a.empreendimento_id === empreendimentoId;
        const ehDoDocumento = a.documento_id && documentoIdsDoEmpreendimento.includes(a.documento_id);
        const incluir = ehDoEmpreendimento || ehDoDocumento;
        if (incluir) {
          console.log("✅ Atividade incluída:", a.atividade, { ehDoEmpreendimento, ehDoDocumento, documento_id: a.documento_id });
        }
        return incluir;
      })
      .filter(a => a.tempo !== -999) // Excluir marcadores de exclusão
      .filter(a => {
        // Filtro por nome
        const nomeMatch = (a.atividade || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        // Filtro por etapa
        const etapaMatch = !etapaFilter || (a.etapa || '').toLowerCase() === etapaFilter.toLowerCase();
        
        // Filtro por disciplina
        const disciplinaMatch = !disciplinaFilter || (a.disciplina || '').toLowerCase() === disciplinaFilter.toLowerCase();
        
        // Filtro por subdisciplina
        const subdisciplinaMatch = !subdisciplinaFilter || (a.subdisciplina || '').toLowerCase() === subdisciplinaFilter.toLowerCase();
        
        return nomeMatch && etapaMatch && disciplinaMatch && subdisciplinaMatch;
      });
    console.log("🔍 Total de atividades filtradas:", todasAtividades.length);
    return todasAtividades;
  }, [atividades, empreendimentoId, documentoIdsDoEmpreendimento, searchTerm, etapaFilter, disciplinaFilter, subdisciplinaFilter]);

  if (!empreendimentoId) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Empreendimento não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow-sm">
      <AtividadeFormDialog
        open={showForm}
        setOpen={setShowForm}
        empreendimentoId={empreendimentoId}
        disciplinas={disciplinas}
        onUpdate={onUpdate}
        atividadeToEdit={editingAtividade}
        documentos={documentos}
      />

      <AplicarAtividadeModal
        isOpen={showAplicarModal}
        onClose={() => {
          setShowAplicarModal(false);
          setAtividadeParaAplicar(null);
        }}
        atividade={atividadeParaAplicar}
        documentos={documentos}
        empreendimentoId={empreendimentoId}
        onSave={onUpdate}
      />

      {showPlanejamentoModal && atividadeParaPlanejar && (
        <PlanejamentoAtividadeModal
          isOpen={showPlanejamentoModal}
          onClose={() => {
            console.log("🔄 Fechando modal de planejamento");
            setShowPlanejamentoModal(false);
            setAtividadeParaPlanejar(null);
          }}
          atividade={atividadeParaPlanejar}
          usuarios={usuarios}
          empreendimentoId={empreendimentoId}
          documentos={documentos}
          onSuccess={() => {
            console.log("✅ Planejamento realizado com sucesso");
            setShowPlanejamentoModal(false);
            setAtividadeParaPlanejar(null);
            onUpdate();
          }}
        />
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Atividades do Projeto</h3>
          <p className="text-sm text-gray-500">
            Gerencie as atividades deste empreendimento.
          </p>
        </div>
        <Button onClick={() => { 
          setEditingAtividade(null); 
          setShowForm(true); 
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Atividade
        </Button>
      </div>

      <AtividadesProjetoFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        etapaFilter={etapaFilter}
        onEtapaChange={setEtapaFilter}
        disciplinaFilter={disciplinaFilter}
        onDisciplinaChange={setDisciplinaFilter}
        subdisciplinaFilter={subdisciplinaFilter}
        onSubdisciplinaChange={setSubdisciplinaFilter}
        disciplinas={disciplinas}
        atividades={atividades}
        onClearFilters={() => {
          setSearchTerm("");
          setEtapaFilter("");
          setDisciplinaFilter("");
          setSubdisciplinaFilter("");
        }}
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atividade</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Disciplina</TableHead>
              <TableHead>Subdisciplina</TableHead>
              <TableHead>Tempo (h)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Carregando...</TableCell>
              </TableRow>
            ) : filteredAtividades.length > 0 ? (
              filteredAtividades.map(atividade => (
                <TableRow key={atividade.id}>
                  <TableCell className="font-medium">{atividade.atividade}</TableCell>
                  <TableCell>{atividade.etapa}</TableCell>
                  <TableCell>{atividade.disciplina}</TableCell>
                  <TableCell>{atividade.subdisciplina}</TableCell>
                  <TableCell>{atividade.tempo}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          console.log("🎯 Clicou no botão Planejar para:", atividade);
                          handlePlanejarDiretamente(atividade);
                        }}
                        className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        Planejar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleAplicarADocumentos(atividade)}
                        className="text-xs"
                      >
                        Aplicar
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(atividade)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(atividade.id)} 
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="text-gray-500">
                    {searchTerm ? 
                      "Nenhuma atividade encontrada com os filtros aplicados." :
                      "Nenhuma atividade específica cadastrada para este projeto."
                    }
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}