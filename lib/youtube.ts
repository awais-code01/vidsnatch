import ytdl from '@distube/ytdl-core';
import type { VideoInfo, VideoFormat } from '@/types';
import { formatDuration, formatBytes } from './detect';

export async function getYouTubeInfo(url: string): Promise<VideoInfo> {
  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    });

    const details = info.videoDetails;
    const allFormats = info.formats;

    // Separate combined (video+audio), video-only, and audio-only formats
    const combined = allFormats.filter(
      (f) => f.hasVideo && f.hasAudio && f.qualityLabel
    );
    const videoOnly = allFormats.filter(
      (f) => f.hasVideo && !f.hasAudio && f.qualityLabel
    );
    const audioOnly = allFormats.filter(
      (f) => !f.hasVideo && f.hasAudio
    );

    // Sort combined by quality descending
    const qualityOrder = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
    combined.sort((a, b) => {
      const ai = qualityOrder.indexOf(a.qualityLabel || '');
      const bi = qualityOrder.indexOf(b.qualityLabel || '');
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    // Deduplicate combined by quality label
    const seen = new Set<string>();
    const dedupedCombined = combined.filter((f) => {
      const key = f.qualityLabel || '';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const formats: VideoFormat[] = [];

    // Add combined formats
    for (const f of dedupedCombined) {
      formats.push({
        quality: f.qualityLabel || 'Unknown',
        label: `${f.qualityLabel} • MP4 • Video+Audio`,
        url: f.url,
        mimeType: f.mimeType,
        size: f.contentLength ? formatBytes(Number(f.contentLength)) : undefined,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
        itag: f.itag,
      });
    }

    // Add best video-only (adaptive) formats
    const seenVideo = new Set<string>();
    for (const f of videoOnly.slice(0, 4)) {
      const key = f.qualityLabel || '';
      if (seenVideo.has(key)) continue;
      seenVideo.add(key);
      formats.push({
        quality: f.qualityLabel || 'Unknown',
        label: `${f.qualityLabel} • Video Only (No Audio)`,
        url: f.url,
        mimeType: f.mimeType,
        size: f.contentLength ? formatBytes(Number(f.contentLength)) : undefined,
        hasVideo: true,
        hasAudio: false,
        itag: f.itag,
      });
    }

    // Add best audio format
    if (audioOnly.length > 0) {
      const bestAudio = audioOnly
        .filter((f) => f.audioBitrate)
        .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
      if (bestAudio) {
        formats.push({
          quality: `${bestAudio.audioBitrate}kbps`,
          label: `Audio Only • ${bestAudio.audioBitrate}kbps • MP3/AAC`,
          url: bestAudio.url,
          mimeType: bestAudio.mimeType,
          size: bestAudio.contentLength
            ? formatBytes(Number(bestAudio.contentLength))
            : undefined,
          isAudioOnly: true,
          hasVideo: false,
          hasAudio: true,
          itag: bestAudio.itag,
        });
      }
    }

    return {
      originalUrl: url,
      platform: 'youtube',
      title: details.title,
      thumbnail:
        details.thumbnails?.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url ||
        details.thumbnails?.[0]?.url,
      duration: details.lengthSeconds ? formatDuration(Number(details.lengthSeconds)) : undefined,
      author: details.author?.name,
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
