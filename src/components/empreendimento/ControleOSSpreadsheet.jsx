import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Grid3x3, List } from "lucide-react";

const getStatusColor = (status) => {
  const colors = {
    "NA": "bg-gray-100 text-gray-700",
    "Concluído": "bg-green-100 text-green-700",
    "Pendente": "bg-red-100 text-red-700",
    "Em andamento": "bg-yellow-100 text-yellow-700",
    "Hold": "bg-orange-100 text-orange-700",
    "Paralisado": "bg-orange-200 text-orange-800",
    "Técnico": "bg-blue-100 text-blue-700",
    "Ag. Liberação": "bg-cyan-100 text-cyan-700",
    "Finalizado": "bg-purple-100 text-purple-700",
    "Em aprovação": "bg-yellow-200 text-yellow-800"
  };
  return colors[status] || "bg-gray-100 text-gray-700";
};

const getStatusBgColor = (status) => {
  const colors = {
    "NA": "#f3f4f6",
    "Concluído": "#dcfce7",
    "Pendente": "#fee2e2",
    "Em andamento": "#fef3c7",
    "Hold": "#fed7aa",
    "Paralisado": "#fed7aa",
    "Técnico": "#dbeafe",
    "Ag. Liberação": "#cffafe",
    "Finalizado": "#f3e8ff",
    "Em aprovação": "#fef08a"
  };
  return colors[status] || "#f3f4f6";
};

export default function ControleOSSpreadsheet({ controlesOS, empreendimentos, searchTerm }) {
  const [isGridView, setIsGridView] = useState(true);

  const empreendimentosMap = useMemo(() => {
    return empreendimentos.reduce((acc, emp) => {
      acc[emp.id] = emp;
      return acc;
    }, {});
  }, [empreendimentos]);

  const filteredControles = useMemo(() => {
    return controlesOS.filter(controle => {
      const emp = empreendimentosMap[controle.empreendimento_id];
      const searchLower = searchTerm?.toLowerCase() || '';
      return (
        emp?.nome?.toLowerCase().includes(searchLower) ||
        emp?.cliente?.toLowerCase().includes(searchLower) ||
        controle.os?.toLowerCase().includes(searchLower)
      );
    });
  }, [controlesOS, searchTerm, empreendimentosMap]);

  const columns = [
    { key: 'projeto', label: 'PROJETO', width: '180px' },
    { key: 'os', label: 'OS', width: '60px' },
    { key: 'gestao', label: 'Gestão', width: '70px' },
    { key: 'formalizacao', label: 'Formalização', width: '80px' },
    { key: 'abertura_os_servidor', label: 'Abertura OS', width: '80px' },
    { key: 'atividades_planejamento', label: 'Ativ. Planejamento', width: '90px' },
    { key: 'kickoff_cliente', label: 'Kickoff', width: '80px' },
    { key: 'cronograma', label: 'Cronograma', width: '80px' },
    { key: 'markup', label: 'Markup', width: '80px' },
    { key: 'art_ee_ais', label: 'ART EE/AIS', width: '80px' },
    { key: 'art_hid_in', label: 'ART HID/IN', width: '80px' },
    { key: 'art_hvac', label: 'ART HVAC', width: '80px' },
    { key: 'art_bomb', label: 'ART BOMB', width: '80px' },
    { key: 'conc_telefonia', label: 'Telefonia', width: '80px' },
    { key: 'conc_gas', label: 'Gás', width: '70px' },
    { key: 'conc_eletrica', label: 'Elétrica', width: '70px' },
    { key: 'conc_hidraulica', label: 'Hidráulica', width: '80px' },
    { key: 'conc_agua_pluvial', label: 'Água Pluvial', width: '90px' },
    { key: 'conc_incendio', label: 'Incêndio', width: '80px' }
  ];

  const getValue = (controle, key) => {
    return controle[key] || 'NA';
  };

  const StatusCell = ({ status }) => (
    <div
      className={`px-2 py-1 text-xs font-medium text-center rounded whitespace-nowrap ${getStatusColor(status)}`}
      style={{ backgroundColor: getStatusBgColor(status) }}
    >
      {status}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toggle View */}
      <div className="flex gap-2 justify-end mb-4">
        <Button
          variant={isGridView ? "default" : "outline"}
          size="sm"
          onClick={() => setIsGridView(true)}
          className="flex items-center gap-2"
        >
          <Grid3x3 className="w-4 h-4" />
          Planilha
        </Button>
        <Button
          variant={!isGridView ? "default" : "outline"}
          size="sm"
          onClick={() => setIsGridView(false)}
          className="flex items-center gap-2"
        >
          <List className="w-4 h-4" />
          Cartões
        </Button>
      </div>

      {isGridView ? (
        // Grid/Spreadsheet View
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-gray-800 text-white">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="border border-gray-300 px-2 py-2 text-left font-semibold whitespace-nowrap"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredControles.map((controle, idx) => {
                const emp = empreendimentosMap[controle.empreendimento_id];
                return (
                  <tr key={controle.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white z-10">
                      <div className="max-w-xs truncate" title={emp?.nome || 'N/A'}>
                        {emp?.nome || 'N/A'}
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-1.5 text-gray-700 whitespace-nowrap text-center">
                      {controle.os || 'N/A'}
                    </td>
                    {columns.slice(2).map((col) => (
                      <td key={col.key} className="border border-gray-300 px-1 py-1.5 whitespace-nowrap">
                        <StatusCell status={getValue(controle, col.key)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredControles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum empreendimento encontrado
            </div>
          )}
        </div>
      ) : (
        // Cards View (fallback to existing view)
        <div className="text-center py-8 text-gray-600">
          Modo de cartões - volte para a visualização de planilha
        </div>
      )}
    </div>
  );
}