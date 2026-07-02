import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ENTITIES = [
  'Usuario', 'Equipe', 'Empreendimento', 'Disciplina', 'Pavimento',
  'Documento', 'Atividade', 'AtividadeGenerica', 'AtividadeFuncao',
  'PlanejamentoAtividade', 'PlanejamentoDocumento', 'Execucao',
  'SobraUsuario', 'Comercial', 'ControleOS', 'OSManual', 'ItemPRE',
  'AtaReuniao', 'ChecklistPlanejamento', 'ChecklistItem', 'DataCadastro',
  'NotificacaoAtividade', 'AlteracaoEtapa', 'AtividadesDoProjeto',
  'AtividadesEmpreendimento', 'HistoricoAtividade', 'TipoObra', 'Escopo'
];

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return '"' + JSON.stringify(val).replace(/"/g, '""') + '"';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function recordsToCSV(records) {
  if (!records || records.length === 0) return '';
  const keySet = new Set();
  for (const r of records) {
    for (const k of Object.keys(r)) keySet.add(k);
  }
  const headers = Array.from(keySet);
  const lines = [headers.join(',')];
  for (const record of records) {
    lines.push(headers.map(h => escapeCSV(record[h])).join(','));
  }
  return lines.join('\n');
}

async function fetchAllRecords(base44, entityName) {
  const allRecords = [];
  let skip = 0;
  const limit = 500;
  let hasMore = true;
  while (hasMore) {
    const batch = await base44.asServiceRole.entities[entityName].list('-created_date', limit, skip);
    if (!batch || batch.length === 0) {
      hasMore = false;
      break;
    }
    allRecords.push(...batch);
    skip += batch.length;
    hasMore = batch.length === limit;
  }
  return allRecords;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const url = new URL(req.url);
    const entityParam = url.searchParams.get('entity');
    const entitiesToExport = entityParam ? [entityParam] : ENTITIES;

    const result = {};

    for (const entityName of entitiesToExport) {
      try {
        const records = await fetchAllRecords(base44, entityName);
        result[entityName] = {
          csv: recordsToCSV(records),
          count: records.length
        };
      } catch (err) {
        result[entityName] = { error: err.message, count: 0, csv: '' };
      }
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});