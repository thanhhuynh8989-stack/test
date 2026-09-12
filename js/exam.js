import { getConfig } from './modules/config.js';

let examData = null;
let timerInterval = null;
let timeLeft = 0;
let studentInfo = {};
let violations = 0;

// 1. Khởi tạo & Đọc ID từ URL
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

  try {
    const res = await fetch(`exams/${examId}.json`);
    if (!res.ok) throw new Error('Không thể tải dữ liệu đề thi từ thư viện GitHub.');
    examData = await res.json();

    document.getElementById('examTitleText').textContent = examData.title;
    timeLeft = (examData.duration || 15) * 60;
  } catch (err) {
    alert(`Lỗi: ${err.message}`);
    return;
  }

  // Bắt sự kiện form nhập thông tin Sinh viên
  document.getElementById('studentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    studentInfo = {
      name: document.getElementById('svName').value.trim(),
      id: document.getElementById('svId').value.trim(),
      class: document.getElementById('svClass').value.trim()
    };

    document.getElementById('displayName').textContent = studentInfo.name;
    document.getElementById('displayId').textContent = studentInfo.id;
    document.getElementById('displayClass').textContent = studentInfo.class;

    document.getElementById('studentModal').style.display = 'none';
    document.getElementById('studentInfoDisplay').style.display = 'block';
    document.getElementById('btnSubmit').style.display = 'block';

    renderQuestions();
    startTimer();
  });

  // Bắt sự kiện nộp bài (Ngăn chặn việc reload trang gây mất ID)
  document.getElementById('quizForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (confirm('Bạn có chắc chắn muốn nộp bài thi?')) {
      finishExam();
    }
  });
});

// 2. Hiển thị danh sách câu hỏi
function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  container.innerHTML = '';

  examData.questions.forEach((q, index) => {
    const qCard = document.createElement('div');
    qCard.style.cssText = 'background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;';
    
    let optionsHTML = q.options.map((opt, i) => `
      <label style="display: block; margin: 8px 0; cursor: pointer; font-size: 15px;">
        <input type="radio" name="q_${index}" value="${i}"> ${String.fromCharCode(65 + i)}. ${opt}
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
}

// 3. Đếm ngược thời gian
function startTimer() {
  const timerDisplay = document.getElementById('timerDisplay');
  timerInterval = setInterval(() => {
    timeLeft--;
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert('Đã hết thời gian làm bài! Hệ thống tự động nộp bài.');
      finishExam();
    }
  }, 1000);
}

// 4. Báo điểm & Nộp kết quả lên Webhook
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

  // Gửi điểm đến Webhook (Google Sheets/AppScript) nếu có cấu hình
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
      console.error('Không thể gửi kết quả về Webhook:', err);
    }
  }

  // Hiển thị kết quả làm bài
  document.querySelector('.container').innerHTML = `
    <div style="background: #fff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; max-width: 500px; margin: 40px auto;">
      <h2 style="color: #059669; margin-top: 0;">🎉 Hoàn Thành Bài Thi!</h2>
      <p style="font-size: 16px; color: #334155;">Thí sinh: <strong>${studentInfo.name}</strong> (${studentInfo.id})</p>
      <div style="font-size: 36px; font-weight: bold; color: #2563eb; margin: 20px 0;">
        ${score} <span style="font-size: 18px; color: #64748b;">/ 10 điểm</span>
      </div>
      <p>Số câu trả lời đúng: <strong>${correctCount} / ${totalQuestions}</strong> câu</p>
    </div>
  `;
}
