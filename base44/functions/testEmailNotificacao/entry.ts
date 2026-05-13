import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { to, nome, atividades } = await req.json();

    const listaHTML = atividades.map(a => `<li>${a.nome} <strong>(${a.tempo}h)</strong></li>`).join('');

    const htmlBody = `
      <p>Olá, <strong>${nome}</strong>!</p>
      <p>Você tem <strong>${atividades.length}</strong> atividade(s) ocasional(is) para agendar esta semana:</p>
      <ul>${listaHTML}</ul>
      <p>Acesse o sistema para escolher quando deseja realizar cada atividade.</p>
      <p>Até mais!</p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Gestão de Projetos <onboarding@resend.dev>',
        to: [to],
        subject: '🔔 Atividades ocasionais para agendar esta semana',
        html: htmlBody
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json({ error: data }, { status: 500 });
    }

    return Response.json({ success: true, enviado_para: to });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});