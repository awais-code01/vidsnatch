import type { VideoInfo } from '@/types';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u0026/g, '&')
    .replace(/\\u003C/g, '<')
    .replace(/\\u003E/g, '>')
    .replace(/\\/g, '');
}

function cleanFBUrl(url: string): string {
  // Facebook escapes / as \/ in JS
  return url.replace(/\\\//g, '/').replace(/\\u0026/g, '&');
}

async function resolveFbWatchUrl(url: string): Promise<string> {
  if (!url.includes('fb.watch')) return url;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: BROWSER_HEADERS,
    });
    return res.url || url;
  } catch {
    return url;
  }
}

async function fetchFacebookPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Cookie: 'locale=en_US; datr=; sb=',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.text();
}

function extractVideoUrls(html: string): {
  hd?: string;
  sd?: string;
  title?: string;
  thumbnail?: string;
} {
  const result: { hd?: string; sd?: string; title?: string; thumbnail?: string } = {};

  // Method 1: JSON encoded in HTML
  const hdPatterns = [
    /"hd_src":"([^"]+)"/,
    /"hd_src_no_ratelimit":"([^"]+)"/,
    /hd_src["\s]*:["\s]*"([^"]+\.mp4[^"]*)"/,
  ];
  const sdPatterns = [
    /"sd_src":"([^"]+)"/,
    /"sd_src_no_ratelimit":"([^"]+)"/,
    /sd_src["\s]*:["\s]*"([^"]+\.mp4[^"]*)"/,
  ];

  for (const pattern of hdPatterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      result.hd = cleanFBUrl(m[1]);
      break;
    }
  }

  for (const pattern of sdPatterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      result.sd = cleanFBUrl(m[1]);
      break;
    }
  }

  // Method 2: og:video meta tags
  if (!result.hd && !result.sd) {
    const ogVideo =
      html.match(/<meta property="og:video:secure_url" content="([^"]+)"/) ||
      html.match(/<meta property="og:video" content="([^"]+)"/);
    if (ogVideo?.[1]) {
      result.sd = decodeHTMLEntities(ogVideo[1]);
    }
  }

  // Method 3: playable_url in JSON blobs
  if (!result.hd && !result.sd) {
    const playableHd = html.match(/"playable_url_quality_hd":"([^"]+)"/);
    const playableSd = html.match(/"playable_url":"([^"]+)"/);
    if (playableHd?.[1]) result.hd = cleanFBUrl(playableHd[1]);
    if (playableSd?.[1]) result.sd = cleanFBUrl(playableSd[1]);
  }

  // Title
  const titlePatterns = [
    /<meta property="og:title" content="([^"]+)"/,
    /<title>([^<]+)<\/title>/,
    /"title":"([^"]+)"/,
  ];
  for (const pattern of titlePatterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      result.title = decodeHTMLEntities(m[1]);
      break;
    }
  }

  // Thumbnail
  const thumbPatterns = [
    /<meta property="og:image" content="([^"]+)"/,
    /"thumbnail_url":"([^"]+)"/,
    /"preferred_thumbnail":\{"image":\{"uri":"([^"]+)"/,
  ];
  for (const pattern of thumbPatterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      result.thumbnail = decodeHTMLEntities(m[1]);
      break;
    }
  }

  return result;
}

export async function getFacebookInfo(url: string): Promise<VideoInfo> {
  try {
    // Resolve fb.watch short URLs
    const resolvedUrl = await resolveFbWatchUrl(url);

    const html = await fetchFacebookPage(resolvedUrl);
    const extracted = extractVideoUrls(html);

    const formats = [];

    if (extracted.hd) {
      formats.push({
        quality: 'HD',
        label: 'HD Quality • MP4',
        url: extracted.hd,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
      });
    }

    if (extracted.sd) {
      formats.push({
        quality: 'SD',
        label: 'SD Quality • MP4',
        url: extracted.sd,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
      });
    }

    if (formats.length === 0) {
      return {
        originalUrl: url,
        platform: 'facebook',
        title: extracted.title || 'Facebook Video',
        thumbnail: extracted.thumbnail,
        formats: [],
        error:
          'Could not extract video URL from this Facebook post. The video may be private, from a group, or Facebook may have changed their page structure. Try making the video public.',
      };
    }

    return {
      originalUrl: url,
      platform: 'facebook',
      title: extracted.title || 'Facebook Video',
      thumbnail: extracted.thumbnail,
      formats,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      originalUrl: url,
      platform: 'facebook',
      title: 'Facebook Video',
      formats: [],
      error: `Failed to fetch Facebook video: ${message}. Make sure the video is public.`,
    };
  }
}
