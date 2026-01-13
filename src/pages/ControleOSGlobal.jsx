import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Search, Loader2, Building2, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const getStatusColor = (status) => {
  const colors = {
    "NA": "bg-gray-200 text-gray-800",
    "Concluído": "bg-green-200 text-green-800",
    "Pendente": "bg-red-200 text-red-800",
    "Em andamento": "bg-yellow-200 text-yellow-800",
    "Hold": "bg-orange-200 text-orange-800",
    "Paralisado": "bg-orange-300 text-orange-900",
    "Técnico": "bg-blue-200 text-blue-800",
    "Ag. Liberação": "bg-cyan-200 text-cyan-800",
    "Finalizado": "bg-purple-200 text-purple-800",
    "Em aprovação": "bg-yellow-300 text-yellow-900"
  };
  return colors[status] || "bg-gray-200 text-gray-800";
};

export default function ControleOSGlobal() {
  const [controlesOS, setControlesOS] = useState([]);
  const [empreendimentos, setEmpreendimentos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [controles, emps] = await Promise.all([
        base44.entities.ControleOS.list(),
        base44.entities.Empreendimento.list()
      ]);

      setControlesOS(controles || []);
      setEmpreendimentos(emps || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const empreendimentosMap = empreendimentos.reduce((acc, emp) => {
    acc[emp.id] = emp;
    return acc;
  }, {});

  const filteredControles = controlesOS.filter(controle => {
    const emp = empreendimentosMap[controle.empreendimento_id];
    const searchLower = searchTerm.toLowerCase();
    return (
      emp?.nome?.toLowerCase().includes(searchLower) ||
      emp?.cliente?.toLowerCase().includes(searchLower) ||
      controle.os?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-blue-600" />
              Controle de OS - Todos os Empreendimentos
            </CardTitle>
            <Badge variant="secondary" className="text-lg">
              {filteredControles.length} {filteredControles.length === 1 ? 'empreendimento' : 'empreendimentos'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por empreendimento, cliente ou OS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredControles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'Nenhum empreendimento encontrado' : 'Nenhum controle de OS cadastrado'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredControles.map(controle => {
            const emp = empreendimentosMap[controle.empreendimento_id];
            if (!emp) return null;

            return (
              <Card key={controle.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{emp.nome}</h3>
                        <Link to={createPageUrl(`Empreendimento?id=${emp.id}&tab=controle-os`)}>
                          <Button variant="ghost" size="sm" className="h-7">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span><strong>Cliente:</strong> {emp.cliente}</span>
                        <span><strong>OS:</strong> {controle.os || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {/* Gestão Geral */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Gestão Geral</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Gestão</p>
                        <Badge className={getStatusColor(controle.gestao)}>{controle.gestao}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Formalização</p>
                        <Badge className={getStatusColor(controle.formalizacao)}>{controle.formalizacao}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Abertura OS</p>
                        <Badge className={getStatusColor(controle.abertura_os_servidor)}>{controle.abertura_os_servidor}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Ativ. Planejamento</p>
                        <Badge className={getStatusColor(controle.atividades_planejamento)}>{controle.atividades_planejamento}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Kick off Cliente</p>
                        <Badge className={getStatusColor(controle.kickoff_cliente)}>{controle.kickoff_cliente}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* ART */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">ART</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">EE/AIS</p>
                        <Badge className={getStatusColor(controle.art_ee_ais)}>{controle.art_ee_ais}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">HID/IN</p>
                        <Badge className={getStatusColor(controle.art_hid_in)}>{controle.art_hid_in}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">HVAC</p>
                        <Badge className={getStatusColor(controle.art_hvac)}>{controle.art_hvac}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">BOMB</p>
                        <Badge className={getStatusColor(controle.art_bomb)}>{controle.art_bomb}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Concessionárias */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Concessionárias</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Telefonia</p>
                        <Badge className={getStatusColor(controle.conc_telefonia)}>{controle.conc_telefonia}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Gás</p>
                        <Badge className={getStatusColor(controle.conc_gas)}>{controle.conc_gas}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Elétrica</p>
                        <Badge className={getStatusColor(controle.conc_eletrica)}>{controle.conc_eletrica}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Hidráulica</p>
                        <Badge className={getStatusColor(controle.conc_hidraulica)}>{controle.conc_hidraulica}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Água Pluvial</p>
                        <Badge className={getStatusColor(controle.conc_agua_pluvial)}>{controle.conc_agua_pluvial}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Incêndio</p>
                        <Badge className={getStatusColor(controle.conc_incendio)}>{controle.conc_incendio}</Badge>
                      </div>
                    </div>
                  </div>

                  {controle.observacoes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Observações:</p>
                      <p className="text-sm text-gray-600">{controle.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}