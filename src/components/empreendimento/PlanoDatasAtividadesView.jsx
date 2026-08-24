import React, { useState, useEffect, useMemo } from "react";
import { PlanoDataEtapa } from "@/entities/all";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import EtapaPlanoGroup from "./EtapaPlanoGroup";

export default function PlanoDatasAtividadesView({
  empreendimentoId,
  disciplina,
  atividades,
  feriados,
  readOnly,
  selectedAtividades,
  onToggleAtividade,
  onEdit,
  onDelete,
  onChangeStatus,
}) {
  const [planos, setPlanos] = useState([]);
  const [subsExpandidas, setSubsExpandidas] = useState({});

  const loadPlanos = async () => {
    try {
      const lista = await PlanoDataEtapa.filter({ empreendimento_id: empreendimentoId });
      setPlanos(lista || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPlanos();
  }, [empreendimentoId]);

  const grupos = useMemo(() => {
    const porSub = {};
    atividades.forEach((a) => {
      const sub = a.subdisciplina || "Sem Subdisciplina";
      if (!porSub[sub]) porSub[sub] = [];
      porSub[sub].push(a);
    });
    return Object.entries(porSub).map(([sub, acts]) => {
      const porEtapa = {};
      acts.forEach((a) => {
        const etapa = a.etapa || "Sem Etapa";
        if (!porEtapa[etapa]) porEtapa[etapa] = [];
        porEtapa[etapa].push(a);
      });
      return {
        subdisciplina: sub,
        totalHoras: acts.reduce((s, a) => s + (Number(a.tempo) || 0), 0),
        etapas: Object.entries(porEtapa).map(([etapa, ats]) => ({
          etapa,
          atividades: ats,
        })),
      };
    });
  }, [atividades]);

  const getPlano = (sub, etapa) =>
    planos.find(
      (p) => p.subdisciplina === sub && p.etapa === etapa && p.disciplina === disciplina
    );

  return (
    <div className="space-y-3">
      {grupos.map((grupo) => (
        <div key={grupo.subdisciplina} className="border rounded-lg overflow-hidden">
          <div
            className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
            onClick={() =>
              setSubsExpandidas((prev) => ({
                ...prev,
                [grupo.subdisciplina]: !prev[grupo.subdisciplina],
              }))
            }
          >
            <div className="font-medium text-gray-700 flex items-center gap-2">
              {subsExpandidas[grupo.subdisciplina] ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              {grupo.subdisciplina}
              <Badge variant="secondary">{grupo.etapas.length} etapa(s)</Badge>
              <Badge variant="outline" className="text-blue-700">
                <Clock className="w-3 h-3 mr-1" />
                {grupo.totalHoras.toFixed(1)}h
              </Badge>
            </div>
          </div>
          {subsExpandidas[grupo.subdisciplina] !== false && (
            <div className="p-3 bg-white">
              {grupo.etapas.map((et) => (
                <EtapaPlanoGroup
                  key={et.etapa}
                  empreendimentoId={empreendimentoId}
                  disciplina={disciplina}
                  subdisciplina={grupo.subdisciplina}
                  etapa={et.etapa}
                  atividades={et.atividades}
                  feriados={feriados}
                  readOnly={readOnly}
                  plano={getPlano(grupo.subdisciplina, et.etapa)}
                  onPlanoUpdated={loadPlanos}
                  selectedAtividades={selectedAtividades}
                  onToggleAtividade={onToggleAtividade}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onChangeStatus={onChangeStatus}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}