import { getConfig, getCurrentUser, SCRIPT_URL } from './config.js';

export async function loadExamLibrary() {
  const tbody = document.getElementById('libraryTableBody');
  if (!tbody) return;

  const config = getConfig();
  const currentUser = getCurrentUser();

  if (!config.ghOwner || !config.ghRepo) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Vui lòng nhập GitHub Owner & Repo ở Mục 1!</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">⏳ Đang kết nối và đọc dữ liệu đề thi...</td></tr>`;

  try {
    const branch = config.ghBranch || 'main';
    const url = `https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/exams?ref=${branch}&_t=${Date.now()}`;
    
    const headers = {};
    if (config.ghToken && config.ghToken !== '••••••••••••••••') {
      headers['Authorization'] = `token ${config.ghToken}`;
    }

    const res = await fetch(url, { headers, cache: 'no-store' });

    if (res.status === 404) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Chưa có thư mục <b>exams/</b> trên GitHub. Hãy trích xuất đề đầu tiên!</td></tr>`;
      return;
    }

    if (!res.ok) throw new Error(`Mã lỗi ${res.status}: Kiểm tra lại Token hoặc tên Kho chứa`);

    const files = await res.json();
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    if (jsonFiles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Chưa có đề thi (.json) trong thư mục <b>exams/</b>.</td></tr>`;
      return;
    }

    const examPromises = jsonFiles.map(async (file) => {
      try {
        const rawRes = await fetch(`${file.download_url}?_t=${Date.now()}`, { cache: 'no-store' });
        const examData = await rawRes.json();
        return {
          fileName: file.name,
          sha: file.sha,
          title: examData.title || file.name,
          createdBy: examData.createdBy || 'Unknown',
          questionCount: examData.questions ? examData.questions.length : 0,
          duration: examData.duration || 15,
          size: (file.size / 1024).toFixed(1) + ' KB',
          htmlUrl: file.html_url,
          examId: file.name.replace(/\.json$/i, '')
        };
      } catch (err) {
        return {
          fileName: file.name,
          sha: file.sha,
          title: file.name,
          createdBy: 'Unknown',
          questionCount: 0,
          duration: '--',
          size: (file.size / 1024).toFixed(1) + ' KB',
          htmlUrl: file.html_url,
          examId: file.name.replace(/\.json$/i, '')
        };
      }
    });

    let examList = await Promise.all(examPromises);

    if (currentUser && currentUser.role === 'lecturer') {
      examList = examList.filter(exam => exam.createdBy === currentUser.username);
    }

    if (examList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Không có đề thi nào trong Kho của bạn.</td></tr>`;
      return;
    }

    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

    tbody.innerHTML = examList.map(exam => {
      const examUrl = `${baseUrl}exam.html?id=${exam.examId}`;
      const safeTitle = escapeHTML(exam.title);
      const safeCreatedBy = escapeHTML(exam.createdBy);

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 15px; margin-bottom: 2px;">
              ${safeTitle}
            </div>
            <div style="font-size: 12px; color: #64748b;">
              📄 File: <code>${exam.fileName}</code> | 👤 Tạo bởi: <b>${safeCreatedBy}</b> | 📝 ${exam.questionCount} câu | ⏱️ ${exam.duration} phút
            </div>
          </td>
          <td>${exam.size}</td>
          <td><span class="status-badge" style="background:#dcfce7;color:#166534">Sẵn sàng</span></td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <a href="${examUrl}" target="_blank" class="btn btn-primary" style="padding: 5px 10px; font-size: 12px; text-decoration: none;">🚀 Mở Đề</a>
              <button data-url="${examUrl}" class="btn btn-secondary btn-copy-link" style="padding: 5px 10px; font-size: 12px; cursor: pointer;">📋 Lấy Link</button>
              <button data-examid="${exam.examId}" data-title="${safeTitle}" class="btn btn-export-excel" style="padding: 5px 10px; font-size: 12px; background-color: #059669; color: #fff; border: none; border-radius: 4px; cursor: pointer;">📊 Kết Quả</button>
             
              <button data-filename="${exam.fileName}" data-sha="${exam.sha}" data-title="${safeTitle}" class="btn btn-delete-exam" style="padding: 5px 10px; font-size: 12px; background-color: #ef4444; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🗑️ Xóa</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Sự kiện Copy Link
    tbody.querySelectorAll('.btn-copy-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        navigator.clipboard.writeText(url);
        alert('Đã chép link làm bài!');
      });
    });

    // Sự kiện Tải Kết Quả Excel
    tbody.querySelectorAll('.btn-export-excel').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const examId = e.currentTarget.getAttribute('data-examid');
        const title = e.currentTarget.getAttribute('data-title');
        await exportResultsToExcel(examId, title, e.currentTarget);
      });
    });

    // Sự kiện Xóa bài thi
    tbody.querySelectorAll('.btn-delete-exam').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const fileName = e.currentTarget.getAttribute('data-filename');
        const sha = e.currentTarget.getAttribute('data-sha');
        const title = e.currentTarget.getAttribute('data-title');

        if (confirm(`Bạn có chắc chắn muốn xóa đề thi "${title}" khỏi Kho?`)) {
          await deleteExamFile(fileName, sha, title);
        }
      });
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg" style="color: #dc2626">${err.message}</td></tr>`;
  }
}

/**
 * Xuất dữ liệu làm bài ra file Excel (.xlsx) kèm chi tiết đáp án từng câu
 */
async function exportResultsToExcel(examId, examTitle, buttonElem) {
  const originalText = buttonElem ? buttonElem.textContent : '';
  if (buttonElem) {
    buttonElem.disabled = true;
    buttonElem.textContent = '⏳ Đang tải...';
  }

  try {
    const config = typeof getConfig === 'function' ? getConfig() : {};
    const webhookUrl = config.webhookUrl || (typeof SCRIPT_URL !== 'undefined' ? SCRIPT_URL : '');
    
    if (!webhookUrl) {
      throw new Error('Chưa cấu hình URL Google Apps Script!');
    }

    // 1. Chuẩn hóa examId: Loại bỏ đuôi .json và khoảng trắng thừa
    const cleanExamId = (examId || '').replace(/\.json$/i, '').trim();

    // 2. Gửi đồng thời cleanExamId và examTitle để Google Sheet tra cứu linh hoạt
    const requestUrl = `${webhookUrl}?action=getResults&examId=${encodeURIComponent(cleanExamId)}&examTitle=${encodeURIComponent(examTitle || '')}&_t=${Date.now()}`;
    const res = await fetch(requestUrl);
    const result = await res.json();

    if (result.status !== 'success' || !Array.isArray(result.data) || result.data.length === 0) {
      alert(`Chưa có sinh viên nào nộp bài cho đề thi "${examTitle}".`);
      return;
    }

    let maxAnswersCount = 0;

    // 3. Định dạng dữ liệu các cột cho bảng Excel
    const excelRows = result.data.map((row, index) => {
      // Tự động Parse mảng đáp án nếu Google Sheet trả về dạng chuỗi String
      let answersArr = row.studentAnswers;
      if (typeof answersArr === 'string') {
        try { answersArr = JSON.parse(answersArr); } catch(e) { answersArr = []; }
      }

      const baseRow = {
        "STT": index + 1,
        "Thời gian nộp": row.timestamp || '',
        "Mã sinh viên": row.studentId || '',
        "Họ và tên": row.fullName || '',
        "Email/Lớp": row.email || '',
        "Tên bài thi": row.examTitle || examTitle,
        "Số câu đã làm": row.answeredCount || 0,
        "Tổng số câu": row.totalQuestions || 0,
        "Điểm số": row.score || 0,
        "Số lần vi phạm": row.violations || 0,
        "Trạng thái nộp": row.status || ''
      };

      // Tự động thêm các cột chi tiết từng câu: Câu 1, Câu 2... Câu N
      if (Array.isArray(answersArr) && answersArr.length > 0) {
        if (answersArr.length > maxAnswersCount) {
          maxAnswersCount = answersArr.length;
        }
        answersArr.forEach((ans, qIdx) => {
          baseRow[`Câu ${qIdx + 1}`] = ans || '';
        });
      }

      return baseRow;
    });

    // 4. Tạo file Excel với SheetJS
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kết quả bài thi");

    // Điều chỉnh độ rộng cột tự động
    const max_name_width = excelRows.reduce((w, r) => Math.max(w, String(r["Họ và tên"] || '').length), 10);
    
    const baseCols = [
      { wch: 5 },   // STT
      { wch: 20 },  // Thời gian nộp
      { wch: 15 },  // Mã SV
      { wch: Math.max(max_name_width, 22) }, // Họ và tên
      { wch: 25 },  // Email/Lớp
      { wch: 30 },  // Tên bài thi
      { wch: 15 },  // Số câu đã làm
      { wch: 15 },  // Tổng số câu
      { wch: 10 },  // Điểm
      { wch: 15 },  // Vi phạm
      { wch: 20 }   // Trạng thái
    ];

    for (let i = 0; i < maxAnswersCount; i++) {
      baseCols.push({ wch: 20 });
    }

    worksheet["!cols"] = baseCols;

    const safeFileName = (cleanExamId || 'KetQua').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `KetQua_${safeFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);

  } catch (err) {
    alert(`❌ Lỗi khi lấy kết quả: ${err.message}`);
  } finally {
    if (buttonElem) {
      buttonElem.disabled = false;
      buttonElem.textContent = originalText;
    }
  }
}

async function deleteExamFile(fileName, sha, title) {
  const config = getConfig();

  if (!config.ghToken || config.ghToken === '••••••••••••••••') {
    alert('Vui lòng điền GitHub Personal Access Token (PAT) ở Mục 1 để thực hiện thao tác xóa!');
    return;
  }

  try {
    const branch = config.ghBranch || 'main';
    const url = `https://api.github.com/repos/${config.ghOwner}/${config.ghRepo}/contents/exams/${fileName}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${config.ghToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Xóa đề thi: ${title}`,
        sha: sha,
        branch: branch
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || res.statusText);
    }

    await loadExamLibrary();
    alert(`✅ Đã xóa thành công đề thi: ${title}`);

  } catch (err) {
    alert(`❌ Không thể xóa file: ${err.message}`);
  }
}

export function initLibraryModule() {
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadExamLibrary);
  }
  loadExamLibrary();
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
