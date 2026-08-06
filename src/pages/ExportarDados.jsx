import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, Database, CheckCircle2, AlertCircle, FileJson } from "lucide-react";

const ENTITIES = [
  "Usuario", "Disciplina", "Equipe", "Pavimento", "AtividadeGenerica", "AtividadeFuncao",
  "Empreendimento", "Documento", "Comercial", "ControleOS",
  "PlanejamentoAtividade", "PlanejamentoDocumento", "Atividade", "AtividadesEmpreendimento",
  "Execucao", "DataCadastro", "AlteracaoEtapa", "ChecklistItem", "ChecklistPlanejamento",
  "AtaReuniao", "ItemPRE", "OSManual", "NotificacaoAtividade", "SobraUsuario",
];

const PAGE_SIZE = 2000;
const CHUNK_SIZE = 50000;

const downloadFile = (filename, content, type = "application/json") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const flushEntity = (entity, records) => {
  if (records.length <= CHUNK_SIZE) {
    downloadFile(`${entity}.json`, JSON.stringify(records, null, 2));
    return 1;
  }
  const chunks = Math.ceil(records.length / CHUNK_SIZE);
  for (let i = 0; i < chunks; i++) {
    downloadFile(`${entity}_${i + 1}.json`, JSON.stringify(records.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), null, 2));
  }
  return chunks;
};

export default function ExportarDados() {
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState({}); // entity -> { state, count, files, error }
  const [current, setCurrent] = useState(null);

  const fetchAll = async (entity) => {
    const all = [];
    let skip = 0;
    let prevFirstId = null;
    for (let i = 0; i < 1000; i++) {
      const batch = await base44.entities[entity].filter({}, "-created_date", PAGE_SIZE, skip);
      if (!batch || batch.length === 0) break;
      // Guard against skip not being supported (would return same first page forever)
      if (batch[0]?.id && batch[0].id === prevFirstId) break;
      prevFirstId = batch[0]?.id || null;
      all.push(...batch);
      setStatus((s) => ({ ...s, [entity]: { state: "running", count: all.length } }));
      if (batch.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }
    return all;
  };

  const handleExport = async () => {
    setExporting(true);
    const finalStatus = {};
    for (const entity of ENTITIES) {
      setCurrent(entity);
      setStatus((s) => ({ ...s, [entity]: { state: "running", count: 0 } }));
      try {
        const records = await fetchAll(entity);
        const files = flushEntity(entity, records);
        finalStatus[entity] = { state: "done", count: records.length, files };
        setStatus((s) => ({ ...s, [entity]: { state: "done", count: records.length, files } }));
      } catch (e) {
        finalStatus[entity] = { state: "error", error: (e.message || String(e)).slice(0, 120) };
        setStatus((s) => ({ ...s, [entity]: { state: "error", error: (e.message || String(e)).slice(0, 120) } }));
      }
    }
    setCurrent(null);
    setExporting(false);
  };

  const totalDone = Object.values(status).filter((s) => s.state === "done").length;
  const totalRecords = Object.values(status).reduce((sum, s) => sum + (s.count || 0), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Exportar Dados (Migração)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Exporta <strong>todos os registros</strong> de cada entidade, com todos os campos, em arquivos JSON
            (um array de objetos por arquivo, nomeado como a entidade). Entidades com mais de {CHUNK_SIZE.toLocaleString("pt-BR")}{" "}
            registros são divididas em múltiplos arquivos (<code>Entidade_1.json</code>, <code>Entidade_2.json</code>...).
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={handleExport} disabled={exporting} className="bg-blue-600 hover:bg-blue-700">
              {exporting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando... ({totalDone}/{ENTITIES.length})</>
              ) : (
                <><Download className="w-4 h-4 mr-2" />Exportar Todas as Entidades</>
              )}
            </Button>
            {exporting && current && (
              <span className="text-sm text-gray-500">Processando: <strong>{current}</strong></span>
            )}
            {!exporting && totalDone > 0 && (
              <span className="text-sm text-green-700 font-medium">
                {totalDone} entidades exportadas • {totalRecords.toLocaleString("pt-BR")} registros no total
              </span>
            )}
          </div>

          <div className="border rounded-lg divide-y">
            {ENTITIES.map((entity) => {
              const st = status[entity];
              return (
                <div key={entity} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-800">{entity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!st && <span className="text-gray-400">Pendente</span>}
                    {st?.state === "running" && (
                      <span className="text-blue-600 flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {st.count.toLocaleString("pt-BR")} registros...
                      </span>
                    )}
                    {st?.state === "done" && (
                      <span className="text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        {st.count.toLocaleString("pt-BR")} registros • {st.files} arquivo(s)
                      </span>
                    )}
                    {st?.state === "error" && (
                      <span className="text-red-600 flex items-center gap-1" title={st.error}>
                        <AlertCircle className="w-4 h-4" />
                        Erro
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}