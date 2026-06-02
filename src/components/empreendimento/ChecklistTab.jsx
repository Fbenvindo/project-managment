import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, FileText, Loader2, Trash2 } from 'lucide-react';
import ChecklistHeader from '@/components/checklist/ChecklistHeader';
import ChecklistTable from '@/components/checklist/ChecklistTable';
import NovoChecklistModal from '@/components/checklist/NovoChecklistModal';
import NovaSecaoModal from '@/components/checklist/NovaSecaoModal';

export default function ChecklistTab({ empreendimento }) {
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [showNovaSecaoModal, setShowNovaSecaoModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ['checklists', empreendimento?.id],
    queryFn: async () => {
      const data = await base44.entities.ChecklistPlanejamento.filter({ empreendimento_id: empreendimento.id });
      return data || [];
    },
    enabled: !!empreendimento?.id
  });

  const { data: items = [] } = useQuery({
    queryKey: ['checklist-items', selectedChecklist?.id],
    queryFn: async () => {
      if (!selectedChecklist?.id) return [];
      const data = await base44.entities.ChecklistItem.filter({ checklist_id: selectedChecklist.id }, 'ordem', 500);
      return data || [];
    },
    enabled: !!selectedChecklist?.id
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ['documentos-checklist', empreendimento?.id],
    queryFn: async () => {
      if (!empreendimento?.id) return [];
      const data = await base44.entities.Documento.filter({ empreendimento_id: empreendimento.id });
      return (data || []).sort((a, b) => (a.numero || '').localeCompare(b.numero || ''));
    },
    enabled: !!empreendimento?.id
  });

  const handleChecklistCreated = async () => {
    await queryClient.invalidateQueries(['checklists', empreendimento?.id]);
    setShowNovoModal(false);
  };

  const handleItemsUpdated = async () => {
    await queryClient.invalidateQueries(['checklist-items', selectedChecklist?.id]);
  };

  const handleSecaoCreated = async () => {
    await queryClient.invalidateQueries(['checklist-items', selectedChecklist?.id]);
    setShowNovaSecaoModal(false);
  };

  const handleDeleteChecklist = async () => {
    if (!selectedChecklist) return;
    if (!window.confirm(`Tem certeza que deseja excluir o checklist "${selectedChecklist.tipo}" e todos os seus itens?`)) return;
    // Deletar sequencialmente com delay para evitar rate limit
    for (const item of items) {
      try { await base44.entities.ChecklistItem.delete(item.id); } catch {}
      await new Promise(r => setTimeout(r, 150));
    }
    try {
      await base44.entities.ChecklistPlanejamento.delete(selectedChecklist.id);
    } catch (e) {
      // já deletado ou não encontrado — continuar normalmente
    }
    setSelectedChecklist(null);
    await queryClient.invalidateQueries(['checklists', empreendimento?.id]);
  };

  const getSecaoNumero = (secao) => {
    const match = String(secao).match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 9999;
  };

  const parseNumero = (n) => String(n || '').split('.').map(p => Number(p) || 0);
  const compareNumero = (a, b) => {
    const na = parseNumero(a.numero_item);
    const nb = parseNumero(b.numero_item);
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const diff = (na[i] || 0) - (nb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  const itemsPorSecao = [...items]
    .sort((a, b) => getSecaoNumero(a.secao || '') - getSecaoNumero(b.secao || ''))
    .reduce((acc, item) => {
      if (!acc[item.secao]) acc[item.secao] = [];
      acc[item.secao].push(item);
      return acc;
    }, {});

  Object.keys(itemsPorSecao).forEach(secao => {
    itemsPorSecao[secao].sort(compareNumero);
  });

  const secoesOrdenadas = Object.keys(itemsPorSecao).sort((a, b) => {
    const na = getSecaoNumero(a);
    const nb = getSecaoNumero(b);
    if (na !== nb) return na - nb;
    return a.localeCompare(b, 'pt-BR');
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Checklists de Planejamento</h2>
        <div className="flex gap-2">
          {selectedChecklist && (
            <Button onClick={handleDeleteChecklist} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          )}
          <Button onClick={() => setShowNovoModal(true)} className="bg-blue-600 hover:bg-blue-700" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Novo Checklist
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Lista lateral */}
        <div className="w-44 shrink-0 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : checklists.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Nenhum checklist</p>
              </CardContent>
            </Card>
          ) : (
            checklists.map((checklist) => (
              <button
                key={checklist.id}
                onClick={() => setSelectedChecklist(checklist)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedChecklist?.id === checklist.id
                    ? 'bg-blue-50 border-blue-500'
                    : 'bg-white border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="font-medium text-sm">{checklist.tipo}</div>
                <div className="text-xs text-gray-600 mt-1">{checklist.cliente}</div>
                {checklist.numero_os && (
                  <div className="text-xs text-gray-500 mt-1">OS: {checklist.numero_os}</div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Conteúdo do checklist */}
        <div className="flex-1 min-w-0">
          {selectedChecklist ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <ChecklistHeader
                    checklist={selectedChecklist}
                    onUpdate={handleItemsUpdated}
                    empreendimentos={[empreendimento]}
                  />
                </div>
                <Button onClick={() => setShowNovaSecaoModal(true)} variant="outline" size="sm" className="ml-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Seção
                </Button>
              </div>

              {secoesOrdenadas.length > 0 ? (
                secoesOrdenadas.map((secao) => (
                  <ChecklistTable
                    key={secao}
                    secao={secao}
                    items={itemsPorSecao[secao]}
                    checklist={selectedChecklist}
                    documentos={documentos}
                    onUpdate={handleItemsUpdated}
                    empreendimento={empreendimento}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Nenhum item adicionado ainda</p>
                    <p className="text-sm mt-1">Clique em "Nova Seção" para começar</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="h-64 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <FileText className="w-14 h-14 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Selecione um checklist</p>
                <p className="text-sm mt-1">ou crie um novo</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {showNovoModal && (
        <NovoChecklistModal
          isOpen={showNovoModal}
          onClose={() => setShowNovoModal(false)}
          onSuccess={handleChecklistCreated}
          empreendimentos={[empreendimento]}
          defaultEmpreendimentoId={empreendimento?.id}
        />
      )}

      {showNovaSecaoModal && selectedChecklist && (
        <NovaSecaoModal
          isOpen={showNovaSecaoModal}
          onClose={() => setShowNovaSecaoModal(false)}
          onSuccess={handleSecaoCreated}
          checklistId={selectedChecklist.id}
          tipoChecklist={selectedChecklist.tipo}
        />
      )}
    </div>
  );
}