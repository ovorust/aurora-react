import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const MAX_CHARS = 60000; // ~15k tokens — suficiente pra a maioria dos documentos jurídicos
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Extrai o texto de um arquivo PDF (File/Blob) inteiramente no navegador.
 * Retorna { text, pageCount, truncated, fileName }.
 */
export async function extractPdfText(file) {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Selecione um arquivo PDF válido.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('PDF muito grande (limite de 20MB).');
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    text += `\n\n--- Página ${i} ---\n${pageText}`;
  }

  text = text.trim();
  const truncated = text.length > MAX_CHARS;
  if (truncated) {
    text = text.slice(0, MAX_CHARS) + '\n\n[... conteúdo truncado, PDF muito longo ...]';
  }

  if (!text || text.replace(/---\s*Página\s*\d+\s*---/g, '').trim().length < 10) {
    throw new Error(
      'Não foi possível extrair texto deste PDF. Ele pode ser um documento escaneado (imagem) sem OCR.'
    );
  }

  return { text, pageCount: pdf.numPages, truncated, fileName: file.name };
}
