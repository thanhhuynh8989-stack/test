import { getConfig } from './modules/config.js';

let examData = null;
let timerInterval = null;
let timeLeft = 0;
let studentInfo = {};

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const examId = urlParams.get('id');

  if (!examId) {
    document.body.innerHTML = `
      <div style="max-width: 500px; margin: 80px auto; padding: 24px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; color: #991b1b; text-align: center;">
        <h3>⚠️ Lỗi đường dẫn</h3>
        <p>Không tìm thấy ID đề thi trên URL! Vui lòng chọn bài thi từ thư viện.</p>
      </div>`;
    return;
  }

  // 1. Tải trước dữ liệu bài thi (không hiển thị ra màn hình)
  try {
    const res = await fetch(`exams/${examId}.json`);
    if (!res.ok) throw new Error('Không thể tải dữ liệu đề thi từ hệ thống!');
    examData = await res.json();
  } catch (err) {
    alert(`Lỗi: ${err.message}`);
    return;
  }

  // 2. Lắng nghe sự kiện người dùng điền Form & Bấm "Bắt Đầu Làm Bài"
  document.getElementById('studentForm').addEventListener('submit', (e) => {
    e.preventDefault();

    studentInfo = {
      name: document.getElementById('svName').value.trim(),
      id: document.getElementById('svId').value.trim(),
      class: document.getElementById('svClass').value.trim()
    };

    // Cập nhật giao diện thông tin Sinh viên & Đề thi
    document.getElementById('displayName').textContent = studentInfo.name;
    document.getElementById('displayId').textContent = studentInfo.id;
    document.getElementById('displayClass').textContent = studentInfo.class;
    document.getElementById('examTitleText').textContent = examData.title;

    // Ẩn Form đăng nhập -> Hiện Khung Bài Thi
    document.getElementById('studentModal').style.display = 'none';
    document.getElementById('examContainer').style.display = 'block';

    // Khởi tạo thời gian, Render câu hỏi và bắt đầu đếm ngược
    timeLeft = (examData.duration || 15) * 60;
    renderQuestions();
    updateProgressTracker();
    startTimer();
  });

  // 3. Sự kiện Nộp bài
  document.getElementById('quizForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (confirm('Bạn có chắc chắn muốn nộp bài thi?')) {
      finishExam();
    }
  });
});

// Hiển thị danh sách câu hỏi
function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  container.innerHTML = '';

  examData.questions.forEach((q, index) => {
    const qCard = document.createElement('div');
    qCard.style.cssText = 'background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 16px;';

    let optionsHTML = q.options.map((opt, i) => `
      <label style="display: block; margin: 10px 0; cursor: pointer; font-size: 15px; line-height: 1.4;">
        <input type="radio" name="q_${index}" value="${i}" style="margin-right: 8px;">
        <strong>${String.fromCharCode(65 + i)}.</strong> ${opt}
      </label>
    `).join('');

    qCard.innerHTML = `
      <div style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: #1e293b;">
        Câu ${index + 1}: ${q.question}
      </div>
      <div>${optionsHTML}</div>
    `;
    container.appendChild(qCard);
  });

  // Lắng nghe thao tác chọn đáp án để cập nhật số câu đã làm ngay lập tức
  container.addEventListener('change', updateProgressTracker);
}

// Cập nhật thanh tiến độ "Số câu đã làm / Tổng số câu"
function updateProgressTracker() {
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

// Chạy thời gian đếm ngược
function startTimer() {
  const timerDisplay = document.getElementById('timerDisplay');

  function updateTimerUI() {
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

// Xử lý nộp bài
async function finishExam() {
  clearInterval(timerInterval);

  let correctCount = 0;
  const totalQuestions = examData.questions.length;

  examData.questions.forEach((q, index) => {
    const selected = document.querySelector(`input[name="q_${index}"]:checked`);
    if (selected && parseInt(selected.value) === q.answer) {
      correctCount++;
    }
  });

  const score = ((correctCount / totalQuestions) * 10).toFixed(2);
  const config = getConfig();

  // Gửi điểm lên Webhook nếu có cấu hình
  if (config.webhookUrl) {
    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentInfo.name,
          studentId: studentInfo.id,
          studentClass: studentInfo.class,
          examTitle: examData.title,
          score: score,
          correctCount: `${correctCount}/${totalQuestions}`,
          submittedAt: new Date().toLocaleString('vi-VN')
        })
      });
    } catch (err) {
      console.error('Lỗi gửi Webhook:', err);
    }
  }

  // Báo kết quả thi
  document.getElementById('examContainer').innerHTML = `
    <div style="background: #fff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; max-width: 500px; margin: 40px auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
      <h2 style="color: #059669; margin-top: 0;">🎉 Hoàn Thành Bài Thi!</h2>
      <p style="font-size: 16px; color: #334155;">Thí sinh: <strong>${studentInfo.name}</strong> (${studentInfo.id})</p>
      <div style="font-size: 38px; font-weight: bold; color: #2563eb; margin: 20px 0;">
        ${score} <span style="font-size: 18px; color: #64748b;">/ 10 điểm</span>
      </div>
      <p style="font-size: 15px; color: #475569;">Số câu trả lời đúng: <strong>${correctCount} / ${totalQuestions}</strong> câu</p>
    </div>
  `;
}
