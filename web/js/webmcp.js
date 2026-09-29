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

// Returns an AbortController that unregisters the tool, or null when WebMCP is absent.
export function registerTool(name, title, description, inputSchemaJson, annotationsJson, execute) {
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
    // Older drafts returned { unregister() } instead of honouring the signal.
    if (r && typeof r.unregister === "function") {
      controller.signal.addEventListener("abort", () => r.unregister());
    }
    if (r && typeof r.catch === "function") {
      r.catch((e) => console.warn("webmcp: registerTool rejected", name, e));
    }
  } catch (e) {
    console.warn("webmcp: registerTool threw", name, e);
    return null;
  }
  return controller;
}
