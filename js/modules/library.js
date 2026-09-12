import { getConfig } from './config.js';

export async function loadExamLibrary() {
  const tbody = document.getElementById('libraryTableBody');
  const config = getConfig();

  if (!config.ghOwner || !config.ghRepo) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Vui lòng nhập GitHub Owner & Repo ở Mục 1!</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Đang kết nối GitHub API...</td></tr>`;

  try {
    const url = `https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/exams?ref=${config.ghBranch}`;
    const headers = config.ghToken ? { 'Authorization': `token ${config.ghToken}` } : {};

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

    tbody.innerHTML = jsonFiles.map(file => `
      <tr>
        <td><b>${file.name}</b></td>
        <td>${(file.size / 1024).toFixed(1)} KB</td>
        <td><span class="status-badge" style="background:#dcfce7;color:#166534">Sẵn sàng</span></td>
        <td>
          <a href="${file.html_url}" target="_blank" class="btn-link">Xem File JSON</a>
        </td>
      </tr>
    `).join('');

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
