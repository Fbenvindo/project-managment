// ...existing code...
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Loader2, Upload, Download, Wand2, ChevronRight, ChevronLeft } from "lucide-react";
import { DataCadastro, Documento } from "@/entities/all";
import { retryWithBackoff } from "@/components/utils/apiUtils";
import { format } from "date-fns";

const DEFAULT_REVISOES = ["R00", "R01", "R02"];

// helper: normalize etapa key
const normalizeKey = (s) => (s || '').toString().trim().toUpperCase();

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
    return empreendimento.etapas.map(e => normalizeKey(e));
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

  const folhasScrollRef = useRef(null);
  const dataScrollRef = useRef(null);

  useEffect(() => {
    if (!empreendimento?.id) return;
    if (empreendimento.id !== loadedEmpreendimentoId) {
      setLoadedEmpreendimentoId(empreendimento.id);
      setIsLoading(true);
      loadData();
    }
  }, [empreendimento?.id]);

  // mapa rápido de documentos por id para evitar muitos .find
  const documentoById = useMemo(() => {
    const m = new Map();
    (documentos || []).forEach(d => m.set(d.id, d));
    return m;
  }, [documentos]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [data, docs] = await Promise.all([
        retryWithBackoff(() => DataCadastro.filter({ empreendimento_id: empreendimento.id }), 3, 2000, 'loadDataCadastro'),
        retryWithBackoff(() => Documento.filter({ empreendimento_id: empreendimento.id }), 3, 2000, 'loadDocumentos')
      ]);

      const sortedDocs = (docs || []).sort((a, b) => {
        const discA = (a.disciplina || 'Sem Disciplina').toLowerCase();
        const discB = (b.disciplina || 'Sem Disciplina').toLowerCase();
        const discCompare = discA.localeCompare(discB, 'pt-BR', { sensitivity: 'base' });
        if (discCompare !== 0) return discCompare;
        const arquivoA = (a.arquivo || '').trim().toLowerCase();
        const arquivoB = (b.arquivo || '').trim().toLowerCase();
        return arquivoA.localeCompare(arquivoB, 'pt-BR', { numeric: true, sensitivity: 'base', ignorePunctuation: false });
      });
      setDocumentos(sortedDocs);

      const dataMap = new Map();
      const revisoesMap = {};
      const revisoesExcluidasMap = {};
      const etapasExcluidasSet = new Set();

      if (data && data.length > 0) {
        data.forEach(item => {
          if (item.documento_id) dataMap.set(item.documento_id, item);

          if (item.datas) {
            Object.entries(item.datas).forEach(([rawEtapa, etapaData]) => {
              if (!etapaData || typeof etapaData !== 'object') return;

              // normaliza chave da etapa para casar com ETAPAS
              const matchEtapa = ETAPAS.find(e => normalizeKey(e) === normalizeKey(rawEtapa));
              const etapa = matchEtapa || normalizeKey(rawEtapa);

              if (!revisoesMap[etapa]) revisoesMap[etapa] = new Set();
              if (!revisoesExcluidasMap[etapa]) revisoesExcluidasMap[etapa] = new Set();

              Object.keys(etapaData).forEach(rev => {
                if (rev === '_excluida' || rev === '_revisoes_excluidas' || rev === '_revisoes_existentes') return;
                const valor = etapaData[rev];
                if (valor) revisoesMap[etapa].add(rev);
              });

              if (Array.isArray(etapaData._revisoes_existentes)) etapaData._revisoes_existentes.forEach(rev => revisoesMap[etapa].add(rev));
              if (Array.isArray(etapaData._revisoes_excluidas)) etapaData._revisoes_excluidas.forEach(rev => revisoesExcluidasMap[etapa].add(rev));
              if (etapaData._excluida) etapasExcluidasSet.add(etapa);
            });
          }
        });
      }

      const revisoesCompletas = {};
      ETAPAS.forEach(etapa => {
        const setRevs = revisoesMap[etapa] || new Set();
        const excl = revisoesExcluidasMap[etapa] || new Set();
        const todas = Array.from(setRevs).sort();
        revisoesCompletas[etapa] = todas.filter(r => !excl.has(r));
      });

      const novasLinhas = sortedDocs.map((doc, idx) => {
        const existingData = dataMap.get(doc.id);
        if (existingData && existingData.datas) {
          const normalizedDatas = {};
          Object.entries(existingData.datas).forEach(([rawEtapa, etapaData]) => {
            const matchEtapa = ETAPAS.find(e => normalizeKey(e) === normalizeKey(rawEtapa));
            const etapa = matchEtapa || normalizeKey(rawEtapa);
            normalizedDatas[etapa] = etapaData;
          });
          existingData.datas = normalizedDatas;
        }
        return existingData || {
          id: `temp-${doc.id}`,
          empreendimento_id: empreendimento.id,
          ordem: idx,
          documento_id: doc.id,
          datas: {},
          isNew: true
        };
      });

      setRevisoesPorEtapa(revisoesCompletas);
      setEtapasExcluidas(Array.from(etapasExcluidasSet));
      setLinhas(novasLinhas);
      setLoadedEmpreendimentoId(empreendimento.id);
      setLinhasModificadas(new Set());
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRevisao = (etapa) => {
    const atual = revisoesPorEtapa[etapa] || [];
    const ultima = atual.length > 0 ? atual[atual.length - 1] : 'R-1';
    const numero = parseInt((ultima || 'R00').substring(1) || '0') + 1;
    const novaRevisao = `R${String(numero).padStart(2, '0')}`;

    setRevisoesPorEtapa(prev => ({
      ...prev,
      [etapa]: [...(prev[etapa] || []), novaRevisao]
    }));

    setLinhas(prev => {
      const updated = prev.map(linha => {
        const novasDatas = { ...linha.datas };
        if (!novasDatas[etapa]) novasDatas[etapa] = {};
        if (!Array.isArray(novasDatas[etapa]._revisoes_existentes)) novasDatas[etapa]._revisoes_existentes = [];
        if (!novasDatas[etapa]._revisoes_existentes.includes(novaRevisao)) {
          novasDatas[etapa]._revisoes_existentes.push(novaRevisao);
        }
        return { ...linha, datas: novasDatas };
      });
      setLinhasModificadas(prevIds => new Set([...prevIds, ...updated.map(l => l.id)]));
      setHasUnsavedChanges(true);
      return updated;
    });
  };

  const handleRemoveRevisao = (etapa, revisao) => {
    if (!confirm(`Deseja excluir a revisão ${revisao} da etapa ${etapa}? Os dados desta revisão serão perdidos.`)) return;

    setRevisoesPorEtapa(prev => ({
      ...prev,
      [etapa]: (prev[etapa] || []).filter(r => r !== revisao)
    }));

    setLinhas(prev => {
      const updated = prev.map(linha => {
        const novasDatas = { ...linha.datas };
        if (!novasDatas[etapa]) novasDatas[etapa] = {};
        if (novasDatas[etapa][revisao]) delete novasDatas[etapa][revisao];
        if (!Array.isArray(novasDatas[etapa]._revisoes_excluidas)) novasDatas[etapa]._revisoes_excluidas = [];
        if (!novasDatas[etapa]._revisoes_excluidas.includes(revisao)) novasDatas[etapa]._revisoes_excluidas.push(revisao);
        return { ...linha, datas: novasDatas };
      });
      setLinhasModificadas(prevIds => new Set([...prevIds, ...updated.map(l => l.id)]));
      setHasUnsavedChanges(true);
      return updated;
    });
  };

  const handleExcluirEtapa = (etapa) => {
    if (!confirm(`Deseja excluir a etapa ${etapa}? Você poderá restaurá-la depois se necessário.`)) return;
    setHasUnsavedChanges(true);
    setEtapasExcluidas(prev => [...prev, etapa]);

    setLinhas(prev => {
      const updated = prev.map(linha => {
        const novasDatas = { ...linha.datas };
        if (!novasDatas[etapa]) novasDatas[etapa] = {};
        novasDatas[etapa]._excluida = true;
        return { ...linha, datas: novasDatas };
      });
      setLinhasModificadas(prevIds => new Set([...prevIds, ...updated.map(l => l.id)]));
      return updated;
    });
  };

  const handleRestaurarEtapa = (etapa) => {
    setHasUnsavedChanges(true);
    setEtapasExcluidas(prev => prev.filter(e => e !== etapa));
    setLinhas(prev => {
      const updated = prev.map(linha => {
        const novasDatas = { ...linha.datas };
        if (novasDatas[etapa] && novasDatas[etapa]._excluida) delete novasDatas[etapa]._excluida;
        return { ...linha, datas: novasDatas };
      });
      setLinhasModificadas(prevIds => new Set([...prevIds, ...updated.map(l => l.id)]));
      return updated;
    });
  };

  const handleUpdateData = (linhaId, etapa, revisao, valor) => {
    setLinhasModificadas(prev => new Set([...prev, linhaId]));
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

  const getDataValue = (linha, etapa, revisao) => {
    const data = linha.datas?.[etapa]?.[revisao] || '';
    if (!data || data === '0001-01-01' || String(data).includes('dd/mm/aaaa')) return '';
    return data;
  };

  const copiarDataParaBaixo = (linhaId, etapa, revisao) => {
    const linhaIndex = linhas.findIndex(l => l.id === linhaId);
    if (linhaIndex === -1) return;
    const valorOriginal = getDataValue(linhas[linhaIndex], etapa, revisao);
    if (!valorOriginal) {
      alert('Selecione uma data primeiro');
      return;
    }
    if (!confirm(`Copiar a data ${format(new Date(valorOriginal), 'dd/MM/yyyy')} para todas as células abaixo nesta coluna?`)) return;
    setHasUnsavedChanges(true);
    const linhasAfetadas = linhas.slice(linhaIndex + 1).map(l => l.id);
    setLinhasModificadas(prev => new Set([...prev, ...linhasAfetadas]));
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
      alert('Esta linha não possui datas para copiar');
      return;
    }
    if (!confirm('Copiar todas as datas desta linha para a próxima linha?')) return;
    setHasUnsavedChanges(true);
    const proxLinha = linhas[linhaIndex + 1];
    if (proxLinha) setLinhasModificadas(prev => new Set([...prev, proxLinha.id]));
    setLinhas(prev => prev.map((linha, idx) => {
      if (idx !== linhaIndex + 1) return linha;
      return { ...linha, datas: JSON.parse(JSON.stringify(linhaOriginal.datas)) };
    }));
  };

  const copiarDataParaProximaColuna = (linhaId, etapa, revisao) => {
    const linha = linhas.find(l => l.id === linhaId);
    if (!linha) return;
    const valorOriginal = getDataValue(linha, etapa, revisao);
    if (!valorOriginal) {
      alert('Selecione uma data primeiro');
      return;
    }
    const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
    const etapaIndex = etapasVisiveis.indexOf(etapa);
    const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
    const revisaoIndex = revisoesEtapa.indexOf(revisao);

    setHasUnsavedChanges(true);
    setLinhasModificadas(prev => new Set([...prev, linhaId]));
    setLinhas(prev => prev.map(l => {
      if (l.id !== linhaId) return l;
      const novasDatas = { ...l.datas };
      if (revisaoIndex < revisoesEtapa.length - 1) {
        if (!novasDatas[etapa]) novasDatas[etapa] = {};
        novasDatas[etapa][revisoesEtapa[revisaoIndex + 1]] = valorOriginal;
      } else if (etapaIndex < etapasVisiveis.length - 1) {
        const proxEtapa = etapasVisiveis[etapaIndex + 1];
        const proxRevisoes = revisoesPorEtapa[proxEtapa] || DEFAULT_REVISOES;
        if (proxRevisoes.length > 0) {
          if (!novasDatas[proxEtapa]) novasDatas[proxEtapa] = {};
          novasDatas[proxEtapa][proxRevisoes[0]] = valorOriginal;
        }
      }
      return { ...l, datas: novasDatas };
    }));
  };

  const toggleSelectFolha = (linhaId) => {
    setSelectedFolhas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(linhaId)) newSet.delete(linhaId); else newSet.add(linhaId);
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
    if (!massEditEtapa || !massEditRevisao || !massEditData) { alert('Preencha etapa, revisão e data'); return; }
    setHasUnsavedChanges(true);
    setLinhasModificadas(prev => new Set([...prev, ...Array.from(selectedFolhas)]));
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

  const toggleMinimizarEtapa = (etapa) => setEtapasMinimizadas(prev => ({ ...prev, [etapa]: !prev[etapa] }));

  const copiarDataParaDireita = (linhaId, etapa, revisao) => {
    const linha = linhas.find(l => l.id === linhaId);
    if (!linha) return;
    const valorOriginal = getDataValue(linha, etapa, revisao);
    if (!valorOriginal) { alert('Selecione uma data primeiro'); return; }
    const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
    const etapaIndex = etapasVisiveis.indexOf(etapa);
    const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
    const revisaoIndex = revisoesEtapa.indexOf(revisao);
    if (!confirm(`Copiar a data ${format(new Date(valorOriginal), 'dd/MM/yyyy')} para todas as células à direita nesta linha?`)) return;

    setHasUnsavedChanges(true);
    setLinhasModificadas(prev => new Set([...prev, linhaId]));
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
        proxRevisoes.forEach(rev => novasDatas[proxEtapa][rev] = valorOriginal);
      }
      return { ...l, datas: novasDatas };
    }));
  };

  // ...existing code...
  const handleSave = async (silent = false) => {
  if (isSaving) return;
  setIsSaving(true);
  try {
    const linhasParaSalvar = linhas.filter(linha => {
      if (!linha.documento_id) return false;
      if (linhasModificadas.size > 0 && !linhasModificadas.has(linha.id)) return false;
      return linha.datas && Object.keys(linha.datas).length > 0;
    });

    if (linhasParaSalvar.length === 0) {
      setIsSaving(false);
      if (!silent) alert('Nenhuma alteração para salvar');
      return;
    }

    const CONCURRENCY = 4;            // reduzir para evitar rate limit
    const MAX_ATTEMPTS = 4;           // tentativas com backoff
    const BASE_DELAY = 700;          // ms
    const updatedLinhas = new Map();
    let successCount = 0;
    let errorCount = 0;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const jitter = (n) => Math.floor(Math.random() * n);

    const saveOne = async (linha) => {
      let attempts = 0;
      while (attempts < MAX_ATTEMPTS) {
        attempts++;
        try {
          const datasComMetadados = {};
          if (linha.datas) {
            Object.entries(linha.datas).forEach(([etapa, etapaData]) => {
              if (etapaData && typeof etapaData === 'object') datasComMetadados[etapa] = { ...etapaData };
            });
          }
          ETAPAS.filter(e => !etapasExcluidas.includes(e)).forEach(etapa => {
            const revs = revisoesPorEtapa[etapa];
            if (revs && revs.length) {
              if (!datasComMetadados[etapa]) datasComMetadados[etapa] = {};
              datasComMetadados[etapa]._revisoes_existentes = revs;
            }
          });

          const payload = {
            empreendimento_id: empreendimento.id,
            ordem: linha.ordem,
            documento_id: linha.documento_id,
            datas: datasComMetadados
          };

          const isNew = linha.isNew || String(linha.id).startsWith('temp-');
          const result = isNew ? await DataCadastro.create(payload) : await DataCadastro.update(linha.id, payload);

          updatedLinhas.set(linha.id, result);
          successCount++;
          return;
        } catch (err) {
          // detectar 429 / Retry-After se disponível
          const status = err?.status || err?.response?.status;
          const retryAfterHeader = err?.response?.headers?.['retry-after'] || err?.response?.headers?.['Retry-After'];
          if (status === 429 && retryAfterHeader) {
            const waitMs = (parseInt(retryAfterHeader, 10) || 1) * 1000;
            await sleep(waitMs + jitter(300));
            continue;
          }
          if (attempts >= MAX_ATTEMPTS) {
            errorCount++;
            console.error(`Erro salvando linha ${linha.id}:`, err);
            return;
          }
          // exponential backoff com jitter
          const backoff = BASE_DELAY * Math.pow(2, attempts - 1) + jitter(300);
          await sleep(backoff);
        }
      }
    };

    // pool de concorrência (workers)
    let idx = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, linhasParaSalvar.length) }).map(async () => {
      while (true) {
        const i = idx++;
        if (i >= linhasParaSalvar.length) break;
        await saveOne(linhasParaSalvar[i]);
      }
    });

    await Promise.all(workers);

    // atualizar estado local
    setLinhas(prev => prev.map(linha => {
      const saved = updatedLinhas.get(linha.id);
      if (saved) return { ...linha, id: saved.id, isNew: false };
      return linha;
    }));

    setHasUnsavedChanges(false);
    setLinhasModificadas(new Set());

    if (!silent) {
      if (errorCount > 0) alert(`Salvamento parcial: ${successCount} sucesso, ${errorCount} erros.`);
      else alert(`Dados salvos com sucesso! ${successCount} linhas atualizadas.`);
    }
  } catch (error) {
    if (!silent) alert(`Erro ao salvar: ${error?.message || error}`);
  } finally {
    setIsSaving(false);
  }
};

  const linhasPorDisciplina = useMemo(() => {
    const grupos = {};
    linhas.forEach(linha => {
      const doc = documentoById.get(linha.documento_id);
      const disciplina = doc?.disciplina || 'Sem Disciplina';
      if (!grupos[disciplina]) grupos[disciplina] = [];
      grupos[disciplina].push(linha);
    });
    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhas, documentoById]);

  const larguraTotalEtapas = useMemo(() => {
    const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
    return etapasVisiveis.reduce((total, etapa) => {
      const isMinimizada = etapasMinimizadas[etapa];
      if (isMinimizada) return total + 40;
      const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
      return total + ((revisoesEtapa.length * 110) + 40);
    }, 0);
  }, [ETAPAS, etapasExcluidas, etapasMinimizadas, revisoesPorEtapa]);

  const handleExportTemplate = () => {
    const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
    let headers = ['folha'];
    etapasVisiveis.forEach(etapa => {
      const revisoes = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
      revisoes.forEach(rev => headers.push(`${etapa}_${rev}`));
    });
    const csvContent = [
      headers.join(';'),
      ['ARQ-01', ...etapasVisiveis.flatMap(etapa => (revisoesPorEtapa[etapa] || DEFAULT_REVISOES).map(() => '15/01/2025'))].join(';')
    ].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_cadastro_${(empreendimento?.nome || 'empreendimento').replace(/\s+/g, '_')}.csv`;
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
        headers.forEach((header, idx) => row[header] = values[idx] || '');
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

      if (erros.length > 0) {
        if (!confirm(`Erros encontrados:\n${erros.join('\n')}\n\nContinuar com os registros válidos?`)) {
          setIsImporting(false);
          return;
        }
      }
      if (dadosParaImportar.length === 0) { alert('Nenhum registro válido encontrado no arquivo'); return; }

      let sucessos = 0, falhas = 0;
      for (const dado of dadosParaImportar) {
        try {
          const linhaExistente = linhas.find(l => l.documento_id === dado.documento_id);
          if (linhaExistente && !linhaExistente.isNew && !String(linhaExistente.id).startsWith('temp-')) {
            await retryWithBackoff(() => DataCadastro.update(linhaExistente.id, { datas: { ...linhaExistente.datas, ...dado.datas } }), 3, 1000, `importUpdate-${linhaExistente.id}`);
          } else {
            const ordem = linhas.length;
            await retryWithBackoff(() => DataCadastro.create({ empreendimento_id: empreendimento.id, ordem, documento_id: dado.documento_id, datas: dado.datas }), 3, 1000, `importCreate-${dado.documento_id}`);
          }
          sucessos++;
        } catch (error) {
          falhas++;
          console.error('Erro ao importar', dado.documento_id, error);
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
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Alterações não salvas</Badge>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            {selectedFolhas.size > 0 && (
              <>
                <Badge variant="outline" className="px-3 py-1">{selectedFolhas.size} folha{selectedFolhas.size > 1 ? 's' : ''} selecionada{selectedFolhas.size > 1 ? 's' : ''}</Badge>
                <Button variant="outline" onClick={handleMassEdit} className="border-purple-500 text-purple-600 hover:bg-purple-50">
                  <Wand2 className="w-4 h-4 mr-2" />Preencher em Massa
                </Button>
                <Button variant="outline" onClick={clearSelection} className="border-gray-400 text-gray-600 hover:bg-gray-50">Limpar Seleção</Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowImportModal(true)} className="border-green-500 text-green-600 hover:bg-green-50">
              <Upload className="w-4 h-4 mr-2" />Importar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar
            </Button>
          </div>
        )}
      </div>

      {!readOnly && (
        <Button onClick={handleSave} disabled={isSaving} className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow" size="icon">
          {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
        </Button>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="flex h-[calc(100vh-300px)] overflow-hidden max-w-full">
          <div className="w-[20%] border-r-2 border-gray-300 flex flex-col bg-gray-50">
            <div className="bg-blue-100 border-b-2 border-gray-300 px-2 sticky top-0 z-30 flex items-center" style={{ height: '72px' }}>
              <div className="flex items-center gap-2">
                {!readOnly && (
                  <input type="checkbox" checked={linhas.length > 0 && selectedFolhas.size === linhas.length} onChange={(e) => e.target.checked ? selectAllFolhas() : clearSelection()} className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" title="Selecionar todas" />
                )}
                <span className="font-semibold text-sm">Folha</span>
              </div>
            </div>

            <div ref={folhasScrollRef} className="flex-1 overflow-y-auto" onScroll={(e) => { if (dataScrollRef.current) dataScrollRef.current.scrollTop = e.target.scrollTop; }}>
              {linhas.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Nenhum documento cadastrado neste empreendimento. Cadastre documentos na aba "Documentos" primeiro.</div>
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
                      const doc = documentoById.get(linha.documento_id);
                      return (
                        <div key={linha.id} className="border-b border-gray-200 px-2 hover:bg-gray-100 transition-colors flex items-center" style={{ height: '48px' }}>
                          <div className="flex items-center gap-1.5 w-full">
                            {!readOnly && (
                              <input type="checkbox" checked={selectedFolhas.has(linha.id)} onChange={() => toggleSelectFolha(linha.id)} className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs text-gray-900 truncate" title={doc?.arquivo || doc?.numero || 'Sem folha'}>
                                {doc?.arquivo || doc?.numero || 'Sem folha'}
                              </div>
                              {doc?.descritivo && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1" title={doc.descritivo}>{doc.descritivo}</div>}
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

          <div className="w-[80%] flex flex-col overflow-hidden">
            <div ref={dataScrollRef} className="flex-1 overflow-x-auto overflow-y-auto" onScroll={(e) => { if (folhasScrollRef.current && e.target.scrollTop !== folhasScrollRef.current.scrollTop) folhasScrollRef.current.scrollTop = e.target.scrollTop; }}>
              <div style={{ width: `${larguraTotalEtapas}px` }}>
                <div className="bg-blue-100 border-b-2 border-gray-300 sticky top-0 z-20" style={{ minWidth: `${larguraTotalEtapas}px`, height: '72px' }}>
                  <div className="flex h-full">
                    {ETAPAS.filter(etapa => !etapasExcluidas.includes(etapa)).map((etapa) => {
                      const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                      const isMinimizada = etapasMinimizadas[etapa];
                      return (
                        <div key={etapa} className="border-r border-gray-300 last:border-r-0 relative group flex-shrink-0 flex flex-col" style={{ width: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px`, minWidth: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px` }}>
                          <div className="p-1.5 text-center font-semibold flex-1 flex items-center justify-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => toggleMinimizarEtapa(etapa)} className="text-gray-600 hover:text-gray-900 p-0.5" title={isMinimizada ? "Expandir" : "Minimizar"}>
                                {isMinimizada ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                              </button>
                              <span className={`${isMinimizada ? 'writing-mode-vertical-rl transform rotate-180 text-xs' : 'text-xs'}`}>{isMinimizada ? etapa.substring(0, 3).toUpperCase() : etapa}</span>
                              {!readOnly && !isMinimizada && (
                                <button onClick={() => handleExcluirEtapa(etapa)} className="absolute top-0.5 right-0.5 text-red-500 hover:text-red-700 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded" title="Excluir etapa">
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {!isMinimizada && (
                            <div className="flex border-t border-gray-300 bg-blue-50">
                              {(revisoesPorEtapa[etapa] || DEFAULT_REVISOES).map((revisao) => (
                                <div key={`${etapa}-${revisao}`} className="border-r border-gray-200 p-1 text-center font-medium text-xs" style={{ width: '110px', minWidth: '110px' }}>
                                  <div className="flex items-center justify-center gap-0.5">
                                    <span>{revisao}</span>
                                    {!readOnly && (
                                      <button onClick={() => handleRemoveRevisao(etapa, revisao)} className="text-red-500 hover:text-red-700 p-0.5" title={`Excluir revisão ${revisao}`}>
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <div className="bg-green-50 p-0.5 text-center" style={{ width: '40px', minWidth: '40px' }}>
                                {!readOnly && <button onClick={() => handleAddRevisao(etapa)} className="text-green-600 hover:text-green-800 p-0.5" title="Adicionar revisão"><Plus className="w-3 h-3" /></button>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ minWidth: `${larguraTotalEtapas}px` }}>
                  {linhas.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Nenhum documento cadastrado</div>
                  ) : (
                    linhasPorDisciplina.map(([disciplina, linhasDaDisciplina]) => (
                      <div key={disciplina}>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-300 flex" style={{ minWidth: `${larguraTotalEtapas}px`, height: '44px' }}>
                          {ETAPAS.filter(e => !etapasExcluidas.includes(e)).map((etapa) => {
                            const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                            const isMinimizada = etapasMinimizadas[etapa];
                            return <div key={`${disciplina}-${etapa}`} className="border-r border-gray-200 flex-shrink-0" style={{ width: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px`, minWidth: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px` }}></div>;
                          })}
                        </div>

                        {linhasDaDisciplina.map((linha) => {
                          const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
                          return (
                            <div key={linha.id} className="flex border-b border-gray-200 hover:bg-gray-50" style={{ minWidth: `${larguraTotalEtapas}px`, height: '48px' }}>
                              {etapasVisiveis.map((etapa) => {
                                const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                                const isMinimizada = etapasMinimizadas[etapa];
                                return (
                                  <div key={`${linha.id}-${etapa}`} className="border-r border-gray-200 last:border-r-0 flex-shrink-0" style={{ width: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px`, minWidth: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px` }}>
                                    {isMinimizada ? (
                                      <div className="h-full flex items-center justify-center p-0.5 bg-gray-50"></div>
                                    ) : (
                                      <div className="flex">
                                        {revisoesEtapa.map((revisao) => (
                                          <div key={`${linha.id}-${etapa}-${revisao}`} className="border-r border-gray-100 p-0.5 flex-shrink-0 flex items-center relative group" style={{ width: '110px', minWidth: '110px' }}>
                                            <input type="date" value={getDataValue(linha, etapa, revisao)} onChange={(e) => handleUpdateData(linha.id, etapa, revisao, e.target.value)} className="h-8 text-xs w-full px-1 border border-gray-300 rounded cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 hover:[&::-webkit-calendar-picker-indicator]:opacity-100" style={{ color: getDataValue(linha, etapa, revisao) ? 'black' : 'transparent' }} disabled={readOnly} />
                                            {!readOnly && getDataValue(linha, etapa, revisao) && (
                                              <button onClick={() => copiarDataParaBaixo(linha.id, etapa, revisao)} className="text-purple-600 hover:text-purple-800 p-0.5 absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Preencher todas abaixo">
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

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Importar Datas de Cadastro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">📋 Instruções</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Envie um arquivo CSV com as datas de cadastro</li>
                <li>• Coluna obrigatória: <code className="bg-white px-1 rounded">folha</code></li>
                <li>• Colunas de datas: <code className="bg-white px-1 rounded">ETAPA_REVISAO</code></li>
                <li>• Formato de data: <code className="bg-white px-1 rounded">DD/MM/AAAA</code></li>
                <li>• Baixe o template para ver a estrutura correta</li>
              </ul>
            </div>

            <Button variant="outline" onClick={handleExportTemplate} className="w-full"><Download className="w-4 h-4 mr-2" />Baixar Template CSV</Button>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full" />
              {importFile && <p className="text-sm text-green-600 mt-2">✓ Arquivo selecionado: {importFile.name}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowImportModal(false); setImportFile(null); }} disabled={isImporting}>Cancelar</Button>
              <Button onClick={handleImport} disabled={!importFile || isImporting} className="bg-green-600 hover:bg-green-700">
                {isImporting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</>) : (<><Upload className="w-4 h-4 mr-2" />Importar</>)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMassEditModal} onOpenChange={setShowMassEditModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Preencher Data em Massa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3"><p className="text-sm text-blue-800">Preencher data para <strong>{selectedFolhas.size}</strong> folha{selectedFolhas.size > 1 ? 's' : ''} selecionada{selectedFolhas.size > 1 ? 's' : ''}</p></div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Etapa</label>
              <select value={massEditEtapa} onChange={(e) => setMassEditEtapa(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm">
                <option value="">Selecione a etapa</option>
                {ETAPAS.filter(e => !etapasExcluidas.includes(e)).map(etapa => <option key={etapa} value={etapa}>{etapa}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Revisão</label>
              <select value={massEditRevisao} onChange={(e) => setMassEditRevisao(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm" disabled={!massEditEtapa}>
                <option value="">Selecione a revisão</option>
                {massEditEtapa && (revisoesPorEtapa[massEditEtapa] || DEFAULT_REVISOES).map(rev => <option key={rev} value={rev}>{rev}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Data</label>
              <Input type="date" value={massEditData} onChange={(e) => setMassEditData(e.target.value)} className="w-full" />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowMassEditModal(false); setMassEditEtapa(''); setMassEditRevisao(''); setMassEditData(''); }}>Cancelar</Button>
              <Button onClick={applyMassEdit} className="bg-purple-600 hover:bg-purple-700"><Wand2 className="w-4 h-4 mr-2" />Aplicar a {selectedFolhas.size} Folha{selectedFolhas.size > 1 ? 's' : ''}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ...existing code...