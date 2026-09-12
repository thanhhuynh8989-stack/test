import { getConfig } from './config.js';
import { loadExamLibrary } from './library.js';

// 1. Hàm đọc văn bản từ file Word .docx
async function readDocxContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      if (!window.mammoth) {
        reject(new Error('Chưa nạp thư viện Mammoth.js. Hãy kiểm tra lại index.html!'));
        return;
      }
      window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then(result => resolve(result.value))
        .catch(err => reject(new Error('Không thể đọc nội dung file .docx: ' + err.message)));
    };
    reader.onerror = err => reject(new Error('Lỗi đọc file từ máy tính: ' + err.message));
    reader.readAsArrayBuffer(file);
  });
}

// 2. Hàm gửi request tới Gemini AI API
async function parseQuestionsWithGemini(rawText, apiKey, modelName) {
  const activeModel = modelName || 'gemini-2.5-flash';

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

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(`Lỗi Gemini API (${activeModel}): ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();

  return JSON.parse(aiText);
}

// 3. Xử lý sự kiện Submit Form Trích Xuất
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

    // Lấy model đã lưu hoặc đặt mặc định
    const selectedModel = config.geminiModel || 'gemini-2.5-flash';

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;

    try {
      // BƯỚC 1: Đọc file Word
      btn.innerText = '⏳ 1/3. Đang đọc file Word...';
      const rawText = await readDocxContent(fileInput.files[0]);
      if (!rawText.trim()) throw new Error('File Word được chọn không có nội dung văn bản!');

      // BƯỚC 2: Gọi Gemini AI
      btn.innerText = `🤖 2/3. Gemini (${selectedModel}) đang trích xuất câu hỏi...`;
      const questions = await parseQuestionsWithGemini(rawText, config.geminiKey, selectedModel);

      // BƯỚC 3: Đóng gói dữ liệu JSON
      const examData = {
        title,
        duration: parseInt(duration),
        maxViolations: parseInt(maxViolations),
        createdAt: new Date().toISOString(),
        questions: questions
      };

      // Chuẩn hóa tên file (Loại bỏ ký tự đ, dấu tiếng Việt, ký tự đặc biệt)
      const cleanFileName = title
        .toLowerCase()
        .replace(/đ/g, "d")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/^_+|_+$/g, "");

      const path = `exams/${cleanFileName}.json`;
      const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(examData, null, 2))));

      // BƯỚC 4: Lưu lên GitHub (Tự động tạo thư mục exams/ nếu chưa có)
      btn.innerText = '☁️ 3/3. Đang đẩy dữ liệu lên GitHub...';
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

      if (!putRes.ok) {
        const errPut = await putRes.json();
        throw new Error(`Lỗi GitHub API: ${errPut.message || putRes.statusText}`);
      }

      alert(`Thành công! Đã trích xuất ${questions.length} câu hỏi và tự động tạo thư mục exams/ trên GitHub.`);
      loadExamLibrary();

    } catch (err) {
      alert(`Đã xảy ra lỗi: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  });
}
