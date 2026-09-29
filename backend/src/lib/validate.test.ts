import { test } from "node:test";
import assert from "node:assert/strict";
import { BadInput } from "./http.ts";
import {
  displayName, chatText, customRequest, reaction, wholeNumber, idempotencyKey,
  CHAT_MAX_CHARS, CHAT_MAX_BYTES, DISPLAY_NAME_MAX, REACTIONS,
} from "./validate.ts";

test("display names: letters and digits in any script, single separators between them", () => {
  for (const ok of ["Nic", "Magnus Fan", "o'neil", "capy_lover-2", "ณัฐ", "Zoë", "李小龙", "J.R"]) {
    assert.equal(displayName(ok), ok, ok);
  }
  assert.equal(displayName("  Nic  "), "Nic", "trimmed");
  for (const bad of ["", "a", " ", "-nic", "nic-", "a  b", "a__b", "nic!", "<b>x</b>", "🦫capy", "x".repeat(DISPLAY_NAME_MAX + 1), 42, null]) {
    assert.throws(() => displayName(bad), BadInput, JSON.stringify(bad));
  }
});

test("display names that impersonate the site or staff are reserved, whatever the case or separators", () => {
  for (const bad of ["Admin", "ADMIN", "Capy Tube", "capy_tube", "Mod", "Staff", "Support"]) {
    assert.throws(() => displayName(bad), /reserved/, bad);
  }
});

test("display names and chat refuse direction overrides and invisible characters", () => {
  assert.throws(() => displayName("nic‮evil"), BadInput);
  assert.throws(() => chatText("hello ‮dlrow"), BadInput);
  assert.throws(() => chatText("a​b"), BadInput);
  assert.throws(() => chatText("line1\nline2"), BadInput, "one line only");
  assert.throws(() => chatText("tab\there"), BadInput);
});

test("chat keeps emoji, including joined sequences", () => {
  assert.equal(chatText("family 👨‍👩‍👧 capy 🦫"), "family 👨‍👩‍👧 capy 🦫");
});

test("chat length is bounded in characters and in bytes (one write unit per message)", () => {
  assert.equal(chatText("x".repeat(CHAT_MAX_CHARS)).length, CHAT_MAX_CHARS);
  assert.throws(() => chatText("x".repeat(CHAT_MAX_CHARS + 1)), /at most/);
  assert.throws(() => chatText("   "), /empty/);
  assert.throws(() => chatText(""), /empty/);
  assert.throws(() => chatText(123), BadInput);
  // 280 four-byte emoji pass the character rule but not the byte rule.
  const heavy = "🦫".repeat(CHAT_MAX_CHARS);
  assert.ok(Buffer.byteLength(heavy) > CHAT_MAX_BYTES);
  assert.throws(() => chatText(heavy), /bytes/);
});

test("custom requests are short single lines", () => {
  assert.equal(customRequest("Mango please"), "Mango please");
  assert.throws(() => customRequest("x".repeat(61)), BadInput);
  assert.throws(() => customRequest(""), BadInput);
});

test("reactions are a fixed set", () => {
  for (const r of REACTIONS) assert.equal(reaction(r), r);
  for (const bad of ["CAPYLOVE", "like", "", undefined, "__proto__", "constructor"]) {
    assert.throws(() => reaction(bad), BadInput, String(bad));
  }
});

test("whole numbers: no strings, floats, NaN, negatives or out-of-range values", () => {
  assert.equal(wholeNumber(3, "n", 1, 10), 3);
  for (const bad of ["3", 3.5, Number.NaN, -1, 0, 11, true, null, Infinity, 2 ** 53]) {
    assert.throws(() => wholeNumber(bad, "n", 1, 10), BadInput, String(bad));
  }
});

test("idempotency keys are required and cannot carry key delimiters", () => {
  assert.equal(idempotencyKey("3f1c2a9e-7b4d-4c1e-9a55-0d8e2f6b1c3a"), "3f1c2a9e-7b4d-4c1e-9a55-0d8e2f6b1c3a");
  for (const bad of [undefined, "", "short", "has#hash-inside", "has space here", "x".repeat(65)]) {
    assert.throws(() => idempotencyKey(bad), BadInput, String(bad));
  }
});
