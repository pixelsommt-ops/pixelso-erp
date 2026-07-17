// Tema event storefront (Kemerdekaan, Idul Fitri, Tema Sekolah, dst) - manager bikin beberapa
// tema di muka, aktifkan salah satu manual kapan perlu. Cuma satu tema boleh aktif sekaligus.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

// Whitelist CSS var yang boleh dioverride tema - subset dari :root di pixelso-storefront/src/index.css.
// Kalau var baru ditambah di sana dan perlu dibuat themeable, tambahkan juga di sini.
const THEMEABLE_COLOR_KEYS = [
  '--maroon-950',
  '--maroon-900',
  '--maroon-800',
  '--maroon-700',
  '--red-600',
  '--red-500',
  '--red-100',
  '--rose-50',
  '--cream',
];

function sanitizeColors(colors) {
  if (!colors || typeof colors !== 'object') return null;
  const cleaned = {};
  for (const key of THEMEABLE_COLOR_KEYS) {
    if (colors[key]) cleaned[key] = String(colors[key]);
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function sanitizeHeroSlides(heroSlides) {
  if (!Array.isArray(heroSlides) || heroSlides.length === 0) return null;
  return heroSlides
    .filter((s) => s && s.url)
    .slice(0, 5)
    .map((s) => ({ url: String(s.url), linkUrl: s.linkUrl ? String(s.linkUrl) : null }));
}

async function list() {
  return prisma.theme.findMany({ orderBy: { createdAt: 'desc' } });
}

async function getById(id) {
  const theme = await prisma.theme.findUnique({ where: { themeId: Number(id) } });
  if (!theme) {
    throw new ApiError(404, 'Theme not found');
  }
  return theme;
}

async function create(data) {
  const { name, colors, logoUrl, heroSlides, customCss } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  return prisma.theme.create({
    data: {
      name,
      colors: sanitizeColors(colors),
      logoUrl: logoUrl || null,
      heroSlides: sanitizeHeroSlides(heroSlides),
      customCss: customCss || null,
    },
  });
}

async function update(id, data) {
  await getById(id);
  const { name, colors, logoUrl, heroSlides, customCss } = data;
  return prisma.theme.update({
    where: { themeId: Number(id) },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(colors !== undefined ? { colors: sanitizeColors(colors) } : {}),
      ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
      ...(heroSlides !== undefined ? { heroSlides: sanitizeHeroSlides(heroSlides) } : {}),
      ...(customCss !== undefined ? { customCss: customCss || null } : {}),
    },
  });
}

async function deleteTheme(id) {
  await getById(id);
  return prisma.theme.delete({ where: { themeId: Number(id) } });
}

// Nonaktifkan semua tema lain lalu aktifkan yang ini - dalam satu transaction supaya tidak
// pernah ada dua tema aktif sekaligus walau ada request bersamaan.
async function activate(id) {
  await getById(id);
  return prisma.$transaction(async (tx) => {
    await tx.theme.updateMany({ data: { isActive: false }, where: { isActive: true } });
    return tx.theme.update({ where: { themeId: Number(id) }, data: { isActive: true } });
  });
}

async function deactivate(id) {
  await getById(id);
  return prisma.theme.update({ where: { themeId: Number(id) }, data: { isActive: false } });
}

// Dipakai storefront (lewat storefront.service.js#getSiteSettings) - null kalau tidak ada
// tema aktif, storefront lalu pakai tampilan default.
async function getActiveTheme() {
  return prisma.theme.findFirst({ where: { isActive: true } });
}

module.exports = {
  THEMEABLE_COLOR_KEYS,
  list,
  getById,
  create,
  update,
  deleteTheme,
  activate,
  deactivate,
  getActiveTheme,
};
