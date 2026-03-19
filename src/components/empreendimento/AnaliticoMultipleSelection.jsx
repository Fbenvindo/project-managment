import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';

export default function AnaliticoMultipleSelection({ 
  selectedIds, 
  isDeletingMultiple, 
  onDelete,
  label = "atividades selecionadas"
}) {
  if (selectedIds.size === 0) return null;

  return (
    <div className="flex items-center justify-between p-4 border-2 border-red-500 rounded-lg bg-red-50 shadow-sm">
      <div className="flex items-center gap-3">
        <Badge className="bg-red-600 text-white">
          {selectedIds.size} {label}
        </Badge>
        <span className="text-sm text-gray-700">
          Selecione a ação para as atividades selecionadas
        </span>
      </div>
      <Button
        onClick={onDelete}
        className="bg-red-600 hover:bg-red-700"
        disabled={isDeletingMultiple}
        size="sm"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Excluir ({selectedIds.size})
      </Button>
    </div>
  );
}