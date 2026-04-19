import type { VideoInfo } from '@/types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MOBILE_IG_UA =
  'Instagram 219.0.0.12.117 Android (26/8.0.0; 480dpi; 1080x1920; OnePlus; ONEPLUS A3010; OnePlus3T; qcom; en_US; 314665256)';

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

// Convert Instagram shortcode to numeric media PK (base62 decode)
function shortcodeToPk(shortcode: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let pk = BigInt(0);
  for (const c of shortcode) {
    const idx = alphabet.indexOf(c);
    if (idx < 0) continue;
    pk = pk * BigInt(64) + BigInt(idx);
  }
  return pk.toString();
}

/**
 * Approach 1: Instagram mobile private API
 * Works for public posts without session cookies.
 */
async function tryMobileAPI(shortcode: string, originalUrl: string): Promise<VideoInfo | null> {
  try {
    const pk = shortcodeToPk(shortcode);
    const apiUrl = `https://i.instagram.com/api/v1/media/${pk}/info/`;

    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': MOBILE_IG_UA,
        'X-IG-App-ID': '567067343352427',
        'X-IG-Connection-Type': 'WIFI',
        'X-IG-Capabilities': '3brTvw==',
        'Accept-Language': 'en-US',
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) return null;

    let data: Record<string, unknown>;
    try { data = await res.json(); } catch { return null; }

    const items = data?.items as Array<Record<string, unknown>> | undefined;
    const item = items?.[0];
    if (!item) return null;

    const videoVersions = item.video_versions as Array<{ url: string; width?: number; height?: number }> | undefined;
    if (!videoVersions?.length) return null;

    const best = videoVersions[0];
    const imageVersions = item.image_versions2 as { candidates?: Array<{ url: string }> } | undefined;
    const caption = (item.caption as { text?: string } | null)?.text;

    return {
      originalUrl,
      platform: 'instagram',
      title: caption?.slice(0, 100) || 'Instagram Video',
      thumbnail: imageVersions?.candidates?.[0]?.url,
      author: (item.user as { username?: string } | undefined)?.username
        ? `@${(item.user as { username: string }).username}`
        : undefined,
      formats: [
        {
          quality: 'Best',
          label: 'Best Quality • MP4',
          url: best.url,
          hasVideo: true,
          hasAudio: true,
          container: 'mp4',
        },
      ],
    };
  } catch {
    return null;
  }
}

/**
 * Approach 2: JSON-LD extraction — Instagram includes VideoObject in public pages for SEO.
 */
async function tryJSONLD(url: string): Promise<VideoInfo | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const data: unknown = JSON.parse(m[1]);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items as Array<Record<string, unknown>>) {
          if (item['@type'] === 'VideoObject' && item.contentUrl) {
            const thumb = item.thumbnailUrl;
            return {
              originalUrl: url,
              platform: 'instagram',
              title: String(item.name || (item.description as string)?.slice(0, 100) || 'Instagram Video'),
              thumbnail: Array.isArray(thumb) ? String(thumb[0]) : typeof thumb === 'string' ? thumb : undefined,
              formats: [
                {
                  quality: 'Best',
                  label: 'Best Quality • MP4',
                  url: String(item.contentUrl),
                  hasVideo: true,
                  hasAudio: true,
                  container: 'mp4',
                },
              ],
            };
          }
        }
      } catch { /* skip bad JSON */ }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Approach 3: Instagram embed page — /p/{shortcode}/embed/
 */
async function tryEmbedPage(shortcode: string, originalUrl: string): Promise<VideoInfo | null> {
  for (const embedUrl of [
    `https://www.instagram.com/p/${shortcode}/embed/`,
    `https://www.instagram.com/reel/${shortcode}/embed/`,
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
  ]) {
    try {
      const res = await fetch(embedUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.instagram.com/',
          'Sec-Fetch-Dest': 'iframe',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          Cookie: 'ig_cb=1',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) continue;
      const html = await res.text();

      const videoPatterns = [
        /"video_url":"(https:[^"]+)"/,
        /"contentUrl":"(https:[^"]+)"/,
        /video_url\\?":\\?"(https:[^"\\]+)/,
        /<video[^>]+src="([^"]+\.mp4[^"]*)"/,
        /property="og:video:secure_url" content="([^"]+)"/,
        /property="og:video" content="([^"]+)"/,
        /"playable_url":"([^"]+)"/,
        /"video_blocked":false[^}]*"video_url":"([^"]+)"/,
      ];

      let videoUrl: string | null = null;
      for (const p of videoPatterns) {
        const m = html.match(p);
        if (m?.[1]) { videoUrl = decodeHTMLEntities(m[1]); break; }
      }
      if (!videoUrl) continue;

      const thumbPatterns = [
        /property="og:image" content="([^"]+)"/,
        /display_url":"(https:[^"]+)"/,
        /thumbnail_src":"(https:[^"]+)"/,
      ];
      let thumbnail: string | undefined;
      for (const p of thumbPatterns) {
        const m = html.match(p);
        if (m?.[1]) { thumbnail = decodeHTMLEntities(m[1]); break; }
      }

      const titleMatch =
        html.match(/property="og:title" content="([^"]+)"/) ||
        html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch?.[1]
        ? decodeHTMLEntities(titleMatch[1]).replace(' • Instagram', '').trim()
        : 'Instagram Video';

      return {
        originalUrl,
        platform: 'instagram',
        title,
        thumbnail,
        formats: [
          {
            quality: 'Best',
            label: 'Best Quality • MP4',
            url: videoUrl,
            hasVideo: true,
            hasAudio: true,
            container: 'mp4',
          },
        ],
      };
    } catch { continue; }
  }
  return null;
}

/**
 * Approach 4: Fetch main page with browser UA and extract from __additionalData / OG tags
 */
async function tryMainPageScrape(url: string): Promise<VideoInfo | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Cookie: 'ig_cb=1; ig_did=00000000-0000-0000-0000-000000000000',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Look for video URL in multiple formats present in Instagram page source
    const videoPatterns = [
      /"video_url":"(https:[^"]+)"/,
      /"contentUrl":"(https:[^"]+)"/,
      /<meta property="og:video:secure_url" content="([^"]+)"/,
      /<meta property="og:video" content="([^"]+)"/,
      /<meta name="twitter:player:stream" content="([^"]+)"/,
    ];

    let videoUrl: string | null = null;
    for (const p of videoPatterns) {
      const m = html.match(p);
      if (m?.[1]) { videoUrl = decodeHTMLEntities(m[1]); break; }
    }
    if (!videoUrl) return null;

    const titleMatch =
      html.match(/<meta property="og:title" content="([^"]+)"/) ||
      html.match(/<title>([^<]+)<\/title>/);
    const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

    return {
      originalUrl: url,
      platform: 'instagram',
      title: titleMatch?.[1]
        ? decodeHTMLEntities(titleMatch[1]).replace(' • Instagram', '').trim()
        : 'Instagram Video',
      thumbnail: thumbMatch?.[1] ? decodeHTMLEntities(thumbMatch[1]) : undefined,
      formats: [
        {
          quality: 'Best',
          label: 'Best Quality • MP4',
          url: videoUrl,
          hasVideo: true,
          hasAudio: true,
          container: 'mp4',
        },
      ],
    };
  } catch {
    return null;
  }
}

export async function getInstagramInfo(url: string): Promise<VideoInfo> {
  const shortcode = extractShortcode(url);

  if (shortcode) {
    const mobileResult = await tryMobileAPI(shortcode, url);
    if (mobileResult?.formats.length) return mobileResult;
  }

  const jsonLdResult = await tryJSONLD(url);
  if (jsonLdResult?.formats.length) return jsonLdResult;

  if (shortcode) {
    const embedResult = await tryEmbedPage(shortcode, url);
    if (embedResult?.formats.length) return embedResult;
  }

  const mainResult = await tryMainPageScrape(url);
  if (mainResult?.formats.length) return mainResult;

  return {
    originalUrl: url,
    platform: 'instagram',
    title: 'Instagram Video',
    formats: [],
    error:
      'Could not download this Instagram video. Make sure: (1) The post is public, (2) The URL is a direct reel/post link (not a profile or story). Instagram increasingly blocks server-side access — private posts and some public posts cannot be downloaded.',
  };
}
