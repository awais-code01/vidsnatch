from http.server import BaseHTTPRequestHandler
import json
import yt_dlp


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            url = body.get("url", "").strip()
            if not url:
                return self._resp(400, {"error": "Missing url"})

            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "youtube_include_dash_manifest": False,
                "extractor_args": {
                    "youtube": {
                        "player_client": ["android", "web"],
                    }
                },
                "http_headers": {
                    "User-Agent": (
                        "Mozilla/5.0 (Linux; Android 12; Pixel 6) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Mobile Safari/537.36"
                    ),
                },
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            formats = []
            for fmt in info.get("formats", []):
                fmt_url = fmt.get("url", "")
                if not fmt_url or "manifest" in fmt_url:
                    continue
                formats.append(
                    {
                        "format_id": fmt.get("format_id", ""),
                        "ext": fmt.get("ext", "mp4"),
                        "url": fmt_url,
                        "height": fmt.get("height"),
                        "width": fmt.get("width"),
                        "vcodec": fmt.get("vcodec", "none"),
                        "acodec": fmt.get("acodec", "none"),
                        "tbr": fmt.get("tbr"),
                        "abr": fmt.get("abr"),
                        "filesize": fmt.get("filesize"),
                        "filesize_approx": fmt.get("filesize_approx"),
                    }
                )

            result = {
                "id": info.get("id", ""),
                "title": info.get("title", "YouTube Video"),
                "thumbnail": info.get("thumbnail"),
                "thumbnails": info.get("thumbnails", []),
                "duration": info.get("duration"),
                "uploader": info.get("uploader"),
                "channel": info.get("channel"),
                "formats": formats,
            }
            self._resp(200, result)

        except Exception as exc:
            self._resp(500, {"error": str(exc)})

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def _resp(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        pass  # silence access logs
