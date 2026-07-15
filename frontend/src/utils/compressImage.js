// Resize + kompres gambar di browser sebelum upload - dipakai untuk foto produk (Pricing) dan
// foto hero/galeri (Settings). Pola sama seperti compressImage.js di pixelso-storefront (dipakai
// di sana untuk bukti transfer), di-generalisasi supaya maxWidth/maxHeight/targetBytes bisa diatur
// per pemakaian - foto marketing di sini boleh lebih besar & kualitas lebih tinggi dari bukti transfer.
export function compressImage(file, { maxWidth = 1600, maxHeight = 1200, targetBytes = 700000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('File bukan gambar.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File tidak dapat dibaca.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Format gambar ini tidak didukung browser (mis. HEIC dari iPhone). Convert dulu ke JPG/PNG, atau screenshot foto tersebut.'));
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        let quality = 0.88;
        let data = canvas.toDataURL('image/webp', quality);
        while (data.length > targetBytes && quality > 0.45) {
          quality -= 0.08;
          data = canvas.toDataURL('image/webp', quality);
        }
        resolve({ dataUrl: data, width, height });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
