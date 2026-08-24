import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Clock, CheckCircle2 } from "lucide-react";

const fmt = (n) => (Number(n) || 0).toFixed(1).replace('.', ',');

export default function ControleHorasTab({ documentos = [], planejamentos = [] }) {
  const [expandidas, setExpandidas] = useState(() => new Set());

  const arvore = useMemo(() => {
    // Soma horas planejadas/executadas por documento
    const horasPorDoc = {};
    planejamentos.forEach((p) => {
      if (!p.documento_id) return;
      if (!horasPorDoc[p.documento_id]) horasPorDoc[p.documento_id] = { planejado: 0, executado: 0 };
      horasPorDoc[p.documento_id].planejado += Number(p.tempo_planejado) || 0;
      horasPorDoc[p.documento_id].executado += Number(p.tempo_executado) || 0;
    });

    // Agrupa documentos por disciplina > subdisciplina (primária)
    const arvore = {};
    documentos.forEach((doc) => {
      const disciplina = doc.disciplina || "Sem Disciplina";
      const subdisciplina =
        Array.isArray(doc.subdisciplinas) && doc.subdisciplinas.length > 0
          ? doc.subdisciplinas[0]
          : "Sem Subdisciplina";
      const horas = horasPorDoc[doc.id] || { planejado: 0, executado: 0 };

      if (!arvore[disciplina]) arvore[disciplina] = {};
      if (!arvore[disciplina][subdisciplina])
        arvore[disciplina][subdisciplina] = { planejado: 0, executado: 0, folhas: 0 };

      arvore[disciplina][subdisciplina].planejado += horas.planejado;
      arvore[disciplina][subdisciplina].executado += horas.executado;
      arvore[disciplina][subdisciplina].folhas += 1;
    });

    // Monta resultado ordenado com totais por disciplina
    return Object.entries(arvore)
      .map(([disciplina, subs]) => {
        let discPlanejado = 0;
        let discExecutado = 0;
        const subLista = Object.entries(subs)
          .map(([sub, dados]) => {
            discPlanejado += dados.planejado;
            discExecutado += dados.executado;
            return { subdisciplina: sub, ...dados };
          })
          .sort((a, b) => a.subdisciplina.localeCompare(b.subdisciplina));
        return {
          disciplina,
          subdisciplinas: subLista,
          planejado: discPlanejado,
          executado: discExecutado,
        };
      })
      .sort((a, b) => a.disciplina.localeCompare(b.disciplina));
  }, [documentos, planejamentos]);

  const totalGeral = useMemo(() => {
    return arvore.reduce(
      (acc, d) => {
        acc.planejado += d.planejado;
        acc.executado += d.executado;
        return acc;
      },
      { planejado: 0, executado: 0 }
    );
  }, [arvore]);

  const toggle = (disciplina) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(disciplina)) next.delete(disciplina);
      else next.add(disciplina);
      return next;
    });
  };

  const expandirTudo = () => setExpandidas(new Set(arvore.map((d) => d.disciplina)));
  const recolherTudo = () => setExpandidas(new Set());

  if (documentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Clock className="w-10 h-10 text-gray-300 mb-3" />
        <p>Nenhum documento cadastrado para este empreendimento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo geral */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Horas Planejadas</p>
            <p className="text-xl font-bold text-blue-700">{fmt(totalGeral.planejado)}h</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Horas Executadas</p>
            <p className="text-xl font-bold text-green-700">{fmt(totalGeral.executado)}h</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Progresso</p>
            <p className="text-xl font-bold text-gray-800">
              {totalGeral.planejado > 0
                ? Math.round((totalGeral.executado / totalGeral.planejado) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandirTudo}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
          >
            Expandir tudo
          </button>
          <button
            onClick={recolherTudo}
            className="text-xs text-gray-600 hover:text-gray-800 font-medium px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            Recolher tudo
          </button>
        </div>
      </div>

      {/* Árvore disciplina > subdisciplina */}
      <div className="space-y-3">
        {arvore.map(({ disciplina, subdisciplinas, planejado, executado }) => {
          const aberta = expandidas.has(disciplina);
          const progresso = planejado > 0 ? Math.round((executado / planejado) * 100) : 0;

          return (
            <div key={disciplina} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {/* Cabeçalho da disciplina */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-[#edf2ff] hover:bg-[#e3eaff] transition-colors"
                onClick={() => toggle(disciplina)}
              >
                {aberta ? (
                  <ChevronDown className="w-5 h-5 text-blue-600 shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" />
                )}
                <div className="w-1 h-6 bg-blue-600 rounded-full shrink-0" />
                <h3 className="font-semibold text-lg text-gray-800 flex-1">{disciplina}</h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-0.5 text-xs font-medium text-gray-600">
                    {subdisciplinas.length} {subdisciplinas.length === 1 ? "subdisciplina" : "subdisciplinas"}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-0.5 text-xs font-semibold text-blue-700">
                    <Clock className="w-3 h-3" />
                    {fmt(planejado)}h
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-0.5 text-xs font-semibold text-green-700">
                    <CheckCircle2 className="w-3 h-3" />
                    {fmt(executado)}h
                  </span>
                </div>
              </div>

              {/* Subdisciplinas */}
              {aberta && (
                <div className="bg-white p-3 space-y-2">
                  {subdisciplinas.map(({ subdisciplina, planejado: sp, executado: se, folhas }) => {
                    const pct = sp > 0 ? Math.round((se / sp) * 100) : 0;
                    return (
                      <div
                        key={subdisciplina}
                        className="flex items-center justify-between gap-3 border border-gray-200 rounded-md px-4 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {subdisciplina}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">({folhas} {folhas === 1 ? "folha" : "folhas"})</span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-sm font-semibold text-blue-700">{fmt(sp)}h</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-sm font-semibold text-green-700">{fmt(se)}h</span>
                          </div>
                          <div className="w-16 text-right">
                            <span className="text-xs font-medium text-gray-500">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}