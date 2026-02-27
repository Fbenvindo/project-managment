import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Trash2 } from "lucide-react";
import { retryWithBackoff } from '../utils/apiUtils';

export default function ActivityListItem({ 
  atividade, 
  doc, 
  empreendimento, 
  onUpdate,
  onExcluir 
}) {
  const [isUpdatingActivity, setIsUpdatingActivity] = useState(false);
  const subdisciplina = atividade.subdisciplina || 'N/A';

  const handleMarcarComoConcluida = async () => {
    console.log(`\n✅ Marcando "${atividade.atividade}" como concluída na folha ${doc.numero}...\n`);
    setIsUpdatingActivity(true);
    try {
      const existingMarkers = await retryWithBackoff(
        () => base44.entities.Atividade.filter({
          empreendimento_id: empreendimento.id,
          id_atividade: atividade.id,
          documento_id: doc.id,
          tempo: 0
        }),
        3, 1000, `checkConclusionMarker-${atividade.id}-${doc.id}`
      );

      if (existingMarkers && existingMarkers.length > 0) {
        console.log(`Desmarcando (removendo ${existingMarkers.length} marcador(es))...`);
        for (const marker of existingMarkers) {
          await retryWithBackoff(
            () => base44.entities.Atividade.delete(marker.id),
            3, 1000, `removeConclusionMarker-${marker.id}`
          );
        }
      } else {
        const novoMarcador = {
          etapa: atividade.etapa,
          disciplina: atividade.disciplina,
          subdisciplina: atividade.subdisciplina,
          atividade: `(Concluída na folha ${doc.numero}) ${String(atividade.atividade || '')}`,
          funcao: atividade.funcao,
          empreendimento_id: empreendimento.id,
          id_atividade: atividade.id,
          documento_id: doc.id,
          tempo: 0
        };

        console.log(`Criando marcador de conclusão...`);
        await retryWithBackoff(
          () => base44.entities.Atividade.create(novoMarcador),
          3, 1000, `createConclusionMarker-${atividade.id}-${doc.id}`
        );
      }

      console.log(`✅ Marcador atualizado. Recarregando...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      await onUpdate();
    } catch (error) {
      console.error("❌ Erro ao marcar atividade como concluída:", error);
      alert("Erro ao atualizar o status da atividade: " + error.message);
    } finally {
      setIsUpdatingActivity(false);
    }
  };

  return (
    <div
      className={`flex justify-between items-center p-3 rounded border ${
        atividade.estaConcluida
          ? 'bg-blue-50 border-blue-200'
          : atividade.jaFoiPlanejada
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 pr-2">
        <Checkbox
          checked={false}
          disabled={isUpdatingActivity}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${atividade.estaConcluida || atividade.statusPlanejamento === 'concluido' ? 'line-through text-gray-500' : ''}`}>
              {String(atividade.atividade || '').replace(/^\(Concluída na folha \d+\)\s*/, '').trim() || 'Atividade'}
            </span>
            {atividade.statusPlanejamento === 'concluido' && (
              <Badge className="bg-green-600 text-white text-xs">
                Finalizado
              </Badge>
            )}
            {atividade.estaConcluida && atividade.statusPlanejamento !== 'concluido' && (
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                Concluída Manualmente
              </Badge>
            )}
            {atividade.statusPlanejamento === 'em_andamento' && (
              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                Em Andamento
              </Badge>
            )}
            {atividade.statusPlanejamento === 'nao_iniciado' && (
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                Planejado
              </Badge>
            )}
            {!atividade.statusPlanejamento && !atividade.estaConcluida && (
              <Badge className="bg-gray-100 text-gray-600 text-xs">
                Disponível para planejamento
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {atividade.etapa} • {subdisciplina}
            {atividade.area && (
              <span className={`ml-2 ${atividade.estaConcluida ? 'line-through text-gray-400' : 'text-blue-600'}`}>
                • {atividade.tempoBaseParaExibicao.toFixed(2)}h/m² × {atividade.area}m²
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className={`text-sm font-medium ${atividade.estaConcluida || atividade.statusPlanejamento === 'concluido' ? 'line-through text-gray-400' : ''}`}>
            {atividade.estaConcluida || atividade.statusPlanejamento === 'concluido'
              ? `${((atividade.area || 1) * atividade.tempoBaseParaExibicao * (doc.fator_dificuldade || 1)).toFixed(1)}h`
              : `${atividade.tempoComFator.toFixed(1)}h`
            }
          </div>
          {atividade.statusPlanejamento === 'concluido' && (
            <div className="text-xs text-green-600">
              Finalizado no planejamento
            </div>
          )}
          {atividade.estaConcluida && atividade.statusPlanejamento !== 'concluido' && (
            <div className="text-xs text-gray-500">
              Tempo zerado (concluída manualmente)
            </div>
          )}
          {atividade.statusPlanejamento && atividade.statusPlanejamento !== 'concluido' && !atividade.estaConcluida && (
            <div className="text-xs text-blue-600">
              {atividade.statusPlanejamento === 'em_andamento' ? 'Em execução' : 'Planejado'}
            </div>
          )}
          {!atividade.estaConcluida && !atividade.statusPlanejamento && (
            <div className="text-xs text-gray-500">
              Disponível para planejamento
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMarcarComoConcluida}
          className={`${
            atividade.estaConcluida 
              ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50' 
              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
          }`}
          title={atividade.estaConcluida ? "Desmarcar como concluída" : "Marcar como concluída"}
          disabled={isUpdatingActivity}
        >
          {isUpdatingActivity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onExcluir(atividade)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
          title="Excluir atividade SOMENTE desta folha"
          disabled={isUpdatingActivity}
        >
          {isUpdatingActivity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}