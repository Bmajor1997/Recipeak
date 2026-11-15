/** Size of one photo on the wall and the space between photos, in points. */
export const WALL_TILE = 118;
export const WALL_GAP = 10;

/** Seconds each photo takes to slide past, so the wall drifts slowly rather than racing. */
const SECONDS_PER_PHOTO = 4;

/**
 * How one row of the wall moves. The row is drawn twice, end to end, and slides by exactly
 * one copy's width before starting over, so the loop has no visible jump.
 */
export function rowMotion(photoCount: number, reverse: boolean) {
  const distance = photoCount * (WALL_TILE + WALL_GAP);
  return {
    durationMs: photoCount * SECONDS_PER_PHOTO * 1000,
    from: reverse ? -distance : 0,
    to: reverse ? 0 : -distance,
  };
}
