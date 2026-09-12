import { getConfig } from './config.js';

export async function loadExamLibrary() {
  const tbody = document.getElementById('libraryTableBody');
  if (!tbody) return;

  const config = getConfig();

  if (!config.ghOwner || !config.ghRepo) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Vui lòng nhập GitHub Owner & Repo ở Mục 1!</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">⏳ Đang kết nối GitHub API và đọc dữ liệu đề thi...</td></tr>`;

  try {
    const branch = config.ghBranch || 'main';
    const url = `https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/exams?ref=${branch}`;
    
    const headers = {};
    if (config.ghToken && config.ghToken !== '••••••••••••••••') {
      headers['Authorization'] = `token ${config.ghToken}`;
    }

    const res = await fetch(url, { headers });

    if (res.status === 404) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Chưa có thư mục <b>exams/</b> trên GitHub. Hãy trích xuất đề đầu tiên!</td></tr>`;
      return;
    }

    if (!res.ok) throw new Error(`Mã lỗi ${res.status}: Kiểm tra lại Token hoặc tên Kho chứa`);

    const files = await res.json();
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Chưa có đề thi (.json) trong thư mục <b>exams/</b>.</td></tr>`;
      return;
    }

    // Đọc song song nội dung của từng file JSON để lấy Tên bài thi (title)
    const examPromises = jsonFiles.map(async (file) => {
      try {
        const rawRes = await fetch(file.download_url);
        const examData = await rawRes.json();
        return {
          fileName: file.name,
          title: examData.title || file.name, // Lấy tên bài thi thật
          questionCount: examData.questions ? examData.questions.length : 0,
          duration: examData.duration || 15,
          size: (file.size / 1024).toFixed(1) + ' KB',
          htmlUrl: file.html_url,
          examId: file.name.replace(/\.json$/i, '')
        };
      } catch (err) {
        return {
          fileName: file.name,
          title: file.name,
          questionCount: 0,
          duration: '--',
          size: (file.size / 1024).toFixed(1) + ' KB',
          htmlUrl: file.html_url,
          examId: file.name.replace(/\.json$/i, '')
        };
      }
    });

    const examList = await Promise.all(examPromises);

    // Xác định đường dẫn gốc tới file exam.html
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

    tbody.innerHTML = examList.map(exam => {
      const examUrl = `${baseUrl}exam.html?id=${exam.examId}`;
      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 15px; margin-bottom: 2px;">
              ${escapeHTML(exam.title)}
            </div>
            <div style="font-size: 12px; color: #64748b;">
              📄 File: <code>${exam.fileName}</code> | 📝 ${exam.questionCount} câu | ⏱️ ${exam.duration} phút
            </div>
          </td>
          <td>${exam.size}</td>
          <td><span class="status-badge" style="background:#dcfce7;color:#166534">Sẵn sàng</span></td>
          <td>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <a href="${examUrl}" target="_blank" class="btn btn-primary" style="padding: 5px 10px; font-size: 12px; text-decoration: none;">🚀 Mở Làm Bài</a>
              <button data-url="${examUrl}" class="btn btn-secondary btn-copy-link" style="padding: 5px 10px; font-size: 12px; cursor: pointer;">📋 Copy Link</button>
              <a href="${exam.htmlUrl}" target="_blank" class="btn-link" style="color: #64748b; font-size: 12px;">JSON</a>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Gán sự kiện sao chép link bằng Event Listener (tránh lỗi inline onclick trong Module)
    tbody.querySelectorAll('.btn-copy-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        navigator.clipboard.writeText(url);
        alert('Đã chép link làm bài!');
      });
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="color: #dc2626">${err.message}</td></tr>`;
  }
}

export function initLibraryModule() {
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadExamLibrary);
  }
  loadExamLibrary();
}

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
