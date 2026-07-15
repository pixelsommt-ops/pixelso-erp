// Sanitasi HTML dari rich text editor (deskripsi produk) - lapis pertahanan di sisi server,
// tambahan dari sanitasi yang sama di storefront saat merender (defense-in-depth).
// Regex-based (bukan library DOMPurify/jsdom) - jsdom membawa dependency ESM-only yang bikin
// Jest gagal parse seluruh test suite; whitelist tag di sini kecil & tetap (tanpa atribut sama
// sekali di tag manapun), jadi pendekatan sederhana ini cukup aman untuk kasus ini.

const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'p', 'br', 'ul', 'ol', 'li'];

function sanitizeDescriptionHtml(html) {
  if (!html) return null;
  let clean = String(html);

  // Buang blok yang isinya sendiri berbahaya (bukan cuma tag-nya) - script/style/iframe/dst.
  clean = clean.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Buang komentar HTML (bisa dipakai menyelundupkan payload di beberapa parser lama).
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');
  // Buang tag apapun di luar whitelist (isi teks tetap ada, cuma tag-nya hilang), dan buang
  // SEMUA atribut dari tag yang diizinkan (tanpa atribut sama sekali - tidak ada href/onerror/dst).
  clean = clean.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) return '';
    return match.startsWith('</') ? `</${tag}>` : `<${tag}>`;
  });

  return clean.trim() || null;
}

module.exports = { sanitizeDescriptionHtml };
