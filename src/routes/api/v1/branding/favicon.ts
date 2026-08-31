import { createFileRoute } from '@tanstack/react-router';
import { getCompanyBranding } from '@/lib/db/branding';
import { decodeBase64, stripPngDataUrl } from '@/lib/branding/assets';

const FAVICON_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300'
};

function defaultFaviconResponse() {
  // No uploaded favicon: send the browser to the bundled /favicon.ico so the
  // default icon keeps working (agreed fallback behavior).
  return new Response(null, { status: 302, headers: { Location: '/favicon.ico' } });
}

/**
 * Resolves the favicon response for the browser tab: the uploaded Branding
 * favicon when present, otherwise a redirect to /favicon.ico. Public by
 * design — the login page and browser must render branding without a
 * session, and the favicon carries no sensitive data.
 */
export function resolveFaviconResponse(faviconDataUrl: string | null | undefined): Response {
  const base64 = stripPngDataUrl(faviconDataUrl);
  if (!base64) return defaultFaviconResponse();
  const bytes = decodeBase64(base64);
  if (!bytes) return defaultFaviconResponse();
  return new Response(bytes.buffer as ArrayBuffer, {
    status: 200,
    headers: { ...FAVICON_CACHE_HEADERS, 'Content-Type': 'image/png' }
  });
}

export const Route = createFileRoute('/api/v1/branding/favicon')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const branding = await getCompanyBranding();
          return resolveFaviconResponse(branding.favicon);
        } catch {
          return defaultFaviconResponse();
        }
      }
    }
  }
});
