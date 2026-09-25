// Some models emit bold/italic markers with whitespace touching the inner
// edge (e.g. "**heading **"), which is invalid per CommonMark and renders
// as literal asterisks instead of bold. Trim that whitespace so formatting
// renders correctly regardless of which model in the fallback chain answered.
export function normalizeMarkdown(text) {
  return text.replace(/(\*{1,2}|_{1,2})\s*([^*_\n]+?)\s*\1/g, (_, marker, inner) => `${marker}${inner}${marker}`);
}
