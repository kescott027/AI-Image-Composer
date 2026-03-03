# Security Policy

## Supported Versions

Only the latest `main` branch and the most recent tagged release are supported for security fixes.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately:

- Open a GitHub Security Advisory draft in this repository, or
- Email the maintainers listed in repository ownership.

When reporting, include:

- Affected endpoint/component
- Reproduction steps or PoC
- Impact assessment
- Suggested mitigation (if known)

Triage targets:

- Initial acknowledgment within 2 business days
- Triage decision within 5 business days
- Coordinated remediation/notification timeline after validation

## Secret Management Baseline

- Do not commit `.env` files or plaintext credentials.
- Production runtime (`AIIC_ENV=production|prod`) requires `AIIC_APP_SECRET_KEY`.
- Weak/default placeholders (for example `changeme`, `example`, short values) are rejected in production.
- Track rotation metadata via:
  - `AIIC_APP_SECRET_KEY_VERSION`
  - `AIIC_PROVIDER_KEYSET_VERSION`

Validate locally/CI:

```bash
make secrets-check
```

## Artifact Integrity Baseline

- Local artifact metadata stores a SHA-256 checksum.
- Artifact download endpoints verify checksum before serving file content.
- Checksum mismatch returns HTTP `409` (integrity conflict) instead of serving tampered data.
- Optional immutable mode (`AIIC_ARTIFACT_IMMUTABLE_MODE=true`) sets artifact and metadata files to read-only after creation.
