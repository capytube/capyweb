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

export function requireStage(stage: string | undefined): string {
  if (!stage) throw new Error("STAGE is not set: refusing to publish a metric without its Stage dimension");
  return stage;
}

/**
 * The datums for one run. Every datum carries a Stage dimension as well as Target: dev and prod
 * publish to the same namespace in the same account, and with Target alone their probes would land
 * in one series, so each stage's api-down and site-down alarms would read the other stage's
 * results. The alarms in infra/backend/template.yaml name both dimensions.
 */
export function metricData(probes: Probe[], stage: string | undefined) {
  const Stage = requireStage(stage);
  return probes.flatMap((p) => {
    const Dimensions = [
      { Name: "Target", Value: p.name },
      { Name: "Stage", Value: Stage },
    ];
    // Healthy is 1/0 so the alarm is "below 1 for N periods".
    return [
      { MetricName: "Healthy", Dimensions, Value: p.healthy ? 1 : 0, Unit: "None" as const },
      { MetricName: "LatencyMs", Dimensions, Value: p.ms, Unit: "Milliseconds" as const },
    ];
  });
}

export const handler = async () => {
  // Checked before probing, so a missing STAGE fails the run outright. No data then reaches the
  // stage's series, and its alarms (TreatMissingData: breaching) fire rather than stay green.
  const stage = requireStage(process.env.STAGE);

  const targets = parseTargets(process.env.TARGETS);
  if (targets.length === 0) {
    console.error("no TARGETS configured");
    return { ok: false, probes: [] };
  }

  const probes = await Promise.all(targets.map((t) => probe(t)));
  for (const p of probes) {
    console.log(JSON.stringify({ target: p.name, healthy: p.healthy, status: p.status, ms: p.ms, error: p.error }));
  }

  // One Healthy and one LatencyMs datum per target.
  await cw.send(new PutMetricDataCommand({ Namespace: NAMESPACE, MetricData: metricData(probes, stage) }));

  return { ok: probes.every((p) => p.healthy), probes };
};
