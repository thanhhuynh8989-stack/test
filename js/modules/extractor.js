export function initExtractorModule() {
  const form = document.getElementById('extractForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('Bắt đầu trích xuất bằng AI...');
  });
}
