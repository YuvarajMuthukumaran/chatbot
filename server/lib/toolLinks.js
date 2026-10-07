// A compact medicine card under the reply when someone names a medicine from
// the guide: what it's for, its common side effects as chips, and its warning
// signs (folded). The card carries the facts, so the model's reply stays to
// a sentence or two instead of a wall of text.
import { findMedicinesIn } from "./medicines.js";

// "Sexual side effects (lower desire, delayed orgasm)" -> "Sexual side effects"
const chip = (text) => text.replace(/\s*\([^)]*\)/g, "").trim();

/**
 * @param {string} message
 * @returns {{medicines: object[], note?: string}}
 */
export function findMedicineCards(message) {
  const found = findMedicinesIn(message);
  if (!found.length) return { medicines: [] };

  const medicines = found.map((m) => ({
    slug: m.slug,
    name: m.name,
    kind: m.kind,
    usedFor: m.usedFor.slice(0, 3).map(chip),
    common: m.common.slice(0, 6).map(chip),
    // Plain sentences, shortened: the card folds them open.
    warnings: m.serious.map(chip),
  }));

  const names = found.map((m) => m.name).join(", ");
  const note =
    `Under your reply the person will see a card for ${names} with what it's used for, its common side effects, and its warning signs. ` +
    "So keep your reply to one or two short sentences: respond to what they asked and point them to the card. Don't list side effects or other medicine facts yourself, because the card already shows the checked list. " +
    "Never advise on their own use: no doses, no starting, stopping, or switching. For their situation, suggest the doctor who prescribed it. " +
    "If they describe a reaction that sounds serious (trouble breathing, swelling, a new rash with fever, fainting, severe confusion, thoughts of self-harm), tell them to get medical help right away.";

  return { medicines, note };
}
