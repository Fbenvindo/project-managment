import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { calcularDataTermino, formatarDataBR } from "@/components/utils/PlanoDatasUtils";

export default function EtapaDataCell({ plano, feriados, totalHoras, onSave, disabled }) {
  const [dataInicio, setDataInicio] = useState(plano?.data_inicio || "");

  useEffect(() => {
    setDataInicio(plano?.data_inicio || "");
  }, [plano?.id, plano?.data_inicio]);

  const dataTermino = useMemo(
    () => calcularDataTermino(dataInicio, totalHoras, feriados)?.dataTermino || null,
    [dataInicio, totalHoras, feriados]
  );

  const handleSave = (value) => {
    if (!value) return;
    const termino = calcularDataTermino(value, totalHoras, feriados)?.dataTermino || null;
    onSave?.(value, termino);
  };

  return (
    <div className="flex items-center gap-1">
      <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
      <Input
        type="date"
        value={dataInicio}
        disabled={disabled}
        onChange={(e) => setDataInicio(e.target.value)}
        onBlur={(e) => handleSave(e.target.value)}
        className="h-6 w-[130px] text-xs"
      />
      {dataTermino && (
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          {formatarDataBR(dataTermino)}
        </Badge>
      )}
    </div>
  );
}