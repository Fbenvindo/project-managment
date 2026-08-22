import React, { useState, useEffect } from "react";
import { Empreendimento } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Layers,
  Info,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Etapas padrão disponíveis no catálogo de atividades (empreendimento_id = null)
const ETAPAS_PADRAO_CATALOGO = [
  "Concepção",
  "Planejamento",
  "Estudo Preliminar",
  "Ante-Projeto",
  "Projeto Básico",
  "Projeto Executivo",
  "Liberado para Obra",
];

const ETAPAS_DEFAULT_PROJETO = [
  "Estudo Preliminar",
  "Ante-Projeto",
  "Projeto Básico",
  "Projeto Executivo",
  "Liberado para Obra",
];

export default function EtapasProjetoTab({ empreendimento, onUpdate, readOnly }) {
  const { toast } = useToast();
  const [etapas, setEtapas] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState({ nome: "", etapa_padrao: "" });

  useEffect(() => {
    if (!empreendimento) return;

    const config = empreendimento.etapas_config;
    if (Array.isArray(config) && config.length > 0) {
      setEtapas(
        config.map((e, i) => ({
          nome: e.nome || "",
          etapa_padrao: e.etapa_padrao || "",
          ordem: e.ordem ?? i + 1,
        }))
      );
      return;
    }

    // Migração: converte etapas (strings) legadas em config com mapeamento automático
    const etapasLegadas = empreendimento.etapas;
    if (Array.isArray(etapasLegadas) && etapasLegadas.length > 0) {
      setEtapas(
        etapasLegadas.map((nome, i) => ({
          nome,
          etapa_padrao: ETAPAS_PADRAO_CATALOGO.includes(nome) ? nome : "",
          ordem: i + 1,
        }))
      );
      return;
    }

    // Padrão
    setEtapas(
      ETAPAS_DEFAULT_PROJETO.map((nome, i) => ({
        nome,
        etapa_padrao: nome,
        ordem: i + 1,
      }))
    );
  }, [empreendimento]);

  const handleEdit = (index, field, value) => {
    setEtapas((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  };

  const handleRemove = (index) => {
    setEtapas((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((e, i) => ({ ...e, ordem: i + 1 }))
    );
  };

  const moveUp = (index) => {
    if (index === 0) return;
    setEtapas((prev) => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr.map((e, i) => ({ ...e, ordem: i + 1 }));
    });
  };

  const moveDown = (index) => {
    if (index === etapas.length - 1) return;
    setEtapas((prev) => {
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr.map((e, i) => ({ ...e, ordem: i + 1 }));
    });
  };

  const handleAdd = () => {
    if (!novaEtapa.nome.trim()) {
      toast({ title: "Informe o nome da etapa", variant: "destructive" });
      return;
    }
    if (!novaEtapa.etapa_padrao) {
      toast({
        title: "Selecione a etapa padrão do catálogo",
        variant: "destructive",
      });
      return;
    }
    setEtapas((prev) => [
      ...prev,
      { ...novaEtapa, nome: novaEtapa.nome.trim(), ordem: prev.length + 1 },
    ]);
    setNovaEtapa({ nome: "", etapa_padrao: "" });
    setShowAddDialog(false);
  };

  const handleSave = async () => {
    const inválidas = etapas.filter(
      (e) => !e.nome.trim() || !e.etapa_padrao
    );
    if (inválidas.length > 0) {
      toast({
        title: "Existem etapas sem nome ou sem etapa padrão",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const etapasConfig = etapas.map((e, i) => ({
        nome: e.nome.trim(),
        etapa_padrao: e.etapa_padrao,
        ordem: i + 1,
      }));
      // Sincroniza etapas (strings) para compatibilidade com o restante do sistema
      const etapasStrings = etapasConfig.map((e) => e.nome);

      await Empreendimento.update(empreendimento.id, {
        etapas_config: etapasConfig,
        etapas: etapasStrings,
      });

      toast({ title: "Etapas do projeto salvas com sucesso" });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Erro ao salvar etapas:", error);
      toast({ title: "Erro ao salvar etapas", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Etapas do Projeto</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Defina as etapas do projeto e mapeie cada uma para uma etapa
                padrão do catálogo de atividades.
              </p>
            </div>
          </div>
          {!readOnly && (
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Etapa
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              A <strong>etapa padrão</strong> define de qual etapa do catálogo
              de atividades as tarefas serão originadas. Atividades que se
              repetem em etapas padrão distintas (ex.: Compatibilização em
              Ante-Projeto e Projeto Básico) serão mantidas apenas uma vez no
              projeto. A ordem das etapas segue a classificação crescente
              (predecessora).
            </p>
          </div>

          {etapas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Layers className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>Nenhuma etapa configurada. Clique em "Adicionar Etapa".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-1 text-center">Ordem</div>
                <div className="col-span-5">Etapa do Projeto</div>
                <div className="col-span-5">Etapa Padrão (Catálogo)</div>
                <div className="col-span-1 text-center">Ações</div>
              </div>

              {etapas.map((etapa, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-center px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-200 transition-colors"
                >
                  <div className="col-span-2 md:col-span-1 flex items-center justify-center">
                    <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold flex items-center justify-center">
                      {etapa.ordem}
                    </span>
                  </div>

                  <div className="col-span-7 md:col-span-5">
                    <Input
                      value={etapa.nome}
                      onChange={(e) =>
                        handleEdit(index, "nome", e.target.value)
                      }
                      disabled={readOnly}
                      placeholder="Nome da etapa no projeto"
                      className="h-9"
                    />
                  </div>

                  <div className="col-span-3 md:col-span-5">
                    <Select
                      value={etapa.etapa_padrao}
                      onValueChange={(value) =>
                        handleEdit(index, "etapa_padrao", value)
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a etapa padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        {ETAPAS_PADRAO_CATALOGO.map((ep) => (
                          <SelectItem key={ep} value={ep}>
                            {ep}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-12 md:col-span-1 flex items-center justify-center gap-1">
                    {!readOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          title="Mover para cima"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveDown(index)}
                          disabled={index === etapas.length - 1}
                          title="Mover para baixo"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemove(index)}
                          title="Remover etapa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!readOnly && etapas.length > 0 && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Salvando..." : "Salvar Etapas"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Adicionar Etapa */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Etapa do Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nova-nome">Nome da Etapa no Projeto *</Label>
              <Input
                id="nova-nome"
                value={novaEtapa.nome}
                onChange={(e) =>
                  setNovaEtapa((prev) => ({ ...prev, nome: e.target.value }))
                }
                placeholder="Ex: Revisão Executivo, Projeto Básico..."
              />
            </div>
            <div className="space-y-2">
              <Label>Etapa Padrão do Catálogo *</Label>
              <Select
                value={novaEtapa.etapa_padrao}
                onValueChange={(value) =>
                  setNovaEtapa((prev) => ({
                    ...prev,
                    etapa_padrao: value,
                    nome: prev.nome || value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa padrão" />
                </SelectTrigger>
                <SelectContent>
                  {ETAPAS_PADRAO_CATALOGO.map((ep) => (
                    <SelectItem key={ep} value={ep}>
                      {ep}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                As atividades do catálogo desta etapa padrão serão originadas
                para o projeto.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}