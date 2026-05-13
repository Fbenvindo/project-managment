import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { to, nome, atividades } = await req.json();

    const listaAtividades = atividades.map(a => `• ${a.nome} (${a.tempo}h)`).join('\n');

    await base44.integrations.Core.SendEmail({
      to,
      subject: `🔔 Atividades ocasionais para agendar esta semana`,
      body: `Olá, ${nome}!\n\nVocê tem ${atividades.length} atividade(s) ocasional(is) para agendar esta semana:\n\n${listaAtividades}\n\nAcesse o sistema para escolher quando deseja realizar cada atividade.\n\nAté mais!`
    });

    return Response.json({ success: true, enviado_para: to });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});