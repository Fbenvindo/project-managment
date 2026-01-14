import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Grid3x3, List } from "lucide-react";

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

const StatusCell = ({ status }) => (
  <div
    className="px-2 py-1 text-xs font-medium text-center rounded whitespace-nowrap"
    style={{ backgroundColor: getStatusBgColor(status), color: '#1f2937' }}
  >
    {status}
  </div>
);

const SpreadsheetTable = ({ title, columns, data, stickyFirst = true }) => {
  const projectoColumn = columns[0];
  const otherColumns = columns.slice(1);
  
  return (
    <div className="flex bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Coluna Projeto Fixa */}
      <div className="flex-shrink-0">
        <table className="border-collapse text-xs">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th colSpan={1} className="border border-gray-300 px-4 py-2 text-left font-bold">
                {title}
              </th>
            </tr>
            <tr>
              <th className="border border-gray-300 px-2 py-2 text-left font-semibold whitespace-nowrap" style={{ width: projectoColumn.width, minWidth: projectoColumn.width }}>
                {projectoColumn.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap font-medium">
                  {row[projectoColumn.key] || 'NA'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Outras Colunas com Scroll */}
      <div className="flex-1 overflow-x-auto">
        <table className="border-collapse text-xs w-full">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th colSpan={otherColumns.length} className="border border-gray-300 px-4 py-2 text-left font-bold">
                {title}
              </th>
            </tr>
            <tr>
              {otherColumns.map((col) => (
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
            {data.map((row, idx) => (
              <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {otherColumns.map((col) => {
                  const value = row[col.key] || 'NA';
                  const isStatusCell = col.isStatus;
                  
                  return (
                    <td 
                      key={col.key} 
                      className="border border-gray-300 px-2 py-1.5 whitespace-nowrap"
                    >
                      {isStatusCell ? <StatusCell status={value} /> : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
    // Criar um mapa de controles por empreendimento_id
    const controlesMap = controlesOS.reduce((acc, controle) => {
      acc[controle.empreendimento_id] = controle;
      return acc;
    }, {});

    // Criar lista com TODOS os empreendimentos
    const allControles = empreendimentos.map(emp => {
      const controle = controlesMap[emp.id];
      if (controle) {
        return {
          ...controle,
          projeto: emp.nome || 'N/A'
        };
      } else {
        // Empreendimento sem controle OS - criar registro vazio
        return {
          id: emp.id,
          empreendimento_id: emp.id,
          projeto: emp.nome || 'N/A',
          os: emp.os || '',
          gestao: 'NA',
          formalizacao: '',
          cronograma: 'NA',
          markup: 'NA',
          abertura_os_servidor: 'NA',
          atividades_planejamento: 'NA',
          kickoff_cliente: 'NA',
          art_ee_ais: 'NA',
          art_hid_in: 'NA',
          art_hvac: 'NA',
          art_bomb: 'NA',
          conc_telefonia: 'NA',
          conc_gas: 'NA',
          conc_eletrica: 'NA',
          conc_hidraulica: 'NA',
          conc_agua_pluvial: 'NA',
          conc_incendio: 'NA',
          planejamento_hidraulica_concepcao: 'NA',
          planejamento_hidraulica_calculo: 'NA',
          planejamento_hidraulica_diagrama: 'NA',
          planejamento_eletrica_concepcao: 'NA',
          planejamento_eletrica_calculo: 'NA',
          planejamento_eletrica_diagrama: 'NA',
          planejamento_incendio_concepcao: 'NA',
          planejamento_incendio_calculo: 'NA',
          planejamento_incendio_diagrama: 'NA',
          monitoramento_briefing: 'NA',
          monitoramento_cronograma: 'NA',
          monitoramento_lmd: 'NA',
          monitoramento_entregas_x_etapas: 'NA'
        };
      }
    });

    // Filtrar por searchTerm
    return allControles.filter(controle => {
      const searchLower = searchTerm?.toLowerCase() || '';
      const emp = empreendimentosMap[controle.empreendimento_id];
      return (
        controle.projeto?.toLowerCase().includes(searchLower) ||
        emp?.cliente?.toLowerCase().includes(searchLower) ||
        controle.os?.toLowerCase().includes(searchLower)
      );
    });
  }, [controlesOS, empreendimentos, searchTerm, empreendimentosMap]);

  // Seção PROJETO
  const projetoColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'os', label: 'OS', width: '60px', isStatus: false },
    { key: 'gestao', label: 'Gestão', width: '70px', isStatus: true },
    { key: 'formalizacao', label: 'Formalização', width: '80px', isStatus: true },
    { key: 'abertura_os_servidor', label: 'Abertura OS', width: '80px', isStatus: true },
    { key: 'atividades_planejamento', label: 'Ativ. Planejamento', width: '90px', isStatus: true },
    { key: 'kickoff_cliente', label: 'Kickoff', width: '80px', isStatus: true },
    { key: 'cronograma', label: 'Cronograma', width: '80px', isStatus: true },
    { key: 'markup', label: 'Markup', width: '80px', isStatus: true }
  ];

  // Seção ART
  const artColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'art_ee_ais', label: 'ART - ELÉTRICA', width: '100px', isStatus: true },
    { key: 'art_hid_in', label: 'ART - HIDRÁULICA', width: '110px', isStatus: true },
    { key: 'art_hvac', label: 'ART - HVAC', width: '90px', isStatus: true },
    { key: 'art_bomb', label: 'ART - BOMB', width: '90px', isStatus: true }
  ];

  // Seção CONCESSIONÁRIAS
  const concessionariaColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'conc_telefonia', label: 'TELEFONIA', width: '90px', isStatus: true },
    { key: 'conc_gas', label: 'GÁS', width: '80px', isStatus: true },
    { key: 'conc_eletrica', label: 'ELÉTRICA', width: '90px', isStatus: true },
    { key: 'conc_hidraulica', label: 'HIDRÁULICA', width: '100px', isStatus: true },
    { key: 'conc_agua_pluvial', label: 'ÁGUA PLUVIAL', width: '110px', isStatus: true },
    { key: 'conc_incendio', label: 'INCÊNDIO', width: '90px', isStatus: true }
  ];

  // Seção PLANEJAMENTO
  const planejamentoColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'planejamento_hidraulica_concepcao', label: 'HID. Conc.', width: '80px', isStatus: true },
    { key: 'planejamento_hidraulica_calculo', label: 'HID. Calc.', width: '80px', isStatus: true },
    { key: 'planejamento_hidraulica_diagrama', label: 'HID. Diag.', width: '80px', isStatus: true },
    { key: 'planejamento_eletrica_concepcao', label: 'ELE. Conc.', width: '80px', isStatus: true },
    { key: 'planejamento_eletrica_calculo', label: 'ELE. Calc.', width: '80px', isStatus: true },
    { key: 'planejamento_eletrica_diagrama', label: 'ELE. Diag.', width: '80px', isStatus: true },
    { key: 'planejamento_incendio_concepcao', label: 'INC. Conc.', width: '80px', isStatus: true },
    { key: 'planejamento_incendio_calculo', label: 'INC. Calc.', width: '80px', isStatus: true },
    { key: 'planejamento_incendio_diagrama', label: 'INC. Diag.', width: '80px', isStatus: true }
  ];

  // Seção MONITORAMENTO
  const monitoramentoColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'monitoramento_briefing', label: 'Briefing', width: '90px', isStatus: true },
    { key: 'monitoramento_cronograma', label: 'Cronograma', width: '100px', isStatus: true },
    { key: 'monitoramento_lmd', label: 'LMD', width: '80px', isStatus: true },
    { key: 'monitoramento_entregas_x_etapas', label: 'Entregas x Etapas', width: '130px', isStatus: true }
  ];

  return (
    <div className="space-y-6">
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
        <>
          {filteredControles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum empreendimento encontrado
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="flex h-full">
                {/* Coluna Projeto Fixa */}
                <div className="sticky left-0 z-5 bg-white border-r border-gray-300 flex-shrink-0">
                  <table className="border-collapse text-xs">
                    <thead className="bg-gray-800 text-white">
                      <tr style={{ height: '40px' }}>
                        <th colSpan={1} className="border border-gray-300 px-4 py-2 text-left font-bold">
                          PROJETO
                        </th>
                      </tr>
                      <tr style={{ height: '40px' }}>
                        <th className="border border-gray-300 px-2 py-2 text-left font-semibold whitespace-nowrap" style={{ width: '200px', minWidth: '200px' }}>
                          PROJETO
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '32px' }}>
                          <td className="border border-gray-300 px-2 whitespace-nowrap font-medium" style={{ height: '32px', lineHeight: '32px', padding: '0 8px' }}>
                            {row.projeto || 'NA'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Tabelas com scroll horizontal */}
                <div className="flex-1 overflow-x-auto">
                  <div className="flex gap-0">
                    {/* ART sem coluna Projeto */}
                  <table className="border-collapse text-xs">
                    <thead className="bg-gray-800 text-white">
                      <tr style={{ height: '40px' }}>
                        <th colSpan={artColumns.length - 1} className="border border-gray-300 px-4 py-2 text-left font-bold">
                          ART
                        </th>
                      </tr>
                      <tr style={{ height: '40px' }}>
                        {artColumns.slice(1).map((col) => (
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
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '32px' }}>
                          {artColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 px-2 whitespace-nowrap" style={{ height: '32px', lineHeight: '32px', padding: '0 8px' }}>
                                {col.isStatus ? <StatusCell status={value} /> : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* CONCESSIONÁRIAS sem coluna Projeto */}
                  <table className="border-collapse text-xs">
                    <thead className="bg-gray-800 text-white">
                      <tr style={{ height: '40px' }}>
                        <th colSpan={concessionariaColumns.length - 1} className="border border-gray-300 px-4 py-2 text-left font-bold">
                          CONCESSIONÁRIAS
                        </th>
                      </tr>
                      <tr style={{ height: '40px' }}>
                        {concessionariaColumns.slice(1).map((col) => (
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
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '32px' }}>
                          {concessionariaColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 px-2 whitespace-nowrap" style={{ height: '32px', lineHeight: '32px', padding: '0 8px' }}>
                                {col.isStatus ? <StatusCell status={value} /> : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* MONITORAMENTO sem coluna Projeto */}
                  <table className="border-collapse text-xs">
                    <thead className="bg-gray-800 text-white">
                      <tr style={{ height: '40px' }}>
                        <th colSpan={monitoramentoColumns.length - 1} className="border border-gray-300 px-4 py-2 text-left font-bold">
                          MONITORAMENTO
                        </th>
                      </tr>
                      <tr style={{ height: '40px' }}>
                        {monitoramentoColumns.slice(1).map((col) => (
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
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '32px' }}>
                          {monitoramentoColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 px-2 whitespace-nowrap" style={{ height: '32px', lineHeight: '32px', padding: '0 8px' }}>
                                {col.isStatus ? <StatusCell status={value} /> : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* PLANEJAMENTO sem coluna Projeto */}
                  <table className="border-collapse text-xs">
                    <thead className="bg-gray-800 text-white">
                      <tr style={{ height: '40px' }}>
                        <th colSpan={planejamentoColumns.length - 1} className="border border-gray-300 px-4 py-2 text-left font-bold">
                          PLANEJAMENTO
                        </th>
                      </tr>
                      <tr style={{ height: '40px' }}>
                        {planejamentoColumns.slice(1).map((col) => (
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
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '32px' }}>
                          {planejamentoColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 px-2 whitespace-nowrap" style={{ height: '32px', lineHeight: '32px', padding: '0 8px' }}>
                                {col.isStatus ? <StatusCell status={value} /> : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                   </div>
                  </div>
                  </div>
                  </div>
                  )}
                  </>
                  ) : (
                  <div className="text-center py-8 text-gray-600">
                  Modo de cartões - volte para a visualização de planilha
                  </div>
                  )}
    </div>
  );
}