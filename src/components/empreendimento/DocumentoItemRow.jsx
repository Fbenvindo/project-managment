import React, { useState, useMemo, useCallback } from "react";
import { TableRow, TableCell, TableHead, TableHeader } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, ChevronDown, ChevronRight, Users2, CalendarDays, Loader2, Check, FileText } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import PlanejamentoDocumentoEtapaModal from './PlanejamentoDocumentoEtapaModal';
import { createActivityCompletionHandler } from "./ActivityCompletionHandler";
import { Atividade, Documento, PlanejamentoAtividade, PlanejamentoDocumento } from "@/entities/all";
import { retryWithBackoff, retryWithExtendedBackoff } from '../utils/apiUtils';
import { base44 } from '@/api/base44Client';
import { ETAPAS_ORDER } from '../utils/PredecessoraValidator';

const ordenarAtividades = (atividades) => {
  return [...atividades].sort((a, b) => {
    const indexA = ETAPAS_ORDER.indexOf(a.etapa);
    const indexB = ETAPAS_ORDER.indexOf(b.etapa);
    if (indexA !== indexB) {
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }
    return String(a.id).localeCompare(String(b.id));
  });
};

export default function DocumentoItemRow({
  doc,
  planejamentos,
  allAtividades,
  handleEdit,
  handleDelete,
  handleOpenDocEtapaModal,
  handlePredecessoraChange,
  handleDataInicioChange,
  etapaParaPlanejamento,
  loadingDocs,
  empreendimento,
  onUpdate,
  readOnly,
  pavimentos,
  usuarios,
  localDocumentos,
  expandedRows,
  toggleRow,
  setCargaDiariaCache,
  localPlanejamentos,
  setLocalPlanejamentos
}) {
  const [isUpdatingActivity, setIsUpdatingActivity] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchPredecessor, setSearchPredecessor] = useState('');
  const [selectedAtividades, setSelectedAtividades] = useState([]);
  const [showExecutorDialog, setShowExecutorDialog] = useState(false);
  const [pendingExecutor, setPendingExecutor] = useState(null);
  
  const isDocLoading = loadingDocs[doc.id] || false;

  const planejamentosDoDocumento = useMemo(() => {
    return planejamentos.filter(p => p.documento_id === doc.id);
  }, [planejamentos, doc.id]);

  const atividadesDisponiveis = useMemo(() => {
    const subdisciplinasDoc = doc.subdisciplinas || [];
    const disciplinaDoc = doc.disciplina;
    const etapaOverrides = new Map();
    const tempoOverrides = new Map();
    
    allAtividades.forEach(ativ => {
      if (ativ.empreendimento_id === empreendimento.id && ativ.id_atividade && ativ.tempo !== -999) {
        etapaOverrides.set(ativ.id_atividade, ativ.etapa);
        tempoOverrides.set(ativ.id_atividade, ativ.tempo);
      }
    });

    let atividadesGerais = allAtividades.filter(ativ => {
      if (ativ.empreendimento_id) return false;
      const disciplinaMatch = ativ.disciplina === disciplinaDoc;
      const subdisciplinaMatch = Array.isArray(subdisciplinasDoc) && subdisciplinasDoc.includes(ativ.subdisciplina);
      return disciplinaMatch && subdisciplinaMatch;
    });

    const atividadesExcluidasGlobal = new Set();
    const atividadesExcluidasPorDoc = new Set();
    const atividadesConcluidasPorDoc = new Set();
    
    allAtividades.forEach(ativ => {
      if (ativ.empreendimento_id === empreendimento.id && ativ.id_atividade) {
        if (ativ.tempo === -999) {
          if (ativ.documento_id === doc.id) {
            atividadesExcluidasPorDoc.add(ativ.id_atividade);
          } else if (!ativ.documento_id) {
            atividadesExcluidasGlobal.add(ativ.id_atividade);
          }
        } else if (ativ.status_planejamento === 'concluida' && ativ.documento_id === doc.id) {
          atividadesConcluidasPorDoc.add(ativ.id_atividade);
        }
      }
    });

    atividadesGerais = atividadesGerais.filter(ativ => 
      !atividadesExcluidasGlobal.has(ativ.id) && !atividadesExcluidasPorDoc.has(ativ.id)
    );

    if (etapaParaPlanejamento !== 'todas') {
      atividadesGerais = atividadesGerais.filter(ativ => {
        const etapaFinal = etapaOverrides.has(ativ.id) ? etapaOverrides.get(ativ.id) : ativ.etapa;
        return etapaFinal === etapaParaPlanejamento;
      });
    }

    return ordenarAtividades(atividadesGerais).filter(atividade => {
      const planejamentoDaAtividade = planejamentosDoDocumento.find(p =>
        p.atividade_id === atividade.id && p.tipo_plano === 'atividade'
      );
      if (planejamentoDaAtividade && (planejamentoDaAtividade.tempo_planejado === 0 || !planejamentoDaAtividade.tempo_planejado)) {
        return false;
      }
      return true;
    }).map(atividade => {
      const nomeAtividadeSeguro = String(atividade.atividade || '');
      const etapaFinal = etapaOverrides.has(atividade.id) ? etapaOverrides.get(atividade.id) : atividade.etapa;
      const estaConcluida = atividadesConcluidasPorDoc.has(atividade.id);
      const tempoBaseOriginal = parseFloat(atividade.tempo) || 0;

      let tempoBase;
      if (estaConcluida) {
        tempoBase = 0;
      } else if (tempoOverrides.has(atividade.id)) {
        tempoBase = parseFloat(tempoOverrides.get(atividade.id)) || 0;
      } else {
        tempoBase = tempoBaseOriginal;
      }

      const planejamentoAtividade = planejamentosDoDocumento.find(p =>
        p.atividade_id === atividade.id && p.etapa === etapaFinal && p.tipo_plano === 'atividade' && p.tempo_planejado > 0
      );
      
      const planejamentoDocDaEtapa = planejamentosDoDocumento.find(p => 
        p.etapa === etapaFinal && p.tipo_plano === 'documento'
      );
      const jaFoiPlanejada = !!planejamentoDocDaEtapa || !!planejamentoAtividade;
      
      const statusPlanejamento = planejamentoAtividade?.status || (jaFoiPlanejada ? planejamentoDocDaEtapa?.status : null);
      const fatorDificuldade = doc.fator_dificuldade || 1;
      const isConfeccaoA = nomeAtividadeSeguro.trim().startsWith('Confecção de A-');
      const multiplier = isConfeccaoA ? 1 : fatorDificuldade;
      const tempoComFator = tempoBase * multiplier;
      const tempoBaseParaExibicao = estaConcluida ? tempoBaseOriginal : tempoBase;
      const pavimento = (pavimentos || []).find(p => p.id === doc.pavimento_id);
      const areaPavimento = pavimento ? Number(pavimento.area) : null;

      return {
        ...atividade,
        etapa: etapaFinal,
        tempoComFator,
        tempoBase,
        tempoBaseParaExibicao,
        area: areaPavimento,
        jaFoiPlanejada,
        estaConcluida,
        statusPlanejamento,
        planejamentoId: planejamentoAtividade?.id || planejamentoDocDaEtapa?.id
      };
    });
  }, [allAtividades, doc.disciplina, doc.fator_dificuldade, doc.pavimento_id, planejamentosDoDocumento, doc.subdisciplinas, doc.multiplos_executores, etapaParaPlanejamento, empreendimento.id, pavimentos, doc.id, doc.numero]);

  const tempoCalculadoPorEtapa = useMemo(() => {
    const atividadesFiltradas = etapaParaPlanejamento === 'todas'
      ? atividadesDisponiveis
      : atividadesDisponiveis.filter(ativ => ativ.etapa === etapaParaPlanejamento);
    return atividadesFiltradas.reduce((total, ativ) => total + (ativ.tempoComFator || 0), 0);
  }, [atividadesDisponiveis, etapaParaPlanejamento]);

  const handleToggleAtividade = (atividadeId) => {
    setSelectedAtividades(prev => 
      prev.includes(atividadeId) 
        ? prev.filter(id => id !== atividadeId)
        : [...prev, atividadeId]
    );
  };

  const handleMarcarComoConcluida = async (activityObj) => {
    setIsUpdatingActivity(true);
    try {
      await createActivityCompletionHandler(empreendimento, doc, onUpdate)(activityObj);
    } catch (error) {
      console.error("❌ Erro ao marcar atividade como concluída:", error);
      alert("Erro ao atualizar o status da atividade: " + error.message);
    } finally {
      setIsUpdatingActivity(false);
    }
  };

  const documentosFiltradosParaPredecessor = useMemo(() => {
    const docs = localDocumentos.filter(d => d.id !== doc.id);
    if (!searchPredecessor) return docs.slice(0, 50);
    const search = searchPredecessor.toLowerCase();
    return docs.filter(d => 
      d.numero?.toLowerCase().includes(search) || d.arquivo?.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [localDocumentos, doc.id, searchPredecessor]);

  return (
    <>
      <TableRow key={doc.id}>
        <TableCell>
          <Button variant="ghost" size="icon" onClick={() => toggleRow(doc.id)} disabled={isDocLoading}>
            {expandedRows[doc.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{doc.numero}</TableCell>
        <TableCell>{doc.arquivo}</TableCell>
        <TableCell className="text-sm text-gray-600 max-w-xs">
          {doc.descritivo ? (
            <span className="line-clamp-2" title={doc.descritivo}>{doc.descritivo}</span>
          ) : (
            <span className="text-gray-400 italic">Sem descrição</span>
          )}
        </TableCell>
        <TableCell>
          {doc.subdisciplinas && doc.subdisciplinas.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {doc.subdisciplinas.map((sub, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">{sub}</Badge>
              ))}
            </div>
          ) : (
            <span className="text-gray-400 italic text-xs">-</span>
          )}
        </TableCell>
        <TableCell className="text-sm text-gray-600">
          {doc.escala ? `1:${doc.escala}` : '-'}
        </TableCell>
        {!readOnly && (
          <TableCell className="w-[180px]">
            <div className="space-y-1">
              {doc.executor_principal ? (
                <div className="flex items-center justify-between p-1 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-medium text-green-800">
                      {usuarios.find(u => u.email === doc.executor_principal)?.nome || doc.executor_principal}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-gray-500">Não atribuído</span>
              )}
            </div>
          </TableCell>
        )}
        {!readOnly && (
          <TableCell className="text-sm text-gray-700">
            <div className="flex flex-col">
              <span>Início: {doc.inicio_planejado ? format(parseISO(doc.inicio_planejado), 'dd/MM/yyyy') : 'N/A'}</span>
              <span>Término: {doc.termino_planejado ? format(parseISO(doc.termino_planejado), 'dd/MM/yyyy') : 'N/A'}</span>
            </div>
          </TableCell>
        )}
        {!readOnly && (
          <TableCell className="text-sm text-gray-700">
            <div className="flex flex-col">
              <span className="font-medium">{`${tempoCalculadoPorEtapa.toFixed(1)}h`}</span>
              {etapaParaPlanejamento !== 'todas' && (
                <span className="text-xs text-gray-500">({etapaParaPlanejamento})</span>
              )}
            </div>
          </TableCell>
        )}
        {!readOnly && (
          <TableCell>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 border-blue-500 text-blue-600 hover:bg-blue-50"
                  onClick={() => handleOpenDocEtapaModal(doc)}
                  disabled={isDocLoading}
                  title="Planejar Documento"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleEdit(doc)} disabled={isDocLoading}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDelete(doc.id)} disabled={isDocLoading}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </TableCell>
        )}
      </TableRow>

      {expandedRows[doc.id] && (
        <TableRow>
          <TableCell colSpan={8} className="bg-gray-50">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold">Atividades da Folha: {doc.numero}</h4>
              </div>
              <div className="space-y-2">
                {atividadesDisponiveis.length > 0 ? atividadesDisponiveis.map(atividade => (
                  <div
                    key={atividade.id}
                    className={`flex justify-between items-center p-3 rounded border ${
                      atividade.estaConcluida ? 'bg-blue-50 border-blue-200' : atividade.jaFoiPlanejada ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${atividade.estaConcluida ? 'line-through text-gray-500' : ''}`}>
                            {String(atividade.atividade || '').replace(/^\(Concluída na folha \d+\)\s*/, '').trim() || 'Atividade'}
                          </span>
                          {atividade.statusPlanejamento === 'concluido' && (
                            <Badge className="bg-green-600 text-white text-xs">Finalizado</Badge>
                          )}
                          {atividade.estaConcluida && atividade.statusPlanejamento !== 'concluido' && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">Concluída</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{atividade.tempoComFator.toFixed(1)}h</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMarcarComoConcluida(atividade)}
                        className={atividade.estaConcluida ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-blue-600'}
                        disabled={isUpdatingActivity}
                      >
                        {isUpdatingActivity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-gray-500 p-4">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                    <p>Nenhuma atividade encontrada</p>
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}