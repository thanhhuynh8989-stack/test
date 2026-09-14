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
    btnLogin.textContent = '⏳ Đang xác thực...';

    try {
      // 1. Kiểm tra nếu là Admin tổng (Tài khoản: admin / Mật khẩu: admin123)
      if (username === 'admin' && password === 'admin123') {
        sessionStorage.setItem('userSession', JSON.stringify({
          username: 'admin',
          fullName: 'Quản Trị Viên Tổng',
          role: 'admin'
        }));
        window.location.href = 'index.html';
        return;
      }

      // 2. Nếu không phải Admin -> Gọi Google Apps Script đối soát Giảng viên
      const res = await fetch(`${SCRIPT_URL}?_t=${Date.now()}`);
      const result = await res.json();

      if (result.status === 'success' && Array.isArray(result.data)) {
        const foundUser = result.data.find(u => u.username === username && u.password === password);
        
        if (foundUser) {
          sessionStorage.setItem('userSession', JSON.stringify({
            username: foundUser.username,
            fullName: foundUser.fullName || foundUser.username,
            role: 'lecturer'
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
