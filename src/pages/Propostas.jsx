import React, { useState, useEffect, useMemo } from "react";
import { FileText, Loader2, Plus, Search, LayoutList, BarChart2 } from "lucide-react";
import { Comercial } from "@/entities/all";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import PropostaCard from "@/components/propostas/PropostaCard";
import PropostaDetailPanel from "@/components/propostas/PropostaDetailPanel";
import PropostaFormModal from "@/components/propostas/PropostaFormModal";
import ResumoMensalStrip from "@/components/propostas/ResumoMensalStrip";
import { normalizeStatus } from "@/components/propostas/PropostaStatusBadge";

const delay = (ms) => new Promise(res => setTimeout(res, ms));
async function localRetry(fn, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (err) {
      if (i === retries - 1) throw err;
      await delay(delayMs * Math.pow(2, i));
    }
  }
}

const EMPTY_FORM = {
  numero: '', data_solicitacao: '', solicitante: '', cliente: '', empreendimento: '',
  tipo_empreendimento: '', tipo_obra: '', utilizacao: '', parceiros: [], disciplinas: [],
  codisciplinas: [], pavimentos: [], escopo: '', area: '', estado: '',
  valor_bim: '', valor_cad: '', data_aprovacao: '', status: 'solicitado', email: '',
  telefone: '', observacao: ''
};

const getDateForGrouping = (p) => {
  const status = normalizeStatus(p.status || 'solicitado');
  if (status === 'aprovado' && p.data_aprovacao) return p.data_aprovacao;
  return p.data_solicitacao || p.created_at || p.updated_date || null;
};

export default function PropostasPage() {
  const [propostas, setPropostas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedProposta, setSelectedProposta] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [view, setView] = useState('list'); // 'list' | 'resumo'
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => { loadPropostas(); }, []);

  const loadPropostas = async () => {
    setIsLoading(true);
    try {
      const data = await localRetry(() => Comercial.list('-updated_date'));
      const sorted = (data || []).sort((a, b) => (b.numero || '').localeCompare(a.numero || '', 'pt-BR'));
      setPropostas(sorted);
    } catch (error) {
      console.error('Erro ao carregar propostas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resumoMensal = useMemo(() => {
    const groups = {};
    (propostas || []).forEach(p => {
      const raw = getDateForGrouping(p);
      let monthKey = 'Sem Data';
      if (raw) {
        try {
          const d = typeof raw === 'string' ? parseISO(raw) : new Date(raw);
          if (!isNaN(d.getTime())) monthKey = format(d, 'yyyy-MM');
        } catch { /* noop */ }
      }
      if (!groups[monthKey]) groups[monthKey] = {
        items: [], totalBim: 0, totalCad: 0,
        byStatus: { solicitado: { count: 0, bim: 0, cad: 0 }, em_analise: { count: 0, bim: 0, cad: 0 }, aprovado: { count: 0, bim: 0, cad: 0 }, reprovado: { count: 0, bim: 0, cad: 0 } }
      };
      groups[monthKey].items.push(p);
      const bim = Number(p.valor_bim || 0) || 0;
      const cad = Number(p.valor_cad || 0) || 0;
      groups[monthKey].totalBim += bim;
      groups[monthKey].totalCad += cad;
      const status = normalizeStatus(p.status || 'solicitado');
      if (!groups[monthKey].byStatus[status]) groups[monthKey].byStatus[status] = { count: 0, bim: 0, cad: 0 };
      groups[monthKey].byStatus[status].count += 1;
      groups[monthKey].byStatus[status].bim += bim;
      groups[monthKey].byStatus[status].cad += cad;
    });
    return Object.keys(groups).sort((a, b) => a < b ? 1 : -1).map(k => ({ month: k, ...groups[k] }));
  }, [propostas]);

  // Auto-select most recent month
  useEffect(() => {
    if (resumoMensal.length > 0 && !selectedMonth) {
      setSelectedMonth(resumoMensal[0].month);
    }
  }, [resumoMensal]);

  const filteredPropostas = useMemo(() => {
    return propostas.filter(p => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        p.numero?.toLowerCase().includes(searchLower) ||
        p.cliente?.toLowerCase().includes(searchLower) ||
        p.empreendimento?.toLowerCase().includes(searchLower) ||
        p.solicitante?.toLowerCase().includes(searchLower)
      );
      const matchesStatus = statusFilter === 'todos' || normalizeStatus(p.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [propostas, searchTerm, statusFilter]);

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, data_solicitacao: format(new Date(), 'yyyy-MM-dd') });
    setIsModalOpen(true);
  };

  const openEditModal = (proposta) => {
    setEditingId(proposta.id);
    setFormData({
      numero: proposta.numero || '', data_solicitacao: proposta.data_solicitacao || '',
      solicitante: proposta.solicitante || '', cliente: proposta.cliente || '',
      empreendimento: proposta.empreendimento || '', tipo_empreendimento: proposta.tipo_empreendimento || '',
      tipo_obra: proposta.tipo_obra || '', utilizacao: proposta.utilizacao || '',
      parceiros: proposta.parceiros || [], disciplinas: proposta.disciplinas || [],
      codisciplinas: proposta.codisciplinas || [], pavimentos: proposta.pavimentos || [],
      escopo: proposta.escopo || '', area: proposta.area?.toString() || '',
      estado: proposta.estado || '', valor_bim: proposta.valor_bim?.toString() || '',
      valor_cad: proposta.valor_cad?.toString() || '', data_aprovacao: proposta.data_aprovacao || '',
      status: proposta.status || 'solicitado', email: proposta.email || '',
      telefone: proposta.telefone || '', observacao: proposta.observacao || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.numero || !formData.cliente || !formData.empreendimento) {
      alert('Preencha os campos obrigatórios: Número, Cliente e Empreendimento');
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        area: formData.area ? Number(formData.area) : undefined,
        valor_bim: formData.valor_bim ? Number(formData.valor_bim) : undefined,
        valor_cad: formData.valor_cad ? Number(formData.valor_cad) : undefined
      };
      if (editingId) {
        await localRetry(() => Comercial.update(editingId, dataToSave));
        // update selected proposta if it's the one being edited
        if (selectedProposta?.id === editingId) setSelectedProposta({ ...selectedProposta, ...dataToSave });
      } else {
        await localRetry(() => Comercial.create(dataToSave));
      }
      setIsModalOpen(false);
      setEditingId(null);
      await loadPropostas();
    } catch (error) {
      alert('Erro ao salvar proposta: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const statusFilters = [
    { key: 'todos', label: 'Todos' },
    { key: 'aprovado', label: 'Aprovados' },
    { key: 'em_analise', label: 'Ag. Aprovação' },
    { key: 'solicitado', label: 'Solicitados' },
    { key: 'reprovado', label: 'Não Aprovados' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Propostas</h1>
              <p className="text-xs text-gray-500">{propostas.length} no total</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <LayoutList className="w-4 h-4" />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setView('resumo')}
                className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${view === 'resumo' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <BarChart2 className="w-4 h-4" />
                <span className="hidden sm:inline">Resumo</span>
              </button>
            </div>
            <Button onClick={openNewModal} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Proposta</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-6 py-5 flex gap-5">

        {view === 'resumo' ? (
          /* ── Resumo View ── */
          <div className="flex-1 space-y-6">
            <ResumoMensalStrip
              resumoMensal={resumoMensal}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
            />
            {/* Proposta list for selected month */}
            {selectedMonth && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Propostas de {selectedMonth === 'Sem Data' ? 'Sem Data' : format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {(resumoMensal.find(g => g.month === selectedMonth)?.items || []).map(item => (
                    <PropostaCard
                      key={item.id}
                      proposta={item}
                      isSelected={selectedProposta?.id === item.id}
                      onClick={() => { setSelectedProposta(item); setView('list'); }}
                      onEdit={openEditModal}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── List View ── */
          <>
            {/* Left: list */}
            <div className={`flex flex-col gap-3 transition-all ${selectedProposta ? 'w-full md:w-1/2 lg:w-2/5' : 'w-full'}`}>
              {/* Search + filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Pesquisar número, cliente, empreendimento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {statusFilters.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        statusFilter === f.key
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards */}
              <div className="overflow-y-auto space-y-2" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                {filteredPropostas.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma proposta encontrada</p>
                  </div>
                ) : (
                  filteredPropostas.map(p => (
                    <PropostaCard
                      key={p.id}
                      proposta={p}
                      isSelected={selectedProposta?.id === p.id}
                      onClick={() => setSelectedProposta(prev => prev?.id === p.id ? null : p)}
                      onEdit={openEditModal}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right: detail panel */}
            {selectedProposta && (
              <div className="hidden md:flex flex-col flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ maxHeight: 'calc(100vh - 140px)', position: 'sticky', top: '80px' }}>
                <PropostaDetailPanel
                  proposta={selectedProposta}
                  onClose={() => setSelectedProposta(null)}
                  onEdit={openEditModal}
                />
              </div>
            )}
          </>
        )}
      </div>

      <PropostaFormModal
        open={isModalOpen}
        onOpenChange={(open) => { setIsModalOpen(open); if (!open) setEditingId(null); }}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        isSaving={isSaving}
        editingId={editingId}
      />
    </div>
  );
}