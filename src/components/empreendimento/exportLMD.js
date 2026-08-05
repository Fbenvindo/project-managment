// Exportação da planilha LMD no padrão visual Interativa
import ExcelJS from 'exceljs';
import { format } from 'date-fns';

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/577f93874_logo_Interativa_versao_final_sem_fundo_0002.png";

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
    { width: 11 },   // DOC
    { width: 45 },   // PAVIMENTO
    { width: 30 },   // DESCRIÇÃO INSTALAÇÕES
    { width: 30 },   // TIPO
    { width: 38 },   // ARQUIVO
    { width: 10 },   // ESCALA
    { width: 10 },   // EP
    { width: 10 },   // AP
    { width: 10 },   // PB
    { width: 10 },   // EX
    { width: 10 },   // LO
    { width: 10 }    // Retrab.
  ];

  // Logo Interativa (busca e dimensões para manter proporção, sem esticar)
  let logoId = null;
  const logoHpx = 50;
  let logoWpx = 200;
  try {
    const resp = await fetch(LOGO_URL);
    if (resp.ok) {
      const blob = await resp.blob();
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const dims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 4, h: 1 });
        img.src = URL.createObjectURL(blob);
      });
      const ext = (blob.type || '').includes('png') ? 'png' : 'jpeg';
      logoId = wb.addImage({ base64: b64, extension: ext });
      logoWpx = logoHpx * dims.w / dims.h;
    }
  } catch (e) { logoId = null; }

  const borderRow = (row, lastCol = 6) => {
    for (let c = 1; c <= lastCol; c++) row.getCell(c).border = thinBorder;
  };
  const pavNome = (doc) => {
    const pav = (pavimentos || []).find(p => p.id === doc.pavimento_id);
    return (pav && pav.nome) ? pav.nome : (doc.area || '');
  };

  // Linha do logo (uma vez no topo, imagem com proporção mantida)
  const logoRow = ws.addRow(Array(12).fill(''));
  logoRow.height = logoId ? (logoHpx * 0.75 + 6) : 20;
  if (logoId) {
    ws.addImage(logoId, { tl: { col: 0, row: logoRow.number - 1 }, ext: { width: logoWpx, height: logoHpx } });
  }

  let firstBlock = true;
  Object.entries(grupos).forEach(([disciplina, docs]) => {
    if (!firstBlock) ws.addRow(Array(12).fill(''));
    firstBlock = false;

    // Rótulos: Cliente / Doc (A=label | B:C=value | D=label | E:F=value)
    const rl1 = ws.addRow(['Cliente:', cliente, '', 'Doc:', docRef, '']);
    ws.mergeCells(rl1.number, 2, rl1.number, 3); ws.mergeCells(rl1.number, 5, rl1.number, 6);
    rl1.getCell(1).font = arialBold; rl1.getCell(1).fill = labelFill; rl1.getCell(1).alignment = left;
    rl1.getCell(2).font = arial; rl1.getCell(2).fill = valueFill; rl1.getCell(2).alignment = center;
    rl1.getCell(4).font = arialBold; rl1.getCell(4).fill = labelFill; rl1.getCell(4).alignment = left;
    rl1.getCell(5).font = arial; rl1.getCell(5).fill = valueFill; rl1.getCell(5).alignment = center;
    borderRow(rl1, 6);

    // Rótulos: Obra / Código da Obra
    const rl2 = ws.addRow(['Obra:', obra, '', 'Código da Obra:', '', '']);
    ws.mergeCells(rl2.number, 2, rl2.number, 3); ws.mergeCells(rl2.number, 5, rl2.number, 6);
    rl2.getCell(1).font = arialBold; rl2.getCell(1).fill = labelFill; rl2.getCell(1).alignment = left;
    rl2.getCell(2).font = arial; rl2.getCell(2).fill = valueFill; rl2.getCell(2).alignment = center;
    rl2.getCell(4).font = arialBold; rl2.getCell(4).fill = labelFill; rl2.getCell(4).alignment = left;
    rl2.getCell(5).font = arial; rl2.getCell(5).fill = valueFill; rl2.getCell(5).alignment = center;
    borderRow(rl2, 6);

    // Rótulos: Revisão / Data
    const rl3 = ws.addRow(['Revisão:', revisao, '', 'Data:', today, '']);
    ws.mergeCells(rl3.number, 2, rl3.number, 3); ws.mergeCells(rl3.number, 5, rl3.number, 6);
    rl3.getCell(1).font = arialBold; rl3.getCell(1).fill = labelFill; rl3.getCell(1).alignment = left;
    rl3.getCell(2).font = arial; rl3.getCell(2).fill = valueFill; rl3.getCell(2).alignment = center;
    rl3.getCell(4).font = arialBold; rl3.getCell(4).fill = labelFill; rl3.getCell(4).alignment = left;
    rl3.getCell(5).font = arial; rl3.getCell(5).fill = valueFill; rl3.getCell(5).alignment = center;
    borderRow(rl3, 6);

    // Rótulos: Disciplina / Fase / Coordenador (A | B | C | D | E | F)
    const rl4 = ws.addRow(['Disciplina:', disciplina, 'Fase:', fase, 'Coordenador:', coordenador]);
    rl4.getCell(1).font = arialBold; rl4.getCell(1).fill = labelFill; rl4.getCell(1).alignment = left;
    rl4.getCell(2).font = arialBold; rl4.getCell(2).fill = sectionFill; rl4.getCell(2).alignment = center;
    rl4.getCell(3).font = arialBold; rl4.getCell(3).fill = labelFill; rl4.getCell(3).alignment = left;
    rl4.getCell(4).font = arial; rl4.getCell(4).fill = valueFill; rl4.getCell(4).alignment = center;
    rl4.getCell(5).font = arialBold; rl4.getCell(5).fill = labelFill; rl4.getCell(5).alignment = left;
    rl4.getCell(6).font = arial; rl4.getCell(6).fill = valueFill; rl4.getCell(6).alignment = center;
    borderRow(rl4, 6);

    // Cabeçalho da tabela (12 colunas)
    const rHead = ws.addRow(['DOC', 'PAVIMENTO', 'DESCRIÇÃO INSTALAÇÕES', 'TIPO', 'ARQUIVO', 'ESCALA', 'EP', 'AP', 'PB', 'EX', 'LO', 'Retrab.']);
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
      const rSec = ws.addRow([sectionLabel, '', '', '', '', '', '', '', '', '', '', '']);
      ws.mergeCells(rSec.number, 1, rSec.number, 6);
      rSec.getCell(1).font = arialBold; rSec.getCell(1).fill = sectionFill; rSec.getCell(1).alignment = isGeral ? center : left;
      for (let c = 7; c <= 12; c++) rSec.getCell(c).border = thinBorder;
      borderRow(rSec, 6);
      docsPav.forEach(doc => {
        const row = ws.addRow([
          String(doc.numero || ''),
          String(doc.descritivo || ''),
          String(doc.area || ''),
          (doc.subdisciplinas || []).join(', '),
          String(doc.arquivo || ''),
          doc.escala != null && doc.escala !== '' ? String(doc.escala) : 'S/ ESC.',
          doc.tempo_estudo_preliminar || '',
          doc.tempo_ante_projeto || '',
          doc.tempo_projeto_basico || '',
          doc.tempo_projeto_executivo || '',
          doc.tempo_liberado_obra || '',
          doc.tempo_pre || ''
        ]);
        row.eachCell(cell => { cell.font = arial; cell.border = thinBorder; });
        row.getCell(1).alignment = center;
        for (let c = 7; c <= 12; c++) row.getCell(c).alignment = center;
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