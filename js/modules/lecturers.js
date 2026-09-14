import { SCRIPT_URL } from './config.js';

export async function loadLecturers() {
  const tbody = document.getElementById('lecturerTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">⏳ Đang tải danh sách Giảng viên...</td></tr>`;

  try {
    const res = await fetch(`${SCRIPT_URL}?_t=${Date.now()}`);
    const result = await res.json();

    if (result.status !== 'success' || !Array.isArray(result.data) || result.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Chưa có tài khoản Giảng viên nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = result.data.map(u => `
      <tr>
        <td><b>${u.username}</b></td>
        <td>${u.fullName || '--'}</td>
        <td><code>••••••••</code></td>
        <td>
          <button data-username="${u.username}" class="btn btn-delete-user" style="padding: 4px 8px; font-size: 12px; background: #ef4444; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🗑️ Xóa</button>
        </td>
      </tr>
    `).join('');

    // Sự kiện xóa user
    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const username = e.currentTarget.getAttribute('data-username');
        if (confirm(`Xóa tài khoản giảng viên "${username}"?`)) {
          await deleteLecturer(username);
        }
      });
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="color: #dc2626">Lỗi: ${err.message}</td></tr>`;
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
          fullName
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
