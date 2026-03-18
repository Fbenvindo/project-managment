import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock, Users, Loader2 } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlanejamentoAtividade } from "@/entities/all";
import { distribuirHorasPorDias, getNextWorkingDay } from '../utils/DateCalculator';
import { retryWithBackoff } from '../utils/apiUtils';

export default function PREPlanejamentoModal({ isOpen, onClose, item, usuarios = [], empreendimento }) {
  const [executorEmail, setExecutorEmail] = useState('');
  const [tempoPlanejado, setTempoPlanejado] = useState(item?.tempo_planejamento ? String(item.tempo_planejamento) : '');
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usuariosOrdenados = useMemo(() => {
    return [...usuarios].sort((a, b) => (a.nome || a.email || '').localeCompare(b.nome || b.email || '', 'pt-BR', { sensitivity: 'base' }));
  }, [usuarios]);

  // Monta o descritivo com De / Item / Disciplina / Assunto
  const descritivo = useMemo(() => {
    if (!item) return '';
    const partes = [
      item.de && `De: ${item.de}`,
      item.item && `Item: ${item.item}`,
      item.descritiva && `Disciplina: ${item.descritiva}`,
      item.assunto && `Assunto: ${item.assunto}`,
    ].filter(Boolean);
    return partes.join(' | ');
  }, [item]);

  const handleSubmit = async () => {
    if (!executorEmail || !tempoPlanejado || Number(tempoPlanejado) <= 0) {
      alert('Preencha o executor e o tempo planejado.');
      return;
    }

    setIsSubmitting(true);
    try {
      const tempoTotal = Number(tempoPlanejado);

      // Buscar carga existente do executor
      const planejamentosExistentes = await retryWithBackoff(
        () => PlanejamentoAtividade.filter({ executor_principal: executorEmail }),
        3, 1000, 'PREPlan-loadCarga'
      );

      const cargaDiaria = {};
      planejamentosExistentes.filter(p => p.status !== 'concluido').forEach(p => {
        if (p.horas_por_dia) {
          Object.entries(p.horas_por_dia).forEach(([data, horas]) => {
            cargaDiaria[data] = (cargaDiaria[data] || 0) + Number(horas || 0);
          });
        }
      });

      const dataPartida = selectedDate ? startOfDay(selectedDate) : getNextWorkingDay(new Date());
      const { distribuicao, dataTermino } = distribuirHorasPorDias(dataPartida, tempoTotal, 8, cargaDiaria);

      if (!distribuicao || Object.keys(distribuicao).length === 0) {
        alert('Não foi possível alocar horas na agenda do executor.');
        return;
      }

      const inicioPlanejado = Object.keys(distribuicao).sort()[0];
      const terminoPlanejado = dataTermino ? format(dataTermino, 'yyyy-MM-dd') : inicioPlanejado;

      await retryWithBackoff(() => PlanejamentoAtividade.create({
        descritivo,
        empreendimento_id: empreendimento?.id || null,
        executor_principal: executorEmail,
        executores: [executorEmail],
        tempo_planejado: tempoTotal,
        inicio_planejado: inicioPlanejado,
        termino_planejado: terminoPlanejado,
        horas_por_dia: distribuicao,
        status: 'nao_iniciado',
        prioridade: 1,
        base_descritivo: `pre_item:${item.id}`,
      }), 3, 1000, 'PREPlan-create');

      alert('Planejamento criado com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao criar planejamento PRE:', error);
      alert(`Erro ao criar planejamento: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Planejar Item PRE
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Descritivo do item */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Descritivo do planejamento</p>
            <p className="text-sm text-blue-900 break-words">{descritivo || '(sem informações)'}</p>
          </div>

          {/* Executor */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Executor *
            </Label>
            <Select value={executorEmail} onValueChange={setExecutorEmail}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o executor" />
              </SelectTrigger>
              <SelectContent>
                {usuariosOrdenados.map(u => (
                  <SelectItem key={u.id} value={u.email}>
                    {u.nome || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tempo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tempo Planejado (horas) *
            </Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              value={tempoPlanejado}
              onChange={(e) => setTempoPlanejado(e.target.value)}
              placeholder="Ex: 2"
            />
          </div>

          {/* Data de início */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Data de Início (opcional)
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP', { locale: ptBR }) : 'Próxima data útil disponível'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !executorEmail || !tempoPlanejado || Number(tempoPlanejado) <= 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</> : 'Criar Planejamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}