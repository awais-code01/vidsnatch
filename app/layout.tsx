import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VidSnatch — Free Video Downloader',
  description:
    'Download videos from YouTube, TikTok, Instagram, and Facebook for free. Paste multiple links and download in HD.',
  keywords: ['video downloader', 'youtube downloader', 'tiktok downloader', 'instagram downloader', 'facebook downloader'],
  openGraph: {
    title: 'VidSnatch — Free Video Downloader',
    description: 'Download videos from YouTube, TikTok, Instagram, and Facebook for free.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
