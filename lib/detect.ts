import type { Platform } from '@/types';

export function detectPlatform(url: string): Platform {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (
      host === 'youtube.com' ||
      host === 'youtu.be' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    ) {
      return 'youtube';
    }

    if (
      host === 'tiktok.com' ||
      host === 'vm.tiktok.com' ||
      host === 'vt.tiktok.com' ||
      host.endsWith('.tiktok.com')
    ) {
      return 'tiktok';
    }

    if (
      host === 'instagram.com' ||
      host === 'instagr.am' ||
      host.endsWith('.instagram.com')
    ) {
      return 'instagram';
    }

    if (
      host === 'facebook.com' ||
      host === 'fb.watch' ||
      host === 'fb.com' ||
      host.endsWith('.facebook.com')
    ) {
      return 'facebook';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
