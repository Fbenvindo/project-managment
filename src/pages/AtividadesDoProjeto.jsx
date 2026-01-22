import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

export default function AtividadesDoProjeto() {
  const urlParams = new URLSearchParams(window.location.search);
  const empreendimentoId = urlParams.get("id") || urlParams.get("empreendimento_id");
  const [search, setSearch] = useState("");

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["atividades-projeto", empreendimentoId],
    enabled: !!empreendimentoId,
    queryFn: async () => {
      // Busca por atividades vinculadas ao empreendimento (nível de projeto)
      // e não a folhas/documentos
      const list = await base44.entities.Atividade.filter(
        { empreendimento_id: empreendimentoId },
        undefined,
        1000
      );
      return Array.isArray(list) ? list : [];
    },
    initialData: [],
  });

  const atividadesProjeto = useMemo(() => {
    const texto = search.trim().toLowerCase();
    return atividades
      .filter((a) => !a?.documento_id) // excluir atividades de folhas
      .filter((a) => {
        if (!texto) return true;
        const campos = [a?.atividade, a?.disciplina, a?.subdisciplina, a?.etapa]
          .map((v) => (v || "").toString().toLowerCase());
        return campos.some((c) => c.includes(texto));
      });
  }, [atividades, search]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Card className="border rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg md:text-xl">Atividades Específicas do Projeto</CardTitle>
          <p className="text-sm text-muted-foreground">
            Estas atividades estarão disponíveis apenas para este empreendimento.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Buscar atividades..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Subdisciplina</TableHead>
                  <TableHead>Tempo (h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : atividadesProjeto.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                      Nenhuma atividade encontrada para este empreendimento.
                    </TableCell>
                  </TableRow>
                ) : (
                  atividadesProjeto.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a?.atividade || "-"}</TableCell>
                      <TableCell>{a?.etapa || "-"}</TableCell>
                      <TableCell>{a?.disciplina || "-"}</TableCell>
                      <TableCell>{a?.subdisciplina || "-"}</TableCell>
                      <TableCell>{a?.tempo ?? "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}