import React, { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { PlanejamentoAtividade, PlanejamentoDocumento } from '@/entities/all';
import { retryWithBackoff } from '@/components/utils/apiUtils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors = {
  nao_iniciado: 'bg-gray-100 text-gray-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  concluido: 'bg-green-100 text-green-700',
  atrasado: 'bg-red-100 text-red-700',
  pausado: 'bg-yellow-100 text-yellow-700',
};

const statusIcons = {
  nao_iniciado: <Clock className="w-3 h-3" />,
  em_andamento: <AlertCircle className="w-3 h-3" />,
  concluido: <CheckCircle className="w-3 h-3" />,
  atrasado: <AlertCircle className="w-3 h-3" />,
  pausado: <Clock className="w-3 h-3" />,
};

function getLabel(item) {
  if (item.documento?.numero_completo) return item.documento.numero_completo;
  if (item.documento?.numero) return `${item.documento.numero}${item.documento.arquivo ? ' - ' + item.documento.arquivo : ''}`;
  return item.descritivo || item.atividade?.atividade || 'Sem descrição';
}

function getSubLabel(item) {
  if (item.etapa) return item.etapa;
  if (item.empreendimento?.nome) return item.empreendimento.nome;
  return '';
}

/**
 * Modal para reordenar planejamentos de um usuário.
 * `atividades` = array de planejamentos já enriquecidos (vindos do calendário ou da aba de planejamento).
 * `onSave` = callback chamado após salvar, recebe o array atualizado com nova ordem.
 * `title` = título do modal (ex: "Reordenar - João Silva")
 */
export default function OrdemPlanejamentoModal({ isOpen, onClose, atividades = [], title = 'Reordenar Atividades', onSave }) {
  const [items, setItems] = useState(() =>
    [...atividades].sort((a, b) => {
      const oA = a.ordem ?? 9999;
      const oB = b.ordem ?? 9999;
      if (oA !== oB) return oA - oB;
      const dA = a.created_date ? new Date(a.created_date).getTime() : 0;
      const dB = b.created_date ? new Date(b.created_date).getTime() : 0;
      return dA - dB;
    })
  );
  const [isSaving, setIsSaving] = useState(false);

  const onDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const newItems = Array.from(items);
    const [moved] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, moved);
    setItems(newItems);
  }, [items]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Salvar ordem em paralelo (em lotes de 5 para evitar rate limit)
      const updates = items.map((item, idx) => ({
        id: item.id,
        tipo: item.tipo_planejamento || item.tipo,
        ordem: idx + 1,
      }));

      const BATCH = 5;
      for (let i = 0; i < updates.length; i += BATCH) {
        const batch = updates.slice(i, i + BATCH);
        await Promise.all(batch.map(({ id, tipo, ordem }) => {
          const entity = tipo === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
          return retryWithBackoff(() => entity.update(id, { ordem }), 3, 500, `setOrdem-${id}`);
        }));
        if (i + BATCH < updates.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // Retornar items com ordem atualizada
      const updatedItems = items.map((item, idx) => ({ ...item, ordem: idx + 1 }));
      if (onSave) onSave(updatedItems);
      onClose();
    } catch (err) {
      alert('Erro ao salvar a ordem: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }, [items, onSave, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GripVertical className="w-5 h-5 text-indigo-500" />
            {title}
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">Arraste para definir a ordem de prioridade. A ordem será respeitada no calendário.</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="ordem-lista">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                  {items.map((item, index) => (
                    <Draggable key={String(item.id)} draggableId={String(item.id)} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-shadow ${
                            snapshot.isDragging
                              ? 'bg-indigo-50 border-indigo-300 shadow-lg'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Número de ordem */}
                          <div className="w-6 h-6 flex-shrink-0 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>

                          {/* Handle */}
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-move text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{getLabel(item)}</p>
                            {getSubLabel(item) && (
                              <p className="text-xs text-gray-500 truncate">{getSubLabel(item)}</p>
                            )}
                            {item.inicio_planejado && (
                              <p className="text-xs text-gray-400">
                                {format(parseISO(item.inicio_planejado), "dd/MM/yy", { locale: ptBR })}
                                {item.termino_planejado && item.termino_planejado !== item.inicio_planejado && (
                                  <> → {format(parseISO(item.termino_planejado), "dd/MM/yy", { locale: ptBR })}</>
                                )}
                              </p>
                            )}
                          </div>

                          {/* Status */}
                          <Badge className={`text-xs flex items-center gap-1 flex-shrink-0 ${statusColors[item.status] || statusColors.nao_iniciado}`}>
                            {statusIcons[item.status]}
                            <span className="hidden sm:inline">{item.status?.replace('_', ' ')}</span>
                          </Badge>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
            ) : (
              <>Salvar Ordem</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}