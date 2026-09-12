document.addEventListener('DOMContentLoaded', async () => {
  const loadingMsg = document.getElementById('loadingMsg');
  const examContainer = document.getElementById('examContainer');
  const examTitleDisplay = document.getElementById('examTitleDisplay');
  const questionsList = document.getElementById('questionsList');

  // 1. Trích xuất ID đề thi từ URL (?id=_csth_1.json)
  const urlParams = new URLSearchParams(window.location.search);
  const examId = urlParams.get('id');

  if (!examId) {
    loadingMsg.innerHTML = '<b style="color: #dc2626;">Lỗi: Không tìm thấy ID đề thi trên đường dẫn URL!</b>';
    return;
  }

  try {
    // 2. Gọi file JSON đề thi từ thư mục exams/
    const response = await fetch(`exams/${examId}`);
    if (!response.ok) throw new Error(`Không thể tìm thấy file exams/${examId}`);

    const examData = await response.json();

    // 3. Hiển thị thông tin đề
    loadingMsg.style.display = 'none';
    examContainer.style.display = 'block';
    examTitleDisplay.textContent = examData.title || 'ĐỀ THI TRỰC TUYẾN';

    // 4. Render câu hỏi
    if (!examData.questions || examData.questions.length === 0) {
      questionsList.innerHTML = '<p class="empty-msg">Đề thi này hiện chưa có nội dung câu hỏi.</p>';
      return;
    }

    questionsList.innerHTML = examData.questions.map((q, idx) => `
      <div class="question-item">
        <div class="question-title">Câu ${idx + 1}: ${q.question || q.title}</div>
        ${(q.options || []).map((opt, optIdx) => `
          <label class="option-label">
            <input type="radio" name="q_${idx}" value="${optIdx}"> ${opt}
          </label>
        `).join('')}
      </div>
    `).join('');

  } catch (err) {
    loadingMsg.innerHTML = `<b style="color: #dc2626;">Lỗi tải đề thi: ${err.message}</b>`;
  }
});
