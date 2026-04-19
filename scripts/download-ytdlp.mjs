import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import https from 'https';

const platform = process.platform;
const binDir = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (platform === 'linux') {
    console.log('Detected Linux. Downloading standalone yt-dlp_linux binary to bypass Python requirement on Vercel...');
    const binPath = path.join(binDir, 'yt-dlp');
    
    try {
      await downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux', binPath);
      fs.chmodSync(binPath, '755');
      console.log('Successfully installed standalone yt-dlp binary for Linux.');
    } catch (e) {
      console.error('Failed to download yt-dlp_linux:', e);
    }
  } else {
    console.log(`Platform is ${platform}. Skipping custom yt-dlp download.`);
  }
}

main();
