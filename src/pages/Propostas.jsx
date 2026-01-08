import React, { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Comercial } from "@/entities/all";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { retryWithBackoff } from "@/components/utils/apiUtils";
import { format } from "date-fns";

const statusColors = {
  proposta: "bg-yellow-100 text-yellow-800",
  negociacao: "bg-blue-100 text-blue-800",
  aprovado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800"
};

const statusLabels = {
  proposta: "Proposta",
  negociacao: "Negociação",
  aprovado: "Aprovado",
  cancelado: "Cancelado"
};

export default function PropostasPage() {
  const [propostas, setPropostas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPropostas();
  }, []);

  const loadPropostas = async () => {
    setIsLoading(true);
    try {
      const data = await retryWithBackoff(
        () => Comercial.list('-updated_date'),
        3, 2000, 'loadPropostas'
      );
      setPropostas(data || []);
    } catch (error) {
      console.error('Erro ao carregar propostas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Propostas</h1>
              <p className="text-gray-600">Apresentação de propostas comerciais ({propostas.length})</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Propostas</CardTitle>
            </CardHeader>
            <CardContent>
              {propostas.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma proposta cadastrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome do Projeto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor Estimado</TableHead>
                        <TableHead>Data da Proposta</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propostas.map((proposta) => (
                        <TableRow key={proposta.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{proposta.nome}</TableCell>
                          <TableCell>{proposta.cliente}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[proposta.status]}>
                              {statusLabels[proposta.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {proposta.valor_estimado ? 
                              `R$ ${Number(proposta.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {proposta.data_proposta ? 
                              format(new Date(proposta.data_proposta), 'dd/MM/yyyy') 
                              : '-'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {proposta.endereco || '-'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {proposta.observacoes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}