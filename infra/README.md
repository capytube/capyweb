# capyweb infra

Deploys run in GitHub Actions (`.github/workflows/capyweb-aws.yml`), using the repo secrets CAPY_AWS_* (Capy account 619071347239) and AL_DNS_AWS_* (AL account 360122305252, DNS only).

- `backend/template.yaml`: SAM stack `capyweb-backend-<stage>` in ap-southeast-1. On-demand only.
- Plan and IAM: `docs/SAM_MIGRATION_PLAN.md`.
