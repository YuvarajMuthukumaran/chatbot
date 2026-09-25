import { getCrisisResources } from "./crisisResources.js";

// Fixed safe-response template. Warm, non-interrogating, no arguing with
// the user's stated feelings — just immediate grounding + resources.
export function buildCrisisReply(region) {
  const resources = getCrisisResources(region);
  // "- " (real Markdown list syntax) so the client renders this as an
  // actual scannable list — a single "\n" between plain lines would just
  // be a soft line break and run the bullets together in one paragraph.
  const lines = resources.lines
    .map((l) => `- **${l.name}:** ${l.phone}`)
    .join("\n");

  return (
    `I'm really glad you told me this, and I want you to know you're not alone right now. ` +
    `What you're feeling matters, and it's serious enough that I'd like you to reach out to a real person who can help right away — not because I don't want to listen, but because you deserve more support than I can give.\n\n` +
    `If you're in ${resources.label} and in immediate danger, please contact one of these right now:\n\n` +
    `${lines}\n\n` +
    `If you can, please also reach out to someone you trust — a friend, family member, or a Tulasi Health Care professional — so you don't have to carry this alone. I'm still here to talk with you too.`
  );
}
