import React from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import EscopoForm from "@/components/comercial/EscopoForm";

export default function PropostaFormModal({ open, onOpenChange, formData, setFormData, onSave, isSaving, editingId }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Editar Proposta' : 'Nova Proposta'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div>
            <Label htmlFor="numero">Número *</Label>
            <Input id="numero" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} placeholder="Ex: 2024-001" />
          </div>
          <div>
            <Label htmlFor="data_solicitacao">Data Solicitação *</Label>
            <Input id="data_solicitacao" type="date" value={formData.data_solicitacao} onChange={(e) => setFormData({ ...formData, data_solicitacao: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cliente">Cliente *</Label>
            <Input id="cliente" value={formData.cliente} onChange={(e) => setFormData({ ...formData, cliente: e.target.value })} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label htmlFor="empreendimento">Empreendimento *</Label>
            <Input id="empreendimento" value={formData.empreendimento} onChange={(e) => setFormData({ ...formData, empreendimento: e.target.value })} placeholder="Nome do empreendimento" />
          </div>
          <div>
            <Label htmlFor="solicitante">Solicitante</Label>
            <Input id="solicitante" value={formData.solicitante} onChange={(e) => setFormData({ ...formData, solicitante: e.target.value })} placeholder="Nome do solicitante" />
          </div>
          <div>
            <Label htmlFor="tipo_empreendimento">Tipo de Empreendimento</Label>
            <Select value={formData.tipo_empreendimento} onValueChange={(v) => setFormData({ ...formData, tipo_empreendimento: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {['Residencial','Comercial','Corporativo','Shopping','Logística','Hotelaria','Hospitalar','Industrial','Laboratório','Data Center'].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <EscopoForm formData={formData} setFormData={setFormData} readOnly={false} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="escopo">Descrição do Escopo</Label>
            <Textarea id="escopo" value={formData.escopo} onChange={(e) => setFormData({ ...formData, escopo: e.target.value })} placeholder="Descrição adicional do escopo do projeto" rows={3} />
          </div>

          <div>
            <Label htmlFor="area">Área (m²)</Label>
            <Input id="area" type="number" step="0.01" value={formData.area} onChange={(e) => setFormData({ ...formData, area: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <Label htmlFor="estado">Estado (UF)</Label>
            <Input id="estado" value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value })} placeholder="Ex: SP" maxLength={2} />
          </div>
          <div>
            <Label htmlFor="valor_bim">Valor BIM (R$)</Label>
            <Input id="valor_bim" type="number" step="0.01" value={formData.valor_bim} onChange={(e) => setFormData({ ...formData, valor_bim: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <Label htmlFor="valor_cad">Valor CAD (R$)</Label>
            <Input id="valor_cad" type="number" step="0.01" value={formData.valor_cad} onChange={(e) => setFormData({ ...formData, valor_cad: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contato@exemplo.com" />
          </div>
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solicitado">Solicitado</SelectItem>
                <SelectItem value="em_analise">Aguardando Aprovação</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="reprovado">Não Aprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="data_aprovacao">Data Aprovação</Label>
            <Input id="data_aprovacao" type="date" value={formData.data_aprovacao} onChange={(e) => setFormData({ ...formData, data_aprovacao: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="observacao">Observações</Label>
            <Textarea id="observacao" value={formData.observacao} onChange={(e) => setFormData({ ...formData, observacao: e.target.value })} placeholder="Observações adicionais" rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={onSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : (editingId ? 'Atualizar Proposta' : 'Salvar Proposta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}