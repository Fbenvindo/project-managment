import React, { useMemo } from 'react';
import { format, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return null;
};

export default function ResumoAlocacaoTab({
  planejamentos = [],
  empreendimentos = [],
  usuarios = [],
  equipes = [],
  osManuais = {},
  weekOffset = 0
}) {
  const diasExibidos = useMemo(() => {
    const hoje = new Date();
    const inicioSemana = startOfWeek(addDays(hoje, weekOffset * 7), { weekStartsOn: 1 });
    const dias = [];
    for (let i = 0; i < 21; i++) {
      dias.push(addDays(inicioSemana, i));
    }
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
    const cores = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
      '#14B8A6', '#A855F7', '#0EA5E9', '#22C55E', '#E11D48'
    ];
    const map = {};
    empreendimentos.forEach((emp, idx) => {
      map[emp.id] = cores[idx % cores.length];
    });
    return map;
  }, [empreendimentos]);

  const usuariosPorEquipe = useMemo(() => {
    const grupos = {};
    usuarios.forEach(user => {
      if (!user.nome && !user.full_name) return;
      if (user.status === 'inativo') return;

      let nomeEquipe = 'Sem Equipe';
      if (user.equipe_id && equipesMap[user.equipe_id]) {
        nomeEquipe = equipesMap[user.equipe_id].nome;
      } else if (user.departamento) {
        nomeEquipe = user.departamento;
      } else if (user.cargo) {
        nomeEquipe = user.cargo;
      }

      if (!grupos[nomeEquipe]) grupos[nomeEquipe] = [];
      grupos[nomeEquipe].push(user);
    });

    Object.keys(grupos).forEach(equipe => {
      grupos[equipe].sort((a, b) => (a.nome || a.full_name || '').localeCompare(b.nome || b.full_name || '', 'pt-BR'));
    });

    return grupos;
  }, [usuarios, equipesMap]);

  const alocacaoPorUsuarioDia = useMemo(() => {
    const alocacao = {};

    planejamentos.forEach(plan => {
      const executor = plan.executor_principal;
      if (!executor) return;

      if (!alocacao[executor]) {
        alocacao[executor] = { planejado: {}, realizado: {} };
      }

      const emp = empreendimentosMap[plan.empreendimento_id];
      const empNome = emp?.nome || 'Sem Emp.';
      const empCor = coresEmpreendimentos[plan.empreendimento_id] || '#6B7280';
      const label = emp?.os || empNome.substring(0, 4).toUpperCase();

      if (plan.horas_por_dia && typeof plan.horas_por_dia === 'object') {
        Object.entries(plan.horas_por_dia).forEach(([dataStr, horas]) => {
          if (Number(horas) > 0) {
            if (!alocacao[executor].planejado[dataStr]) alocacao[executor].planejado[dataStr] = [];
            if (!alocacao[executor].planejado[dataStr].find(i => i.label === label)) {
              alocacao[executor].planejado[dataStr].push({ label, cor: empCor, empNome });
            }
          }
        });
      }

      if (plan.horas_executadas_por_dia && typeof plan.horas_executadas_por_dia === 'object') {
        Object.entries(plan.horas_executadas_por_dia).forEach(([dataStr, horas]) => {
          if (Number(horas) > 0) {
            if (!alocacao[executor].realizado[dataStr]) alocacao[executor].realizado[dataStr] = [];
            if (!alocacao[executor].realizado[dataStr].find(i => i.label === label)) {
              alocacao[executor].realizado[dataStr].push({ label, cor: empCor, empNome });
            }
          }
        });
      }
    });

    return alocacao;
  }, [planejamentos, empreendimentosMap, coresEmpreendimentos]);

  return (
    <div className="overflow-auto max-h-[calc(100vh-250px)]">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-20">
          <tr className="bg-gray-800 text-white">
            <th className="border border-gray-600 p-1 text-left sticky left-0 bg-gray-800 z-30 min-w-[120px]">Nome</th>
            <th className="border border-gray-600 p-1 text-left min-w-[70px]">Item</th>
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
          {Object.entries(usuariosPorEquipe).map(([equipe, usuariosEquipe]) => (
            <React.Fragment key={equipe}>
              <tr className="bg-gray-900 text-white font-bold">
                <td colSpan={2 + diasExibidos.length} className="border border-gray-600 p-1">
                  {equipe.toUpperCase()}
                </td>
              </tr>

              {usuariosEquipe.map(usuario => {
                const email = usuario.email;
                const alocacaoUser = alocacaoPorUsuarioDia[email] || { planejado: {}, realizado: {} };
                const osManuaisUser = osManuais[email] || {};

                return (
                  <React.Fragment key={usuario.id}>
                    {/* Programado */}
                    <tr className="bg-gray-100">
                      <td className="border border-gray-300 p-1 sticky left-0 bg-gray-100 z-10" rowSpan={3}>
                        <div className="font-medium">{usuario.nome || usuario.full_name}</div>
                        <div className="text-gray-500 text-[10px]">{usuario.cargo || ''}</div>
                      </td>
                      <td className="border border-gray-300 p-1 text-xs">Programado</td>
                      {diasExibidos.map(dia => {
                        const dataStr = format(dia, 'yyyy-MM-dd');
                        const items = alocacaoUser.planejado[dataStr] || [];
                        return (
                          <td
                            key={dataStr}
                            className={`border border-gray-300 p-0.5 text-center ${dia.getDay() === 0 || dia.getDay() === 6 ? 'bg-gray-200' : ''}`}
                            style={items.length > 0 ? { backgroundColor: '#D1FAE5' } : {}}
                            title={items.map(i => `${i.label} (${i.empNome})`).join(', ')}
                          >
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {items.map((item, idx) => (
                                <span key={idx} className="px-1 rounded text-white text-[10px] font-medium" style={{ backgroundColor: item.cor }}>
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Previsto (OS Manuais) */}
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 p-1 text-xs">Previsto</td>
                      {diasExibidos.map(dia => {
                        const dataStr = format(dia, 'yyyy-MM-dd');
                        const itemsManuais = osManuaisUser[dataStr] || [];
                        return (
                          <td
                            key={dataStr}
                            className={`border border-gray-300 p-0.5 text-center ${dia.getDay() === 0 || dia.getDay() === 6 ? 'bg-gray-200' : ''}`}
                            style={itemsManuais.length > 0 ? { backgroundColor: '#DBEAFE' } : {}}
                            title={itemsManuais.map(i => `${i.label} (${i.empNome})`).join(', ')}
                          >
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {itemsManuais.map((item, idx) => (
                                <span key={idx} className="px-1 rounded text-white text-[10px] font-medium" style={{ backgroundColor: item.cor }}>
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Realizado */}
                    <tr className="bg-white">
                      <td className="border border-gray-300 p-1 text-xs font-medium">Realizado</td>
                      {diasExibidos.map(dia => {
                        const dataStr = format(dia, 'yyyy-MM-dd');
                        const items = alocacaoUser.realizado[dataStr] || [];
                        return (
                          <td
                            key={dataStr}
                            className={`border border-gray-300 p-0.5 text-center ${dia.getDay() === 0 || dia.getDay() === 6 ? 'bg-gray-200' : ''}`}
                            style={items.length > 0 ? { backgroundColor: '#FEF3C7' } : {}}
                            title={items.map(i => `${i.label} (${i.empNome})`).join(', ')}
                          >
                            <div className="flex flex-wrap gap-0.5 justify-center">
                              {items.map((item, idx) => (
                                <span key={idx} className="px-1 rounded text-white text-[10px] font-medium" style={{ backgroundColor: item.cor }}>
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}