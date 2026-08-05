// Busca o logo da Interativa server-side (sem CORS) e devolve base64 + dimensões
export default async function(req) {
  try {
    const LOGO_URL = "https://media.base44.com/images/public/6849788440d6602a66231f50/590b8dd13_image.png";
    const resp = await fetch(LOGO_URL);
    if (!resp.ok) {
      return Response.json({ error: 'Falha ao buscar logo: ' + resp.status }, { status: 502 });
    }
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let width = 0, height = 0;
    if (bytes.length > 24) {
      const dv = new DataView(buf);
      width = dv.getUint32(16);
      height = dv.getUint32(20);
    }
    let b64 = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      b64 += btoa(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
    }
    return Response.json({ base64: b64, width, height, extension: 'png' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}