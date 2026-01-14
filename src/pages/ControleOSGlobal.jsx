import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Search, Loader2, Building2, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ControleOSSpreadsheet from "../components/empreendimento/ControleOSSpreadsheet";

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

  const handleUpdateControle = async (controleId, field, value) => {
    try {
      await base44.entities.ControleOS.update(controleId, { [field]: value });
      
      // Atualizar estado local
      setControlesOS(prev => 
        prev.map(c => c.id === controleId ? { ...c, [field]: value } : c)
      );
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      alert('Erro ao salvar alteração');
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
        <Card className="p-0">
          <ControleOSSpreadsheet 
            controlesOS={filteredControles} 
            empreendimentos={empreendimentos}
            searchTerm={searchTerm}
            onUpdate={handleUpdateControle}
            editable={true}
          />
        </Card>
      )}
    </div>
  );
}