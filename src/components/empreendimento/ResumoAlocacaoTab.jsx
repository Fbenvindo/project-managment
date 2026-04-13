import React, { useMemo, useState } from 'react';
import { format, addDays, startOfWeek } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ResumoAlocacaoTab({
  planejamentos = [],
  empreendimentos = [],
  usuarios = [],
  equipes = [],
  osManuais = {},
  weekOffset = 0
}) {
  const [filtroEquipe, setFiltroEquipe] = useState('todas');
  const [filtroUsuario, setFiltroUsuario] = useState('todos');
  const [filtroOS, setFiltroOS] = useState('');

  const diasExibidos = useMemo(() => {
    const hoje = new Date();
    const inicioSemana = startOfWeek(addDays(hoje, weekOffset * 7), { weekStartsOn: 1 });
    const dias = [];
    for (let i = 0; i < 21; i++) dias.push(addDays(inicioSemana, i));
    return dias;
  }, [weekOffset]);

  const empreendimentosMap = useMemo(() => {
    const map = {};
    empreendimentos.forEach(emp => { map[emp.id] = emp; });
    return map;
  }, [empreendimentos]);

  const equipesMap = useMemo(() => {
    const map = {};
    equipes.forEach(eq => { map[eq.id] = eq; });
    return map;
  }, [equipes]);

  const coresEmpreendimentos = useMemo(() => {
    const cores = ['#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316','#6366F1','#14B8A6','#A855F7','#0EA5E9','#22C55E','#E11D48'];
    const map = {};
    empreendimentos.forEach((emp, idx) => { map[emp.id] = cores[idx % cores.length]; });
    return map;
  }, [empreendimentos]);

  // Mapa: email -> { [dataStr]: [{ label, cor, empNome }] }  (programado + realizado unidos)
  const osPorUsuarioDia = useMemo(() => {
    const result = {};

    planejamentos.forEach(plan => {
      const executor = plan.executor_principal;
      if (!executor) return;
      if (!result[executor]) result[executor] = {};

      const emp = empreendimentosMap[plan.empreendimento_id];
      const empNome = emp?.nome || 'Sem Emp.';
      const empCor = coresEmpreendimentos[plan.empreendimento_id] || '#6B7280';
      const label = emp?.os || empNome.substring(0, 4).toUpperCase();

      const addToDay = (dataStr) => {
        if (!result[executor][dataStr]) result[executor][dataStr] = [];
        if (!result[executor][dataStr].find(i => i.label === label)) {
          result[executor][dataStr].push({ label, cor: empCor, empNome });
        }
      };

      ['horas_por_dia', 'horas_executadas_por_dia'].forEach(campo => {
        if (plan[campo] && typeof plan[campo] === 'object') {
          Object.entries(plan[campo]).forEach(([dataStr, horas]) => {
            if (Number(horas) > 0) addToDay(dataStr);
          });
        }
      });
    });

    // Adicionar OS manuais (previsto)
    Object.entries(osManuais).forEach(([email, diasMap]) => {
      if (!result[email]) result[email] = {};
      Object.entries(diasMap).forEach(([dataStr, items]) => {
        if (!result[email][dataStr]) result[email][dataStr] = [];
        items.forEach(item => {
          if (!result[email][dataStr].find(i => i.label === item.label)) {
            result[email][dataStr].push({ label: item.label, cor: item.cor || '#6B7280', empNome: item.empNome });
          }
        });
      });
    });

    return result;
  }, [planejamentos, empreendimentosMap, coresEmpreendimentos, osManuais]);

  const usuariosPorEquipe = useMemo(() => {
    const grupos = {};
    usuarios.forEach(user => {
      if (!user.nome && !user.full_name) return;
      if (user.status === 'inativo') return;
      let nomeEquipe = 'Sem Equipe';
      if (user.equipe_id && equipesMap[user.equipe_id]) nomeEquipe = equipesMap[user.equipe_id].nome;
      else if (user.departamento) nomeEquipe = user.departamento;
      if (!grupos[nomeEquipe]) grupos[nomeEquipe] = [];
      grupos[nomeEquipe].push(user);
    });
    Object.keys(grupos).forEach(eq => {
      grupos[eq].sort((a, b) => (a.nome || a.full_name || '').localeCompare(b.nome || b.full_name || '', 'pt-BR'));
    });
    return grupos;
  }, [usuarios, equipesMap]);

  // Filtrar por OS: verificar se o usuário tem a OS em algum dia visível
  const usuariosPorEquipeFiltrado = useMemo(() => {
    const result = {};
    Object.entries(usuariosPorEquipe).forEach(([equipe, usrs]) => {
      if (filtroEquipe !== 'todas' && equipe !== filtroEquipe) return;
      const filtrados = usrs.filter(u => {
        if (filtroUsuario !== 'todos' && u.email !== filtroUsuario) return false;
        if (filtroOS.trim()) {
          const diasUser = osPorUsuarioDia[u.email] || {};
          const osLower = filtroOS.trim().toLowerCase();
          const temOS = Object.values(diasUser).some(items =>
            items.some(i => i.label.toLowerCase().includes(osLower) || i.empNome.toLowerCase().includes(osLower))
          );
          if (!temOS) return false;
        }
        return true;
      });
      if (filtrados.length > 0) result[equipe] = filtrados;
    });
    return result;
  }, [usuariosPorEquipe, filtroEquipe, filtroUsuario, filtroOS, osPorUsuarioDia]);

  const temFiltros = filtroEquipe !== 'todas' || filtroUsuario !== 'todos' || filtroOS.trim();
  const totalLinhas = Object.values(usuariosPorEquipeFiltrado).reduce((a, b) => a + b.length, 0);

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center p-2 bg-gray-50 rounded-lg border text-sm">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        <Input
          placeholder="Filtrar por OS..."
          value={filtroOS}
          onChange={e => setFiltroOS(e.target.value)}
          className="h-8 w-48 text-xs"
        />
        <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Todas as equipes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as equipes</SelectItem>
            {Object.keys(usuariosPorEquipe).sort().map(eq => (
              <SelectItem key={eq} value={eq}>{eq}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Todos os usuários" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os usuários</SelectItem>
            {usuarios.filter(u => u.nome || u.full_name).sort((a, b) => (a.nome || a.full_name || '').localeCompare(b.nome || b.full_name || '')).map(u => (
              <SelectItem key={u.id} value={u.email}>{u.nome || u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {temFiltros && (
          <Button variant="ghost" size="sm" onClick={() => { setFiltroOS(''); setFiltroEquipe('todas'); setFiltroUsuario('todos'); }} className="h-8 text-red-500 hover:text-red-700 text-xs">
            <X className="w-3 h-3 mr-1" />Limpar
          </Button>
        )}
        <span className="text-xs text-gray-500 ml-auto">{totalLinhas} colaboradores</span>
      </div>

      {/* Tabela */}
      <div className="overflow-auto max-h-[calc(100vh-300px)]">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-600 p-1 text-left sticky left-0 bg-gray-800 z-30 min-w-[130px]">Nome</th>
              {diasExibidos.map(dia => (
                <th
                  key={format(dia, 'yyyy-MM-dd')}
                  className={`border border-gray-600 p-1 text-center min-w-[40px] ${dia.getDay() === 0 || dia.getDay() === 6 ? 'bg-gray-700' : ''}`}
                >
                  {format(dia, 'd/MM')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(usuariosPorEquipeFiltrado).map(([equipe, usrs]) => (
              <React.Fragment key={equipe}>
                <tr className="bg-gray-900 text-white font-bold">
                  <td colSpan={1 + diasExibidos.length} className="border border-gray-600 p-1">
                    {equipe.toUpperCase()}
                  </td>
                </tr>
                {usrs.map((usuario, idx) => {
                  const email = usuario.email;
                  const diasUser = osPorUsuarioDia[email] || {};

                  return (
                    <tr key={usuario.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className={`border border-gray-300 p-1 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="font-medium">{usuario.nome || usuario.full_name}</div>
                        <div className="text-gray-400 text-[10px]">{usuario.cargo || ''}</div>
                      </td>
                      {diasExibidos.map(dia => {
                        const dataStr = format(dia, 'yyyy-MM-dd');
                        const osLower = filtroOS.trim().toLowerCase();
                        const allItems = diasUser[dataStr] || [];
                        const items = osLower
                          ? allItems.filter(i => i.label.toLowerCase().includes(osLower) || i.empNome.toLowerCase().includes(osLower))
                          : allItems;
                        return (
                          <td
                            key={dataStr}
                            className={`border border-gray-300 p-0.5 text-center ${dia.getDay() === 0 || dia.getDay() === 6 ? 'bg-gray-100' : ''}`}
                            title={items.map(i => `${i.label} (${i.empNome})`).join(', ')}
                          >
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {items.map((item, i) => (
                                <span key={i} className="px-1 rounded text-white text-[10px] font-medium" style={{ backgroundColor: item.cor }}>
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {Object.keys(usuariosPorEquipeFiltrado).length === 0 && (
              <tr>
                <td colSpan={1 + diasExibidos.length} className="text-center py-8 text-gray-400">
                  Nenhum resultado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}