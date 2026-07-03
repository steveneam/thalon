"""CLI-free replacement for `aws sso login` (this machine blocks the AWS CLI
installer). Runs the IAM Identity Center OAuth device flow via boto3 and
writes the standard token cache that boto3 AND the CDK/JS SDK both read, so
`--profile <name>` works everywhere afterwards.

Usage (from infra/):  .venv\\Scripts\\python scripts\\sso-login.py [profile]

Reads sso_start_url / sso_region from the profile in ~/.aws/config — no
URLs or account ids live in this file.
"""

from __future__ import annotations

import configparser
import hashlib
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3

DEFAULT_PROFILE = "thalon-admin"


def main() -> int:
    profile = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROFILE
    config = configparser.ConfigParser()
    config.read(Path.home() / ".aws" / "config")
    section = config[f"profile {profile}"]
    start_url = section["sso_start_url"]
    region = section["sso_region"]

    oidc = boto3.client("sso-oidc", region_name=region)
    client = oidc.register_client(
        clientName=f"{profile}-device-login", clientType="public"
    )
    auth = oidc.start_device_authorization(
        clientId=client["clientId"],
        clientSecret=client["clientSecret"],
        startUrl=start_url,
    )
    print(f"APPROVE IN BROWSER: {auth['verificationUriComplete']}", flush=True)

    deadline = time.time() + auth["expiresIn"]
    while time.time() < deadline:
        time.sleep(auth.get("interval", 5))
        try:
            token = oidc.create_token(
                grantType="urn:ietf:params:oauth:grant-type:device_code",
                deviceCode=auth["deviceCode"],
                clientId=client["clientId"],
                clientSecret=client["clientSecret"],
            )
        except oidc.exceptions.AuthorizationPendingException:
            continue
        except oidc.exceptions.SlowDownException:
            time.sleep(5)
            continue

        cache_dir = Path.home() / ".aws" / "sso" / "cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=token["expiresIn"]
        )
        # Filename must be sha1(sso_start_url) — the contract shared by
        # botocore and the JS SDK credential providers.
        cache_path = cache_dir / (
            hashlib.sha1(start_url.encode("utf-8")).hexdigest() + ".json"
        )
        cache_path.write_text(
            json.dumps(
                {
                    "startUrl": start_url,
                    "region": region,
                    "accessToken": token["accessToken"],
                    "expiresAt": expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            )
        )
        print(
            f"Logged in; token valid ~{token['expiresIn'] // 3600}h. "
            f"Cache: {cache_path}"
        )
        return 0

    print("Device authorization expired before it was approved.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
