import { getConfig } from './config.js';
import { loadExamLibrary } from './library.js';

export function initExtractorModule() {
  const form = document.getElementById('extractForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const config = getConfig();

    const title = document.getElementById('examTitle').value.trim();
    const duration = document.getElementById('examDuration').value;
    const maxViolations = document.getElementById('maxViolations').value;

    if (!title) return alert('Vui lòng nhập tên bộ đề thi!');
    if (!config.ghToken) return alert('Vui lòng nhập GitHub Personal Access Token ở Mục 1 để cấp quyền lưu file!');

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Đang xử lý & Đẩy lên GitHub...';

    try {
      // Đóng gói cấu trúc đề thi
      const examData = {
        title,
        duration: parseInt(duration),
        maxViolations: parseInt(maxViolations),
        createdAt: new Date().toISOString(),
        questions: [] // Nơi lưu danh sách câu hỏi sau khi trích xuất
      };

      // Tạo tên file an toàn (vd: de_kiem_tra_sinh_hoc.json)
      const cleanFileName = title
        .toLowerCase()
        .replace(/đ/g, "d")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/^_+|_+$/g, ""); // Xóa bỏ gạch dưới ở đầu tên file
      const path = `exams/${cleanFileName}.json`;
      const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(examData, null, 2))));

      const ghUrl = `https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/${path}`;

      // Kiểm tra file tồn tại để lấy SHA (nếu là ghi đè)
      let sha = null;
      const checkRes = await fetch(ghUrl, {
        headers: { 'Authorization': `token ${config.ghToken}` }
      });
      if (checkRes.ok) {
        const existingFile = await checkRes.json();
        sha = existingFile.sha;
      }

      // Gọi GitHub API để tạo/cập nhật file
      const putRes = await fetch(ghUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${config.ghToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Thêm/cập nhật đề thi: ${title}`,
          content: contentBase64,
          branch: config.ghBranch,
          ...(sha ? { sha } : {})
        })
      });

      if (!putRes.ok) throw new Error('Lỗi khi đẩy file lên GitHub API');

      alert('Đã lưu đề thi mới vào thư mục /exams thành công!');
      loadExamLibrary(); // Cập nhật lại bảng thư viện
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  });
}
