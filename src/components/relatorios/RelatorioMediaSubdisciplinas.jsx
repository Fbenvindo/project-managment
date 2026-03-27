import React, { useMemo } from 'react';
import { Badge } from "@/components/ui/badge";

export default function RelatorioMediaSubdisciplinas({ planejamentos, agrupamento = 'subdisciplina' }) {
    const dados = useMemo(() => {
        if (!planejamentos || planejamentos.length === 0) return [];

        const mapa = {};

        planejamentos.forEach(p => {
            if (!p.tempo_planejado || p.tempo_planejado <= 0) return;

            if (agrupamento === 'folha') {
                const doc = p.documento;
                if (!doc) return;
                const chave = doc.id;
                const label = `${doc.numero || ''} - ${doc.arquivo || ''}`.trim().replace(/^-\s*/, '');
                if (!mapa[chave]) {
                    mapa[chave] = { total_horas: 0, quantidade: 0, label, subdisciplinas: new Set() };
                }
                mapa[chave].total_horas += p.tempo_planejado;
                mapa[chave].quantidade += 1;
                (doc.subdisciplinas || []).forEach(s => s && mapa[chave].subdisciplinas.add(s));
            } else {
                const subdisciplinas = p.documento?.subdisciplinas;
                if (!subdisciplinas || subdisciplinas.length === 0) return;
                subdisciplinas.forEach(sub => {
                    if (!sub) return;
                    if (!mapa[sub]) {
                        mapa[sub] = { total_horas: 0, quantidade: 0, label: sub };
                    }
                    mapa[sub].total_horas += p.tempo_planejado;
                    mapa[sub].quantidade += 1;
                });
            }
        });

        return Object.values(mapa)
            .map(item => ({
                ...item,
                media: item.total_horas / item.quantidade,
                subdisciplinas: item.subdisciplinas ? [...item.subdisciplinas] : [],
            }))
            .sort((a, b) => b.media - a.media);
    }, [planejamentos, agrupamento]);

    const maxMedia = Math.max(...dados.map(d => d.media));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{dados.length} {agrupamento === 'folha' ? 'folhas' : 'subdisciplinas'} encontradas</p>
                <Badge variant="secondary">{planejamentos.length} planejamentos analisados</Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">{agrupamento === 'folha' ? 'Folha' : 'Subdisciplina'}</th>
                            {agrupamento === 'folha' && <th className="text-left px-4 py-3 font-semibold text-gray-700">Subdisciplinas</th>}
                            <th className="text-right px-4 py-3 font-semibold text-gray-700">Qtd. Planejamentos</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-700">Total de Horas</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-700">Média de Horas</th>
                            <th className="px-4 py-3 w-40"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {dados.map((item, idx) => {
                            const barWidth = maxMedia > 0 ? (item.media / maxMedia) * 100 : 0;
                            return (
                                <tr key={item.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                     <td className="px-4 py-3 font-medium text-gray-900">{item.label}</td>
                                     {agrupamento === 'folha' && (
                                         <td className="px-4 py-3 text-gray-600">
                                             <div className="flex flex-wrap gap-1">
                                                 {item.subdisciplinas.length > 0
                                                     ? item.subdisciplinas.map(s => (
                                                         <span key={s} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                                                       ))
                                                     : <span className="text-gray-400 text-xs">—</span>}
                                             </div>
                                         </td>
                                     )}
                                    <td className="px-4 py-3 text-right text-gray-600">{item.quantidade}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{item.total_horas.toFixed(1)}h</td>
                                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{item.media.toFixed(1)}h</td>
                                    <td className="px-4 py-3">
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full transition-all"
                                                style={{ width: `${barWidth}%` }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}