// Extração das fotos embutidas nas planilhas .xlsx de importação da PRE
import ExcelJS from 'exceljs';

const MIME_POR_EXTENSAO = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

function textoCelula(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    if (Array.isArray(valor.richText)) return valor.richText.map(t => t.text || '').join('');
    if (valor.text !== undefined) return textoCelula(valor.text);
    if (valor.result !== undefined) return textoCelula(valor.result);
    return '';
  }
  return String(valor).trim();
}

function chaveDoItem(valor) {
  return textoCelula(valor).toLowerCase().replace(/\s+/g, '');
}

// Linha (1-based) em que a foto está ancorada na planilha
function linhaDaImagem(range) {
  const tl = range?.tl || {};
  const candidatos = [tl.nativeRow, tl.row, tl.nativeRowNum, tl.rowNum];
  const valor = candidatos.find(c => typeof c === 'number' && !isNaN(c));
  return valor === undefined ? null : Math.floor(valor) + 1;
}

// Coluna "ITEM" do cabeçalho (usa a coluna A quando não encontra o rótulo)
function colunaDoItem(ws) {
  let coluna = null;
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (coluna || row.number > 40) return;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (coluna) return;
      if (textoCelula(cell.value).toLowerCase() === 'item') coluna = col;
    });
  });
  return coluna || 1;
}

function arquivoDaImagem(media, nome) {
  if (!media || !media.buffer) return null;
  const extensao = String(media.extension || 'png').toLowerCase();
  const bytes = media.buffer instanceof ArrayBuffer ? new Uint8Array(media.buffer) : media.buffer;
  return new File([bytes], `${nome}.${extensao}`, { type: MIME_POR_EXTENSAO[extensao] || 'image/png' });
}

// Lê as fotos embutidas e agrupa por item: Map<chave do item, File[]>
export async function extrairImagensPlanilha(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const planilha = wb.worksheets.find(ws => (ws.getImages?.() || []).length > 0);
  if (!planilha) return new Map();

  const colunaItem = colunaDoItem(planilha);
  const porItem = new Map();

  planilha.getImages().forEach((imagem, indice) => {
    const linha = linhaDaImagem(imagem.range);
    if (!linha) return;
    const chave = chaveDoItem(planilha.getRow(linha).getCell(colunaItem).value);
    if (!chave) return;
    const arquivo = arquivoDaImagem(wb.getImage(imagem.imageId), `pre-item-${chave}-${indice + 1}`);
    if (!arquivo) return;
    if (!porItem.has(chave)) porItem.set(chave, []);
    porItem.get(chave).push(arquivo);
  });

  return porItem;
}

// Fotos de um item importado (casa "1" com "1" e "01" com "1")
export function imagensDoItem(imagensPorItem, itemImportado) {
  const chave = chaveDoItem(itemImportado);
  if (!chave) return [];
  if (imagensPorItem.has(chave)) return imagensPorItem.get(chave);
  const numero = parseFloat(chave);
  if (isNaN(numero)) return [];
  for (const [outraChave, arquivos] of imagensPorItem) {
    if (parseFloat(outraChave) === numero) return arquivos;
  }
  return [];
}