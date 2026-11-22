import { describe, expect, it } from "vitest";
import { report_text } from "./recipeReport";

const input = {
  reason: "unsafe" as const,
  dish: "Test soup",
  kind: "meal" as const,
  details: "",
};

describe("recipe safety report snapshot", () => {
  it("includes the actual displayed recipe, not just its name", () => {
    const result = report_text({
      ...input,
      recipe: {
        title: "Test soup",
        ingredients: [{ amount: "2", unit: "cups", item: "vegetable broth" }],
        steps: ["Simmer for 10 minutes."],
        allergens: ["soy"],
      },
    });
    expect(result.description).toContain("2 cups vegetable broth");
    expect(result.description).toContain("1. Simmer for 10 minutes.");
    expect(result.description).toContain("Listed allergens: soy");
  });

  it("keeps the feedback description within the server limit", () => {
    const result = report_text({
      ...input,
      recipe: {
        title: "Long recipe",
        ingredients: Array.from({ length: 40 }, () => ({ amount: "1", unit: "cup", item: "x".repeat(200) })),
        steps: Array.from({ length: 30 }, () => "y".repeat(600)),
        allergens: [],
      },
    });
    expect(result.description.length).toBeLessThanOrEqual(5000);
    expect(result.description).toContain("[Snapshot truncated]");
  });
});
