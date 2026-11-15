import { describe, expect, it } from "vitest";
import { create_api } from "../src/api/client";
import { FEEDBACK_FIELDS, is_feedback_kind, missing_fields_message, new_request_id } from "../src/feedback/feedback";

describe("feedback form", () => {
  it("asks for exactly what is missing", () => {
    expect(missing_fields_message({ title: "", description: " " })).toBe("Enter a title and description before submitting.");
    expect(missing_fields_message({ title: " ", description: "It crashed." })).toBe("Enter a title before submitting.");
    expect(missing_fields_message({ title: "Crash", description: "" })).toBe("Enter a description before submitting.");
    expect(missing_fields_message({ title: "Crash", description: "It crashed." })).toBe("");
  });

  it("uses the same limits as the server and only knows the two kinds", () => {
    expect(FEEDBACK_FIELDS.map((f) => [f.key, f.max])).toEqual([
      ["title", 120],
      ["description", 5000],
    ]);
    expect(is_feedback_kind("bug")).toBe(true);
    expect(is_feedback_kind("praise")).toBe(false);
  });

  it("makes submission references the server accepts, different each time", () => {
    const a = new_request_id();
    expect(a).toMatch(/^[a-zA-Z0-9-]{16,80}$/);
    expect(new_request_id()).not.toBe(a);
  });

  it("sends the report to the server and returns its id", async () => {
    let sent: { url: string; body: unknown } | null = null;
    const api = create_api({
      baseUrl: "https://x.test",
      id_token: async () => "t",
      fetch_impl: (async (url: string, init: RequestInit) => {
        sent = { url, body: JSON.parse(String(init.body)) };
        return new Response(JSON.stringify({ id: "fb1" }));
      }) as typeof fetch,
    });
    expect(await api.send_feedback({ kind: "bug", title: "Crash", description: "It closed.", request_id: "fb-1234567890abcdef" })).toBe(
      "fb1",
    );
    expect(sent).toEqual({
      url: "https://x.test/api/feedback",
      body: { category: "bug", title: "Crash", description: "It closed.", requestId: "fb-1234567890abcdef" },
    });
  });

  it("passes on the server's reason when a report is refused", async () => {
    const api = create_api({
      baseUrl: "https://x.test",
      id_token: async () => "t",
      fetch_impl: (async () =>
        new Response(JSON.stringify({ error: "You've reached today's feedback limit. Please try again tomorrow." }), {
          status: 429,
        })) as typeof fetch,
    });
    await expect(
      api.send_feedback({ kind: "feature", title: "A", description: "B", request_id: "fb-1234567890abcdef" }),
    ).rejects.toMatchObject({
      status: 429,
      message: "You've reached today's feedback limit. Please try again tomorrow.",
    });
  });
});
