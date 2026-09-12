import { getConfig } from './config.js';
import { loadExamLibrary } from './library.js';

// Hàm cập nhật trạng thái Progress Bar
function updateProgress(percent, statusText) {
  const container = document.getElementById('progressContainer');
  const bar = document.getElementById('progressBar');
  const percentTxt = document.getElementById('progressPercent');
  const statusTxt = document.getElementById('progressStatus');

  if (container) container.style.display = 'block';
  if (bar) bar.style.width = `${percent}%`;
  if (percentTxt) percentTxt.textContent = `${percent}%`;
  if (statusTxt) statusTxt.textContent = statusText;
}

// 1. Hàm đọc văn bản từ file Word .docx
async function readDocxContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      if (!window.mammoth) {
        reject(new Error('Chưa nạp thư viện Mammoth.js trong index.html!'));
        return;
      }
      window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then(result => resolve(result.value))
        .catch(err => reject(new Error('Không thể đọc file .docx: ' + err.message)));
    };
    reader.onerror = err => reject(new Error('Lỗi đọc file: ' + err.message));
    reader.readAsArrayBuffer(file);
  });
}

// 2. Hàm gửi Gemini AI API với cơ chế Timeout (60s) & Structured Output
async function parseQuestionsWithGemini(rawText, apiKey, targetModel) {
  const activeModelName = targetModel || 'gemini-2.5-flash';

  const prompt = `Bạn là một trợ lý AI chuyên trích xuất đề thi. 
Hãy đọc đoạn văn bản đề thi dưới đây và chuyển đổi toàn bộ thành danh sách câu hỏi trắc nghiệm theo định dạng JSON Array.

Mỗi câu hỏi phải theo đúng định dạng JSON Object sau:
{
  "question": "Nội dung câu hỏi?",
  "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
  "answer": 0
}
(Chú thích: "answer" là chỉ số index của đáp án đúng: 0 tương ứng với A, 1 tương ứng với B, 2 tương ứng với C, 3 tương ứng với D).

Nội dung đề thi gốc:
${rawText}`;

  // Cấu hình ngắt kết nối nếu quá 60 giây
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json" // Ép Gemini trả về dạng JSON chuẩn
        }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(`Lỗi Gemini API (${activeModelName}): ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Bóc tách JSON Array an toàn bằng Regex
    const jsonMatch = aiText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      aiText = jsonMatch[0];
    }

    return JSON.parse(aiText);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Quá thời gian phản hồi (Timeout 60s). Model ${activeModelName} phản hồi chậm hoặc bị treo.`);
    }
    throw err;
  }
}

// 3. Module chính điều khiển tiến trình trích xuất
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

    const currentModel = config.geminiModel || 'gemini-2.5-flash';
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;

    let progressInterval = null;

    try {
      // ----------------------------------------------------
      // BƯỚC 1: Đọc file Word (0% -> 25%)
      // ----------------------------------------------------
      updateProgress(10, '⏳ 1/3. Đang đọc nội dung file Word...');
      const rawText = await readDocxContent(fileInput.files[0]);
      if (!rawText.trim()) throw new Error('File Word rỗng hoặc không chứa văn bản!');
      updateProgress(25, '✅ Đã đọc xong file Word.');

      // ----------------------------------------------------
      // BƯỚC 2: Gọi Gemini AI (25% -> 80%)
      // ----------------------------------------------------
      let currentPercent = 25;
      updateProgress(currentPercent, `🤖 2/3. Gemini (${currentModel}) đang phân tích câu hỏi...`);

      progressInterval = setInterval(() => {
        if (currentPercent < 80) {
          currentPercent += 2;
          updateProgress(currentPercent, `🤖 2/3. Gemini (${currentModel}) đang phân tích câu hỏi...`);
        }
      }, 500);

      const questions = await parseQuestionsWithGemini(rawText, config.geminiKey, currentModel);
      clearInterval(progressInterval);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Gemini không trích xuất được câu hỏi nào từ file Word này.');
      }

      updateProgress(85, `✅ AI trích xuất xong ${questions.length} câu hỏi!`);

      // ----------------------------------------------------
      // BƯỚC 3: Tạo File & Đẩy lên GitHub (85% -> 100%)
      // ----------------------------------------------------
      updateProgress(90, '☁️ 3/3. Đang lưu file JSON lên GitHub...');

      let cleanFileName = title
        .toLowerCase()
        .replace(/đ/g, "d")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/^_+|_+$/g, "");

      if (!cleanFileName) {
        cleanFileName = `exam_${Date.now()}`;
      }

      const examData = {
        title,
        duration: parseInt(duration) || 15,
        maxViolations: parseInt(maxViolations) || 3,
        createdAt: new Date().toISOString(),
        questions: questions
      };

      const path = `exams/${cleanFileName}.json`;
      const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(examData, null, 2))));
      const branch = config.ghBranch || 'main';

      const ghUrl = `https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/${path}?ref=${branch}`;

      // Kiểm tra file đã tồn tại trên GitHub chưa để lấy SHA
      let sha = null;
      const checkRes = await fetch(ghUrl, {
        headers: { 'Authorization': `token ${config.ghToken}` }
      });
      if (checkRes.ok) {
        const existingFile = await checkRes.json();
        sha = existingFile.sha;
      }

      // Đẩy file lên GitHub via REST API
      const putRes = await fetch(`https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/${path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${config.ghToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Thêm đề thi: ${title} (${questions.length} câu hỏi)`,
          content: contentBase64,
          branch: branch,
          ...(sha ? { sha } : {})
        })
      });

      if (!putRes.ok) {
        const errJson = await putRes.json();
        throw new Error(`Lỗi GitHub API: ${errJson.message || putRes.statusText}`);
      }

      updateProgress(100, '🎉 Hoàn tất quá trình trích xuất và lưu thư viện!');

      setTimeout(() => {
        alert(`Thành công! Đã trích xuất ${questions.length} câu hỏi và tạo file exams/${cleanFileName}.json`);
        loadExamLibrary(); // Tự động làm mới thư viện đề thi
      }, 300);

    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      updateProgress(0, `❌ Lỗi: ${err.message}`);
      alert(`Đã xảy ra lỗi: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  });
}
