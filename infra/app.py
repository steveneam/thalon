#!/usr/bin/env python3
"""CDK app entry point. Synth needs no AWS credentials; deploy pins the
Thalon sub-account + ap-southeast-2 (ratified decision 1)."""

import aws_cdk as cdk

from thalon_infra.config import load_config
from thalon_infra.github_oidc_stack import ThalonGithubOidcStack

app = cdk.App()
config = load_config(app)

env = cdk.Environment(account=config.account, region=config.region)

ThalonGithubOidcStack(app, "ThalonGithubOidc", config=config, env=env)

# Aurora/S3/etc. stacks land only when a bucket needs them (charter B0.5).

app.synth()
