import { SCRIPT_URL } from './modules/config.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorMsg = document.getElementById('errorMsg');
  const btnLogin = document.getElementById('btnLogin');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    btnLogin.disabled = true;
    btnLogin.textContent = '⏳ Đang kiểm tra đăng nhập...';

    try {
      // Đọc toàn bộ tài khoản từ Google Sheet (DS_GV)
      const res = await fetch(`${SCRIPT_URL}?_t=${Date.now()}`);
      const result = await res.json();

      if (result.status === 'success' && Array.isArray(result.data)) {
        // Tìm tài khoản khớp cả username và password
        const foundUser = result.data.find(
          u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
        );
        
        if (foundUser) {
          sessionStorage.setItem('userSession', JSON.stringify({
            username: foundUser.username,
            fullName: foundUser.fullName,
            role: foundUser.role // 'admin' hoặc 'lecturer' đọc từ Sheet
          }));
          window.location.href = 'index.html';
          return;
        }
      }

      throw new Error('Tài khoản hoặc mật khẩu không chính xác!');

    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.style.display = 'block';
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Đăng Nhập';
    }
  });
});
