import React, { useState, useEffect } from "react";
import { Empreendimento } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

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

// Normaliza para array, migrando do formato legado (string única) se necessário
const normalizarEtapasPadrao = (etapa) => {
  if (Array.isArray(etapa.etapas_padrao)) return etapa.etapas_padrao;
  if (etapa.etapa_padrao) return [etapa.etapa_padrao];
  return [];
};

function MultiEtapaPadraoSelect({ value, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);

  const toggle = (ep) => {
    if (value.includes(ep)) {
      onChange(value.filter((v) => v !== ep));
    } else {
      // mantém a ordem do catálogo
      const merged = [...value, ep];
      const ordered = ETAPAS_PADRAO_CATALOGO.filter((e) => merged.includes(e));
      onChange(ordered);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between font-normal",
            value.length === 0 && "text-gray-400"
          )}
        >
          <span className="truncate text-left flex-1">
            {value.length === 0
              ? placeholder || "Selecione as etapas padrão"
              : value.join(", ")}
          </span>
          <ChevronDownIcon className="w-4 h-4 opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
          {ETAPAS_PADRAO_CATALOGO.map((ep) => (
            <label
              key={ep}
              htmlFor={`ep-${ep}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer"
            >
              <Checkbox
                id={`ep-${ep}`}
                checked={value.includes(ep)}
                onCheckedChange={() => toggle(ep)}
              />
              <span className="text-sm">{ep}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function EtapasProjetoTab({ empreendimento, onUpdate, readOnly }) {
  const { toast } = useToast();
  const [etapas, setEtapas] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState({ nome: "", etapas_padrao: [] });

  useEffect(() => {
    if (!empreendimento) return;

    const config = empreendimento.etapas_config;
    if (Array.isArray(config) && config.length > 0) {
      setEtapas(
        config.map((e, i) => ({
          nome: e.nome || "",
          etapas_padrao: normalizarEtapasPadrao(e),
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
          etapas_padrao: ETAPAS_PADRAO_CATALOGO.includes(nome) ? [nome] : [],
          ordem: i + 1,
        }))
      );
      return;
    }

    // Padrão
    setEtapas(
      ETAPAS_DEFAULT_PROJETO.map((nome, i) => ({
        nome,
        etapas_padrao: [nome],
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
    if (novaEtapa.etapas_padrao.length === 0) {
      toast({
        title: "Selecione ao menos uma etapa padrão do catálogo",
        variant: "destructive",
      });
      return;
    }
    setEtapas((prev) => [
      ...prev,
      {
        ...novaEtapa,
        nome: novaEtapa.nome.trim(),
        ordem: prev.length + 1,
      },
    ]);
    setNovaEtapa({ nome: "", etapas_padrao: [] });
    setShowAddDialog(false);
  };

  const handleSave = async () => {
    const inválidas = etapas.filter(
      (e) => !e.nome.trim() || e.etapas_padrao.length === 0
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
        etapas_padrao: e.etapas_padrao,
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
                Defina as etapas do projeto e mapeie cada uma para uma ou mais
                etapas padrão do catálogo de atividades.
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
              A <strong>etapa padrão</strong> define de quais etapas do
              catálogo as atividades serão originadas. Ao atribuir mais de uma
              etapa padrão, atividades que se repetem entre elas (ex.:
              Compatibilização em Ante-Projeto e Projeto Básico) serão mantidas
              apenas uma vez no projeto. A ordem das etapas segue a
              classificação crescente (predecessora).
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
                <div className="col-span-4">Etapa do Projeto</div>
                <div className="col-span-6">Etapas Padrão (Catálogo)</div>
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

                  <div className="col-span-8 md:col-span-4">
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

                  <div className="col-span-2 md:col-span-6">
                    {readOnly ? (
                      <div className="flex flex-wrap gap-1">
                        {etapa.etapas_padrao.map((ep) => (
                          <Badge key={ep} variant="secondary" className="text-xs">
                            {ep}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <MultiEtapaPadraoSelect
                        value={etapa.etapas_padrao}
                        onChange={(val) =>
                          handleEdit(index, "etapas_padrao", val)
                        }
                        placeholder="Selecione as etapas padrão"
                      />
                    )}
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
              <Label>Etapas Padrão do Catálogo *</Label>
              <MultiEtapaPadraoSelect
                value={novaEtapa.etapas_padrao}
                onChange={(val) =>
                  setNovaEtapa((prev) => ({ ...prev, etapas_padrao: val }))
                }
                placeholder="Selecione uma ou mais etapas padrão"
              />
              <p className="text-xs text-gray-500">
                As atividades do catálogo das etapas padrão selecionadas serão
                originadas para o projeto, com deduplicação das atividades
                repetidas.
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