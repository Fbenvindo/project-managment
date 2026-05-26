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

    const etapa = planejamentoDocumento.etapa;
    const doc = planejamentoDocumento.documento;
    const disciplina = doc?.disciplina || (Array.isArray(doc?.disciplinas) ? doc.disciplinas[0] : null);
    const subdisciplinas = doc?.subdisciplinas || [];
    const fator = doc?.fator_dificuldade || 1;

    if (!disciplina) {
      // Sem documento populado, não é possível filtrar
      return;
    }

    setIsLoading(true);
    base44.entities.Atividade.filter({ disciplina })
      .then(todasAtividades => {
        let filtradas = (todasAtividades || []).filter(a => {
          if (a.empreendimento_id) return false; // apenas genéricas
          if (!subdisciplinas.includes(a.subdisciplina)) return false;
          if (etapa && a.etapa && a.etapa !== etapa) return false;
          return true;
        });
        setAtividadesVinculadas(filtradas);
      })
      .catch(() => setAtividadesVinculadas([]))
      .finally(() => setIsLoading(false));

  }, [isOpen, planejamentoDocumento?.id, planejamentoDocumento?.documento_id, planejamentoDocumento?.etapa]);

  if (!planejamentoDocumento) return null;

  const doc = planejamentoDocumento.documento;
  const fator = doc?.fator_dificuldade || 1;
  const titulo = doc
    ? [doc.numero, doc.arquivo, planejamentoDocumento.etapa].filter(Boolean).join(' - ')
    : planejamentoDocumento.descritivo || 'Documento';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" aria-describedby="atividades-folha-desc">
        <DialogHeader>
          <DialogTitle className="text-base">Atividades da Folha</DialogTitle>
        </DialogHeader>
        <p id="atividades-folha-desc" className="text-sm font-medium text-gray-800 mb-1">{titulo}</p>
        <div className="py-1">
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
              {atividadesVinculadas.map(ativ => {
                const isConfeccaoA = ativ.atividade && String(ativ.atividade).trim().startsWith('Confecção de A-');
                const horas = (Number(ativ.tempo) || 0) * (isConfeccaoA ? 1 : fator);
                return (
                  <div key={ativ.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{ativ.atividade || 'Atividade'}</p>
                        {ativ.subdisciplina && <p className="text-xs text-gray-500 mt-0.5">{ativ.subdisciplina}</p>}
                      </div>
                      <span className="text-xs font-mono text-gray-600 shrink-0">{horas.toFixed(1)}h</span>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-200 flex justify-end">
                <span className="text-xs text-gray-500">
                  Total: <strong>
                    {atividadesVinculadas.reduce((s, a) => {
                      const isConfeccaoA = a.atividade && String(a.atividade).trim().startsWith('Confecção de A-');
                      return s + (Number(a.tempo) || 0) * (isConfeccaoA ? 1 : fator);
                    }, 0).toFixed(1)}h
                  </strong> ({atividadesVinculadas.length} atividades)
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}