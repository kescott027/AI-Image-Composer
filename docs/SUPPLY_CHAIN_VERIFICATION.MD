# Verify Supply Chain Runbook

The image pipeline (`.github/workflows/images.yml`) does three things per image:

1. Builds and pushes image to GHCR.
2. Generates SPDX JSON SBOM with Syft.
3. Keyless-signs image and attaches SBOM attestation with Cosign.

## Image naming

- `ghcr.io/<owner>/ai-image-composer-api:<sha>`
- `ghcr.io/<owner>/ai-image-composer-worker:<sha>`
- `ghcr.io/<owner>/ai-image-composer-web:<sha>`

## Verify signature

Replace `<image-ref>` with digest-pinned reference:
`ghcr.io/<owner>/ai-image-composer-api@sha256:...`

```bash
cosign verify "<image-ref>" \
  --certificate-identity-regexp "^https://github.com/<owner>/<repo>/.github/workflows/images.yml@refs/(heads/main|tags/.+)$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

## Verify SBOM attestation

```bash
cosign verify-attestation "<image-ref>" \
  --type spdxjson \
  --certificate-identity-regexp "^https://github.com/<owner>/<repo>/.github/workflows/images.yml@refs/(heads/main|tags/.+)$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

## Download SBOM from workflow artifacts

Each workflow run uploads:

- `sbom-api`
- `sbom-worker`
- `sbom-web`

Use GitHub Actions artifacts UI or `gh run download` to retrieve them.
