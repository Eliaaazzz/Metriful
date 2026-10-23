"""Exercise Java JWT + H2 -> FastAPI -> real Gemini SDK -> local protocol fixture.

Run from agent-service: python scripts/verify_http_chain.py --report-dir <directory>
No Google key is required. The fixture covers successful tool calls and billing failures.
It does not establish a successful call to Google's live model service.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen


class GeminiFixture(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        contents = payload.get("contents", [])
        text = " ".join(p.get("text", "") for c in contents for p in c.get("parts", []))
        if "provider billing failure fixture" in text:
            self.send_response(402)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": {"code": 402, "status": "RESOURCE_EXHAUSTED",
                                                   "message": "Synthetic prepayment credits depleted"}}).encode())
            return
        observations = [p["functionResponse"] for c in contents for p in c.get("parts", [])
                        if "functionResponse" in p]
        tool = "apple_health" if "steps" in text.lower() else "nutrition_week"
        if observations:
            part = {"text": json.dumps(observations) + " [" + tool + "]"}
        else:
            part = {"functionCall": {"name": tool, "args": {}}, "thoughtSignature": "dGVzdC1zaWduYXR1cmU="}
        result = {"candidates": [{"content": {"role": "model", "parts": [part]}, "finishReason": "STOP"}],
                  "modelVersion": "gemini-3.8-flash", "usageMetadata": {
                      "promptTokenCount": 100, "candidatesTokenCount": 30, "totalTokenCount": 130}}
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report-dir", type=Path, required=True)
    args = parser.parse_args()
    output = args.report_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    service = Path(__file__).resolve().parents[1]
    backend = service.parent / "backend"
    fixture = ThreadingHTTPServer(("127.0.0.1", 0), GeminiFixture)
    threading.Thread(target=fixture.serve_forever, daemon=True).start()
    port = free_port()
    env = os.environ.copy()
    env.update({"GEMINI_API_KEY": "synthetic-protocol-fixture-key", "AGENT_MODEL": "gemini-3.8-flash",
                "AGENT_API_BASE_URL": f"http://127.0.0.1:{fixture.server_port}",
                "AGENT_INTERNAL_KEY": secrets.token_urlsafe(32),
                "AGENT_SERVICE_URL": f"http://127.0.0.1:{port}", "COACH_HTTP_INTEGRATION": "true"})
    log = (output / "agent-http.log").open("w", encoding="utf-8")
    process = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
                                "--port", str(port)], cwd=service, env=env, stdout=log, stderr=log)
    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            try:
                with urlopen(env["AGENT_SERVICE_URL"] + "/healthz", timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError("Agent process exited; see agent-http.log")
                time.sleep(0.25)
        else:
            raise RuntimeError("Agent did not become ready")
        wrapper = ["cmd", "/c", "gradlew.bat"] if os.name == "nt" else ["bash", "gradlew"]
        result = subprocess.run([*wrapper, "test", "--tests", "com.fitnessapp.backend.coach.CoachHttpIntegrationTest",
                                 "--rerun-tasks", "--console=plain"], cwd=backend, env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8",
                                errors="replace")
        (output / "java-http.log").write_text(result.stdout, encoding="utf-8")
        print(json.dumps({"httpChain": "passed" if result.returncode == 0 else "failed",
                          "provider": "local Gemini protocol fixture using real SDK",
                          "googleLiveGeneration": False, "reportDirectory": str(output)}))
        raise SystemExit(result.returncode)
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()
        fixture.shutdown()


if __name__ == "__main__":
    main()
