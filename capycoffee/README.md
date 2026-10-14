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
- `rename-roast.sh <build dir>`: renames the shown name Capycoffee to Capy Roast (nic order #4095)
  in a patched build, in place. Both names are 10 bytes, so RSC text rows keep their lengths; the
  one JS chunk that holds the name gets a new name of the same length. Build:
  `patch-build.sh <out20260908> <out> && rename-roast.sh <out>`; the result is
  `build-manifest-roast.sha256`.
- `redesign-roast.sh <build dir> <pictures dir>`: the Capy Roast redesign (nic order #4097) over a renamed build:
  `redesign/roast.css` (family palette, edge-to-edge hero, phone-first ticket, captioned picture bands),
  `redesign/hero.js` + `redesign/morph.js` (the family morph gallery as its own layer under React's wrapper),
  the pictures named in `redesign/pictures.txt` under `/roast-family/`, and the home headline. Build:
  `patch-build.sh <out20260908> <out> && rename-roast.sh <out> && redesign-roast.sh <out> <pictures>`; the result is
  `build-manifest-redesign.sha256`. `hero_test.mjs` tests the new hero.
