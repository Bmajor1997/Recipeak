/** Where to place a photo of the given shape (height ÷ width) inside a frame. Kept apart from the component so it can be tested without React Native. */
export function coverPlacement(frameWidth: number, frameHeight: number, aspect: number | null, focus = 0.3) {
  if (!aspect) return null;
  const imageHeight = frameWidth * aspect;
  // A photo wider than the frame (rare) is handled by the normal centre crop.
  if (imageHeight <= frameHeight) return null;
  return { width: frameWidth, height: imageHeight, top: -Math.round((imageHeight - frameHeight) * focus) };
}
