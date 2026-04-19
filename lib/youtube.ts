import type { VideoInfo, VideoFormat } from '@/types';
import { formatDuration } from './detect';
import { create } from 'youtube-dl-exec';
import path from 'path';
import { getCookiesPath } from './cookies';

// Fix for Next.js bundling path issues
const binaryPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp' + (process.platform === 'win32' ? '.exe' : ''));
const ytdl = create(binaryPath);

export async function getYouTubeInfo(url: string, baseUrl: string): Promise<VideoInfo> {
  try {
    const cookiesPath = getCookiesPath();
    const output = await ytdl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      ...(cookiesPath ? { cookies: cookiesPath } : {})
    }) as any;

    const formats: VideoFormat[] = [];

    if (output.formats && output.formats.length > 0) {
      // 1. Pre-muxed (Video + Audio) - maxes out at 720p on YouTube
      const preMuxed = output.formats.filter((f: any) => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4');
      for (const f of preMuxed) {
        formats.push({
          quality: f.height ? `${f.height}p` : 'Best',
          label: `${f.height ? `${f.height}p` : 'Best'} • MP4`,
          url: f.url,
          hasVideo: true,
          hasAudio: true,
          container: 'mp4',
        });
      }

      // 2. High-Res DASH (Video Only) - 1080p, 1440p, 2160p (4K)
      const dashVideo = output.formats.filter((f: any) => f.vcodec !== 'none' && f.acodec === 'none' && f.ext === 'mp4' && f.height > 720);
      for (const f of dashVideo) {
        formats.push({
          quality: `${f.height}p`,
          label: `${f.height}p • MP4 (No Audio)`,
          url: f.url,
          hasVideo: true,
          hasAudio: false,
          container: 'mp4',
        });
      }

      // 3. Audio Only
      const audioFormats = output.formats.filter((f: any) => f.vcodec === 'none' && f.acodec !== 'none');
      if (audioFormats.length > 0) {
        const bestAudio = audioFormats.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0))[0];
        formats.push({
          quality: 'Audio',
          label: `Audio Only • ${Math.round(bestAudio.abr || 128)}kbps`,
          url: bestAudio.url,
          isAudioOnly: true,
          hasVideo: false,
          hasAudio: true,
          container: bestAudio.ext || 'm4a',
        });
      }
    }

    if (formats.length === 0 && output.url) {
      formats.push({
        quality: 'Best',
        label: `Best Quality • ${output.ext?.toUpperCase() || 'MP4'}`,
        url: output.url,
        hasVideo: true,
        hasAudio: true,
        container: output.ext || 'mp4',
      });
    }

    if (formats.length === 0) {
      throw new Error('No downloadable formats found for this video.');
    }

    // Deduplicate by resolution and sort
    const uniqueFormats = Array.from(new Map(formats.map(item => [item.quality, item])).values());
    uniqueFormats.sort((a, b) => {
      if (a.quality === 'Audio') return 1;
      if (b.quality === 'Audio') return -1;
      const hA = parseInt(a.quality) || 0;
      const hB = parseInt(b.quality) || 0;
      return hB - hA;
    });

    return {
      originalUrl: url,
      platform: 'youtube',
      title: output.title || 'YouTube Video',
      thumbnail: output.thumbnail,
      duration: output.duration ? formatDuration(output.duration) : undefined,
      author: output.uploader,
      formats: uniqueFormats,
    };
  } catch (err: unknown) {
    console.error('youtube-dl-exec error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      originalUrl: url,
      platform: 'youtube',
      title: 'YouTube Video',
      formats: [],
      error: `Failed to fetch YouTube info: ${msg.split('\n')[0]}`,
    };
  }
}
