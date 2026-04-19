import type { VideoInfo, VideoFormat } from '@/types';
import { create } from 'youtube-dl-exec';
import path from 'path';
import { getCookiesPath } from './cookies';

const binaryPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp' + (process.platform === 'win32' ? '.exe' : ''));
const ytdl = create(binaryPath);

export async function getFacebookInfo(url: string): Promise<VideoInfo> {
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
      const videoFormats = output.formats.filter((f: any) => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4');
      
      for (const f of videoFormats) {
        formats.push({
          quality: f.height ? `${f.height}p` : 'Best',
          label: `${f.height ? `${f.height}p` : 'Best'} • MP4`,
          url: f.url,
          hasVideo: true,
          hasAudio: true,
          container: 'mp4',
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

    return {
      originalUrl: url,
      platform: 'facebook',
      title: output.title || output.description || 'Facebook Video',
      thumbnail: output.thumbnail,
      author: output.uploader,
      formats,
    };
  } catch (err: unknown) {
    console.error('Facebook yt-dlp error:', err);
    return {
      originalUrl: url,
      platform: 'facebook',
      title: 'Facebook Video',
      formats: [],
      error: 'Could not extract video URL. Make sure the video is public. Meta frequently blocks requests without a login cookie.',
    };
  }
}

