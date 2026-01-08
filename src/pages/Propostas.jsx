import React, { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Comercial } from "@/entities/all";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { retryWithBackoff } from "@/components/utils/apiUtils";
import { format } from "date-fns";

const statusColors = {
  solicitado: "bg-gray-100 text-gray-800",
  em_analise: "bg-yellow-100 text-yellow-800",
  aprovado: "bg-green-100 text-green-800",
  reprovado: "bg-red-100 text-red-800"
};

const statusLabels = {
  solicitado: "Solicitado",
  em_analise: "Aguardando Aprovação",
  aprovado: "Aprovado",
  reprovado: "Não Aprovado"
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
                        <TableHead className="w-[100px]">Número</TableHead>
                        <TableHead className="w-[110px]">Data Solicitação</TableHead>
                        <TableHead className="w-[110px]">Data Aprovação</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                        <TableHead className="w-[120px]">Tipo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Empreendimento</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Escopo</TableHead>
                        <TableHead className="text-right">Área (m²)</TableHead>
                        <TableHead className="text-center w-[60px]">UF</TableHead>
                        <TableHead className="text-right">Valor BIM</TableHead>
                        <TableHead className="text-right">Valor CAD</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propostas.map((proposta) => (
                        <TableRow key={proposta.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium whitespace-nowrap">{proposta.numero || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap text-center">
                            {proposta.data_solicitacao ? 
                              format(new Date(proposta.data_solicitacao), 'dd/MM/yyyy') 
                              : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-center">
                            {proposta.data_aprovacao ? 
                              format(new Date(proposta.data_aprovacao), 'dd/MM/yyyy') 
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[proposta.status]}>
                              {statusLabels[proposta.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {proposta.tipo_empreendimento ? (
                              <Badge variant="outline" className="text-xs">
                                {proposta.tipo_empreendimento}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{proposta.cliente || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={proposta.empreendimento}>
                            {proposta.empreendimento || '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{proposta.solicitante || '-'}</TableCell>
                          <TableCell className="max-w-[250px] truncate" title={proposta.escopo}>
                            {proposta.escopo || '-'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {proposta.area ? 
                              Number(proposta.area).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center">{proposta.estado || '-'}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {proposta.valor_bim ? 
                              `R$ ${Number(proposta.valor_bim).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {proposta.valor_cad ? 
                              `R$ ${Number(proposta.valor_cad).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-semibold text-green-600">
                            {(proposta.valor_bim || proposta.valor_cad) ? 
                              `R$ ${(Number(proposta.valor_bim || 0) + Number(proposta.valor_cad || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                              : '-'}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate" title={proposta.email}>
                            {proposta.email || '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{proposta.telefone || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={proposta.observacao}>
                            {proposta.observacao || '-'}
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