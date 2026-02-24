import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Loader2, Upload, Download, Copy, ArrowDown, ArrowRight, Wand2, ChevronRight, ChevronLeft } from "lucide-react";
import { DataCadastro, Documento } from "@/entities/all";
import { retryWithBackoff } from "@/components/utils/apiUtils";
import { format } from "date-fns";

// As etapas serão carregadas do empreendimento

const DEFAULT_REVISOES = ["R00", "R01", "R02"];

export default function CadastroTab({ empreendimento, readOnly = false }) {
  // Etapas do empreendimento convertidas para uppercase
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
  const autoSaveTimeoutRef = useRef(null);
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

    // Se mudou de empreendimento, reseta e carrega dados do novo
    if (empreendimento.id !== loadedEmpreendimentoId) {
      console.log(`🔄 Mudança de empreendimento: ${loadedEmpreendimentoId} -> ${empreendimento.id}`);
      setLoadedEmpreendimentoId(empreendimento.id);
      setIsLoading(true);
      // Carrega dados imediatamente
      loadData();
    }
  }, [empreendimento?.id]);

  // Auto-save desabilitado - causava conflitos de rate limit
  // useEffect(() => {
  //   if (hasUnsavedChanges && !isLoading && !isSaving) {
  //     console.log('Auto-save agendado - mudanças detectadas');
  //     if (autoSaveTimeoutRef.current) {
  //       clearTimeout(autoSaveTimeoutRef.current);
  //     }
  //     
  //     autoSaveTimeoutRef.current = setTimeout(() => {
  //       console.log('Executando auto-save');
  //       handleSave(true); // true = silent save
  //     }, 5000); // salva após 5 segundos de inatividade
  //   }
  //   
  //   return () => {
  //     if (autoSaveTimeoutRef.current) {
  //       clearTimeout(autoSaveTimeoutRef.current);
  //     }
  //   };
  // }, [hasUnsavedChanges, linhas, isSaving]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [data, docs] = await Promise.all([
        retryWithBackoff(
          () => DataCadastro.filter({ empreendimento_id: empreendimento.id }),
          3, 2000,
          'loadDataCadastro'
        ),
        retryWithBackoff(
          () => Documento.filter({ empreendimento_id: empreendimento.id }),
          3, 2000,
          'loadDocumentos'
        )
      ]);

      // Ordenar por disciplina e depois por arquivo (mesma ordem do DocumentosTab)
      const sortedDocs = (docs || []).sort((a, b) => {
        // Primeiro por disciplina
        const discA = (a.disciplina || 'Sem Disciplina').toLowerCase();
        const discB = (b.disciplina || 'Sem Disciplina').toLowerCase();
        const discCompare = discA.localeCompare(discB, 'pt-BR', { sensitivity: 'base' });

        if (discCompare !== 0) return discCompare;

        // Depois por arquivo (alfabético natural)
        const arquivoA = (a.arquivo || '').trim().toLowerCase();
        const arquivoB = (b.arquivo || '').trim().toLowerCase();
        return arquivoA.localeCompare(arquivoB, 'pt-BR', {
          numeric: true,
          sensitivity: 'base',
          ignorePunctuation: false
        });
      });
      setDocumentos(sortedDocs);

      // Criar um mapa de dados existentes por documento_id
      const dataMap = new Map();
      const revisoesMap = {};
      const revisoesExcluidasMap = {};
      const etapasExcluidasSet = new Set();

      if (data && data.length > 0) {
        console.log('📊 Processando dados carregados do banco:', data.length, 'registros');
        data.forEach((item, itemIdx) => {
          console.log(`\n[${itemIdx}] Processando item ID: ${item.id}, documento_id: ${item.documento_id}`);
          if (item.documento_id) {
            dataMap.set(item.documento_id, item);
          }

          // Detectar revisões existentes e excluídas por etapa
          if (item.datas) {
            console.log(`  Datas para este item:`, Object.keys(item.datas));
            Object.entries(item.datas).forEach(([etapa, etapaData]) => {
              console.log(`  📌 Processando etapa: ${etapa}`, etapaData);
              if (etapaData && typeof etapaData === 'object') {
                if (!revisoesMap[etapa]) {
                  revisoesMap[etapa] = new Set();
                }
                if (!revisoesExcluidasMap[etapa]) {
                  revisoesExcluidasMap[etapa] = new Set();
                }

                // Adicionar revisões que têm dados preenchidos
                Object.keys(etapaData).forEach(rev => {
                  // Ignorar chaves metadata com ou sem underscore
                  const metaKeys = ['_excluida', 'excluida', '_revisoes_excluidas', 'revisoes_excluidas', '_revisoes_existentes', 'revisoes_existentes', 'meta'];
                  if (!metaKeys.includes(rev)) {
                    const valor = etapaData[rev];
                    console.log(`    📝 Revisão com dados: ${rev} = ${valor}`);
                    revisoesMap[etapa].add(rev);
                  }
                });

                // Carregar revisões que foram criadas (usar apenas meta.revisoes_existentes)
                if (etapaData.meta && Array.isArray(etapaData.meta.revisoes_existentes)) {
                  console.log(`    📋 meta.revisoes_existentes encontrado:`, etapaData.meta.revisoes_existentes);
                  etapaData.meta.revisoes_existentes.forEach(rev => revisoesMap[etapa].add(rev));
                }

                // Detectar revisões excluídas (usar apenas meta.revisoes_excluidas)
                if (etapaData.meta && Array.isArray(etapaData.meta.revisoes_excluidas)) {
                  etapaData.meta.revisoes_excluidas.forEach(rev => revisoesExcluidasMap[etapa].add(rev));
                }

                // Detectar etapas excluídas (usar apenas meta.excluida)
                if (etapaData.meta && etapaData.meta.excluida) {
                  etapasExcluidasSet.add(etapa);
                }
              }
            });
          }
        });
        console.log('🎯 Resumo de revisões carregadas:', revisoesMap);
      }

      // Inicializar revisões para todas as etapas, removendo as excluídas
      const revisoesCompletas = {};
      ETAPAS.forEach(etapa => {
        // Usar APENAS as revisões mapeadas (dados + _revisoes_existentes)
        // NÃO usar DEFAULT_REVISOES como fallback, pois pode sobrescrever revisões criadas
        const revisoesEtapaSet = revisoesMap[etapa];
        console.log(`🔎 Buscando ${etapa}:`, {
          existe: !!revisoesEtapaSet,
          isSet: revisoesEtapaSet instanceof Set,
          size: revisoesEtapaSet?.size,
          values: revisoesEtapaSet ? Array.from(revisoesEtapaSet) : 'N/A'
        });

        let todasRevisoes = revisoesEtapaSet && revisoesEtapaSet.size > 0
          ? Array.from(revisoesEtapaSet)
          : [];

        const revisoesExcluidas = revisoesExcluidasMap[etapa] || new Set();
        // Filtrar apenas nomes válidos do tipo RNN, remover excluídas e ordenar numericamente
        const filtradas = todasRevisoes
          .filter(rev => !!rev && !revisoesExcluidas.has(rev))
          .map(r => {
            const m = String(r).match(/^R(\d+)$/i);
            if (!m) return null;
            const num = parseInt(m[1], 10);
            return `R${String(num).padStart(2, '0')}`;
          })
          .filter(Boolean)
          .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));

        revisoesCompletas[etapa] = filtradas;
        console.log(`✅ Etapa ${etapa}: ${revisoesCompletas[etapa].join(', ')} (Total: ${revisoesCompletas[etapa].length})`);
      });

      // Log com stringify para evitar problema de referência do console
      console.log('📋 Revisões finais para setar no estado:', JSON.stringify(revisoesCompletas, null, 2));
      console.log('📋 ETAPAS para debug:', ETAPAS);
      console.log('📋 revisoesMap para debug:', revisoesMap);
      console.log('🔴 ANTES DE SETAR STATE - revisoesCompletas:', JSON.stringify(revisoesCompletas, null, 2));

      // Criar uma linha para cada documento
      const novasLinhas = sortedDocs.map((doc, idx) => {
        const existingData = dataMap.get(doc.id);
        return existingData || {
          id: `temp-${doc.id}`,
          empreendimento_id: empreendimento.id,
          ordem: idx,
          documento_id: doc.id,
          datas: {},
          isNew: true
        };
      });

      // Setar tudo junto de uma vez — mesclar com estado anterior para não perder colunas
      setRevisoesPorEtapa(prev => {
        const merged = {};
        ETAPAS.forEach(etapa => {
          const prevArr = Array.isArray(prev?.[etapa]) ? prev[etapa] : [];
          const newArr = Array.isArray(revisoesCompletas?.[etapa]) ? revisoesCompletas[etapa] : [];
          const s = Array.from(new Set([...(prevArr || []), ...(newArr || [])]));
          const norm = s
            .map(r => {
              const m = String(r).match(/^R(\d+)$/i);
              if (!m) return null;
              return `R${String(parseInt(m[1], 10)).padStart(2, '0')}`;
            })
            .filter(Boolean)
            .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
          merged[etapa] = norm;
        });
        return merged;
      });
      setEtapasExcluidas(Array.from(etapasExcluidasSet));
      setLinhas(novasLinhas);
      setLoadedEmpreendimentoId(empreendimento.id);
      setLinhasModificadas(new Set());

      // Log final para confirmar que revisões foram setadas
      console.log('🎬 FINAL DO LOADDATA - Revisões devem estar em revisoesPorEtapa agora');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };



  const handleAddRevisao = (etapa) => {
    const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
    if (revisoesEtapa.length === 0) {
      // Se não há revisões, começar com R00
      console.log(`➕ Adicionando primeira revisão (R00) em ${etapa}`);
      setHasUnsavedChanges(true);
      setRevisoesPorEtapa(prev => ({
        ...prev,
        [etapa]: ['R00']
      }));
      // Marcar revisão como existente nas linhas mesmo sem dados (apenas em meta)
      setLinhas(prev => prev.map(linha => {
        const novasDatas = { ...linha.datas };
        if (!novasDatas[etapa]) novasDatas[etapa] = {};
        if (!novasDatas[etapa].meta) novasDatas[etapa].meta = {};
        if (!Array.isArray(novasDatas[etapa].meta.revisoes_existentes)) {
          novasDatas[etapa].meta.revisoes_existentes = [];
        }
        if (!novasDatas[etapa].meta.revisoes_existentes.includes('R00')) {
          novasDatas[etapa].meta.revisoes_existentes.push('R00');
        }
        return { ...linha, datas: novasDatas };
      }));
      setLinhasModificadas(new Set(linhas.map(l => l.id)));
      return;
    }
    const ultimaRevisao = revisoesEtapa[revisoesEtapa.length - 1];
    const numero = parseInt(ultimaRevisao.substring(1)) + 1;
    const novaRevisao = `R${String(numero).padStart(2, '0')}`;

    console.log(`➕ Adicionando revisão ${novaRevisao} em ${etapa} (antes: ${revisoesEtapa.join(', ')})`);
    setHasUnsavedChanges(true);
    setRevisoesPorEtapa(prev => ({
      ...prev,
      [etapa]: [...(prev[etapa] || []), novaRevisao]
    }));
    // Marcar revisão como existente nas linhas mesmo sem dados (apenas em meta)
    setLinhas(prev => prev.map(linha => {
      const novasDatas = { ...linha.datas };
      if (!novasDatas[etapa]) novasDatas[etapa] = {};
      if (!novasDatas[etapa].meta) novasDatas[etapa].meta = {};
      if (!Array.isArray(novasDatas[etapa].meta.revisoes_existentes)) {
        novasDatas[etapa].meta.revisoes_existentes = [];
      }
      if (!novasDatas[etapa].meta.revisoes_existentes.includes(novaRevisao)) {
        novasDatas[etapa].meta.revisoes_existentes.push(novaRevisao);
      }
      return { ...linha, datas: novasDatas };
    }));
    setLinhasModificadas(new Set(linhas.map(l => l.id)));
    console.log(`✅ Revisão ${novaRevisao} marcada em todas as ${linhas.length} linhas`);
  };

  const handleRemoveRevisao = (etapa, revisao) => {
    if (!confirm(`Deseja excluir a revisão ${revisao} da etapa ${etapa}? Os dados desta revisão serão perdidos.`)) return;

    setHasUnsavedChanges(true);
    setRevisoesPorEtapa(prev => ({
      ...prev,
      [etapa]: prev[etapa].filter(r => r !== revisao)
    }));

    // Limpar dados e marcar revisão como excluída
    setLinhas(prev => prev.map(linha => {
      const novasDatas = { ...linha.datas };
      if (!novasDatas[etapa]) {
        novasDatas[etapa] = {};
      }

      // Remover dados da revisão
      if (novasDatas[etapa][revisao]) {
        delete novasDatas[etapa][revisao];
      }

      // Adicionar à lista de revisões excluídas (apenas em meta)
      if (!novasDatas[etapa].meta) novasDatas[etapa].meta = {};
      if (!Array.isArray(novasDatas[etapa].meta.revisoes_excluidas)) {
        novasDatas[etapa].meta.revisoes_excluidas = [];
      }
      if (!novasDatas[etapa].meta.revisoes_excluidas.includes(revisao)) {
        novasDatas[etapa].meta.revisoes_excluidas.push(revisao);
      }

      return { ...linha, datas: novasDatas };
    }));
    setLinhasModificadas(new Set(linhas.map(l => l.id)));
  };

  const handleExcluirEtapa = (etapa) => {
    if (!confirm(`Deseja excluir a etapa ${etapa}? Você poderá restaurá-la depois se necessário.`)) return;

    setHasUnsavedChanges(true);
    setEtapasExcluidas(prev => [...prev, etapa]);

    // Marcar etapa como excluída nas linhas
    setLinhas(prev => prev.map(linha => {
      const novasDatas = { ...linha.datas };
      if (!novasDatas[etapa]) {
        novasDatas[etapa] = {};
      }
      // Marcar etapa como excluída apenas em meta
      if (!novasDatas[etapa].meta) novasDatas[etapa].meta = {};
      novasDatas[etapa].meta.excluida = true;
      return { ...linha, datas: novasDatas };
    }));
    setLinhasModificadas(new Set(linhas.map(l => l.id)));
  };

  const handleRestaurarEtapa = (etapa) => {
    setHasUnsavedChanges(true);
    setEtapasExcluidas(prev => prev.filter(e => e !== etapa));

    // Remover marcador de exclusão
    setLinhas(prev => prev.map(linha => {
      const novasDatas = { ...linha.datas };
      if (novasDatas[etapa] && novasDatas[etapa]._excluida) {
        delete novasDatas[etapa]._excluida;
      }
      if (novasDatas[etapa] && novasDatas[etapa].excluida) {
        delete novasDatas[etapa].excluida;
      }
      if (novasDatas[etapa] && novasDatas[etapa].meta && novasDatas[etapa].meta.excluida) {
        delete novasDatas[etapa].meta.excluida;
      }
      return { ...linha, datas: novasDatas };
    }));
    setLinhasModificadas(new Set(linhas.map(l => l.id)));
  };

  const handleUpdateData = (linhaId, etapa, revisao, valor) => {
    console.log('📝 handleUpdateData:', { linhaId, etapa, revisao, valor });
    setLinhasModificadas(prev => new Set([...prev, linhaId]));
    setLinhas(prev => {
      const updated = prev.map(linha => {
        if (linha.id !== linhaId) return linha;

        const novasDatas = { ...linha.datas };
        if (!novasDatas[etapa]) {
          novasDatas[etapa] = {};
        }
        // Se o valor estiver vazio, deletar a chave ao invés de setar como vazio
        if (!valor || valor.trim() === '') {
          delete novasDatas[etapa][revisao];
          console.log(`  ❌ Deletado: ${linhaId}/${etapa}/${revisao}`);
        } else {
          novasDatas[etapa][revisao] = valor;
          console.log(`  ✅ Adicionado: ${linhaId}/${etapa}/${revisao} = ${valor}`);
        }

        return { ...linha, datas: novasDatas };
      });
      return updated;
    });
    // Garantir que o flag de mudanças não salvas é setado DEPOIS da atualização das linhas
    setTimeout(() => {
      console.log('🔔 Marcando como "Alterações não salvas"');
      setHasUnsavedChanges(true);
    }, 0);
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
      if (!novasDatas[etapa]) {
        novasDatas[etapa] = {};
      }
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
    if (proxLinha) {
      setLinhasModificadas(prev => new Set([...prev, proxLinha.id]));
    }
    setLinhas(prev => prev.map((linha, idx) => {
      if (idx !== linhaIndex + 1) return linha;

      // Deep clone do objeto datas para evitar referências compartilhadas
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

      // Se há próxima revisão na mesma etapa
      if (revisaoIndex < revisoesEtapa.length - 1) {
        if (!novasDatas[etapa]) novasDatas[etapa] = {};
        novasDatas[etapa][revisoesEtapa[revisaoIndex + 1]] = valorOriginal;
      }
      // Senão, vai para primeira revisão da próxima etapa
      else if (etapaIndex < etapasVisiveis.length - 1) {
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
      if (newSet.has(linhaId)) {
        newSet.delete(linhaId);
      } else {
        newSet.add(linhaId);
      }
      return newSet;
    });
  };

  const selectAllFolhas = () => {
    setSelectedFolhas(new Set(linhas.map(l => l.id)));
  };

  const clearSelection = () => {
    setSelectedFolhas(new Set());
  };

  const handleMassEdit = () => {
    if (selectedFolhas.size === 0) {
      alert('Selecione ao menos uma folha');
      return;
    }
    setShowMassEditModal(true);
  };

  const applyMassEdit = () => {
    if (!massEditEtapa || !massEditRevisao || !massEditData) {
      alert('Preencha etapa, revisão e data');
      return;
    }

    setHasUnsavedChanges(true);
    setLinhasModificadas(prev => new Set([...prev, ...Array.from(selectedFolhas)]));
    setLinhas(prev => prev.map(linha => {
      if (!selectedFolhas.has(linha.id)) return linha;

      const novasDatas = { ...linha.datas };
      if (!novasDatas[massEditEtapa]) {
        novasDatas[massEditEtapa] = {};
      }
      novasDatas[massEditEtapa][massEditRevisao] = massEditData;

      return { ...linha, datas: novasDatas };
    }));

    setShowMassEditModal(false);
    setMassEditEtapa('');
    setMassEditRevisao('');
    setMassEditData('');
    clearSelection();
  };

  const toggleMinimizarEtapa = (etapa) => {
    setEtapasMinimizadas(prev => ({
      ...prev,
      [etapa]: !prev[etapa]
    }));
  };

  const copiarDataParaDireita = (linhaId, etapa, revisao) => {
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

    if (!confirm(`Copiar a data ${format(new Date(valorOriginal), 'dd/MM/yyyy')} para todas as células à direita nesta linha?`)) return;

    setHasUnsavedChanges(true);
    setLinhasModificadas(prev => new Set([...prev, linhaId]));
    setLinhas(prev => prev.map(l => {
      if (l.id !== linhaId) return l;

      const novasDatas = { ...l.datas };

      // Copiar para revisões seguintes da mesma etapa
      for (let i = revisaoIndex + 1; i < revisoesEtapa.length; i++) {
        if (!novasDatas[etapa]) novasDatas[etapa] = {};
        novasDatas[etapa][revisoesEtapa[i]] = valorOriginal;
      }

      // Copiar para próximas etapas
      for (let i = etapaIndex + 1; i < etapasVisiveis.length; i++) {
        const proxEtapa = etapasVisiveis[i];
        const proxRevisoes = revisoesPorEtapa[proxEtapa] || DEFAULT_REVISOES;

        if (!novasDatas[proxEtapa]) novasDatas[proxEtapa] = {};
        proxRevisoes.forEach(rev => {
          novasDatas[proxEtapa][rev] = valorOriginal;
        });
      }

      return { ...l, datas: novasDatas };
    }));
  };



  const handleSave = async (silent = false) => {
    console.log('💾 INICIANDO SALVAMENTO');
    if (isSaving) {
      console.log('⚠️ Já está salvando, ignorando chamada duplicada');
      return;
    }
    setIsSaving(true);
    try {
      console.log('📋 Estado atual hasUnsavedChanges:', hasUnsavedChanges);
      console.log('📋 Total de linhas:', linhas.length);
      console.log('📋 Linhas modificadas:', linhasModificadas.size);

      // SALVAR APENAS linhas modificadas OU todas se não há rastreamento
      const linhasParaSalvar = linhas.filter(linha => {
        if (!linha.documento_id) {
          console.log(`  ⏭️ Linha ${linha.id} ignorada (sem documento_id)`);
          return false;
        }

        // Se há rastreamento de modificações, salvar apenas modificadas
        if (linhasModificadas.size > 0 && !linhasModificadas.has(linha.id)) {
          console.log(`  ⏭️ Linha ${linha.id} não modificada`);
          return false;
        }

        // Se tem datas (mesmo vazias), pode ter metadados
        if (linha.datas && Object.keys(linha.datas).length > 0) {
          console.log(`  ✅ Linha ${linha.id} tem datas (salva)`);
          return true;
        }

        // Se não tem datas nenhuma, não salva
        console.log(`  ⏭️ Linha ${linha.id} ignorada (sem datas nenhuma)`);
        return false;
      });

      console.log(`📤 ${linhasParaSalvar.length} linhas para salvar (de ${linhas.length} total)`);
      console.log('📤 Primeiras 3 linhas para debug:', linhasParaSalvar.slice(0, 3).map(l => ({
        id: l.id,
        documento_id: l.documento_id,
        datas: l.datas
      })));

      // Primeiro: tentar usar operações em lote se disponíveis para reduzir RPS
      console.log('⚡ Tentando rota em lote (bulk) antes de salvar por item...');
      const hasBulkUpsert = typeof DataCadastro.bulkUpsert === 'function';
      const hasBulkCreate = typeof DataCadastro.bulkCreate === 'function';
      const hasBulkUpdate = typeof DataCadastro.bulkUpdate === 'function';

      const buildPayload = (linha) => {
        const datasComMetadados = {};
        if (linha.datas) {
          Object.entries(linha.datas).forEach(([etapa, etapaData]) => {
            if (etapaData && typeof etapaData === 'object') {
              datasComMetadados[etapa] = { ...etapaData };
            }
          });
        }

        const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
        etapasVisiveis.forEach(etapa => {
          const revisoesEtapa = revisoesPorEtapa[etapa] || [];
          if (!datasComMetadados[etapa]) datasComMetadados[etapa] = {};

          const revisoesFromLinha = Array.isArray(datasComMetadados[etapa]._revisoes_existentes)
            ? datasComMetadados[etapa]._revisoes_existentes
            : (Array.isArray(datasComMetadados[etapa].revisoes_existentes) ? datasComMetadados[etapa].revisoes_existentes : []);

          const unionRevisoes = Array.from(new Set([...(revisoesFromLinha || []), ...(revisoesEtapa || [])]));
          if (unionRevisoes.length > 0) {
            const normalized = Array.from(new Set(unionRevisoes))
              .map(r => {
                const m = String(r).match(/^R(\d+)$/i);
                if (!m) return null;
                const num = parseInt(m[1], 10);
                return `R${String(num).padStart(2, '0')}`;
              })
              .filter(Boolean)
              .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));

            // Escrever tanto em meta.revisoes_existentes quanto nas chaves legadas
            if (!datasComMetadados[etapa].meta || typeof datasComMetadados[etapa].meta !== 'object') {
              datasComMetadados[etapa].meta = {};
            }
            datasComMetadados[etapa].meta.revisoes_existentes = normalized;

            // Compatibilidade: algumas versões do backend esperam chaves no nível da etapa
            datasComMetadados[etapa]._revisoes_existentes = normalized;
            datasComMetadados[etapa].revisoes_existentes = normalized;

            // Garantir chaves de revisão vazias para sobreviver a filtros do backend
            normalized.forEach(rev => {
              if (!(rev in datasComMetadados[etapa])) {
                datasComMetadados[etapa][rev] = '';
              }
            });
          }
        });

        return {
          empreendimento_id: empreendimento.id,
          ordem: linha.ordem,
          documento_id: linha.documento_id,
          datas: datasComMetadados,
          // manter referência local para reconciliar (temp id)
          __localId: linha.id
        };
      };

      if (hasBulkUpsert || hasBulkCreate || hasBulkUpdate) {
        try {
          console.log('🔎 SDK bulk detection:', { hasBulkUpsert, hasBulkCreate, hasBulkUpdate });
          const novos = [];
          const existentes = [];
          linhasParaSalvar.forEach(l => {
            const payload = buildPayload(l);
            if (l.isNew || String(l.id).startsWith('temp-')) {
              novos.push(payload);
            } else {
              existentes.push({ id: l.id, ...payload });
            }
          });

          // tentar bulkUpsert primeiro (unifica create/update)
          if (hasBulkUpsert) {
            try {
              console.log('⬆️ Usando DataCadastro.bulkUpsert — itens:', linhasParaSalvar.length);
              const allPayload = linhasParaSalvar.map(l => buildPayload(l));
              const res = await retryWithBackoff(() => DataCadastro.bulkUpsert(allPayload), 3, 2000, 'bulkUpsertDataCadastro');
              if (Array.isArray(res)) {
                res.forEach(item => {
                  // mapear por documento_id quando possível, fallback por id
                  const keyLocal = linhasParaSalvar.find(l => l.documento_id === item.documento_id)?.id;
                  if (keyLocal) updatedLinhas.set(keyLocal, item);
                  else if (item.id) updatedLinhas.set(item.id, item);
                });
                console.log('✅ bulkUpsert teve sucesso, pulando salvamento por item');
                // pular o fluxo por item
              }
            } catch (err) {
              console.warn('⚠️ bulkUpsert falhou, fallback para bulkCreate/bulkUpdate ou salvamento por item', err.message || err);
            }
          }

          // se bulkUpsert não populou updatedLinhas, tentar bulkCreate/bulkUpdate separadamente
          if (updatedLinhas.size === 0) {
            let created = [];
            let updated = [];

            if (hasBulkCreate && novos.length > 0) {
              try {
                console.log('🟢 Usando DataCadastro.bulkCreate — novos:', novos.length);
                created = await retryWithBackoff(() => DataCadastro.bulkCreate(novos.map(n => ({ ...n }))), 3, 2000, 'bulkCreateDataCadastro');
                if (Array.isArray(created)) {
                  created.forEach(item => {
                    const localId = novos.find(n => n.documento_id === item.documento_id)?.__localId;
                    if (localId) updatedLinhas.set(localId, item);
                    else if (item.id) updatedLinhas.set(item.id, item);
                  });
                }
              } catch (err) {
                console.warn('⚠️ bulkCreate falhou, will fallback to per-item:', err.message || err);
              }
            }

            if (hasBulkUpdate && existentes.length > 0) {
              try {
                console.log('🟠 Usando DataCadastro.bulkUpdate — existentes:', existentes.length);
                updated = await retryWithBackoff(() => DataCadastro.bulkUpdate(existentes.map(u => ({ id: u.id, empreendimento_id: u.empreendimento_id, ordem: u.ordem, documento_id: u.documento_id, datas: u.datas }))), 3, 2000, 'bulkUpdateDataCadastro');
                if (Array.isArray(updated)) {
                  updated.forEach(item => {
                    if (item.id) updatedLinhas.set(item.id, item);
                    else if (item.documento_id) {
                      const localId = existentes.find(e => e.documento_id === item.documento_id)?.id;
                      if (localId) updatedLinhas.set(localId, item);
                    }
                  });
                }
              } catch (err) {
                console.warn('⚠️ bulkUpdate falhou, will fallback to per-item:', err.message || err);
              }
            }

            if (updatedLinhas.size > 0) {
              console.log(`✅ Bulk path retornou ${updatedLinhas.size} registros atualizados/created`);
            }
          }

          // Se bulk produziu resultados para todas linhas, podemos reconciliar e terminar
          if (updatedLinhas.size >= linhasParaSalvar.length) {
            console.log('🔁 Reconciliando estado local a partir de resultados bulk...');
            // Construir novo array de linhas aplicando respostas do bulk
            const newArr = linhas.map(linha => {
              const saved = updatedLinhas.get(linha.id) || updatedLinhas.get(linha.documento_id);
              if (saved) return { ...linha, id: saved.id || linha.id, isNew: false, datas: { ...linha.datas, ...(saved.datas || {}) } };
              return linha;
            });

            // Atualizar estado de linhas
            setLinhas(newArr);

            // Recalcular revisoesPorEtapa a partir do novo array de linhas
            try {
              const novoMap = {};
              newArr.forEach(l => {
                if (!l || !l.datas) return;
                Object.entries(l.datas).forEach(([etapa, etapaData]) => {
                  if (!etapaData || typeof etapaData !== 'object') return;
                  if (!novoMap[etapa]) novoMap[etapa] = new Set();

                  // coletar revisões com dados
                  Object.keys(etapaData).forEach(k => {
                    const metaKeys = ['_excluida', 'excluida', '_revisoes_excluidas', 'revisoes_excluidas', '_revisoes_existentes', 'revisoes_existentes', 'meta'];
                    if (metaKeys.includes(k)) return;
                    novoMap[etapa].add(k);
                  });

                  // coletar revisoes_existentes (aceitar ambas variantes e meta)
                  if (etapaData.meta && Array.isArray(etapaData.meta.revisoes_existentes)) {
                    etapaData.meta.revisoes_existentes.forEach(r => novoMap[etapa].add(r));
                  }
                  if (Array.isArray(etapaData._revisoes_existentes)) {
                    etapaData._revisoes_existentes.forEach(r => novoMap[etapa].add(r));
                  }
                  if (Array.isArray(etapaData.revisoes_existentes)) {
                    etapaData.revisoes_existentes.forEach(r => novoMap[etapa].add(r));
                  }
                });
              });

              const novasRevisoesPorEtapa = {};
              ETAPAS.forEach(etapa => {
                const s = novoMap[etapa] || new Set();
                const arr = Array.from(s)
                  .map(r => {
                    const m = String(r).match(/^R(\d+)$/i);
                    if (!m) return null;
                    return `R${String(parseInt(m[1], 10)).padStart(2, '0')}`;
                  })
                  .filter(Boolean)
                  .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
                novasRevisoesPorEtapa[etapa] = arr;
              });

              console.log('🔄 revisoesPorEtapa recalculado após bulk:', novasRevisoesPorEtapa);
              // Mesclar com o estado atual para garantir que colunas recém-criadas não sejam perdidas
              setRevisoesPorEtapa(prev => {
                const merged = {};
                ETAPAS.forEach(etapa => {
                  const prevArr = Array.isArray(prev?.[etapa]) ? prev[etapa] : [];
                  const newArr = Array.isArray(novasRevisoesPorEtapa?.[etapa]) ? novasRevisoesPorEtapa[etapa] : [];
                  const s = Array.from(new Set([...(prevArr || []), ...(newArr || [])]));
                  const norm = s
                    .map(r => {
                      const m = String(r).match(/^R(\d+)$/i);
                      if (!m) return null;
                      return `R${String(parseInt(m[1], 10)).padStart(2, '0')}`;
                    })
                    .filter(Boolean)
                    .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
                  merged[etapa] = norm;
                });
                return merged;
              });
            } catch (err) {
              console.error('Erro ao recalcular revisoesPorEtapa após bulk:', err);
            }

            console.log('🎉 Salvamento em lote concluído com sucesso');
            setHasUnsavedChanges(false);
            setLinhasModificadas(new Set());
            setIsSaving(false);
            return; // já finalizamos o handleSave
          }
        } catch (err) {
          console.warn('⚠️ Erro no caminho bulk, continuando com salvamento por item:', err.message || err);
        }
      }

      // Processar em lotes sequenciais para evitar rate limit
      console.log('⚡ Iniciando salvamento em lotes...');
      let successCount = 0;
      let errorCount = 0;
      const updatedLinhas = new Map();
      const BATCH_SIZE = 2; // Máximo de requisições paralelas por lote
      const DELAY_ENTRE_LOTES = 1500; // Delay entre lotes em ms

      // Dividir em lotes
      for (let batchIdx = 0; batchIdx < linhasParaSalvar.length; batchIdx += BATCH_SIZE) {
        const batch = linhasParaSalvar.slice(batchIdx, batchIdx + BATCH_SIZE);
        console.log(`\n📦 Lote ${Math.floor(batchIdx / BATCH_SIZE) + 1}: ${batch.length} linhas`);

        const batchPromises = batch.map((linha, idxNoBatch) =>
          (async () => {
            const idxGlobal = batchIdx + idxNoBatch;
            try {
              console.log(`\n📨 [${idxGlobal + 1}/${linhasParaSalvar.length}] Salvando linha: ${linha.id}`);

              // Preservar metadados
              const datasComMetadados = {};
              if (linha.datas) {
                Object.entries(linha.datas).forEach(([etapa, etapaData]) => {
                  if (etapaData && typeof etapaData === 'object') {
                    datasComMetadados[etapa] = {
                      ...etapaData
                    };
                  }
                });
              }

              const linhaData = {
                empreendimento_id: empreendimento.id,
                ordem: linha.ordem,
                documento_id: linha.documento_id,
                datas: datasComMetadados
              };

              // GARANTIR que revisões criadas são salvas mesmo que vazias
              // Preservar revisões que já estão em linha.datas e unir com o estado
              const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
              etapasVisiveis.forEach(etapa => {
                const revisoesEtapa = revisoesPorEtapa[etapa] || [];
                if (!datasComMetadados[etapa]) {
                  datasComMetadados[etapa] = {};
                }

                const revisoesFromLinha = Array.isArray(datasComMetadados[etapa].meta?.revisoes_existentes)
                  ? datasComMetadados[etapa].meta.revisoes_existentes
                  : [];

                // União entre revisões detectadas no estado da etapa e as marcadas na própria linha (usar apenas meta)
                const unionRevisoes = Array.from(new Set([...(revisoesFromLinha || []), ...(revisoesEtapa || [])]));

                if (unionRevisoes.length > 0) {
                  // Normalizar: aceitar apenas revisões no formato RNN e ordenar por número
                  const normalized = Array.from(new Set(unionRevisoes))
                    .map(r => {
                      const m = String(r).match(/^R(\d+)$/i);
                      if (!m) return null;
                      const num = parseInt(m[1], 10);
                      return `R${String(num).padStart(2, '0')}`;
                    })
                    .filter(Boolean)
                    .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));

                  // Persistir APENAS em `meta.revisoes_existentes`
                  if (!datasComMetadados[etapa].meta || typeof datasComMetadados[etapa].meta !== 'object') {
                    datasComMetadados[etapa].meta = {};
                  }
                  datasComMetadados[etapa].meta.revisoes_existentes = normalized;
                  // Garantir que cada revisão exista como chave real (mesmo vazia) para sobreviver a filtros do backend
                  normalized.forEach(rev => {
                    if (!(rev in datasComMetadados[etapa])) {
                      datasComMetadados[etapa][rev] = '';
                    }
                  });
                }
              });

              const linhaDataFinal = {
                ...linhaData,
                datas: datasComMetadados
              };

              console.log(`  Dados FINAL a salvar:`, linhaDataFinal);

              let result;
              let attempts = 0;
              const maxAttempts = 3;

              while (attempts < maxAttempts) {
                try {
                  const isNew = linha.isNew || linha.id.toString().startsWith('temp-');
                  console.log(`  🔄 Tentativa ${attempts + 1}/${maxAttempts} (${isNew ? 'CREATE' : 'UPDATE'})`);

                  if (isNew) {
                    result = await DataCadastro.create(linhaDataFinal);
                  } else {
                    result = await DataCadastro.update(linha.id, linhaDataFinal);
                  }
                  console.log(`  ✅ Sucesso! ID: ${result.id}`);
                  break;
                } catch (err) {
                  attempts++;
                  console.error(`  ❌ Tentativa ${attempts} falhou:`, err.message);

                  if (attempts >= maxAttempts) {
                    throw err;
                  }

                  const waitTime = 3000 * attempts;
                  console.log(`  ⏳ Aguardando ${waitTime}ms...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                }
              }

              successCount++;
              updatedLinhas.set(linha.id, result);
            } catch (error) {
              errorCount++;
              console.error(`❌ ERRO na linha ${linha.id}:`, error);
            }
          })()
        );

        // Executar lote em paralelo
        await Promise.all(batchPromises);

        // Delay entre lotes (exceto no último)
        if (batchIdx + BATCH_SIZE < linhasParaSalvar.length) {
          console.log(`⏳ Aguardando ${DELAY_ENTRE_LOTES}ms antes do próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_LOTES));
        }
      }

      // Atualizar estado local com os IDs salvos e recalcular revisoesPorEtapa com base no novo estado
      console.log(`\n✨ Atualizando ${successCount} linhas salvas no estado local (mesclando datas retornadas)`);
      setLinhas(prev => {
        const newArr = prev.map(linha => {
          const savedData = updatedLinhas.get(linha.id);
          if (savedData) {
            console.log(`  ✅ ${linha.id} -> ${savedData.id}`);
            console.log('  🔎 Datas retornadas pelo servidor:', savedData.datas);
            const mergedDatas = { ...linha.datas, ...(savedData.datas || {}) };
            return { ...linha, id: savedData.id, isNew: false, datas: mergedDatas };
          }
          return linha;
        });

        // Recalcular revisoesPorEtapa a partir do novo array de linhas
        try {
          const novoMap = {};
          newArr.forEach(l => {
            if (!l || !l.datas) return;
            Object.entries(l.datas).forEach(([etapa, etapaData]) => {
              if (!etapaData || typeof etapaData !== 'object') return;
              if (!novoMap[etapa]) novoMap[etapa] = new Set();

              // coletar revisões com dados
              Object.keys(etapaData).forEach(k => {
                const metaKeys = ['_excluida', 'excluida', '_revisoes_excluidas', 'revisoes_excluidas', '_revisoes_existentes', 'revisoes_existentes', 'meta'];
                if (metaKeys.includes(k)) return;
                novoMap[etapa].add(k);
              });

              // coletar revisoes_existentes (aceitar _ / plain / meta)
              if (Array.isArray(etapaData._revisoes_existentes)) {
                etapaData._revisoes_existentes.forEach(r => novoMap[etapa].add(r));
              }
              if (Array.isArray(etapaData.revisoes_existentes)) {
                etapaData.revisoes_existentes.forEach(r => novoMap[etapa].add(r));
              }
              if (etapaData.meta && Array.isArray(etapaData.meta.revisoes_existentes)) {
                etapaData.meta.revisoes_existentes.forEach(r => novoMap[etapa].add(r));
              }
            });
          });

          const novasRevisoesPorEtapa = {};
          ETAPAS.forEach(etapa => {
            const s = novoMap[etapa] || new Set();
            const arr = Array.from(s)
              .map(r => {
                const m = String(r).match(/^R(\d+)$/i);
                if (!m) return null;
                return `R${String(parseInt(m[1], 10)).padStart(2, '0')}`;
              })
              .filter(Boolean)
              .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
            novasRevisoesPorEtapa[etapa] = arr;
          });

          console.log('🔄 revisoesPorEtapa recalculado após salvamento (novo estado):', novasRevisoesPorEtapa);
          // Mesclar com o estado atual para evitar perder revisões que não retornaram do servidor
          setRevisoesPorEtapa(prev => {
            const merged = {};
            ETAPAS.forEach(etapa => {
              const prevArr = Array.isArray(prev?.[etapa]) ? prev[etapa] : [];
              const newArr = Array.isArray(novasRevisoesPorEtapa?.[etapa]) ? novasRevisoesPorEtapa[etapa] : [];
              const s = Array.from(new Set([...(prevArr || []), ...(newArr || [])]));
              const norm = s
                .map(r => {
                  const m = String(r).match(/^R(\d+)$/i);
                  if (!m) return null;
                  return `R${String(parseInt(m[1], 10)).padStart(2, '0')}`;
                })
                .filter(Boolean)
                .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
              merged[etapa] = norm;
            });
            return merged;
          });
        } catch (err) {
          console.error('Erro ao recalcular revisoesPorEtapa após salvamento:', err);
        }

        return newArr;
      });

      console.log(`\n🎉 SALVAMENTO COMPLETO - Sucesso: ${successCount}, Erros: ${errorCount}`);
      console.log('🔄 Setando hasUnsavedChanges = false');
      setHasUnsavedChanges(false);
      setLinhasModificadas(new Set());

      // Recarregar do servidor para garantir que a UI reflita exatamente o que foi persistido
      if (successCount > 0) {
        try {
          console.log('🔁 Recarregando dados do servidor após salvamento...');
          await loadData();
          console.log('🔁 Recarregamento completo');
        } catch (err) {
          console.error('Erro ao recarregar dados após salvamento:', err);
        }
      }

      if (!silent) {
        if (errorCount > 0) {
          alert(`Salvamento parcial: ${successCount} sucesso, ${errorCount} erros.`);
        } else {
          alert(`Dados salvos com sucesso! ${successCount} linhas atualizadas.`);
        }
      }
    } catch (error) {
      console.error('💥 ERRO CRÍTICO ao salvar:', error);
      if (!silent) {
        alert(`Erro ao salvar dados: ${error.message || 'Erro desconhecido'}`);
      }
    } finally {
      console.log('🔚 Finalizando salvamento - setando isSaving = false');
      setIsSaving(false);
    }
  };

  const getDataValue = (linha, etapa, revisao) => {
    const data = linha.datas?.[etapa]?.[revisao] || '';
    // Não exibir datas inválidas (01/01/0001 ou dd/mm/aaaa)
    if (!data || data === '0001-01-01' || data.includes('dd/mm/aaaa')) {
      return '';
    }
    return data;
  };

  const linhasPorDisciplina = useMemo(() => {
    const grupos = {};

    linhas.forEach(linha => {
      const doc = documentos.find(d => d.id === linha.documento_id);
      const disciplina = doc?.disciplina || 'Sem Disciplina';

      if (!grupos[disciplina]) {
        grupos[disciplina] = [];
      }
      grupos[disciplina].push(linha);
    });

    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
  }, [linhas, documentos]);

  const larguraTotalEtapas = useMemo(() => {
    const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
    return etapasVisiveis.reduce((total, etapa) => {
      const isMinimizada = etapasMinimizadas[etapa];
      if (isMinimizada) {
        return total + 40;
      }
      const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
      return total + ((revisoesEtapa.length * 110) + 40);
    }, 0);
  }, [ETAPAS, etapasExcluidas, etapasMinimizadas, revisoesPorEtapa]);

  const handleExportTemplate = () => {
    const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));

    // Criar cabeçalhos dinamicamente
    let headers = ['folha'];
    etapasVisiveis.forEach(etapa => {
      const revisoes = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
      revisoes.forEach(rev => {
        headers.push(`${etapa}_${rev}`);
      });
    });

    const csvContent = [
      headers.join(';'),
      // Linha de exemplo
      [
        'ARQ-01',
        ...etapasVisiveis.flatMap(etapa =>
          (revisoesPorEtapa[etapa] || DEFAULT_REVISOES).map(() => '15/01/2025')
        )
      ].join(';')
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_cadastro_${empreendimento.nome.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  const handleImport = async () => {
    if (!importFile) {
      alert('Selecione um arquivo para importar');
      return;
    }

    setIsImporting(true);
    try {
      const fileContent = await importFile.text();
      const lines = fileContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        alert('Arquivo vazio ou inválido');
        return;
      }

      // Detectar separador (ponto-e-vírgula ou vírgula)
      const separator = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(separator).map(h => h.trim());

      if (!headers.includes('folha')) {
        alert('Cabeçalho "folha" obrigatório não encontrado');
        return;
      }

      const dadosParaImportar = [];
      const erros = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        const folhaNome = row.folha;
        if (!folhaNome) {
          erros.push(`Linha ${i + 1}: Nome da folha é obrigatório`);
          continue;
        }

        // Buscar documento por número ou arquivo
        const documento = documentos.find(d =>
          d.numero === folhaNome || d.arquivo === folhaNome
        );

        if (!documento) {
          erros.push(`Linha ${i + 1}: Folha "${folhaNome}" não encontrada`);
          continue;
        }

        // Processar datas por etapa e revisão
        const datas = {};
        headers.forEach(header => {
          if (header === 'folha') return;

          const data = row[header];
          if (!data) return;

          // Formato esperado: "ETAPA_REVISAO"
          const parts = header.split('_');
          if (parts.length < 2) return;

          const revisao = parts.pop();
          const etapa = parts.join('_');

          // Converter data de dd/mm/aaaa para aaaa-mm-dd
          let dataFormatada = data;
          if (data.includes('/')) {
            const [dia, mes, ano] = data.split('/');
            if (dia && mes && ano) {
              dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            }
          }

          if (!datas[etapa]) {
            datas[etapa] = {};
          }
          datas[etapa][revisao] = dataFormatada;
        });

        dadosParaImportar.push({
          documento_id: documento.id,
          datas
        });
      }

      if (erros.length > 0) {
        alert(`Erros encontrados:\n${erros.join('\n')}\n\nContinuar com os registros válidos?`);
      }

      if (dadosParaImportar.length === 0) {
        alert('Nenhum registro válido encontrado no arquivo');
        return;
      }

      let sucessos = 0;
      let falhas = 0;

      for (const dado of dadosParaImportar) {
        try {
          // Verificar se já existe registro para este documento
          const linhaExistente = linhas.find(l => l.documento_id === dado.documento_id);

          if (linhaExistente && !linhaExistente.isNew && !linhaExistente.id.toString().startsWith('temp-')) {
            // Atualizar registro existente
            await retryWithBackoff(
              () => DataCadastro.update(linhaExistente.id, {
                datas: { ...linhaExistente.datas, ...dado.datas }
              }),
              3, 1000, `importUpdate-${linhaExistente.id}`
            );
          } else {
            // Criar novo registro
            const ordem = linhas.length;
            await retryWithBackoff(
              () => DataCadastro.create({
                empreendimento_id: empreendimento.id,
                ordem,
                documento_id: dado.documento_id,
                datas: dado.datas
              }),
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

      if (sucessos > 0) {
        await loadData();
        setShowImportModal(false);
        setImportFile(null);
      }

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
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            {selectedFolhas.size > 0 && (
              <>
                <Badge variant="outline" className="px-3 py-1">
                  {selectedFolhas.size} folha{selectedFolhas.size > 1 ? 's' : ''} selecionada{selectedFolhas.size > 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="outline"
                  onClick={handleMassEdit}
                  className="border-purple-500 text-purple-600 hover:bg-purple-50"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Preencher em Massa
                </Button>
                <Button
                  variant="outline"
                  onClick={clearSelection}
                  className="border-gray-400 text-gray-600 hover:bg-gray-50"
                >
                  Limpar Seleção
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              className="border-green-500 text-green-600 hover:bg-green-50"
            >
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
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Save className="w-6 h-6" />
          )}
        </Button>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="flex h-[calc(100vh-300px)] overflow-hidden max-w-full">
          {/* Container de Folhas Fixo - 20% */}
          <div className="w-[20%] border-r-2 border-gray-300 flex flex-col bg-gray-50">
            {/* Cabeçalho Fixo das Folhas */}
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

            {/* Lista de Folhas */}
            <div
              ref={folhasScrollRef}
              className="flex-1 overflow-y-auto"
              onScroll={(e) => {
                if (dataScrollRef.current) {
                  dataScrollRef.current.scrollTop = e.target.scrollTop;
                }
              }}
            >
              {linhas.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Nenhum documento cadastrado neste empreendimento. Cadastre documentos na aba "Documentos" primeiro.
                </div>
              ) : (
                linhasPorDisciplina.map(([disciplina, linhasDaDisciplina]) => (
                  <div key={disciplina}>
                    {/* Cabeçalho da Disciplina */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-300 px-2 flex items-center" style={{ height: '44px' }}>
                      <div className="flex items-center gap-1.5 w-full">
                        <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                        <h3 className="font-semibold text-sm text-gray-800">{disciplina}</h3>
                        <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                          {linhasDaDisciplina.length}
                        </Badge>
                      </div>
                    </div>

                    {/* Folhas da Disciplina */}
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
                  <div className="flex h-full">
                    {ETAPAS.filter(etapa => !etapasExcluidas.includes(etapa)).map((etapa, idx) => {
                      const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                      const isMinimizada = etapasMinimizadas[etapa];
                      const colSpanTotal = isMinimizada ? 1 : revisoesEtapa.length + 1;

                      return (
                        <div
                          key={etapa}
                          className="border-r border-gray-300 last:border-r-0 relative group flex-shrink-0 flex flex-col"
                          style={{ width: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px`, minWidth: isMinimizada ? '40px' : `${(revisoesEtapa.length * 110) + 40}px` }}
                        >
                          <div className="p-1.5 text-center font-semibold flex-1 flex items-center justify-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => toggleMinimizarEtapa(etapa)}
                                className="text-gray-600 hover:text-gray-900 p-0.5"
                                title={isMinimizada ? "Expandir" : "Minimizar"}
                              >
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

                          {/* Cabeçalho de Revisões */}
                          {!isMinimizada && (
                            <div className="flex border-t border-gray-300 bg-blue-50">
                              {console.log(`🔍 Renderizando cabeçalho ${etapa}:`, revisoesEtapa, 'Estado:', revisoesPorEtapa)}
                              {revisoesEtapa.map((revisao) => (
                                <div
                                  key={`${etapa}-${revisao}`}
                                  className="border-r border-gray-200 p-1 text-center font-medium text-xs"
                                  style={{ width: '110px', minWidth: '110px' }}
                                >
                                  <div className="flex items-center justify-center gap-0.5">
                                    <span>{revisao}</span>
                                    {!readOnly && (
                                      <button
                                        onClick={() => handleRemoveRevisao(etapa, revisao)}
                                        className="text-red-500 hover:text-red-700 p-0.5"
                                        title={`Excluir revisão ${revisao}`}
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <div className="bg-green-50 p-0.5 text-center" style={{ width: '40px', minWidth: '40px' }}>
                                {!readOnly && (
                                  <button
                                    onClick={() => handleAddRevisao(etapa)}
                                    className="text-green-600 hover:text-green-800 p-0.5"
                                    title="Adicionar revisão"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Área de Dados */}
                <div style={{ minWidth: `${larguraTotalEtapas}px` }}>
                  {linhas.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      Nenhum documento cadastrado
                    </div>
                  ) : (
                    linhasPorDisciplina.map(([disciplina, linhasDaDisciplina]) => (
                      <div key={disciplina}>
                        {/* Cabeçalho da Disciplina - para alinhar com a coluna de folhas */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-300 flex" style={{ minWidth: `${larguraTotalEtapas}px`, height: '44px' }}>
                          {ETAPAS.filter(e => !etapasExcluidas.includes(e)).map((etapa) => {
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

                        {/* Linhas da Disciplina */}
                        {linhasDaDisciplina.map((linha) => {
                          const doc = documentos.find(d => d.id === linha.documento_id);
                          const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));

                          return (
                            <div key={linha.id} className="flex border-b border-gray-200 hover:bg-gray-50" style={{ minWidth: `${larguraTotalEtapas}px`, height: '48px' }}>
                              {etapasVisiveis.map((etapa) => {
                                const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                                const isMinimizada = etapasMinimizadas[etapa];
                                const colSpanTotal = isMinimizada ? 1 : revisoesEtapa.length + 1;

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
              <Button
                key={etapa}
                variant="outline"
                size="sm"
                onClick={() => handleRestaurarEtapa(etapa)}
                className="text-xs"
              >
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
                <li>• Coluna obrigatória: <code className="bg-white px-1 rounded">folha</code> (número ou arquivo do documento)</li>
                <li>• Colunas de datas: <code className="bg-white px-1 rounded">ETAPA_REVISAO</code> (ex: ESTUDO PRELIMINAR_R00)</li>
                <li>• Formato de data: <code className="bg-white px-1 rounded">DD/MM/AAAA</code> (ex: 15/01/2025)</li>
                <li>• Baixe o template para ver a estrutura correta</li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={handleExportTemplate}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Template CSV
            </Button>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full"
              />
              {importFile && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ Arquivo selecionado: {importFile.name}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                disabled={isImporting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || isImporting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar
                  </>
                )}
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
              <select
                value={massEditEtapa}
                onChange={(e) => setMassEditEtapa(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 text-sm"
              >
                <option value="">Selecione a etapa</option>
                {ETAPAS.filter(e => !etapasExcluidas.includes(e)).map(etapa => (
                  <option key={etapa} value={etapa}>{etapa}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Revisão</label>
              <select
                value={massEditRevisao}
                onChange={(e) => setMassEditRevisao(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                disabled={!massEditEtapa}
              >
                <option value="">Selecione a revisão</option>
                {massEditEtapa && (revisoesPorEtapa[massEditEtapa] || DEFAULT_REVISOES).map(rev => (
                  <option key={rev} value={rev}>{rev}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Data</label>
              <Input
                type="date"
                value={massEditData}
                onChange={(e) => setMassEditData(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMassEditModal(false);
                  setMassEditEtapa('');
                  setMassEditRevisao('');
                  setMassEditData('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={applyMassEdit}
                className="bg-purple-600 hover:bg-purple-700"
              >
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