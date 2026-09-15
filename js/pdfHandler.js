/**
 * Chuyển đổi tất cả các trang của file PDF thành mảng ảnh Base64
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<Array<string>>} Mảng chứa dữ liệu ảnh dạng data:image/png;base64
 */
export async function convertPdfToImages(arrayBuffer) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('Chưa nạp thư viện PDF.js vào HTML!');
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const imageUrls = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    
    // Scale 2.0 giúp tăng độ phân giải ảnh để AI đọc chữ nét hơn
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    imageUrls.push(canvas.toDataURL('image/png'));
  }

  return imageUrls;
}
