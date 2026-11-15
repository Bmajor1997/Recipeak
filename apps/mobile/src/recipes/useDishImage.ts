// Follows a shared cover photo that may still be being created on the server, checking every few seconds.
import { useEffect, useState } from "react";
import type { Api } from "../api/client";
import type { DishImage, Kind } from "./types";

export const POLL_MS = 3000;
export const MAX_POLLS = 40; // about two minutes, then the app's own art stays

/**
 * Returns the photo's full address once it's ready, or null meanwhile.
 * `lookUp` asks the server once even when nothing is known yet (for saved recipes kept without a photo).
 */
export function useDishImage(api: Api, kind: Kind, name: string, initial: DishImage, { lookUp = false } = {}) {
  const [image, setImage] = useState<DishImage>(initial);
  const [shownFor, setShownFor] = useState({ name, initial });
  if (shownFor.name !== name || shownFor.initial !== initial) {
    setShownFor({ name, initial });
    setImage(initial);
  }

  useEffect(() => {
    // Nothing to follow once ready; an unavailable photo is only asked about when lookUp is set, and only once per screen.
    if (image.status === "ready" || (image.status === "unavailable" && !lookUp)) return;
    let cancelled = false;
    let polls = 0;
    // Each check either settles the photo (ready or unavailable) and stops, or tries again, up to MAX_POLLS.
    const timer = setInterval(async () => {
      polls += 1;
      let next: DishImage | null = null;
      try {
        next = await api.dishImage(kind, name);
      } catch {
        next = null;
      }
      if (cancelled) return;
      const settled = next !== null && next.status !== "pending";
      if (settled || polls >= MAX_POLLS) {
        clearInterval(timer);
        setImage(settled && next ? next : { status: "unavailable", url: null });
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, kind, name, image.status, lookUp]);

  return { uri: api.imageUri(image.status === "ready" ? image.url : null), pending: image.status === "pending" };
}
