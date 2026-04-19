import type { VideoInfo, VideoFormat } from '@/types';
import { create } from 'youtube-dl-exec';
import path from 'path';
import { snapsave } from 'snapsave-media-downloader';
import { getCookiesPath } from './cookies';

const binaryPath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp' + (process.platform === 'win32' ? '.exe' : ''));
const ytdl = create(binaryPath);

export async function getInstagramInfo(url: string): Promise<VideoInfo> {
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
      platform: 'instagram',
      title: output.title || output.description || 'Instagram Video',
      thumbnail: output.thumbnail,
      author: output.uploader,
      formats,
    };
  } catch (err: unknown) {
    console.error('Instagram yt-dlp error, attempting snapsave fallback...');
    
    // THE HACK: Fallback to SnapSave's unofficial API proxy
    try {
      const snapResult = await snapsave(url) as any;
      if (snapResult && snapResult.success && snapResult.data && snapResult.data.length > 0) {
        return {
          originalUrl: url,
          platform: 'instagram',
          title: 'Instagram Reel (SnapSave)',
          thumbnail: snapResult.data[0].thumbnail,
          formats: snapResult.data.map((f: any) => ({
            quality: f.resolution || 'Best',
            label: `${f.resolution || 'Best'} • MP4`,
            url: f.url,
            hasVideo: true,
            hasAudio: true,
            container: 'mp4',
          })),
        };
      }
    } catch (fallbackErr) {
      console.error('SnapSave fallback failed:', fallbackErr);
    }

    return {
      originalUrl: url,
      platform: 'instagram',
      title: 'Instagram Video',
      formats: [],
      error: 'Could not extract video URL. Meta blocks anonymous requests, and third-party proxies are currently rejecting the connection.',
    };
  }
}


