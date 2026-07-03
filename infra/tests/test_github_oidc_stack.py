"""Synth-time assertions for the GitHub-OIDC deploy stack.

These run with zero AWS credentials — they synthesize the stack against a
dummy account id and assert on the CloudFormation template.
"""

import json

import aws_cdk as cdk
from aws_cdk.assertions import Match, Template

from thalon_infra.config import REGION, load_config
from thalon_infra.github_oidc_stack import ThalonGithubOidcStack

DUMMY_ACCOUNT = "123456789012"


def synth(extra_context: dict | None = None) -> Template:
    app = cdk.App(context=extra_context or {})
    config = load_config(app)
    stack = ThalonGithubOidcStack(
        app,
        "ThalonGithubOidc",
        config=config,
        env=cdk.Environment(account=DUMMY_ACCOUNT, region=config.region),
    )
    return Template.from_stack(stack)


def test_region_is_pinned_to_ap_southeast_2():
    assert REGION == "ap-southeast-2"


def test_oidc_provider_trusts_github_for_sts():
    synth().has_resource_properties(
        "AWS::IAM::OIDCProvider",
        {
            "Url": "https://token.actions.githubusercontent.com",
            "ClientIdList": ["sts.amazonaws.com"],
        },
    )


def test_deploy_role_trust_is_scoped_to_repo_main_branch():
    synth().has_resource_properties(
        "AWS::IAM::Role",
        {
            "RoleName": "thalon-github-deploy",
            "AssumeRolePolicyDocument": Match.object_like(
                {
                    "Statement": [
                        Match.object_like(
                            {
                                "Action": "sts:AssumeRoleWithWebIdentity",
                                "Condition": {
                                    "StringEquals": {
                                        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                                    },
                                    "StringLike": {
                                        "token.actions.githubusercontent.com:sub": [
                                            "repo:steveneam/thalon:ref:refs/heads/main"
                                        ]
                                    },
                                },
                            }
                        )
                    ]
                }
            ),
        },
    )


def test_oidc_subjects_are_context_overridable():
    template = synth(
        {"thalon:oidcSubjects": ["repo:steveneam/thalon:environment:prod"]}
    )
    template.has_resource_properties(
        "AWS::IAM::Role",
        {
            "AssumeRolePolicyDocument": Match.object_like(
                {
                    "Statement": [
                        Match.object_like(
                            {
                                "Condition": Match.object_like(
                                    {
                                        "StringLike": {
                                            "token.actions.githubusercontent.com:sub": [
                                                "repo:steveneam/thalon:environment:prod"
                                            ]
                                        }
                                    }
                                )
                            }
                        )
                    ]
                }
            )
        },
    )


def test_deploy_role_may_only_assume_cdk_bootstrap_roles():
    template = synth()
    template.has_resource_properties(
        "AWS::IAM::Policy",
        {
            "PolicyDocument": Match.object_like(
                {
                    "Statement": [
                        Match.object_like(
                            {
                                "Sid": "AssumeCdkBootstrapRoles",
                                "Action": "sts:AssumeRole",
                            }
                        )
                    ]
                }
            )
        },
    )
    rendered = json.dumps(template.to_json())
    assert f"cdk-hnb659fds-*-{DUMMY_ACCOUNT}-{REGION}" in rendered


def test_no_static_credentials_exist():
    template = synth()
    template.resource_count_is("AWS::IAM::User", 0)
    template.resource_count_is("AWS::IAM::AccessKey", 0)


def test_deploy_role_arn_is_exported_for_github():
    synth().has_output("DeployRoleArn", Match.any_value())
