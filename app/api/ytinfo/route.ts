import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function mimeToExt(mime: string): string {
  const base = mime.split('/')[1]?.split(';')[0] ?? '';
  return base === 'webm' ? 'webm' : 'mp4';
}

type RawFmt = {
  itag?: number;
  mime_type?: string;
  url?: string;
  decipher?: (player: unknown) => string;
  bitrate?: number;
  average_bitrate?: number;
  width?: number;
  height?: number;
  content_length?: string | number;
};

function getFmtUrl(fmt: RawFmt, player: unknown): string {
  if (fmt.url) return fmt.url;
  if (typeof fmt.decipher === 'function' && player) {
    try { return fmt.decipher(player); } catch { /* fall through */ }
  }
  return '';
}

function buildFormat(fmt: RawFmt, player: unknown) {
  const mime = fmt.mime_type ?? '';
  const url = getFmtUrl(fmt, player);
  if (!url || url.includes('manifest')) return null;
  return {
    format_id: String(fmt.itag ?? ''),
    ext: mimeToExt(mime),
    url,
    height: typeof fmt.height === 'number' ? fmt.height : undefined,
    width: typeof fmt.width === 'number' ? fmt.width : undefined,
    vcodec: fmt.width != null ? 'avc1' : 'none',
    acodec: mime.includes('mp4a') || mime.includes('opus') ? 'mp4a' : 'none',
    tbr: typeof fmt.bitrate === 'number' ? fmt.bitrate / 1000 : undefined,
    abr: typeof fmt.average_bitrate === 'number' ? fmt.average_bitrate / 1000 : undefined,
    filesize: fmt.content_length != null ? Number(fmt.content_length) : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url?.trim()) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const yt = await Innertube.create({ generate_session_locally: true });
    const info = await yt.getBasicInfo(url);

    if (!info.basic_info?.id) {
      return NextResponse.json({ error: 'Video not found or unavailable' }, { status: 404 });
    }

    const sd = info.streaming_data;
    if (!sd) {
      return NextResponse.json({ error: 'No streaming data available' }, { status: 404 });
    }

    const player = yt.session.player;
    const formats = [...sd.formats, ...sd.adaptive_formats]
      .map((f) => buildFormat(f as unknown as RawFmt, player))
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const thumbnails = (info.basic_info.thumbnail ?? [])
      .map((t) => ({ url: t.url, width: t.width, height: t.height }))
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));

    return NextResponse.json({
      id: info.basic_info.id,
      title: info.basic_info.title ?? 'YouTube Video',
      thumbnail: thumbnails[0]?.url,
      thumbnails,
      duration: info.basic_info.duration,
      uploader: info.basic_info.author,
      channel: info.basic_info.author,
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
