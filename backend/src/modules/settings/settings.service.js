// Identitas & konten halaman depan storefront - satu-satunya tempat mengedit alamat, sosmed,
// deskripsi bisnis, dan foto hero/pendukung. Storefront membaca lewat getPublicSettings().

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');
const { sanitizeDescriptionHtml } = require('../../common/utils/htmlSanitize');

const SETTINGS_ID = 1;
const MAX_HERO_SLIDES = 5;

const DEFAULTS = {
  id: SETTINGS_ID,
  name: 'Pixelso Gemolong',
  tagline: null,
  description: null,
  address: null,
  openingHours: null,
  whatsapp: null,
  instagram: null,
  tiktok: null,
  youtube: null,
  facebook: null,
  heroSlides: [],
  galleryImages: [],
};

// heroSlides: array {url, linkUrl} maks 5 - linkUrl opsional, kalau diisi harus path internal ("/...")
// atau URL http(s) (bukan javascript:/data: dsb, defense-in-depth karena dirender jadi <a href>).
function normalizeHeroSlides(heroSlides) {
  if (heroSlides === undefined) return undefined;
  if (!Array.isArray(heroSlides)) return [];
  if (heroSlides.length > MAX_HERO_SLIDES) {
    throw new ApiError(400, `Maksimal ${MAX_HERO_SLIDES} foto hero`);
  }
  return heroSlides
    .filter((slide) => slide && typeof slide.url === 'string' && slide.url.trim())
    .map((slide) => {
      const linkUrl = typeof slide.linkUrl === 'string' ? slide.linkUrl.trim() : '';
      if (linkUrl && !/^(\/|https?:\/\/)/i.test(linkUrl)) {
        throw new ApiError(400, 'Link foto hero harus path internal (diawali /) atau URL http(s)');
      }
      return { url: slide.url, linkUrl: linkUrl || null };
    });
}

async function getSettings() {
  const row = await prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
  return row || DEFAULTS;
}

async function updateSettings(data, userId) {
  const {
    name, tagline, description, address, openingHours,
    whatsapp, instagram, tiktok, youtube, facebook,
    heroSlides, galleryImages,
  } = data;

  const normalizedHeroSlides = normalizeHeroSlides(heroSlides);

  const fields = {
    ...(name !== undefined ? { name } : {}),
    ...(tagline !== undefined ? { tagline: tagline || null } : {}),
    ...(description !== undefined ? { description: sanitizeDescriptionHtml(description) } : {}),
    ...(address !== undefined ? { address: address || null } : {}),
    ...(openingHours !== undefined ? { openingHours: openingHours || null } : {}),
    ...(whatsapp !== undefined ? { whatsapp: whatsapp || null } : {}),
    ...(instagram !== undefined ? { instagram: instagram || null } : {}),
    ...(tiktok !== undefined ? { tiktok: tiktok || null } : {}),
    ...(youtube !== undefined ? { youtube: youtube || null } : {}),
    ...(facebook !== undefined ? { facebook: facebook || null } : {}),
    ...(normalizedHeroSlides !== undefined ? { heroSlides: normalizedHeroSlides } : {}),
    ...(galleryImages !== undefined ? { galleryImages: Array.isArray(galleryImages) ? galleryImages : [] } : {}),
    updatedBy: userId,
  };

  return prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    update: fields,
    create: { id: SETTINGS_ID, ...DEFAULTS, ...fields },
  });
}

// Reshapes ke bentuk yang dikonsumsi storefront (tanpa field internal seperti updatedBy).
async function getPublicSettings() {
  const s = await getSettings();
  return {
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    address: s.address,
    openingHours: s.openingHours,
    whatsapp: s.whatsapp,
    instagram: s.instagram,
    tiktok: s.tiktok,
    youtube: s.youtube,
    facebook: s.facebook,
    heroSlides: Array.isArray(s.heroSlides) ? s.heroSlides : [],
    galleryImages: Array.isArray(s.galleryImages) ? s.galleryImages : [],
  };
}

module.exports = { getSettings, updateSettings, getPublicSettings };
