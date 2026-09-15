import { getCurrentUser, logout, initConfigModule } from './modules/config.js';
import { initLecturerModule } from './modules/lecturers.js';
import { initExtractorModule } from './modules/extractor.js';
import { initLibraryModule } from './modules/library.js';

document.addEventListener('DOMContentLoaded', () => {
  // 0. Bỏ qua kiểm tra nếu đang đứng ở trang Đăng nhập (Tránh lặp chuyển hướng)
  const currentPath = window.location.pathname.toLowerCase();
  if (currentPath.endsWith('login.html') || currentPath.endsWith('/login')) {
    return;
  }

  // 1. Kiểm tra session đăng nhập
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Hiển thị thông tin user đăng nhập trên Header
  const userDisplay = document.getElementById('currentUserDisplay');
  if (userDisplay) {
    userDisplay.innerHTML = `👋 Xin chào, <b>${currentUser.fullName || 'Người dùng'}</b> (${currentUser.role === 'admin' ? 'Quản Trị Viên' : 'Giảng Viên'}) | <button id="btnLogout" style="background:none; border:none; color:#dc2626; cursor:pointer; font-weight:600; text-decoration:underline;">Đăng xuất</button>`;
    
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', logout);
    }
  }

  // 3. Phân quyền giao diện UI
  const sectionConfig = document.getElementById('sectionConfig');   // Mục 1: Cấu hình hệ thống
  const sectionLecturers = document.getElementById('sectionLecturers'); // Mục 2: Quản lý Giảng viên

  if (currentUser.role === 'lecturer') {
    // Ẩn các mục quản trị đối với Giảng viên
    if (sectionConfig) sectionConfig.style.display = 'none';
    if (sectionLecturers) sectionLecturers.style.display = 'none';
  }

  // 4. Khởi tạo độc lập từng Module bằng bẫy lỗi (Lỗi module này không làm sập module khác)
  
  // Khởi tạo Module Cấu hình (Ưu tiên chạy trước)
  safeInitModule('Cấu hình', initConfigModule);

  // Khởi tạo Module Giảng viên (Nếu là Admin)
  if (currentUser.role === 'admin') {
    safeInitModule('Giảng viên', initLecturerModule);
  }

  // Khởi tạo các Module trích xuất và thư viện
  safeInitModule('Trích xuất đề', initExtractorModule);
  safeInitModule('Thư viện đề', initLibraryModule);
});

/**
 * Hàm khởi tạo Module an toàn (Bọc try-catch)
 */
function safeInitModule(moduleName, initFunction) {
  try {
    if (typeof initFunction === 'function') {
      initFunction();
    }
  } catch (error) {
    console.error(`❌ Lỗi khởi tạo Module [${moduleName}]:`, error);
  }
}
