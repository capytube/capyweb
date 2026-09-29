// Thin shim over WebMCP so the Rust side sees one stable function.
//
// The API is a moving draft. 2025 drafts and Chrome's early preview hung it off
// navigator.modelContext; the CG draft of 28 Sep 2026 moved it to document.modelContext,
// with registerTool(tool, { signal }) returning a Promise and unregistration by aborting the
// signal. Support both, and do nothing at all where neither exists.

function modelContext() {
  if (typeof document !== "undefined" && document.modelContext) return document.modelContext;
  if (typeof navigator !== "undefined" && navigator.modelContext) return navigator.modelContext;
  return null;
}

export function webmcpAvailable() {
  const mc = modelContext();
  return !!mc && typeof mc.registerTool === "function";
}

// Resolves to an AbortController that unregisters the tool, or to null when WebMCP is absent
// or the browser refused the registration. A rejected registration is not a registered tool.
export async function registerTool(name, title, description, inputSchemaJson, annotationsJson, execute) {
  const mc = modelContext();
  if (!mc || typeof mc.registerTool !== "function") return null;
  const controller = new AbortController();
  const tool = {
    name,
    title,
    description,
    inputSchema: JSON.parse(inputSchemaJson),
    annotations: JSON.parse(annotationsJson),
    execute: (input, options) => execute(input ?? {}, options ?? {}),
  };
  try {
    const r = mc.registerTool(tool, { signal: controller.signal });
    if (r && typeof r.then === "function") {
      await r;
    } else if (r && typeof r.unregister === "function") {
      // Older drafts returned { unregister() } instead of honouring the signal.
      controller.signal.addEventListener("abort", () => r.unregister());
    }
  } catch (e) {
    console.warn("webmcp: registerTool failed", name, e);
    return null;
  }
  return controller;
}
