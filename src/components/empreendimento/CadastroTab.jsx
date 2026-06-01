import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Loader2, Upload, Download, Copy, ArrowDown, ArrowRight, Wand2, ChevronRight, ChevronLeft, GripHorizontal } from "lucide-react";
import { DataCadastro, Documento } from "@/entities/all";
import { retryWithBackoff } from "@/components/utils/apiUtils";
import { format } from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const DEFAULT_REVISOES = ["R00", "R01", "R02"];

// Chave especial usada para salvar metadados de estrutura (revisões/etapas)
// como um único registro no banco, evitando salvar em cada linha
const METADATA_DOC_ID = '__estrutura_cadastro__';

export default function CadastroTab({ empreendimento, readOnly = false }) {
  const ETAPAS = useMemo(() => {
    if (!empreendimento?.etapas || empreendimento.etapas.length === 0) {
      return [
        "ESTUDO PRELIMINAR",
        "ANTE-PROJETO",
        "PROJETO BÁSICO",
        "PROJETO EXECUTIVO",
        "LIBERADO PARA OBRA"
      ];
    }
    return empreendimento.etapas.map(e => e.toUpperCase());
  }, [empreendimento?.etapas]);

  const [revisoesPorEtapa, setRevisoesPorEtapa] = useState({});
  const [etapasExcluidas, setEtapasExcluidas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedEmpreendimentoId, setLoadedEmpreendimentoId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFolhas, setSelectedFolhas] = useState(new Set());
  const [showMassEditModal, setShowMassEditModal] = useState(false);
  const [massEditEtapa, setMassEditEtapa] = useState('');
  const [massEditRevisao, setMassEditRevisao] = useState('');
  const [massEditData, setMassEditData] = useState('');
  const [etapasMinimizadas, setEtapasMinimizadas] = useState({});
  const [linhasModificadas, setLinhasModificadas] = useState(new Set());
  const [etapasEfetivas, setEtapasEfetivas] = useState([]);
  const [editingRevisao, setEditingRevisao] = useState(null);
  const [editingRevisaoValue, setEditingRevisaoValue] = useState('');
  const [ordemEtapas, setOrdemEtapas] = useState([]);

  // ─── NOVO: rastreia se a estrutura (revisões/etapas) foi alterada ───
  // Quando true, o save vai persistir revisoesPorEtapa e etapasExcluidas
  // em um único registro dedicado, sem tocar nas linhas de dados.
  const [estruturaModificada, setEstruturaModificada] = useState(false);
  const [metadataRecordId, setMetadataRecordId] = useState(null); // id do registro de metadados no banco

  const folhasScrollRef = useRef(null);
  const dataScrollRef = useRef(null);

  useEffect(() => {
    if (!empreendimento?.id) return;
    setIsLoading(true);
    loadData();
  }, [empreendimento?.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [data, docs] = await Promise.all([
        retryWithBackoff(
          () => DataCadastro.filter({ empreendimento_id: empreendimento.id }, '-created_date', 10000),
          3, 2000, 'loadDataCadastro'
        ),
        retryWithBackoff(
          () => Documento.filter({ empreendimento_id: empreendimento.id }, '-created_date', 10000),
          3, 2000, 'loadDocumentos'
        )
      ]);

      const sortedDocs = (docs || []).sort((a, b) => {
        const discA = (a.disciplina || 'Sem Disciplina').toLowerCase();
        const discB = (b.disciplina || 'Sem Disciplina').toLowerCase();
        const discCompare = discA.localeCompare(discB, 'pt-BR', { sensitivity: 'base' });
        if (discCompare !== 0) return discCompare;
        const arquivoA = (a.arquivo || '').trim().toLowerCase();
        const arquivoB = (b.arquivo || '').trim().toLowerCase();
        return arquivoA.localeCompare(arquivoB, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
      setDocumentos(sortedDocs);

      // ─── Separar registro de metadados das linhas de dados ───
      // O registro de metadados é identificado pelo campo documento_id === METADATA_DOC_ID
      // (ou por ausência de documento_id válido com campo especial)
      const metadataRecord = (data || []).find(
        item => item.documento_id === METADATA_DOC_ID || item._is_metadata === true
      );
      const dataRecords = (data || []).filter(
        item => item.documento_id !== METADATA_DOC_ID && item._is_metadata !== true && item.documento_id
      );

      if (metadataRecord) {
        setMetadataRecordId(metadataRecord.id);
      }

      // ─── Carregar estrutura a partir do registro de metadados (se existir) ───
      let revisoesMap = {};
      let etapasExcluidasSet = new Set();

      // hasMetadata indica que o registro de metadados já existe e é a fonte da verdade.
      // Quando true, os campos legados (_excluida, _revisoes_existentes, etc.) das linhas
      // são completamente ignorados — evitando que uma restauração de etapa seja revertida
      // no próximo reload por causa de dados antigos ainda presentes nas linhas do banco.
      const hasMetadata = !!(metadataRecord?.estrutura);

      if (hasMetadata) {
        // ── Formato novo: estrutura salva no registro de metadados (fonte da verdade) ──
        const estrutura = metadataRecord.estrutura;
        if (estrutura.revisoesPorEtapa) {
          Object.entries(estrutura.revisoesPorEtapa).forEach(([etapa, revs]) => {
            revisoesMap[etapa] = new Set(Array.isArray(revs) ? revs : []);
          });
        }
        // etapasExcluidas vem EXCLUSIVAMENTE dos metadados — ignora _excluida nas linhas
        if (Array.isArray(estrutura.etapasExcluidas)) {
          estrutura.etapasExcluidas.forEach(e => etapasExcluidasSet.add(e));
        }
      } else {
        // ── Formato legado: extrair estrutura dos registros de linhas (compatibilidade) ──
        // Este branch só é usado enquanto o registro de metadados ainda não foi criado
        // (antes do primeiro save com a versão nova). Após o primeiro save, hasMetadata
        // será true e este branch nunca mais será executado.
        dataRecords.forEach(item => {
          if (!item.datas) return;
          Object.entries(item.datas).forEach(([etapa, etapaData]) => {
            if (!etapaData || typeof etapaData !== 'object') return;
            if (!revisoesMap[etapa]) revisoesMap[etapa] = new Set();

            const CHAVES_META = new Set(['_excluida', '_revisoes_excluidas', '_revisoes_existentes', 'meta']);
            const isRevValida = r => r && !CHAVES_META.has(r) && !r.startsWith('_');

            Object.keys(etapaData).forEach(rev => {
              if (isRevValida(rev)) revisoesMap[etapa].add(rev);
            });
            if (Array.isArray(etapaData._revisoes_existentes)) {
              etapaData._revisoes_existentes.forEach(rev => {
                if (isRevValida(rev)) revisoesMap[etapa].add(rev);
              });
            }
            if (etapaData._excluida) etapasExcluidasSet.add(etapa);
          });
        });
      }

      // ─── Normalizar etapas ───
      const canonicalMap = new Map();
      ETAPAS.forEach(e => canonicalMap.set(e.toLowerCase(), e));

      const etapasVistas = new Set();
      const etapasNormalizadas = [];

      Object.keys(revisoesMap).forEach(etapaBanco => {
        const key = etapaBanco.toLowerCase();
        const canonical = canonicalMap.get(key) || etapaBanco;
        if (!etapasVistas.has(key)) {
          etapasVistas.add(key);
          etapasNormalizadas.push(canonical);
          if (canonical !== etapaBanco && revisoesMap[etapaBanco]) {
            revisoesMap[canonical] = revisoesMap[canonical] || new Set();
            revisoesMap[etapaBanco].forEach(r => revisoesMap[canonical].add(r));
            delete revisoesMap[etapaBanco];
          }
        }
      });

      ETAPAS.forEach(etapaConfig => {
        const key = etapaConfig.toLowerCase();
        if (!etapasVistas.has(key)) {
          etapasVistas.add(key);
          etapasNormalizadas.push(etapaConfig);
        }
      });

      const etapasUnion = etapasNormalizadas.sort((a, b) => {
        const indexA = ETAPAS.findIndex(e => e.toLowerCase() === a.toLowerCase());
        const indexB = ETAPAS.findIndex(e => e.toLowerCase() === b.toLowerCase());
        return (indexA !== -1 ? indexA : 999) - (indexB !== -1 ? indexB : 999);
      });

      const CHAVES_META_GLOBAL = new Set(['_excluida', '_revisoes_excluidas', '_revisoes_existentes', 'revisoes_excluidas', 'revisoes_existentes', 'meta']);
      const isRevValida = r => r && !CHAVES_META_GLOBAL.has(r) && !r.startsWith('_') && !/^RNaN$/i.test(r);

      const revisoesCompletas = {};
      etapasUnion.forEach(etapa => {
        const revisoesEtapaSet = revisoesMap[etapa];
        let todasRevisoes = revisoesEtapaSet && revisoesEtapaSet.size > 0
          ? Array.from(revisoesEtapaSet).filter(isRevValida).sort((a, b) => {
              const numA = parseInt(a.substring(1));
              const numB = parseInt(b.substring(1));
              if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
              if (!isNaN(numA)) return -1;
              if (!isNaN(numB)) return 1;
              return a.localeCompare(b);
            })
          : [...DEFAULT_REVISOES];
        revisoesCompletas[etapa] = todasRevisoes;
      });

      // ─── Normalizar chaves de datas nos registros legados ───
      dataRecords.forEach(item => {
        if (!item.datas) return;
        const datasNormalizadas = {};
        Object.entries(item.datas).forEach(([etapa, etapaData]) => {
          const canonical = canonicalMap.get(etapa.toLowerCase()) || etapa;
          if (datasNormalizadas[canonical]) {
            datasNormalizadas[canonical] = { ...datasNormalizadas[canonical], ...etapaData };
          } else {
            datasNormalizadas[canonical] = etapaData;
          }
        });
        item.datas = datasNormalizadas;
      });

      // ─── Montar linhas ───
      const docIndexMap = new Map(sortedDocs.map((doc, idx) => [doc.id, idx]));

      // Chaves de metadados legados que nunca devem ir no payload de save
      const CHAVES_LEGADAS = new Set(['_excluida', '_revisoes_existentes', '_revisoes_excluidas', 'meta', 'revisoes_excluidas', 'revisoes_existentes']);

      const deduplicadoMap = new Map();
      dataRecords.filter(item => item.documento_id).forEach(item => {
        const existing = deduplicadoMap.get(item.documento_id);
        if (!existing || new Date(item.updated_date) > new Date(existing.updated_date)) {
          deduplicadoMap.set(item.documento_id, item);
        }
      });

      // Limpar metadados legados do state em memória.
      // Assim qualquer save futuro nessas linhas já envia payload limpo,
      // sem precisar forçar saves extras só para migrar o formato.
      const linhasComData = Array.from(deduplicadoMap.values()).map(item => {
        if (!item.datas) return item;
        const datasLimpas = {};
        Object.entries(item.datas).forEach(([etapa, etapaData]) => {
          if (!etapaData || typeof etapaData !== 'object') return;
          const datasFiltradas = {};
          Object.entries(etapaData).forEach(([chave, valor]) => {
            if (!CHAVES_LEGADAS.has(chave) && !chave.startsWith('_')) {
              datasFiltradas[chave] = valor;
            }
          });
          if (Object.keys(datasFiltradas).length > 0) {
            datasLimpas[etapa] = datasFiltradas;
          }
        });
        return { ...item, datas: datasLimpas };
      });
      const documento_idsComData = new Set(linhasComData.map(l => l.documento_id));

      const docsNovos = sortedDocs
        .filter(doc => !documento_idsComData.has(doc.id))
        .map((doc, idx) => ({
          id: `temp-${doc.id}`,
          empreendimento_id: empreendimento.id,
          documento_id: doc.id,
          ordem: linhasComData.length + idx,
          datas: {},
          isNew: true
        }));

      const todasAsLinhas = [...linhasComData, ...docsNovos];
      const novasLinhas = todasAsLinhas.sort((a, b) => {
        const indexA = docIndexMap.get(a.documento_id) ?? 999999;
        const indexB = docIndexMap.get(b.documento_id) ?? 999999;
        return indexA - indexB;
      });

      setEtapasEfetivas(etapasUnion);
      setRevisoesPorEtapa(revisoesCompletas);
      setEtapasExcluidas(Array.from(etapasExcluidasSet));
      setLinhas(novasLinhas);
      setLoadedEmpreendimentoId(empreendimento.id);
      setLinhasModificadas(new Set());
      setEstruturaModificada(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Helpers para marcar modificações ───
  // Marca apenas as linhas cujas datas foram alteradas (não todas)
  const marcarLinhasModificadas = (ids) => {
    setLinhasModificadas(prev => new Set([...prev, ...ids]));
  };

  // Marca que a estrutura (revisões/etapas) mudou — NÃO marca linhas
  const marcarEstruturaModificada = () => {
    setEstruturaModificada(true);
    setHasUnsavedChanges(true);
  };

  // ─── Handlers de Revisão (agora só marcam estrutura, não todas as linhas) ───

  const handleAddRevisao = (etapa) => {
    const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
    let novaRevisao;
    if (revisoesEtapa.length === 0) {
      novaRevisao = 'R00';
    } else {
      const ultimaRevisao = revisoesEtapa[revisoesEtapa.length - 1];
      const numero = parseInt(ultimaRevisao.substring(1)) + 1;
      novaRevisao = `R${String(numero).padStart(2, '0')}`;
    }

    setRevisoesPorEtapa(prev => ({
      ...prev,
      [etapa]: [...(prev[etapa] || []), novaRevisao]
    }));
    marcarEstruturaModificada();
  };

  const handleRenameRevisao = (etapa, oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingRevisao(null);
      return;
    }

    setRevisoesPorEtapa(prev => ({
      ...prev,
      [etapa]: prev[etapa].map(r => r === oldName ? trimmed : r)
    }));

    // Renomear chave nos dados de cada linha — marcar apenas linhas que tinham essa revisão
    const idsAfetados = [];
    setLinhas(prev => prev.map(linha => {
      const novasDatas = { ...linha.datas };
      if (novasDatas[etapa]) {
        const etapaData = { ...novasDatas[etapa] };
        if (etapaData[oldName] !== undefined) {
          etapaData[trimmed] = etapaData[oldName];
          delete etapaData[oldName];
          idsAfetados.push(linha.id);
        }
        if (Array.isArray(etapaData._revisoes_existentes)) {
          etapaData._revisoes_existentes = etapaData._revisoes_existentes.map(r => r === oldName ? trimmed : r);
        }
        novasDatas[etapa] = etapaData;
      }
      return { ...linha, datas: novasDatas };
    }));

    marcarEstruturaModificada();
    if (idsAfetados.length > 0) marcarLinhasModificadas(idsAfetados);
    setEditingRevisao(null);
  };

  const handleRemoveRevisao = (etapa, revisao) => {
    if (!confirm(`Deseja excluir a revisão ${revisao} da etapa ${etapa}? Os dados desta revisão serão perdidos.`)) return;

    setRevisoesPorEtapa(prev => ({
      ...prev,
      [etapa]: prev[etapa].filter(r => r !== revisao)
    }));

    // Remover dados da revisão apenas nas linhas que tinham dados
    const idsAfetados = [];
    setLinhas(prev => prev.map(linha => {
      const novasDatas = { ...linha.datas };
      if (novasDatas[etapa]?.[revisao] !== undefined) {
        novasDatas[etapa] = { ...novasDatas[etapa] };
        delete novasDatas[etapa][revisao];
        idsAfetados.push(linha.id);
      }
      return { ...linha, datas: novasDatas };
    }));

    marcarEstruturaModificada();
    if (idsAfetados.length > 0) marcarLinhasModificadas(idsAfetados);
  };

  const handleExcluirEtapa = (etapa) => {
    if (!confirm(`Deseja excluir a etapa ${etapa}? Você poderá restaurá-la depois se necessário.`)) return;

    setEtapasExcluidas(prev => [...prev, etapa]);
    marcarEstruturaModificada();
  };

  const handleRestaurarEtapa = (etapa) => {
    setEtapasExcluidas(prev => prev.filter(e => e !== etapa));
    marcarEstruturaModificada();
  };

  // ─── Handler de atualização de data (só marca a linha alterada) ───
  const handleUpdateData = (linhaId, etapa, revisao, valor) => {
    marcarLinhasModificadas([linhaId]);
    setLinhas(prev => prev.map(linha => {
      if (linha.id !== linhaId) return linha;
      const novasDatas = { ...linha.datas };
      if (!novasDatas[etapa]) novasDatas[etapa] = {};
      if (!valor || valor.trim() === '') {
        delete novasDatas[etapa][revisao];
      } else {
        novasDatas[etapa][revisao] = valor;
      }
      return { ...linha, datas: novasDatas };
    }));
    setTimeout(() => setHasUnsavedChanges(true), 0);
  };

  const copiarDataParaBaixo = (linhaId, etapa, revisao) => {
    const linhaIndex = linhas.findIndex(l => l.id === linhaId);
    if (linhaIndex === -1) return;
    const valorOriginal = getDataValue(linhas[linhaIndex], etapa, revisao);
    if (!valorOriginal) { alert('Selecione uma data primeiro'); return; }
    if (!confirm(`Copiar a data ${format(new Date(valorOriginal), 'dd/MM/yyyy')} para todas as células abaixo nesta coluna?`)) return;

    const idsAfetados = linhas.slice(linhaIndex + 1).map(l => l.id);
    marcarLinhasModificadas(idsAfetados);
    setHasUnsavedChanges(true);
    setLinhas(prev => prev.map((linha, idx) => {
      if (idx <= linhaIndex) return linha;
      const novasDatas = { ...linha.datas };
      if (!novasDatas[etapa]) novasDatas[etapa] = {};
      novasDatas[etapa][revisao] = valorOriginal;
      return { ...linha, datas: novasDatas };
    }));
  };

  const copiarLinhaParaProxima = (linhaId) => {
    const linhaIndex = linhas.findIndex(l => l.id === linhaId);
    if (linhaIndex === -1 || linhaIndex === linhas.length - 1) return;
    const linhaOriginal = linhas[linhaIndex];
    if (!linhaOriginal.datas || Object.keys(linhaOriginal.datas).length === 0) {
      alert('Esta linha não possui datas para copiar'); return;
    }
    if (!confirm('Copiar todas as datas desta linha para a próxima linha?')) return;

    const proxLinha = linhas[linhaIndex + 1];
    if (proxLinha) marcarLinhasModificadas([proxLinha.id]);
    setHasUnsavedChanges(true);
    setLinhas(prev => prev.map((linha, idx) => {
      if (idx !== linhaIndex + 1) return linha;
      return { ...linha, datas: JSON.parse(JSON.stringify(linhaOriginal.datas)) };
    }));
  };

  const copiarDataParaDireita = (linhaId, etapa, revisao) => {
    const linha = linhas.find(l => l.id === linhaId);
    if (!linha) return;
    const valorOriginal = getDataValue(linha, etapa, revisao);
    if (!valorOriginal) { alert('Selecione uma data primeiro'); return; }

    const etapasVisiveis = ETAPAS_VIEW.filter(e => !etapasExcluidas.includes(e));
    const etapaIndex = etapasVisiveis.indexOf(etapa);
    const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
    const revisaoIndex = revisoesEtapa.indexOf(revisao);

    if (!confirm(`Copiar a data ${format(new Date(valorOriginal), 'dd/MM/yyyy')} para todas as células à direita nesta linha?`)) return;

    marcarLinhasModificadas([linhaId]);
    setHasUnsavedChanges(true);
    setLinhas(prev => prev.map(l => {
      if (l.id !== linhaId) return l;
      const novasDatas = { ...l.datas };
      for (let i = revisaoIndex + 1; i < revisoesEtapa.length; i++) {
        if (!novasDatas[etapa]) novasDatas[etapa] = {};
        novasDatas[etapa][revisoesEtapa[i]] = valorOriginal;
      }
      for (let i = etapaIndex + 1; i < etapasVisiveis.length; i++) {
        const proxEtapa = etapasVisiveis[i];
        const proxRevisoes = revisoesPorEtapa[proxEtapa] || DEFAULT_REVISOES;
        if (!novasDatas[proxEtapa]) novasDatas[proxEtapa] = {};
        proxRevisoes.forEach(rev => { novasDatas[proxEtapa][rev] = valorOriginal; });
      }
      return { ...l, datas: novasDatas };
    }));
  };

  // ─── Seleção em massa ───
  const toggleSelectFolha = (linhaId) => {
    setSelectedFolhas(prev => {
      const newSet = new Set(prev);
      newSet.has(linhaId) ? newSet.delete(linhaId) : newSet.add(linhaId);
      return newSet;
    });
  };
  const selectAllFolhas = () => setSelectedFolhas(new Set(linhas.map(l => l.id)));
  const clearSelection = () => setSelectedFolhas(new Set());

  const handleMassEdit = () => {
    if (selectedFolhas.size === 0) { alert('Selecione ao menos uma folha'); return; }
    setShowMassEditModal(true);
  };

  const applyMassEdit = () => {
    if (!massEditEtapa || !massEditRevisao || !massEditData) {
      alert('Preencha etapa, revisão e data'); return;
    }
    marcarLinhasModificadas(Array.from(selectedFolhas));
    setHasUnsavedChanges(true);
    setLinhas(prev => prev.map(linha => {
      if (!selectedFolhas.has(linha.id)) return linha;
      const novasDatas = { ...linha.datas };
      if (!novasDatas[massEditEtapa]) novasDatas[massEditEtapa] = {};
      novasDatas[massEditEtapa][massEditRevisao] = massEditData;
      return { ...linha, datas: novasDatas };
    }));
    setShowMassEditModal(false);
    setMassEditEtapa(''); setMassEditRevisao(''); setMassEditData('');
    clearSelection();
  };

  const toggleMinimizarEtapa = (etapa) => {
    setEtapasMinimizadas(prev => ({ ...prev, [etapa]: !prev[etapa] }));
  };

  // ─── SAVE OTIMIZADO ───
  const handleSave = async (silent = false) => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      // ── PASSO 1: Salvar metadados de estrutura (1 único request) ──
      // Só executa se revisões ou etapas foram alteradas
      if (estruturaModificada) {
        const estruturaPayload = {
          empreendimento_id: empreendimento.id,
          documento_id: METADATA_DOC_ID,
          _is_metadata: true,
          ordem: -1,
          datas: {},
          estrutura: {
            revisoesPorEtapa: Object.fromEntries(
              Object.entries(revisoesPorEtapa).map(([etapa, revs]) => [etapa, Array.isArray(revs) ? revs : []])
            ),
            etapasExcluidas: etapasExcluidas
          }
        };

        try {
          if (metadataRecordId) {
            const updated = await retryWithBackoff(
              () => DataCadastro.update(metadataRecordId, estruturaPayload),
              3, 1000, 'saveMetadata'
            );
            successCount++;
          } else {
            const created = await retryWithBackoff(
              () => DataCadastro.create(estruturaPayload),
              3, 1000, 'createMetadata'
            );
            setMetadataRecordId(created.id);
            successCount++;
          }
          setEstruturaModificada(false);
        } catch (err) {
          console.error('Erro ao salvar metadados de estrutura:', err);
          errorCount++;
        }

        // Pequeno delay após salvar metadados
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // ── PASSO 2: Salvar apenas linhas com datas realmente modificadas ──
      // Metadados legados (_excluida, _revisoes_existentes, etc.) são removidos
      // diretamente no loadData ao montar o state, por isso não é necessário
      // forçar saves de limpeza aqui. Só salvar o que o usuário alterou de fato.
      const linhasParaSalvar = linhas.filter(linha => {
        if (!linha.documento_id) return false;
        return linhasModificadas.has(linha.id);
      });

      const updatedLinhas = new Map();

      const salvarLinha = async (linha, idx) => {
        // ── Payload limpo: sem metadados de estrutura embutidos ──
        // Remove _revisoes_existentes, _revisoes_excluidas, _excluida de cada etapa
        // pois agora esses dados ficam no registro de metadados separado
        const datasLimpas = {};
        if (linha.datas) {
          Object.entries(linha.datas).forEach(([etapa, etapaData]) => {
            if (!etapaData || typeof etapaData !== 'object') return;
            // Filtrar apenas chaves de revisões reais (datas de fato)
            const datasFiltradas = {};
            Object.entries(etapaData).forEach(([chave, valor]) => {
              // Ignorar chaves de metadados legados
              if (
                chave.startsWith('_') ||
                chave === 'meta' ||
                chave === 'revisoes_excluidas' ||
                chave === 'revisoes_existentes'
              ) return;
              datasFiltradas[chave] = valor;
            });
            // Só incluir a etapa se tiver ao menos uma data
            if (Object.keys(datasFiltradas).length > 0) {
              datasLimpas[etapa] = datasFiltradas;
            }
          });
        }

        const linhaDataFinal = {
          empreendimento_id: empreendimento.id,
          ordem: idx,
          documento_id: linha.documento_id,
          datas: datasLimpas
        };

        const isNew = linha.isNew || linha.id.toString().startsWith('temp-');
        let delay = 500;

        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const result = isNew
              ? await DataCadastro.create(linhaDataFinal)
              : await DataCadastro.update(linha.id, linhaDataFinal);
            return { linhaId: linha.id, result };
          } catch (err) {
            const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Rate limit');
            if (attempt < 5 && is429) {
              console.warn(`Rate limit na tentativa ${attempt}, aguardando ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            } else {
              throw err;
            }
          }
        }
      };

      // Processar sequencialmente com delay adequado
      for (let i = 0; i < linhasParaSalvar.length; i++) {
        try {
          const res = await salvarLinha(linhasParaSalvar[i], i);
          if (res) {
            successCount++;
            updatedLinhas.set(res.linhaId, res.result);
          }
        } catch (err) {
          errorCount++;
          console.error(`Erro na linha ${linhasParaSalvar[i].id}:`, err);
        }
        // Delay entre requests — 400ms garante ~2.5 req/s, bem abaixo do rate limit
        if (i < linhasParaSalvar.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      }

      // Atualizar IDs das linhas recém-criadas
      setLinhas(prev => prev.map(linha => {
        const savedData = updatedLinhas.get(linha.id);
        if (savedData) return { ...linha, id: savedData.id, isNew: false };
        return linha;
      }));

      setHasUnsavedChanges(false);
      setLinhasModificadas(new Set());

      if (!silent) {
        const totalSalvo = successCount;
        const totalTentado = linhasParaSalvar.length + (estruturaModificada ? 1 : 0);
        if (errorCount > 0) {
          alert(`Salvamento parcial: ${successCount} sucesso(s), ${errorCount} erro(s).`);
        } else if (totalSalvo === 0) {
          alert('Nenhuma alteração pendente para salvar.');
        } else {
          alert(`Dados salvos com sucesso! ${successCount} registro(s) atualizado(s).`);
        }
      }
    } catch (error) {
      console.error('Erro crítico ao salvar:', error);
      if (!silent) alert(`Erro ao salvar dados: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getDataValue = (linha, etapa, revisao) => {
    const data = linha.datas?.[etapa]?.[revisao] || '';
    if (!data || data === '0001-01-01' || (typeof data === 'string' && data.includes('dd/mm/aaaa'))) return '';
    return typeof data === 'string' ? data : '';
  };

  const linhasPorDisciplina = useMemo(() => {
    const grupos = {};
    linhas.forEach(linha => {
      const doc = documentos.find(d => d.id === linha.documento_id);
      if (!doc) return;
      const disciplina = doc.disciplina || 'Sem Disciplina';
      if (!grupos[disciplina]) grupos[disciplina] = [];
      grupos[disciplina].push(linha);
    });
    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhas, documentos]);

  const ETAPAS_VIEW_BASE = etapasEfetivas.length > 0 ? etapasEfetivas : ETAPAS;
  const ETAPAS_VIEW = useMemo(() => {
    if (ordemEtapas.length === 0) return ETAPAS_VIEW_BASE;
    return [...ETAPAS_VIEW_BASE].sort((a, b) => {
      const ia = ordemEtapas.indexOf(a);
      const ib = ordemEtapas.indexOf(b);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [ETAPAS_VIEW_BASE, ordemEtapas]);

  const handleDragEndEtapas = (result) => {
    if (!result.destination) return;
    const etapasVisiveis = ETAPAS_VIEW.filter(e => !etapasExcluidas.includes(e));
    const novaOrdem = Array.from(etapasVisiveis);
    const [moved] = novaOrdem.splice(result.source.index, 1);
    novaOrdem.splice(result.destination.index, 0, moved);
    const excluidas = ETAPAS_VIEW.filter(e => etapasExcluidas.includes(e));
    setOrdemEtapas([...novaOrdem, ...excluidas]);
  };

  const larguraTotalEtapas = useMemo(() => {
    const etapasVisiveis = ETAPAS_VIEW_BASE.filter(e => !etapasExcluidas.includes(e));
    return etapasVisiveis.reduce((total, etapa) => {
      if (etapasMinimizadas[etapa]) return total + 40;
      const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
      return total + ((revisoesEtapa.length * 110) + 40);
    }, 0);
  }, [ETAPAS_VIEW, etapasExcluidas, etapasMinimizadas, revisoesPorEtapa]);

  const handleExportData = () => {
    const etapasVisiveis = ETAPAS_VIEW.filter(e => !etapasExcluidas.includes(e));
    let headers = ['folha', 'descritivo', 'disciplina'];
    etapasVisiveis.forEach(etapa => {
      const revisoes = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
      revisoes.forEach(rev => headers.push(`${etapa}_${rev}`));
    });
    const rows = linhas.map(linha => {
      const doc = documentos.find(d => d.id === linha.documento_id);
      const row = [doc?.arquivo || doc?.numero || '', doc?.descritivo || '', doc?.disciplina || ''];
      etapasVisiveis.forEach(etapa => {
        const revisoes = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
        revisoes.forEach(rev => {
          const val = getDataValue(linha, etapa, rev);
          if (val) {
            const [ano, mes, dia] = val.split('-');
            row.push(`${dia}/${mes}/${ano}`);
          } else {
            row.push('');
          }
        });
      });
      return row;
    });
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cadastro_${empreendimento.nome.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  const handleExportTemplate = () => {
    const etapasVisiveis = ETAPAS_VIEW.filter(e => !etapasExcluidas.includes(e));
    let headers = ['folha'];
    etapasVisiveis.forEach(etapa => {
      const revisoes = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
      revisoes.forEach(rev => headers.push(`${etapa}_${rev}`));
    });
    const csvContent = [
      headers.join(';'),
      ['ARQ-01', ...etapasVisiveis.flatMap(etapa =>
        (revisoesPorEtapa[etapa] || DEFAULT_REVISOES).map(() => '15/01/2025')
      )].join(';')
    ].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_cadastro_${empreendimento.nome.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  const handleImport = async () => {
    if (!importFile) { alert('Selecione um arquivo para importar'); return; }
    setIsImporting(true);
    try {
      const fileContent = await importFile.text();
      const lines = fileContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) { alert('Arquivo vazio ou inválido'); return; }

      const separator = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(separator).map(h => h.trim());
      if (!headers.includes('folha')) { alert('Cabeçalho "folha" obrigatório não encontrado'); return; }

      const dadosParaImportar = [];
      const erros = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => { row[header] = values[idx] || ''; });

        const folhaNome = row.folha;
        if (!folhaNome) { erros.push(`Linha ${i + 1}: Nome da folha é obrigatório`); continue; }

        const documento = documentos.find(d => d.numero === folhaNome || d.arquivo === folhaNome);
        if (!documento) { erros.push(`Linha ${i + 1}: Folha "${folhaNome}" não encontrada`); continue; }

        const datas = {};
        headers.forEach(header => {
          if (header === 'folha') return;
          const data = row[header];
          if (!data) return;
          const parts = header.split('_');
          if (parts.length < 2) return;
          const revisao = parts.pop();
          const etapa = parts.join('_');
          let dataFormatada = data;
          if (data.includes('/')) {
            const [dia, mes, ano] = data.split('/');
            if (dia && mes && ano) dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
          }
          if (!datas[etapa]) datas[etapa] = {};
          datas[etapa][revisao] = dataFormatada;
        });

        dadosParaImportar.push({ documento_id: documento.id, datas });
      }

      if (erros.length > 0) alert(`Erros encontrados:\n${erros.join('\n')}\n\nContinuando com registros válidos...`);
      if (dadosParaImportar.length === 0) { alert('Nenhum registro válido encontrado'); return; }

      let sucessos = 0, falhas = 0;
      for (const dado of dadosParaImportar) {
        try {
          const linhaExistente = linhas.find(l => l.documento_id === dado.documento_id);
          if (linhaExistente && !linhaExistente.isNew && !linhaExistente.id.toString().startsWith('temp-')) {
            await retryWithBackoff(
              () => DataCadastro.update(linhaExistente.id, { datas: { ...linhaExistente.datas, ...dado.datas } }),
              3, 1000, `importUpdate-${linhaExistente.id}`
            );
          } else {
            await retryWithBackoff(
              () => DataCadastro.create({ empreendimento_id: empreendimento.id, ordem: linhas.length, documento_id: dado.documento_id, datas: dado.datas }),
              3, 1000, `importCreate-${dado.documento_id}`
            );
          }
          sucessos++;
        } catch (error) {
          console.error(`Erro ao importar ${dado.documento_id}:`, error);
          falhas++;
        }
      }

      alert(`Importação concluída!\n\nSucessos: ${sucessos}\nFalhas: ${falhas}`);
      if (sucessos > 0) { await loadData(); setShowImportModal(false); setImportFile(null); }
    } catch (error) {
      console.error('Erro na importação:', error);
      alert(`Erro ao processar arquivo: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">Datas de Cadastro</h2>
          {readOnly && <Badge variant="outline" className="text-xs">Somente Visualização</Badge>}
          {!readOnly && hasUnsavedChanges && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              Alterações não salvas
            </Badge>
          )}
          {/* Indicador visual do que será salvo */}
          {!readOnly && hasUnsavedChanges && (
            <span className="text-xs text-gray-500">
              {linhasModificadas.size > 0 && `${linhasModificadas.size} linha(s)`}
              {linhasModificadas.size > 0 && estruturaModificada && ' + '}
              {estruturaModificada && 'estrutura'}
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            {selectedFolhas.size > 0 && (
              <>
                <Badge variant="outline" className="px-3 py-1">
                  {selectedFolhas.size} folha{selectedFolhas.size > 1 ? 's' : ''} selecionada{selectedFolhas.size > 1 ? 's' : ''}
                </Badge>
                <Button variant="outline" onClick={handleMassEdit} className="border-purple-500 text-purple-600 hover:bg-purple-50">
                  <Wand2 className="w-4 h-4 mr-2" />
                  Preencher em Massa
                </Button>
                <Button variant="outline" onClick={clearSelection} className="border-gray-400 text-gray-600 hover:bg-gray-50">
                  Limpar Seleção
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleExportData} className="border-blue-500 text-blue-600 hover:bg-blue-50">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" onClick={() => setShowImportModal(true)} className="border-green-500 text-green-600 hover:bg-green-50">
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
        )}
      </div>

      {/* Botão flutuante de salvar */}
      {!readOnly && (
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          size="icon"
        >
          {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
        </Button>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="flex h-[calc(100vh-300px)] overflow-hidden max-w-full">
          {/* Container de Folhas Fixo - 20% */}
          <div className="w-[20%] border-r-2 border-gray-300 flex flex-col bg-gray-50">
            <div className="bg-blue-100 border-b-2 border-gray-300 px-2 sticky top-0 z-30 flex items-center" style={{ height: '72px' }}>
              <div className="flex items-center gap-2">
                {!readOnly && (
                  <input
                    type="checkbox"
                    checked={linhas.length > 0 && selectedFolhas.size === linhas.length}
                    onChange={(e) => e.target.checked ? selectAllFolhas() : clearSelection()}
                    className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Selecionar todas"
                  />
                )}
                <span className="font-semibold text-sm">Folha</span>
              </div>
            </div>
            <div
              ref={folhasScrollRef}
              className="flex-1 overflow-y-auto"
              onScroll={(e) => {
                if (dataScrollRef.current) dataScrollRef.current.scrollTop = e.target.scrollTop;
              }}
            >
              {linhas.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Nenhum documento cadastrado neste empreendimento. Cadastre documentos na aba "Documentos" primeiro.
                </div>
              ) : (
                linhasPorDisciplina.map(([disciplina, linhasDaDisciplina]) => (
                  <div key={disciplina}>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-300 px-2 flex items-center" style={{ height: '44px' }}>
                      <div className="flex items-center gap-1.5 w-full">
                        <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                        <h3 className="font-semibold text-sm text-gray-800">{disciplina}</h3>
                        <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{linhasDaDisciplina.length}</Badge>
                      </div>
                    </div>
                    {linhasDaDisciplina.map((linha) => {
                      const doc = documentos.find(d => d.id === linha.documento_id);
                      return (
                        <div
                          key={linha.id}
                          className="border-b border-gray-200 px-2 hover:bg-gray-100 transition-colors flex items-center"
                          style={{ height: '48px' }}
                        >
                          <div className="flex items-center gap-1.5 w-full">
                            {!readOnly && (
                              <input
                                type="checkbox"
                                checked={selectedFolhas.has(linha.id)}
                                onChange={() => toggleSelectFolha(linha.id)}
                                className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs text-gray-900 truncate" title={doc?.arquivo || doc?.numero || 'Sem folha'}>
                                {doc?.arquivo || doc?.numero || 'Sem folha'}
                              </div>
                              {doc?.descritivo && (
                                <div className="text-xs text-gray-500 mt-0.5 line-clamp-1" title={doc.descritivo}>
                                  {doc.descritivo}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Container de Etapas com Scroll Horizontal - 80% */}
          <div className="w-[80%] flex flex-col overflow-hidden">
            <div
              ref={dataScrollRef}
              className="flex-1 overflow-x-auto overflow-y-auto"
              onScroll={(e) => {
                if (folhasScrollRef.current && e.target.scrollTop !== folhasScrollRef.current.scrollTop) {
                  folhasScrollRef.current.scrollTop = e.target.scrollTop;
                }
              }}
            >
              <div style={{ width: `${larguraTotalEtapas}px` }}>
                {/* Cabeçalho Fixo das Etapas */}
                <div className="bg-blue-100 border-b-2 border-gray-300 sticky top-0 z-20" style={{ minWidth: `${larguraTotalEtapas}px`, height: '72px' }}>
                  <DragDropContext onDragEnd={handleDragEndEtapas}>
                    <Droppable droppableId="etapas-header" direction="horizontal">
                      {(provided) => (
                        <div className="flex h-full" ref={provided.innerRef} {...provided.droppableProps}>
                          {ETAPAS_VIEW.filter(etapa => !etapasExcluidas.includes(etapa)).map((etapa, idx) => {
                            const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                            const isMinimizada = etapasMinimizadas[etapa];
                            const colWidth = isMinimizada ? 40 : (revisoesEtapa.length * 110) + 40;
                            return (
                              <Draggable key={etapa} draggableId={etapa} index={idx}>
                                {(prov, snapshot) => (
                                  <div
                                    ref={prov.innerRef}
                                    {...prov.draggableProps}
                                    className={`border-r border-gray-300 last:border-r-0 relative group flex-shrink-0 flex flex-col ${snapshot.isDragging ? 'opacity-80 shadow-lg z-50' : ''}`}
                                    style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, ...prov.draggableProps.style }}
                                  >
                                    <div className="p-1.5 text-center font-semibold flex-1 flex items-center justify-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <span {...prov.dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600" title="Arrastar para reordenar">
                                          <GripHorizontal className="w-3 h-3" />
                                        </span>
                                        <button onClick={() => toggleMinimizarEtapa(etapa)} className="text-gray-600 hover:text-gray-900 p-0.5" title={isMinimizada ? "Expandir" : "Minimizar"}>
                                          {isMinimizada ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                                        </button>
                                        <span className={`${isMinimizada ? 'writing-mode-vertical-rl transform rotate-180 text-xs' : 'text-xs'}`}>
                                          {isMinimizada ? etapa.substring(0, 3).toUpperCase() : etapa}
                                        </span>
                                        {!readOnly && !isMinimizada && (
                                          <button
                                            onClick={() => handleExcluirEtapa(etapa)}
                                            className="absolute top-0.5 right-0.5 text-red-500 hover:text-red-700 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded"
                                            title="Excluir etapa"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {!isMinimizada && (
                                      <div className="flex border-t border-gray-300 bg-blue-50">
                                        {revisoesEtapa.map((revisao) => (
                                          <div
                                            key={`${etapa}-${revisao}`}
                                            className="border-r border-gray-200 p-1 text-center font-medium text-xs"
                                            style={{ width: '110px', minWidth: '110px' }}
                                          >
                                            <div className="flex items-center justify-center gap-0.5">
                                              {!readOnly && editingRevisao?.etapa === etapa && editingRevisao?.revisao === revisao ? (
                                                <input
                                                  autoFocus
                                                  value={editingRevisaoValue}
                                                  onChange={(e) => setEditingRevisaoValue(e.target.value)}
                                                  onBlur={() => handleRenameRevisao(etapa, revisao, editingRevisaoValue)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRenameRevisao(etapa, revisao, editingRevisaoValue);
                                                    if (e.key === 'Escape') setEditingRevisao(null);
                                                  }}
                                                  className="w-16 px-1 py-0 text-xs border border-blue-500 rounded text-center"
                                                />
                                              ) : (
                                                <span
                                                  className={!readOnly ? 'cursor-pointer hover:text-blue-600' : ''}
                                                  title={!readOnly ? 'Clique duplo para renomear' : ''}
                                                  onDoubleClick={() => {
                                                    if (readOnly) return;
                                                    setEditingRevisao({ etapa, revisao });
                                                    setEditingRevisaoValue(revisao);
                                                  }}
                                                >{revisao}</span>
                                              )}
                                              {!readOnly && !(editingRevisao?.etapa === etapa && editingRevisao?.revisao === revisao) && (
                                                <button onClick={() => handleRemoveRevisao(etapa, revisao)} className="text-red-500 hover:text-red-700 p-0.5" title={`Excluir revisão ${revisao}`}>
                                                  <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                        <div className="bg-green-50 p-0.5 text-center" style={{ width: '40px', minWidth: '40px' }}>
                                          {!readOnly && (
                                            <button onClick={() => handleAddRevisao(etapa)} className="text-green-600 hover:text-green-800 p-0.5" title="Adicionar revisão">
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>

                {/* Área de Dados */}
                <div style={{ minWidth: `${larguraTotalEtapas}px` }}>
                  {linhas.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Nenhum documento cadastrado</div>
                  ) : (
                    linhasPorDisciplina.map(([disciplina, linhasDaDisciplina]) => (
                      <div key={disciplina}>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-300 flex" style={{ minWidth: `${larguraTotalEtapas}px`, height: '44px' }}>
                          {ETAPAS_VIEW.filter(e => !etapasExcluidas.includes(e)).map((etapa) => {
                            const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                            const isMinimizada = etapasMinimizadas[etapa];
                            return (
                              <div
                                key={`${disciplina}-${etapa}`}
                                className="border-r border-gray-200 flex-shrink-0"
                                style={{
                                  width: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px`,
                                  minWidth: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px`
                                }}
                              ></div>
                            );
                          })}
                        </div>
                        {linhasDaDisciplina.map((linha) => {
                          const etapasVisiveis = ETAPAS_VIEW.filter(e => !etapasExcluidas.includes(e));
                          return (
                            <div key={linha.id} className="flex border-b border-gray-200 hover:bg-gray-50" style={{ minWidth: `${larguraTotalEtapas}px`, height: '48px' }}>
                              {etapasVisiveis.map((etapa) => {
                                const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                                const isMinimizada = etapasMinimizadas[etapa];
                                return (
                                  <div
                                    key={`${linha.id}-${etapa}`}
                                    className="border-r border-gray-200 last:border-r-0 flex-shrink-0"
                                    style={{ width: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px`, minWidth: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px` }}
                                  >
                                    {isMinimizada ? (
                                      <div className="h-full flex items-center justify-center p-0.5 bg-gray-50"></div>
                                    ) : (
                                      <div className="flex">
                                        {revisoesEtapa.map((revisao) => (
                                          <div
                                            key={`${linha.id}-${etapa}-${revisao}`}
                                            className="border-r border-gray-100 p-0.5 flex-shrink-0 flex items-center relative group"
                                            style={{ width: '110px', minWidth: '110px' }}
                                          >
                                            <input
                                              type="date"
                                              value={getDataValue(linha, etapa, revisao)}
                                              onChange={(e) => handleUpdateData(linha.id, etapa, revisao, e.target.value)}
                                              className="h-8 text-xs w-full px-1 border border-gray-300 rounded cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                                              style={{ color: getDataValue(linha, etapa, revisao) ? 'black' : 'transparent' }}
                                              disabled={readOnly}
                                            />
                                            {!readOnly && getDataValue(linha, etapa, revisao) && (
                                              <button
                                                onClick={() => copiarDataParaBaixo(linha.id, etapa, revisao)}
                                                className="text-purple-600 hover:text-purple-800 p-0.5 absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Preencher todas abaixo"
                                              >
                                                <Wand2 className="w-2.5 h-2.5" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        <div className="p-0.5 flex-shrink-0" style={{ width: '40px', minWidth: '40px' }}></div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {etapasExcluidas.length > 0 && (
        <div className="mt-4 bg-gray-50 border border-gray-300 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Etapas Excluídas</h3>
          <div className="flex flex-wrap gap-2">
            {etapasExcluidas.map(etapa => (
              <Button key={etapa} variant="outline" size="sm" onClick={() => handleRestaurarEtapa(etapa)} className="text-xs">
                {etapa} - Clique para restaurar
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Importação */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Datas de Cadastro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">📋 Instruções</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Envie um arquivo CSV com as datas de cadastro</li>
                <li>• Coluna obrigatória: <code className="bg-white px-1 rounded">folha</code></li>
                <li>• Colunas de datas: <code className="bg-white px-1 rounded">ETAPA_REVISAO</code> (ex: ESTUDO PRELIMINAR_R00)</li>
                <li>• Formato de data: <code className="bg-white px-1 rounded">DD/MM/AAAA</code></li>
              </ul>
            </div>
            <Button variant="outline" onClick={handleExportTemplate} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Baixar Template CSV
            </Button>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full" />
              {importFile && <p className="text-sm text-green-600 mt-2">✓ Arquivo selecionado: {importFile.name}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowImportModal(false); setImportFile(null); }} disabled={isImporting}>Cancelar</Button>
              <Button onClick={handleImport} disabled={!importFile || isImporting} className="bg-green-600 hover:bg-green-700">
                {isImporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : <><Upload className="w-4 h-4 mr-2" />Importar</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Preenchimento em Massa */}
      <Dialog open={showMassEditModal} onOpenChange={setShowMassEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preencher Data em Massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Preencher data para <strong>{selectedFolhas.size}</strong> folha{selectedFolhas.size > 1 ? 's' : ''} selecionada{selectedFolhas.size > 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Etapa</label>
              <select value={massEditEtapa} onChange={(e) => setMassEditEtapa(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm">
                <option value="">Selecione a etapa</option>
                {ETAPAS_VIEW.filter(e => !etapasExcluidas.includes(e)).map(etapa => (
                  <option key={etapa} value={etapa}>{etapa}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Revisão</label>
              <select value={massEditRevisao} onChange={(e) => setMassEditRevisao(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" disabled={!massEditEtapa}>
                <option value="">Selecione a revisão</option>
                {massEditEtapa && (revisoesPorEtapa[massEditEtapa] || DEFAULT_REVISOES).map(rev => (
                  <option key={rev} value={rev}>{rev}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Data</label>
              <Input type="date" value={massEditData} onChange={(e) => setMassEditData(e.target.value)} className="w-full" />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowMassEditModal(false); setMassEditEtapa(''); setMassEditRevisao(''); setMassEditData(''); }}>
                Cancelar
              </Button>
              <Button onClick={applyMassEdit} className="bg-purple-600 hover:bg-purple-700">
                <Wand2 className="w-4 h-4 mr-2" />
                Aplicar a {selectedFolhas.size} Folha{selectedFolhas.size > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
