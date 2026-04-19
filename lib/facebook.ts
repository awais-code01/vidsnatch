import type { VideoInfo } from '@/types';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

function cleanFBUrl(raw: string): string {
  return raw.replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/\\/g, '');
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

/** Resolve any short or redirect URL (fb.watch, share/r/, etc.) to its canonical form. */
async function resolveUrl(url: string): Promise<string> {
  if (!url.includes('fb.watch') && !url.includes('/share/') && !url.includes('m.me')) {
    return url;
  }
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

function extractVideoData(html: string): {
  hd?: string;
  sd?: string;
  title?: string;
  thumbnail?: string;
} {
  const result: { hd?: string; sd?: string; title?: string; thumbnail?: string } = {};

  // Patterns for HD video URL — try in order of reliability
  const hdPatterns = [
    /"hd_src":"([^"]+)"/,
    /"hd_src_no_ratelimit":"([^"]+)"/,
    /"browser_native_hd_url":"([^"]+)"/,
    /hd_src["\s]*:["\s]*"([^"]+\.mp4[^"]*)"/,
    /"playable_url_quality_hd":"([^"]+)"/,
  ];

  const sdPatterns = [
    /"sd_src":"([^"]+)"/,
    /"sd_src_no_ratelimit":"([^"]+)"/,
    /"browser_native_sd_url":"([^"]+)"/,
    /sd_src["\s]*:["\s]*"([^"]+\.mp4[^"]*)"/,
    /"playable_url":"([^"]+)"/,
    /<video[^>]+src="([^"]+\.mp4[^"]*)"/,
    /<source[^>]+src="([^"]+\.mp4[^"]*)"/,
  ];

  for (const p of hdPatterns) {
    const m = html.match(p);
    if (m?.[1] && m[1].includes('.mp4')) { result.hd = cleanFBUrl(m[1]); break; }
  }

  for (const p of sdPatterns) {
    const m = html.match(p);
    if (m?.[1]) { result.sd = cleanFBUrl(m[1]); break; }
  }

  // OG video as last resort
  if (!result.hd && !result.sd) {
    const ogVideo =
      html.match(/<meta property="og:video:secure_url" content="([^"]+)"/) ||
      html.match(/<meta property="og:video" content="([^"]+)"/);
    if (ogVideo?.[1]) result.sd = decodeHTMLEntities(ogVideo[1]);
  }

  // Title
  const titlePatterns = [
    /<meta property="og:title" content="([^"]+)"/,
    /"title":"([^"]+)"/,
    /<title>([^<]+)<\/title>/,
  ];
  for (const p of titlePatterns) {
    const m = html.match(p);
    if (m?.[1] && m[1] !== 'Facebook') {
      result.title = decodeHTMLEntities(m[1]);
      break;
    }
  }

  // Thumbnail
  const thumbPatterns = [
    /<meta property="og:image" content="([^"]+)"/,
    /"thumbnail_url":"([^"]+)"/,
    /"preferred_thumbnail":\{"image":\{"uri":"([^"]+)"/,
    /"thumbnailImage":\{"uri":"([^"]+)"/,
  ];
  for (const p of thumbPatterns) {
    const m = html.match(p);
    if (m?.[1]) { result.thumbnail = decodeHTMLEntities(m[1]); break; }
  }

  return result;
}

/** Fetch Facebook with standard browser headers. */
async function fetchFacebookPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Cookie: 'locale=en_US; datr=; sb=; c_user=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Try mbasic.facebook.com — simpler HTML, less JS, often exposes video URLs directly. */
async function tryMbasic(url: string): Promise<ReturnType<typeof extractVideoData>> {
  try {
    const mUrl = url
      .replace('www.facebook.com', 'mbasic.facebook.com')
      .replace('m.facebook.com', 'mbasic.facebook.com');

    const res = await fetch(mUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Cookie: 'locale=en_US',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return {};
    return extractVideoData(await res.text());
  } catch {
    return {};
  }
}

export async function getFacebookInfo(url: string): Promise<VideoInfo> {
  try {
    const resolvedUrl = await resolveUrl(url);

    // Try www first, then mbasic fallback
    let extracted = extractVideoData(await fetchFacebookPage(resolvedUrl));

    if (!extracted.hd && !extracted.sd) {
      extracted = await tryMbasic(resolvedUrl);
    }

    // If still nothing and URL contains a video ID, try /video/{id} directly
    if (!extracted.hd && !extracted.sd) {
      const vidId = resolvedUrl.match(/\/videos\/(\d+)/)?.[1] ||
                    resolvedUrl.match(/[?&]v=(\d+)/)?.[1] ||
                    resolvedUrl.match(/story_fbid=(\d+)/)?.[1];
      if (vidId) {
        try {
          const directHtml = await fetchFacebookPage(`https://www.facebook.com/video/${vidId}`);
          extracted = extractVideoData(directHtml);
        } catch { /* ignore */ }
      }
    }

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
          'Could not extract video URL. Make sure the video is public. Facebook\'s page structure changes frequently — this may work for some videos but not others.',
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
