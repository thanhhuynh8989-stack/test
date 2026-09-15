import { convertPdfToImages } from './pdfHandler.js';
import { parsePdfPageWithGemini } from './geminiVision.js';

/**
 * Đọc file PDF và xử lý qua AI
 * @param {ArrayBuffer} arrayBuffer 
 * @param {Function} onProgress - Callback thông báo tiến trình (trangHiệnTại, tổngSốTrang)
 */
export async function parsePdfWithAi(arrayBuffer, onProgress) {
  // 1. Chuyển PDF thành danh sách ảnh
  const pageImages = await convertPdfToImages(arrayBuffer);
  let allQuestions = [];

  // 2. Duyệt qua từng trang để AI đọc
  for (let i = 0; i < pageImages.length; i++) {
    if (typeof onProgress === 'function') {
      onProgress(i + 1, pageImages.length);
    }

    const pageQuestions = await parsePdfPageWithGemini(pageImages[i]);

    // 3. Chuẩn hóa ID cho câu hỏi và đáp án
    const formattedQuestions = pageQuestions.map(q => ({
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      question: q.question,
      options: (q.options || []).map(opt => ({
        id: 'opt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        text: opt.text || '',
        isCorrect: !!opt.isCorrect
      }))
    }));

    allQuestions = allQuestions.concat(formattedQuestions);
  }

  return allQuestions;
}
