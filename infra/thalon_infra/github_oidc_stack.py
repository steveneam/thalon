"""GitHub-OIDC deploy role — the only way CI touches AWS (no static keys).

One-time chicken-and-egg: this stack itself is deployed by a human with
temporary credentials in the Thalon sub-account (see infra/README.md);
every deploy after that assumes the role via GitHub's OIDC token.

The role can do exactly one thing: assume the CDK bootstrap roles in this
account/region. All real permissions live on those bootstrap roles, so
widening or narrowing deploy rights is a `cdk bootstrap` concern, not an
edit here.
"""

from __future__ import annotations

from aws_cdk import CfnOutput, Duration, Stack
from aws_cdk import aws_iam as iam
from constructs import Construct

from .config import InfraConfig

GITHUB_OIDC_URL = "https://token.actions.githubusercontent.com"
GITHUB_OIDC_AUDIENCE = "sts.amazonaws.com"

# AWS has validated GitHub's issuer against trusted root CAs since 2023 and
# ignores these, but the CloudFormation field still wants a value.
GITHUB_OIDC_THUMBPRINTS = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
]

DEPLOY_ROLE_NAME = "thalon-github-deploy"


class ThalonGithubOidcStack(Stack):
    def __init__(
        self, scope: Construct, construct_id: str, *, config: InfraConfig, **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Native CFN resource — the iam.OpenIdConnectProvider L2 provisions a
        # custom-resource Lambda for the same result.
        provider = iam.CfnOIDCProvider(
            self,
            "GithubOidcProvider",
            url=GITHUB_OIDC_URL,
            client_id_list=[GITHUB_OIDC_AUDIENCE],
            thumbprint_list=GITHUB_OIDC_THUMBPRINTS,
        )

        deploy_role = iam.Role(
            self,
            "DeployRole",
            role_name=DEPLOY_ROLE_NAME,
            description=(
                f"Assumed by GitHub Actions ({config.github_repo}) via OIDC "
                "to run cdk deploy. No static keys."
            ),
            assumed_by=iam.WebIdentityPrincipal(
                provider.attr_arn,
                conditions={
                    "StringEquals": {
                        "token.actions.githubusercontent.com:aud": GITHUB_OIDC_AUDIENCE
                    },
                    "StringLike": {
                        "token.actions.githubusercontent.com:sub": config.github_subjects
                    },
                },
            ),
            max_session_duration=Duration.hours(1),
        )

        deploy_role.add_to_policy(
            iam.PolicyStatement(
                sid="AssumeCdkBootstrapRoles",
                actions=["sts:AssumeRole"],
                resources=[
                    f"arn:{self.partition}:iam::{self.account}:role/"
                    f"cdk-{config.cdk_qualifier}-*-{self.account}-{self.region}"
                ],
            )
        )

        CfnOutput(
            self,
            "DeployRoleArn",
            value=deploy_role.role_arn,
            description=(
                "Set this as the AWS_DEPLOY_ROLE_ARN GitHub Actions variable "
                "(charter B0.5 founder-supplied item)."
            ),
        )
