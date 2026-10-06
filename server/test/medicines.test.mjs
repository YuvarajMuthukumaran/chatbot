import { test, before, after } from "node:test";
import assert from "node:assert";
import { MEDICINES, MEDICINE_CATEGORIES, getMedicine, findMedicinesIn } from "../lib/medicines.js";
import { findToolLinks } from "../lib/toolLinks.js";
import { app } from "../app.js";

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

test("every guide entry is complete and in a known category", () => {
  const categories = new Set(MEDICINE_CATEGORIES.map((c) => c.id));
  const slugs = new Set();
  for (const m of MEDICINES) {
    assert.ok(!slugs.has(m.slug), `duplicate slug ${m.slug}`);
    slugs.add(m.slug);
    assert.ok(categories.has(m.category), `${m.slug}: unknown category`);
    for (const field of ["usedFor", "howItHelps", "common", "serious", "goodToKnow"]) {
      assert.ok(Array.isArray(m[field]) && m[field].length, `${m.slug}: ${field} is empty`);
    }
    assert.ok(m.timeToWork, `${m.slug}: timeToWork missing`);
  }
});

test("the guide never states a dose", () => {
  const dose = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml)\b/i;
  for (const m of MEDICINES) {
    const text = JSON.stringify(m);
    assert.doesNotMatch(text, dose, `${m.slug} mentions a dose`);
  }
});

test("medicine names in a message are found, including alternative names", () => {
  assert.deepStrictEqual(findMedicinesIn("what are the side effects of sertraline?").map((m) => m.slug), ["sertraline"]);
  assert.deepStrictEqual(findMedicinesIn("my doctor put me on divalproex").map((m) => m.slug), ["valproate"]);
  assert.deepStrictEqual(findMedicinesIn("I feel sad today"), []);
  assert.strictEqual(getMedicine("LITHIUM").name, "Lithium");
  assert.strictEqual(getMedicine("nope"), null);
});

test("the chat links medicine questions to the guide and 'do I have…' questions to a check-in", () => {
  const med = findToolLinks("can sertraline make me sleepy?");
  assert.deepStrictEqual(med.links, [{ label: "About Sertraline", to: "/medicines/sertraline", kind: "medicine" }]);
  assert.match(med.note, /no doses/);

  assert.strictEqual(findToolLinks("do I have depression?").links[0].to, "/check-in/depression");
  assert.strictEqual(findToolLinks("is this anxiety or am I overthinking").links[0].to, "/check-in/anxiety");
  assert.strictEqual(findToolLinks("is my drinking a problem").links[0].to, "/check-in/alcohol");
  assert.match(findToolLinks("do I have depression?").note, /isn't a diagnosis/);

  assert.deepStrictEqual(findToolLinks("I feel so low today").links, []);
});

test("GET /api/medicines lists summaries; GET /api/medicines/:slug returns the full entry", async () => {
  const list = await (await fetch(`${base}/medicines`)).json();
  assert.strictEqual(list.medicines.length, MEDICINES.length);
  assert.ok(!("serious" in list.medicines[0]), "the list view stays light");
  assert.ok(list.categories.length);

  const one = await fetch(`${base}/medicines/lithium`);
  assert.strictEqual(one.status, 200);
  const body = await one.json();
  assert.strictEqual(body.medicine.name, "Lithium");
  assert.strictEqual(body.category.id, "mood_stabiliser");

  assert.strictEqual((await fetch(`${base}/medicines/not-a-medicine`)).status, 404);
});
