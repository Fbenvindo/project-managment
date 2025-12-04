import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Grid3x3, DollarSign } from "lucide-react";

export default function GestaoTab({ empreendimento, documentos, planejamentos, atividades, usuarios, execucoes, onUpdate, pavimentos = [] }) {
  const [valorHora, setValorHora] = useState(0);

  // Função para formatar valor em reais
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Calcular matriz Disciplinas x Etapas
  const matrizDisciplinasEtapas = useMemo(() => {
    const etapasOrdenadas = [
      'Estudo Preliminar',
      'Ante-Projeto', 
      'Projeto Básico',
      'Projeto Executivo',
      'Liberado para Obra'
    ];

    console.log('🔍 [GestaoTab] Documentos:', documentos.length);
    console.log('🔍 [GestaoTab] Atividades totais:', atividades.length);

    // Extrair disciplinas únicas dos documentos
    const disciplinasSet = new Set();
    documentos.forEach(doc => {
      if (doc.disciplina) disciplinasSet.add(doc.disciplina);
    });
    const disciplinas = Array.from(disciplinasSet).sort();

    console.log('📊 [GestaoTab] Disciplinas encontradas:', disciplinas);

    // Criar matriz
    // A matriz ainda será {disciplina: {etapa: {horasPlanejadas, horasExecutadas}}}
    // A inversão é apenas na forma como é exibida
    const matriz = {};
    
    disciplinas.forEach(disciplina => {
      matriz[disciplina] = {};
      etapasOrdenadas.forEach(etapa => {
        matriz[disciplina][etapa] = {
          horasPlanejadas: 0,
          horasExecutadas: 0
        };
      });
    });

    // Criar mapa de pavimentos para buscar área
    const pavimentosMap = {};
    (pavimentos || []).forEach(pav => {
      pavimentosMap[pav.id] = pav;
    });

    // Para cada documento, buscar atividades aplicáveis e somar horas
    documentos.forEach(doc => {
      const disciplinaDoc = doc.disciplina;
      const subdisciplinasDoc = doc.subdisciplinas || [];
      const fatorDificuldade = doc.fator_dificuldade || 1;
      
      // Buscar área do pavimento vinculado, senão usar área do documento, senão 1
      let areaPavimento = 1;
      if (doc.pavimento_id && pavimentosMap[doc.pavimento_id]) {
        areaPavimento = parseFloat(pavimentosMap[doc.pavimento_id].area) || 1;
      } else if (doc.area) {
        areaPavimento = parseFloat(doc.area) || 1;
      }

      console.log(`📄 [GestaoTab] Processando documento ${doc.numero}:`, {
        disciplina: disciplinaDoc,
        subdisciplinas: subdisciplinasDoc,
        fatorDificuldade,
        areaPavimento,
        pavimento_id: doc.pavimento_id
      });

      // Buscar atividades globais que se aplicam a este documento
      const atividadesAplicaveis = atividades.filter(ativ => {
        // Apenas atividades do catálogo geral (sem empreendimento_id)
        const isGlobal = !ativ.empreendimento_id;
        const disciplinaMatch = ativ.disciplina === disciplinaDoc;
        const subdisciplinaMatch = subdisciplinasDoc.includes(ativ.subdisciplina);
        
        return isGlobal && disciplinaMatch && subdisciplinaMatch;
      });

      console.log(`  ✅ Atividades aplicáveis: ${atividadesAplicaveis.length}`);

      // Para cada atividade aplicável, somar horas na matriz
      atividadesAplicaveis.forEach(ativ => {
        const etapa = ativ.etapa;
        const tempoBase = parseFloat(ativ.tempo) || 0;
        
        // Atividades de "Apoio" são multiplicadas por 1 (por folha), não pela área
        // Exemplo: "Carimbo, nota e legenda" é 0.2h por folha
        const isAtividadeApoio = ativ.subdisciplina === 'Apoio';
        
        let tempoPlanejado;
        if (isAtividadeApoio) {
          // Para atividades de Apoio: tempo × fator de dificuldade (1 folha = 1 unidade)
          tempoPlanejado = tempoBase * fatorDificuldade;
          console.log(`    💡 ${ativ.atividade} [${etapa}] (Apoio/Folha): ${tempoBase}h × ${fatorDificuldade} = ${tempoPlanejado.toFixed(1)}h`);
        } else {
          // Para demais atividades: tempo × área × fator de dificuldade
          tempoPlanejado = tempoBase * areaPavimento * fatorDificuldade;
          console.log(`    💡 ${ativ.atividade} [${etapa}]: ${tempoBase}h/m² × ${areaPavimento}m² × ${fatorDificuldade} = ${tempoPlanejado.toFixed(1)}h`);
        }

        if (matriz[disciplinaDoc] && matriz[disciplinaDoc][etapa]) {
          matriz[disciplinaDoc][etapa].horasPlanejadas += tempoPlanejado;
        }
      });

      // Buscar tempo executado diretamente dos planejamentos deste documento
      const planejamentosDoDocumento = planejamentos.filter(p => p.documento_id === doc.id);
      
      planejamentosDoDocumento.forEach(plano => {
        const etapa = plano.etapa;
        const tempoExecutado = plano.tempo_executado || 0;

        if (matriz[disciplinaDoc] && matriz[disciplinaDoc][etapa]) {
          matriz[disciplinaDoc][etapa].horasExecutadas += tempoExecutado;
        }
      });
    });

    console.log('📊 [GestaoTab] Matriz preenchida:', matriz);

    // Calcular totais por disciplina
    const totaisPorDisciplina = {};
    disciplinas.forEach(disciplina => {
      let totalPlanejado = 0;
      let totalExecutado = 0;
      etapasOrdenadas.forEach(etapa => {
        if (matriz[disciplina] && matriz[disciplina][etapa]) {
          totalPlanejado += matriz[disciplina][etapa].horasPlanejadas;
          totalExecutado += matriz[disciplina][etapa].horasExecutadas;
        }
      });
      totaisPorDisciplina[disciplina] = {
        planejado: totalPlanejado,
        executado: totalExecutado,
        percentual: totalPlanejado > 0 ? Math.round((totalExecutado / totalPlanejado) * 100) : 0
      };
    });

    // Calcular totais por etapa
    const totaisPorEtapa = {};
    etapasOrdenadas.forEach(etapa => {
      let totalPlanejado = 0;
      let totalExecutado = 0;
      disciplinas.forEach(disciplina => {
        if (matriz[disciplina] && matriz[disciplina][etapa]) {
          totalPlanejado += matriz[disciplina][etapa].horasPlanejadas;
          totalExecutado += matriz[disciplina][etapa].horasExecutadas;
        }
      });
      totaisPorEtapa[etapa] = {
        planejado: totalPlanejado,
        executado: totalExecutado,
        percentual: totalPlanejado > 0 ? Math.round((totalExecutado / totalPlanejado) * 100) : 0
      };
    });

    // Calcular total geral
    let totalGeralPlanejado = 0;
    let totalGeralExecutado = 0;
    disciplinas.forEach(disciplina => {
      totalGeralPlanejado += totaisPorDisciplina[disciplina].planejado;
      totalGeralExecutado += totaisPorDisciplina[disciplina].executado;
    });
    // Can also calculate from totaisPorEtapa:
    // etapasOrdenadas.forEach(etapa => {
    //   totalGeralPlanejado += totaisPorEtapa[etapa].planejado;
    //   totalGeralExecutado += totaisPorEtapa[etapa].executado;
    // });


    return {
      matriz,
      disciplinas,
      etapas: etapasOrdenadas,
      totaisPorDisciplina,
      totaisPorEtapa,
      totalGeral: {
        planejado: totalGeralPlanejado,
        executado: totalGeralExecutado,
        percentual: totalGeralPlanejado > 0 ? Math.round((totalGeralExecutado / totalGeralPlanejado) * 100) : 0
      }
    };
  }, [documentos, atividades, planejamentos, execucoes]);

  return (
    <div className="space-y-6">
      {/* Campo de Valor por Hora */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Configuração de Valor Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="valorHora" className="text-sm font-medium">Valor por Hora (R$/h)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                <Input
                  id="valorHora"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorHora || ''}
                  onChange={(e) => setValorHora(parseFloat(e.target.value) || 0)}
                  className="pl-10"
                  placeholder="0,00"
                />
              </div>
            </div>
            {valorHora > 0 && (
              <div className="text-sm text-gray-600 mt-6">
                <span className="font-medium">Total Planejado:</span> {formatCurrency(matrizDisciplinasEtapas.totalGeral.planejado * valorHora)} | 
                <span className="font-medium ml-2">Total Executado:</span> {formatCurrency(matrizDisciplinasEtapas.totalGeral.executado * valorHora)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="w-5 h-5 text-blue-600" />
            Matriz de Horas: Etapas x Disciplinas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-left font-semibold sticky left-0 bg-gray-100 z-10">
                    Etapa / Disciplina
                  </th>
                  <th className="border border-gray-300 p-3 text-center font-semibold bg-blue-50">
                    TOTAL
                  </th>
                  {matrizDisciplinasEtapas.disciplinas.map(disciplina => (
                    <th key={disciplina} className="border border-gray-300 p-3 text-center font-semibold">
                      {disciplina}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-2 text-xs text-gray-600 sticky left-0 bg-gray-50 z-10"></th>
                  <th className="border border-gray-300 p-2 text-xs text-gray-600 bg-blue-50">%</th>
                  {matrizDisciplinasEtapas.disciplinas.map(disciplina => (
                    <th key={disciplina} className="border border-gray-300 p-2 text-xs text-gray-600">Planejado</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Linha TOTAL */}
                <tr className="bg-blue-50 font-semibold">
                  <td className="border border-gray-300 p-3 sticky left-0 bg-blue-100 z-10">TOTAL</td>
                  <td className="border border-gray-300 p-3 text-center">
                    {matrizDisciplinasEtapas.totalGeral.percentual}%
                  </td>
                  {matrizDisciplinasEtapas.disciplinas.map(disciplina => {
                    const horas = matrizDisciplinasEtapas.totaisPorDisciplina[disciplina].planejado;
                    return (
                      <td key={disciplina} className="border border-gray-300 p-3 text-center">
                        <div>{horas.toFixed(1)}h</div>
                        {valorHora > 0 && (
                          <div className="text-xs text-green-700 font-normal">{formatCurrency(horas * valorHora)}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Linhas de Etapas */}
                {matrizDisciplinasEtapas.etapas.map((etapa, idx) => (
                  <tr key={etapa} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 p-3 font-medium sticky left-0 bg-inherit z-10">
                      {etapa}
                    </td>
                    <td className="border border-gray-300 p-3 text-center font-semibold">
                      {matrizDisciplinasEtapas.totaisPorEtapa[etapa].percentual}%
                    </td>
                    {matrizDisciplinasEtapas.disciplinas.map(disciplina => {
                      const dados = matrizDisciplinasEtapas.matriz[disciplina][etapa];
                      const temDados = dados.horasPlanejadas > 0;
                      
                      return (
                        <td key={disciplina} className={`border border-gray-300 p-3 text-center ${!temDados ? 'text-gray-400' : ''}`}>
                          <div>{dados.horasPlanejadas > 0 ? dados.horasPlanejadas.toFixed(1) : '0'}</div>
                          {valorHora > 0 && dados.horasPlanejadas > 0 && (
                            <div className="text-xs text-green-700">{formatCurrency(dados.horasPlanejadas * valorHora)}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {matrizDisciplinasEtapas.disciplinas.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum dado disponível para exibir a matriz.</p>
              <p className="text-sm mt-2">Cadastre documentos com disciplinas para visualizar as informações.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Horas Reais Executadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="w-5 h-5 text-green-600" />
            Horas Reais Executadas por Etapa e Disciplina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-left font-semibold sticky left-0 bg-gray-100 z-10">
                    Etapa / Disciplina
                  </th>
                  <th className="border border-gray-300 p-3 text-center font-semibold bg-green-50">
                    TOTAL
                  </th>
                  {matrizDisciplinasEtapas.disciplinas.map(disciplina => (
                    <th key={disciplina} className="border border-gray-300 p-3 text-center font-semibold">
                      {disciplina}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Linha TOTAL */}
                <tr className="bg-green-50 font-semibold">
                  <td className="border border-gray-300 p-3 sticky left-0 bg-green-100 z-10">TOTAL</td>
                  <td className="border border-gray-300 p-3 text-center">
                    <div>{matrizDisciplinasEtapas.totalGeral.executado.toFixed(1)}h</div>
                    {valorHora > 0 && (
                      <div className="text-xs text-green-700 font-normal">{formatCurrency(matrizDisciplinasEtapas.totalGeral.executado * valorHora)}</div>
                    )}
                  </td>
                  {matrizDisciplinasEtapas.disciplinas.map(disciplina => {
                    const horas = matrizDisciplinasEtapas.totaisPorDisciplina[disciplina].executado;
                    return (
                      <td key={disciplina} className="border border-gray-300 p-3 text-center">
                        <div>{horas.toFixed(1)}h</div>
                        {valorHora > 0 && horas > 0 && (
                          <div className="text-xs text-green-700 font-normal">{formatCurrency(horas * valorHora)}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Linhas de Etapas */}
                {matrizDisciplinasEtapas.etapas.map((etapa, idx) => (
                  <tr key={etapa} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 p-3 font-medium sticky left-0 bg-inherit z-10">
                      {etapa}
                    </td>
                    <td className="border border-gray-300 p-3 text-center font-semibold">
                      <div>{matrizDisciplinasEtapas.totaisPorEtapa[etapa].executado.toFixed(1)}h</div>
                      {valorHora > 0 && matrizDisciplinasEtapas.totaisPorEtapa[etapa].executado > 0 && (
                        <div className="text-xs text-green-700 font-normal">{formatCurrency(matrizDisciplinasEtapas.totaisPorEtapa[etapa].executado * valorHora)}</div>
                      )}
                    </td>
                    {matrizDisciplinasEtapas.disciplinas.map(disciplina => {
                      const dados = matrizDisciplinasEtapas.matriz[disciplina][etapa];
                      const temDados = dados.horasExecutadas > 0;
                      
                      return (
                        <td 
                          key={disciplina} 
                          className={`border border-gray-300 p-3 text-center ${
                            temDados ? 'font-medium text-green-700' : 'text-gray-400'
                          }`}
                        >
                          <div>{dados.horasExecutadas > 0 ? dados.horasExecutadas.toFixed(1) : '0'}</div>
                          {valorHora > 0 && dados.horasExecutadas > 0 && (
                            <div className="text-xs">{formatCurrency(dados.horasExecutadas * valorHora)}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {matrizDisciplinasEtapas.disciplinas.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum dado executado disponível.</p>
              <p className="text-sm mt-2">Execute atividades para visualizar as horas reais.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}