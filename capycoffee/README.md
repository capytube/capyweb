# Capycoffee demo at roast.capy.life

The static Capycoffee demo (a Next.js export of about, roast and a mock order page) served at
roast.capy.life. It has no backend: the order form keeps its ticket in the tab's sessionStorage,
and its pages say "Mock checkout only — no payments in this build". Bead hm-zxnj3. The domain
was chosen by nic (Q518). The RED packet is in agent-notes, `handoffs/capycoffee-roast-red.md`.

- `infra/template.yaml`: one CloudFormation stack, `capyapp-capycoffee-roast` in us-east-1. It
  holds:
  - an ACM certificate;
  - a private S3 bucket that only this distribution can read (OAC);
  - the `IndexFunction` CloudFront Function, which serves `/x/` from `/x/index.html` and
    redirects `/x` to `/x/`, and never redirects to another host;
  - the distribution;
  - two alias records in the shared capy.life zone.
- `infra/test_edge.mjs`: runs the template's own function against the build, with a 200k-input
  fuzz. Run it as `node infra/test_edge.mjs <build dir>`.
- `localcheck.mjs`: serves the build through that function on 127.0.0.1 and walks it in
  headless Chromium.
- `infra/upload.sh <bucket> [build dir]`: uploads with an explicit Content-Type per extension.
- `infra/rollback.sh`: empties the bucket and deletes the stack. It also deletes the ACM
  validation CNAME, which CloudFormation leaves in the zone, and nothing else.
- `build-manifest.sha256`: the sorted sha256 of every file of the build that is deployed
  (`out20260908`, 68 files, kept outside the repo). The original is on Mac mini 3 at
  `~/stacks/capycoffee-demo-publish`.
