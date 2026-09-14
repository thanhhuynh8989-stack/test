import { getConfig, getCurrentUser } from './config.js';
import { loadExamLibrary } from './library.js';

let currentExamData = [];

export function initExtractorModule() {
  const btnProcess = document.getElementById('btnProcessWord');
  const btnAddQuestion = document.getElementById('btnAddQuestion');
  const btnAiSuggest = document.getElementById('btnAiSuggest');
  const btnSaveExam = document.getElementById('btnSaveExam');

  if (btnProcess) btnProcess.addEventListener('click', handleWordUpload);
  if (btnAddQuestion) btnAddQuestion.addEventListener('click', addNewQuestion);
  if (btnAiSuggest) btnAiSuggest.addEventListener('click', handleAiSuggestAnswers);
  if (btnSaveExam) btnSaveExam.addEventListener('click', saveExamToSystem);
}

// 1. Đọc và bóc tách file Word (Docx)
async function handleWordUpload() {
  const fileInput = document.getElementById('wordFileInput');
  if (!fileInput || !fileInput.files[0]) {
    alert('Vui lòng chọn 1 file Word (.docx)!');
    return;
  }

  if (typeof mammoth === 'undefined') {
    alert('❌ Khuyết thư viện Mammoth.js! Vui lòng chèn script MammothJS vào file HTML.');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function (e) {
    const arrayBuffer = e.target.result;
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
      const htmlText = result.value;

      currentExamData = parseQuestionsFromHtml(htmlText);

      if (currentExamData.length === 0) {
        alert('Không tìm thấy câu hỏi nào trong file Word. Vui lòng kiểm tra lại định dạng!');
        return;
      }

      renderPreviewUI();

    } catch (err) {
      alert('Lỗi bóc tách file Word: ' + err.message);
    }
  };

  reader.readAsArrayBuffer(file);
}

// 2. Chuyển đổi HTML sang mảng Object Câu hỏi
function parseQuestionsFromHtml(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const elements = Array.from(tempDiv.querySelectorAll('p, li'));
  const questions = [];
  let currentQ = null;

  const qRegex = /^(Câu|Cau)\s*\d+[:.]/i;
  const optRegex = /^([A-D])[\.:\)]\s*(.*)/i;

  elements.forEach(el => {
    const text = el.textContent.trim();
    if (!text) return;

    const innerHTML = el.innerHTML;
    const isLetterFormatted = /<(b|strong|u)>(\s*([A-D])[\.:\)])<\/(b|strong|u)>/i.test(innerHTML);
    const isWholeFormatted = !!el.querySelector('strong, b, u');
    const isCorrectChoice = isLetterFormatted || isWholeFormatted;

    if (qRegex.test(text)) {
      if (currentQ) questions.push(currentQ);
      currentQ = {
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        question: text.replace(qRegex, '').trim(),
        noShuffleOptions: false,
        options: []
      };
    } else if (currentQ) {
      const matchOpt = text.match(optRegex);
      if (matchOpt) {
        currentQ.options.push({
          id: 'opt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          text: matchOpt[2].trim(),
          isCorrect: isCorrectChoice
        });
      } else if (currentQ.options.length === 0) {
        currentQ.question += '\n' + text;
      }
    }
  });

  if (currentQ) questions.push(currentQ);

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

// 3. Hiển thị Giao diện Preview Editable
function renderPreviewUI() {
  const container = document.getElementById('previewContainer');
  const sectionPreview = document.getElementById('sectionPreview');
  if (sectionPreview) sectionPreview.style.display = 'block';
  if (!container) return;

  container.innerHTML = '';

  currentExamData.forEach((q, index) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.style.cssText = 'border:1px solid #e5e7eb; border-radius:8px; padding:15px; margin-bottom:15px; background:#fff; position:relative;';

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <b style="color:#1e40af;">Câu ${index + 1}:</b>
        <button onclick="window.deleteQuestion(${index})" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">🗑️ Xóa câu này</button>
      </div>
      <textarea onchange="window.updateQuestionText(${index}, this.value)" style="width:100%; min-height:60px; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit; font-size:14px; margin-bottom:10px;">${escapeHTML(q.question)}</textarea>
      
      <div style="margin-bottom:10px;">
        <label style="font-size:13px; color:#475569; cursor:pointer;">
          <input type="checkbox" ${q.noShuffleOptions ? 'checked' : ''} onchange="window.toggleNoShuffle(${index}, this.checked)">
          📌 <b>Không tráo phương án câu này</b> (Dùng cho câu có dạng "Cả A và B đều đúng")
        </label>
      </div>
      
      <div class="options-group">
    `;

    const labels = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, optIndex) => {
      const label = labels[optIndex] || `P.An ${optIndex + 1}`;
      html += `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <input type="radio" name="correct_${q.id}" ${opt.isCorrect ? 'checked' : ''} onchange="window.setCorrectOption(${index}, ${optIndex})" style="width:18px; height:18px; cursor:pointer;" title="Tích chọn làm đáp án đúng">
          <span style="font-weight:bold; width:20px;">${label}.</span>
          <input type="text" value="${escapeHTML(opt.text)}" onchange="window.updateOptionText(${index}, ${optIndex}, this.value)" style="flex:1; padding:6px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px;">
        </div>
      `;
    });

    html += `</div>`;
    card.innerHTML = html;
    container.appendChild(card);
  });
}

// Global Handlers cho Preview
window.updateQuestionText = (qIndex, text) => { currentExamData[qIndex].question = text; };
window.updateOptionText = (qIndex, optIndex, text) => { currentExamData[qIndex].options[optIndex].text = text; };
window.toggleNoShuffle = (qIndex, checked) => { currentExamData[qIndex].noShuffleOptions = checked; };
window.setCorrectOption = (qIndex, optIndex) => {
  currentExamData[qIndex].options.forEach((opt, i) => {
    opt.isCorrect = (i === optIndex);
  });
};
window.deleteQuestion = (qIndex) => {
  if (confirm(`Bạn có chắc muốn xóa câu ${qIndex + 1}?`)) {
    currentExamData.splice(qIndex, 1);
    renderPreviewUI();
  }
};

function addNewQuestion() {
  currentExamData.push({
    id: 'q_' + Date.now(),
    question: 'Nội dung câu hỏi mới...',
    noShuffleOptions: false,
    options: [
      { id: 'opt_' + Date.now() + '_1', text: '', isCorrect: true },
      { id: 'opt_' + Date.now() + '_2', text: '', isCorrect: false },
      { id: 'opt_' + Date.now() + '_3', text: '', isCorrect: false },
      { id: 'opt_' + Date.now() + '_4', text: '', isCorrect: false }
    ]
  });
  renderPreviewUI();
}

// 4. Tích hợp AI (Gemini API) giải các câu CHƯA CÓ đáp án
async function handleAiSuggestAnswers() {
  const config = getConfig();
  const apiKey = config.geminiKey; 
  const modelName = config.geminiModel || 'gemini-1.5-flash';

  if (!apiKey) {
    alert('Vui lòng nhập Gemini API Key trong "Mục Cấu hình hệ thống" và nhấn Lưu!');
    return;
  }

  const unselectedQuestions = [];
  currentExamData.forEach((q, index) => {
    const hasCorrect = q.options.some(opt => opt.isCorrect);
    if (!hasCorrect) {
      unselectedQuestions.push({ 
        index: index, 
        question: q.question, 
        options: q.options.map(o => o.text) 
      });
    }
  });

  if (unselectedQuestions.length === 0) {
    alert('Tất cả các câu hỏi đã có đáp án được chọn!');
    return;
  }

  const btnAi = document.getElementById('btnAiSuggest');
  const originalText = btnAi ? btnAi.textContent : '';
  if (btnAi) {
    btnAi.disabled = true;
    btnAi.textContent = `🤖 AI đang giải ${unselectedQuestions.length} câu chưa có đáp án...`;
  }

  try {
    const prompt = `Bạn là một chuyên gia giáo dục. Trả về kết quả dưới dạng mảng JSON duy nhất: [{ "index": số_thứ_tự_câu, "correctIndex": chỉ_số_đáp_án_đúng_từ_0_đến_3 }].\n\nDanh sách câu hỏi:\n${JSON.stringify(unselectedQuestions, null, 2)}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `Lỗi HTTP ${response.status}`);
    }

    const data = await response.json();
    const replyText = data.candidates[0]?.content?.parts[0]?.text || '';
    
    const jsonMatch = replyText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const results = JSON.parse(jsonMatch[0]);
      results.forEach(res => {
        if (currentExamData[res.index] && currentExamData[res.index].options[res.correctIndex]) {
          currentExamData[res.index].options.forEach((opt, i) => {
            opt.isCorrect = (i === res.correctIndex);
          });
        }
      });
      renderPreviewUI();
      alert(`✨ AI đã gợi ý xong đáp án cho ${results.length} câu! Hãy kiểm tra lại trước khi lưu.`);
    } else {
      throw new Error('AI không trả về đúng định dạng JSON.');
    }

  } catch (err) {
    alert('Lỗi khi gọi Gemini AI: ' + err.message);
  } finally {
    if (btnAi) {
      btnAi.disabled = false;
      btnAi.textContent = originalText;
    }
  }
}

// 5. Lưu đề thi (Vừa lưu lên GitHub vừa tải về máy)
async function saveExamToSystem() {
  if (currentExamData.length === 0) {
    alert('Chưa có dữ liệu câu hỏi để lưu!');
    return;
  }

  const examTitleInput = document.getElementById('examTitleInput');
  const examDurationInput = document.getElementById('examDurationInput');
  const examMaxViolationsInput = document.getElementById('examMaxViolationsInput');

  const examTitle = (examTitleInput && examTitleInput.value.trim()) || 'De_Thi_Trac_Nghiem';
  const duration = (examDurationInput && parseInt(examDurationInput.value)) || 15;
  const maxViolations = (examMaxViolationsInput && parseInt(examMaxViolationsInput.value)) || 3;

  const cleanId = examTitle.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);

  // 💥 LẤY THÔNG TIN USER ĐANG ĐĂNG NHẬP ĐỂ GÁN VÀO ĐỀ THI
  const currentUser = getCurrentUser();
  const createdBy = currentUser ? (currentUser.username || currentUser.fullName || 'Admin') : 'Admin';

  const payload = {
    examId: cleanId,
    title: examTitle,
    duration: duration,
    maxViolations: maxViolations,
    createdBy: createdBy, // 💥 BỔ SUNG TRƯỜNG TÊN NGƯỜI TẠO VÀO DỮ LIỆU ĐỀ THI
    createdAt: new Date().toISOString(),
    totalQuestions: currentExamData.length,
    questions: currentExamData
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const config = getConfig();

  if (config.ghOwner && config.ghRepo && config.ghToken) {
    try {
      const fileName = `${cleanId}.json`;
      const url = `https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/exams/${fileName}`;
      const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${config.ghToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Tạo đề thi mới bởi ${createdBy}: ${examTitle}`,
          content: base64Content,
          branch: config.ghBranch || 'main'
        })
      });

      if (!res.ok) throw new Error('Không thể lưu file lên GitHub');

      alert(`🎉 Đã tạo đề thi thành công!`);

      if (typeof loadExamLibrary === 'function') {
        await loadExamLibrary();
      }

    } catch (err) {
      alert(`⚠️ Lỗi lưu file: ${err.message}`);
    }
  } else {
    alert('Vui lòng kiểm tra lại cấu hình GitHub Token / Owner / Repo!');
  }
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
