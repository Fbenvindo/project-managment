import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  useEffect(() => {
    if (empreendimento?.id) {
      loadData();
    }
  }, [empreendimento]);

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
      
      setDocumentos(docs || []);
      
      if (data && data.length > 0) {
        const sortedData = data.sort((a, b) => a.ordem - b.ordem);
        setLinhas(sortedData);
        
        // Detectar revisões existentes
        const revisoesSet = new Set(["R00", "R01", "R02"]);
        sortedData.forEach(linha => {
          if (linha.datas) {
            Object.values(linha.datas).forEach(etapaData => {
              if (etapaData && typeof etapaData === 'object') {
                Object.keys(etapaData).forEach(rev => revisoesSet.add(rev));
              }
            });
          }
        });
        setRevisoes(Array.from(revisoesSet).sort());
      } else {
        // Criar 10 linhas vazias iniciais
        const novasLinhas = Array.from({ length: 10 }, (_, i) => ({
          id: `temp-${i}`,
          empreendimento_id: empreendimento.id,
          ordem: i,
          documento_id: '',
          datas: {},
          isNew: true
        }));
        setLinhas(novasLinhas);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLinha = () => {
    const novaLinha = {
      id: `temp-${Date.now()}`,
      empreendimento_id: empreendimento.id,
      ordem: linhas.length,
      documento_id: '',
      datas: {},
      isNew: true
    };
    setLinhas([...linhas, novaLinha]);
  };

  const handleRemoveLinha = async (id, ordem) => {
    if (!confirm('Deseja remover esta linha?')) return;
    
    try {
      if (!id.toString().startsWith('temp-')) {
        await retryWithBackoff(
          () => DataCadastro.delete(id),
          3, 2000,
          `deleteDataCadastro-${id}`
        );
      }
      setLinhas(prev => prev.filter(l => l.id !== id).map((l, idx) => ({ ...l, ordem: idx })));
    } catch (error) {
      console.error('Erro ao remover linha:', error);
      alert('Erro ao remover linha.');
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

  const handleUpdateDocumento = (linhaId, documentoId) => {
    setLinhas(prev => prev.map(linha => 
      linha.id === linhaId ? { ...linha, documento_id: documentoId } : linha
    ));
  };

  const handleAddRevisaoParaFolha = (linhaId) => {
    const ultimaRevisao = revisoes[revisoes.length - 1];
    const numero = parseInt(ultimaRevisao.substring(1)) + 1;
    const novaRevisao = `R${String(numero).padStart(2, '0')}`;
    setRevisoes([...revisoes, novaRevisao]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const linha of linhas) {
        const linhaData = {
          empreendimento_id: empreendimento.id,
          ordem: linha.ordem,
          documento_id: linha.documento_id || '',
          datas: linha.datas || {}
        };

        if (linha.isNew || linha.id.toString().startsWith('temp-')) {
          await retryWithBackoff(
            () => DataCadastro.create(linhaData),
            3, 2000,
            'createDataCadastro'
          );
        } else {
          await retryWithBackoff(
            () => DataCadastro.update(linha.id, linhaData),
            3, 2000,
            `updateDataCadastro-${linha.id}`
          );
        }
      }
      
      await loadData();
      alert('Dados salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar dados.');
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Datas de Cadastro</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddRevisao}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Revisão
          </Button>
          <Button variant="outline" onClick={handleAddLinha}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Linha
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-blue-100 p-2 sticky left-0 z-10 w-12">Linha</th>
              <th className="border border-gray-300 bg-blue-100 p-2 w-48">Folha</th>
              {ETAPAS.map((etapa) => (
                <th
                  key={etapa}
                  colSpan={revisoes.length}
                  className="border border-gray-300 bg-blue-200 p-2 text-center font-semibold"
                >
                  Datas de cadastro:<br />{etapa}
                </th>
              ))}
              <th className="border border-gray-300 bg-blue-100 p-2 w-16">Ações</th>
            </tr>
            <tr>
              <th className="border border-gray-300 bg-blue-50 p-2 sticky left-0 z-10"></th>
              <th className="border border-gray-300 bg-blue-50 p-2"></th>
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
              <th className="border border-gray-300 bg-blue-50 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, idx) => (
              <tr key={linha.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-1 text-center sticky left-0 bg-white z-10 font-medium">
                  {idx + 1}
                </td>
                <td className="border border-gray-300 p-1">
                  <div className="flex items-center gap-1">
                    <Select
                      value={linha.documento_id || ''}
                      onValueChange={(value) => handleUpdateDocumento(linha.id, value)}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Selecione a folha" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Sem folha</SelectItem>
                        {documentos.map(doc => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.arquivo || doc.numero}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleAddRevisaoParaFolha(linha.id)}
                      className="h-8 w-8 flex-shrink-0"
                      title="Adicionar nova revisão"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
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
                <td className="border border-gray-300 p-1 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveLinha(linha.id, linha.ordem)}
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}