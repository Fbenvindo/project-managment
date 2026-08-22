import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, CalendarClock, CalendarX } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const parseLocal = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const fmtDate = (s) => {
  const d = parseLocal(s);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : (s || '—');
};

export default function ConflictResolutionModal({ open, folhaEntry, allPlanejamentos, executorMap, onResolve, onClose }) {
  const [resolving, setResolving] = useState(null);

  if (!folhaEntry) return null;

  const conflitos = folhaEntry._conflictWith || [];
  const resolvePlano = (id) => (allPlanejamentos || []).find(p => p.id === id);
  const executorName = executorMap?.[folhaEntry.executor_principal]?.nome || folhaEntry.executor_principal;

  const handle = async (action) => {
    setResolving(action);
    try {
      await onResolve(action);
    } finally {
      setResolving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !resolving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Conflito de Datas
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Planejamento sendo feito</p>
            <p className="font-semibold text-gray-800 truncate">{folhaEntry.empreendimento?.nome || 'Empreendimento'}</p>
            <p className="text-sm text-blue-600 font-medium flex items-center gap-1 flex-wrap">
              {folhaEntry.subdisciplina}
              <Badge variant="outline" className="text-xs">{folhaEntry.etapa}</Badge>
            </p>
            <p className="text-sm text-gray-700 mt-1 truncate">{folhaEntry.folhas?.[0]}</p>
            <p className="text-xs text-gray-600 mt-1">Executor: {executorName}</p>
            <p className="text-xs text-gray-600">
              Data: {fmtDate(folhaEntry.inicio_planejado)} · {Number(folhaEntry.tempo_planejado).toFixed(1)}h
            </p>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700 uppercase mb-2">
              Atividade(s) já programada(s) em conflito
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {conflitos.map((c) => {
                const p = resolvePlano(c.id);
                const desc = p?.descritivo || p?.atividade?.atividade || p?.documento?.arquivo || p?.titulo || 'Atividade';
                return (
                  <div key={c.id} className="text-sm bg-white rounded border border-red-100 p-2">
                    <p className="font-medium text-gray-800 truncate">{desc}</p>
                    <p className="text-xs text-gray-600">
                      Dia {fmtDate(c.dia)} · {Number(c.horas).toFixed(1)}h
                      {p?.empreendimento?.nome ? ` · ${p.empreendimento.nome}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Escolha como resolver: reagendar o planejamento da etapa para o próximo dia livre ou mover a atividade já programada.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={!!resolving}>Cancelar</Button>
          <Button
            onClick={() => handle('move_existing')}
            disabled={!!resolving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {resolving === 'move_existing'
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <CalendarX className="w-4 h-4 mr-2" />}
            Alterar atividade já programada
          </Button>
          <Button
            onClick={() => handle('shift_etapa')}
            disabled={!!resolving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {resolving === 'shift_etapa'
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <CalendarClock className="w-4 h-4 mr-2" />}
            Alterar planejamento sendo feito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}