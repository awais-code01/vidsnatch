import { Innertube } from 'youtubei.js';
import type { VideoInfo, VideoFormat } from '@/types';
import { formatDuration, formatBytes } from './detect';

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/v\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function getYouTubeInfo(url: string): Promise<VideoInfo> {
  const videoId = extractVideoId(url);

  if (!videoId) {
    return {
      originalUrl: url,
      platform: 'youtube',
      title: 'YouTube Video',
      formats: [],
      error: 'Could not extract video ID from URL. Make sure the URL is a valid YouTube video link.',
    };
  }

  try {
    const yt = await Innertube.create({
      lang: 'en',
      location: 'US',
      retrieve_player: true,
      generate_session_locally: true,
      fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
    });

    const info = await yt.getInfo(videoId);
    const basic = info.basic_info;
    const streaming = info.streaming_data;

    if (!streaming) {
      throw new Error('No streaming data available for this video.');
    }

    const formats: VideoFormat[] = [];

    // Combined video+audio formats (muxed)
    const muxed = streaming.formats ?? [];
    const qualityOrder = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
    muxed.sort((a, b) => {
      const al = (a as { quality_label?: string }).quality_label ?? '';
      const bl = (b as { quality_label?: string }).quality_label ?? '';
      return (qualityOrder.indexOf(al) === -1 ? 99 : qualityOrder.indexOf(al)) -
             (qualityOrder.indexOf(bl) === -1 ? 99 : qualityOrder.indexOf(bl));
    });

    const seenMuxed = new Set<string>();
    for (const fmt of muxed) {
      const f = fmt as Record<string, unknown>;
      const label = (f.quality_label as string) ?? 'Unknown';
      if (seenMuxed.has(label)) continue;
      seenMuxed.add(label);

      const rawUrl = f.url as string | undefined;
      if (!rawUrl) continue;

      const size = f.content_length
        ? formatBytes(Number(f.content_length))
        : undefined;

      formats.push({
        quality: label,
        label: `${label} • MP4 • Video+Audio`,
        url: rawUrl,
        mimeType: f.mime_type as string | undefined,
        size,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
      });
    }

    // Adaptive (video-only) — top 3 unique qualities
    const adaptive = streaming.adaptive_formats ?? [];
    const videoOnly = adaptive.filter((f) => {
      const fObj = f as Record<string, unknown>;
      const mime = (fObj.mime_type as string) ?? '';
      return mime.startsWith('video/') && fObj.url;
    });
    videoOnly.sort((a, b) => {
      const al = ((a as Record<string, unknown>).quality_label as string) ?? '';
      const bl = ((b as Record<string, unknown>).quality_label as string) ?? '';
      return (qualityOrder.indexOf(al) === -1 ? 99 : qualityOrder.indexOf(al)) -
             (qualityOrder.indexOf(bl) === -1 ? 99 : qualityOrder.indexOf(bl));
    });
    const seenVideo = new Set<string>();
    for (const fmt of videoOnly.slice(0, 5)) {
      const f = fmt as Record<string, unknown>;
      const label = (f.quality_label as string) ?? 'Unknown';
      if (seenVideo.has(label)) continue;
      seenVideo.add(label);
      formats.push({
        quality: label,
        label: `${label} • Video Only (No Audio)`,
        url: f.url as string,
        mimeType: f.mime_type as string | undefined,
        hasVideo: true,
        hasAudio: false,
      });
    }

    // Best audio-only format
    const audioOnly = adaptive.filter((f) => {
      const fObj = f as Record<string, unknown>;
      const mime = (fObj.mime_type as string) ?? '';
      return mime.startsWith('audio/') && fObj.url;
    });
    if (audioOnly.length > 0) {
      const best = audioOnly.sort(
        (a, b) =>
          ((b as Record<string, unknown>).bitrate as number ?? 0) -
          ((a as Record<string, unknown>).bitrate as number ?? 0)
      )[0] as Record<string, unknown>;

      const bitrate = best.bitrate
        ? `${Math.round((best.bitrate as number) / 1000)}kbps`
        : 'Best';

      formats.push({
        quality: 'Audio',
        label: `Audio Only • ${bitrate} • AAC`,
        url: best.url as string,
        mimeType: best.mime_type as string | undefined,
        size: best.content_length
          ? formatBytes(Number(best.content_length))
          : undefined,
        isAudioOnly: true,
        hasVideo: false,
        hasAudio: true,
      });
    }

    if (formats.length === 0) {
      throw new Error('No downloadable formats found for this video.');
    }

    const thumbs = (basic.thumbnail as Array<{ url: string; width?: number }>) ?? [];
    const thumb = thumbs.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;

    return {
      originalUrl: url,
      platform: 'youtube',
      title: (basic.title as string) ?? 'YouTube Video',
      thumbnail: thumb,
      duration: basic.duration ? formatDuration(basic.duration as number) : undefined,
      author: basic.author as string | undefined,
      formats,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      originalUrl: url,
      platform: 'youtube',
      title: 'YouTube Video',
      formats: [],
      error: `Failed to fetch YouTube info: ${message}`,
    };
  }
}
