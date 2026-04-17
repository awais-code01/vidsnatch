import type { VideoInfo } from '@/types';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'no-cache',
};

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

/**
 * Approach 1: Instagram embed page
 * Works for public reels/posts without login.
 */
async function tryEmbedPage(shortcode: string, originalUrl: string): Promise<VideoInfo | null> {
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

  try {
    const res = await fetch(embedUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Referer: 'https://www.instagram.com/',
        'Sec-Fetch-Site': 'same-origin',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Extract video URL — Instagram embeds contain this in a JSON blob
    const videoPatterns = [
      /video_url":"(https:[^"]+)"/,
      /"contentUrl":"(https:[^"]+)"/,
      /property="og:video" content="([^"]+)"/,
      /property="og:video:secure_url" content="([^"]+)"/,
      /<video[^>]+src="([^"]+)"/,
    ];

    let videoUrl: string | null = null;
    for (const p of videoPatterns) {
      const m = html.match(p);
      if (m?.[1]) {
        videoUrl = decodeHTMLEntities(m[1]);
        break;
      }
    }

    if (!videoUrl) return null;

    // Extract thumbnail
    const thumbPatterns = [
      /property="og:image" content="([^"]+)"/,
      /display_url":"(https:[^"]+)"/,
      /thumbnail_src":"(https:[^"]+)"/,
    ];
    let thumbnail: string | undefined;
    for (const p of thumbPatterns) {
      const m = html.match(p);
      if (m?.[1]) {
        thumbnail = decodeHTMLEntities(m[1]);
        break;
      }
    }

    // Extract title
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
  } catch {
    return null;
  }
}

/**
 * Approach 2: Scrape the main page OG tags
 */
async function tryOGScrape(url: string): Promise<VideoInfo | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const html = await res.text();

    const videoMatch =
      html.match(/<meta property="og:video:secure_url" content="([^"]+)"/) ||
      html.match(/<meta property="og:video" content="([^"]+)"/) ||
      html.match(/<meta name="twitter:player:stream" content="([^"]+)"/);

    if (!videoMatch?.[1]) return null;

    const titleMatch =
      html.match(/<meta property="og:title" content="([^"]+)"/) ||
      html.match(/<title>([^<]+)<\/title>/);
    const thumbMatch =
      html.match(/<meta property="og:image" content="([^"]+)"/) ||
      html.match(/<meta name="twitter:image" content="([^"]+)"/);

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
          url: decodeHTMLEntities(videoMatch[1]),
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
 * Approach 3: Try the /api/v1/media/{pk}/info/ approach via URL
 * (works for some public content)
 */
async function tryDirectMediaFetch(url: string): Promise<VideoInfo | null> {
  try {
    // Extract media ID from URL if present
    const pkMatch = url.match(/\/(\d{17,19})\/?/);
    if (!pkMatch) return null;

    const mediaId = pkMatch[1];
    const apiUrl = `https://www.instagram.com/api/v1/media/${mediaId}/info/`;

    const res = await fetch(apiUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'X-IG-App-ID': '936619743392459',
        'X-ASBD-ID': '129477',
        Referer: url,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;

    const formats = [];

    if (item.video_versions?.length > 0) {
      const best = item.video_versions[0];
      formats.push({
        quality: 'Best',
        label: 'Best Quality • MP4',
        url: best.url,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
      });
    }

    if (formats.length === 0) return null;

    return {
      originalUrl: url,
      platform: 'instagram',
      title: item.caption?.text?.slice(0, 100) || 'Instagram Video',
      thumbnail: item.image_versions2?.candidates?.[0]?.url,
      author: item.user?.username ? `@${item.user.username}` : undefined,
      formats,
    };
  } catch {
    return null;
  }
}

export async function getInstagramInfo(url: string): Promise<VideoInfo> {
  const shortcode = extractShortcode(url);

  // Try all approaches in order
  if (shortcode) {
    const embed = await tryEmbedPage(shortcode, url);
    if (embed && embed.formats.length > 0) return embed;
  }

  const direct = await tryDirectMediaFetch(url);
  if (direct && direct.formats.length > 0) return direct;

  const og = await tryOGScrape(url);
  if (og && og.formats.length > 0) return og;

  return {
    originalUrl: url,
    platform: 'instagram',
    title: 'Instagram Video',
    formats: [],
    error:
      'Could not download this Instagram video. Instagram heavily restricts server-side access. Make sure: (1) The post is public, (2) The URL is a direct reel/post link (not a profile or story). Private posts require login and cannot be downloaded.',
  };
}
