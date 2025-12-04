import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, MapPin, User, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusStyles = {
  proposta: "bg-blue-100 text-blue-800",
  negociacao: "bg-yellow-100 text-yellow-800",
  aprovado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800"
};

const statusLabels = {
  proposta: "Proposta",
  negociacao: "Em Negociação",
  aprovado: "Aprovado",
  cancelado: "Cancelado"
};

export default function ComercialCard({ comercial, canEdit, onEdit, onDelete }) {
  const formatCurrency = (value) => {
    if (!value) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      {comercial.foto_url && (
        <div className="h-40 overflow-hidden">
          <img 
            src={comercial.foto_url} 
            alt={comercial.nome}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
              {comercial.nome}
            </h3>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <User className="w-3 h-3" />
              <span>{comercial.cliente}</span>
            </div>
          </div>
          <Badge className={statusStyles[comercial.status] || statusStyles.proposta}>
            {statusLabels[comercial.status] || "Proposta"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {comercial.endereco && (
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{comercial.endereco}</span>
          </div>
        )}

        {comercial.valor_estimado && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <DollarSign className="w-4 h-4 flex-shrink-0 text-green-600" />
            <span className="font-medium text-green-700">{formatCurrency(comercial.valor_estimado)}</span>
          </div>
        )}

        {comercial.data_proposta && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>Proposta: {format(new Date(comercial.data_proposta), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={() => onEdit(comercial)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(comercial.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}