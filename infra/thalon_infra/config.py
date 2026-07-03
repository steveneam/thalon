"""Deploy-time configuration, resolved from CDK context with safe defaults.

The only inputs the infra app accepts. Account id is never committed:
it arrives via CDK_DEFAULT_ACCOUNT (from the caller's credentials) or an
explicit `-c thalon:account=...` override, so synth and tests run with no
AWS credentials at all.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from aws_cdk import App

# Ratified decision 1 (CHARTER.md): Thalon deploys to its own sub-account,
# ap-southeast-2 only. The region is a constant, not a knob.
REGION = "ap-southeast-2"

GITHUB_REPO_DEFAULT = "steveneam/thalon"

# CDK bootstrap qualifier — default matches `cdk bootstrap` with no flags.
CDK_QUALIFIER_DEFAULT = "hnb659fds"


@dataclass(frozen=True)
class InfraConfig:
    account: str | None
    github_repo: str
    # OIDC `sub` claims allowed to assume the deploy role. Deploys come from
    # main only; widen deliberately (e.g. environment:prod) via context.
    github_subjects: list[str] = field(default_factory=list)
    cdk_qualifier: str = CDK_QUALIFIER_DEFAULT

    @property
    def region(self) -> str:
        return REGION


def load_config(app: App) -> InfraConfig:
    github_repo = app.node.try_get_context("thalon:githubRepo") or GITHUB_REPO_DEFAULT
    subjects = app.node.try_get_context("thalon:oidcSubjects") or [
        f"repo:{github_repo}:ref:refs/heads/main"
    ]
    return InfraConfig(
        account=app.node.try_get_context("thalon:account")
        or os.environ.get("CDK_DEFAULT_ACCOUNT"),
        github_repo=github_repo,
        github_subjects=list(subjects),
        cdk_qualifier=app.node.try_get_context("thalon:cdkQualifier")
        or CDK_QUALIFIER_DEFAULT,
    )
