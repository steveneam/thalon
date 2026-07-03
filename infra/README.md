# infra/ — Thalon AWS infrastructure (CDK-Python)

Charter bucket **B0.5**: own AWS sub-account, GitHub-OIDC deploy role (no
static keys), `cdk bootstrap`, Thalon-named stacks — region **ap-southeast-2**
(ratified decision 1). Aurora/S3/etc. stacks land only when a bucket needs
them.

## Layout

```
infra/
├── app.py                        # CDK entry point (stack registry)
├── cdk.json                      # cdk config + thalon:* context defaults
├── thalon_infra/
│   ├── config.py                 # all deploy-time config; region constant
│   └── github_oidc_stack.py      # ThalonGithubOidc: OIDC provider + deploy role
├── tests/                        # synth-time assertions — run with NO AWS creds
├── scripts/
│   └── sso-login.py              # CLI-free `aws sso login` (device flow via boto3)
└── github-workflow/
    └── deploy-infra.yml.example  # → .github/workflows/ at the merge checkpoint
```

## Local dev (no credentials needed)

```powershell
cd infra
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest            # synth-time assertions
npx aws-cdk@2 synth                       # full template (venv activated)
```

`cdk synth` and the tests are credential-free: the account id resolves from
`CDK_DEFAULT_ACCOUNT` / `-c thalon:account=...` only at deploy time.

## Context knobs (`cdk.json` / `-c`)

| Key | Default | Purpose |
|---|---|---|
| `thalon:githubRepo` | `steveneam/thalon` | Repo allowed to assume the deploy role |
| `thalon:oidcSubjects` | `repo:<repo>:ref:refs/heads/main` | Exact OIDC `sub` claims trusted (widen deliberately) |
| `thalon:account` | `CDK_DEFAULT_ACCOUNT` | Target sub-account id (never committed) |
| `thalon:cdkQualifier` | `hnb659fds` | Only if `cdk bootstrap` used `--qualifier` |

## One-time founder bootstrap (blocked until the sub-account exists)

Everything below needs the AWS Organizations management account or temporary
credentials in the new sub-account — none of it is scriptable from this repo
until then. Order matters:

1. **Create the sub-account** — AWS Organizations → create account (suggested
   name `thalon`, its own billing line). Note the 12-digit account id.
2. **Get temporary credentials into it** — IAM Identity Center: an SSO
   profile in `~/.aws/config` (start URL / account id stay out of the repo).
   On machines where the AWS CLI installer is blocked, log in with
   `.venv\Scripts\python scripts\sso-login.py <profile>` instead of
   `aws sso login` — it runs the same device flow via boto3 and writes the
   token cache both boto3 and the CDK CLI read. Static IAM user keys are
   not used at any step.
3. **Bootstrap CDK** (from `infra/`, credentials from step 2):
   ```powershell
   npx aws-cdk@2 bootstrap aws://<ACCOUNT_ID>/ap-southeast-2
   ```
4. **Deploy the OIDC stack once by hand** (same credentials — the
   chicken-and-egg deploy; every later deploy assumes the role via OIDC):
   ```powershell
   npx aws-cdk@2 deploy ThalonGithubOidc -c thalon:account=<ACCOUNT_ID>
   ```
5. **Wire GitHub** — copy the `DeployRoleArn` stack output into a repo
   Actions **variable** named `AWS_DEPLOY_ROLE_ARN` (charter B0.5
   founder-supplied item):
   ```powershell
   gh variable set AWS_DEPLOY_ROLE_ARN --body "<DeployRoleArn output>"
   ```
6. **Activate the deploy workflow** — move
   `github-workflow/deploy-infra.yml.example` to
   `.github/workflows/deploy-infra.yml` (lead lane; one rename).

## Security posture

- **No static keys anywhere** — CI reaches AWS only by assuming
  `thalon-github-deploy` with a GitHub OIDC token, and only from
  `main` of `steveneam/thalon` (tighten/widen via `thalon:oidcSubjects`).
- The deploy role itself can only `sts:AssumeRole` the CDK bootstrap roles in
  this account+region; effective deploy permissions are governed by
  `cdk bootstrap`, not by hand-edited policy.
- Tests assert the trust scoping, the assume-only policy, and that the
  template contains zero `AWS::IAM::User` / `AWS::IAM::AccessKey` resources.
