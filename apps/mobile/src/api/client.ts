// Talks to the Recipeak backend. The OpenAI key never reaches the phone: only the user's Firebase ID token is sent.
import { parse_allowance, parse_dish_image, parse_identification, parse_recipe } from "../recipes/parse";
import type { FeedbackKind } from "../feedback/feedback";
import type { ReportReason } from "../feedback/recipeReport";
import type { Addition } from "../recipes/premiumVersions";
import type { Allowance, Diet, DishImage, Identification, Kind, Recipe } from "../recipes/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
  /** A free allowance is used up: show the upgrade screen. */
  get needsUpgrade() {
    return this.code === "FREE_PHOTOS_USED" || this.code === "FREE_VERSIONS_USED" || this.code === "PREMIUM_VERSIONS";
  }
  /** Which allowance ran out, so the paywall says the right thing. */
  get upgradeReason(): "photos" | "versions" {
    return this.code === "FREE_VERSIONS_USED" || this.code === "PREMIUM_VERSIONS" ? "versions" : "photos";
  }
}

type Deps = {
  baseUrl: string | undefined;
  id_token: (expected_uid?: string) => Promise<string | null>;
  fetch_impl?: typeof fetch;
  timeoutMs?: number;
};

export function create_api({ baseUrl, id_token, fetch_impl = fetch, timeoutMs = 75_000 }: Deps) {
  async function request(path: string, init: { method: "GET" | "POST"; body?: unknown; expected_uid?: string }): Promise<unknown> {
    if (!baseUrl) throw new ApiError("This build isn't connected to the recipe server yet.", 0);
    const token = await id_token(init.expected_uid);
    if (!token) throw new ApiError("Please sign in again.", 401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch_impl(baseUrl.replace(/\/$/, "") + path, {
        method: init.method,
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const body = (json ?? {}) as { error?: unknown; code?: unknown };
        const message = typeof body.error === "string" && body.error.length < 300 ? body.error : "Something went wrong. Please try again.";
        throw new ApiError(message, response.status, typeof body.code === "string" ? body.code : undefined);
      }
      return json;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // React Native doesn't always name an aborted request "AbortError", so check the timer's signal too.
      if (controller.signal.aborted || (error as Error)?.name === "AbortError")
        throw new ApiError("That took too long. Check your connection and try again.", 0);
      throw new ApiError("Couldn't reach the recipe server. Check your connection and try again.", 0);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async explore(): Promise<{ name: string; kind: Kind; aliases: string[]; image: string | null }[]> {
      const json = (await request("/api/explore", { method: "GET" })) as { dishes?: unknown };
      if (!Array.isArray(json?.dishes)) throw new ApiError("Couldn't load the collection. Please try again.", 0);
      return json.dishes.flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const dish = item as Record<string, unknown>;
        if (typeof dish.name !== "string" || (dish.kind !== "meal" && dish.kind !== "cocktail")) return [];
        const image = typeof dish.image === "string" && /^\/images\/[a-z0-9-]+\.jpg$/.test(dish.image) ? dish.image : null;
        return [
          {
            name: dish.name,
            kind: dish.kind,
            aliases: Array.isArray(dish.aliases) ? dish.aliases.filter((a): a is string => typeof a === "string") : [],
            image,
          },
        ];
      });
    },
    async identify(imageDataUrl: string): Promise<Identification> {
      return parse_identification(await request("/api/identify", { method: "POST", body: { image: imageDataUrl } }));
    },
    /**
     * A recipe by name: another guess, a diet version, or (`correction`) a name typed in place of a photo that
     * couldn't be read, which uses one of the free photos instead of a follow-up.
     */
    async recipe(
      name: string,
      kind: Kind,
      diet?: Diet,
      { correction = false }: { correction?: boolean } = {},
    ): Promise<{ recipe: Recipe; image: DishImage }> {
      const body = { name, kind, ...(diet ? { diet } : {}), ...(correction ? { correction: true } : {}) };
      const json = (await request("/api/recipe", { method: "POST", body })) as {
        recipe?: unknown;
        image?: unknown;
      };
      return { recipe: parse_recipe(json?.recipe), image: parse_dish_image(json?.image) };
    },
    /**
     * A meat or seafood ("non-vegetarian") or dairy or egg ("non-vegan") version of a vegetarian or vegan meal, made
     * from the recipe on screen. Premium only: a free account gets the PREMIUM_VERSIONS upgrade error.
     */
    async recipe_addition(name: string, addition: Addition, base: Recipe): Promise<Recipe> {
      const body = {
        name,
        kind: "meal",
        addition,
        base: { title: base.title, servings: base.servings, ingredients: base.ingredients, steps: base.steps },
      };
      const json = (await request("/api/recipe-addition", { method: "POST", body })) as { recipe?: unknown };
      return parse_recipe(json?.recipe);
    },
    /** The shared recipe for a dish on the Home photo wall. Free: it uses no photo or recipe allowance. */
    async featured_recipe(name: string, kind: Kind): Promise<{ recipe: Recipe; image: DishImage }> {
      const json = (await request("/api/featured-recipe", { method: "POST", body: { name, kind } })) as {
        recipe?: unknown;
        image?: unknown;
      };
      return { recipe: parse_recipe(json?.recipe), image: parse_dish_image(json?.image) };
    },
    /** Checks on a cover photo that is still being created. */
    async dish_image(kind: Kind, name: string): Promise<DishImage> {
      const query = `kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`;
      const json = (await request(`/api/dish-image?${query}`, { method: "GET" })) as { image?: unknown };
      return parse_dish_image(json?.image);
    },
    /** Full address of a library photo, for showing or downloading it. */
    image_uri(path: string | null): string | null {
      return path && baseUrl ? baseUrl.replace(/\/$/, "") + path : null;
    },
    async allowance(): Promise<Allowance> {
      return parse_allowance(await request("/api/allowance", { method: "GET" }));
    },
    /** Saves this account's rating for a dish, replacing any earlier one. */
    async rate_recipe(
      input: { kind: Kind; dish: string; stars: number; made: boolean; tags: string[]; note: string },
      expected_uid: string,
    ): Promise<void> {
      await request("/api/recipe-rating", { method: "POST", body: input, expected_uid });
    },
    /** Deletes everything the recipe server keeps for this account. Needs a sign-in from the last few minutes. */
    async delete_account(expected_uid: string): Promise<void> {
      await request("/api/account/delete", { method: "POST", body: {}, expected_uid });
    },
    /** Sends a feature request or bug report. Sending again with the same request_id never saves it twice. */
    async send_feedback(input: {
      kind: FeedbackKind;
      title: string;
      description: string;
      request_id: string;
      /** Set only by "Report this recipe": why the recipe was reported. */
      report?: ReportReason;
    }): Promise<string> {
      const json = (await request("/api/feedback", {
        method: "POST",
        body: {
          category: input.kind,
          title: input.title,
          description: input.description,
          requestId: input.request_id,
          ...(input.report ? { report: input.report } : {}),
        },
      })) as { id?: unknown };
      if (typeof json?.id !== "string") throw new ApiError("Couldn't confirm your feedback was received. Please try again.", 0);
      return json.id;
    },
  };
}

export type Api = ReturnType<typeof create_api>;
