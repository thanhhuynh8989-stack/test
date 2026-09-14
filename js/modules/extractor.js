import { getConfig } from './config.js';

let currentExamData = []; // Lưu trữ danh sách câu hỏi hiện tại

export function initExtractorModule() {
  const btnProcess = document.getElementById('btnProcessWord');
  const fileInput = document.getElementById('wordFileInput');
  const btnAddQuestion = document.getElementById('btnAddQuestion');
  const btnAiSuggest = document.getElementById('btnAiSuggest');
  const btnSaveExam = document.getElementById('btnSaveExam');

  if (btnProcess) {
    btnProcess.addEventListener('click', handleWordUpload);
  }

  if (btnAddQuestion) {
    btnAddQuestion.addEventListener('click', addNewQuestion);
  }

  if (btnAiSuggest) {
    btnAiSuggest.addEventListener('click', handleAiSuggestAnswers);
  }

  if (btnSaveExam) {
    btnSaveExam.addEventListener('click', saveExamToFile);
  }
}

// 1. Đọc và bóc tách file Word (Docx)
async function handleWordUpload() {
  const fileInput = document.getElementById('wordFileInput');
  if (!fileInput || !fileInput.files[0]) {
    alert('Vui lòng chọn 1 file Word (.docx)!');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function (e) {
    const arrayBuffer = e.target.result;
    try {
      // Dùng MammothJS để chuyển Docx sang HTML
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
      const htmlText = result.value;

      // Parse HTML ra danh sách câu hỏi
      currentExamData = parseQuestionsFromHtml(htmlText);

      if (currentExamData.length === 0) {
        alert('Không tìm thấy câu hỏi nào trong file Word. Vui lòng kiểm tra lại định dạng!');
        return;
      }

      // Hiển thị ra giao diện Preview
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
  const paragraphs = Array.from(tempDiv.querySelectorAll('p, li')).map(p => p.textContent.trim()).filter(Boolean);

  const questions = [];
  let currentQ = null;

  const qRegex = /^(Câu|Cau)\s*\d+[:.]/i;
  const optRegex = /^([A-D])[\.:\)]\s*(.*)/i;

  paragraphs.forEach(text => {
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
          isCorrect: false
        });
      } else if (currentQ.options.length === 0) {
        // Nối dòng nếu câu hỏi dài nhiều dòng
        currentQ.question += '\n' + text;
      }
    }
  });

  if (currentQ) questions.push(currentQ);

  // Mặc định tạo đủ 4 phương án nếu thiếu
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

    // Header câu hỏi + Nút xóa
    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <b style="color:#1e40af;">Câu ${index + 1}:</b>
        <button onclick="window.deleteQuestion(${index})" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px;">🗑️ Xóa câu này</button>
      </div>
      <textarea onchange="window.updateQuestionText(${index}, this.value)" style="width:100%; min-height:60px; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-family:inherit; font-size:14px; margin-bottom:10px;">${q.question}</textarea>
      
      <div style="margin-bottom:10px;">
        <label style="font-size:13px; color:#475569; cursor:pointer;">
          <input type="checkbox" ${q.noShuffleOptions ? 'checked' : ''} onchange="window.toggleNoShuffle(${index}, this.checked)">
          📌 <b>Không tráo phương án câu này</b> (Dùng cho câu có dạng "Cả A và B đều đúng")
        </label>
      </div>
      
      <div class="options-group">
    `;

    // 4 Phương án A, B, C, D
    const labels = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, optIndex) => {
      const label = labels[optIndex] || `P.An ${optIndex + 1}`;
      html += `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <input type="radio" name="correct_${q.id}" ${opt.isCorrect ? 'checked' : ''} onchange="window.setCorrectOption(${index}, ${optIndex})" style="width:18px; height:18px; cursor:pointer;" title="Tích chọn làm đáp án đúng">
          <span style="font-weight:bold; width:20px;">${label}.</span>
          <input type="text" value="${opt.text.replace(/"/g, '&quot;')}" onchange="window.updateOptionText(${index}, ${optIndex}, this.value)" style="flex:1; padding:6px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px;">
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
  const apiKey = config.geminiApiKey;

  if (!apiKey) {
    alert('Vui lòng nhập Gemini API Key trong "Mục 1: Cấu hình hệ thống" trước khi dùng tính năng này!');
    return;
  }

  // Tìm các câu chưa được chọn đáp án đúng
  const unselectedQuestions = [];
  currentExamData.forEach((q, index) => {
    const hasCorrect = q.options.some(opt => opt.isCorrect);
    if (!hasCorrect) {
      unselectedQuestions.push({ index: index, question: q.question, options: q.options.map(o => o.text) });
    }
  });

  if (unselectedQuestions.length === 0) {
    alert('Tất cả các câu hỏi đã có đáp án được chọn!');
    return;
  }

  const btnAi = document.getElementById('btnAiSuggest');
  const originalText = btnAi.textContent;
  btnAi.disabled = true;
  btnAi.textContent = `🤖 AI đang giải ${unselectedQuestions.length} câu chưa có đáp án...`;

  try {
    const prompt = `Bạn là một chuyên gia giáo dục. Hãy đọc danh sách câu hỏi trắc nghiệm dưới đây và trả về kết quả dưới dạng JSON duy nhất là mảng các object. Mỗi object gồm { "index": số_thứ_tự_câu, "correctIndex": chỉ_số_đáp_án_đúng_từ_0_đến_3 }.\n\nDanh sách câu hỏi:\n${JSON.stringify(unselectedQuestions, null, 2)}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    const replyText = data.candidates[0].content.parts[0].text;
    
    // Parse JSON từ phản hồi của Gemini
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
    btnAi.disabled = false;
    btnAi.textContent = originalText;
  }
}

// 5. Lưu đề thi thành file JSON
function saveExamToFile() {
  if (currentExamData.length === 0) {
    alert('Chưa có dữ liệu câu hỏi để lưu!');
    return;
  }

  // Kiểm tra xem còn câu nào chưa chọn đáp án không
  const missingIndex = currentExamData.findIndex(q => !q.options.some(o => o.isCorrect));
  if (missingIndex !== -1) {
    alert(`⚠️ Câu ${missingIndex + 1} chưa được chọn đáp án đúng! Vui lòng chọn đáp án hoặc dùng AI gợi ý.`);
    return;
  }

  const examTitleInput = document.getElementById('examTitleInput');
  const examTitle = (examTitleInput && examTitleInput.value.trim()) || 'De_Thi_Trac_Nghiem';
  const examId = 'EXAM_' + Date.now();

  const payload = {
    examId: examId,
    examTitle: examTitle,
    createdAt: new Date().toISOString(),
    totalQuestions: currentExamData.length,
    questions: currentExamData
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${examTitle}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  alert('🎉 Lưu đề thi thành công! Đã tải file JSON về máy.');
}
