#!/usr/bin/env python3
"""Simple HTTP server to bypass file:// caching issues"""
import http.server
import socketserver
import webbrowser
import os

PORT = 8080
DIRECTORY = "."

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable ALL caching
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
    
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"🎮 Anime Card Battle Server")
        print(f"   Running at: http://localhost:{PORT}")
        print(f"   Directory: {os.getcwd()}")
        print(f"")
        print(f"   Press Ctrl+C to stop")
        print(f"")
        
        # Auto-open browser (but won't work in some environments)
        try:
            import threading
            def open_browser():
                import time
                time.sleep(1)  # Wait for server to start
                webbrowser.open(f"http://localhost:{PORT}/index_fresh.html")
            threading.Thread(target=open_browser, daemon=True).start()
        except:
            print(f"   Manual: Open http://localhost:{PORT}/index_fresh.html in browser")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped!")

if __name__ == "__main__":
    main()
