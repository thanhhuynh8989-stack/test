import { getCurrentUser, logout, initConfigModule } from './modules/config.js';
import { initLecturerModule } from './modules/lecturers.js';
import { initExtractorModule } from './modules/extractor.js';
import { initLibraryModule } from './modules/library.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Kiểm tra session đăng nhập
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Hiển thị thông tin user đăng nhập trên Header
  const userDisplay = document.getElementById('currentUserDisplay');
  if (userDisplay) {
    userDisplay.innerHTML = `👋 Xin chào, <b>${currentUser.fullName}</b> (${currentUser.role === 'admin' ? 'Quản Trị Viên' : 'Giảng Viên'}) | <button id="btnLogout" style="background:none; border:none; color:#dc2626; cursor:pointer; font-weight:600; text-decoration:underline;">Đăng xuất</button>`;
    
    document.getElementById('btnLogout').addEventListener('click', logout);
  }

  // 3. Phân quyền giao diện UI
  const sectionConfig = document.getElementById('sectionConfig');   // Mục 1: Cấu hình hệ thống
  const sectionLecturers = document.getElementById('sectionLecturers'); // Mục 2: Quản lý Giảng viên

  if (currentUser.role === 'lecturer') {
    // Ẩn các mục quản trị đối với Giảng viên
    if (sectionConfig) sectionConfig.style.display = 'none';
    if (sectionLecturers) sectionLecturers.style.display = 'none';
  } else if (currentUser.role === 'admin') {
    // Khởi tạo tính năng quản lý Giảng viên cho Admin
    initLecturerModule();
  }

  // 4. Khởi tạo các module dùng chung
  initConfigModule();
  initExtractorModule();
  initLibraryModule();
});
