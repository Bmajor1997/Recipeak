// Feature requests and bug reports, sent privately to the Recipeak team (ported from Votic's feedback form).
// The server keeps them in its private ledger for up to a year; the team reads them on the admin dashboard.

export type FeedbackKind = "feature" | "bug";
export const FEEDBACK_KINDS: FeedbackKind[] = ["feature", "bug"];
export const is_feedback_kind = (value: unknown): value is FeedbackKind => FEEDBACK_KINDS.includes(value as FeedbackKind);

export const FEEDBACK_TEXT: Record<FeedbackKind, { title: string; detail: string; thanks: string }> = {
  feature: {
    title: "Suggest a Feature",
    detail: "Suggest improvements to make Recipeak work better for you.",
    thanks: "Thanks for your suggestion! Your feedback helps make Recipeak better.",
  },
  bug: {
    title: "Report a Bug",
    detail: "Tell us about a problem you had in Recipeak.",
    thanks: "Thanks for reporting this! Your feedback helps us fix Recipeak.",
  },
};

/** The two fields, with the same limits the server enforces. */
export const FEEDBACK_FIELDS = [
  { key: "title", label: "Title (required)", max: 120 },
  { key: "description", label: "Description (required)", max: 5000 },
] as const;

export type FeedbackValues = { title: string; description: string };
export const EMPTY_FEEDBACK: FeedbackValues = { title: "", description: "" };

/** The required-field message for what is still missing, or "" once both fields are filled. */
export function missing_fields_message({ title, description }: FeedbackValues): string {
  const needs_title = !title.trim();
  const needs_description = !description.trim();
  if (needs_title && needs_description) return "Enter a title and description before submitting.";
  if (needs_title) return "Enter a title before submitting.";
  if (needs_description) return "Enter a description before submitting.";
  return "";
}

/**
 * A reference for one submission, so a retry after a dropped connection is never saved twice. It only has to be
 * unique, not secret. A new one is made whenever the text changes.
 */
export function new_request_id(random: () => number = Math.random, now: () => number = Date.now): string {
  let id = now().toString(36);
  while (id.length < 32) id += Math.floor(random() * 36).toString(36);
  return `fb-${id}`;
}
