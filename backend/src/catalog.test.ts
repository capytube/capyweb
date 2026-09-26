import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRoute } from "./catalog.ts";

const seg = (p: string) => p.split("/").filter(Boolean);

test("every documented route dispatches to the right handler", () => {
  const cases: [string, string][] = [
    ["/capybaras", "listCapybaras"],
    ["/capybaras/c1", "getCapybara"],
    ["/capybaras/c1/interactions", "listInteractions"],
    ["/streams", "listStreams"],
    ["/streams/s1", "getStream"],
    ["/nfts", "listNfts"],
    ["/nfts/n1", "getNft"],
    ["/nfts/n1/offers", "listOffers"],
    ["/nfts/n1/activity", "listActivity"],
  ];
  for (const [p, kind] of cases) {
    assert.equal(matchRoute(seg(p))?.kind, kind, `${p} should be ${kind}`);
  }
});

test("the id is carried through for every parameterised route", () => {
  for (const p of ["/capybaras/c1", "/capybaras/c1/interactions", "/streams/c1", "/nfts/c1", "/nfts/c1/offers", "/nfts/c1/activity"]) {
    const r = matchRoute(seg(p)) as { id?: string };
    assert.equal(r.id, "c1", `${p} should carry its id`);
  }
});

test("unknown routes return null rather than falling through to a handler", () => {
  for (const p of [
    "/", "/unknown", "/capybaras/c1/unknown", "/capybaras/c1/interactions/extra",
    "/streams/s1/chat", "/nfts/n1/offers/extra", "/health", "/admin",
  ]) {
    assert.equal(matchRoute(seg(p)), null, `${p} must not match`);
  }
});

test("trailing slashes and repeated separators do not create phantom routes", () => {
  assert.equal(matchRoute(seg("/capybaras/"))?.kind, "listCapybaras");
  assert.equal(matchRoute(seg("//capybaras//c1//"))?.kind, "getCapybara");
});

test("write methods have no route here - this function is read-only by construction", () => {
  assert.equal(matchRoute(seg("/capybaras/c1/vote")), null);
  assert.equal(matchRoute(seg("/nfts/n1/buy")), null);
});
