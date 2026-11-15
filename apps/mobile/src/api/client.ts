// Talks to the Meals and Mixers backend. The OpenAI key never reaches the phone: only the user's Firebase ID token is sent.
import { parse_allowance, parse_dish_image, parse_identification, parse_recipe } from "../recipes/parse";
import type { Allowance, Diet, DishImage, Identification, Kind, Recipe } from "../recipes/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
  /** The free photos are used up: show the upgrade screen. */
  get needsUpgrade() {
    return this.code === "FREE_PHOTOS_USED";
  }
}

type Deps = { baseUrl: string | undefined; id_token: () => Promise<string | null>; fetch_impl?: typeof fetch; timeoutMs?: number };

export function create_api({ baseUrl, id_token, fetch_impl = fetch, timeoutMs = 75_000 }: Deps) {
  async function request(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<unknown> {
    if (!baseUrl) throw new ApiError("This build isn't connected to the recipe server yet.", 0);
    const token = await id_token();
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
      if ((error as Error)?.name === "AbortError") throw new ApiError("That took too long. Check your connection and try again.", 0);
      throw new ApiError("Couldn't reach the recipe server. Check your connection and try again.", 0);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async identify(imageDataUrl: string): Promise<Identification> {
      return parse_identification(await request("/api/identify", { method: "POST", body: { image: imageDataUrl } }));
    },
    async recipe(name: string, kind: Kind, diet?: Diet): Promise<{ recipe: Recipe; image: DishImage }> {
      const json = (await request("/api/recipe", { method: "POST", body: { name, kind, ...(diet ? { diet } : {}) } })) as {
        recipe?: unknown;
        image?: unknown;
      };
      return { recipe: parse_recipe(json?.recipe), image: parse_dish_image(json?.image) };
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
  };
}

export type Api = ReturnType<typeof create_api>;
