import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const tipo = url.searchParams.get('tipo') || 'documentos'; // 'documentos' ou 'atividades'

    if (tipo === 'documentos') {
      // Média histórica por documento_id + etapa usando PlanejamentoDocumento
      const todos = await base44.asServiceRole.entities.PlanejamentoDocumento.filter(
        { status: ['concluido'] }
      );

      const grupos = {};
      for (const p of (todos || [])) {
        if (!p.documento_id) continue;
        const tempoUsado = (p.tempo_executado && p.tempo_executado > 0)
          ? p.tempo_executado
          : p.tempo_planejado;
        if (!tempoUsado || tempoUsado <= 0) continue;

        const chave = `${p.documento_id}||${p.etapa || ''}`;
        if (!grupos[chave]) {
          grupos[chave] = { documento_id: p.documento_id, etapa: p.etapa || null, tempos: [] };
        }
        grupos[chave].tempos.push(tempoUsado);
      }

      const resultado = Object.values(grupos).map(g => ({
        documento_id: g.documento_id,
        etapa: g.etapa,
        media: Math.round((g.tempos.reduce((a, b) => a + b, 0) / g.tempos.length) * 10) / 10,
        total: g.tempos.length,
      }));

      return Response.json(resultado);
    }

    if (tipo === 'atividades') {
      // Média histórica por atividade_id usando PlanejamentoAtividade
      const todos = await base44.asServiceRole.entities.PlanejamentoAtividade.filter(
        { status: ['concluido'] }
      );

      const grupos = {};
      for (const p of (todos || [])) {
        if (!p.atividade_id) continue;
        const tempoUsado = (p.tempo_executado && p.tempo_executado > 0)
          ? p.tempo_executado
          : p.tempo_planejado;
        if (!tempoUsado || tempoUsado <= 0) continue;

        const chave = String(p.atividade_id);
        if (!grupos[chave]) {
          grupos[chave] = { atividade_id: p.atividade_id, tempos: [] };
        }
        grupos[chave].tempos.push(tempoUsado);
      }

      const resultado = Object.values(grupos).map(g => ({
        atividade_id: g.atividade_id,
        media: Math.round((g.tempos.reduce((a, b) => a + b, 0) / g.tempos.length) * 10) / 10,
        total: g.tempos.length,
      }));

      return Response.json(resultado);
    }

    return Response.json({ error: 'Parâmetro tipo inválido. Use "documentos" ou "atividades".' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});