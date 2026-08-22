import React, { useState, useEffect, useMemo } from "react";
import { Feriado } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Plus, Trash2, Edit, Sparkles, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TIPOS = [
  { value: "nacional", label: "Nacional" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
  { value: "facultativo", label: "Facultativo" },
  { value: "ponto_facultativo", label: "Ponto Facultativo" },
];

// Feriados nacionais fixos (recorrentes) do Brasil
const FERIADOS_NACIONAIS_FIXOS = [
  { nome: "Confraternização Universal", mes: 1, dia: 1 },
  { nome: "Tiradentes", mes: 4, dia: 21 },
  { nome: "Dia do Trabalho", mes: 5, dia: 1 },
  { nome: "Independência do Brasil", mes: 9, dia: 7 },
  { nome: "Nossa Senhora Aparecida", mes: 10, dia: 12 },
  { nome: "Finados", mes: 11, dia: 2 },
  { nome: "Proclamação da República", mes: 11, dia: 15 },
  { nome: "Natal", mes: 12, dia: 25 },
];

const initialState = { nome: "", data: "", tipo: "nacional", recorrente: true };

export default function Feriados() {
  const { toast } = useToast();
  const [feriados, setFeriados] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialState);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [busca, setBusca] = useState("");

  const load = async () => {
    setIsLoading(true);
    try {
      const lista = await Feriado.list("-data", 500);
      setFeriados(lista || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar feriados", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const anosDisponiveis = useMemo(() => {
    const set = new Set();
    feriados.forEach((f) => {
      if (f.data) set.add(String(f.data).split("-")[0]);
    });
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [feriados]);

  const feriadosFiltrados = useMemo(() => {
    return feriados
      .filter((f) => {
        if (!f.data) return false;
        const ano = String(f.data).split("-")[0];
        if (f.recorrente) return true; // recorrentes aparecem sempre
        return ano === String(anoFiltro);
      })
      .filter((f) =>
        !busca ? true : String(f.nome || "").toLowerCase().includes(busca.toLowerCase())
      )
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }, [feriados, anoFiltro, busca]);

  const handleSave = async () => {
    if (!form.nome.trim() || !form.data) {
      toast({ title: "Preencha nome e data", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        nome: form.nome.trim(),
        data: form.data,
        tipo: form.tipo,
        recorrente: form.recorrente,
      };
      if (editing) {
        await Feriado.update(editing.id, payload);
      } else {
        await Feriado.create(payload);
      }
      toast({ title: editing ? "Feriado atualizado" : "Feriado criado" });
      setShowForm(false);
      setEditing(null);
      setForm(initialState);
      load();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar feriado", variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir este feriado?")) return;
    try {
      await Feriado.delete(id);
      load();
      toast({ title: "Feriado excluído" });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const handleEdit = (f) => {
    setEditing(f);
    setForm({ nome: f.nome, data: f.data, tipo: f.tipo || "nacional", recorrente: !!f.recorrente });
    setShowForm(true);
  };

  const handleGerarNacionais = async () => {
    if (
      !window.confirm(
        `Gerar os ${FERIADOS_NACIONAIS_FIXOS.length} feriados nacionais fixos para ${anoFiltro}? (recorrentes)`
      )
    )
      return;
    try {
      const payload = FERIADOS_NACIONAIS_FIXOS.map((f) => ({
        nome: f.nome,
        data: `${anoFiltro}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`,
        tipo: "nacional",
        recorrente: true,
      }));
      await Feriado.bulkCreate(payload);
      toast({ title: `${payload.length} feriados nacionais gerados` });
      load();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao gerar feriados", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feriados</h1>
            <p className="text-sm text-gray-500">
              Calendário anual de feriados. O planejamento de datas desconsidera estes dias.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGerarNacionais}>
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar Nacionais
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setForm(initialState);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Feriado
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>Lista de Feriados</CardTitle>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-8 h-9 w-48"
                />
              </div>
              <Select value={String(anoFiltro)} onValueChange={(v) => setAnoFiltro(Number(v))}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-gray-500 py-8">Carregando...</p>
          ) : feriadosFiltrados.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Nenhum feriado cadastrado. Clique em "Gerar Nacionais" ou adicione manualmente.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Recorrente</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feriadosFiltrados.map((f) => {
                  const [y, m, d] = String(f.data).split("-");
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        {d}/{m}/{y}
                      </TableCell>
                      <TableCell>{f.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {TIPOS.find((t) => t.value === f.tipo)?.label || f.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {f.recorrente ? (
                          <Badge className="bg-green-100 text-green-700">Sim</Badge>
                        ) : (
                          <Badge variant="secondary">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(f)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(f.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Feriado" : "Novo Feriado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Independência do Brasil"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label htmlFor="recorrente" className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                id="recorrente"
                checked={form.recorrente}
                onCheckedChange={(v) => setForm({ ...form, recorrente: !!v })}
              />
              <span className="text-sm">Recorrente (repete todos os anos no mesmo dia)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}