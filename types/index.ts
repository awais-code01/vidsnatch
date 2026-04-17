export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'unknown';

export interface VideoFormat {
  quality: string;
  label: string;
  url: string;
  mimeType?: string;
  size?: string;
  isAudioOnly?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  container?: string;
  itag?: number;
}

export interface VideoInfo {
  originalUrl: string;
  platform: Platform;
  title: string;
  thumbnail?: string;
  duration?: string;
  author?: string;
  formats: VideoFormat[];
  error?: string;
}

export interface InfoRequest {
  urls: string[];
}

export interface InfoResponse {
  results: VideoInfo[];
}
