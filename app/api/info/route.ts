import { NextRequest, NextResponse } from 'next/server';
import { detectPlatform, isValidUrl } from '@/lib/detect';
import { getYouTubeInfo } from '@/lib/youtube';
import { getTikTokInfo } from '@/lib/tiktok';
import { getInstagramInfo } from '@/lib/instagram';
import { getFacebookInfo } from '@/lib/facebook';
import type { VideoInfo, InfoResponse } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

function getBaseUrl(request: NextRequest): string {
  // Prefer Vercel deployment URL env var
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Fallback: derive from request headers
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body as { urls: string[] };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Please provide at least one URL.' }, { status: 400 });
    }

    const limitedUrls = urls.slice(0, 10);
    const validUrls = limitedUrls.map((u) => u.trim()).filter((u) => u.length > 0 && isValidUrl(u));

    if (validUrls.length === 0) {
      return NextResponse.json({ error: 'No valid URLs found. Please check your input.' }, { status: 400 });
    }

    const baseUrl = getBaseUrl(request);

    const results: VideoInfo[] = await Promise.all(
      validUrls.map(async (url): Promise<VideoInfo> => {
        const platform = detectPlatform(url);
        try {
          switch (platform) {
            case 'youtube':   return await getYouTubeInfo(url, baseUrl);
            case 'tiktok':    return await getTikTokInfo(url);
            case 'instagram': return await getInstagramInfo(url);
            case 'facebook':  return await getFacebookInfo(url);
            default:
              return {
                originalUrl: url,
                platform: 'unknown',
                title: 'Unknown Platform',
                formats: [],
                error: 'Supported platforms: YouTube, TikTok, Instagram, Facebook.',
              };
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return { originalUrl: url, platform, title: 'Error', formats: [], error: message };
        }
      })
    );

    const response: InfoResponse = { results };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
