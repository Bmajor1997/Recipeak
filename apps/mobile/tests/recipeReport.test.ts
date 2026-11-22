import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { create_api } from "../src/api/client";
import { REPORT_REASONS, report_text } from "../src/feedback/recipeReport";

describe("Report this recipe", () => {
  it("offers the same reasons, in the same order, as the server accepts", () => {
    const server = readFileSync(new URL("../../../server/feedback.js", import.meta.url), "utf8");
    const listed = /REPORT_REASONS = \[([^\]]+)\]/.exec(server)?.[1];
    const server_reasons = listed?.match(/"([a-z_]+)"/g)?.map((r) => r.replace(/"/g, ""));
    expect(REPORT_REASONS.map((r) => r.value)).toEqual(server_reasons);
  });

  it("writes a title and description the dashboard can read at a glance", () => {
    expect(report_text({ reason: "unsafe", dish: "Fugu", kind: "meal", diet: null, details: "  Raw pufferfish!  " })).toEqual({
      title: "Recipe report: Fugu",
      description: "Reason: Unsafe to follow\nRecipe: Fugu (meal)\nDetails: Raw pufferfish!",
    });
    expect(report_text({ reason: "other", dish: "Mojito", kind: "cocktail", diet: "vegan", details: "" }).description).toBe(
      "Reason: Something else\nRecipe: Mojito (drink, vegan version)\nDetails: None given",
    );
  });

  it("keeps the title within the server's 120-character limit", () => {
    const { title } = report_text({ reason: "inaccurate", dish: "x".repeat(300), kind: "meal", details: "" });
    expect(title.length).toBeLessThanOrEqual(120);
    expect(title.startsWith("Recipe report: ")).toBe(true);
  });

  it("sends the reason with the report, and leaves it out of ordinary feedback", async () => {
    const bodies: unknown[] = [];
    const api = create_api({
      baseUrl: "https://x.test",
      id_token: async () => "t",
      fetch_impl: (async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: "fb1" }));
      }) as typeof fetch,
    });
    await api.send_feedback({
      kind: "bug",
      title: "Recipe report: Fugu",
      description: "d",
      request_id: "fb-1234567890abcdef",
      report: "unsafe",
    });
    await api.send_feedback({ kind: "bug", title: "Crash", description: "d", request_id: "fb-abcdef1234567890" });
    expect(bodies[0]).toMatchObject({ category: "bug", report: "unsafe" });
    expect(bodies[1]).not.toHaveProperty("report");
  });
});
