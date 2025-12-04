import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export default function ComercialFilters({ filters, onFiltersChange, totalCount, filteredCount }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou cliente..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="em_planejamento">Em Planejamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="pausado">Pausado</SelectItem>
          </SelectContent>
        </Select>

        {totalCount !== filteredCount && (
          <div className="flex items-center text-sm text-gray-500">
            Exibindo {filteredCount} de {totalCount}
          </div>
        )}
      </div>
    </div>
  );
}