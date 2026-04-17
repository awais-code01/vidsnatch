#!/usr/bin/env node
/**
 * Downloads the correct yt-dlp binary for the current platform.
 * Run this as part of the Vercel build step to ensure the Linux binary is present.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BIN_DIR = path.join(__dirname, '..', 'node_modules', 'yt-dlp-exec', 'bin');
const IS_WINDOWS = process.platform === 'win32';
const BINARY_NAME = IS_WINDOWS ? 'yt-dlp.exe' : 'yt-dlp';
const BINARY_PATH = path.join(BIN_DIR, BINARY_NAME);

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'vidsnatch-builder/1.0',
        Accept: 'application/json',
      },
    };
    https.get(url, options, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${data.slice(0, 200)}`));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, { headers: { 'User-Agent': 'vidsnatch-builder/1.0' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} downloading binary`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  // Check if we already have a valid binary
  if (fs.existsSync(BINARY_PATH)) {
    const size = fs.statSync(BINARY_PATH).size;
    if (size > 1_000_000) {
      console.log(`yt-dlp binary already present at ${BINARY_PATH} (${(size / 1e6).toFixed(1)} MB)`);
      return;
    }
  }

  console.log('Fetching latest yt-dlp release info...');
  const release = await fetchJSON(
    'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'
  );

  // Pick the right asset
  const assetName = IS_WINDOWS ? 'yt-dlp.exe' : 'yt-dlp';
  const asset = release.assets.find((a) => a.name === assetName);
  if (!asset) {
    throw new Error(`Could not find asset "${assetName}" in release. Available: ${release.assets.map((a) => a.name).join(', ')}`);
  }

  console.log(`Downloading ${assetName} v${release.tag_name} (${(asset.size / 1e6).toFixed(1)} MB)...`);
  fs.mkdirSync(BIN_DIR, { recursive: true });
  await downloadFile(asset.browser_download_url, BINARY_PATH);

  // Make executable on Unix
  if (!IS_WINDOWS) {
    fs.chmodSync(BINARY_PATH, 0o755);
  }

  const finalSize = fs.statSync(BINARY_PATH).size;
  console.log(`yt-dlp downloaded successfully: ${BINARY_PATH} (${(finalSize / 1e6).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error('ERROR downloading yt-dlp:', err.message);
  process.exit(1);
});
