export function initConfigModule() {
  const form = document.getElementById('configForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('Lưu cấu hình GitHub & Gemini API...');
  });
}
