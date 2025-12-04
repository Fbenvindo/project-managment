import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Users, Calendar } from "lucide-react";
import { format, addDays, startOfWeek, eachDayOfInterval, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

// Cores para empreendimentos
const CORES_EMPREENDIMENTOS = [
  'bg-yellow-200 text-yellow-900',
  'bg-blue-200 text-blue-900',
  'bg-green-200 text-green-900',
  'bg-purple-200 text-purple-900',
  'bg-pink-200 text-pink-900',
  'bg-orange-200 text-orange-900',
  'bg-teal-200 text-teal-900',
  'bg-indigo-200 text-indigo-900',
  'bg-red-200 text-red-900',
  'bg-cyan-200 text-cyan-900',
];

export default function MatrizColaboradores({ 
  planejamentos = [], 
  usuarios = [], 
  empreendimentos = [] 
}) {
  const [dataInicio, setDataInicio] = useState(() => startOfWeek(new Date(), { locale: ptBR }));
  const [diasExibidos, setDiasExibidos] = useState(14);

  // Gerar array de datas
  const datas = useMemo(() => {
    return eachDayOfInterval({
      start: dataInicio,
      end: addDays(dataInicio, diasExibidos - 1)
    });
  }, [dataInicio, diasExibidos]);

  // Mapa de cores por empreendimento
  const coresEmpreendimentos = useMemo(() => {
    const mapa = {};
    empreendimentos.forEach((emp, index) => {
      mapa[emp.id] = CORES_EMPREENDIMENTOS[index % CORES_EMPREENDIMENTOS.length];
    });
    return mapa;
  }, [empreendimentos]);

  // Mapa de nomes de empreendimentos
  const nomesEmpreendimentos = useMemo(() => {
    const mapa = {};
    empreendimentos.forEach(emp => {
      // Extrair número do empreendimento se existir, senão usar primeiras 3 letras
      const nome = emp.nome || '';
      const match = nome.match(/\d+/);
      mapa[emp.id] = match ? match[0] : nome.substring(0, 3).toUpperCase();
    });
    return mapa;
  }, [empreendimentos]);

  // Agrupar usuários por equipe/função
  const usuariosAgrupados = useMemo(() => {
    const grupos = {};
    
    // Ordenar usuários por cargo/departamento
    const usuariosOrdenados = [...usuarios]
      .filter(u => u.status === 'ativo' && (u.nome || u.full_name))
      .sort((a, b) => {
        const cargoA = a.cargo || a.departamento || 'Outros';
        const cargoB = b.cargo || b.departamento || 'Outros';
        return cargoA.localeCompare(cargoB, 'pt-BR');
      });

    usuariosOrdenados.forEach(usuario => {
      const grupo = usuario.departamento || usuario.cargo || 'Equipe Geral';
      if (!grupos[grupo]) {
        grupos[grupo] = [];
      }
      grupos[grupo].push(usuario);
    });

    return grupos;
  }, [usuarios]);

  // Calcular alocações por usuário e data
  const alocacoesPorUsuarioData = useMemo(() => {
    const mapa = {};

    planejamentos.forEach(plan => {
      const executor = plan.executor_principal;
      if (!executor) return;

      // Verificar horas_por_dia
      if (plan.horas_por_dia && typeof plan.horas_por_dia === 'object') {
        Object.entries(plan.horas_por_dia).forEach(([data, horas]) => {
          if (Number(horas) > 0) {
            const chave = `${executor}|${data}`;
            if (!mapa[chave]) {
              mapa[chave] = [];
            }
            mapa[chave].push({
              empreendimento_id: plan.empreendimento_id,
              horas: Number(horas),
              tipo: 'planejado'
            });
          }
        });
      }
    });

    return mapa;
  }, [planejamentos]);

  // Navegar entre períodos
  const navegarPeriodo = (direcao) => {
    setDataInicio(prev => addDays(prev, direcao * diasExibidos));
  };

  const irParaHoje = () => {
    setDataInicio(startOfWeek(new Date(), { locale: ptBR }));
  };

  // Renderizar célula de alocação
  const renderizarCelula = (usuarioEmail, data) => {
    const dataKey = format(data, 'yyyy-MM-dd');
    const chave = `${usuarioEmail}|${dataKey}`;
    const alocacoes = alocacoesPorUsuarioData[chave] || [];

    if (alocacoes.length === 0) {
      return <td key={dataKey} className="border border-gray-300 p-1 text-center bg-white"></td>;
    }

    // Agrupar por empreendimento
    const porEmpreendimento = {};
    alocacoes.forEach(aloc => {
      const empId = aloc.empreendimento_id || 'sem-emp';
      if (!porEmpreendimento[empId]) {
        porEmpreendimento[empId] = 0;
      }
      porEmpreendimento[empId] += aloc.horas;
    });

    const empIds = Object.keys(porEmpreendimento);
    
    return (
      <td key={dataKey} className="border border-gray-300 p-0 text-center">
        <div className="flex flex-col gap-0.5 p-0.5">
          {empIds.map(empId => {
            const cor = coresEmpreendimentos[empId] || 'bg-gray-200 text-gray-800';
            const codigo = nomesEmpreendimentos[empId] || '?';
            return (
              <div 
                key={empId}
                className={`text-xs font-bold px-1 py-0.5 rounded ${cor}`}
                title={empreendimentos.find(e => e.id === empId)?.nome || 'Sem empreendimento'}
              >
                {codigo}
              </div>
            );
          })}
        </div>
      </td>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Matriz de Alocação de Colaboradores
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={diasExibidos.toString()} onValueChange={(v) => setDiasExibidos(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="21">21 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="sm" onClick={() => navegarPeriodo(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={irParaHoje}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => navegarPeriodo(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Legenda de empreendimentos */}
        <div className="flex flex-wrap gap-2 mt-4">
          {empreendimentos.map(emp => (
            <Badge 
              key={emp.id} 
              className={`${coresEmpreendimentos[emp.id]} text-xs`}
            >
              {nomesEmpreendimentos[emp.id]} - {emp.nome}
            </Badge>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-max">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-600 p-2 text-left sticky left-0 bg-gray-800 z-10 min-w-[180px]">
                Nome
              </th>
              <th className="border border-gray-600 p-2 text-center min-w-[80px]">
                Função
              </th>
              {datas.map(data => {
                const isWeekend = data.getDay() === 0 || data.getDay() === 6;
                const isToday = format(data, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <th 
                    key={format(data, 'yyyy-MM-dd')} 
                    className={`border border-gray-600 p-1 text-center min-w-[50px] ${
                      isWeekend ? 'bg-gray-600' : ''
                    } ${isToday ? 'bg-blue-700' : ''}`}
                  >
                    <div className="text-xs">{format(data, 'd/MM', { locale: ptBR })}</div>
                    <div className="text-xs opacity-75">{format(data, 'EEE', { locale: ptBR })}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Object.entries(usuariosAgrupados).map(([grupo, usuariosGrupo]) => (
              <React.Fragment key={grupo}>
                {/* Linha do grupo/equipe */}
                <tr className="bg-gray-700 text-white">
                  <td colSpan={2 + datas.length} className="border border-gray-600 p-2 font-bold">
                    {grupo.toUpperCase()}
                  </td>
                </tr>
                
                {/* Linhas dos usuários */}
                {usuariosGrupo.map(usuario => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-2 font-medium sticky left-0 bg-white z-10">
                      {usuario.nome || usuario.full_name}
                    </td>
                    <td className="border border-gray-300 p-2 text-center text-xs text-gray-600">
                      {usuario.cargo || '-'}
                    </td>
                    {datas.map(data => renderizarCelula(usuario.email, data))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {Object.keys(usuariosAgrupados).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhum usuário ativo encontrado.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}