// Exportação da planilha LMD no padrão visual Interativa
import ExcelJS from 'exceljs';
import { format } from 'date-fns';

const LOGO_URL = "https://media.base44.com/images/public/6849788440d6602a66231f50/590b8dd13_image.png";

export async function exportarLMD({ empreendimento, documentos, pavimentos, userProfile, user, etapaParaPlanejamento }) {
  // Agrupa documentos por disciplina (cada disciplina = um bloco/seção)
  const grupos = {};
  documentos.forEach(doc => {
    const disciplina = doc.disciplina || (Array.isArray(doc.disciplinas) && doc.disciplinas[0]) || 'Sem Disciplina';
    if (!grupos[disciplina]) grupos[disciplina] = [];
    grupos[disciplina].push(doc);
  });

  const today = format(new Date(), 'dd/MM/yyyy');
  const faseMap = {
    'todas': 'TODAS', 'Estudo Preliminar': 'PRELIMINAR', 'Ante-Projeto': 'ANTEPROJETO',
    'Projeto Básico': 'BÁSICO', 'Projeto Executivo': 'EXECUTIVO',
    'Liberado para Obra': 'LIBERADO OBRA', 'Concepção': 'CONCEPÇÃO', 'Planejamento': 'PLANEJAMENTO'
  };
  const fase = faseMap[etapaParaPlanejamento] || String(etapaParaPlanejamento || '').toUpperCase();
  const coordenador = userProfile?.nome || user?.full_name || '';
  const cliente = String(empreendimento.cliente || '');
  const nomeStr = String(empreendimento.nome || '');
  const osStr = String(empreendimento.os || '');
  let docRef = osStr;
  if (!docRef) { const m = nomeStr.match(/^(\d+)/); if (m) docRef = m[1]; }
  let obra = (docRef && nomeStr.startsWith(docRef + '-')) ? nomeStr.slice(docRef.length + 1) : nomeStr.replace(/^\d+-/, '');
  const revisao = 'R00';

  // Estilos (fonte Arial em toda a planilha)
  const arial = { name: 'Arial', size: 10 };
  const arialBold = { name: 'Arial', size: 10, bold: true };
  const labelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }; // cinza (rótulos)
  const valueFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; // azul claro (valores)
  const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8CCE4' } }; // azul (seções/cabeçalhos)
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };
  const center = { horizontal: 'center', vertical: 'middle' };
  const left = { horizontal: 'left', vertical: 'middle' };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('LMD');
  ws.columns = [
    { width: 14.43 },   // DOC
    { width: 83.71 },   // PAVIMENTO
    { width: 30.71 },   // TIPO
    { width: 37.29 }    // ARQUIVO
  ];

  // Logo Interativa (busca e dimensões para manter proporção, sem esticar)
  let logoId = null;
  const logoHpx = 80;
  let logoWpx = 320;
  try {
    // Carrega a imagem via <img> com crossOrigin e renderiza em canvas para obter
    // base64 + dimensões. O canvas evita problemas de CORS/taint e garante PNG válido.
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = LOGO_URL;
    });
    const dims = { w: img.naturalWidth || 4, h: img.naturalHeight || 1 };
    const canvas = document.createElement('canvas');
    canvas.width = dims.w;
    canvas.height = dims.h;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    logoId = wb.addImage({ base64: b64, extension: 'png' });
    logoWpx = logoHpx * dims.w / dims.h;
  } catch (e) { console.warn('Logo LMD não carregado:', e); logoId = null; }

  const borderRow = (row, lastCol = 4) => {
    for (let c = 1; c <= lastCol; c++) row.getCell(c).border = thinBorder;
  };
  const pavNome = (doc) => {
    const pav = (pavimentos || []).find(p => p.id === doc.pavimento_id);
    return (pav && pav.nome) ? pav.nome : (doc.area || '');
  };
  const tipoDoc = (doc) => (doc.subdisciplinas || []).join(', ');
  const sortDocs = (arr) => arr.slice().sort((a, b) => {
    const numCmp = String(a.numero || '').localeCompare(String(b.numero || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (numCmp !== 0) return numCmp;
    return tipoDoc(a).localeCompare(tipoDoc(b), 'pt-BR', { sensitivity: 'base' });
  });

  let firstBlock = true;
  Object.entries(grupos).forEach(([disciplina, docs]) => {
    if (!firstBlock) ws.addRow(Array(4).fill(''));
    firstBlock = false;

    // Linha do logo (cabeçalho de cada bloco de disciplina, imagem com proporção mantida)
    const logoRow = ws.addRow(Array(4).fill(''));
    logoRow.height = logoId ? (logoHpx * 0.75 + 6) : 20;
    if (logoId) {
      ws.addImage(logoId, { tl: { col: 0, row: logoRow.number - 1 }, ext: { width: logoWpx, height: logoHpx } });
    }

    // Rótulos: Cliente / Doc
    const rl1 = ws.addRow(['Cliente:', cliente, 'Doc:', docRef]);
    rl1.getCell(1).font = arialBold; rl1.getCell(1).fill = labelFill; rl1.getCell(1).alignment = left;
    rl1.getCell(2).font = arial; rl1.getCell(2).fill = valueFill; rl1.getCell(2).alignment = center;
    rl1.getCell(3).font = arialBold; rl1.getCell(3).fill = labelFill; rl1.getCell(3).alignment = left;
    rl1.getCell(4).font = arial; rl1.getCell(4).fill = valueFill; rl1.getCell(4).alignment = center;
    borderRow(rl1);

    // Rótulos: Obra / Código da Obra
    const rl2 = ws.addRow(['Obra:', obra, 'Código da Obra:', '']);
    rl2.getCell(1).font = arialBold; rl2.getCell(1).fill = labelFill; rl2.getCell(1).alignment = left;
    rl2.getCell(2).font = arial; rl2.getCell(2).fill = valueFill; rl2.getCell(2).alignment = center;
    rl2.getCell(3).font = arialBold; rl2.getCell(3).fill = labelFill; rl2.getCell(3).alignment = left;
    rl2.getCell(4).font = arial; rl2.getCell(4).fill = valueFill; rl2.getCell(4).alignment = center;
    borderRow(rl2);

    // Rótulos: Revisão / Data
    const rl3 = ws.addRow(['Revisão:', revisao, 'Data:', today]);
    rl3.getCell(1).font = arialBold; rl3.getCell(1).fill = labelFill; rl3.getCell(1).alignment = left;
    rl3.getCell(2).font = arial; rl3.getCell(2).fill = valueFill; rl3.getCell(2).alignment = center;
    rl3.getCell(3).font = arialBold; rl3.getCell(3).fill = labelFill; rl3.getCell(3).alignment = left;
    rl3.getCell(4).font = arial; rl3.getCell(4).fill = valueFill; rl3.getCell(4).alignment = center;
    borderRow(rl3);

    // Rótulos: Disciplina / Fase
    const rl4 = ws.addRow(['Disciplina:', disciplina, 'Fase:', fase]);
    rl4.getCell(1).font = arialBold; rl4.getCell(1).fill = labelFill; rl4.getCell(1).alignment = left;
    rl4.getCell(2).font = arialBold; rl4.getCell(2).fill = sectionFill; rl4.getCell(2).alignment = center;
    rl4.getCell(3).font = arialBold; rl4.getCell(3).fill = labelFill; rl4.getCell(3).alignment = left;
    rl4.getCell(4).font = arial; rl4.getCell(4).fill = valueFill; rl4.getCell(4).alignment = center;
    borderRow(rl4);

    // Rótulos: Coordenador
    const rl5 = ws.addRow(['Coordenador:', coordenador, '', '']);
    ws.mergeCells(rl5.number, 2, rl5.number, 4);
    rl5.getCell(1).font = arialBold; rl5.getCell(1).fill = labelFill; rl5.getCell(1).alignment = left;
    rl5.getCell(2).font = arial; rl5.getCell(2).fill = valueFill; rl5.getCell(2).alignment = center;
    borderRow(rl5);

    // Cabeçalho da tabela (4 colunas)
    const rHead = ws.addRow(['DOC', 'PAVIMENTO', 'TIPO', 'ARQUIVO']);
    rHead.eachCell(cell => { cell.font = arialBold; cell.fill = sectionFill; cell.alignment = center; cell.border = thinBorder; });

    // Documentos agrupados por pavimento
    const pavGroups = {};
    docs.forEach(doc => {
      const p = pavNome(doc) || 'GERAL';
      if (!pavGroups[p]) pavGroups[p] = [];
      pavGroups[p].push(doc);
    });
    Object.entries(pavGroups).forEach(([pavNomeGrupo, docsPav]) => {
      const isGeral = pavNomeGrupo === 'GERAL';
      const sectionLabel = isGeral ? 'DOCUMENTOS' : pavNomeGrupo;
      const rSec = ws.addRow([sectionLabel, '', '', '']);
      ws.mergeCells(rSec.number, 1, rSec.number, 4);
      rSec.getCell(1).font = arialBold; rSec.getCell(1).fill = sectionFill; rSec.getCell(1).alignment = isGeral ? center : left;
      borderRow(rSec);
      sortDocs(docsPav).forEach(doc => {
        const row = ws.addRow([
          String(doc.numero || ''),
          String(doc.descritivo || ''),
          tipoDoc(doc),
          String(doc.arquivo || '')
        ]);
        row.eachCell(cell => { cell.font = arial; cell.border = thinBorder; });
        row.getCell(1).alignment = center;
        row.getCell(1).numFmt = '@';
      });
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `LMD_${empreendimento.nome.replace(/\s+/g, '_')}.xlsx`;
  link.click();
}