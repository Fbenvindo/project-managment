import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlanejamentoAtividade, PlanejamentoDocumento, Execucao } from '@/entities/all';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : dateStr;
  } catch {
    return dateStr;
  }
};

const formatHours = (h) => h != null ? `${Number(h).toFixed(1)}h` : '—';

const statusLabels = {
  nao_iniciado: 'Não Iniciado',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  concluido_com_atraso: 'Concluído com Atraso',
  atrasado: 'Atrasado',
  pausado: 'Pausado',
};

const statusColors = {
  nao_iniciado: 'bg-gray-100 text-gray-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  concluido: 'bg-green-100 text-green-700',
  concluido_com_atraso: 'bg-red-100 text-red-700',
  atrasado: 'bg-red-100 text-red-700',
  pausado: 'bg-yellow-100 text-yellow-700',
};

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-start py-1.5 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500 font-medium min-w-[140px]">{label}</span>
    <span className="text-sm text-gray-800 text-right">{value || '—'}</span>
  </div>
);

export default function EditActivityModal({ plano, displayName, isOpen, onClose, onSave }) {
  const [descricao, setDescricao] = useState(plano?.descritivo || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!descricao.trim()) {
      alert('Descrição não pode estar vazia');
      return;
    }
    setIsLoading(true);
    try {
      if (plano.isLegacyExecution) {
        const execId = plano.id.split('-')[1];
        await Execucao.update(execId, { descritivo: descricao.trim() });
      } else {
        const entity = plano.tipo_planejamento === 'documento' ? PlanejamentoDocumento : PlanejamentoAtividade;
        await entity.update(plano.id, { descritivo: descricao.trim() });
      }
      onSave?.();
      onClose();
    } catch (error) {
      alert('Erro ao salvar: ' + (error.message || 'Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!plano) return null;

  const tempoExec = Number(plano.tempo_executado) || 0;
  const tempoPlan = Number(plano.tempo_planejado) || 0;
  const diasPlanejados = Object.keys(plano.horas_por_dia || {}).sort();
  const diasExecutados = Object.keys(plano.horas_executadas_por_dia || {})
    .filter(d => Number(plano.horas_executadas_por_dia[d]) > 0).sort();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Editar Atividade</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[plano.status] || statusColors.nao_iniciado}`}>
              {statusLabels[plano.status] || plano.status || 'Não Iniciado'}
            </span>
            {plano.tipo_planejamento === 'documento' && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">Planejamento de Documento</Badge>
            )}
            {plano.isQuickActivity && (
              <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">Atividade Rápida</Badge>
            )}
          </div>

          {/* Descrição editável */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Descrição / Nome da Atividade</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="min-h-20 text-sm"
              placeholder="Descrição da atividade"
            />
          </div>

          {/* Informações gerais */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Informações Gerais</p>
            {plano.empreendimento?.nome && (
              <InfoRow label="Empreendimento" value={plano.empreendimento.nome} />
            )}
            {(plano.atividade?.disciplina || plano.atividade?.subdisciplina) && (
              <InfoRow
                label="Disciplina / Subdisciplina"
                value={[plano.atividade?.disciplina, plano.atividade?.subdisciplina].filter(Boolean).join(' / ')}
              />
            )}
            {plano.etapa && <InfoRow label="Etapa" value={plano.etapa} />}
            {plano.documento?.numero_completo && (
              <InfoRow label="Documento" value={plano.documento.numero_completo} />
            )}
            {plano.executor_principal && (
              <InfoRow label="Executor Principal" value={plano.executor_principal} />
            )}
            {plano.prioridade && (
              <InfoRow label="Prioridade" value={`${plano.prioridade}`} />
            )}
          </div>

          {/* Datas e Tempos */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Datas & Tempos</p>
            <InfoRow label="Tempo Planejado" value={formatHours(tempoPlan)} />
            <InfoRow label="Tempo Executado" value={formatHours(tempoExec > 0 ? tempoExec : null)} />
            <InfoRow label="Início Planejado" value={formatDate(plano.inicio_planejado)} />
            <InfoRow label="Término Planejado" value={formatDate(plano.termino_planejado)} />
            {plano.inicio_ajustado && <InfoRow label="Início Ajustado" value={formatDate(plano.inicio_ajustado)} />}
            {plano.termino_ajustado && <InfoRow label="Término Ajustado" value={formatDate(plano.termino_ajustado)} />}
            {plano.inicio_real && <InfoRow label="Início Real" value={formatDate(plano.inicio_real)} />}
            {plano.termino_real && <InfoRow label="Término Real" value={formatDate(plano.termino_real)} />}
            {plano.horario_inicio && <InfoRow label="Horário Início" value={plano.horario_inicio} />}
            {plano.horario_termino && <InfoRow label="Horário Término" value={plano.horario_termino} />}
          </div>

          {/* Dias com alocação */}
          {diasPlanejados.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dias Planejados ({diasPlanejados.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {diasPlanejados.map(d => (
                  <span key={d} className="text-xs bg-white border border-blue-200 text-blue-700 rounded px-2 py-0.5 font-mono">
                    {formatDate(d)} — {formatHours(plano.horas_por_dia[d])}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dias executados */}
          {diasExecutados.length > 0 && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dias Executados ({diasExecutados.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {diasExecutados.map(d => (
                  <span key={d} className="text-xs bg-white border border-green-200 text-green-700 rounded px-2 py-0.5 font-mono">
                    {formatDate(d)} — {formatHours(plano.horas_executadas_por_dia[d])}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observação */}
          {plano.observacao && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Observação</p>
              <p className="text-sm text-amber-900">{plano.observacao}</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}