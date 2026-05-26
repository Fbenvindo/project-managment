import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function AtividadesFolhaModal({ isOpen, onClose, planejamentoDocumento, executorMap, allPlanejamentos }) {
  const [atividadesVinculadas, setAtividadesVinculadas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !planejamentoDocumento) return;
    setAtividadesVinculadas([]);

    // Caso 1: PlanejamentoDocumento tem atividades_ids → buscar diretamente
    const atividadesIds = planejamentoDocumento.atividades_ids;
    if (Array.isArray(atividadesIds) && atividadesIds.length > 0) {
      setIsLoading(true);
      Promise.all(
        atividadesIds.map(id => base44.entities.Atividade.filter({ id }).catch(() => []))
      ).then(results => {
        const todas = results.flatMap(r => r || []);
        setAtividadesVinculadas(todas);
      }).catch(() => setAtividadesVinculadas([]))
        .finally(() => setIsLoading(false));
      return;
    }

    // Caso 2: Buscar Atividade com documento_id ou documento_ids contendo o docId
    const docId = planejamentoDocumento.documento_id || planejamentoDocumento.id;
    const etapa = planejamentoDocumento.etapa;

    setIsLoading(true);
    Promise.all([
      base44.entities.Atividade.filter({ documento_id: docId }).catch(() => []),
      base44.entities.Atividade.filter({ documento_ids: docId }).catch(() => []),
    ]).then(([porDocId, porDocIds]) => {
      const merged = [...(porDocId || [])];
      (porDocIds || []).forEach(a => {
        if (!merged.find(m => m.id === a.id)) merged.push(a);
      });
      const filtradas = etapa ? merged.filter(a => !a.etapa || a.etapa === etapa) : merged;
      setAtividadesVinculadas(filtradas);
    }).catch(() => setAtividadesVinculadas([]))
      .finally(() => setIsLoading(false));

  }, [isOpen, planejamentoDocumento?.id, planejamentoDocumento?.documento_id, planejamentoDocumento?.etapa]);

  if (!planejamentoDocumento) return null;

  const doc = planejamentoDocumento.documento;
  const titulo = doc
    ? [doc.numero, doc.arquivo, planejamentoDocumento.etapa].filter(Boolean).join(' - ')
    : planejamentoDocumento.descritivo || 'Documento';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Atividades da Folha</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm font-medium text-gray-800 mb-1">{titulo}</p>
          {planejamentoDocumento.etapa && (
            <p className="text-xs text-gray-500 mb-3">Etapa: {planejamentoDocumento.etapa}</p>
          )}
          {Number(planejamentoDocumento.tempo_planejado) > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-700 font-medium">Tempo total planejado:</span>
              <span className="text-sm font-bold text-blue-800">{Number(planejamentoDocumento.tempo_planejado).toFixed(1)}h</span>
            </div>
          )}
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : atividadesVinculadas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhuma atividade vinculada encontrada.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {atividadesVinculadas.map(ativ => (
                <div key={ativ.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{ativ.atividade || 'Atividade'}</p>
                      {ativ.subdisciplina && <p className="text-xs text-gray-500 mt-0.5">{ativ.subdisciplina}</p>}
                    </div>
                    <span className="text-xs font-mono text-gray-600 shrink-0">{Number(ativ.tempo || 0).toFixed(1)}h</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200 flex justify-end">
                <span className="text-xs text-gray-500">
                  Total: <strong>{atividadesVinculadas.reduce((s, a) => s + Number(a.tempo || 0), 0).toFixed(1)}h</strong> ({atividadesVinculadas.length} atividades)
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}