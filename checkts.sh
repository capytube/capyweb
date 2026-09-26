#!/bin/bash
# --no-install matters: without typescript installed, plain `npx tsc` downloads whatever
# package is published as "tsc" on npm and runs it. Fail instead.
set -euo pipefail
npx --no-install tsc --noEmit
