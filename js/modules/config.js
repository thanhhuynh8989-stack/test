const CONFIG_KEY = 'admin_exam_config';

export function getConfig() {
  const data = localStorage.getItem(CONFIG_KEY);
  return data ? JSON.parse(data) : {
    ghOwner: 'thanhhuynh8989-stack',
    ghRepo: 'test',
    ghBranch: 'main',
    ghToken: '',
    geminiKey: '',
    geminiModel: 'gemini-3.6-flash',
    webhookUrl: ''
  };
}

export function initConfigModule() {
  const form = document.getElementById('configForm');
  const select = document.getElementById('geminiSelect');
  const customInput = document.getElementById('geminiModelCustom');
  const config = getConfig();

  // Đổ dữ liệu đã lưu vào form
  if (config.ghOwner) document.getElementById('ghOwner').value = config.ghOwner;
  if (config.ghRepo) document.getElementById('ghRepo').value = config.ghRepo;
  if (config.ghBranch) document.getElementById('ghBranch').value = config.ghBranch || 'main';
  if (config.ghToken) document.getElementById('ghToken').value = config.ghToken;
  if (config.geminiKey) document.getElementById('geminiKey').value = config.geminiKey;
  if (config.webhookUrl) document.getElementById('webhookUrl').value = config.webhookUrl;

  // Khôi phục lựa chọn Model Gemini
  const savedModel = config.geminiModel || 'gemini-2.5-flash';
  const existingOptions = Array.from(select.options).map(opt => opt.value);

  if (existingOptions.includes(savedModel)) {
    select.value = savedModel;
    customInput.style.display = 'none';
  } else {
    select.value = 'custom';
    customInput.style.display = 'block';
    customInput.value = savedModel;
  }

  // Sự kiện khi thay đổi Dropdown Model
  select.addEventListener('change', () => {
    if (select.value === 'custom') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Lấy tên Model thực tế từ Dropdown hoặc Ô nhập thủ công
    let selectedModel = select.value;
    if (selectedModel === 'custom') {
      selectedModel = customInput.value.trim() || 'gemini-2.5-flash';
    }

    const newConfig = {
      ghOwner: document.getElementById('ghOwner').value.trim(),
      ghRepo: document.getElementById('ghRepo').value.trim(),
      ghBranch: document.getElementById('ghBranch').value.trim() || 'main',
      ghToken: document.getElementById('ghToken').value.trim(),
      geminiKey: document.getElementById('geminiKey').value.trim(),
      geminiModel: selectedModel,
      webhookUrl: document.getElementById('webhookUrl').value.trim()
    };

    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));

    const badge = document.querySelector('.status-badge');
    if (badge) {
      badge.textContent = 'Đã lưu cấu hình';
      badge.style.background = '#dcfce7';
      badge.style.color = '#166534';
    }
    alert('Lưu cấu hình thành công!');
  });
}
