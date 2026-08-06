import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, Image as ImageIcon } from "lucide-react";

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

export default function ExportarImagens() {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const [emps, itens] = await Promise.all([
        base44.entities.Empreendimento.filter({}, null, 10000),
        base44.entities.ItemPRE.filter({}, null, 10000),
      ]);

      const empreendimentoData = (emps || []).map((r) => ({
        id: r.id,
        nome: r.nome,
        foto_url: r.foto_url,
      }));

      const itemPreData = (itens || []).map((r) => ({
        id: r.id,
        empreendimento_id: r.empreendimento_id,
        item: r.item,
        imagens: Array.isArray(r.imagens) ? r.imagens : [],
      }));

      downloadFile("empreendimentos_imagens.json", JSON.stringify(empreendimentoData, null, 2));
      downloadFile("itenspre_imagens.json", JSON.stringify(itemPreData, null, 2));

      setResult({
        empreendimentos: empreendimentoData.length,
        itensPre: itemPreData.length,
        comFoto: empreendimentoData.filter((e) => e.foto_url).length,
        comImagens: itemPreData.filter((i) => i.imagens.length > 0).length,
      });
    } catch (e) {
      alert("Erro ao exportar: " + (e.message || e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            Exportar Imagens para Migração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Exporta apenas os campos relacionados a imagens de duas entidades, em formato JSON (um arquivo por entidade),
            para migração dos arquivos para outro serviço de armazenamento.
          </p>
          <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
            <li><strong>Empreendimento</strong>: id, nome, foto_url</li>
            <li><strong>ItemPRE</strong>: id, empreendimento_id, item, imagens (array completo de URLs)</li>
          </ul>
          <Button onClick={handleExport} disabled={exporting} className="bg-blue-600 hover:bg-blue-700">
            {exporting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exportando...</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />Exportar Imagens</>
            )}
          </Button>
          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <p className="font-semibold mb-1">Exportação concluída!</p>
              <p>Empreendimentos: {result.empreendimentos} registros ({result.comFoto} com foto)</p>
              <p>Itens PRE: {result.itensPre} registros ({result.comImagens} com imagens)</p>
              <p className="mt-1 text-gray-600">Dois arquivos JSON foram baixados.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}