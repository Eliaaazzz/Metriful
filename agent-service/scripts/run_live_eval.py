"""Resolve an existing Cloud Run Gemini secret and evaluate synthetic data.

The key stays in this process environment. No secret is written or printed.
An existing GEMINI_API_KEY takes precedence over cloud lookup.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def cloud_run_key(project, service, region):
    gcloud = shutil.which("gcloud.cmd") or shutil.which("gcloud")
    if not gcloud:
        raise RuntimeError("Install gcloud or set GEMINI_API_KEY in this process")

    def run(arguments):
        result = subprocess.run([gcloud, *arguments, "--quiet"], capture_output=True, text=True,
                                encoding="utf-8", timeout=50)
        if result.returncode:
            raise RuntimeError("Could not read the configured Cloud Run Gemini credential")
        return result.stdout.strip()

    service_config = json.loads(run(["run", "services", "describe", service, "--project=" + project,
                                     "--region=" + region, "--format=json"]))
    template = service_config["spec"]["template"]
    settings = {entry["name"]: entry for entry in template["spec"]["containers"][0].get("env", [])}
    credential = settings.get("GEMINI_API_KEY")
    if not credential:
        raise RuntimeError("The selected service does not configure GEMINI_API_KEY")
    if credential.get("value"):
        return credential["value"]
    ref = credential["valueFrom"]["secretKeyRef"]
    aliases = template.get("metadata", {}).get("annotations", {}).get("run.googleapis.com/secrets", "")
    mapping = dict(entry.split(":", 1) for entry in aliases.split(",") if ":" in entry)
    secret = mapping.get(ref["name"], ref["name"])
    if "/secrets/" in secret:
        parts = secret.split("/")
        project, secret = parts[1], parts[-1]
    return run(["secrets", "versions", "access", ref.get("key", "latest"), "--secret=" + secret,
                "--project=" + project])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project")
    parser.add_argument("--service")
    parser.add_argument("--region")
    args = parser.parse_args()
    if not os.getenv("GEMINI_API_KEY"):
        if not all((args.project, args.service, args.region)):
            parser.error("Set GEMINI_API_KEY or supply --project, --service and --region")
        os.environ["GEMINI_API_KEY"] = cloud_run_key(args.project, args.service, args.region)
    from evals.run import main as evaluate
    asyncio.run(evaluate())


if __name__ == "__main__":
    main()
