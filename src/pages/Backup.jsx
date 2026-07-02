import React, { useState } from "react";
import { backupDatabase } from "@/functions/backupDatabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Database, Loader2, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const ENTITY_LIST = [
  'Usuario', 'Equipe', 'Empreendimento', 'Disciplina', 'Pavimento',
  'Documento', 'Atividade', 'AtividadeGenerica', 'AtividadeFuncao',
  'PlanejamentoAtividade', 'PlanejamentoDocumento', 'Execucao',
  'SobraUsuario', 'Comercial', 'ControleOS', 'OSManual', 'ItemPRE',
  'AtaReuniao', 'ChecklistPlanejamento', 'ChecklistItem', 'DataCadastro',
  'NotificacaoAtividade', 'AlteracaoEtapa', 'AtividadesDoProjeto',
  'AtividadesEmpreendimento', 'HistoricoAtividade', 'TipoObra', 'Escopo'
];

function downloadCSV(entityName, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${entityName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Backup() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const isAdmin = user?.role === 'admin';

  const handleBackupAll = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress({ current: 0, total: ENTITY_LIST.length, entity: ENTITY_LIST[0] });

    try {
      const response = await backupDatabase();
      const data = response.data;
      const downloadResults = {};

      for (const entityName of ENTITY_LIST) {
        setProgress({ current: ENTITY_LIST.indexOf(entityName) + 1, total: ENTITY_LIST.length, entity: entityName });

        const entityData = data[entityName];
        if (entityData && entityData.csv && entityData.count > 0) {
          downloadCSV(entityName, entityData.csv);
          downloadResults[entityName] = { count: entityData.count, status: 'ok' };
        } else if (entityData && entityData.error) {
          downloadResults[entityName] = { count: 0, status: 'error', error: entityData.error };
        } else {
          downloadResults[entityName] = { count: entityData?.count || 0, status: 'empty' };
        }

        await new Promise(r => setTimeout(r, 300));
      }

      setResults(downloadResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <h2 className="text-xl font-semibold">Acesso Restrito</h2>
              <p className="text-gray-500">Apenas administradores podem gerar backups do banco de dados.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRecords = results ? Object.values(results).reduce((sum, r) => sum + (r.count || 0), 0) : 0;
  const successCount = results ? Object.values(results).filter(r => r.status === 'ok').length : 0;
  const errorCount = results ? Object.values(results).filter(r => r.status === 'error').length : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Database className="w-7 h-7" />
          Backup do Banco de Dados
        </h1>
        <p className="text-gray-500 mt-1">Exporte todos os dados das {ENTITY_LIST.length} entidades em formato CSV.</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Exportação Completa
          </CardTitle>
          <CardDescription>
            Gera um arquivo CSV para cada entidade do sistema. Os arquivos serão baixados automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleBackupAll}
            disabled={loading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando Backup...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Gerar Backup Completo ({ENTITY_LIST.length} entidades)
              </>
            )}
          </Button>

          {progress && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Processando: <strong>{progress.entity}</strong></span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Erro ao gerar backup</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Resultado do Backup
            </CardTitle>
            <CardDescription>
              {successCount} entidades exportadas com sucesso
              {errorCount > 0 && ` • ${errorCount} com erro`}
              {` • ${totalRecords} registros no total`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ENTITY_LIST.map(entityName => {
                const r = results[entityName];
                return (
                  <div
                    key={entityName}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      r?.status === 'ok' ? 'bg-green-50 border-green-200' :
                      r?.status === 'error' ? 'bg-red-50 border-red-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className="text-sm font-medium truncate">{entityName}</span>
                    <span className={`text-xs flex-shrink-0 ml-2 ${
                      r?.status === 'ok' ? 'text-green-700' :
                      r?.status === 'error' ? 'text-red-700' :
                      'text-gray-500'
                    }`}>
                      {r?.status === 'error' ? 'Erro' : `${r?.count || 0} regs`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}