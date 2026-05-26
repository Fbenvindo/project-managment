import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function AtividadesFolhaModal({ isOpen, onClose, planejamentoDocumento, executorMap, allPlanejamentos }) {
  const [atividadesVinculadas, setAtividadesVinculadas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !planejamentoDocumento) return;

    const docId = planejamentoDocumento.documento_id || planejamentoDocumento.id;
    const etapa = planejamentoDocumento.etapa;

    // Primeiro tenta filtrar de allPlanejamentos (que já está carregado no contexto)
    // Atividades de tipo 'atividade' vinculadas a este documento via documento_id
    const fromContext = (allPlanejamentos || []).filter(p => {
      if (p.tipo_planejamento === 'documento') return false;
      // Vinculação por documento_id direto
      if (p.documento_id && p.documento_id === docId) return true;
      // Vinculação pelo campo documento_ids (array)
      if (Array.isArray(p.documento_ids) && p.documento_ids.includes(docId)) return true;
      return false;
    });

    if (fromContext.length > 0) {
      setAtividadesVinculadas(fromContext);
      return;
    }

    // Fallback: buscar do banco diretamente
    setIsLoading(true);
    Promise.all([
      base44.entities.PlanejamentoAtividade.filter({ documento_id: docId }),
    ]).then(([ativs]) => {
      const filtradas = etapa ? (ativs || []).filter(a => !a.etapa || a.etapa === etapa) : (ativs || []);
      setAtividadesVinculadas(filtradas);
    }).catch(() => {
      setAtividadesVinculadas([]);
    }).finally(() => setIsLoading(false));
  }, [isOpen, planejamentoDocumento?.id, planejamentoDocumento?.documento_id]);

  if (!planejamentoDocumento) return null;

  const doc = planejamentoDocumento.documento;
  const titulo = doc
    ? [doc.numero, doc.arquivo, planejamentoDocumento.etapa].filter(Boolean).join(' - ')
    : planejamentoDocumento.descritivo || 'Documento';

  const statusLabel = {
    nao_iniciado: { label: 'Não Iniciado', color: 'bg-gray-100 text-gray-600' },
    em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
    concluido: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
    concluido_com_atraso: { label: 'Concluído c/ Atraso', color: 'bg-red-100 text-red-700' },
    atrasado: { label: 'Atrasado', color: 'bg-red-100 text-red-700' },
    pausado: { label: 'Pausado', color: 'bg-amber-100 text-amber-700' },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Atividades da Folha</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm font-medium text-gray-800 mb-4">{titulo}</p>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : atividadesVinculadas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhuma atividade vinculada encontrada.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {atividadesVinculadas.map(ativ => {
                const executor = ativ.executor_principal ? executorMap?.[ativ.executor_principal] : null;
                const st = statusLabel[ativ.status] || statusLabel['nao_iniciado'];
                return (
                  <div key={ativ.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 flex-1">
                        {ativ.atividade?.atividade || ativ.descritivo || 'Atividade'}
                      </p>
                      <Badge className={`text-xs px-1.5 py-0.5 shrink-0 ${st.color}`}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      {executor && <span>👤 {executor.nome || executor.email}</span>}
                      <span>⏱ {Number(ativ.tempo_planejado || 0).toFixed(1)}h planejado</span>
                      {Number(ativ.tempo_executado) > 0 && (
                        <span>✅ {Number(ativ.tempo_executado).toFixed(1)}h exec.</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}