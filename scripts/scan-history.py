#!/usr/bin/env python3
"""
Scan every blob ever committed for secrets.

scripts/guard.sh only sees the WORKING TREE, so a secret committed and then deleted passes
every check it makes. That is not hypothetical here: four separate secrets are in this repo's
history (three Livepeer keys, one AppSync API key) and none is in the working tree.

Too slow for a pre-commit hook - it reads every unique blob in the repo - so it is an
on-demand check, not a gate:

    scripts/scan-history.py              scan every blob, print findings, exit 1 if any
    scripts/scan-history.py --known-ok   exit 0 for findings already listed as known

Findings are redacted: enough to identify the secret, never enough to use it.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KNOWN = ROOT / "scripts" / "history-secrets-known.txt"

# Each rule is (name, compiled pattern). Patterns match the SECRET, not its surroundings,
# so the reported span can be redacted precisely.
RULES = [
    ("aws-access-key-id", re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("appsync-api-key", re.compile(rb"\bda2-[a-z0-9]{26}\b")),
    ("private-key-block", re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----")),
    ("slack-token", re.compile(rb"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("github-token", re.compile(rb"\bgh[pousr]_[A-Za-z0-9]{36,}")),
    # A UUID or long opaque string assigned to a credential-shaped name. This is the rule that
    # catches the Livepeer keys: apiKey: "7f09548e-4e52-4744-9c85-6f00eb999b62".
    ("credential-assignment", re.compile(
        rb"""(?i)(?:api[_-]?key|secret|token|password|passphrase|credential)[A-Za-z_]*"""
        rb"""\s*[:=]\s*["']([A-Za-z0-9/+=._-]{20,})["']"""
    )),
]

# Values that are names or placeholders, not secrets - same reasoning as scripts/guard.sh:
# a literal made only of [A-Za-z0-9_] that contains an underscore is an identifier.
NAMEISH = re.compile(rb"^[A-Za-z0-9]*_[A-Za-z0-9_]*$")
PLACEHOLDER = re.compile(rb"(?i)placeholder|leakcanary|example|your-|xxxx|changeme|dummy|<[a-z]")

SKIP_PATH = re.compile(
    r"(^|/)(node_modules|\.aws-sam|dist|build)/|"
    r"(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|"
    r"\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|mp4|pdf|zip)$"
)


def run(args: list[str], **kw) -> bytes:
    return subprocess.run(args, cwd=ROOT, stdout=subprocess.PIPE, check=True, **kw).stdout


def redact(value: bytes) -> str:
    s = value.decode("utf-8", "replace")
    return s if len(s) <= 12 else f"{s[:6]}…{s[-4:]} ({len(s)} chars)"


def load_known() -> set[str]:
    if not KNOWN.exists():
        return set()
    out = set()
    for line in KNOWN.read_text().splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            out.add(line)
    return out


def main() -> int:
    known_ok = "--known-ok" in sys.argv
    known = load_known()

    # Every object reachable from any ref, as "<sha> <path>". Blobs appear once per unique
    # content, so an unchanged file across 400 commits is scanned once, not 400 times.
    listing = run(["git", "rev-list", "--objects", "--all"]).splitlines()
    blobs: dict[bytes, str] = {}
    for line in listing:
        parts = line.split(b" ", 1)
        if len(parts) != 2:
            continue
        sha, path = parts[0], parts[1].decode("utf-8", "replace")
        if not SKIP_PATH.search(path):
            blobs.setdefault(sha, path)

    print(f"scanning {len(blobs)} unique blobs…", file=sys.stderr)

    findings: list[tuple[str, str, str, str]] = []
    shas = list(blobs)
    BATCH = 500
    for i in range(0, len(shas), BATCH):
        chunk = shas[i : i + BATCH]
        proc = subprocess.run(
            ["git", "cat-file", "--batch"],
            cwd=ROOT,
            input=b"\n".join(chunk) + b"\n",
            stdout=subprocess.PIPE,
            check=True,
        )
        out = proc.stdout
        pos = 0
        while pos < len(out):
            nl = out.find(b"\n", pos)
            if nl == -1:
                break
            header = out[pos:nl].split(b" ")
            if len(header) < 3:
                break
            sha, size = header[0], int(header[2])
            body = out[nl + 1 : nl + 1 + size]
            pos = nl + 1 + size + 1
            if b"\0" in body[:8000]:  # binary
                continue
            path = blobs.get(sha, "?")
            for name, pat in RULES:
                for m in pat.finditer(body):
                    value = m.group(1) if m.groups() else m.group(0)
                    if NAMEISH.match(value) or PLACEHOLDER.search(value):
                        continue
                    key = f"{name}:{redact(value)}"
                    findings.append((name, path, redact(value), sha.decode()))
                    del key

    # Collapse to one row per (rule, redacted value) and list where it appears.
    grouped: dict[tuple[str, str], set[str]] = {}
    for name, path, red, _sha in findings:
        grouped.setdefault((name, red), set()).add(path)

    if not grouped:
        print("no secrets found in history")
        return 0

    unknown = 0
    print(f"\n{len(grouped)} secret(s) found in git history:\n")
    for (name, red), paths in sorted(grouped.items()):
        ident = f"{name}:{red.split(' ')[0]}"
        status = "known" if ident in known else "NEW"
        if status == "NEW":
            unknown += 1
        print(f"  [{status:5}] {name:22} {red}")
        for p in sorted(paths)[:3]:
            print(f"            in {p}")

    print(
        "\nA secret in history is public for good: rewriting history does not recall a clone."
        "\nRotate it, then record it in scripts/history-secrets-known.txt with its rotation status."
    )
    if known_ok and unknown == 0:
        print("all findings are known and recorded")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
