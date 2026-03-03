# Secrets Management Baseline

This project currently enforces a baseline runtime secret policy.

## Runtime policy

- `AIIC_ENV=production|prod` enables strict secret validation.
- `AIIC_APP_SECRET_KEY` is mandatory in production.
- Placeholder/weak secrets are rejected in production startup checks.

## Rotation metadata

Track key rotation state with:

- `AIIC_APP_SECRET_KEY_VERSION`
- `AIIC_PROVIDER_KEYSET_VERSION`

These are metadata markers for operational visibility and runbook alignment.

## Validation

Run locally:

```bash
make secrets-check
```

`make scan` also executes secret baseline validation before dependency/static scans.

## Rotation process (baseline)

1. Generate new key material in the target secret manager.
2. Update deployment secret value (`AIIC_APP_SECRET_KEY`) and bump version marker.
3. Redeploy services.
4. Confirm logs show expected version marker at startup.
5. Revoke old key material after verification.
