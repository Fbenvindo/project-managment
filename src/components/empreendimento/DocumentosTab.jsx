import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Documento, Disciplina, Atividade, PlanejamentoAtividade, PlanejamentoDocumento, DataCadastro } from "@/entities/all";
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, ChevronDown, ChevronRight, Loader2, BarChart, FileText, Upload, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DocumentoForm from "./DocumentoForm";
import AtividadeFormModal from "./AtividadeFormModal";
import DocumentoItemRow from "./DocumentoItemRow";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PlanejamentoDocumentoEtapaModal from './PlanejamentoDocumentoEtapaModal';
import PlanejamentoDocumentoDataModal from './PlanejamentoDocumentoDataModal';
import { ETAPAS_ORDER } from '../utils/PredecessoraValidator';
import { getNextWorkingDay, distribuirHorasPorDias, isWorkingDay, calculateEndDate, ensureWorkingDay } from '../utils/DateCalculator';
import { format, isValid, parseISO, addDays, subDays } from 'date-fns';
import { retryWithBackoff, retryWithExtendedBackoff, delay } from '../utils/apiUtils';

const parseDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  const date = new Date(`${dateString}T00:00:00`);
  return date;
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

export default function DocumentosTab({
  empreendimento,
  documentos,
  disciplinas,
  atividades: allAtividades,
  planejamentos,
  usuarios,
  pavimentos,
  onUpdate,
  isLoading,
  etapaParaPlanejamento,
  onEtapaChange,
  readOnly = false,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingDocumento, setEditingDocumento] = useState(null);
  const [showAtividadeForm, setShowAtividadeForm] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroArea, setFiltroArea] = useState("todas");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [expandedRows, setExpandedRows] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const [isDocEtapaModalOpen, setIsDocEtapaModal] = useState(false);
  const [documentForDocEtapaModal, setDocumentForDocEtapaModal] = useState(null);

  const [isDocDataModalOpen, setIsDocDataModalOpen] = useState(false);
  const [documentForDocDataModal, setDocumentForDocDataModal] = useState(null);

  const [expandedSequencing, setExpandedSequencing] = useState({});

  const [loadingDocs, setLoadingDocs] = useState({});

  const [localDocumentos, setLocalDocumentos] = useState(documentos);
  const [localPlanejamentos, setLocalPlanejamentos] = useState(planejamentos);

  const [executorPreSelecionado, setExecutorPreSelecionado] = useState(null);

  const [cargaDiariaCache, setCargaDiariaCache] = useState({});
  const [disciplinasMinimizadas, setDisciplinasMinimizadas] = useState({});

  useEffect(() => {
    setLocalDocumentos(documentos);
  }, [documentos]);

  useEffect(() => {
    setLocalPlanejamentos(planejamentos);
  }, [planejamentos]);

  const handleLocalUpdate = useCallback((updatedItemOrArray) => {
    setLocalDocumentos(prevDocs => {
      const updatedDocs = Array.isArray(updatedItemOrArray) ? updatedItemOrArray : [updatedItemOrArray];
      const newDocs = prevDocs.map(doc => {
        const found = updatedDocs.find(uDoc => uDoc.id === doc.id);
        return found ? { ...doc, ...found } : doc;
      });
      const existingIds = new Set(prevDocs.map(d => d.id));
      const newDocumentsToAdd = updatedDocs.filter(uDoc => !existingIds.has(uDoc.id));
      return [...newDocs, ...newDocumentsToAdd];
    });
  }, []);

  const getCargaDiariaExecutor = useCallback(async (executorEmail, forceRefresh = false) => {
    if (!forceRefresh && cargaDiariaCache[executorEmail]) {
      return cargaDiariaCache[executorEmail];
    }
    
    const [planosAtividade, planosDocumento] = await Promise.all([
        retryWithExtendedBackoff(
            () => PlanejamentoAtividade.filter({ executor_principal: executorEmail }),
            'loadAllPlansAtividade'
        ),
        retryWithExtendedBackoff(
            () => PlanejamentoDocumento.filter({ executor_principal: executorEmail }),
            'loadAllPlansDocumento'
        )
    ]);
    
    const todosOsPlanos = [...(planosAtividade || []), ...(planosDocumento || [])];
    const hoje = new Date();
    const hojeMidnight = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const cargaDiaria = {};

    todosOsPlanos.forEach((plano) => {
        if (plano.horas_por_dia && typeof plano.horas_por_dia === 'object') {
            Object.entries(plano.horas_por_dia).forEach(([data, horas]) => {
                try {
                    const dataObj = parseISO(data);
                    if (isValid(dataObj) && dataObj >= hojeMidnight) {
                        const diaKey = format(dataObj, 'yyyy-MM-dd');
                        const horasValidas = Number(horas) || 0;
                        
                        if (horasValidas > 0 && horasValidas <= 12) {
                            cargaDiaria[diaKey] = (cargaDiaria[diaKey] || 0) + horasValidas;
                        }
                    }
                } catch (erro) {
                    console.warn(`Erro ao processar data ${data}:`, erro);
                }
            });
        }
    });

    setCargaDiariaCache(prev => ({ ...prev, [executorEmail]: cargaDiaria }));
    return cargaDiaria;
  }, [cargaDiariaCache]);

  const handleSuccess = async (savedDoc) => {
    onUpdate();
    setShowForm(false);
    setEditingDocumento(null);
    setCargaDiariaCache({});
  };

  const handleEdit = (doc) => {
    setEditingDocumento(doc);
    setShowForm(true);
  };

  const handleEditAtividade = (atividade = null) => {
    setEditingAtividade(atividade);
    setShowAtividadeForm(true);
  };

  const handleAtividadeSuccess = async () => {
    const expandedState = { ...expandedRows };
    setShowAtividadeForm(false);
    setEditingAtividade(null);
    await onUpdate();
    setTimeout(() => {
      setExpandedRows(expandedState);
    }, 100);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este documento?")) {
      try {
        try {
          const atividadesEmp = await retryWithBackoff(
            () => base44.entities.AtividadesEmpreendimento.filter({
              documento_id: id
            }),
            3, 500, `getAtividadesEmpParaExcluir-${id}`
          );
          
          for (const atividadeEmp of atividadesEmp) {
            await retryWithBackoff(
              () => base44.entities.AtividadesEmpreendimento.delete(atividadeEmp.id),
              3, 500, `deleteAtividadeEmp-${atividadeEmp.id}`
            );
          }
        } catch (error) {
          console.warn(`⚠️ Erro ao remover registros de AtividadesEmpreendimento:`, error);
        }
        
        await retryWithExtendedBackoff(() => Documento.delete(id), `deleteDocument-${id}`);
        setLocalDocumentos(prevDocs => prevDocs.filter(d => d.id !== id));
        setCargaDiariaCache({});
        onUpdate();
      } catch (error) {
        console.error("Erro ao excluir documento:", error);
        alert("Ocorreu um erro ao excluir o documento.");
      }
    }
  };

  const handleOpenDocEtapaModal = useCallback((doc) => {
    setDocumentForDocEtapaModal(doc);
    setExecutorPreSelecionado(null);
    setIsDocEtapaModal(true);
  }, []);

  const handleCloseDocEtapaModal = useCallback(() => {
    setIsDocEtapaModal(false);
    setDocumentForDocEtapaModal(null);
    setExecutorPreSelecionado(null);
  }, []);

  const handleSaveDocEtapaPlanning = useCallback(() => {
    setCargaDiariaCache({});
    setTimeout(() => {
      retryWithBackoff(
        () => PlanejamentoAtividade.filter({ empreendimento_id: empreendimento.id }),
        3, 500, 'refreshPlanejamentosAtividadeSilent'
      ).then(plansAtividade => {
        retryWithBackoff(
          () => PlanejamentoDocumento.filter({ empreendimento_id: empreendimento.id }),
          3, 500, 'refreshPlanejamentosDocumentoSilent'
        ).then(plansDocumento => {
          const allPlans = [
            ...(plansAtividade || []).map(p => ({ ...p, tipo_plano: 'atividade' })),
            ...(plansDocumento || []).map(p => ({ ...p, tipo_plano: 'documento' }))
          ];
          setLocalPlanejamentos(allPlans);
        });
      }).catch(err => {
        console.warn("Erro ao atualizar planejamentos em background:", err);
      });
    }, 200);
    handleCloseDocEtapaModal();
    setExecutorPreSelecionado(null);
  }, [empreendimento.id, handleCloseDocEtapaModal]);

  const toggleRow = useCallback((id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handlePredecessoraChange = useCallback(async (documentoId, predecessoraId) => {
    setLoadingDocs(prev => ({ ...prev, [documentoId]: true }));
    try {
      const documento = localDocumentos.find(d => d.id === documentoId);
      if (!documento) {
        return;
      }

      const planejamentosExistentes = localPlanejamentos.filter(p => p.documento_id === documentoId);
      if (planejamentosExistentes.length > 0) {
        await Promise.all(planejamentosExistentes.map(p => {
          if (p.tipo_plano === 'atividade') {
            return retryWithExtendedBackoff(() => PlanejamentoAtividade.delete(p.id), `deleteOldPlanOnPredChange-${p.id}`);
          } else if (p.tipo_plano === 'documento') {
            return retryWithExtendedBackoff(() => PlanejamentoDocumento.delete(p.id), `deleteOldPlanDocOnPredChange-${p.id}`);
          }
          return Promise.resolve();
        }));
        
        setLocalPlanejamentos(prev => prev.filter(p => p.documento_id !== documentoId));
      }

      let updateData = { 
        predecessora_id: predecessoraId,
        inicio_planejado: null,
        termino_planejado: null,
        tempo_total: 0
      };

      if (!predecessoraId) {
        if (!documento.multiplos_executores) {
          updateData.executor_principal = null;
        }
      }

      const updatedDocFromAPI = await retryWithExtendedBackoff(() => Documento.update(documentoId, updateData), `setPredecessor-${documentoId}`);

      handleLocalUpdate(updatedDocFromAPI);
      setCargaDiariaCache({});
      
      if (predecessoraId) {
        alert(`✅ Predecessora alterada! Os planejamentos antigos foram removidos.\n\nDefina o executor novamente para replanejar com as novas datas.`);
      }

    } catch (error) {
      console.error('Erro ao definir predecessora:', error);
      alert('Erro ao atualizar predecessora.');
    } finally {
      setLoadingDocs(prev => ({ ...prev, [documentoId]: false }));
    }
  }, [localDocumentos, localPlanejamentos, handleLocalUpdate]);

  const handleDataInicioChange = useCallback(async (documentoId, novaDataStr) => {
    setLoadingDocs(prev => ({ ...prev, [documentoId]: true }));
    
    try {
      const documento = localDocumentos.find(d => d.id === documentoId);
      if (!documento) {
        return;
      }

      const novaDataInicio = parseDate(novaDataStr);
      if (!isValid(novaDataInicio)) {
        alert("Data de início inválida.");
        return;
      }

      let novaDataTermino = null;
      
      if (documento.tempo_total && documento.tempo_total > 0) {
        novaDataTermino = calculateEndDate(novaDataInicio, documento.tempo_total, 8);
      }

      const updateData = {
        inicio_planejado: novaDataStr
      };

      if (isValid(novaDataTermino)) {
        updateData.termino_planejado = format(novaDataTermino, 'yyyy-MM-dd');
      }

      const updatedDocFromAPI = await retryWithExtendedBackoff(() => Documento.update(documentoId, updateData), `setStartDate-${documentoId}`);

      handleLocalUpdate(updatedDocFromAPI);
      setCargaDiariaCache({});

    } catch (error) {
      console.error('Erro ao atualizar data de início:', error);
      alert('Erro ao atualizar data de início.');
    } finally {
      setLoadingDocs(prev => ({ ...prev, [documentoId]: false }));
    }
  }, [localDocumentos, handleLocalUpdate]);

  const filteredDocumentos = useMemo(() => {
    let filtered = localDocumentos.filter(doc =>
      (doc.numero?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
      (doc.arquivo?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
      (doc.descritivo?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );

    if (filtroArea !== "todas") {
      filtered = filtered.filter(doc => doc.pavimento_id === filtroArea);
    }

    return filtered.sort((a, b) => {
      const arquivoA = (a.arquivo || '').trim().toLowerCase();
      const arquivoB = (b.arquivo || '').trim().toLowerCase();

      return arquivoA.localeCompare(arquivoB, 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
        ignorePunctuation: false
      });
    });
  }, [localDocumentos, debouncedSearchTerm, filtroArea]);

  const documentosPorDisciplina = useMemo(() => {
    const grupos = {};
    
    filteredDocumentos.forEach(doc => {
      const disciplina = doc.disciplina || 'Sem Disciplina';
      if (!grupos[disciplina]) {
        grupos[disciplina] = [];
      }
      grupos[disciplina].push(doc);
    });

    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredDocumentos]);

  const etapasDisponiveis = useMemo(() => {
    return ['Estudo Preliminar', 'Ante-Projeto', 'Projeto Básico', 'Projeto Executivo', 'Liberado para Obra'];
  }, []);

  const usuariosOrdenados = useMemo(() => {
    return [...usuarios].sort((a, b) => {
      const nomeA = a.nome || a.full_name || a.email || '';
      const nomeB = b.nome || b.full_name || b.email || '';
      return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
    });
  }, [usuarios]);

  const handleExportTemplate = () => {
    const etapasDisponiveis = [
      "ESTUDO PRELIMINAR",
      "ANTE-PROJETO",
      "PROJETO BÁSICO",
      "PROJETO EXECUTIVO",
      "LIBERADO PARA OBRA"
    ];
    const revisoesDefault = ["R00", "R01", "R02"];

    let headers = ['numero', 'arquivo', 'descritivo', 'pavimento_nome', 'disciplinas', 'subdisciplinas', 'escala', 'fator_dificuldade'];

    etapasDisponiveis.forEach(etapa => {
      revisoesDefault.forEach(rev => {
        headers.push(`${etapa}_${rev}`);
      });
    });

    const csvContent = [
      headers.join(';'),
      [
        'ARQ-01',
        'Planta Baixa Terreo',
        'Planta baixa do pavimento terreo com layout de moveis',
        'Terreo',
        'Arquitetura',
        'Planta,Compat',
        '125',
        '1',
        ...etapasDisponiveis.flatMap(() => revisoesDefault.map(() => '15/01/2025'))
      ].join(';')
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_documentos_cadastro_${empreendimento.nome.replace(/\s+/g, '_')}.csv`;
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

      const separator = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(separator).map(h => h.trim());
      const requiredHeaders = ['numero', 'arquivo'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        alert(`Cabeçalhos obrigatórios faltando: ${missingHeaders.join(', ')}`);
        return;
      }

      const documentosParaImportar = [];
      const erros = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        if (!row.numero || !row.arquivo) {
          erros.push(`Linha ${i + 1}: Número e Arquivo são obrigatórios`);
          continue;
        }

        const pavimento = row.pavimento_nome 
          ? (pavimentos || []).find(p => p.nome?.toLowerCase() === row.pavimento_nome.toLowerCase())
          : null;

        const disciplinasArray = row.disciplinas 
          ? row.disciplinas.split(/[,;]/).map(s => s.trim()).filter(s => s)
          : [];

        const subdisciplinasArray = row.subdisciplinas 
          ? row.subdisciplinas.split(/[,;]/).map(s => s.trim()).filter(s => s)
          : [];

        const disciplinasValidas = disciplinasArray.filter(d => 
          disciplinas.some(disc => disc.nome === d)
        );

        if (disciplinasValidas.length === 0 && disciplinasArray.length > 0) {
          erros.push(`Linha ${i + 1}: Nenhuma disciplina válida encontrada em "${disciplinasArray.join(', ')}"`);
        }

        const datas = {};
        headers.forEach(header => {
          if (['numero', 'arquivo', 'descritivo', 'pavimento_nome', 'disciplinas', 'subdisciplinas', 'escala', 'fator_dificuldade'].includes(header)) {
            return;
          }

          const data = row[header];
          if (!data) return;

          const parts = header.split('_');
          if (parts.length < 2) return;

          const revisao = parts.pop();
          const etapa = parts.join('_');

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

        documentosParaImportar.push({
          numero: row.numero,
          arquivo: row.arquivo,
          descritivo: row.descritivo || '',
          disciplina: disciplinasValidas[0] || disciplinas[0]?.nome || '',
          disciplinas: disciplinasValidas.slice(0, 2),
          subdisciplinas: subdisciplinasArray,
          escala: row.escala ? parseFloat(row.escala) : null,
          fator_dificuldade: row.fator_dificuldade ? parseFloat(row.fator_dificuldade) : 1,
          pavimento_id: pavimento?.id || null,
          empreendimento_id: empreendimento.id,
          tempo_total: 0,
          tempo_concepcao: 0,
          tempo_planejamento: 0,
          tempo_estudo_preliminar: 0,
          tempo_ante_projeto: 0,
          tempo_projeto_basico: 0,
          tempo_projeto_executivo: 0,
          tempo_liberado_obra: 0,
          datas: Object.keys(datas).length > 0 ? datas : null
        });
      }

      if (erros.length > 0) {
        alert(`Erros encontrados:\n${erros.join('\n')}\n\nContinuar com os documentos válidos?`);
      }

      if (documentosParaImportar.length === 0) {
        alert('Nenhum documento válido encontrado no arquivo');
        return;
      }

      let sucessos = 0;
      let falhas = 0;
      const documentosCriados = [];

      for (const doc of documentosParaImportar) {
        try {
          const docCriado = await retryWithBackoff(() => Documento.create(doc), 3, 1000, `importDoc-${doc.numero}`);
          documentosCriados.push({ original: doc, criado: docCriado });
          sucessos++;
        } catch (error) {
          console.error(`Erro ao importar ${doc.numero}:`, error);
          falhas++;
        }
      }

      let sucessosCadastro = 0;
      let falhasCadastro = 0;

      for (const { original, criado } of documentosCriados) {
        if (original.datas && Object.keys(original.datas).length > 0) {
          try {
            await retryWithBackoff(() => DataCadastro.create({
              empreendimento_id: empreendimento.id,
              ordem: documentosCriados.indexOf(documentosCriados.find(d => d.criado.id === criado.id)),
              documento_id: criado.id,
              datas: original.datas
            }), 3, 1000, `importCadastro-${criado.id}`);
            sucessosCadastro++;
          } catch (error) {
            console.error(`Erro ao importar datas de ${original.numero}:`, error);
            falhasCadastro++;
          }
        }
      }

      let mensagem = `Importação concluída!\n\nDocumentos: ${sucessos} sucessos, ${falhas} falhas`;
      if (sucessosCadastro > 0 || falhasCadastro > 0) {
        mensagem += `\nDatas de Cadastro: ${sucessosCadastro} sucessos, ${falhasCadastro} falhas`;
      }

      alert(mensagem);

      if (sucessos > 0) {
        await onUpdate();
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

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Documentos ({filteredDocumentos.length})
            {readOnly && <Badge variant="outline" className="ml-2 text-xs">Somente Visualização</Badge>}
          </CardTitle>
          {!readOnly && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="border-green-500 text-green-600 hover:bg-green-50"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar
              </Button>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Documento
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {etapaParaPlanejamento !== "todas" && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">
                  Modo: Planejamento "{etapaParaPlanejamento}"
                </span>
              </div>
            </div>
          )}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={Object.keys(loadingDocs).some(id => loadingDocs[id])}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4 flex-1">
              <CardTitle>Documentos Cadastrados ({filteredDocumentos.length})</CardTitle>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="etapa-planejamento" className="text-sm font-medium whitespace-nowrap">
                    Planejar Etapa:
                  </Label>
                  <Select
                    value={etapaParaPlanejamento}
                    onValueChange={onEtapaChange}
                  >
                    <SelectTrigger id="etapa-planejamento" className="w-[180px]">
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as etapas</SelectItem>
                      {[...new Set(etapasDisponiveis)].map(etapa => (
                        <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="filtro-area" className="text-sm font-medium whitespace-nowrap">
                    Filtrar por Área:
                  </Label>
                  <Select
                    value={filtroArea}
                    onValueChange={setFiltroArea}
                  >
                    <SelectTrigger id="filtro-area" className="w-[180px]">
                      <SelectValue placeholder="Todas as áreas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as áreas</SelectItem>
                      {(pavimentos || []).map(pav => (
                        <SelectItem key={pav.id} value={pav.id}>{pav.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Carregando documentos...</span>
            </div>
          ) : filteredDocumentos.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Nenhum documento encontrado</p>
              <p className="text-gray-400 text-sm">
                {debouncedSearchTerm ? "Tente ajustar sua busca" : "Adicione documentos ao projeto para começar"}
              </p>
            </div>
          ) : (
           <div className="space-y-6">
              {documentosPorDisciplina.map(([disciplina, docs]) => {
                const isMinimizado = disciplinasMinimizadas[disciplina];
                return (
                <div key={disciplina} className="border rounded-lg overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                    onClick={() => setDisciplinasMinimizadas(prev => ({...prev, [disciplina]: !prev[disciplina]}))}
                  >
                    <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                      <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                      {disciplina}
                      <Badge variant="secondary" className="ml-2">
                        {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}
                      </Badge>
                    </h3>
                    <button className="p-1 hover:bg-blue-200 rounded transition-colors">
                      {isMinimizado ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                  {!isMinimizado && (
                  <div className="overflow-x-auto">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead className="w-[50px]"></TableHead>
                           <TableHead>Número</TableHead>
                           <TableHead>Arquivo</TableHead>
                           <TableHead>Descritivo</TableHead>
                           <TableHead>Subdisciplina</TableHead>
                           <TableHead>Escala</TableHead>
                           {!readOnly && <TableHead>Executor</TableHead>}
                           {!readOnly && <TableHead>Datas</TableHead>}
                           {!readOnly && <TableHead>Tempo</TableHead>}
                           {!readOnly && <TableHead className="w-[100px]">Ações</TableHead>}
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {docs.map(doc => (
                           <DocumentoItemRow
                             key={doc.id}
                             doc={doc}
                             planejamentos={localPlanejamentos}
                             allAtividades={allAtividades}
                             handleEdit={handleEdit}
                             handleDelete={handleDelete}
                             handleOpenDocEtapaModal={handleOpenDocEtapaModal}
                             handlePredecessoraChange={handlePredecessoraChange}
                             handleDataInicioChange={handleDataInicioChange}
                             etapaParaPlanejamento={etapaParaPlanejamento}
                             loadingDocs={loadingDocs}
                             empreendimento={empreendimento}
                             onUpdate={onUpdate}
                             readOnly={readOnly}
                             pavimentos={pavimentos}
                             usuarios={usuariosOrdenados}
                             localDocumentos={localDocumentos}
                             expandedRows={expandedRows}
                             toggleRow={toggleRow}
                             setCargaDiariaCache={setCargaDiariaCache}
                             localPlanejamentos={localPlanejamentos}
                             setLocalPlanejamentos={setLocalPlanejamentos}
                           />
                         ))}
                       </TableBody>
                     </Table>
                   </div>
                   )}
                 </div>
                 );
               })}
             </div>
           )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {showForm && (
          <DocumentoForm
            doc={editingDocumento}
            empreendimentoId={empreendimento.id}
            empreendimentoNome={empreendimento.nome}
            onClose={() => {
              setShowForm(false);
              setEditingDocumento(null);
            }}
            onSave={handleSuccess}
            disciplinas={disciplinas}
            atividades={allAtividades}
            pavimentos={pavimentos}
            documentos={localDocumentos}
          />
        )}
      </AnimatePresence>

      {isDocEtapaModalOpen && documentForDocEtapaModal && (
        <PlanejamentoDocumentoEtapaModal
          documento={documentForDocEtapaModal}
          usuarios={usuariosOrdenados}
          empreendimentoId={empreendimento.id}
          allAtividades={allAtividades}
          executorPadrao={executorPreSelecionado}
          etapaParaPlanejamento={etapaParaPlanejamento}
          isOpen={isDocEtapaModalOpen}
          onClose={handleCloseDocEtapaModal}
          onSuccess={handleSaveDocEtapaPlanning}
        />
      )}

      {isDocDataModalOpen && documentForDocDataModal && (
        <PlanejamentoDocumentoDataModal
          documento={documentForDocDataModal}
          documentos={localDocumentos}
          planejamentosDoc={localPlanejamentos}
          isOpen={isDocDataModalOpen}
          onClose={() => {
            setIsDocDataModalOpen(false);
            setDocumentForDocDataModal(null);
          }}
          onSuccess={() => {
            onUpdate();
            setIsDocDataModalOpen(false);
            setDocumentForDocDataModal(null);
          }}
        />
      )}

      {showAtividadeForm && (
        <AtividadeFormModal
          isOpen={showAtividadeForm}
          onClose={() => {
            setShowAtividadeForm(false);
            setEditingAtividade(null);
          }}
          empreendimentoId={empreendimento.id}
          disciplinas={disciplinas}
          atividade={editingAtividade}
          onSuccess={handleAtividadeSuccess}
        />
      )}

      {showImportModal && (
        <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Documentos</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">📋 Instruções</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Envie um arquivo CSV com os documentos</li>
                  <li>• Colunas obrigatórias: <code className="bg-white px-1 rounded">numero</code>, <code className="bg-white px-1 rounded">arquivo</code></li>
                  <li>• Colunas opcionais: <code className="bg-white px-1 rounded">descritivo</code>, <code className="bg-white px-1 rounded">pavimento_nome</code>, <code className="bg-white px-1 rounded">disciplinas</code>, <code className="bg-white px-1 rounded">subdisciplinas</code>, <code className="bg-white px-1 rounded">escala</code>, <code className="bg-white px-1 rounded">fator_dificuldade</code></li>
                  <li>• Múltiplas disciplinas/subdisciplinas devem ser separadas por <code className="bg-white px-1 rounded">,</code> ou <code className="bg-white px-1 rounded">;</code> (ex: Arquitetura,Hidráulica)</li>
                  <li>• Máximo de 2 disciplinas por documento</li>
                  <li>• Colunas de datas no formato <code className="bg-white px-1 rounded">ETAPA_REVISAO</code> (ex: ESTUDO PRELIMINAR_R00)</li>
                  <li>• Formato de data: <code className="bg-white px-1 rounded">DD/MM/AAAA</code> (ex: 15/01/2025)</li>
                  <li>• O pavimento_nome deve corresponder ao nome exato de um pavimento já cadastrado</li>
                  <li>• Baixe o template para ver exemplos completos</li>
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
      )}
    </div>
  );
}