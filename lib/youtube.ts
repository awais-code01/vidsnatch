import type { VideoInfo, VideoFormat } from '@/types';
import { formatDuration, formatBytes } from './detect';

interface YtDlpFormat {
  format_id: string;
  ext: string;
  url: string;
  height?: number;
  width?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  abr?: number;
  filesize?: number;
  filesize_approx?: number;
}

interface YtDlpResult {
  id: string;
  title: string;
  thumbnail?: string;
  thumbnails?: Array<{ url: string; width?: number; height?: number }>;
  uploader?: string;
  channel?: string;
  duration?: number;
  formats: YtDlpFormat[];
  error?: string;
}

const QUALITY_ORDER = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];

export async function getYouTubeInfo(url: string, baseUrl: string): Promise<VideoInfo> {
  try {
    const res = await fetch(`${baseUrl}/api/ytinfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(55_000),
    });

    const result: YtDlpResult = await res.json();

    if (!res.ok || result.error) {
      throw new Error(result.error ?? `HTTP ${res.status}`);
    }

    const formats: VideoFormat[] = [];

    // Combined video+audio
    const combined = result.formats.filter(
      (f) => f.vcodec !== 'none' && f.acodec !== 'none' && f.url
    );
    combined.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

    const seenH = new Set<number>();
    for (const fmt of combined) {
      const h = fmt.height ?? 0;
      if (h > 0 && seenH.has(h)) continue;
      if (h > 0) seenH.add(h);
      const quality = h > 0 ? `${h}p` : 'Best';
      const size = fmt.filesize ?? fmt.filesize_approx;
      formats.push({
        quality,
        label: `${quality} • ${fmt.ext.toUpperCase()} • Video+Audio`,
        url: fmt.url,
        size: size ? formatBytes(size) : undefined,
        hasVideo: true,
        hasAudio: true,
        container: fmt.ext,
      });
    }

    // Sort by known quality order
    formats.sort((a, b) => {
      const ai = QUALITY_ORDER.indexOf(a.quality);
      const bi = QUALITY_ORDER.indexOf(b.quality);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    // Best audio-only
    const audioOnly = result.formats.filter(
      (f) => f.vcodec === 'none' && f.acodec !== 'none' && f.url
    );
    if (audioOnly.length > 0) {
      const best = audioOnly.sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0];
      formats.push({
        quality: 'Audio',
        label: `Audio Only • ${best.abr ? `${Math.round(best.abr)}kbps` : 'Best'} • ${best.ext.toUpperCase()}`,
        url: best.url,
        isAudioOnly: true,
        hasVideo: false,
        hasAudio: true,
        container: best.ext,
      });
    }

    if (formats.length === 0) {
      throw new Error('No downloadable formats found for this video.');
    }

    const thumb =
      (result.thumbnails ?? []).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
      result.thumbnail;

    return {
      originalUrl: url,
      platform: 'youtube',
      title: result.title,
      thumbnail: thumb,
      duration: result.duration ? formatDuration(result.duration) : undefined,
      author: result.channel ?? result.uploader,
      formats,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      originalUrl: url,
      platform: 'youtube',
      title: 'YouTube Video',
      formats: [],
      error: `Failed to fetch YouTube info: ${msg}`,
    };
  }
}
