import fs from 'fs';
import path from 'path';
import os from 'os';

export function getCookiesPath(): string | undefined {
  // 1. Check for local cookies.txt file
  const localCookiesPath = path.join(process.cwd(), 'cookies.txt');
  if (fs.existsSync(localCookiesPath)) {
    return localCookiesPath;
  }

  // 2. Check for Vercel Environment Variable (useful for production)
  if (process.env.YTDLP_COOKIES) {
    const tmpCookiesPath = path.join(os.tmpdir(), 'ytdlp_cookies.txt');
    // Write only if it doesn't exist or is outdated
    try {
      fs.writeFileSync(tmpCookiesPath, process.env.YTDLP_COOKIES, 'utf-8');
      return tmpCookiesPath;
    } catch (err) {
      console.error('Failed to write temp cookies.txt from environment variable:', err);
    }
  }

  return undefined;
}
