import { getConfig } from './config.js';

/**
 * Gửi ảnh trang PDF cho Gemini Vision phân tích thành câu hỏi
 * @param {string} base64Image - Dữ liệu ảnh Base64
 * @returns {Promise<Array>} Danh sách câu hỏi bóc tách từ trang
 */
export async function parsePdfPageWithGemini(base64Image) {
  const config = getConfig();
  if (!config || !config.geminiKey) {
    throw new Error("Chưa cấu hình API Key cho Gemini!");
  }

  const base64Data = base64Image.split(',')[1];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel || 'gemini-1.5-flash'}:generateContent?key=${config.geminiKey}`;

  const prompt = `Bạn là trợ lý trích xuất đề thi. Hãy đọc hình ảnh trang đề thi này và trích xuất tất cả câu hỏi.
Yêu cầu bắt buộc:
1. Giữ nguyên nội dung văn bản và lựa chọn đáp án A, B, C, D.
2. Công thức toán, lý, hóa hoặc ký hiệu đặc biệt phải đổi sang mã LaTeX (ví dụ: $x^2 + y^2 = z^2$).
3. Nếu phát hiện đáp án đúng (được bôi đậm/gạch chân), đánh dấu "isCorrect": true.
4. Chỉ trả về chuỗi JSON thuần (không chứa ký tự Markdown \`\`\`json) theo cấu trúc mảng:
[
  {
    "question": "Nội dung câu hỏi...",
    "options": [
      {"text": "Nội dung A", "isCorrect": false},
      {"text": "Nội dung B", "isCorrect": true},
      {"text": "Nội dung C", "isCorrect": false},
      {"text": "Nội dung D", "isCorrect": false}
    ]
  }
]`;

  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: "image/png", data: base64Data } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Lỗi kết nối Gemini API (${res.status})`);
  }

  const data = await res.json();
  const textReply = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  try {
    return JSON.parse(textReply);
  } catch (err) {
    console.error("Lỗi giải mã JSON từ AI:", textReply);
    return [];
  }
}
