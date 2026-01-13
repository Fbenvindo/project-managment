import React, { useMemo } from 'react';

export default function CalendarioDiasHoras({ horasPorDia }) {
    const horasOrdenadas = useMemo(() => {
        return Object.entries(horasPorDia)
            .sort(([dataA], [dataB]) => {
                const partes_a = dataA.split('/');
                const partes_b = dataB.split('/');
                const date_a = new Date(partes_a[2], partes_a[1] - 1, partes_a[0]);
                const date_b = new Date(partes_b[2], partes_b[1] - 1, partes_b[0]);
                return date_a - date_b;
            });
    }, [horasPorDia]);

    const formatarDiaSemana = (data) => {
        const partes = data.split('/');
        const date = new Date(partes[2], partes[1] - 1, partes[0]);
        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        return dias[date.getDay()];
    };

    return (
        <div className="flex gap-2 overflow-x-auto pb-2">
            {horasOrdenadas.map(([data, { alocado, executado }]) => {
                const partes = data.split('/');
                const diaSemana = formatarDiaSemana(data);
                const totalHoras = alocado + executado;
                
                return (
                    <div 
                        key={data} 
                        className="flex-shrink-0 p-4 rounded-lg border-2 border-blue-200 bg-white hover:shadow-md transition-shadow"
                    >
                        <div className="text-center">
                            <p className="text-xs font-medium text-blue-600 mb-1">{diaSemana.substring(0, 3).toUpperCase()}, {partes[0]}</p>
                            <div className="space-y-1">
                                <div>
                                    <p className="text-xs text-gray-500">Alocado</p>
                                    <p className="text-lg font-bold text-blue-600">{alocado.toFixed(1)}h</p>
                                </div>
                                <div className="border-t pt-1">
                                    <p className="text-xs text-gray-500">Executado</p>
                                    <p className="text-lg font-bold text-green-600">{executado.toFixed(1)}h</p>
                                </div>
                                <div className="border-t pt-1 bg-gray-50 -mx-4 px-4 py-1 rounded">
                                    <p className="text-xs text-gray-500">Total</p>
                                    <p className="text-sm font-semibold text-gray-800">{totalHoras.toFixed(1)}h</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}