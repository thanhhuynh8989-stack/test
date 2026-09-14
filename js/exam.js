import { getConfig } from './modules/config.js';

let examData = null;
let timerInterval = null;
let timeLeft = 0;
let studentInfo = {};
let violations = 0;
let isExamSubmitted = false;
let cleanExamId = '';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const rawExamId = urlParams.get('id');

  if (!rawExamId) {
    document.body.innerHTML = `
      <div style="max-width: 500px; margin: 80px auto; padding: 24px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; color: #991b1b; text-align: center;">
        <h3>⚠️ Lỗi đường dẫn</h3>
        <p>Không tìm thấy ID đề thi trên URL! Vui lòng chọn bài thi từ thư viện.</p>
      </div>`;
    return;
  }

  // Loại bỏ đuôi .json nếu URL truyền dư
  cleanExamId = rawExamId.replace(/\.json$/i, '');

  try {
    const res = await fetch(`exams/${cleanExamId}.json`);
    if (!res.ok) throw new Error(`Không tìm thấy file đề thi "exams/${cleanExamId}.json" trên hệ thống.`);
    const rawData = await res.json();
    
    // 💥 Xử lý tráo câu hỏi và tráo phương án ngay khi tải đề thi
    examData = prepareExamForStudent(rawData);
  } catch (err) {
    alert(`Lỗi: ${err.message}`);
    return;
  }

  // Lắng nghe sự kiện Bắt đầu làm bài
  const studentForm = document.getElementById('studentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', (e) => {
      e.preventDefault();

      studentInfo = {
        name: document.getElementById('svName').value.trim(),
        id: document.getElementById('svId').value.trim(),
        class: document.getElementById('svClass').value.trim()
      };

      const elName = document.getElementById('displayName');
      const elId = document.getElementById('displayId');
      const elClass = document.getElementById('displayClass');
      const elTitle = document.getElementById('examTitleText');

      if (elName) elName.textContent = studentInfo.name;
      if (elId) elId.textContent = studentInfo.id;
      if (elClass) elClass.textContent = studentInfo.class;
      if (elTitle) elTitle.textContent = examData.examTitle || examData.title || 'Bài Kiểm Tra';

      document.getElementById('studentModal').style.display = 'none';
      document.getElementById('examContainer').style.display = 'block';

      timeLeft = (examData.duration || 15) * 60;

      renderQuestions();
      updateProgressTracker();
      updateViolationTracker();
      startTimer();
      setupAntiCheat();
    });
  }

  // Lắng nghe sự kiện Nộp bài
  const quizForm = document.getElementById('quizForm');
  if (quizForm) {
    quizForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (confirm('Bạn có chắc chắn muốn nộp bài thi?')) {
        finishExam();
      }
    });
  }
});

// 💥 Thuật toán Fisher-Yates Shuffle dùng để tráo ngẫu nhiên
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 💥 Chuẩn bị dữ liệu đề thi: Tráo câu hỏi & Tráo phương án
function prepareExamForStudent(data) {
  if (!data || !Array.isArray(data.questions)) return data;

  // 1. Tráo thứ tự câu hỏi
  const shuffledQuestions = shuffleArray(data.questions);

  // 2. Tráo thứ tự các phương án trong từng câu (nếu noShuffleOptions !== true)
  const processedQuestions = shuffledQuestions.map(q => {
    let finalOptions = q.options || [];
    if (!q.noShuffleOptions && Array.isArray(finalOptions)) {
      finalOptions = shuffleArray(finalOptions);
    }
    return {
      ...q,
      options: finalOptions
    };
  });

  return {
    ...data,
    questions: processedQuestions
  };
}

// Render câu hỏi an toàn với Escape HTML
function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  if (!container) return;
  container.innerHTML = '';

  examData.questions.forEach((q, index) => {
    const qCard = document.createElement('div');
    qCard.style.cssText = 'background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 16px;';

    let optionsHTML = q.options.map((opt, i) => {
      // Hỗ trợ cả Object đáp án mới {id, text, isCorrect} và chuỗi đáp án cũ
      const optText = typeof opt === 'object' ? opt.text : opt;
      const optVal = typeof opt === 'object' && opt.id ? opt.id : i;

      return `
        <label style="display: block; margin: 10px 0; cursor: pointer; font-size: 15px; line-height: 1.4;">
          <input type="radio" name="q_${index}" value="${optVal}" style="margin-right: 8px;">
          <strong>${String.fromCharCode(65 + i)}.</strong> ${escapeHTML(optText)}
        </label>
      `;
    }).join('');

    qCard.innerHTML = `
      <div style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: #1e293b;">
        Câu ${index + 1}: ${escapeHTML(q.question)}
      </div>
      <div>${optionsHTML}</div>
    `;
    container.appendChild(qCard);
  });

  container.addEventListener('change', updateProgressTracker);
}

// Tiến độ làm bài
function updateProgressTracker() {
  if (!examData || !examData.questions) return;
  const totalQuestions = examData.questions.length;
  let answeredCount = 0;

  for (let i = 0; i < totalQuestions; i++) {
    const selected = document.querySelector(`input[name="q_${i}"]:checked`);
    if (selected) answeredCount++;
  }

  const trackerEl = document.getElementById('progressTracker');
  if (trackerEl) {
    trackerEl.textContent = `Số câu đã làm: ${answeredCount}/${totalQuestions}`;
  }
}

// Cập nhật số lần vi phạm
function updateViolationTracker() {
  const maxViolations = examData?.maxViolations || 3;
  const trackerEl = document.getElementById('violationTracker');
  if (trackerEl) {
    trackerEl.textContent = `Vi phạm: ${violations}/${maxViolations}`;
  }
}

// Giám sát chuyển tab / rời màn hình
function setupAntiCheat() {
  const maxViolations = examData?.maxViolations || 3;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !isExamSubmitted) {
      violations++;
      updateViolationTracker();

      if (violations >= maxViolations) {
        alert(`🚨 CẢNH BÁO VI PHẠM: Bạn đã rời khỏi màn hình làm bài ${violations}/${maxViolations} lần. Hệ thống tự động nộp bài!`);
        finishExam();
      } else {
        alert(`⚠️ CẢNH BÁO VI PHẠM (${violations}/${maxViolations}): Nghiêm cấm chuyển tab hoặc rời khỏi trang kiểm tra trong khi làm bài!`);
      }
    }
  });
}

// Đếm ngược thời gian
function startTimer() {
  const timerDisplay = document.getElementById('timerDisplay');

  function updateTimerUI() {
    if (!timerDisplay) return;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  updateTimerUI();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert('Đã hết thời gian làm bài! Hệ thống tự động nộp bài.');
      finishExam();
    }
  }, 1000);
}

// Xử lý nộp bài & Chấm điểm theo Thẻ isCorrect
async function finishExam() {
  if (isExamSubmitted) return;
  isExamSubmitted = true;
  clearInterval(timerInterval);

  let correctCount = 0;
  let answeredCount = 0;
  const totalQuestions = examData.questions.length;
  const studentAnswers = []; // Mảng chứa 50+ câu trả lời chi tiết của thí sinh

  examData.questions.forEach((q, index) => {
    const selected = document.querySelector(`input[name="q_${index}"]:checked`);
    if (selected) {
      answeredCount++;
      const selectedVal = selected.value;
      let selectedOpt = null;

      // Tìm option được chọn
      if (typeof q.options[0] === 'object') {
        selectedOpt = q.options.find(o => String(o.id) === String(selectedVal));
      } else {
        selectedOpt = q.options[parseInt(selectedVal)];
      }

      if (selectedOpt) {
        const optText = typeof selectedOpt === 'object' ? selectedOpt.text : selectedOpt;
        studentAnswers.push(optText); // Lưu nội dung đáp án thí sinh chọn

        // 💥 KIỂM TRA ĐÁP ÁN ĐÚNG THEO THẺ isCorrect (HOẶC CHỈ SỐ CŨ)
        if (typeof selectedOpt === 'object') {
          if (selectedOpt.isCorrect === true) {
            correctCount++;
          }
        } else {
          if (parseInt(selectedVal) === q.answer) {
            correctCount++;
          }
        }
      } else {
        studentAnswers.push('Bỏ trống');
      }
    } else {
      studentAnswers.push('Bỏ trống');
    }
  });

  const score = ((correctCount / totalQuestions) * 10).toFixed(2);
  const config = getConfig();
  const targetWebhook = examData.webhookUrl || config.webhookUrl;

  const maxViolations = examData?.maxViolations || 3;
  let submitStatus = "Tự nộp";
  if (violations >= maxViolations) {
    submitStatus = "Bị hủy do vi phạm";
  } else if (timeLeft <= 0) {
    submitStatus = "Nộp do hết thời gian";
  }

  const payload = {
    examId: cleanExamId,
    examTitle: examData.examTitle || examData.title || '',
    studentId: studentInfo.id || '',
    fullName: studentInfo.name || '',
    email: studentInfo.class || '',
    answeredCount: answeredCount,
    totalQuestions: totalQuestions,
    score: parseFloat(score),
    violations: violations,
    status: submitStatus,
    studentAnswers: studentAnswers // 💥 Gửi mảng nội dung các câu đã chọn về Webhook
  };

  if (targetWebhook && targetWebhook.startsWith('http')) {
    try {
      await fetch(targetWebhook, {
        method: 'POST',
        mode: 'no-cors', // Bắt buộc: Bỏ qua CORS
        headers: { 
          'Content-Type': 'text/plain' // Bắt buộc: Tránh preflight OPTIONS request
        },
        body: JSON.stringify(payload)
      });
      console.log('Đã gửi dữ liệu bài thi tới Webhook thành công!');
    } catch (err) {
      console.error('Lỗi gửi Webhook:', err);
    }
  }

  const examContainer = document.getElementById('examContainer');
  if (examContainer) {
    examContainer.innerHTML = `
      <div style="background: #fff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; max-width: 500px; margin: 40px auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
        <h2 style="color: #059669; margin-top: 0;">🎉 Hoàn Thành Bài Thi!</h2>
        <p style="font-size: 16px; color: #334155;">Thí sinh: <strong>${escapeHTML(studentInfo.name)}</strong> (${escapeHTML(studentInfo.id)})</p>
        <div style="font-size: 38px; font-weight: bold; color: #2563eb; margin: 20px 0;">
          ${score} <span style="font-size: 18px; color: #64748b;">/ 10 điểm</span>
        </div>
        <p style="font-size: 15px; color: #475569; margin-bottom: 8px;">Số câu trả lời đúng: <strong>${correctCount} / ${totalQuestions}</strong> câu</p>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">Số lần vi phạm: <strong>${violations}</strong> | Trạng thái: <strong>${submitStatus}</strong></p>
        <button onclick="window.close()" class="btn btn-primary" style="padding: 10px 20px; font-size: 14px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Đóng Màn Hình</button>
      </div>
    `;
  }
}

// Mã hóa ký tự đặc biệt phòng chống XSS
function escapeHTML(str) {
  return String(str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
