import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
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

export default function CadastroTab({ empreendimento }) {
  const [revisoes, setRevisoes] = useState(["R00", "R01", "R02"]);
  const [linhas, setLinhas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimeoutRef = useRef(null);

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
      
      const sortedDocs = (docs || []).sort((a, b) => {
        const numA = parseInt(a.numero) || 0;
        const numB = parseInt(b.numero) || 0;
        return numA - numB;
      });
      setDocumentos(sortedDocs);
      
      // Criar um mapa de dados existentes por documento_id
      const dataMap = new Map();
      if (data && data.length > 0) {
        data.forEach(item => {
          if (item.documento_id) {
            dataMap.set(item.documento_id, item);
          }
        });
        
        // Detectar revisões existentes
        const revisoesSet = new Set(["R00", "R01", "R02"]);
        data.forEach(linha => {
          if (linha.datas) {
            Object.values(linha.datas).forEach(etapaData => {
              if (etapaData && typeof etapaData === 'object') {
                Object.keys(etapaData).forEach(rev => revisoesSet.add(rev));
              }
            });
          }
        });
        setRevisoes(Array.from(revisoesSet).sort());
      }
      
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



  const handleAddRevisao = () => {
    const ultimaRevisao = revisoes[revisoes.length - 1];
    const numero = parseInt(ultimaRevisao.substring(1)) + 1;
    const novaRevisao = `R${String(numero).padStart(2, '0')}`;
    setRevisoes([...revisoes, novaRevisao]);
  };

  const handleRemoveRevisao = (revisao) => {
    if (revisoes.length <= 1) {
      alert('Deve haver ao menos uma revisão.');
      return;
    }
    
    if (!confirm(`Deseja excluir a revisão ${revisao}? Os dados desta revisão serão perdidos.`)) return;
    
    setRevisoes(prev => prev.filter(r => r !== revisao));
    
    // Limpar dados da revisão removida
    setLinhas(prev => prev.map(linha => {
      const novasDatas = { ...linha.datas };
      Object.keys(novasDatas).forEach(etapa => {
        if (novasDatas[etapa] && novasDatas[etapa][revisao]) {
          delete novasDatas[etapa][revisao];
        }
      });
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
      novasDatas[etapa][revisao] = valor;
      
      return { ...linha, datas: novasDatas };
    }));
  };



  const handleSave = async (silent = false) => {
    setIsSaving(true);
    try {
      // Filtrar apenas linhas que têm dados para salvar
      const linhasParaSalvar = linhas.filter(linha => {
        if (!linha.documento_id) return false;
        
        // Verificar se há alguma data preenchida
        const temDados = linha.datas && Object.values(linha.datas).some(etapaData => {
          return etapaData && Object.values(etapaData).some(data => data && data.trim());
        });
        
        return temDados;
      });

      // Processar em lotes de 10 para evitar sobrecarga
      const BATCH_SIZE = 10;
      let successCount = 0;
      let errorCount = 0;
      const updatedLinhas = new Map();

      for (let i = 0; i < linhasParaSalvar.length; i += BATCH_SIZE) {
        const batch = linhasParaSalvar.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (linha) => {
          const linhaData = {
            empreendimento_id: empreendimento.id,
            ordem: linha.ordem,
            documento_id: linha.documento_id,
            datas: linha.datas || {}
          };

          if (linha.isNew || linha.id.toString().startsWith('temp-')) {
            return { linha, result: await DataCadastro.create(linhaData) };
          } else {
            return { linha, result: await DataCadastro.update(linha.id, linhaData) };
          }
        });

        const results = await Promise.allSettled(batchPromises);
        
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            successCount++;
            updatedLinhas.set(batch[idx].id, result.value.result);
          } else {
            errorCount++;
            console.error(`Erro na linha ${batch[idx].id}:`, result.reason);
          }
        });

        // Pequeno delay entre lotes
        if (i + BATCH_SIZE < linhasParaSalvar.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
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
    return linha.datas?.[etapa]?.[revisao] || '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">Datas de Cadastro</h2>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              Salvando automaticamente...
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddRevisao}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Revisão
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Botão flutuante de salvar */}
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

      <div className="bg-white rounded-lg shadow overflow-x-auto max-w-full">
        <table className="w-full border-collapse text-sm min-w-max">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-blue-100 p-2 sticky left-0 z-10 w-48 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">Folha</th>
              {ETAPAS.map((etapa) => (
                <th
                  key={etapa}
                  colSpan={revisoes.length}
                  className="border border-gray-300 bg-blue-200 p-2 text-center font-semibold"
                >
                  Datas de cadastro:<br />{etapa}
                </th>
              ))}
            </tr>
            <tr>
              <th className="border border-gray-300 bg-blue-50 p-2 sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"></th>
              {ETAPAS.map((etapa, etapaIdx) => (
                <React.Fragment key={`rev-${etapa}`}>
                  {revisoes.map((revisao, revIdx) => (
                    <th
                      key={`${etapa}-${revisao}`}
                      className={`border border-gray-300 bg-blue-50 p-2 text-center font-medium ${
                        revIdx === revisoes.length - 1 && etapaIdx < ETAPAS.length - 1 ? 'border-r-4 border-r-gray-400' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{revisao}</span>
                        <button
                          onClick={() => handleRemoveRevisao(revisao)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                          title="Excluir revisão"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={revisoes.length * ETAPAS.length + 1} className="border border-gray-300 p-8 text-center text-gray-500">
                  Nenhum documento cadastrado neste empreendimento. Cadastre documentos na aba "Documentos" primeiro.
                </td>
              </tr>
            ) : (
              linhas.map((linha, idx) => {
                const doc = documentos.find(d => d.id === linha.documento_id);
                return (
                  <tr key={linha.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-2 sticky left-0 bg-white z-10 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      {doc?.arquivo || doc?.numero || 'Sem folha'}
                    </td>
                    {ETAPAS.map((etapa, etapaIdx) => (
                      <React.Fragment key={`${linha.id}-${etapa}`}>
                        {revisoes.map((revisao, revIdx) => (
                          <td 
                            key={`${linha.id}-${etapa}-${revisao}`} 
                            className={`border border-gray-300 p-1 ${
                              revIdx === revisoes.length - 1 && etapaIdx < ETAPAS.length - 1 ? 'border-r-4 border-r-gray-400' : ''
                            }`}
                          >
                            <Input
                              type="date"
                              value={getDataValue(linha, etapa, revisao)}
                              onChange={(e) => handleUpdateData(linha.id, etapa, revisao, e.target.value)}
                              className="h-8 text-xs w-full"
                            />
                          </td>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}