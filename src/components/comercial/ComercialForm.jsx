import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function ComercialForm({ empreendimento, onClose, onSubmit, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: empreendimento?.nome || "",
    cliente: empreendimento?.cliente || "",
    endereco: empreendimento?.endereco || "",
    status: empreendimento?.status || "em_planejamento",
    foto_url: empreendimento?.foto_url || ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.cliente) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {empreendimento ? "Editar Empreendimento" : "Novo Empreendimento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Empreendimento *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome do empreendimento"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente *</Label>
            <Input
              id="cliente"
              value={formData.cliente}
              onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
              placeholder="Nome do cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Endereço do empreendimento"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="em_planejamento">Em Planejamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="foto_url">URL da Imagem</Label>
            <Input
              id="foto_url"
              value={formData.foto_url}
              onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {empreendimento ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}