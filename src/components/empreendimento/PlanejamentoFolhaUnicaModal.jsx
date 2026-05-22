import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlanejamentoAtividade, PlanejamentoDocumento, Atividade, Documento } from '@/entities/all';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { retryWithBackoff } from '../utils/apiUtils';
import { format, parseISO, isValid } from 'date-fns';
import { pt } from 'date-fns/locale';
import { getNextWorkingDay, distribuirHorasPorDias } from '../utils/DateCalculator';

export default function PlanejamentoFolhaUnicaModal({
  isOpen,
  onClose,
  folha,        // { source_documento_id, source_documento_numero, source_documento_arquivo, base_atividade_id, atividade, etapa, disciplina, subdisciplina, tempo }
  atividade,    // objeto da atividade pai
  usuarios,
  empreendimentoId,
  onSuccess
}) {
  const [formData, setFormData] = useState({
    tempo_planejado: '',
    executor_principal: '',
    metodo_data: 'agenda',
    data_inicio_manual: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const usuariosOrdenados = useMemo(() => {
    return [...(usuarios || [])].sort((a, b) =>
      (a.nome || a.email || '').localeCompare(b.nome || b.email || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [usuarios]);

  useEffect(() => {
    if (isOpen && folha) {
      setFormData({
        tempo_planejado: folha.tempo || atividade?.tempo || '',
        executor_principal: '',
        metodo_data: 'agenda',
        data_inicio_manual: null,
      });
    }
  }, [isOpen, folha, atividade]);

  const calcularDistribuicao = async (executorEmail, tempoPlanejado, fixedStartDate = null) => {
    const [planejamentosAtiv, planejamentosDoc] = await Promise.all([
      retryWithBackoff(() => PlanejamentoAtividade.filter({ executor_principal: executorEmail, status: { $ne: 'concluido' } }), 3, 1000, 'buscarPA'),
      retryWithBackoff(async () => { try { return await PlanejamentoDocumento.filter({ executor_principal: executorEmail, status: { $ne: 'concluido' } }); } catch { return []; } }, 3, 1000, 'buscarPD'),
    ]);

    const cargaDiaria = {};
    const hojeMidnight = new Date(); hojeMidnight.setHours(0, 0, 0, 0);

    [...(planejamentosAtiv || []), ...(planejamentosDoc || [])].forEach(plano => {
      if (!plano.horas_por_dia) return;
      Object.entries(plano.horas_por_dia).forEach(([data, horas]) => {
        const d = parseISO(data);
        if (isValid(d) && d >= hojeMidnight) {
          const k = format(d, 'yyyy-MM-dd');
          cargaDiaria[k] = (cargaDiaria[k] || 0) + (Number(horas) || 0);
        }
      });
    });

    const startDate = fixedStartDate || getNextWorkingDay(new Date());
    const resultado = distribuirHorasPorDias(startDate, tempoPlanejado, 8, cargaDiaria, !!fixedStartDate);
    const dias = Object.keys(resultado.distribuicao).sort();
    return {
      dataInicio: dias[0] || format(startDate, 'yyyy-MM-dd'),
      dataTermino: format(resultado.dataTermino, 'yyyy-MM-dd'),
      horasPorDia: resultado.distribuicao,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tempo_planejado || parseFloat(formData.tempo_planejado) <= 0) {
      alert('Por favor, insira um tempo válido maior que zero.');
      return;
    }
    if (!formData.executor_principal) {
      alert('Por favor, selecione um executor.');
      return;
    }
    if (formData.metodo_data === 'manual' && !formData.data_inicio_manual) {
      alert('Por favor, selecione uma data de início.');
      return;
    }

    setIsLoading(true);
    try {
      const tempo = parseFloat(formData.tempo_planejado);
      const dadosCalculo = await calcularDistribuicao(
        formData.executor_principal,
        tempo,
        formData.metodo_data === 'manual' ? formData.data_inicio_manual : null
      );

      await retryWithBackoff(
        () => PlanejamentoAtividade.create({
          atividade_id: folha.base_atividade_id || atividade?.id,
          empreendimento_id: empreendimentoId,
          descritivo: `${folha.atividade || atividade?.atividade} - ${folha.source_documento_numero}`,
          base_descritivo: folha.atividade || atividade?.atividade,
          etapa: folha.etapa,
          tempo_planejado: tempo,
          executor_principal: formData.executor_principal,
          executores: [formData.executor_principal],
          status: 'nao_iniciado',
          documento_id: folha.source_documento_id,
          prioridade: 1,
          inicio_planejado: dadosCalculo.dataInicio,
          termino_planejado: dadosCalculo.dataTermino,
          horas_por_dia: dadosCalculo.horasPorDia,
        }),
        3, 1000, `createPlanejamentoFolha-${folha.source_documento_id}`
      );

      // Atualizar status_planejamento na entidade Atividade
      const atividadeId = folha.base_atividade_id || atividade?.id;
      if (atividadeId) {
        await retryWithBackoff(
          () => Atividade.update(atividadeId, { status_planejamento: 'planejada' }),
          3, 500, `updateAtividadePlanejada-${atividadeId}`
        );
      }

      // Atualizar status no Documento (inicio_planejado / termino_planejado)
      if (folha.source_documento_id) {
        await retryWithBackoff(
          () => Documento.update(folha.source_documento_id, {
            inicio_planejado: dadosCalculo.dataInicio,
            termino_planejado: dadosCalculo.dataTermino,
          }),
          3, 500, `updateDocumentoPlanejado-${folha.source_documento_id}`
        );
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      alert('Erro ao criar planejamento: ' + (error.message || 'Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!folha) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Planejar Folha
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label>Folha</Label>
              <Input
                value={`${folha.source_documento_numero}${folha.source_documento_arquivo ? ' — ' + folha.source_documento_arquivo : ''}`}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <Label>Atividade</Label>
              <Input value={folha.atividade || atividade?.atividade || ''} disabled className="bg-gray-50" />
            </div>

            <div>
              <Label htmlFor="tempo_planejado">Tempo Planejado (horas)</Label>
              <Input
                id="tempo_planejado"
                type="number"
                step="0.1"
                min="0.1"
                value={formData.tempo_planejado}
                onChange={(e) => setFormData(prev => ({ ...prev, tempo_planejado: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="executor_principal">Executor</Label>
              <Select value={formData.executor_principal} onValueChange={(v) => setFormData(prev => ({ ...prev, executor_principal: v }))} required>
                <SelectTrigger id="executor_principal">
                  <SelectValue placeholder="Selecione o executor" />
                </SelectTrigger>
                <SelectContent>
                  {usuariosOrdenados.filter(u => u.status === 'ativo').map(u => (
                    <SelectItem key={u.id || u.email} value={u.email}>{u.nome || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="metodo_data">Método de Data</Label>
              <Select value={formData.metodo_data} onValueChange={(v) => setFormData(prev => ({ ...prev, metodo_data: v, data_inicio_manual: null }))}>
                <SelectTrigger id="metodo_data"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agenda">Automático (próxima data disponível)</SelectItem>
                  <SelectItem value="manual">Manual (escolher data)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.metodo_data === 'manual' && (
              <div>
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" type="button" className="w-full justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {formData.data_inicio_manual
                        ? format(formData.data_inicio_manual, 'dd/MM/yyyy', { locale: pt })
                        : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.data_inicio_manual}
                      onSelect={(date) => setFormData(prev => ({ ...prev, data_inicio_manual: date }))}
                      locale={pt}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Planejando...</> : 'Planejar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}