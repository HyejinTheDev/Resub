/**
 * Build absolute URLs for media files when the API runs on a different host
 * than the frontend (e.g. Vercel + Hugging Face Spaces).
 */

function getPublicBaseUrl(req) {
  if (process.env.BACKEND_PUBLIC_URL) {
    return process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '');
  }
  if (!req) {
    return '';
  }
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}`;
}

function getFullUrl(reqOrBase, relativePath) {
  if (!relativePath) return relativePath;
  if (/^https?:\/\//i.test(relativePath)) {
    return relativePath;
  }
  const base = typeof reqOrBase === 'string'
    ? reqOrBase
    : getPublicBaseUrl(reqOrBase);
  if (!base) {
    return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  }
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}

module.exports = { getPublicBaseUrl, getFullUrl };
