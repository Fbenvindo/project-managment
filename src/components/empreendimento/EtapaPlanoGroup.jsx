import React, { useState, useMemo, useEffect } from "react";
import { PlanoDataEtapa } from "@/entities/all";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Edit,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  Calendar,
} from "lucide-react";
import {
  calcularDataTermino,
  formatarDataBR,
} from "@/components/utils/PlanoDatasUtils";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function EtapaPlanoGroup({
  empreendimentoId,
  disciplina,
  subdisciplina,
  etapa,
  atividades,
  feriados,
  readOnly,
  plano,
  onPlanoUpdated,
  selectedAtividades,
  onToggleAtividade,
  onEdit,
  onDelete,
  onChangeStatus,
}) {
  const { toast } = useToast();

  const horasTotais = useMemo(
    () => atividades.reduce((s, a) => s + (Number(a.tempo) || 0), 0),
    [atividades]
  );

  const [dataInicio, setDataInicio] = useState(plano?.data_inicio || "");

  useEffect(() => {
    if (plano?.data_inicio && plano.data_inicio !== dataInicio) {
      setDataInicio(plano.data_inicio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plano?.data_inicio]);

  const calc = calcularDataTermino(dataInicio, horasTotais, feriados);
  const dataTermino = calc?.dataTermino || null;
  const diasUteis = calc?.diasUteis || 0;

  const handleSave = async (novoDataInicio) => {
    if (!novoDataInicio) return;
    const c = calcularDataTermino(novoDataInicio, horasTotais, feriados);
    const payload = {
      empreendimento_id: empreendimentoId,
      disciplina,
      subdisciplina,
      etapa,
      data_inicio: novoDataInicio,
      data_termino: c?.dataTermino || null,
      horas_totais: horasTotais,
    };
    try {
      if (plano?.id) {
        await PlanoDataEtapa.update(plano.id, payload);
      } else {
        await PlanoDataEtapa.create(payload);
      }
      onPlanoUpdated();
      toast({ title: "Data inicial salva" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar data", variant: "destructive" });
    }
  };

  return (
    <div className="border rounded-lg mb-3">
      <div className="bg-gray-50 px-4 py-3 border-b flex flex-wrap items-center gap-3">
        <div className="font-semibold text-gray-800">{etapa}</div>
        <Badge variant="secondary">{atividades.length} ativ.</Badge>
        <Badge variant="outline">{horasTotais.toFixed(1)}h</Badge>
        {diasUteis > 0 && <Badge variant="outline">{diasUteis} dias úteis</Badge>}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Início
          </label>
          <Input
            type="date"
            value={dataInicio}
            disabled={readOnly}
            onChange={(e) => setDataInicio(e.target.value)}
            onBlur={(e) => handleSave(e.target.value)}
            className="h-8 w-40"
          />
          <span className="text-xs text-gray-500">Término</span>
          <Badge className={dataTermino ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
            {dataTermino ? formatarDataBR(dataTermino) : "-"}
          </Badge>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Atividade</TableHead>
            <TableHead>Folhas</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tempo</TableHead>
            <TableHead>Total</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {atividades.map((atividade) => {
            const numFolhas =
              atividade.documento_ids?.length || (atividade.documento_id ? 1 : 0);
            return (
              <TableRow key={atividade.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedAtividades?.includes(atividade.id)}
                    onCheckedChange={() => onToggleAtividade(atividade.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {String(atividade.atividade || "")}
                </TableCell>
                <TableCell>
                  {numFolhas > 0 ? (
                    <Badge variant="outline">
                      {numFolhas} {numFolhas === 1 ? "folha" : "folhas"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Disponível</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border cursor-pointer ${
                          atividade.status_planejamento === "concluida"
                            ? "bg-green-100 text-green-800 border-green-300"
                            : atividade.status_planejamento === "planejada"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : "bg-gray-100 text-gray-600 border-gray-300"
                        }`}
                      >
                        {atividade.status_planejamento === "concluida" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : atividade.status_planejamento === "planejada" ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <Circle className="w-3 h-3" />
                        )}
                        {atividade.status_planejamento === "concluida"
                          ? "Concluída"
                          : atividade.status_planejamento === "planejada"
                          ? "Planejada"
                          : "Disponível"}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1" align="start">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => onChangeStatus(atividade, "nao_planejada")}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-gray-100 text-left w-full"
                        >
                          <Circle className="w-3 h-3 text-gray-500" /> Disponível
                        </button>
                        <button
                          onClick={() => onChangeStatus(atividade, "planejada")}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-blue-50 text-blue-700 text-left w-full"
                        >
                          <Clock className="w-3 h-3" /> Planejada
                        </button>
                        <button
                          onClick={() => onChangeStatus(atividade, "concluida")}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-green-50 text-green-700 text-left w-full"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Concluída
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell>{atividade.tempo}h</TableCell>
                <TableCell className="font-semibold">
                  {(atividade.tempo * numFolhas).toFixed(1)}h
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(atividade)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    onClick={() => onDelete(atividade.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}