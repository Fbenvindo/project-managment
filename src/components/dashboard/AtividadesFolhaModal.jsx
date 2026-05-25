// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle2, Clock, AlertCircle, Circle } from "lucide-react";
import { PlanejamentoAtividade } from '@/entities/all';
import { retryWithBackoff } from '../utils/apiUtils';

const STATUS_CONFIG = {
  concluido:         { label: 'Concluído',        color: 'bg-green-100 text-green-700 border-green-300',  Icon: CheckCircle2 },
  concluido_com_atraso: { label: 'Concluído c/ Atraso', color: 'bg-orange-100 text-orange-700 border-orange-300', Icon: CheckCircle2 },
  em_andamento:      { label: 'Em Andamento',     color: 'bg-blue-100 text-blue-700 border-blue-300',    Icon: Clock },
  atrasado:          { label: 'Atrasado',          color: 'bg-red-100 text-red-700 border-red-300',       Icon: AlertCircle },
  pausado:           { label: 'Pausado',           color: 'bg-yellow-100 text-yellow-700 border-yellow-300', Icon: Clock },
  nao_iniciado:      { label: 'Não Iniciado',      color: 'bg-gray-100 text-gray-600 border-gray-300',   Icon: Circle },
};

const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG['nao_iniciado'];

export default function AtividadesFolhaModal({ isOpen, onClose, planejamentoDocumento, executorMap }) {
  const [atividades, setAtividades] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const documentoId = planejamentoDocumento?.documento_id;
  const empreendimentoId = planejamentoDocumento?.empreendimento_id;

  useEffect(() => {
    if (!isOpen) return;
    
    console.log('[AtividadesFolhaModal] planejamentoDocumento:', planejamentoDocumento);
    console.log('[AtividadesFolhaModal] documentoId:', documentoId, 'empreendimentoId:', empreendimentoId);
    
    if (!documentoId && !empreendimentoId) return;
    setIsLoading(true);

    const queries = [];
    if (documentoId) {
      queries.push(
        retryWithBackoff(() => PlanejamentoAtividade.filter({ documento_id: documentoId }), 3, 1000, 'atividadesFolha1').catch(e => { console.error('query1 error:', e); return []; })
      );
    }
    if (empreendimentoId && documentoId) {
      queries.push(
        retryWithBackoff(() => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, documento_id: documentoId }), 3, 1000, 'atividadesFolha2').catch(e => { console.error('query2 error:', e); return []; })
      );
    }
    if (queries.length === 0) { setIsLoading(false); return; }

    Promise.all(queries)
      .then(resultados => {
        const mapa = new Map();
        resultados.flat().forEach(a => { if (a?.id) mapa.set(a.id, a); });
        const arr = Array.from(mapa.values());
        console.log('[AtividadesFolhaModal] resultados encontrados:', arr.length, arr);
        setAtividades(arr);
      })
      .catch(e => { console.error('AtividadesFolhaModal error:', e); setAtividades([]); })
      .finally(() => setIsLoading(false));
  }, [isOpen, documentoId, empreendimentoId]);

  const titulo = (() => {
    const num = planejamentoDocumento?.documento?.numero;
    const arq = planejamentoDocumento?.documento?.arquivo;
    const parts = [num, arq].filter(Boolean);
    return parts.length ? parts.join(' - ') : planejamentoDocumento?.descritivo || 'Folha';
  })();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5 text-blue-600" />
            Atividades da Folha
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">{titulo}</p>
          {planejamentoDocumento?.etapa && (
            <Badge variant="outline" className="self-start text-xs mt-1">{planejamentoDocumento.etapa}</Badge>
          )}
          <p className="text-xs text-gray-300 mt-0.5">doc_id: {documentoId || 'null'} | emp_id: {empreendimentoId || 'null'}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
              <span className="text-gray-500">Carregando atividades...</span>
            </div>
          ) : atividades.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Circle className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm">Nenhuma atividade detalhada planejada para esta folha.</p>
              <p className="text-xs mt-1 text-gray-300">As atividades aparecem aqui quando são planejadas individualmente para cada executor.</p>
            </div>
          ) : (
            <div className="space-y-2 pr-1">
              {atividades.map(ativ => {
                const cfg = getStatusConfig(ativ.status);
                const executor = executorMap?.[ativ.executor_principal];
                const executorNome = executor?.nome || ativ.executor_principal || '—';
                const horasPlanejadas = Number(ativ.tempo_planejado) || 0;
                const horasExecutadas = Number(ativ.tempo_executado) || 0;

                return (
                  <div key={ativ.id} className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-tight">
                          {ativ.descritivo || ativ.atividade?.atividade || 'Atividade sem nome'}
                        </p>
                        {ativ.etapa && (
                          <p className="text-xs text-gray-400 mt-0.5">{ativ.etapa}</p>
                        )}
                      </div>
                      <Badge className={`text-xs px-2 py-0.5 border shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {horasPlanejadas.toFixed(1)}h plan. / {horasExecutadas.toFixed(1)}h exec.
                      </span>
                      <span className="text-gray-400">•</span>
                      <span>
                        <span className="font-medium text-gray-600">Executor:</span> {executorNome}
                      </span>
                      {ativ.inicio_planejado && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span>
                            {ativ.inicio_planejado}
                            {ativ.termino_planejado && ` → ${ativ.termino_planejado}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-gray-100 text-xs text-gray-400 text-right">
          {!isLoading && `${atividades.length} atividade${atividades.length !== 1 ? 's' : ''} encontrada${atividades.length !== 1 ? 's' : ''}`}
        </div>
      </DialogContent>
    </Dialog>
  );
}