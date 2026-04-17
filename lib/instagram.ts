import type { VideoInfo } from '@/types';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
};

function extractShortcode(url: string): string | null {
  // Match /p/, /reel/, /tv/, /reels/
  const match = url.match(/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

async function tryOEmbedAPI(url: string): Promise<{ title?: string; thumbnail?: string }> {
  try {
    const apiUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl, { headers: BROWSER_HEADERS });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title,
        thumbnail: data.thumbnail_url,
      };
    }
  } catch {
    // ignore
  }
  return {};
}

async function tryInstaFetchAPI(url: string): Promise<VideoInfo | null> {
  // Use instaloader-inspired public scrape approach
  try {
    const shortcode = extractShortcode(url);
    if (!shortcode) return null;

    // Try Instagram's public GraphQL endpoint (no auth for public posts)
    const gqlUrl = `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables=${encodeURIComponent(
      JSON.stringify({ shortcode })
    )}`;

    const res = await fetch(gqlUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'X-IG-App-ID': '936619743392459',
        Referer: `https://www.instagram.com/p/${shortcode}/`,
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const media = json?.data?.shortcode_media;
    if (!media) return null;

    const formats = [];
    const isVideo = media.__typename === 'GraphVideo' || media.is_video;

    if (isVideo && media.video_url) {
      formats.push({
        quality: 'Best',
        label: 'Best Quality • MP4',
        url: media.video_url,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
      });
    }

    // Carousel — check edge_sidecar_to_children
    if (media.edge_sidecar_to_children) {
      const edges = media.edge_sidecar_to_children.edges || [];
      edges.forEach((edge: Record<string, unknown>, i: number) => {
        const node = edge.node as Record<string, unknown>;
        if (node && node.is_video && node.video_url) {
          formats.push({
            quality: `Video ${i + 1}`,
            label: `Slide ${i + 1} • MP4`,
            url: node.video_url as string,
            hasVideo: true,
            hasAudio: true,
            container: 'mp4',
          });
        }
      });
    }

    if (formats.length === 0) return null;

    const caption =
      media.edge_media_to_caption?.edges?.[0]?.node?.text || 'Instagram Video';

    return {
      originalUrl: url,
      platform: 'instagram',
      title: caption.length > 100 ? caption.slice(0, 97) + '...' : caption,
      thumbnail:
        media.display_url ||
        media.thumbnail_src ||
        media.display_resources?.[0]?.src,
      author: media.owner?.username
        ? `@${media.owner.username}`
        : undefined,
      formats,
    };
  } catch {
    return null;
  }
}

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

    const titleMatch =
      html.match(/<meta property="og:title" content="([^"]+)"/) ||
      html.match(/<title>([^<]+)<\/title>/);

    const thumbMatch =
      html.match(/<meta property="og:image" content="([^"]+)"/) ||
      html.match(/<meta name="twitter:image" content="([^"]+)"/);

    if (!videoMatch?.[1]) return null;

    return {
      originalUrl: url,
      platform: 'instagram',
      title: titleMatch?.[1]
        ? decodeHTMLEntities(titleMatch[1])
        : 'Instagram Video',
      thumbnail: thumbMatch?.[1]
        ? decodeHTMLEntities(thumbMatch[1])
        : undefined,
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

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export async function getInstagramInfo(url: string): Promise<VideoInfo> {
  // Try GraphQL first
  const graphResult = await tryInstaFetchAPI(url);
  if (graphResult && graphResult.formats.length > 0) {
    return graphResult;
  }

  // Try OG scrape fallback
  const ogResult = await tryOGScrape(url);
  if (ogResult && ogResult.formats.length > 0) {
    // Enhance with oembed meta
    const meta = await tryOEmbedAPI(url);
    return {
      ...ogResult,
      title: meta.title || ogResult.title,
      thumbnail: meta.thumbnail || ogResult.thumbnail,
    };
  }

  return {
    originalUrl: url,
    platform: 'instagram',
    title: 'Instagram Video',
    formats: [],
    error:
      'Could not fetch Instagram video. Make sure the post is public and the URL is correct. Instagram may require login for some content.',
  };
}
