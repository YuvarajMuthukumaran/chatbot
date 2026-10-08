import { test } from "node:test";
import assert from "node:assert";
import { linkPhoneNumbers } from "../src/lib/callLinks.js";

test("known numbers become Call links", () => {
  assert.equal(linkPhoneNumbers("Call us at 8800000255."), "Call us at [Call Tulasi Health Care](tel:+918800000255).");
  assert.match(linkPhoneNumbers("+91 88000 00255"), /^\[Call Tulasi Health Care\]\(tel:\+918800000255\)$/);
  assert.match(linkPhoneNumbers("Tele-MANAS (14416) or 112"), /\[Call Tele-MANAS\]\(tel:14416\).*\[Call 112\]\(tel:112\)/);
  assert.match(linkPhoneNumbers("women's helpline 181"), /\[Call 181\]\(tel:181\)/);
});

test("prices, counts and existing links are left alone", () => {
  for (const text of ["about ₹1,112 a day", "₹112", "for 181 days", "room 1120", "[Call 112](tel:112)"]) {
    assert.equal(linkPhoneNumbers(text), text, text);
  }
});
