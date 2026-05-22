import React, { useState, useRef, useEffect, memo } from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: 'concluido', label: 'Concluído', color: 'bg-green-600', textColor: 'text-white' },
  { value: 'pendente', label: 'Pendente', color: 'bg-amber-300', textColor: 'text-amber-900' },
  { value: 'em_andamento', label: 'Em andamento', color: 'bg-blue-500', textColor: 'text-white' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-400', textColor: 'text-white' },
  { value: 'na', label: 'N/A', color: 'bg-gray-400', textColor: 'text-white' },
];

// Textarea com auto-resize
const AutoResizeTextarea = memo(({ value, onChange, className, ...props }) => {
  const textareaRef = useRef(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    adjustHeight();
    const timer = setTimeout(adjustHeight, 0);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => { onChange(e); adjustHeight(); }}
      className={className}
      style={{ minHeight: '40px' }}
      {...props}
    />
  );
});

// Input de resposta — sem debounce para garantir sincronismo com o auto-save
const RespostaInput = memo(({ value, onChange, onRemove }) => {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => { setLocalValue(value || ''); }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="flex gap-1 items-start print:hidden">
      <AutoResizeTextarea
        value={localValue}
        onChange={handleChange}
        className="text-sm flex-1 resize-none overflow-hidden min-h-[40px]"
        placeholder="Digite a resposta..."
      />
      <button onClick={onRemove} className="text-red-500 hover:text-red-700 p-1" title="Remover resposta">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
});

// Item de providência completamente isolado com estado local para os campos de texto
const ProvidenciaItem = memo(({ prov, usuarios, onUpdate, onDelete, onInsertAfter, userPerfil }) => {
  // Estado local para campos de texto — evita re-render do pai a cada keystroke
  const [localProvidencias, setLocalProvidencias] = useState(prov.providencias || '');

  // Sincronizar se o valor externo mudar (ex: ao carregar)
  useEffect(() => {
    setLocalProvidencias(prov.providencias || '');
  }, [prov.id]); // só sincroniza quando o ID muda (item diferente), não a cada atualização

  const handleProvidenciasChange = (e) => {
    const val = e.target.value;
    setLocalProvidencias(val);
    // Atualiza o pai imediatamente para que o auto-save sempre leia o valor correto
    onUpdate(prov.id, 'providencias', val);
  };

  const getStatusColor = (status) => {
    const found = STATUS_OPTIONS.find(s => s.value === status);
    return found ? `${found.color} ${found.textColor}` : 'bg-gray-300 text-white';
  };

  const getStatusLabel = (status) => {
    const found = STATUS_OPTIONS.find(s => s.value === status);
    return found ? found.label : status;
  };

  return (
    <div className="flex gap-2 border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Container Principal - 80% */}
      <div className="w-[80%] p-3 space-y-2">
        {/* Providências */}
        <div className="flex gap-2">
          <label className="text-xs font-medium text-gray-600 min-w-[80px] pt-1">Providências:</label>
          {userPerfil === 'apoio' ? (
            <span className="text-sm flex-1 whitespace-pre-wrap">{prov.providencias}</span>
          ) : (
            <AutoResizeTextarea
              value={localProvidencias}
              onChange={handleProvidenciasChange}
              className="text-sm print:hidden flex-1 resize-none overflow-hidden min-h-[60px]"
            />
          )}
          <span className="hidden print:inline text-[6px] flex-1 whitespace-pre-wrap">{prov.providencias}</span>
        </div>

        {/* Respostas */}
        <div className="flex gap-2">
          <label className="text-xs font-medium text-gray-600 min-w-[80px] pt-1">Respostas:</label>
          <div className="flex-1 space-y-2">
            {(prov.respostas || []).map((resp, rIdx) => (
              userPerfil === 'apoio' ? (
                <div key={rIdx} className="text-sm">{resp}</div>
              ) : (
                <RespostaInput
                  key={rIdx}
                  value={resp}
                  onChange={(newValue) => {
                    const novasRespostas = [...(prov.respostas || [])];
                    novasRespostas[rIdx] = newValue;
                    onUpdate(prov.id, 'respostas', novasRespostas);
                  }}
                  onRemove={() => {
                    const novasRespostas = (prov.respostas || []).filter((_, i) => i !== rIdx);
                    onUpdate(prov.id, 'respostas', novasRespostas);
                  }}
                />
              )
            ))}
            <div className="hidden print:block text-[6px] whitespace-pre-wrap">
              {(prov.respostas || []).map((resp, rIdx) => (
                <div key={rIdx} className="mb-1">• {resp}</div>
              ))}
            </div>
            {userPerfil !== 'apoio' && (
              <button
                onClick={() => onUpdate(prov.id, 'respostas', [...(prov.respostas || []), ''])}
                className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 print:hidden"
              >
                <Plus className="w-3 h-3" />
                Adicionar Resposta
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Container Secundário - 20% */}
      <div className="w-[20%] border-l border-gray-300 p-3 space-y-3 bg-gray-50">
        {/* Responsável */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Responsável:</label>
          <Select
            value={prov.responsaveis?.[0] || ''}
            onValueChange={(value) => onUpdate(prov.id, 'responsaveis', [value])}
          >
            <SelectTrigger className="h-8 text-xs print:hidden">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map(user => (
                <SelectItem key={user.id} value={user.nome || user.full_name}>
                  {user.nome || user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden print:inline text-[6px]">
            {Array.isArray(prov.responsaveis) ? prov.responsaveis.join(', ') : ''}
          </span>
        </div>

        {/* Data Reunião */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Data Reunião:</label>
          <Input
            type="date"
            value={prov.dataReuniao}
            onChange={(e) => onUpdate(prov.id, 'dataReuniao', e.target.value)}
            className="h-8 text-xs print:hidden"
          />
          <span className="hidden print:inline text-[6px]">
            {prov.dataReuniao ? format(new Date(prov.dataReuniao), 'dd/MM/yyyy') : ''}
          </span>
        </div>

        {/* Data Retorno */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Data Retorno:</label>
          <Input
            type="date"
            value={prov.dataRetorno}
            onChange={(e) => onUpdate(prov.id, 'dataRetorno', e.target.value)}
            className="h-8 text-xs print:hidden"
          />
          <span className="hidden print:inline text-[6px]">
            {prov.dataRetorno ? format(new Date(prov.dataRetorno), 'dd/MM/yyyy') : ''}
          </span>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Status:</label>
          <select
            value={prov.status}
            onChange={(e) => onUpdate(prov.id, 'status', e.target.value)}
            className={`w-full text-xs px-2 py-1 rounded ${getStatusColor(prov.status)} print:hidden`}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span className={`hidden print:inline text-[6px] px-1 py-0.5 rounded ${getStatusColor(prov.status)}`}>
            {getStatusLabel(prov.status)}
          </span>
        </div>

        {/* Ações */}
        {userPerfil !== 'apoio' && (
          <div className="flex gap-1 pt-2 border-t border-gray-300 no-print">
            <button
              onClick={() => onInsertAfter(prov.id)}
              className="flex-1 text-green-600 hover:text-green-800 hover:bg-green-50 p-1 rounded"
              title="Inserir providência após esta"
            >
              <Plus className="w-3 h-3 mx-auto" />
            </button>
            <button
              onClick={() => onDelete(prov.id)}
              className="flex-1 text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
              title="Excluir"
            >
              <Trash2 className="w-3 h-3 mx-auto" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default ProvidenciaItem;