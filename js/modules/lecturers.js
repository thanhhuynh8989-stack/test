import { SCRIPT_URL } from './config.js';

export async function loadLecturers() {
  const tbody = document.getElementById('lecturerTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="padding:15px; text-align:center;">⏳ Đang tải danh sách...</td></tr>`;

  try {
    const res = await fetch(`${SCRIPT_URL}?_t=${Date.now()}`);
    const result = await res.json();

    if (result.status !== 'success' || !Array.isArray(result.data) || result.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="padding:15px; text-align:center;">Chưa có tài khoản nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = result.data.map(u => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px;"><b>${u.username}</b></td>
        <td style="padding: 10px;">${u.fullName || '--'}</td>
        <td style="padding: 10px;">
          <span style="padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${u.role === 'admin' ? '#fee2e2' : '#e0f2fe'}; color: ${u.role === 'admin' ? '#991b1b' : '#075985'};">
            ${u.role === 'admin' ? 'Quản Trị Viên' : 'Giảng Viên'}
          </span>
        </td>
        <td style="padding: 10px;">
          ${u.role === 'admin' 
            ? `<span style="font-size: 12px; color: #94a3b8;">Hệ thống</span>` 
            : `<button data-username="${u.username}" class="btn-delete-user" style="padding: 4px 10px; font-size: 12px; background: #ef4444; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🗑️ Xóa</button>`
          }
        </td>
      </tr>
    `).join('');

    // Xử lý sự kiện nút xóa tài khoản Giảng viên
    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const username = e.currentTarget.getAttribute('data-username');
        if (confirm(`Xóa tài khoản giảng viên "${username}"?`)) {
          await deleteLecturer(username);
        }
      });
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="color: #dc2626; padding:15px; text-align:center;">Lỗi: ${err.message}</td></tr>`;
  }
}

async function deleteLecturer(username) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', username: username })
    });
    const result = await res.json();
    if (result.status === 'success') {
      alert(`✅ Đã xóa giảng viên ${username}`);
      loadLecturers();
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    alert(`❌ Lỗi xóa giảng viên: ${err.message}`);
  }
}

export function initLecturerModule() {
  const form = document.getElementById('addLecturerForm');
  if (!form) return;

  loadLecturers();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('gvUsername').value.trim();
    const password = document.getElementById('gvPassword').value.trim();
    const fullName = document.getElementById('gvFullName').value.trim();

    try {
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          username,
          password,
          fullName,
          role: 'lecturer'
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
        alert(`✅ Đã thêm giảng viên thành công!`);
        form.reset();
        loadLecturers();
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      alert(`❌ Lỗi thêm giảng viên: ${err.message}`);
    }
  });
}
