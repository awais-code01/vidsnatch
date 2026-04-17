import type { VideoInfo } from '@/types';

interface TikWMResponse {
  code: number;
  msg: string;
  data?: {
    id: string;
    title: string;
    cover: string;
    origin_cover: string;
    duration: number;
    play: string;
    hdplay: string;
    wmplay: string;
    music: string;
    music_info?: {
      title: string;
      author: string;
    };
    author?: {
      nickname: string;
    };
  };
}

export async function getTikTokInfo(url: string): Promise<VideoInfo> {
  try {
    // Resolve short URLs (vm.tiktok.com) by following redirects
    let resolvedUrl = url;
    const parsed = new URL(url);
    if (parsed.hostname === 'vm.tiktok.com' || parsed.hostname === 'vt.tiktok.com') {
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        resolvedUrl = res.url || url;
      } catch {
        // keep original
      }
    }

    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}&hd=1`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.tikwm.com/',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`TikWM API responded with status ${response.status}`);
    }

    const data: TikWMResponse = await response.json();

    if (data.code !== 0 || !data.data) {
      throw new Error(data.msg || 'TikTok API returned no data');
    }

    const video = data.data;
    const formats = [];

    if (video.hdplay) {
      formats.push({
        quality: 'HD',
        label: 'HD • No Watermark • MP4',
        url: video.hdplay,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
      });
    }

    if (video.play) {
      formats.push({
        quality: 'SD',
        label: 'SD • No Watermark • MP4',
        url: video.play,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
      });
    }

    if (video.wmplay) {
      formats.push({
        quality: 'Watermark',
        label: 'SD • With Watermark • MP4',
        url: video.wmplay,
        hasVideo: true,
        hasAudio: true,
        container: 'mp4',
      });
    }

    if (video.music) {
      formats.push({
        quality: 'Audio',
        label: `Audio • ${video.music_info?.title || 'Music'} • MP3`,
        url: video.music,
        isAudioOnly: true,
        hasVideo: false,
        hasAudio: true,
        container: 'mp3',
      });
    }

    const durationSec = video.duration || 0;
    const duration =
      durationSec > 0
        ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`
        : undefined;

    return {
      originalUrl: url,
      platform: 'tiktok',
      title: video.title || 'TikTok Video',
      thumbnail: video.origin_cover || video.cover,
      duration,
      author: video.author?.nickname,
      formats,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      originalUrl: url,
      platform: 'tiktok',
      title: 'TikTok Video',
      formats: [],
      error: `Failed to fetch TikTok info: ${message}`,
    };
  }
}
