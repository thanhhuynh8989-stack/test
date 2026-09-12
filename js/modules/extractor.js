import { getConfig } from './config.js';
import { loadExamLibrary } from './library.js';

// 1. Hàm đọc văn bản thuần từ file .docx
async function readDocxContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then(result => resolve(result.value))
        .catch(err => reject(new Error('Không thể đọc file .docx: ' + err.message)));
    };
    reader.onerror = err => reject(new Error('Lỗi đọc file: ' + err.message));
    reader.readAsArrayBuffer(file);
  });
}

// 2. Hàm gửi văn bản cho Gemini AI bóc tách danh sách câu hỏi
async function parseQuestionsWithGemini(rawText, apiKey) {
  const prompt = `Bạn là một trợ lý AI chuyên trích xuất đề thi. 
Hãy đọc đoạn văn bản đề thi dưới đây và chuyển đổi toàn bộ thành danh sách câu hỏi trắc nghiệm theo định dạng JSON Array thuần túy (KHÔNG chứa ký tự format markdown như \`\`\`json, KHÔNG giải thích thêm).

Mỗi câu hỏi phải theo đúng định dạng JSON Object sau:
{
  "question": "Nội dung câu hỏi?",
  "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
  "answer": 0
}
(Chú thích: "answer" là chỉ số index của đáp án đúng: 0 tương ứng với A, 1 tương ứng với B, 2 tương ứng với C, 3 tương ứng với D. Nếu không xác định được đáp án đúng, hãy mặc định để 0).

Nội dung đề thi gốc:
${rawText}`;

  // Gọi Gemini API v1beta với model gemini-2.5-flash
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(`Lỗi Gemini API: ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  // Làm sạch dữ liệu trả về từ AI (xóa các ký tự bọc markdown ```json ... ```)
  aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

  return JSON.parse(aiText);
}

// 3. Module điều khiển gửi form
export function initExtractorModule() {
  const form = document.getElementById('extractForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const config = getConfig();

    const title = document.getElementById('examTitle').value.trim();
    const duration = document.getElementById('examDuration').value;
    const maxViolations = document.getElementById('maxViolations').value;
    const fileInput = document.getElementById('docxFile');

    if (!title) return alert('Vui lòng nhập tên bộ đề thi!');
    if (!fileInput.files || fileInput.files.length === 0) return alert('Vui lòng chọn file đề thi Word (.docx)!');
    if (!config.geminiKey) return alert('Vui lòng nhập Gemini API Key ở Mục 1!');
    if (!config.ghToken) return alert('Vui lòng nhập GitHub Personal Access Token ở Mục 1!');

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;

    try {
      // Tiến trình 1: Đọc file Word
      btn.innerText = '⏳ 1/3. Đang đọc file Word...';
      const rawText = await readDocxContent(fileInput.files[0]);

      if (!rawText.trim()) throw new Error('File Word rỗng hoặc không có văn bản!');

      // Tiến trình 2: Bóc tách câu hỏi bằng Gemini AI
      btn.innerText = '🤖 2/3. Gemini AI đang phân tích câu hỏi...';
      const questions = await parseQuestionsWithGemini(rawText, config.geminiKey);

      // Tiến trình 3: Tạo object và định danh tên file
      const examData = {
        title,
        duration: parseInt(duration),
        maxViolations: parseInt(maxViolations),
        createdAt: new Date().toISOString(),
        questions: questions
      };

      // Xử lý chuẩn hóa tên file JSON (đổi Đ -> d, xóa gạch dưới đầu)
      const cleanFileName = title
        .toLowerCase()
        .replace(/đ/g, "d")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/^_+|_+$/g, "");

      const path = `exams/${cleanFileName}.json`;
      const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(examData, null, 2))));

      // Tiến trình 4: Đẩy file JSON hoàn chỉnh lên GitHub
      btn.innerText = '☁️ 3/3. Đang lưu lên GitHub...';
      const ghUrl = `https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/${path}`;

      let sha = null;
      const checkRes = await fetch(ghUrl, {
        headers: { 'Authorization': `token ${config.ghToken}` }
      });
      if (checkRes.ok) {
        const existingFile = await checkRes.json();
        sha = existingFile.sha;
      }

      const putRes = await fetch(ghUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${config.ghToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Thêm đề thi: ${title} (${questions.length} câu hỏi)`,
          content: contentBase64,
          branch: config.ghBranch,
          ...(sha ? { sha } : {})
        })
      });

      if (!putRes.ok) throw new Error('Không thể ghi file lên GitHub Repository');

      alert(`Thành công! AI đã trích xuất được ${questions.length} câu hỏi và lưu vào thư viện.`);
      loadExamLibrary();

    } catch (err) {
      alert(`Đã xảy ra lỗi: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  });
}
