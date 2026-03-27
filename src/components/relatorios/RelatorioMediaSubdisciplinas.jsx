import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6'];

export default function RelatorioMediaSubdisciplinas({ planejamentos }) {
  const [sortBy, setSortBy] = useState('media_desc');

  const dadosPorSubdisciplina = useMemo(() => {
    const mapa = {};

    planejamentos.forEach(p => {
      const subdisciplinas = p.documento?.subdisciplinas || [];
      const tempo = Number(p.tempo_planejado) || 0;
      if (tempo <= 0 || subdisciplinas.length === 0) return;

      subdisciplinas.forEach(sub => {
        if (!sub) return;
        if (!mapa[sub]) mapa[sub] = { total: 0, count: 0, min: Infinity, max: -Infinity, concluidos: 0 };
        mapa[sub].total += tempo;
        mapa[sub].count += 1;
        if (tempo < mapa[sub].min) mapa[sub].min = tempo;
        if (tempo > mapa[sub].max) mapa[sub].max = tempo;
        if (p.status === 'concluido') mapa[sub].concluidos += 1;
      });
    });

    return Object.entries(mapa).map(([subdisciplina, v]) => ({
      subdisciplina,
      media: Math.round((v.total / v.count) * 10) / 10,
      total: Math.round(v.total * 10) / 10,
      count: v.count,
      min: v.min === Infinity ? 0 : Math.round(v.min * 10) / 10,
      max: v.max === -Infinity ? 0 : Math.round(v.max * 10) / 10,
      concluidos: v.concluidos,
    }));
  }, [planejamentos]);

  const dadosOrdenados = useMemo(() => {
    const sorted = [...dadosPorSubdisciplina];
    switch (sortBy) {
      case 'media_desc': return sorted.sort((a, b) => b.media - a.media);
      case 'media_asc': return sorted.sort((a, b) => a.media - b.media);
      case 'nome': return sorted.sort((a, b) => a.subdisciplina.localeCompare(b.subdisciplina));
      case 'count_desc': return sorted.sort((a, b) => b.count - a.count);
      default: return sorted;
    }
  }, [dadosPorSubdisciplina, sortBy]);

  if (dadosOrdenados.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Nenhum dado disponível para calcular médias por subdisciplina.</p>
        <p className="text-sm mt-1">Verifique se os planejamentos possuem documentos com subdisciplinas associadas.</p>
      </div>
    );
  }

  const dadosGrafico = dadosOrdenados.slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Média de Horas por Subdisciplina (Top 20)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dadosGrafico} margin={{ top: 5, right: 30, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subdisciplina" angle={-40} textAnchor="end" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} label={{ value: 'Horas (h)', angle: -90, position: 'insideLeft', offset: 10 }} />
              <Tooltip formatter={(value) => [`${value}h`, 'Média']} />
              <Bar dataKey="media" radius={[4, 4, 0, 0]}>
                {dadosGrafico.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Detalhamento por Subdisciplina</CardTitle>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
          >
            <option value="media_desc">Maior média</option>
            <option value="media_asc">Menor média</option>
            <option value="nome">Nome A-Z</option>
            <option value="count_desc">Mais atividades</option>
          </select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-semibold text-gray-700">Subdisciplina</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Qtd. Planejamentos</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Média (h)</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Mín (h)</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Máx (h)</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Total (h)</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Concluídos</th>
                </tr>
              </thead>
              <tbody>
                {dadosOrdenados.map((row, idx) => (
                  <tr key={row.subdisciplina} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {row.subdisciplina}
                      </div>
                    </td>
                    <td className="p-3 text-center text-gray-600">{row.count}</td>
                    <td className="p-3 text-center">
                      <span className="font-bold text-blue-700">{row.media}h</span>
                    </td>
                    <td className="p-3 text-center text-green-700">{row.min}h</td>
                    <td className="p-3 text-center text-red-600">{row.max}h</td>
                    <td className="p-3 text-center text-gray-600">{row.total}h</td>
                    <td className="p-3 text-center">
                      <Badge variant={row.concluidos === row.count ? 'default' : 'secondary'}>
                        {row.concluidos}/{row.count}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}