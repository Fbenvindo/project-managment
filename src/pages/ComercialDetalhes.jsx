import React, { useState, useEffect, useContext } from "react";
import { Comercial, Documento, Pavimento, Disciplina, Usuario, Atividade, Execucao } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { retryWithBackoff } from "../components/utils/apiUtils";
import { ActivityTimerContext } from "../components/contexts/ActivityTimerContext";

// Importar os mesmos componentes de abas usados em Empreendimento
import EmpreendimentoHeader from "../components/empreendimento/EmpreendimentoHeader";
import DocumentosTab from "../components/empreendimento/DocumentosTab";
import PavimentosTab from "../components/empreendimento/PavimentosTab";
import AnaliticoGlobalTab from "../components/empreendimento/AnaliticoGlobalTab";
import AtividadesProjetoTab from "../components/empreendimento/AtividadesProjetoTab";
import GestaoTab from "../components/empreendimento/GestaoTab";

export default function ComercialDetalhesPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const comercialId = urlParams.get("id");

  const { hasPermission } = useContext(ActivityTimerContext);

  const [comercial, setComercial] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("documentos");

  // Dados compartilhados
  const [sharedData, setSharedData] = useState({
    disciplinas: [],
    usuarios: [],
    atividades: [],
    execucoes: [],
  });
  const [isLoadingShared, setIsLoadingShared] = useState(true);

  // Dados específicos de cada aba
  const [tabData, setTabData] = useState({
    documentos: { data: [], loaded: false, loading: false },
    pavimentos: { data: [], loaded: false, loading: false },
    atividades: { data: [], loaded: false, loading: false },
  });

  // Carregar dados do comercial
  useEffect(() => {
    const loadComercial = async () => {
      if (!comercialId) {
        setError("ID do projeto comercial não encontrado");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const comercialData = await retryWithBackoff(
          () => Comercial.list(),
          3,
          2000,
          "ComercialDetalhes-Comercial"
        );
        const found = comercialData.find((c) => c.id === comercialId);
        
        if (!found) {
          setError("Projeto comercial não encontrado");
        } else {
          setComercial(found);
        }
      } catch (err) {
        console.error("Erro ao carregar comercial:", err);
        setError("Erro ao carregar dados do projeto");
      } finally {
        setIsLoading(false);
      }
    };

    loadComercial();
  }, [comercialId]);

  // Carregar dados compartilhados
  useEffect(() => {
    const loadSharedData = async () => {
      if (!comercial) return;

      setIsLoadingShared(true);
      try {
        const [disciplinas, usuarios, atividades, execucoes] = await Promise.all([
          retryWithBackoff(() => Disciplina.list(), 3, 2000, "ComercialDetalhes-Disciplinas"),
          retryWithBackoff(() => Usuario.list(), 3, 2000, "ComercialDetalhes-Usuarios"),
          retryWithBackoff(() => Atividade.list(), 3, 2000, "ComercialDetalhes-Atividades"),
          retryWithBackoff(() => Execucao.list(), 3, 2000, "ComercialDetalhes-Execucoes"),
        ]);

        setSharedData({
          disciplinas: disciplinas || [],
          usuarios: usuarios || [],
          atividades: atividades || [],
          execucoes: execucoes || [],
        });
      } catch (err) {
        console.error("Erro ao carregar dados compartilhados:", err);
      } finally {
        setIsLoadingShared(false);
      }
    };

    loadSharedData();
  }, [comercial]);

  // Carregar dados específicos da aba ativa
  useEffect(() => {
    if (!comercial || !comercial.id || isLoadingShared) return;

    const loadTabData = async (tab) => {
      if (tabData[tab]?.loaded || tabData[tab]?.loading) return;

      setTabData((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], loading: true },
      }));

      try {
        let data = [];
        if (tab === "documentos") {
          const docs = await retryWithBackoff(
            () => Documento.filter({ empreendimento_id: comercial.id }),
            3,
            2000,
            "ComercialDetalhes-Documentos"
          );
          data = docs || [];
        } else if (tab === "pavimentos") {
          const pavs = await retryWithBackoff(
            () => Pavimento.filter({ empreendimento_id: comercial.id }),
            3,
            2000,
            "ComercialDetalhes-Pavimentos"
          );
          data = pavs || [];
        } else if (tab === "atividades") {
          const ativs = await retryWithBackoff(
            () => Atividade.filter({ empreendimento_id: comercial.id }),
            3,
            2000,
            "ComercialDetalhes-AtividadesProjeto"
          );
          data = ativs || [];
        }

        setTabData((prev) => ({
          ...prev,
          [tab]: { data, loaded: true, loading: false },
        }));
      } catch (err) {
        console.error(`Erro ao carregar ${tab}:`, err);
        setTabData((prev) => ({
          ...prev,
          [tab]: { ...prev[tab], loading: false },
        }));
      }
    };

    loadTabData(activeTab);
  }, [activeTab, comercial, isLoadingShared]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleReload = async () => {
    setTabData({
      documentos: { data: [], loaded: false, loading: false },
      pavimentos: { data: [], loaded: false, loading: false },
      atividades: { data: [], loaded: false, loading: false },
    });
    setIsLoadingShared(true);
    
    // Recarregar dados
    const loadSharedData = async () => {
      try {
        const [disciplinas, usuarios, atividades, execucoes] = await Promise.all([
          retryWithBackoff(() => Disciplina.list(), 3, 2000, "Reload-Disciplinas"),
          retryWithBackoff(() => Usuario.list(), 3, 2000, "Reload-Usuarios"),
          retryWithBackoff(() => Atividade.list(), 3, 2000, "Reload-Atividades"),
          retryWithBackoff(() => Execucao.list(), 3, 2000, "Reload-Execucoes"),
        ]);

        setSharedData({
          disciplinas: disciplinas || [],
          usuarios: usuarios || [],
          atividades: atividades || [],
          execucoes: execucoes || [],
        });
      } catch (err) {
        console.error("Erro ao recarregar:", err);
      } finally {
        setIsLoadingShared(false);
      }
    };

    await loadSharedData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !comercial) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800">{error || "Projeto comercial não encontrado"}</p>
          </div>
          <Link to={createPageUrl("Comercial")}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Comercial
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-6 space-y-6">
        <div className="max-w-7xl mx-auto">
          <Link to={createPageUrl("Comercial")}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Comercial
            </Button>
          </Link>

          <EmpreendimentoHeader empreendimento={comercial} onReload={handleReload} />

          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
            <TabsList className="bg-white border-b w-full justify-start rounded-none h-auto p-0">
              <TabsTrigger value="documentos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600">
                Documentos
              </TabsTrigger>
              <TabsTrigger value="pavimentos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600">
                Pavimentos
              </TabsTrigger>
              <TabsTrigger value="analitico" className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600">
                Analítico Global
              </TabsTrigger>
              <TabsTrigger value="atividades" className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600">
                Atividades do Projeto
              </TabsTrigger>
              {(hasPermission('coordenador') || hasPermission('gestao')) && (
                <TabsTrigger value="gestao" className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-600">
                  Gestão
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="documentos" className="mt-6">
              {isLoadingShared ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : (
                <DocumentosTab
                  empreendimento={comercial}
                  documentos={tabData.documentos.data}
                  pavimentos={tabData.pavimentos.data}
                  disciplinas={sharedData.disciplinas}
                  onReload={handleReload}
                />
              )}
            </TabsContent>

            <TabsContent value="pavimentos" className="mt-6">
              {isLoadingShared ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : (
                <PavimentosTab
                  empreendimentoId={comercial.id}
                  pavimentos={tabData.pavimentos.data}
                  onReload={handleReload}
                />
              )}
            </TabsContent>

            <TabsContent value="analitico" className="mt-6">
              {isLoadingShared ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : (
                <AnaliticoGlobalTab
                  empreendimento={comercial}
                  documentos={tabData.documentos.data}
                  disciplinas={sharedData.disciplinas}
                  atividades={sharedData.atividades}
                  usuarios={sharedData.usuarios}
                  execucoes={sharedData.execucoes}
                  onReload={handleReload}
                />
              )}
            </TabsContent>

            <TabsContent value="atividades" className="mt-6">
              {isLoadingShared ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : (
                <AtividadesProjetoTab
                  empreendimentoId={comercial.id}
                  atividades={tabData.atividades.data}
                  disciplinas={sharedData.disciplinas}
                  onReload={handleReload}
                />
              )}
            </TabsContent>

            <TabsContent value="gestao" className="mt-6">
              {isLoadingShared ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : (
                <GestaoTab
                  empreendimento={comercial}
                  documentos={tabData.documentos.data}
                  usuarios={sharedData.usuarios}
                  onReload={handleReload}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}