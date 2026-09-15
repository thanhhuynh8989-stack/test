const CONFIG_KEY = 'admin_exam_config';
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbztz3LZEFhyViCf9NKXdHrnOEmZsDC6wBU6hB9k4M42voehDTaB7-ZsOIFvokeFMZYWZA/exec';

/**
 * Lấy thông tin người dùng đang đăng nhập từ Session
 */
export function getCurrentUser() {
  const session = sessionStorage.getItem('userSession');
  return session ? JSON.parse(session) : null;
}

/**
 * Đăng xuất khỏi hệ thống
 */
export function logout() {
  sessionStorage.removeItem('userSession');
  window.location.href = 'login.html';
}

/**
 * Lấy cấu hình hệ thống từ localStorage
 */
export function getConfig() {
  const data = localStorage.getItem(CONFIG_KEY);
  return data ? JSON.parse(data) : {
    ghOwner: 'thanhhuynh8989-stack',
    ghRepo: 'test',
    ghBranch: 'main',
    ghToken: '',
    geminiKey: '',
    geminiModel: 'gemini-1.5-flash',
    webhookUrl: ''
  };
}

/**
 * Lưu cấu hình hệ thống vào localStorage
 */
export function saveConfig(configData) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configData));
}

/**
 * Khởi tạo Form Cấu hình (Dành cho Admin)
 */
export function initConfigModule() {
  const form = document.getElementById('configForm');
  const select = document.getElementById('geminiSelect');
  const customInput = document.getElementById('geminiModelCustom');

  if (!form) return;

  const config = getConfig();

  // Đổ dữ liệu đã lưu vào các trường tương ứng trên Form
  const fields = ['ghOwner', 'ghRepo', 'ghBranch', 'ghToken', 'geminiKey', 'webhookUrl'];
  fields.forEach(field => {
    const el = document.getElementById(field);
    if (el) el.value = config[field] || (field === 'ghBranch' ? 'main' : '');
  });

  // Khôi phục lựa chọn Model Gemini trên giao diện
  if (select && customInput) {
    const savedModel = config.geminiModel || 'gemini-1.5-flash';
    const existingOptions = Array.from(select.options).map(opt => opt.value);

    if (existingOptions.includes(savedModel)) {
      select.value = savedModel;
      customInput.style.display = 'none';
    } else {
      select.value = 'custom';
      customInput.style.display = 'block';
      customInput.value = savedModel;
    }

    // Sự kiện ẩn/hiện ô nhập thủ công khi thay đổi Dropdown
    select.addEventListener('change', () => {
      if (select.value === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
      }
    });
  }

  // Sự kiện Lưu cấu hình
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Lấy tên Model thực tế từ Dropdown hoặc ô nhập tùy chỉnh
    let selectedModel = config.geminiModel || 'gemini-1.5-flash';
    if (select && customInput) {
      selectedModel = select.value;
      if (selectedModel === 'custom') {
        selectedModel = customInput.value.trim() || 'gemini-1.5-flash';
      }
    }

    const newConfig = {
      ghOwner: document.getElementById('ghOwner')?.value.trim() ?? config.ghOwner,
      ghRepo: document.getElementById('ghRepo')?.value.trim() ?? config.ghRepo,
      ghBranch: document.getElementById('ghBranch')?.value.trim() || 'main',
      ghToken: document.getElementById('ghToken')?.value.trim() ?? config.ghToken,
      geminiKey: document.getElementById('geminiKey')?.value.trim() ?? config.geminiKey,
      geminiModel: selectedModel,
      webhookUrl: document.getElementById('webhookUrl')?.value.trim() ?? config.webhookUrl
    };

    saveConfig(newConfig);

    const badge = document.querySelector('.status-badge');
    if (badge) {
      badge.textContent = 'Đã lưu cấu hình';
      badge.style.background = '#dcfce7';
      badge.style.color = '#166534';
    }

    alert('Lưu cấu hình thành công!');
  });
}
