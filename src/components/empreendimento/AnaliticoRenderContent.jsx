// @ts-nocheck
import React, { useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// @ts-ignore
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Loader2, PackageOpen, PlusCircle, ChevronRight, ChevronDown, Trash2, Edit, Edit2,
  Calendar, CheckCircle2, XCircle, FileX, Layers, Users2, CheckCircle, MoreHorizontal, RotateCcw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AnaliticoFolhaRow from './AnaliticoFolhaRow';
import { PlanejamentoAtividade, Atividade } from '@/entities/all';
import { retryWithBackoff } from '../utils/apiUtils';

export default function AnaliticoRenderContent({
  isLoading,
  atividadesAgrupadas,
  atividadesPorDisciplina,
  handleOpenModal,
  selectedIds,
  isDeletingMultiple,
  handleSelectAll,
  handleDeleteSelected,
  atividadesSelecionadasParaPlanejar,
  setAtividadesSelecionadasParaPlanejar,
  atividadesSelecionadasParaExcluir,
  setAtividadesSelecionadasParaExcluir,
  handleExcluirMultiplas,
  isExcluindoMultiplasFolhas,
  expandedAtividades,
  toggleAtividadeExpansion,
  isDeletingActivity,
  isConcluindo,
  isSavingExecutor,
  datasInicio,
  setDatasInicio,
  planejamentos,
  empreendimentoId,
  handleSelectItem,
  handleOpenEtapaModal,
  handleOpenEditarEtapaEmFolhasModal,
  handleConcluirEmTodasFolhas,
  handleOpenExcluirDeFolhasModal,
  handleExcluirAtividade,
  handleDelete,
  handleSaveExecutor,
  handlePlanejarMultiplas,
  handleToggleFolhaConcluida,
  usuarios,
  editandoTempo,
  novosTempoPadrao,
  setNovosTempoPadrao,
  setEditandoTempo,
  handleSalvarTempoPadrao,
  itensPRE,
  handleSaveFolhaExecutor,
  datasInicioFolha,
  setDatasInicioFolha,
  isSavingFolhaExecutor,
  fetchData,
  handleReverterAtividade,
  filters,
  handleAtribuirExecutorDisciplina,
  handleAtribuirExecutorSubdisciplina,
  isSavingExecutorDisciplina,
  handleSaveAtividadeExecutor,
}) {
  // folhasSelecionadas lives here so checkbox clicks don't re-render the entire parent
  const [folhasSelecionadas, setFolhasSelecionadas] = useState(new Set());
  const [isConcluindoFolhas, setIsConcluindoFolhas] = useState(false);
  const [isReverendoFolhas, setIsReverendoFolhas] = useState(false);
  const [isExcluindoFolhas, setIsExcluindoFolhas] = useState(false);
  const [isConcluindoAtividades, setIsConcluindoAtividades] = useState(false);
  const [disciplinasRecolhidas, setDisciplinasRecolhidas] = useState(() => new Set());
  const [subdisciplinasRecolhidas, setSubdisciplinasRecolhidas] = useState(() => new Set());
  const [folhasExpandidas, setFolhasExpandidas] = useState(() => new Set());
  const [etapasExpandidas, setEtapasExpandidas] = useState(() => new Set());

  const toggleDisciplina = useCallback((d) => setDisciplinasRecolhidas(p => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; }), []);
  const toggleSubdisciplina = useCallback((k) => setSubdisciplinasRecolhidas(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }), []);
  const toggleFolha = useCallback((k) => setFolhasExpandidas(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }), []);
  const toggleEtapa = useCallback((k) => setEtapasExpandidas(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }), []);

  const handleConcluirFolha = useCallback(() => {
    if (fetchData) fetchData();
  }, [fetchData]);

  const handleConcluirFolhasSelecionadas = useCallback(async () => {
    if (folhasSelecionadas.size === 0) return;
    setIsConcluindoFolhas(true);
    const hoje = format(new Date(), 'yyyy-MM-dd');

    // Collect all folha objects matching selected ids
    const folhasParaConcluir = [];
    for (const grupo of (atividadesAgrupadas || [])) {
      for (const folha of (grupo.folhas || [])) {
        if (folhasSelecionadas.has(folha.source_documento_id) && folha.status !== 'Concluída') {
          folhasParaConcluir.push(folha);
        }
      }
    }

    let erros = 0;
    for (const folha of folhasParaConcluir) {
      try {
        const atividadeId = folha.base_atividade_id;
        const docId = folha.source_documento_id;

        const planos = await retryWithBackoff(
          () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, atividade_id: atividadeId, documento_id: docId }),
          3, 300, `plano-${docId}-${atividadeId}`
        );

        if (planos.length > 0) {
          await retryWithBackoff(
            () => PlanejamentoAtividade.update(planos[0].id, { status: 'concluido', termino_real: hoje }),
            3, 300, `concluir-${planos[0].id}`
          );
        } else {
          await retryWithBackoff(
            () => PlanejamentoAtividade.create({
              empreendimento_id: empreendimentoId,
              atividade_id: atividadeId,
              documento_id: docId,
              etapa: folha.etapa,
              descritivo: folha.atividade,
              tempo_planejado: folha.tempo || 0,
              status: 'concluido',
              termino_real: hoje,
              horas_por_dia: {},
            }),
            3, 300, `criarConcluir-${docId}`
          );
        }

        const marcadores = await retryWithBackoff(
          () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0 }),
          3, 300, `marcador-${docId}`
        );
        if (!marcadores || marcadores.length === 0) {
          await retryWithBackoff(
            () => Atividade.create({
              etapa: folha.etapa,
              disciplina: folha.disciplina,
              subdisciplina: folha.subdisciplina,
              atividade: `(Concluída na folha ${folha.source_documento_numero || docId}) ${String(folha.atividade || '')}`,
              empreendimento_id: empreendimentoId,
              id_atividade: atividadeId,
              documento_id: docId,
              tempo: 0,
            }),
            3, 300, `criarMarcador-${docId}`
          );
        }
      } catch {
        erros++;
      }
    }

    setFolhasSelecionadas(new Set());
    setIsConcluindoFolhas(false);
    if (erros > 0) alert(`${erros} folha(s) não puderam ser concluídas. Verifique o console.`);
    if (fetchData) fetchData();
  }, [folhasSelecionadas, atividadesAgrupadas, empreendimentoId, fetchData]);

  const handleReverterFolhasSelecionadas = useCallback(async () => {
    if (folhasSelecionadas.size === 0) return;
    setIsReverendoFolhas(true);

    const folhasParaReverter = [];
    for (const grupo of (atividadesAgrupadas || [])) {
      for (const folha of (grupo.folhas || [])) {
        if (folhasSelecionadas.has(folha.source_documento_id)) {
          folhasParaReverter.push(folha);
        }
      }
    }

    let erros = 0;
    for (const folha of folhasParaReverter) {
      try {
        const atividadeId = folha.base_atividade_id;
        const docId = folha.source_documento_id;

        const planos = await retryWithBackoff(
          () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, atividade_id: atividadeId, documento_id: docId }),
          3, 300, `planoReverter-${docId}-${atividadeId}`
        );
        for (const plano of planos) {
          await retryWithBackoff(
            () => PlanejamentoAtividade.delete(plano.id),
            3, 300, `deletePlanoReverter-${plano.id}`
          );
        }

        const marcadores = await retryWithBackoff(
          () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0 }),
          3, 300, `marcadoresReverter-${docId}`
        );
        for (const m of marcadores) {
          await retryWithBackoff(() => Atividade.delete(m.id), 3, 300, `deleteMarcadorReverter-${m.id}`);
        }
      } catch {
        erros++;
      }
    }

    setFolhasSelecionadas(new Set());
    setIsReverendoFolhas(false);
    if (erros > 0) alert(`${erros} folha(s) não puderam ser revertidas.`);
    if (fetchData) fetchData();
  }, [folhasSelecionadas, atividadesAgrupadas, empreendimentoId, fetchData]);

  const [isRevertendoAtividades, setIsRevertendoAtividades] = useState(false);

  const handleReverterAtividadesSelecionadas = useCallback(async () => {
    if (atividadesSelecionadasParaExcluir.size === 0) return;
    if (!confirm(`Deixar ${atividadesSelecionadasParaExcluir.size} atividade(s) disponível(is) novamente? Os planejamentos existentes serão removidos.`)) return;
    setIsRevertendoAtividades(true);
    let erros = 0;
    for (const atividadeId of Array.from(atividadesSelecionadasParaExcluir)) {
      try {
        const planos = await retryWithBackoff(
          () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, atividade_id: atividadeId }),
          3, 300, `reverterAtiv-${atividadeId}`
        );
        for (const plano of planos) {
          await retryWithBackoff(() => PlanejamentoAtividade.delete(plano.id), 3, 300, `deletePlanoAtiv-${plano.id}`);
        }
      } catch { erros++; }
    }
    setAtividadesSelecionadasParaExcluir(new Set());
    setIsRevertendoAtividades(false);
    if (erros > 0) alert(`${erros} atividade(s) não puderam ser revertidas.`);
    if (fetchData) fetchData();
  }, [atividadesSelecionadasParaExcluir, empreendimentoId, fetchData]);

  const handleConcluirAtividadesSelecionadas = useCallback(async () => {
    if (atividadesSelecionadasParaExcluir.size === 0) return;
    if (!confirm(`Concluir ${atividadesSelecionadasParaExcluir.size} atividade(s) selecionada(s) em todas as suas folhas?`)) return;
    setIsConcluindoAtividades(true);
    const hoje = format(new Date(), 'yyyy-MM-dd');
    let erros = 0;
    for (const atividadeId of Array.from(atividadesSelecionadasParaExcluir)) {
      try {
        const planos = await retryWithBackoff(
          () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, atividade_id: atividadeId }),
          3, 300, `concluirAtiv-${atividadeId}`
        );
        if (planos.length > 0) {
          // Atualizar planos existentes
          for (const plano of planos) {
            if (plano.status !== 'concluido') {
              await retryWithBackoff(() => PlanejamentoAtividade.update(plano.id, { status: 'concluido', termino_real: hoje }), 3, 300, `updatePlano-${plano.id}`);
            }
          }
        } else {
          // Sem planejamentos: criar um planejamento concluído para cada folha da atividade
          const grupo = (atividadesAgrupadas || []).find(g =>
            (g.baseAtividade.base_atividade_id || g.baseAtividade.id) === atividadeId
          );
          if (grupo) {
            const ativ = grupo.baseAtividade;
            if (grupo.folhas.length > 0) {
              // Criar para cada folha vinculada
              for (const folha of grupo.folhas) {
                await retryWithBackoff(() => PlanejamentoAtividade.create({
                  empreendimento_id: empreendimentoId,
                  atividade_id: atividadeId,
                  documento_id: folha.source_documento_id,
                  etapa: folha.etapa || ativ.etapa || '',
                  descritivo: ativ.atividade || '',
                  tempo_planejado: folha.tempo || ativ.tempo || 0,
                  status: 'concluido',
                  termino_real: hoje,
                  horas_por_dia: {},
                }), 3, 300, `criarConcluidoFolha-${folha.source_documento_id}-${atividadeId}`);
              }
            } else {
              // Atividade sem folhas (ex: Documentação): criar planejamento geral
              await retryWithBackoff(() => PlanejamentoAtividade.create({
                empreendimento_id: empreendimentoId,
                atividade_id: atividadeId,
                documento_id: null,
                etapa: ativ.etapa || '',
                descritivo: ativ.atividade || '',
                tempo_planejado: ativ.tempo || 0,
                status: 'concluido',
                termino_real: hoje,
                horas_por_dia: {},
              }), 3, 300, `criarConcluidoGeral-${atividadeId}`);
            }
          }
        }
      } catch { erros++; }
    }
    setAtividadesSelecionadasParaExcluir(new Set());
    setIsConcluindoAtividades(false);
    if (erros > 0) alert(`${erros} atividade(s) não puderam ser concluídas.`);
    if (fetchData) fetchData();
  }, [atividadesSelecionadasParaExcluir, atividadesAgrupadas, empreendimentoId, fetchData]);

  const handleExcluirFolhasSelecionadas = useCallback(async () => {
    if (folhasSelecionadas.size === 0) return;
    if (!confirm(`Excluir ${folhasSelecionadas.size} folha(s) selecionada(s) do empreendimento? Esta ação não pode ser desfeita.`)) return;
    setIsExcluindoFolhas(true);

    const folhasParaExcluir = [];
    for (const grupo of (atividadesAgrupadas || [])) {
      for (const folha of (grupo.folhas || [])) {
        if (folhasSelecionadas.has(folha.source_documento_id)) {
          folhasParaExcluir.push(folha);
        }
      }
    }

    let erros = 0;
    for (const folha of folhasParaExcluir) {
      try {
        const atividadeId = folha.base_atividade_id;
        const docId = folha.source_documento_id;

        const planos = await retryWithBackoff(
          () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId, atividade_id: atividadeId, documento_id: docId }),
          3, 300, `planoExcluir-${docId}-${atividadeId}`
        );
        for (const plano of planos) {
          await retryWithBackoff(() => PlanejamentoAtividade.delete(plano.id), 3, 300, `deletePlano-${plano.id}`);
        }

        const marcadores = await retryWithBackoff(
          () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: 0 }),
          3, 300, `marcadoresExcluir-${docId}`
        );
        for (const m of marcadores) {
          await retryWithBackoff(() => Atividade.delete(m.id), 3, 300, `deleteMarcadorExcluir-${m.id}`);
        }

        const existingExclusion = await retryWithBackoff(
          () => Atividade.filter({ empreendimento_id: empreendimentoId, id_atividade: atividadeId, documento_id: docId, tempo: -999 }),
          3, 300, `checkExclusaoFolha-${docId}`
        );
        if (!existingExclusion || existingExclusion.length === 0) {
          await retryWithBackoff(
            () => Atividade.create({
              empreendimento_id: empreendimentoId,
              id_atividade: atividadeId,
              documento_id: docId,
              etapa: folha.etapa,
              disciplina: folha.disciplina,
              subdisciplina: folha.subdisciplina,
              atividade: `(Excluída) ${String(folha.atividade || '')}`,
              tempo: -999,
            }),
            3, 300, `createExclusaoFolha-${docId}`
          );
        }
      } catch {
        erros++;
      }
    }

    setFolhasSelecionadas(new Set());
    setIsExcluindoFolhas(false);
    if (erros > 0) alert(`${erros} folha(s) não puderam ser excluídas.`);
    if (fetchData) fetchData();
  }, [folhasSelecionadas, atividadesAgrupadas, empreendimentoId, fetchData]);

  // Deduplicate users by email — the API can return the same user twice
  const usuariosSemDuplicatas = useMemo(() => {
    const seen = new Set();
    return (usuarios || []).filter(u => {
      if (!u.email || seen.has(u.email)) return false;
      seen.add(u.email);
      return true;
    });
  }, [usuarios]);

  const getExecutorDisciplina = useCallback((disciplina) => {
    const entry = (atividadesPorDisciplina || []).find(([d]) => d === disciplina);
    if (!entry) return null;
    const executores = new Set();
    Object.values(entry[1]).flat().forEach(grupo => {
      (grupo.folhas || []).forEach(folha => {
        if (folha.executor_principal) executores.add(folha.executor_principal);
      });
      if (!grupo.baseAtividade?.source_documento_id && grupo.baseAtividade?.executor_principal) {
        executores.add(grupo.baseAtividade.executor_principal);
      }
    });
    if (executores.size === 0) return null;
    if (executores.size === 1) return Array.from(executores)[0];
    return 'mixed';
  }, [atividadesPorDisciplina]);

  const getExecutorSubdisciplina = useCallback((disciplina, subdisciplina) => {
    const entry = (atividadesPorDisciplina || []).find(([d]) => d === disciplina);
    if (!entry) return null;
    const subGrupos = entry[1][subdisciplina] || [];
    const executores = new Set();
    subGrupos.forEach(grupo => {
      (grupo.folhas || []).forEach(folha => {
        if (folha.executor_principal) executores.add(folha.executor_principal);
      });
    });
    if (executores.size === 0) return null;
    if (executores.size === 1) return Array.from(executores)[0];
    return 'mixed';
  }, [atividadesPorDisciplina]);

  const preTempoByDocumentoId = useMemo(() => {
    const map = new Map();
    (itensPRE || []).forEach(pre => {
      const vinculados = pre.documentos_vinculados || [];
      const tempo = Number(pre.tempo_atendimento) || 0;
      if (tempo > 0 && vinculados.length > 0) {
        vinculados.forEach(docId => {
          const key = String(docId);
          map.set(key, (map.get(key) || 0) + tempo);
        });
      }
    });
    return map;
  }, [itensPRE]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <p className="ml-4 text-gray-600">Carregando catálogo de atividades...</p>
      </div>
    );
  }

  if ((atividadesAgrupadas || []).length === 0) {
    return (
      <div className="text-center py-16 px-6 bg-gray-50 rounded-lg">
        <PackageOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-800">Catálogo Vazio</h3>
        <p className="text-gray-500 mt-2 mb-6">Nenhuma atividade encontrada para este empreendimento.</p>
        <Button onClick={() => handleOpenModal()}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Criar Atividade de Projeto
        </Button>
      </div>
    );
  }

  const editableActivities = (atividadesAgrupadas || []).filter(grupo => grupo.baseAtividade.isEditable);
  const hasCheckboxColumn = editableActivities.length > 0;

  const folhaRowProps = {
    isConcluindo,
    planejamentos,
    preTempoByDocumentoId,
    handleToggleFolhaConcluida: handleToggleFolhaConcluida || (() => {}),
    atividadesSelecionadasParaExcluir,
    setAtividadesSelecionadasParaExcluir,
    hasCheckboxColumn,
    usuarios: usuariosSemDuplicatas,
    handleSaveFolhaExecutor: handleSaveFolhaExecutor || (() => {}),
    datasInicioFolha: datasInicioFolha || {},
    setDatasInicioFolha: setDatasInicioFolha || (() => {}),
    isSavingFolhaExecutor: isSavingFolhaExecutor || {},
    empreendimentoId,
    onConcluirFolha: handleConcluirFolha,
    folhasSelecionadas,
    setFolhasSelecionadas,
  };

  return (
    <div className="space-y-6">
      {editableActivities.length > 0 && (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
          <div className="flex items-center gap-3">
            <Checkbox
              id="selectAll"
              checked={selectedIds.size === editableActivities.length && editableActivities.length > 0}
              onCheckedChange={handleSelectAll}
              disabled={editableActivities.length === 0 || isDeletingMultiple}
            />
            <label htmlFor="selectAll" className="text-sm font-medium text-gray-700 cursor-pointer">
              Selecionar todas as {editableActivities.length} atividades de projeto
            </label>
          </div>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={isDeletingMultiple}>
              {isDeletingMultiple ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" />Excluir Selecionadas ({selectedIds.size})</>
              )}
            </Button>
          )}
        </div>
      )}

      {folhasSelecionadas.size > 0 && (
        <div className="flex items-center justify-between p-4 border-2 border-green-500 rounded-lg bg-green-50 shadow-sm flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-green-600 text-white">
              {folhasSelecionadas.size} folha{folhasSelecionadas.size > 1 ? 's' : ''} selecionada{folhasSelecionadas.size > 1 ? 's' : ''}
            </Badge>
            <span className="text-sm text-gray-700">Ações em lote para as folhas selecionadas</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleReverterFolhasSelecionadas}
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              disabled={isConcluindoFolhas || isReverendoFolhas || isExcluindoFolhas}
              size="sm"
            >
              {isReverendoFolhas
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Revertendo...</>
                : <><RotateCcw className="w-4 h-4 mr-2" />Disponível Novamente</>
              }
            </Button>
            <Button
              onClick={handleConcluirFolhasSelecionadas}
              className="bg-green-600 hover:bg-green-700"
              disabled={isConcluindoFolhas || isReverendoFolhas || isExcluindoFolhas}
              size="sm"
            >
              {isConcluindoFolhas
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Concluindo...</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Concluir Selecionadas</>
              }
            </Button>
            <Button
              onClick={handleExcluirFolhasSelecionadas}
              variant="destructive"
              disabled={isConcluindoFolhas || isReverendoFolhas || isExcluindoFolhas}
              size="sm"
            >
              {isExcluindoFolhas
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</>
                : <><Trash2 className="w-4 h-4 mr-2" />Excluir</>
              }
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFolhasSelecionadas(new Set())}
              disabled={isConcluindoFolhas || isReverendoFolhas || isExcluindoFolhas}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {atividadesSelecionadasParaPlanejar.size > 0 && (
        <div className="flex items-center justify-between p-4 border-2 border-blue-500 rounded-lg bg-blue-50 shadow-sm">
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-600 text-white">
              {atividadesSelecionadasParaPlanejar.size} atividade{atividadesSelecionadasParaPlanejar.size > 1 ? 's' : ''} selecionada{atividadesSelecionadasParaPlanejar.size > 1 ? 's' : ''}
            </Badge>
            <span className="text-sm text-gray-700">Selecione executor e data para planejar em lote</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAtividadesSelecionadasParaPlanejar(new Set())}>
            Cancelar
          </Button>
        </div>
      )}

      {atividadesSelecionadasParaExcluir.size > 0 && (
        <div className="flex items-center justify-between p-4 border-2 border-red-500 rounded-lg bg-red-50 shadow-sm">
          <div className="flex items-center gap-3">
            <Badge className="bg-red-600 text-white">
              {atividadesSelecionadasParaExcluir.size} atividade{atividadesSelecionadasParaExcluir.size > 1 ? 's' : ''} selecionada{atividadesSelecionadasParaExcluir.size > 1 ? 's' : ''}
            </Badge>
            <span className="text-sm text-gray-700">Excluir selecionadas</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleReverterAtividadesSelecionadas}
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              disabled={isExcluindoMultiplasFolhas || isConcluindoAtividades || isRevertendoAtividades}
              size="sm"
            >
              {isRevertendoAtividades
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Revertendo...</>
                : <><RotateCcw className="w-4 h-4 mr-2" />Disponível Novamente</>
              }
            </Button>
            <Button
              onClick={handleConcluirAtividadesSelecionadas}
              className="bg-green-600 hover:bg-green-700"
              disabled={isExcluindoMultiplasFolhas || isConcluindoAtividades || isRevertendoAtividades}
              size="sm"
            >
              {isConcluindoAtividades
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Concluindo...</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Concluir Selecionadas</>
              }
            </Button>
            <Button
              onClick={() => handleExcluirMultiplas()}
              className="bg-red-600 hover:bg-red-700"
              disabled={isExcluindoMultiplasFolhas || isConcluindoAtividades || isRevertendoAtividades}
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir do Empreendimento
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAtividadesSelecionadasParaExcluir(new Set())} disabled={isConcluindoAtividades || isRevertendoAtividades}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {(atividadesPorDisciplina || []).map(([disciplina, grupos]) => {
        const subdisciplinasMap = (() => {
          const map = {};
          const add = (g) => {
            if (!g) return;
            const sub = g?.baseAtividade?.subdisciplina || 'Sem Subdisciplina';
            if (!map[sub]) map[sub] = [];
            map[sub].push(g);
          };
          if (Array.isArray(grupos)) grupos.forEach(add);
          else if (grupos && typeof grupos === 'object') Object.values(grupos).forEach(arr => (Array.isArray(arr) ? arr : []).forEach(add));
          return map;
        })();
        const totalCount = Object.values(subdisciplinasMap).flat().length;

        return (
          <div key={disciplina} className="border rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b cursor-pointer hover:from-blue-100 hover:to-indigo-100" onClick={() => toggleDisciplina(disciplina)}>
              <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                {disciplinasRecolhidas.has(disciplina) ? <ChevronRight className="w-5 h-5 text-blue-600" /> : <ChevronDown className="w-5 h-5 text-blue-600" />}
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                {disciplina}
                <Badge variant="secondary" className="ml-2">
                  {totalCount} {totalCount === 1 ? 'atividade' : 'atividades'}
                </Badge>
              </h3>

            </div>
            <div className={`overflow-x-auto ${disciplinasRecolhidas.has(disciplina) ? 'hidden' : ''}`}>
              {subdisciplinasMap ? (
                <div className="space-y-4 p-4">
                  {Object.entries(subdisciplinasMap)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([subdisciplina, atividadesSubgrupo]) => {
                      const subKey = `${disciplina}::${subdisciplina}`;
                      const subRecolhida = subdisciplinasRecolhidas.has(subKey);
                      const todasFolhas = [];
                      atividadesSubgrupo.forEach(grupo => {
                        (grupo.folhas || []).forEach(folha => todasFolhas.push({ folha, grupo }));
                      });
                      return (
                      <div key={subdisciplina} className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b cursor-pointer hover:bg-gray-100 flex items-center" onClick={() => toggleSubdisciplina(subKey)}>
                          <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                            {subRecolhida ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {subdisciplina} ({todasFolhas.length} {todasFolhas.length === 1 ? 'folha' : 'folhas'})
                          </h4>
                          <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <Select
                              value={getExecutorSubdisciplina(disciplina, subdisciplina) === 'mixed' ? undefined : (getExecutorSubdisciplina(disciplina, subdisciplina) || '__none__')}
                              onValueChange={(value) => {
                                const email = value === '__none__' ? '' : value;
                                handleAtribuirExecutorSubdisciplina?.(disciplina, subdisciplina, email);
                              }}
                              disabled={isSavingExecutorDisciplina?.[`sub-${disciplina}-${subdisciplina}`]}
                            >
                              <SelectTrigger className="h-6 text-xs w-[200px]">
                                <Users2 className="w-3 h-3 mr-1" />
                                <SelectValue placeholder={getExecutorSubdisciplina(disciplina, subdisciplina) === 'mixed' ? 'Múltiplos' : 'Executor da subdisc.'} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-red-600">— Remover executor —</SelectItem>
                                {usuariosSemDuplicatas.filter(u => u.status === 'ativo').sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(u => (
                                  <SelectItem key={u.email} value={u.email}>{u.nome || u.email}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {isSavingExecutorDisciplina?.[`sub-${disciplina}-${subdisciplina}`] && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                          </div>
                        </div>
                        {!subRecolhida && (
                        <Table className="text-sm">
                          <TableHeader className="bg-white">
                            <TableRow>
                              {hasCheckboxColumn && <TableHead className="w-[50px]"></TableHead>}
                              <TableHead className="w-[50px]"></TableHead>
                              <TableHead>Folha</TableHead>
                              <TableHead className="w-[40px]"></TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Etapa</TableHead>
                              <TableHead>Usuário</TableHead>
                              <TableHead>Datas</TableHead>
                              <TableHead className="w-[70px]">Horas</TableHead>
                              <TableHead className="w-[70px]">Total</TableHead>
                              <TableHead className="text-center w-[120px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {todasFolhas.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={hasCheckboxColumn ? 11 : 10} className="text-center text-gray-400 py-4">Nenhuma folha vinculada</TableCell>
                              </TableRow>
                            ) : todasFolhas.flatMap(({ folha, grupo }) => {
                                const folhaKey = folha.uniqueId || `${folha.source_documento_id}-${folha.base_atividade_id}`;
                                const isFolhaExpanded = folhasExpandidas.has(folhaKey);
                                const atividadesDoDocumento = (atividadesAgrupadas || [])
                                  .flatMap(g => g.folhas || [])
                                  .filter(f => f.source_documento_id === folha.source_documento_id);
                                return [
                                  <AnaliticoFolhaRow
                                    key={`folha-${folhaKey}`}
                                    folha={folha}
                                    atividade={grupo.baseAtividade}
                                    hasCheckboxColumn={hasCheckboxColumn}
                                    isExpanded={isFolhaExpanded}
                                    onToggleExpand={() => toggleFolha(folhaKey)}
                                    {...folhaRowProps}
                                  />,
                                  ...(isFolhaExpanded ? [
                                    <TableRow key={`ativs-${folhaKey}`} className="bg-gray-50">
                                      <TableCell colSpan={hasCheckboxColumn ? 11 : 10} className="py-3">
                                        <div className="pl-8 space-y-2">
                                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Atividades do documento</div>
                                          {atividadesDoDocumento.length === 0 ? (
                                            <div className="text-sm text-gray-400">Nenhuma atividade vinculada</div>
                                          ) : (() => {
                                            const etapasMap = {};
                                            atividadesDoDocumento.forEach(a => {
                                              const etapa = a.etapa || 'Sem Etapa';
                                              if (!etapasMap[etapa]) etapasMap[etapa] = [];
                                              etapasMap[etapa].push(a);
                                            });
                                            return Object.entries(etapasMap).map(([etapa, atividadesEtapa]) => {
                                              const etapaKey = `${folhaKey}::${etapa}`;
                                              const etapaExpandida = etapasExpandidas.has(etapaKey);
                                              const totalHoras = atividadesEtapa.reduce((sum, a) => sum + (Number(a.tempo) || 0), 0);
                                              return (
                                                <div key={etapa} className="border rounded-md overflow-hidden">
                                                  <div className="bg-gray-100 px-3 py-1.5 cursor-pointer hover:bg-gray-200 flex items-center justify-between" onClick={() => toggleEtapa(etapaKey)}>
                                                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                                      {etapaExpandida ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                      {etapa}
                                                      <Badge variant="secondary" className="text-xs ml-1">{atividadesEtapa.length} {atividadesEtapa.length === 1 ? 'atividade' : 'atividades'}</Badge>
                                                    </span>
                                                    <span className="text-xs text-gray-500">{totalHoras.toFixed(1)}h</span>
                                                  </div>
                                                  {etapaExpandida && (
                                                    <div className="pl-4 py-1.5 space-y-1 bg-white border-t">
                                                      {atividadesEtapa.map((a, i) => {
                                                        const ativPlano = planejamentos?.find(p =>
                                                          p.documento_id === a.source_documento_id &&
                                                          p.atividade_id === a.base_atividade_id
                                                        );
                                                        const ativExecutor = ativPlano?.executor_principal || '';
                                                        const folhaExecutor = folha.executor_principal;
                                                        const isHerdado = !ativExecutor && folhaExecutor;
                                                        const saveKey = `ativ-${a.source_documento_id}-${a.base_atividade_id}`;
                                                        return (
                                                          <div key={i} className="flex items-center gap-3 text-sm py-0.5">
                                                            <span className="text-gray-400 w-5 text-right">{i + 1}.</span>
                                                            <span className="text-gray-700 flex-1 min-w-0 truncate">{String(a.atividade || '')}</span>
                                                            {a.subdisciplina && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{a.subdisciplina}</span>}
                                                            <span className="text-xs text-gray-500 flex-shrink-0">{a.tempo ? `${Number(a.tempo).toFixed(1)}h` : '-'}</span>
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                              <Select
                                                                value={ativExecutor || '__none__'}
                                                                onValueChange={(value) => {
                                                                  const email = value === '__none__' ? '' : value;
                                                                  handleSaveAtividadeExecutor?.(a, email);
                                                                }}
                                                                disabled={isSavingFolhaExecutor?.[saveKey]}
                                                              >
                                                                <SelectTrigger className="h-6 text-xs w-[160px]">
                                                                  <Users2 className="w-3 h-3 mr-1" />
                                                                  <SelectValue placeholder={isHerdado ? `Herdado: ${usuariosSemDuplicatas.find(u => u.email === folhaExecutor)?.nome || folhaExecutor}` : 'Sem executor'} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                  <SelectItem value="__none__" className="text-xs text-red-600">— Remover —</SelectItem>
                                                                  {usuariosSemDuplicatas.filter(u => u.status === 'ativo').sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(u => (
                                                                    <SelectItem key={u.email} value={u.email} className="text-xs">{u.nome || u.email}</SelectItem>
                                                                  ))}
                                                                </SelectContent>
                                                              </Select>
                                                              {isSavingFolhaExecutor?.[saveKey] && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            });
                                          })()}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ] : [])
                                ];
                              })}
                          </TableBody>
                        </Table>
                        )}
                      </div>
                      );
                    })}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  function renderStatusCell(grupo, ativ) {
    const genericId = ativ.base_atividade_id || ativ.id;
    const isConc = isConcluindo[genericId];

    if (grupo.folhas.length === 0) {
      if (ativ.source === 'Projeto') return <Badge>Projeto</Badge>;
      if (ativ.status === 'Concluída') {
        return (
          <button
            onClick={() => handleReverterAtividade(genericId)}
            disabled={isConc}
            title="Clique para reverter para Disponível"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isConc ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Concluída
          </button>
        );
      }
      if (ativ.status === 'Planejada') {
        return (
          <button
            onClick={() => handleConcluirEmTodasFolhas(ativ)}
            disabled={isConc}
            title="Clique para concluir"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isConc ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Planejada
          </button>
        );
      }
      return (
        <button
          onClick={() => handleConcluirEmTodasFolhas(ativ)}
          disabled={isConc}
          title="Clique para concluir"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-400 transition-colors cursor-pointer disabled:opacity-60"
        >
          {isConc ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Disponível
        </button>
      );
    }
    const todasConcluidas = grupo.folhas.length > 0 && grupo.folhas.every(f => f.status === 'Concluída');
    return (
      <div className="flex gap-1 flex-wrap">
        {grupo.folhas.some(f => f.status === 'Concluída') && (
          todasConcluidas ? (
            <button
              onClick={() => handleReverterAtividade(genericId)}
              title="Clique para reverter conclusão de todas as folhas"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />Concluída
            </button>
          ) : (
            <Badge className="bg-blue-600 text-white font-semibold shadow-md flex items-center gap-1 w-fit"><CheckCircle2 className="w-4 h-4" />Concluída</Badge>
          )
        )}
        {grupo.folhas.some(f => f.status === 'Planejada') && <Badge className="bg-green-600 text-white font-semibold shadow-md flex items-center gap-1 w-fit"><CheckCircle2 className="w-4 h-4" />Planejada</Badge>}
        {grupo.folhas.some(f => f.status === 'Disponível') && <Badge variant="outline" className="text-gray-600">Disponível</Badge>}
      </div>
    );
  }

  function renderExecutorCell(ativ, genericAtividadeIdToExclude) {
    const grupo = (atividadesAgrupadas || []).find(g => (g.baseAtividade.base_atividade_id || g.baseAtividade.id) === genericAtividadeIdToExclude);
    return (
      <div className="w-[210px]">
        {ativ.executor_principal ? (
          <div className="flex items-center justify-between p-1 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs font-medium text-green-800">
                {usuariosSemDuplicatas.find(u => u.email === ativ.executor_principal)?.nome || ativ.executor_principal}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSaveExecutor(ativ, "")}
              className="text-xs text-red-600 hover:text-red-700 h-6"
              disabled={isSavingExecutor[genericAtividadeIdToExclude]}
            >
              Remover
            </Button>
          </div>
        ) : (
          <div className="flex gap-1">
            <Checkbox
              checked={atividadesSelecionadasParaPlanejar.has(genericAtividadeIdToExclude)}
              onCheckedChange={(checked) => {
                setAtividadesSelecionadasParaPlanejar(prev => {
                  const newSet = new Set(prev);
                  if (checked) newSet.add(genericAtividadeIdToExclude);
                  else newSet.delete(genericAtividadeIdToExclude);
                  return newSet;
                });
              }}
              disabled={isSavingExecutor[genericAtividadeIdToExclude]}
            />
            <Select
              onValueChange={(value) => {
                if (atividadesSelecionadasParaPlanejar.size > 0 && atividadesSelecionadasParaPlanejar.has(genericAtividadeIdToExclude)) {
                  handlePlanejarMultiplas(value, datasInicio[genericAtividadeIdToExclude]);
                } else {
                  handleSaveExecutor(ativ, value, datasInicio[genericAtividadeIdToExclude]);
                }
              }}
              disabled={isSavingExecutor[genericAtividadeIdToExclude]}
            >
              <SelectTrigger className="w-full text-xs h-7 border-blue-500 text-blue-600 hover:bg-blue-50">
                <Users2 className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Selecionar Executor" />
              </SelectTrigger>
              <SelectContent>
                {usuariosSemDuplicatas
                  .filter(u => u.status === 'ativo')
                  .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                  .map(u => (
                    <SelectItem key={u.email} value={u.email} className="text-xs">
                      {u.nome || u.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-7 w-7 ${datasInicio[genericAtividadeIdToExclude] ? 'border-green-500 text-green-600' : ''}`}
                  disabled={isSavingExecutor[genericAtividadeIdToExclude]}
                >
                  <Calendar className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={datasInicio[genericAtividadeIdToExclude]}
                  onSelect={(date) => setDatasInicio(prev => ({ ...prev, [genericAtividadeIdToExclude]: date }))}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={ptBR}
                />
                {datasInicio[genericAtividadeIdToExclude] && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDatasInicio(prev => ({ ...prev, [genericAtividadeIdToExclude]: null }))}
                      className="w-full text-xs"
                    >
                      Limpar Data
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        )}
        {isSavingExecutor[genericAtividadeIdToExclude] && (
          <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Planejando...
          </div>
        )}
        {datasInicio[genericAtividadeIdToExclude] ? (
          <div className="flex items-center gap-1 text-blue-600 text-xs mt-1">
            <Calendar className="w-3 h-3" />
            <span>Início: {format(datasInicio[genericAtividadeIdToExclude], 'dd/MM/yyyy')}</span>
          </div>
        ) : grupo && grupo.folhas.some(f => f.status === 'Planejada') ? (
          (() => {
            const folhasPlanejadas = grupo.folhas.filter(f => f.status === 'Planejada');
            const planejamentosComDatas = folhasPlanejadas
              .map(f => planejamentos?.find(p => p.documento_id === f.source_documento_id && p.atividade_id === f.base_atividade_id))
              .filter(p => p?.inicio_planejado && p?.termino_planejado);
            if (planejamentosComDatas.length > 0) {
              const datas = planejamentosComDatas.map(p => ({ inicio: parseISO(p.inicio_planejado), termino: parseISO(p.termino_planejado) }));
              const dataInicio = datas.reduce((min, d) => d.inicio < min ? d.inicio : min, datas[0].inicio);
              const dataTermino = datas.reduce((max, d) => d.termino > max ? d.termino : max, datas[0].termino);
              return (<div className="flex items-center gap-1 text-gray-600 text-xs mt-1"><Calendar className="w-3 h-3" /><span>{format(dataInicio, 'dd/MM')} - {format(dataTermino, 'dd/MM')}</span></div>);
            }
            return null;
          })()
        ) : null}
      </div>
    );
  }

  function renderAcoesCell(ativ, genericAtividadeIdToExclude, isDeleting) {
    return (
      <div className="flex items-center gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" onClick={() => handleOpenEditarEtapaEmFolhasModal(ativ)} variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" title="Editar Etapa">
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button size="icon" onClick={() => handleConcluirEmTodasFolhas(ativ)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50" disabled={isConcluindo[genericAtividadeIdToExclude]} title="Concluir em Todas as Folhas">
          {isConcluindo[genericAtividadeIdToExclude] ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        </Button>
        <Button size="icon" onClick={() => handleOpenExcluirDeFolhasModal(ativ)} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50" disabled={isDeleting} title="Excluir de Folhas Específicas">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileX className="w-4 h-4" />}
        </Button>
        <Button size="icon" onClick={() => handleExcluirAtividade(ativ)} variant="outline" className="border-red-500 text-red-600 hover:bg-red-50 shadow-sm" disabled={isDeleting} title="Excluir de Todas as Folhas do Empreendimento">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>
    );
  }

  function renderDropdownCell(ativ, isDeleting) {
    return (
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isDeleting || isDeletingMultiple}>
              {isDeleting || isDeletingMultiple ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {ativ.isEditable ? (
              <>
                <DropdownMenuItem onClick={() => handleOpenModal(ativ)}>
                  <Edit className="w-4 h-4 mr-2" /> Editar Atividade
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(ativ.id)} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Atividade de Projeto
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => handleOpenEtapaModal(ativ)}>
                  <Layers className="w-4 h-4 mr-2 text-blue-600" /> Editar Etapa (Empreendimento)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleOpenEditarEtapaEmFolhasModal(ativ)} className="text-blue-600">
                  <Edit2 className="w-4 h-4 mr-2" /> Editar Etapa em Folhas Específicas
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
}