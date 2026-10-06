// Links from the conversation to the app's self-help tools: the medicine
// guide and the self check-ins. Decided here in plain code (so the link and
// the page always match) and shown as cards under the reply; the model only
// gets a note that they're there.
import { findMedicinesIn } from "./medicines.js";

// "do I have depression?", "am I an alcoholic", "test for anxiety".
const CHECK_INS = [
  {
    id: "depression",
    label: "Depression check-in",
    pattern:
      /\b(?:do i have|have i got|could i have|is (?:this|it)|am i)\b[^.?!]{0,25}\b(?:depress(?:ed|ion)|clinically depressed)\b|\bdepression (?:test|check|quiz|screening)\b|\b(?:test|check|screen) (?:me |myself )?for depression\b/i,
  },
  {
    id: "anxiety",
    label: "Anxiety check-in",
    pattern:
      /\b(?:do i have|have i got|could i have|is (?:this|it)|am i)\b[^.?!]{0,25}\b(?:anxiety(?: disorder)?|gad|generali[sz]ed anxiety)\b|\banxiety (?:test|check|quiz|screening)\b|\b(?:test|check|screen) (?:me |myself )?for anxiety\b/i,
  },
  {
    id: "alcohol",
    label: "Alcohol use check-in",
    pattern:
      /\b(?:am i (?:an )?alcoholic|is my drinking (?:a problem|too much|normal|ok(?:ay)?)|do i drink too much|am i drinking too much|drinking problem\?|alcohol (?:test|check|quiz|screening))\b/i,
  },
];

/**
 * @param {string} message
 * @returns {{links: {label: string, to: string, kind: "medicine" | "check-in"}[], note?: string}}
 */
export function findToolLinks(message) {
  const medicines = findMedicinesIn(message);
  const checkIns = CHECK_INS.filter((c) => c.pattern.test(message));
  const links = [
    ...medicines.map((m) => ({ label: `About ${m.name}`, to: `/medicines/${m.slug}`, kind: "medicine" })),
    ...checkIns.map((c) => ({ label: c.label, to: `/check-in/${c.id}`, kind: "check-in" })),
  ];
  if (!links.length) return { links };

  const notes = [];
  if (medicines.length) {
    // The guide's own wording goes in, so anything said about the medicine
    // matches the reviewed page instead of the model's general knowledge.
    const facts = medicines
      .map(
        (m) =>
          `${m.name}. Common side effects: ${m.common.join("; ")}. Get help right away if: ${m.serious.join("; ")}.`
      )
      .join("\n");
    notes.push(
      `Under your reply the person will see a link to Tulasi's medicine guide for ${medicines.map((m) => m.name).join(", ")}. ` +
        "You can point to it in a few words. If you mention side effects, use only what's listed here, briefly, and never anything else:\n" +
        facts +
        "\nYou still don't advise on their own use: no doses, no starting, stopping, or switching. For anything about their situation, suggest the doctor who prescribed it. " +
        "If they describe a serious reaction from the list above, tell them to get medical help right away."
    );
  }
  if (checkIns.length) {
    notes.push(
      `Under your reply the person will see a link to a short, private self check-in (${checkIns.map((c) => c.label).join(", ")}): a standard questionnaire whose answers stay on their device. ` +
        "You can suggest it briefly as a way to reflect on how things have been, and say clearly that it isn't a diagnosis. Only a professional can diagnose. Never diagnose them yourself."
    );
  }
  return { links, note: notes.join("\n\n") };
}
