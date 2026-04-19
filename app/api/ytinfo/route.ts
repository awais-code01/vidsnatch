import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

type InnerTubeFormat = {
  itag: number;
  url?: string;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  contentLength?: string;
  averageBitrate?: number;
};

async function fetchInnerTube(videoId: string, clientName: string, clientVersion: string, clientData: Record<string, unknown>) {
  const body = {
    videoId,
    context: {
      client: {
        clientName,
        clientVersion,
        hl: 'en',
        gl: 'US',
        utcOffsetMinutes: 0,
        ...clientData,
      },
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: 'https://www.youtube.com',
    Referer: 'https://www.youtube.com/',
  };

  if (clientName === 'ANDROID') {
    headers['User-Agent'] = 'com.google.android.youtube/19.02.39 (Linux; U; Android 11) gzip';
    headers['X-Youtube-Client-Name'] = '3';
    headers['X-Youtube-Client-Version'] = clientVersion;
  } else {
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    headers['X-Youtube-Client-Name'] = '56';
    headers['X-Youtube-Client-Version'] = clientVersion;
  }

  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`InnerTube HTTP ${res.status}`);
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url?.trim()) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Could not extract video ID from URL' }, { status: 400 });
    }

    // Try Android client first — returns direct CDN URLs without cipher encryption
    let data: Record<string, unknown> | null = null;
    try {
      data = await fetchInnerTube(videoId, 'ANDROID', '19.02.39', {
        androidSdkVersion: 30,
        userAgent: 'com.google.android.youtube/19.02.39 (Linux; U; Android 11) gzip',
      });
    } catch { /* fall through to web client */ }

    // Fall back to TVHTML5_SIMPLY_EMBEDDED_PLAYER — also returns direct URLs
    if (!data || (data.playabilityStatus as Record<string, unknown>)?.status !== 'OK') {
      try {
        data = await fetchInnerTube(videoId, 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', '2.0', {
          clientScreen: 'EMBED',
        });
      } catch { /* ignore */ }
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to contact YouTube API' }, { status: 502 });
    }

    const ps = data?.playabilityStatus as Record<string, unknown> | undefined;
    const status = ps?.status as string | undefined;
    if (status && status !== 'OK') {
      const reason = ps?.reason as string | undefined;
      return NextResponse.json({ error: reason ?? `Video unavailable (${status})` }, { status: 403 });
    }

    const vd = (data?.videoDetails ?? {}) as Record<string, unknown>;
    const sd = (data?.streamingData ?? {}) as Record<string, unknown>;

    const muxed = (sd.formats ?? []) as InnerTubeFormat[];
    const adaptive = (sd.adaptiveFormats ?? []) as InnerTubeFormat[];

    const formats = [...muxed, ...adaptive]
      .filter((f) => f.url && !f.url.includes('manifest'))
      .map((f) => {
        const mime = f.mimeType ?? '';
        const ext = mime.split('/')[1]?.split(';')[0] ?? 'mp4';
        const hasV = f.width != null;
        const hasA = mime.includes('mp4a') || mime.includes('opus') || !hasV;
        return {
          format_id: String(f.itag),
          ext,
          url: f.url!,
          height: f.height,
          width: f.width,
          vcodec: hasV ? 'avc1' : 'none',
          acodec: hasA ? 'mp4a' : 'none',
          tbr: f.bitrate != null ? f.bitrate / 1000 : undefined,
          abr: f.averageBitrate != null ? f.averageBitrate / 1000 : undefined,
          filesize: f.contentLength != null ? Number(f.contentLength) : undefined,
        };
      });

    const thumbnails = (
      ((vd.thumbnail as Record<string, unknown>)?.thumbnails as Array<{
        url: string;
        width?: number;
        height?: number;
      }>) ?? []
    ).sort((a, b) => (b.width ?? 0) - (a.width ?? 0));

    return NextResponse.json({
      id: videoId,
      title: (vd.title as string) ?? 'YouTube Video',
      thumbnail: thumbnails[0]?.url,
      thumbnails,
      duration: vd.lengthSeconds ? Number(vd.lengthSeconds) : undefined,
      uploader: vd.author as string | undefined,
      channel: vd.author as string | undefined,
      formats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
