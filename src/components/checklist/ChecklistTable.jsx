import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit2, Save, X, FolderX, Pencil, Check } from 'lucide-react';

const STATUS_CYCLE = ['-', 'E', 'C', 'NA'];

const STATUS_CONFIG = {
  'E': { label: 'E', bg: 'bg-amber-400', text: 'text-white', title: 'Executado' },
  'C': { label: 'C', bg: 'bg-green-500', text: 'text-white', title: 'Concluído' },
  'NA': { label: 'NA', bg: 'bg-gray-300', text: 'text-gray-700', title: 'Não aplicável' },
  '-': { label: '', bg: 'bg-white hover:bg-gray-50', text: 'text-gray-300', title: 'Vazio - clique para marcar' },
};

function StatusCell({ status, onCycle }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['-'];
  return (
    <button
      onClick={onCycle}
      title={cfg.title}
      className={`w-full h-full min-h-[36px] flex items-center justify-center font-bold text-xs transition-colors ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label || <span className="text-gray-200 text-xs">—</span>}
    </button>
  );
}

export default function ChecklistTable({ secao, items, checklist, documentos = [], onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingSecao, setEditingSecao] = useState(false);
  const [novoNomeSecao, setNovoNomeSecao] = useState(secao);
  const [savingStatus, setSavingStatus] = useState({}); // track which cells are saving
  const [formData, setFormData] = useState({
    numero_item: '',
    descricao: '',
    contribuicao: '',
    tempo: '',
    observacoes: ''
  });

  // Colunas: documentos do empreendimento ou periodos legados
  const colunas = documentos.length > 0
    ? documentos.map(d => ({ key: d.numero || d.id, label: d.arquivo || d.numero || d.descritivo || d.id }))
    : (checklist.periodos || []).map(p => ({ key: p, label: p }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      checklist_id: checklist.id,
      secao: secao,
      numero_item: formData.numero_item,
      descricao: formData.descricao,
      contribuicao: formData.contribuicao || '',
      tempo: formData.tempo || '',
      observacoes: formData.observacoes || '',
      ordem: editingItem ? editingItem.ordem : (items.length + 1),
      status_por_periodo: editingItem?.status_por_periodo || {}
    };

    if (editingItem) {
      await base44.entities.ChecklistItem.update(editingItem.id, data);
    } else {
      await base44.entities.ChecklistItem.create(data);
    }

    setShowForm(false);
    setEditingItem(null);
    setFormData({ numero_item: '', descricao: '', contribuicao: '', tempo: '', observacoes: '' });
    onUpdate();
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      numero_item: item.numero_item,
      descricao: item.descricao,
      contribuicao: item.contribuicao || '',
      tempo: item.tempo || '',
      observacoes: item.observacoes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Deseja realmente excluir este item?')) return;
    await base44.entities.ChecklistItem.delete(itemId);
    onUpdate();
  };

  const handleStatusCycle = async (item, colKey) => {
    const current = item.status_por_periodo?.[colKey] || '-';
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];

    const cellId = `${item.id}-${colKey}`;
    setSavingStatus(prev => ({ ...prev, [cellId]: true }));

    const statusAtualizado = { ...(item.status_por_periodo || {}), [colKey]: next };
    await base44.entities.ChecklistItem.update(item.id, { status_por_periodo: statusAtualizado });

    setSavingStatus(prev => ({ ...prev, [cellId]: false }));
    onUpdate();
  };

  const handleDeleteSecao = async () => {
    if (!window.confirm(`Tem certeza que deseja excluir toda a seção "${secao}" com ${items.length} item(ns)?`)) return;
    setIsDeleting(true);
    for (const item of items) {
      await base44.entities.ChecklistItem.delete(item.id);
    }
    setIsDeleting(false);
    onUpdate();
  };

  const handleRenameSecao = async () => {
    if (!novoNomeSecao.trim()) return;
    for (const item of items) {
      await base44.entities.ChecklistItem.update(item.id, { secao: novoNomeSecao });
    }
    setEditingSecao(false);
    onUpdate();
  };

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-4">
      {/* Header da seção */}
      <div className="bg-slate-800 text-white px-4 py-2.5 flex justify-between items-center gap-4">
        {editingSecao ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={novoNomeSecao}
              onChange={(e) => setNovoNomeSecao(e.target.value)}
              className="bg-white text-gray-900 h-7 text-sm max-w-sm"
              autoFocus
            />
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleRenameSecao}>
              <Check className="w-3 h-3 mr-1" /> Salvar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingSecao(false); setNovoNomeSecao(secao); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-wide">{secao}</span>
            <button onClick={() => setEditingSecao(true)} className="text-slate-400 hover:text-white transition-colors ml-1">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-700"
            onClick={() => { setShowForm(!showForm); setEditingItem(null); setFormData({ numero_item: '', descricao: '', contribuicao: '', tempo: '', observacoes: '' }); }}
          >
            {showForm ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
            {showForm ? 'Cancelar' : 'Adicionar Item'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-slate-700"
            onClick={handleDeleteSecao}
            disabled={isDeleting}
          >
            <FolderX className="w-3 h-3 mr-1" />
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </div>

      {/* Formulário de adição/edição */}
      {showForm && (
        <form onSubmit={handleSubmit} className="px-4 py-3 bg-blue-50 border-b border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Número *</label>
              <Input value={formData.numero_item} onChange={(e) => setFormData({ ...formData, numero_item: e.target.value })} placeholder="Ex: 1.1" required className="h-8 text-sm" />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-gray-700 block mb-1">Descrição *</label>
              <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Descrição do item" required className="min-h-[52px] text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Contribuição</label>
              <Input value={formData.contribuicao} onChange={(e) => setFormData({ ...formData, contribuicao: e.target.value })} placeholder="%" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Tempo</label>
              <Input value={formData.tempo} onChange={(e) => setFormData({ ...formData, tempo: e.target.value })} placeholder="dias" className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-700 block mb-1">Observações</label>
              <Input value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Opcional" className="h-8 text-sm" />
            </div>
            <div className="flex gap-2 mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingItem(null); }}>Cancelar</Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-3 h-3 mr-1" />
                {editingItem ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Tabela com scroll horizontal */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${400 + colunas.length * 60}px` }}>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              {/* Colunas fixas */}
              <th className="sticky left-0 z-10 bg-gray-100 border-r border-gray-200 text-center text-xs font-semibold text-gray-600 py-2 px-2 w-14">Item</th>
              <th className="sticky left-14 z-10 bg-gray-100 border-r border-gray-200 text-left text-xs font-semibold text-gray-600 py-2 px-3" style={{ minWidth: '260px' }}>Descrição</th>
              <th className="bg-gray-100 border-r border-gray-200 text-center text-xs font-semibold text-gray-600 py-2 px-2 w-20">Contrib.</th>
              {/* Colunas de status - cabeçalho rotacionado */}
              {colunas.map((col, idx) => (
                <th
                  key={idx}
                  className="border-r border-gray-200 text-center bg-gray-100"
                  style={{ width: '56px', minWidth: '56px', maxWidth: '56px' }}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ height: '80px' }}
                  >
                    <span
                      title={col.label}
                      className="text-xs font-medium text-gray-700 leading-tight"
                      style={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        maxHeight: '76px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {col.label}
                    </span>
                  </div>
                </th>
              ))}
              <th className="bg-gray-100 border-r border-gray-200 text-left text-xs font-semibold text-gray-600 py-2 px-3" style={{ minWidth: '140px' }}>Observações</th>
              <th className="bg-gray-100 text-center text-xs font-semibold text-gray-600 py-2 px-2 w-16">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={colunas.length + 4} className="text-center py-8 text-gray-400 text-sm">
                  Nenhum item. Clique em "Adicionar Item" para começar.
                </td>
              </tr>
            ) : (
              items.map((item, rowIdx) => (
                <tr key={item.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  {/* Item nº - sticky */}
                  <td className="sticky left-0 z-10 border-r border-b border-gray-100 text-center font-semibold text-xs text-gray-700 py-2 px-2"
                      style={{ background: rowIdx % 2 === 0 ? 'white' : '#fafafa' }}>
                    {item.numero_item}
                  </td>
                  {/* Descrição - sticky */}
                  <td className="sticky left-14 z-10 border-r border-b border-gray-100 text-sm text-gray-800 py-2 px-3 leading-snug"
                      style={{ background: rowIdx % 2 === 0 ? 'white' : '#fafafa', minWidth: '260px' }}>
                    {item.descricao}
                  </td>
                  {/* Contribuição */}
                  <td className="border-r border-b border-gray-100 text-center text-xs text-gray-600 py-2 px-2">
                    {item.contribuicao || '—'}
                  </td>
                  {/* Células de status */}
                  {colunas.map((col, idx) => {
                    const status = item.status_por_periodo?.[col.key] || '-';
                    const cellId = `${item.id}-${col.key}`;
                    const isSaving = savingStatus[cellId];
                    return (
                      <td key={idx} className="border-r border-b border-gray-100 p-0" style={{ width: '56px', minWidth: '56px' }}>
                        <StatusCell
                          status={isSaving ? status : status}
                          onCycle={() => !isSaving && handleStatusCycle(item, col.key)}
                        />
                      </td>
                    );
                  })}
                  {/* Observações */}
                  <td className="border-r border-b border-gray-100 text-xs text-gray-500 py-2 px-3">
                    {item.observacoes || '—'}
                  </td>
                  {/* Ações */}
                  <td className="border-b border-gray-100 text-center py-1 px-1">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legenda inline */}
      {colunas.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
          <span className="font-medium text-gray-600">Legenda:</span>
          <span className="flex items-center gap-1"><span className="inline-block w-5 h-4 rounded bg-amber-400"></span> Executado</span>
          <span className="flex items-center gap-1"><span className="inline-block w-5 h-4 rounded bg-green-500"></span> Concluído</span>
          <span className="flex items-center gap-1"><span className="inline-block w-5 h-4 rounded bg-gray-300"></span> Não aplicável</span>
          <span className="text-gray-400 ml-2">• Clique nas células para alternar o status</span>
        </div>
      )}
    </div>
  );
}