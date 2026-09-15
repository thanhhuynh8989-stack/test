import { getConfig } from './config.js';

/**
 * Hàm chính: Đọc file Word và trả về danh sách câu hỏi đã xử lý
 * @param {ArrayBuffer} arrayBuffer - Dữ liệu file Word
 * @returns {Promise<Array>} Danh sách câu hỏi
 */
export async function parseDocxWithAi(arrayBuffer) {
  if (typeof mammoth === 'undefined') {
    throw new Error('Thiếu thư viện Mammoth.js trong file HTML!');
  }

  // 1. Chuyển file Word sang HTML, tự động đổi mọi hình ảnh thành Base64 inline
  const mammothOptions = {
    convertImage: mammoth.images.inline(function(element) {
      return element.read("base64").then(function(imageBuffer) {
        return {
          src: "data:" + element.contentType + ";base64," + imageBuffer
        };
      });
    })
  };

  const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer }, mammothOptions);
  const rawHtml = result.value;

  // 2. Bóc tách HTML thành mảng các câu hỏi giữ nguyên vị trí Text và Ảnh
  const rawQuestions = parseQuestionsFromDom(rawHtml);

  // 3. Quét các hình ảnh phát hiện được và gửi AI kiểm tra (Công thức -> LaTeX, Sơ đồ -> Giữ nguyên)
  const finalQuestions = await processImagesWithAi(rawQuestions);

  return finalQuestions;
}

/**
 * Duyệt DOM bóc tách câu hỏi, giữ nguyên thứ tự dòng text và thẻ <img>
 */
function parseQuestionsFromDom(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Gắn class CSS responsive trực tiếp cho mọi thẻ <img> tìm thấy trong file Word
  doc.querySelectorAll('img').forEach(img => {
    img.classList.add('exam-img');
    img.removeAttribute('style'); // Xóa kích thước cố định từ Word để tránh vỡ khung
  });

  // Lấy danh sách các thẻ khối
  const blockElements = Array.from(doc.body.querySelectorAll('p, li, div, tr'));

  const questions = [];
  let currentQ = null;

  const qRegex = /^(Câu|Cau)\s*\d+[:.]/i;
  const optRegex = /^([A-D])[\.:\)]\s*(.*)/i;

  blockElements.forEach(el => {
    // Tách phần tử thành nhiều dòng nếu bên trong có thẻ <br>
    const linesHtml = el.innerHTML.split(/<br\s*\/?>/i);

    linesHtml.forEach(lineHtml => {
      // Tạo phần tử ảo để lấy text sạch kiểm tra Regex
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = lineHtml;
      const cleanText = tempDiv.textContent.trim();

      const hasImage = tempDiv.querySelector('img') !== null;
      if (!cleanText && !hasImage) return;

      // Chuẩn hóa HTML dòng (giữ lại <em>, <strong>, <img>, <sub>, <sup>)
      const cleanLineHtml = lineHtml.trim();

      if (qRegex.test(cleanText)) {
        if (currentQ) questions.push(currentQ);
        currentQ = {
          id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          question: cleanLineHtml.replace(qRegex, '').trim(),
          noShuffleOptions: false,
          options: []
        };
      } else if (currentQ) {
        const matchOpt = cleanText.match(optRegex);
        if (matchOpt) {
          currentQ.options.push({
            id: 'opt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            text: cleanLineHtml.replace(/^([A-D])[\.:\)]\s*/i, '').trim(),
            isCorrect: checkIsCorrectOption(tempDiv)
          });
        } else if (currentQ.options.length === 0) {
          // Nối văn bản hoặc ảnh thuộc về phần nội dung câu hỏi
          currentQ.question += '<br>' + cleanLineHtml;
        }
      }
    });
  });

  if (currentQ) questions.push(currentQ);

  // Chuẩn hóa luôn có đủ 4 lựa chọn A, B, C, D
  questions.forEach(q => {
    while (q.options.length < 4) {
      q.options.push({
        id: 'opt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        text: '',
        isCorrect: false
      });
    }
  });

  return questions;
}

/**
 * Kiểm tra xem lựa chọn có được bôi đậm/gạch chân (đáp án đúng trong Word) không
 */
function checkIsCorrectOption(tempDiv) {
  const html = tempDiv.innerHTML;
  return /<(b|strong|u)>(\s*([A-D])[\.:\)])<\/(b|strong|u)>/i.test(html) || 
         !!tempDiv.querySelector('strong, b, u');
}

/**
 * Tự động gửi các hình ảnh cho AI phân loại & chuyển công thức sang LaTeX
 */
async function processImagesWithAi(questions) {
  const config = getConfig();
  if (!config || !config.geminiKey) return questions; // Nếu chưa cài Key thì giữ nguyên Base64

  for (let q of questions) {
    q.question = await replaceImagesInTextWithAi(q.question, config);
    for (let opt of q.options) {
      opt.text = await replaceImagesInTextWithAi(opt.text, config);
    }
  }

  return questions;
}

/**
 * Quét chuỗi text, nếu có <img src="data:..."> thì gửi Gemini đọc
 */
async function replaceImagesInTextWithAi(contentHtml, config) {
  if (!contentHtml.includes('<img')) return contentHtml;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = contentHtml;
  const imgs = Array.from(tempDiv.querySelectorAll('img'));

  for (let img of imgs) {
    const src = img.getAttribute('src');
    if (src && src.startsWith('data:image')) {
      try {
        const latexOrImg = await callGeminiVisionToIdentify(src, config);
        if (latexOrImg && latexOrImg.isFormula && latexOrImg.result) {
          // Nếu là công thức, thay thế thẻ <img> bằng mã LaTeX
          const span = document.createElement('span');
          span.textContent = ` $${latexOrImg.result}$ `;
          img.parentNode.replaceChild(span, img);
        }
      } catch (err) {
        console.warn('Lỗi OCR ảnh:', err);
      }
    }
  }

  return tempDiv.innerHTML;
}

/**
 * Gọi API Gemini Vision phân biệt công thức và hình vẽ
 */
async function callGeminiVisionToIdentify(base64Image, config) {
  const base64Data = base64Image.split(',')[1];
  const mimeType = base64Image.substring(base64Image.indexOf(":") + 1, base64Image.indexOf(";"));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel || 'gemini-1.5-flash'}:generateContent?key=${config.geminiKey}`;

  const prompt = `Phân tích ảnh này:
  1. Nếu đây là công thức toán, lý, hóa hoặc biểu thức ký hiệu, hãy viết lại thành mã LaTeX ngắn gọn (không bao gồm dấu $). Trả về JSON dạng: {"isFormula": true, "result": "mã_latex"}
  2. Nếu đây là sơ đồ, hình vẽ minh họa, hình học phức tạp, trả về JSON dạng: {"isFormula": false, "result": ""}`;

  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64Data } },
        { text: prompt }
      ]
    }]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  const textReply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = textReply.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Lỗi parse JSON từ AI:", e);
    }
  }

  return { isFormula: false, result: '' };
}
