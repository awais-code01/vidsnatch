'use client';

import { useState, useRef, useCallback } from 'react';
import type { VideoInfo, VideoFormat } from '@/types';
import Image from 'next/image';

/* ─────────────── helpers ─────────────── */

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.31 6.31 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
          <circle cx="12" cy="12" r="10" />
          <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function getPlatformColors(platform: string): { bg: string; text: string; border: string } {
  switch (platform) {
    case 'youtube':
      return { bg: 'bg-red-600', text: 'text-red-400', border: 'border-red-500/30' };
    case 'tiktok':
      return { bg: 'bg-zinc-800', text: 'text-cyan-400', border: 'border-cyan-500/30' };
    case 'instagram':
      return { bg: 'bg-gradient-to-r from-purple-600 to-pink-600', text: 'text-pink-400', border: 'border-pink-500/30' };
    case 'facebook':
      return { bg: 'bg-blue-600', text: 'text-blue-400', border: 'border-blue-500/30' };
    default:
      return { bg: 'bg-zinc-600', text: 'text-zinc-400', border: 'border-zinc-500/30' };
  }
}

function getQualityColor(quality: string): string {
  const q = quality.toLowerCase();
  if (q.includes('2160') || q.includes('4k')) return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
  if (q.includes('1440')) return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
  if (q.includes('1080')) return 'text-green-400 bg-green-400/10 border-green-400/30';
  if (q.includes('720') || q === 'hd') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
  if (q.includes('audio') || q === 'audio only') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
  return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_').slice(0, 100);
}

/* ─────────────── Download button ─────────────── */

function DownloadButton({ format, title }: { format: VideoFormat; title: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const ext = format.isAudioOnly ? 'mp3' : format.container || 'mp4';
  const filename = `${sanitizeFilename(title)}_${format.quality}.${ext}`;

  const handleDownload = useCallback(async () => {
    if (state === 'loading') return;
    setState('loading');
    setErrorMsg('');

    try {
      // Try direct download via anchor tag first
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(format.url)}&filename=${encodeURIComponent(filename)}`;

      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setState('done');
      setTimeout(() => setState('idle'), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setErrorMsg(msg);
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  }, [format.url, filename, state]);

  const qualityClass = getQualityColor(format.quality);

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleDownload}
        disabled={state === 'loading'}
        className={`
          group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
          border transition-all duration-200 download-btn
          ${state === 'idle' ? 'bg-zinc-800/80 hover:bg-zinc-700 border-zinc-700 hover:border-zinc-500 text-white' : ''}
          ${state === 'loading' ? 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 cursor-not-allowed' : ''}
          ${state === 'done' ? 'bg-green-900/30 border-green-500/40 text-green-400' : ''}
          ${state === 'error' ? 'bg-red-900/30 border-red-500/40 text-red-400' : ''}
        `}
      >
        {/* Quality badge */}
        <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${qualityClass}`}>
          {format.quality}
        </span>

        {/* Label */}
        <span className="flex-1 text-left truncate text-xs text-zinc-300">
          {format.label}
        </span>

        {/* Size */}
        {format.size && (
          <span className="text-xs text-zinc-500 shrink-0">{format.size}</span>
        )}

        {/* Icon */}
        <span className="shrink-0">
          {state === 'idle' && (
            <svg className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {state === 'loading' && (
            <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {state === 'done' && (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {state === 'error' && (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </span>
      </button>
      {state === 'error' && errorMsg && (
        <p className="text-xs text-red-400 px-1">{errorMsg}</p>
      )}
    </div>
  );
}

/* ─────────────── Video result card ─────────────── */

function VideoCard({ info }: { info: VideoInfo }) {
  const colors = getPlatformColors(info.platform);
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`
      rounded-2xl border overflow-hidden bg-zinc-900/60 backdrop-blur-sm
      animate-slide-up ${colors.border} hover:border-zinc-600 transition-all duration-300
    `}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-zinc-800 overflow-hidden">
        {info.thumbnail && !imgError ? (
          <Image
            src={info.thumbnail}
            alt={info.title}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className={`${colors.text} opacity-30`}>
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        )}
        {/* Platform badge */}
        <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-white text-xs font-semibold ${colors.bg}`}>
          {getPlatformIcon(info.platform)}
          <span className="capitalize">{info.platform}</span>
        </div>
        {/* Duration badge */}
        {info.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded-md font-mono">
            {info.duration}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 mb-1">
          {info.title}
        </h3>
        {info.author && (
          <p className="text-xs text-zinc-400 mb-3">{info.author}</p>
        )}
        <a
          href={info.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-300 truncate block transition-colors mb-3"
        >
          {info.originalUrl.length > 55 ? info.originalUrl.slice(0, 55) + '…' : info.originalUrl}
        </a>

        {/* Error */}
        {info.error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30 mb-3">
            <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-red-300">{info.error}</p>
          </div>
        )}

        {/* Formats */}
        {info.formats.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {info.formats.length} format{info.formats.length !== 1 ? 's' : ''} available
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {info.formats.map((fmt, i) => (
                <DownloadButton key={i} format={fmt} title={info.title} />
              ))}
            </div>
          </div>
        )}

        {!info.error && info.formats.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-2">No downloadable formats found.</p>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Supported platforms badge ─────────────── */

function PlatformBadge({ name, icon, color }: { name: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${color} bg-zinc-900 border border-zinc-800`}>
      {icon}
      {name}
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VideoInfo[]>([]);
  const [globalError, setGlobalError] = useState('');
  const [processed, setProcessed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const urls = input
      .split(/\n|,/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) {
      setGlobalError('Please enter at least one video URL.');
      return;
    }

    if (urls.length > 10) {
      setGlobalError('Maximum 10 URLs at once. Please reduce the number of URLs.');
      return;
    }

    setLoading(true);
    setGlobalError('');
    setResults([]);
    setProcessed(false);

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGlobalError(data.error || 'Something went wrong.');
        return;
      }

      setResults(data.results || []);
      setProcessed(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error. Please try again.';
      setGlobalError(msg);
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleClear = () => {
    setInput('');
    setResults([]);
    setGlobalError('');
    setProcessed(false);
    textareaRef.current?.focus();
  };

  const urlCount = input
    .split(/\n|,/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0).length;

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/2 w-96 h-96 bg-cyan-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Free — No signup required
          </div>

          <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Vid<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Snatch</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Download videos from YouTube, TikTok, Instagram & Facebook.
            Paste multiple links, get all downloads at once.
          </p>

          {/* Platform badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <PlatformBadge
              name="YouTube"
              color="text-red-400"
              icon={getPlatformIcon('youtube')}
            />
            <PlatformBadge
              name="TikTok"
              color="text-cyan-400"
              icon={getPlatformIcon('tiktok')}
            />
            <PlatformBadge
              name="Instagram"
              color="text-pink-400"
              icon={getPlatformIcon('instagram')}
            />
            <PlatformBadge
              name="Facebook"
              color="text-blue-400"
              icon={getPlatformIcon('facebook')}
            />
          </div>
        </div>

        {/* Input form */}
        <div className="glass rounded-2xl p-6 mb-8 border border-zinc-800">
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Paste video URL(s) — one per line or comma-separated
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setGlobalError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder={`https://www.youtube.com/watch?v=...\nhttps://www.tiktok.com/@user/video/...\nhttps://www.instagram.com/reel/...\nhttps://www.facebook.com/watch/...`}
                rows={5}
                className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono"
                disabled={loading}
              />
              {input && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-700/80 hover:bg-zinc-600 text-zinc-400 hover:text-white transition-all"
                  title="Clear"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* URL count indicator */}
            {urlCount > 0 && (
              <p className="text-xs text-zinc-500 mt-1.5">
                {urlCount} URL{urlCount !== 1 ? 's' : ''} detected
                {urlCount > 10 && (
                  <span className="text-orange-400 ml-1">(max 10 — first 10 will be processed)</span>
                )}
              </p>
            )}

            {/* Error */}
            {globalError && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-300">{globalError}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-900/30 hover:shadow-blue-800/40"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Fetching video info…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Fetch &amp; Download
                  </>
                )}
              </button>

              {processed && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-3 rounded-xl font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 transition-all duration-200"
                >
                  Clear
                </button>
              )}
            </div>

            <p className="text-xs text-zinc-600 mt-2 text-center">
              Ctrl+Enter to submit quickly
            </p>
          </form>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[...Array(Math.min(urlCount || 1, 4))].map((_, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-900/60 animate-pulse">
                <div className="aspect-video bg-zinc-800" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  <div className="space-y-2 mt-4">
                    <div className="h-9 bg-zinc-800 rounded-lg" />
                    <div className="h-9 bg-zinc-800 rounded-lg" />
                    <div className="h-9 bg-zinc-800 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                {results.length} video{results.length !== 1 ? 's' : ''} found
              </h2>
              <span className="text-sm text-zinc-500">
                {results.filter((r) => r.formats.length > 0).length} ready to download
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((info, i) => (
                <VideoCard key={i} info={info} />
              ))}
            </div>
          </>
        )}

        {/* How to use */}
        {!processed && !loading && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ),
                title: '1. Paste URLs',
                desc: 'Copy any video link from YouTube, TikTok, Instagram, or Facebook and paste it in the box above.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
                title: '2. Fetch Info',
                desc: 'Click "Fetch & Download" and we\'ll retrieve all available formats and qualities for your videos.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                ),
                title: '3. Download',
                desc: 'Choose your preferred quality and hit download. Works for single videos or bulk downloads.',
              },
            ].map((step, i) => (
              <div key={i} className="glass rounded-xl p-5 border border-zinc-800">
                <div className="text-blue-400 mb-3">{step.icon}</div>
                <h3 className="font-semibold text-white text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-zinc-600 space-y-1">
          <p>VidSnatch — For personal, non-commercial use only.</p>
          <p>Respect copyright. Only download videos you own or have permission to download.</p>
        </footer>
      </div>
    </main>
  );
}
