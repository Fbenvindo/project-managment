import React, { useState, useEffect, useCallback, useMemo, useContext } from "react";
import { Comercial, Usuario } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, AlertTriangle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

import ComercialCard from "../components/comercial/ComercialCard";
import ComercialForm from "../components/comercial/ComercialForm";
import ComercialFilters from "../components/comercial/ComercialFilters";
import { retryWithBackoff } from "../components/utils/apiUtils";
import { ActivityTimerContext } from '../components/contexts/ActivityTimerContext';

const useComercialData = () => {
  const [data, setData] = useState({
    comerciais: [],
    usuarios: [],
    isLoading: true,
    error: null,
    lastUpdate: null,
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setData(prev => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      const comerciaisData = await retryWithBackoff(
        () => Comercial.list('-updated_date'), 
        5, 3000, 'Comerciais'
      );
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const usuariosData = await retryWithBackoff(
        () => Usuario.list(), 
        3, 2000, 'Usuarios'
      );

      setData({
        comerciais: comerciaisData || [],
        usuarios: usuariosData || [],
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
      });

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      
      let errorMessage = 'Falha ao carregar os dados.';
      const errorMsg = error.message || '';
      
      if (errorMsg.includes('Network Error') || errorMsg.includes('Failed to fetch')) {
        errorMessage = 'Problema de conexão com o servidor.';
      } else if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
        errorMessage = 'Muitas requisições. Aguarde 30 segundos.';
      }

      setData(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    } finally {
      if (isRefresh) setIsRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => loadData(true), [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 500);
    return () => clearTimeout(timer);
  }, [loadData]);

  return { ...data, refresh, isRefreshing, loadData };
};

export default function ComercialPage() {
  const { comerciais, usuarios, isLoading, error, lastUpdate, refresh, isRefreshing, loadData } = useComercialData();
  const { user, hasPermission } = useContext(ActivityTimerContext);

  const [showForm, setShowForm] = useState(false);
  const [editingComercial, setEditingComercial] = useState(null);
  const [filters, setFilters] = useState({ status: 'todos', search: '' });

  const dadosFiltrados = useMemo(() => {
    let filtered = [...comerciais];

    if (filters.status !== 'todos') {
      filtered = filtered.filter(e => e.status === filters.status);
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.nome?.toLowerCase().includes(searchTerm) ||
        e.cliente?.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }, [comerciais, filters]);

  const handleCreate = useCallback(() => {
    setEditingComercial(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((comercial) => {
    setEditingComercial(comercial);
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async (comercialData) => {
    try {
      if (editingComercial) {
        await retryWithBackoff(() => Comercial.update(editingComercial.id, comercialData), 3, 3000, 'Update Comercial');
      } else {
        await retryWithBackoff(() => Comercial.create(comercialData), 3, 3000, 'Create Comercial');
      }
      
      setShowForm(false);
      setEditingComercial(null);
      await loadData(true);
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      alert('Erro ao salvar projeto comercial.');
    }
  }, [editingComercial, loadData]);

  const handleFormSuccess = useCallback(async () => {
    setShowForm(false);
    setEditingComercial(null);
    await loadData(true);
  }, [loadData]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este projeto?")) return;

    try {
      await retryWithBackoff(() => Comercial.delete(id), 3, 2000, 'Delete Comercial');
      await loadData(true);
    } catch (error) {
      console.error('❌ Erro ao excluir:', error);
      alert('Erro ao excluir projeto comercial.');
    }
  }, [loadData]);

  const canEdit = hasPermission('gestao');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <Skeleton className="h-10 w-64 mb-2" />
                <Skeleton className="h-6 w-96" />
              </div>
              <Skeleton className="h-10 w-40" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-64" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="p-6 md:p-8">
          <div className="max-w-4xl mx-auto">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Erro:</strong> {error}
              </AlertDescription>
            </Alert>
            <div className="text-center mt-8">
              <Button onClick={() => loadData()} variant="outline" size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          >
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-purple-600" />
                </div>
                Comercial
                {dadosFiltrados.length > 0 && (
                  <span className="text-lg text-gray-500">({dadosFiltrados.length})</span>
                )}
              </h1>
              <p className="text-gray-600 mt-1">
                Gerencie empreendimentos e projetos comerciais
                {lastUpdate && (
                  <span className="text-sm text-gray-400 block md:inline md:ml-2">
                    • Última atualização: {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Atualizando...' : 'Atualizar'}
              </Button>
              
              {canEdit && (
                <Button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Projeto
                </Button>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <ComercialFilters 
              filters={filters}
              onFiltersChange={setFilters}
              totalCount={comerciais.length}
              filteredCount={dadosFiltrados.length}
            />
          </motion.div>

          <AnimatePresence mode="wait">
            {dadosFiltrados.length > 0 ? (
              <motion.div 
                key="comercial-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {dadosFiltrados.map((comercial, index) => (
                  <motion.div
                    key={comercial.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ComercialCard 
                      empreendimento={comercial}
                      canEdit={canEdit}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {filters.search || filters.status !== 'todos' 
                    ? 'Nenhum projeto encontrado' 
                    : 'Nenhum projeto comercial cadastrado'
                  }
                </h3>
                <p className="text-gray-500 mb-6">
                  {filters.search || filters.status !== 'todos'
                    ? 'Tente ajustar os filtros de busca'
                    : 'Comece criando seu primeiro projeto comercial'
                  }
                </p>
                {(!filters.search && filters.status === 'todos' && canEdit) && (
                  <Button onClick={handleCreate} size="lg" className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Projeto
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showForm && (
              <ComercialForm 
                empreendimento={editingComercial}
                onClose={() => {
                  setShowForm(false);
                  setEditingComercial(null);
                }}
                onSubmit={handleSubmit}
                onSuccess={handleFormSuccess}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}