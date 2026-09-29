// Thin shim over WebMCP so the Rust side sees one stable function (docs/WEBMCP_NOTES.md).
//
// The CG report (a living draft, 29 Sep 2026) puts it on document.modelContext:
// registerTool(tool, { signal }) returns a Promise that resolves to undefined, and aborting that
// signal unregisters the tool. It does not cancel a call already running: that call has its own
// signal, passed to execute. navigator.modelContext is the older name (deprecated in Chromium
// 150), kept only as a fallback. Where neither exists, nothing is registered.

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
    await mc.registerTool(tool, { signal: controller.signal });
  } catch (e) {
    console.warn("webmcp: registerTool failed", name, e);
    return null;
  }
  return controller;
}
