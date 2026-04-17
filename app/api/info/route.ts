import { NextRequest, NextResponse } from 'next/server';
import { detectPlatform, isValidUrl } from '@/lib/detect';
import { getYouTubeInfo } from '@/lib/youtube';
import { getTikTokInfo } from '@/lib/tiktok';
import { getInstagramInfo } from '@/lib/instagram';
import { getFacebookInfo } from '@/lib/facebook';
import type { VideoInfo, InfoResponse } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body as { urls: string[] };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'Please provide at least one URL.' },
        { status: 400 }
      );
    }

    // Limit to 10 URLs at once
    const limitedUrls = urls.slice(0, 10);

    const validUrls = limitedUrls
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && isValidUrl(u));

    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: 'No valid URLs found. Please check your input.' },
        { status: 400 }
      );
    }

    // Process all URLs in parallel
    const results: VideoInfo[] = await Promise.all(
      validUrls.map(async (url): Promise<VideoInfo> => {
        const platform = detectPlatform(url);

        try {
          switch (platform) {
            case 'youtube':
              return await getYouTubeInfo(url);
            case 'tiktok':
              return await getTikTokInfo(url);
            case 'instagram':
              return await getInstagramInfo(url);
            case 'facebook':
              return await getFacebookInfo(url);
            default:
              return {
                originalUrl: url,
                platform: 'unknown',
                title: 'Unknown Platform',
                formats: [],
                error:
                  'This platform is not supported. Supported: YouTube, TikTok, Instagram, Facebook.',
              };
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            originalUrl: url,
            platform,
            title: 'Error',
            formats: [],
            error: `Unexpected error: ${message}`,
          };
        }
      })
    );

    const response: InfoResponse = { results };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Server error: ${message}` },
      { status: 500 }
    );
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
