// Dashboard: Link Kerja - link referensi (web/YouTube/Instagram/TikTok) dibagikan manager,
// tampil di widget Dashboard untuk semua role login. Lihat schema.prisma WorkLink/WorkLinkClick.

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const FETCH_TIMEOUT_MS = 5000;

function detectPlatform(url) {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return 'youtube';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  return 'web';
}

function extractYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const shortsMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
    if (shortsMatch) return shortsMatch[1];
  } catch {
    // url tidak valid - sudah divalidasi di create(), tapi jaga-jaga
  }
  return null;
}

// Best-effort scrape og:image/og:title - Instagram/TikTok umumnya menolak request tanpa
// login/cookie session jadi sering pulang kosong, dengan sengaja: frontend fallback ke ikon
// platform generik kalau thumbnailUrl null, bukan dianggap error.
async function fetchOgMeta(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PixelsoERP/1.0; +https://cetakpixelso.com)' },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const image =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
      null;
    const title =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<title>([^<]*)<\/title>/i)?.[1] ||
      null;
    return { image, title: title ? title.trim() : null };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

async function resolveThumbnailAndTitle(url, platform) {
  if (platform === 'youtube') {
    const videoId = extractYoutubeId(url);
    if (videoId) {
      // Thumbnail YouTube deterministik dari video id, tidak perlu fetch/API key.
      const meta = await fetchOgMeta(url);
      return { thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, title: meta.title || null };
    }
  }
  const meta = await fetchOgMeta(url);
  return { thumbnailUrl: meta.image || null, title: meta.title || null };
}

async function list({ page, pageSize }) {
  const take = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [links, total] = await Promise.all([
    prisma.workLink.findMany({
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } }, _count: { select: { clicks: true } } },
      take,
      skip,
    }),
    prisma.workLink.count(),
  ]);

  return {
    links: links.map(({ _count, ...l }) => ({ ...l, clickCount: _count.clicks })),
    total,
    page: currentPage,
    pageSize: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  };
}

async function create(data, currentUser) {
  const { url, title } = data;
  if (!url) {
    throw new ApiError(400, 'url is required');
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new ApiError(400, 'url tidak valid');
  }

  const platform = detectPlatform(url);
  const resolved = await resolveThumbnailAndTitle(url, platform);

  return prisma.workLink.create({
    data: {
      url,
      title: title || resolved.title || null,
      thumbnailUrl: resolved.thumbnailUrl,
      platform,
      createdById: currentUser.userId,
    },
  });
}

async function deleteLink(id) {
  const link = await prisma.workLink.findUnique({ where: { linkId: Number(id) } });
  if (!link) {
    throw new ApiError(404, 'Link not found');
  }
  return prisma.workLink.delete({ where: { linkId: Number(id) } });
}

async function recordClick(id, currentUser) {
  const link = await prisma.workLink.findUnique({ where: { linkId: Number(id) } });
  if (!link) {
    throw new ApiError(404, 'Link not found');
  }
  return prisma.workLinkClick.create({ data: { linkId: Number(id), userId: currentUser.userId } });
}

async function listClicks(id) {
  const link = await prisma.workLink.findUnique({ where: { linkId: Number(id) } });
  if (!link) {
    throw new ApiError(404, 'Link not found');
  }
  return prisma.workLinkClick.findMany({
    where: { linkId: Number(id) },
    include: { user: { select: { userId: true, name: true, photoUrl: true } } },
    orderBy: { clickedAt: 'desc' },
  });
}

module.exports = { list, create, deleteLink, recordClick, listClicks };
