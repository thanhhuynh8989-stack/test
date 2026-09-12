export function initLibraryModule() {
  const refreshBtn = document.getElementById('btnRefresh');
  refreshBtn.addEventListener('click', () => {
    console.log('Đang lấy lại danh sách từ GitHub API...');
  });
}
