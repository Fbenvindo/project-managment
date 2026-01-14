import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Grid3x3, List } from "lucide-react";
import { base44 } from "@/api/base44Client";

const getStatusBgColor = (status) => {
  const colors = {
    "NA": "#f3f4f6",
    "Concluído": "#dcfce7",
    "Concluído - EX": "#dcfce7",
    "Concluído - EX R00": "#dcfce7",
    "Concluído - LO": "#dcfce7",
    "Concluído - R00": "#dcfce7",
    "Concluído - R02": "#dcfce7",
    "Concluído - R04": "#dcfce7",
    "Concluído - R05": "#dcfce7",
    "Concluído - R06": "#dcfce7",
    "Concluído - R07": "#dcfce7",
    "Concluído - LO": "#dcfce7",
    "Concluído - PR": "#dcfce7",
    "Pendente": "#fee2e2",
    "Em andamento": "#fef3c7",
    "Em Andamento": "#fef3c7",
    "Hold": "#fed7aa",
    "Paralisado": "#fed7aa",
    "Técnico": "#dbeafe",
    "Ag. Liberação": "#cffafe",
    "Finalizado": "#f3e8ff",
    "Em aprovação": "#fef08a",
    "(Vazias)": "#f3f4f6"
  };
  return colors[status] || "#f3f4f6";
};

const StatusCell = ({ status, editable, onUpdate, customOptions }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  if (!editable) {
    return (
      <div
        className="px-2 py-1 text-xs font-medium text-center rounded whitespace-nowrap"
        style={{ backgroundColor: getStatusBgColor(status), color: '#1f2937' }}
      >
        {status}
      </div>
    );
  }

  const statusOptions = customOptions || [
    "NA", "Concluído", "Pendente", "Em andamento", "Hold", 
    "Paralisado", "Técnico", "Ag. Liberação", "Finalizado", "Em aprovação"
  ];

  if (isEditing) {
    return (
      <select
        value={status}
        onChange={(e) => {
          onUpdate(e.target.value);
          setIsEditing(false);
        }}
        onBlur={() => setIsEditing(false)}
        autoFocus
        className="w-full px-2 py-1 text-xs font-medium rounded border-2 border-blue-500"
        style={{ backgroundColor: getStatusBgColor(status), color: '#1f2937' }}
      >
        {statusOptions.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  return (
    <div
      className="px-2 py-1 text-xs font-medium text-center rounded whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-blue-400"
      style={{ backgroundColor: getStatusBgColor(status), color: '#1f2937' }}
      onClick={() => setIsEditing(true)}
    >
      {status}
    </div>
  );
};

const GestaoCell = ({ value, editable, onUpdate, usuarios }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');
  
  if (!editable) {
    return (
      <div className="px-2 py-1 text-xs">
        {value || 'NA'}
      </div>
    );
  }

  if (isEditing) {
    return (
      <select
        value={tempValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setTempValue(newValue);
          onUpdate(newValue);
          setIsEditing(false);
        }}
        onBlur={() => setIsEditing(false)}
        autoFocus
        className="w-full px-2 py-1 text-xs rounded border-2 border-blue-500"
      >
        <option value="">Selecione...</option>
        {usuarios.map(user => (
          <option key={user.email} value={user.nome || user.email}>
            {user.nome || user.email}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      className="px-2 py-1 text-xs cursor-pointer hover:ring-2 hover:ring-blue-400 rounded"
      onClick={() => {
        setTempValue(value || '');
        setIsEditing(true);
      }}
    >
      {value || 'NA'}
    </div>
  );
};

const FormalizacaoCell = ({ value, editable, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  
  if (!editable) {
    return (
      <div className="px-2 py-1 text-xs">
        {value || ''}
      </div>
    );
  }

  if (isEditing) {
    return (
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          onUpdate(localValue);
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onUpdate(localValue);
            setIsEditing(false);
          }
        }}
        autoFocus
        className="w-full px-2 py-1 text-xs rounded border-2 border-blue-500"
      />
    );
  }

  return (
    <div
      className="px-2 py-1 text-xs cursor-pointer hover:ring-2 hover:ring-blue-400 rounded"
      onClick={() => setIsEditing(true)}
    >
      {value || ''}
    </div>
  );
};

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

export default function ControleOSSpreadsheet({ controlesOS, empreendimentos, searchTerm, onUpdate, editable = false }) {
  const [isGridView, setIsGridView] = useState(true);
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    const loadUsuarios = async () => {
      try {
        const users = await base44.entities.Usuario.list();
        setUsuarios(users || []);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };
    loadUsuarios();
  }, []);

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
          projeto: emp.nome || 'N/A',
          planejamento_hidraulica_concepcao: controle.planejamento?.hidraulica?.concepcao || 'NA',
          planejamento_hidraulica_calculo: controle.planejamento?.hidraulica?.calculo || 'NA',
          planejamento_hidraulica_diagrama: controle.planejamento?.hidraulica?.diagrama || 'NA',
          planejamento_eletrica_concepcao: controle.planejamento?.eletrica?.concepcao || 'NA',
          planejamento_eletrica_calculo: controle.planejamento?.eletrica?.calculo || 'NA',
          planejamento_eletrica_diagrama: controle.planejamento?.eletrica?.diagrama || 'NA',
          planejamento_incendio_concepcao: controle.planejamento?.incendio?.concepcao || 'NA',
          planejamento_incendio_calculo: controle.planejamento?.incendio?.calculo || 'NA',
          planejamento_incendio_diagrama: controle.planejamento?.incendio?.diagrama || 'NA',
          planejamento_sistemas_eletronicos_concepcao: controle.planejamento?.sistemas_eletronicos?.concepcao || 'NA',
          planejamento_sistemas_eletronicos_calculo: controle.planejamento?.sistemas_eletronicos?.calculo || 'NA',
          planejamento_sistemas_eletronicos_diagrama: controle.planejamento?.sistemas_eletronicos?.diagrama || 'NA',
          planejamento_ar_condicionado_concepcao: controle.planejamento?.ar_condicionado?.concepcao || 'NA',
          planejamento_ar_condicionado_calculo: controle.planejamento?.ar_condicionado?.calculo || 'NA',
          planejamento_ar_condicionado_diagrama: controle.planejamento?.ar_condicionado?.diagrama || 'NA',
          planejamento_memorial_esp_tec: controle.planejamento?.memorial?.esp_tec || 'NA',
          planejamento_memorial_matlib: controle.planejamento?.memorial?.matlib || 'NA',
          markup_status: controle.markup_status || 'NA',
          monitoramento_briefing: controle.monitoramento?.briefing || 'NA',
          monitoramento_cronograma: controle.monitoramento?.cronograma || 'NA',
          monitoramento_lmd: controle.monitoramento?.lmd || 'NA',
          monitoramento_entregas_x_etapas: controle.monitoramento?.entregas_x_etapas || 'NA'
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
          planejamento_sistemas_eletronicos_concepcao: 'NA',
          planejamento_sistemas_eletronicos_calculo: 'NA',
          planejamento_sistemas_eletronicos_diagrama: 'NA',
          planejamento_ar_condicionado_concepcao: 'NA',
          planejamento_ar_condicionado_calculo: 'NA',
          planejamento_ar_condicionado_diagrama: 'NA',
          planejamento_memorial_esp_tec: 'NA',
          planejamento_memorial_matlib: 'NA',
          markup_status: 'NA',
          monitoramento_briefing: 'NA',
          monitoramento_cronograma: 'NA',
          monitoramento_lmd: 'NA',
          monitoramento_entregas_x_etapas: 'NA'
        };
      }
    });

    // Filtrar por searchTerm
    const filtered = allControles.filter(controle => {
      const searchLower = searchTerm?.toLowerCase() || '';
      const emp = empreendimentosMap[controle.empreendimento_id];
      return (
        controle.projeto?.toLowerCase().includes(searchLower) ||
        emp?.cliente?.toLowerCase().includes(searchLower) ||
        controle.os?.toLowerCase().includes(searchLower)
      );
    });

    // Ordenar por nome do projeto em ordem crescente
    return filtered.sort((a, b) => {
      const projectoA = a.projeto?.toLowerCase() || '';
      const projectoB = b.projeto?.toLowerCase() || '';
      return projectoA.localeCompare(projectoB);
    });
    }, [controlesOS, empreendimentos, searchTerm, empreendimentosMap]);

  // Opções específicas para Cronograma
  const cronogramaOptions = [
    "NA",
    "Concluído - EX",
    "Concluído - EX R00",
    "Concluído - LO",
    "Concluído - R00",
    "Concluído - R02",
    "Concluído - R04",
    "Concluído - R05",
    "Concluído - R06",
    "Concluído - R07",
    "Hold",
    "Paralisado",
    "Pendente",
    "(Vazias)"
  ];

  // Opções específicas para Markup
  const markupOptions = [
    "NA",
    "Concluído",
    "Concluído - LO",
    "Concluído - EX",
    "Concluído - PR",
    "Em andamento",
    "Hold",
    "Pendente"
  ];

  // Seção PROJETO
  const projetoColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'os', label: 'OS', width: '60px', type: 'text' },
    { key: 'gestao', label: 'Gestão', width: '120px', type: 'gestao' },
    { key: 'formalizacao', label: 'Formalização', width: '150px', type: 'formalizacao' },
    { key: 'abertura_os_servidor', label: 'Abertura OS', width: '80px', isStatus: true },
    { key: 'atividades_planejamento', label: 'Ativ. Planejamento', width: '90px', isStatus: true },
    { key: 'kickoff_cliente', label: 'Kickoff', width: '80px', isStatus: true },
    { key: 'cronograma', label: 'Cronograma', width: '80px', isStatus: true, statusOptions: cronogramaOptions },
    { key: 'markup', label: 'Markup', width: '80px', isStatus: true, statusOptions: markupOptions }
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

  // Seção PLANEJAMENTO - Hidráulica
  const planejamentoHidraulicaColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'planejamento_hidraulica_concepcao', label: 'CONCEPÇÃO', width: '100px', isStatus: true },
    { key: 'planejamento_hidraulica_calculo', label: 'CÁLCULO', width: '100px', isStatus: true },
    { key: 'planejamento_hidraulica_diagrama', label: 'DIAGRAMA', width: '100px', isStatus: true }
  ];

  // Seção PLANEJAMENTO - Incêndio
  const planejamentoIncendioColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'planejamento_incendio_concepcao', label: 'CONCEPÇÃO', width: '100px', isStatus: true },
    { key: 'planejamento_incendio_calculo', label: 'CÁLCULO', width: '100px', isStatus: true },
    { key: 'planejamento_incendio_diagrama', label: 'DIAGRAMA', width: '100px', isStatus: true }
  ];

  // Seção PLANEJAMENTO - Elétrica
  const planejamentoEletricaColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'planejamento_eletrica_concepcao', label: 'CONCEPÇÃO', width: '100px', isStatus: true },
    { key: 'planejamento_eletrica_calculo', label: 'CÁLCULO', width: '100px', isStatus: true },
    { key: 'planejamento_eletrica_diagrama', label: 'DIAGRAMA', width: '100px', isStatus: true }
  ];

  // Seção PLANEJAMENTO - Sistemas Eletrônicos
  const planejamentoSistemasColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'planejamento_sistemas_eletronicos_concepcao', label: 'CONCEPÇÃO', width: '100px', isStatus: true },
    { key: 'planejamento_sistemas_eletronicos_calculo', label: 'CÁLCULO', width: '100px', isStatus: true },
    { key: 'planejamento_sistemas_eletronicos_diagrama', label: 'DIAGRAMA', width: '100px', isStatus: true }
  ];

  // Seção PLANEJAMENTO - Ar Condicionado
  const planejamentoArCondicionadoColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'planejamento_ar_condicionado_concepcao', label: 'CONCEPÇÃO', width: '100px', isStatus: true },
    { key: 'planejamento_ar_condicionado_calculo', label: 'CÁLCULO', width: '100px', isStatus: true },
    { key: 'planejamento_ar_condicionado_diagrama', label: 'DIAGRAMA', width: '100px', isStatus: true }
  ];

  // Seção MEMORIAL
  const memorialColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'planejamento_memorial_esp_tec', label: 'MEMORIAL', width: '100px', isStatus: true }
  ];

  // Seção ESP. TEC.
  const espTecColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'planejamento_memorial_matlib', label: 'ESP. TEC.', width: '100px', isStatus: true }
  ];

  // Seção MARK-UP
  const markupColumns = [
    { key: 'projeto', label: 'PROJETO', width: '200px' },
    { key: 'markup_status', label: 'MARK-UP', width: '100px', isStatus: true }
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
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          PROJETO
                        </th>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle" style={{ width: '200px', minWidth: '200px', height: '38px', padding: '0 8px' }}>
                          PROJETO
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          <td className="border border-gray-300 whitespace-nowrap font-medium align-middle" style={{ height: '30px', padding: '0 8px' }}>
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
                    {/* PROJETO - tabela completa sem coluna Projeto */}
                <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th colSpan={projetoColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                        PROJETO
                      </th>
                    </tr>
                    <tr>
                      {projetoColumns.slice(1).map((col) => (
                        <th
                          key={col.key}
                          className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                          style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredControles.map((row, idx) => (
                      <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                        {projetoColumns.slice(1).map((col) => {
                          const value = row[col.key] || (col.type === 'text' ? '' : 'NA');
                          return (
                            <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                              {col.isStatus ? (
                                <StatusCell 
                                  status={value} 
                                  editable={editable}
                                  onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  customOptions={col.statusOptions}
                                />
                              ) : col.type === 'gestao' ? (
                                <GestaoCell 
                                  value={value === 'NA' ? '' : value}
                                  editable={editable}
                                  onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  usuarios={usuarios}
                                />
                              ) : col.type === 'formalizacao' ? (
                                <FormalizacaoCell 
                                  value={value}
                                  editable={editable}
                                  onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                />
                              ) : value}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                    {/* ART sem coluna Projeto */}
                    <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={artColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          ART
                        </th>
                      </tr>
                      <tr>
                        {artColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {artColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  
                  {/* CONCESSIONÁRIAS sem coluna Projeto */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={concessionariaColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          CONCESSIONÁRIAS
                        </th>
                      </tr>
                      <tr>
                        {concessionariaColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {concessionariaColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* MONITORAMENTO sem coluna Projeto */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={monitoramentoColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          MONITORAMENTO
                        </th>
                      </tr>
                      <tr>
                        {monitoramentoColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {monitoramentoColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* PLANEJAMENTO - HIDRÁULICA */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={planejamentoHidraulicaColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          HIDRÁULICA
                        </th>
                      </tr>
                      <tr>
                        {planejamentoHidraulicaColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {planejamentoHidraulicaColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* PLANEJAMENTO - INCÊNDIO */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={planejamentoIncendioColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          INCÊNDIO
                        </th>
                      </tr>
                      <tr>
                        {planejamentoIncendioColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {planejamentoIncendioColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* PLANEJAMENTO - ELÉTRICA */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={planejamentoEletricaColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          ELÉTRICA
                        </th>
                      </tr>
                      <tr>
                        {planejamentoEletricaColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {planejamentoEletricaColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* PLANEJAMENTO - SISTEMAS ELETRÔNICOS */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={planejamentoSistemasColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          SISTEMAS ELETRÔNICOS
                        </th>
                      </tr>
                      <tr>
                        {planejamentoSistemasColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {planejamentoSistemasColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* PLANEJAMENTO - AR CONDICIONADO */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={planejamentoArCondicionadoColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          AR CONDICIONADO
                        </th>
                      </tr>
                      <tr>
                        {planejamentoArCondicionadoColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {planejamentoArCondicionadoColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* MEMORIAL */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={memorialColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          MEMORIAL
                        </th>
                      </tr>
                      <tr>
                        {memorialColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {memorialColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* ESP. TEC. */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={espTecColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          ESP. TEC.
                        </th>
                      </tr>
                      <tr>
                        {espTecColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {espTecColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* MARK-UP */}
                  <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th colSpan={markupColumns.length - 1} className="border border-gray-300 text-left font-bold align-middle" style={{ height: '38px', padding: '0 16px' }}>
                          MARK-UP
                        </th>
                      </tr>
                      <tr>
                        {markupColumns.slice(1).map((col) => (
                          <th
                            key={col.key}
                            className="border border-gray-300 text-left font-semibold whitespace-nowrap align-middle"
                            style={{ width: col.width, minWidth: col.width, height: '38px', padding: '0 8px' }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredControles.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ height: '30px' }}>
                          {markupColumns.slice(1).map((col) => {
                            const value = row[col.key] || 'NA';
                            return (
                              <td key={col.key} className="border border-gray-300 whitespace-nowrap align-middle" style={{ height: '30px', padding: '0 8px' }}>
                                {col.isStatus ? (
                                  <StatusCell 
                                    status={value} 
                                    editable={editable}
                                    onUpdate={(newValue) => onUpdate && onUpdate(row.id, col.key, newValue)}
                                  />
                                ) : value}
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