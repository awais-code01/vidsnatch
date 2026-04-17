// eslint-disable-next-line @typescript-eslint/no-require-imports
const ytDlp = require('yt-dlp-exec') as (
  url: string,
  flags?: Record<string, unknown>
) => Promise<unknown>;
import type { VideoInfo, VideoFormat } from '@/types';
import { formatDuration, formatBytes } from './detect';

interface YtDlpFormat {
  format_id: string;
  format_note?: string;
  ext: string;
  url: string;
  width?: number;
  height?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  abr?: number;
  vbr?: number;
  filesize?: number;
  filesize_approx?: number;
  audio_ext?: string;
  video_ext?: string;
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
}

const QUALITY_ORDER = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];

export async function getYouTubeInfo(url: string): Promise<VideoInfo> {
  try {
    const result = (await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
      addHeaders: [
        'User-Agent:Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ],
    })) as unknown as YtDlpResult;

    const formats: VideoFormat[] = [];

    // Combined video+audio formats
    const combined = result.formats.filter(
      (f) =>
        f.vcodec !== 'none' &&
        f.acodec !== 'none' &&
        f.url &&
        !f.url.startsWith('manifest') &&
        f.ext !== 'mhtml'
    );

    // Deduplicate by height
    const seenHeight = new Set<number>();
    combined.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    for (const fmt of combined) {
      const h = fmt.height ?? 0;
      if (h > 0 && seenHeight.has(h)) continue;
      if (h > 0) seenHeight.add(h);

      const quality = h > 0 ? `${h}p` : fmt.format_note ?? 'Unknown';
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

    // Sort by quality order
    formats.sort((a, b) => {
      const ai = QUALITY_ORDER.indexOf(a.quality);
      const bi = QUALITY_ORDER.indexOf(b.quality);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    // Best audio-only format
    const audioFormats = result.formats.filter(
      (f) => f.vcodec === 'none' && f.acodec !== 'none' && f.url
    );
    if (audioFormats.length > 0) {
      const best = audioFormats.sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0];
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
      result.thumbnails?.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
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
