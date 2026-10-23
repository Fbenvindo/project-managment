// Exportação dos itens da PRE em Excel (.xlsx)
import ExcelJS from 'exceljs';
import { format } from 'date-fns';

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/577f93874_logo_Interativa_versao_final_sem_fundo_0002.png";

const COLUNAS = [
  { header: 'ITEM', width: 8 },
  { header: 'DATA', width: 12 },
  { header: 'DE', width: 26 },
  { header: 'DESCRITIVA', width: 20 },
  { header: 'LOCALIZAÇÃO', width: 18 },
  { header: 'ASSUNTO', width: 34 },
  { header: 'COMENTÁRIO', width: 38 },
  { header: 'DISCIPLINA', width: 16 },
  { header: 'STATUS', width: 14 },
  { header: 'RESPOSTA', width: 34 },
  { header: 'TEMPO (H)', width: 10 },
  { header: 'USUÁRIO', width: 22 },
];

function formatarData(valor) {
  if (!valor) return '';
  const base = String(valor).slice(0, 10);
  const d = new Date(`${base}T00:00:00`);
  return isNaN(d.getTime()) ? String(valor) : format(d, 'dd/MM/yyyy');
}

export async function exportarPREExcel({ empreendimento, items = [], headerData }) {
  const lastCol = COLUNAS.length;

  const arial = { name: 'Arial', size: 10 };
  const arialBold = { name: 'Arial', size: 10, bold: true };
  const tituloFont = { name: 'Arial', size: 14, bold: true };
  const labelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
  const valueFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8CCE4' } };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };
  const center = { horizontal: 'center', vertical: 'middle', wrapText: true };
  const leftWrap = { horizontal: 'left', vertical: 'top', wrapText: true };
  const centerWrap = { horizontal: 'center', vertical: 'top', wrapText: true };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('PRE');
  ws.columns = COLUNAS.map(c => ({ width: c.width }));

  const borderRow = (row) => {
    for (let c = 1; c <= lastCol; c++) row.getCell(c).border = thinBorder;
  };

  // Logo Interativa (proporção mantida)
  let logoId = null;
  const logoHpx = 46;
  let logoWpx = 184;
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
  } catch { logoId = null; }

  const logoRow = ws.addRow(Array(lastCol).fill(''));
  logoRow.height = logoId ? (logoHpx * 0.75 + 6) : 20;
  if (logoId) {
    ws.addImage(logoId, { tl: { col: 0, row: logoRow.number - 1 }, ext: { width: logoWpx, height: logoHpx } });
  }

  // Título
  const tituloRow = ws.addRow(['Emails, ATA e Documentos']);
  ws.mergeCells(tituloRow.number, 1, tituloRow.number, lastCol);
  tituloRow.getCell(1).font = tituloFont;
  tituloRow.getCell(1).alignment = center;
  tituloRow.height = 24;

  // Linhas de identificação
  const addInfoRow = (rotulo1, valor1, rotulo2, valor2) => {
    const row = ws.addRow(Array(lastCol).fill(''));
    ws.mergeCells(row.number, 2, row.number, 6);
    ws.mergeCells(row.number, 8, row.number, lastCol);
    row.getCell(1).value = rotulo1;
    row.getCell(1).font = arialBold; row.getCell(1).fill = labelFill; row.getCell(1).alignment = leftWrap;
    row.getCell(2).value = valor1 || '';
    row.getCell(2).font = arial; row.getCell(2).fill = valueFill; row.getCell(2).alignment = leftWrap;
    row.getCell(7).value = rotulo2;
    row.getCell(7).font = arialBold; row.getCell(7).fill = labelFill; row.getCell(7).alignment = leftWrap;
    row.getCell(8).value = valor2 || '';
    row.getCell(8).font = arial; row.getCell(8).fill = valueFill; row.getCell(8).alignment = leftWrap;
    borderRow(row);
    row.height = 18;
  };

  addInfoRow('Cliente:', headerData?.cliente || empreendimento?.cliente || '', 'Rev:', headerData?.rev || '');
  addInfoRow('Obra:', headerData?.obra || empreendimento?.nome || '', 'Arquivo:', headerData?.arquivo || '');
  addInfoRow('Descrição:', headerData?.descricao || '', 'Data:', headerData?.data || format(new Date(), 'dd/MM/yyyy'));

  ws.addRow(Array(lastCol).fill('')).height = 6;

  // Cabeçalho da tabela
  const headRow = ws.addRow(COLUNAS.map(c => c.header));
  headRow.eachCell(cell => { cell.font = arialBold; cell.fill = sectionFill; cell.alignment = center; });
  borderRow(headRow);
  headRow.height = 20;

  // Itens da PRE
  items.forEach(item => {
    const row = ws.addRow([
      String(item.item ?? ''),
      formatarData(item.data),
      String(item.de || ''),
      String(item.descritiva || ''),
      String(item.localizacao || ''),
      String(item.assunto || ''),
      String(item.comentario || ''),
      String(item.disciplina || ''),
      String(item.status || ''),
      String(item.resposta || ''),
      item.tempo_atendimento !== null && item.tempo_atendimento !== undefined ? Number(item.tempo_atendimento) : '',
      String(item.planejamento_executor_nome || item.planejamento_executor || ''),
    ]);
    row.eachCell(cell => { cell.font = arial; });
    borderRow(row);
    row.getCell(1).alignment = centerWrap;
    row.getCell(1).numFmt = '@';
    row.getCell(2).alignment = centerWrap;
    row.getCell(11).alignment = centerWrap;
    for (let c = 3; c <= 10; c++) row.getCell(c).alignment = leftWrap;
    row.getCell(12).alignment = leftWrap;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  const nome = String(empreendimento?.nome || 'Empreendimento').replace(/\s+/g, '_');
  link.href = URL.createObjectURL(blob);
  link.download = `PRE_${nome}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}