/**
 * Synthetic check (capyweb-1td). Runs on a schedule, fetches each public surface, and publishes
 * one CloudWatch metric per target so an alarm can fire when something is down.
 *
 * CloudWatch Synthetics canaries would be the off-the-shelf answer, but the deploy identity has
 * no `synthetics:*` grant - and a canary costs ~$0.0012 per run (~$10/month at 5-minute
 * intervals), which is the entire project budget. This Lambda does the same job for cents.
 */
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const cw = new CloudWatchClient({});
export const NAMESPACE = "capyweb/Synthetic";

export interface Target {
  name: string;
  url: string;
  /** Substring the body must contain for the check to count as healthy. */
  expect?: string;
}

export interface Probe {
  name: string;
  healthy: boolean;
  status: number;
  ms: number;
  error?: string;
}

/** Parsed from TARGETS: "name=url[|expect]" entries separated by commas. */
export function parseTargets(raw: string | undefined): Target[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf("=");
      if (eq < 1) throw new Error(`bad TARGETS entry: ${entry}`);
      const name = entry.slice(0, eq).trim();
      const rest = entry.slice(eq + 1).trim();
      const bar = rest.indexOf("|");
      return bar === -1
        ? { name, url: rest }
        : { name, url: rest.slice(0, bar).trim(), expect: rest.slice(bar + 1).trim() };
    });
}

export async function probe(t: Target, timeoutMs = 8000): Promise<Probe> {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(t.url, { signal: ac.signal, redirect: "follow" });
    const body = t.expect ? await res.text() : "";
    const healthy = res.ok && (!t.expect || body.includes(t.expect));
    return {
      name: t.name,
      healthy,
      status: res.status,
      ms: Date.now() - started,
      ...(healthy ? {} : { error: t.expect && res.ok ? "body did not match" : `status ${res.status}` }),
    };
  } catch (err) {
    return {
      name: t.name,
      healthy: false,
      status: 0,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export const handler = async () => {
  const targets = parseTargets(process.env.TARGETS);
  if (targets.length === 0) {
    console.error("no TARGETS configured");
    return { ok: false, probes: [] };
  }

  const probes = await Promise.all(targets.map((t) => probe(t)));
  for (const p of probes) {
    console.log(JSON.stringify({ target: p.name, healthy: p.healthy, status: p.status, ms: p.ms, error: p.error }));
  }

  // One datum per target. Healthy is 1/0 so the alarm is "below 1 for N periods".
  await cw.send(
    new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: probes.flatMap((p) => [
        { MetricName: "Healthy", Dimensions: [{ Name: "Target", Value: p.name }], Value: p.healthy ? 1 : 0, Unit: "None" as const },
        { MetricName: "LatencyMs", Dimensions: [{ Name: "Target", Value: p.name }], Value: p.ms, Unit: "Milliseconds" as const },
      ]),
    }),
  );

  return { ok: probes.every((p) => p.healthy), probes };
};
