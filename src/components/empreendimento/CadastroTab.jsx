import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Loader2, Upload, Download, Copy, ArrowDown, ArrowRight, Wand2 } from "lucide-react";
import { DataCadastro, Documento } from "@/entities/all";
import { retryWithBackoff } from "@/components/utils/apiUtils";
import { format } from "date-fns";

const ETAPAS = [
  "ESTUDO PRELIMINAR",
  "ANTE-PROJETO",
  "PROJETO BÁSICO",
  "PROJETO EXECUTIVO",
  "LIBERADO PARA OBRA"
];

const DEFAULT_REVISOES = ["R00", "R01", "R02"];

export default function CadastroTab({ empreendimento, readOnly = false }) {
  const [revisoesPorEtapa, setRevisoesPorEtapa] = useState({});
  const [etapasExcluidas, setEtapasExcluidas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimeoutRef = useRef(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFolhas, setSelectedFolhas] = useState(new Set());
  const [showMassEditModal, setShowMassEditModal] = useState(false);
  const [massEditEtapa, setMassEditEtapa] = useState('');
  const [massEditRevisao, setMassEditRevisao] = useState('');
  const [massEditData, setMassEditData] = useState('');

  useEffect(() => {
    if (empreendimento?.id && linhas.length === 0) {
      loadData();
    }
  }, [empreendimento?.id]);

  // Auto-save com debounce
  useEffect(() => {
    if (hasUnsavedChanges && !isLoading) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSave(true); // true = silent save
      }, 3000); // salva após 3 segundos de inatividade
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, linhas]);

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
        data.forEach(item => {
          if (item.documento_id) {
            dataMap.set(item.documento_id, item);
          }
          
          // Detectar revisões existentes e excluídas por etapa
          if (item.datas) {
            Object.entries(item.datas).forEach(([etapa, etapaData]) => {
              if (etapaData && typeof etapaData === 'object') {
                if (!revisoesMap[etapa]) {
                  revisoesMap[etapa] = new Set(DEFAULT_REVISOES);
                }
                if (!revisoesExcluidasMap[etapa]) {
                  revisoesExcluidasMap[etapa] = new Set();
                }
                
                Object.keys(etapaData).forEach(rev => {
                  if (rev !== '_excluida' && rev !== '_revisoes_excluidas') {
                    revisoesMap[etapa].add(rev);
                  }
                });
                
                // Detectar revisões excluídas
                if (etapaData._revisoes_excluidas && Array.isArray(etapaData._revisoes_excluidas)) {
                  etapaData._revisoes_excluidas.forEach(rev => {
                    revisoesExcluidasMap[etapa].add(rev);
                  });
                }
                
                // Detectar etapas excluídas
                if (etapaData._excluida) {
                  etapasExcluidasSet.add(etapa);
                }
              }
            });
          }
        });
      }
      
      // Inicializar revisões para todas as etapas, removendo as excluídas
      const revisoesCompletas = {};
      ETAPAS.forEach(etapa => {
        const todasRevisoes = revisoesMap[etapa] 
          ? Array.from(revisoesMap[etapa]).sort()
          : [...DEFAULT_REVISOES];
        
        const revisoesExcluidas = revisoesExcluidasMap[etapa] || new Set();
        revisoesCompletas[etapa] = todasRevisoes.filter(rev => !revisoesExcluidas.has(rev));
      });
      
      setRevisoesPorEtapa(revisoesCompletas);
      setEtapasExcluidas(Array.from(etapasExcluidasSet));
      
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
      
      setLinhas(novasLinhas);
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
      setHasUnsavedChanges(true);
      setRevisoesPorEtapa(prev => ({
        ...prev,
        [etapa]: ['R00']
      }));
      return;
    }
    const ultimaRevisao = revisoesEtapa[revisoesEtapa.length - 1];
    const numero = parseInt(ultimaRevisao.substring(1)) + 1;
    const novaRevisao = `R${String(numero).padStart(2, '0')}`;

    setHasUnsavedChanges(true);
    setRevisoesPorEtapa(prev => ({
      ...prev,
      [etapa]: [...(prev[etapa] || []), novaRevisao]
    }));
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
      
      // Adicionar à lista de revisões excluídas
      if (!novasDatas[etapa]._revisoes_excluidas) {
        novasDatas[etapa]._revisoes_excluidas = [];
      }
      if (!novasDatas[etapa]._revisoes_excluidas.includes(revisao)) {
        novasDatas[etapa]._revisoes_excluidas.push(revisao);
      }
      
      return { ...linha, datas: novasDatas };
    }));
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
      novasDatas[etapa]._excluida = true;
      return { ...linha, datas: novasDatas };
    }));
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
      return { ...linha, datas: novasDatas };
    }));
  };

  const handleUpdateData = (linhaId, etapa, revisao, valor) => {
    setHasUnsavedChanges(true);
    setLinhas(prev => prev.map(linha => {
      if (linha.id !== linhaId) return linha;
      
      const novasDatas = { ...linha.datas };
      if (!novasDatas[etapa]) {
        novasDatas[etapa] = {};
      }
      // Se o valor estiver vazio, deletar a chave ao invés de setar como vazio
      if (!valor || valor.trim() === '') {
        delete novasDatas[etapa][revisao];
      } else {
        novasDatas[etapa][revisao] = valor;
      }
      
      return { ...linha, datas: novasDatas };
    }));
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
    setIsSaving(true);
    try {
      // Filtrar apenas linhas que têm dados para salvar
      const linhasParaSalvar = linhas.filter(linha => {
        if (!linha.documento_id) return false;
        
        // Verificar se há alguma data preenchida OU marcadores de exclusão de etapa
        const temDados = linha.datas && Object.values(linha.datas).some(etapaData => {
          if (!etapaData) return false;
          // Verificar se tem marcador de exclusão
          if (etapaData._excluida) return true;
          // Verificar se tem alguma data preenchida
          return Object.entries(etapaData).some(([key, data]) => 
            key !== '_excluida' && data && typeof data === 'string' && data.trim()
          );
        });
        
        return temDados;
      });

      // Processar sequencialmente para evitar rate limit
      let successCount = 0;
      let errorCount = 0;
      const updatedLinhas = new Map();

      for (let i = 0; i < linhasParaSalvar.length; i++) {
        const linha = linhasParaSalvar[i];
        
        try {
          const linhaData = {
            empreendimento_id: empreendimento.id,
            ordem: linha.ordem,
            documento_id: linha.documento_id,
            datas: linha.datas || {}
          };

          let result;
          if (linha.isNew || linha.id.toString().startsWith('temp-')) {
            result = await DataCadastro.create(linhaData);
          } else {
            result = await DataCadastro.update(linha.id, linhaData);
          }

          successCount++;
          updatedLinhas.set(linha.id, result);

          // Delay entre cada requisição para evitar rate limit
          if (i < linhasParaSalvar.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          errorCount++;
          console.error(`Erro na linha ${linha.id}:`, error);
        }
      }

      // Atualizar estado local com os IDs salvos
      setLinhas(prev => prev.map(linha => {
        const savedData = updatedLinhas.get(linha.id);
        if (savedData) {
          return { ...linha, id: savedData.id, isNew: false };
        }
        return linha;
      }));

      setHasUnsavedChanges(false);

      if (!silent) {
        if (errorCount > 0) {
          alert(`Salvamento parcial: ${successCount} sucesso, ${errorCount} erros.`);
        } else {
          alert(`Dados salvos com sucesso! ${successCount} linhas atualizadas.`);
        }
      }
    } catch (error) {
      console.error('Erro crítico ao salvar:', error);
      if (!silent) {
        alert(`Erro ao salvar dados: ${error.message || 'Erro desconhecido'}`);
      }
    } finally {
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
    <div className="space-y-4 relative overflow-hidden">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">Datas de Cadastro</h2>
          {readOnly && <Badge variant="outline" className="text-xs">Somente Visualização</Badge>}
          {!readOnly && hasUnsavedChanges && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              Salvando automaticamente...
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

      <div className="bg-white rounded-lg shadow overflow-x-auto relative isolate">
        <table className="w-full border-collapse text-sm relative">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-blue-100 p-2 sticky left-0 z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" style={{ width: '400px', minWidth: '400px', maxWidth: '400px' }}>
                <div className="flex items-center gap-2">
                  {!readOnly && (
                    <input
                      type="checkbox"
                      checked={linhas.length > 0 && selectedFolhas.size === linhas.length}
                      onChange={(e) => e.target.checked ? selectAllFolhas() : clearSelection()}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="Selecionar todas"
                    />
                  )}
                  <span>Folha</span>
                </div>
              </th>
              {ETAPAS.filter(etapa => !etapasExcluidas.includes(etapa)).map((etapa, idx) => {
                const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                const colSpanTotal = revisoesEtapa.length + 1;
                return (
                  <th
                    key={etapa}
                    colSpan={colSpanTotal}
                    className="border border-gray-300 bg-blue-200 p-2 text-center font-semibold relative group"
                    style={{ width: `${colSpanTotal * 150}px` }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>Datas de cadastro:<br />{etapa}</span>
                      {!readOnly && (
                        <button
                          onClick={() => handleExcluirEtapa(etapa)}
                          className="absolute top-1 right-1 text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded"
                          title="Excluir etapa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="border border-gray-300 bg-blue-50 p-2 sticky left-0 z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" style={{ width: '400px', minWidth: '400px', maxWidth: '400px' }}></th>
              {ETAPAS.filter(etapa => !etapasExcluidas.includes(etapa)).map((etapa, etapaIdx) => {
                const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
                return (
                  <React.Fragment key={`rev-${etapa}`}>
                    {revisoesEtapa.map((revisao, revIdx) => (
                      <th
                        key={`${etapa}-${revisao}`}
                        className="border border-gray-300 bg-blue-50 p-2 text-center font-medium"
                        style={{ width: '150px', minWidth: '150px' }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>{revisao}</span>
                          {!readOnly && (
                            <button
                              onClick={() => handleRemoveRevisao(etapa, revisao)}
                              className="text-red-500 hover:text-red-700 p-0.5"
                              title={`Excluir revisão ${revisao} de ${etapa}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th 
                      className={`border bg-green-50 p-1 text-center ${
                        etapaIdx < etapasVisiveis.length - 1 ? 'border-r-4 border-r-gray-800 border-gray-300' : 'border-gray-300'
                      }`}
                      style={{ width: '50px', minWidth: '50px' }}
                    >
                      {!readOnly && (
                        <button
                          onClick={() => handleAddRevisao(etapa)}
                          className="text-green-600 hover:text-green-800 p-0.5"
                          title={`Adicionar revisão em ${etapa}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={ETAPAS.filter(e => !etapasExcluidas.includes(e)).reduce((acc, etapa) => acc + (revisoesPorEtapa[etapa]?.length || 3) + 1, 1)} className="border border-gray-300 p-8 text-center text-gray-500">
                  Nenhum documento cadastrado neste empreendimento. Cadastre documentos na aba "Documentos" primeiro.
                </td>
              </tr>
            ) : (
              linhasPorDisciplina.map(([disciplina, linhasDaDisciplina]) => (
                <React.Fragment key={disciplina}>
                  {/* Cabeçalho da disciplina */}
                  <tr>
                    <td 
                      colSpan={ETAPAS.filter(e => !etapasExcluidas.includes(e)).reduce((acc, etapa) => acc + (revisoesPorEtapa[etapa]?.length || 3) + 1, 1)} 
                      className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-gray-300 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                        <h3 className="font-semibold text-lg text-gray-800">{disciplina}</h3>
                        <Badge variant="secondary" className="ml-2">
                          {linhasDaDisciplina.length} {linhasDaDisciplina.length === 1 ? 'documento' : 'documentos'}
                        </Badge>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Linhas da disciplina */}
                  {linhasDaDisciplina.map((linha) => {
                    const doc = documentos.find(d => d.id === linha.documento_id);
                    const etapasVisiveis = ETAPAS.filter(e => !etapasExcluidas.includes(e));
                    return (
                      <tr key={linha.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2 sticky left-0 bg-white z-20 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] group" style={{ width: '400px', minWidth: '400px', maxWidth: '400px' }}>
                         <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-2 flex-1 min-w-0">
                             {!readOnly && (
                               <input
                                 type="checkbox"
                                 checked={selectedFolhas.has(linha.id)}
                                 onChange={() => toggleSelectFolha(linha.id)}
                                 className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                               />
                             )}
                             <div className="truncate" title={doc?.arquivo || doc?.numero || 'Sem folha'}>
                               {doc?.arquivo || doc?.numero || 'Sem folha'}
                             </div>
                           </div>
                           {!readOnly && linhasPorDisciplina.findIndex(([d]) => d === disciplina) !== -1 && 
                            linhasPorDisciplina.find(([d]) => d === disciplina)[1].indexOf(linha) < 
                            linhasPorDisciplina.find(([d]) => d === disciplina)[1].length - 1 && (
                             <button
                               onClick={() => copiarLinhaParaProxima(linha.id)}
                               className="text-purple-600 hover:text-purple-800 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                               title="Copiar linha para próxima"
                             >
                               <Copy className="w-3 h-3" />
                             </button>
                           )}
                         </div>
                        </td>
                        {etapasVisiveis.map((etapa, etapaIdx) => {
                          const revisoesEtapa = revisoesPorEtapa[etapa] || DEFAULT_REVISOES;
                          return (
                            <React.Fragment key={`${linha.id}-${etapa}`}>
                              {revisoesEtapa.map((revisao, revIdx) => (
                                <td 
                                  key={`${linha.id}-${etapa}-${revisao}`} 
                                  className="border border-gray-300 p-1"
                                  style={{ width: '150px', minWidth: '150px' }}
                                >
                                    <div className="flex gap-1 group">
                                    <Input
                                     type="date"
                                     value={getDataValue(linha, etapa, revisao)}
                                     onChange={(e) => handleUpdateData(linha.id, etapa, revisao, e.target.value)}
                                     className={`h-8 text-xs w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden ${!getDataValue(linha, etapa, revisao) ? '[color-scheme:light] [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-calendar-picker-indicator]:opacity-100' : ''}`}
                                     disabled={readOnly}
                                    />
                                    {!readOnly && getDataValue(linha, etapa, revisao) && (
                                     <button
                                       onClick={() => copiarDataParaBaixo(linha.id, etapa, revisao)}
                                       className="text-purple-600 hover:text-purple-800 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                       title="Preencher todas abaixo"
                                     >
                                       <Wand2 className="w-3.5 h-3.5" />
                                     </button>
                                    )}
                                    </div>
                                </td>
                              ))}
                              <td 
                                className={`border p-1 ${
                                  etapaIdx < etapasVisiveis.length - 1 ? 'border-r-4 border-r-gray-800 border-gray-300' : 'border-gray-300'
                                }`}
                                style={{ width: '50px', minWidth: '50px' }}
                              ></td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
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