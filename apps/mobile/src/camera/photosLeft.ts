/** Home's and the camera's count of free photos: nothing while it's unknown (or for Premium, which has no limit). */
export const photos_left_text = (left: number | null | undefined) =>
  left == null ? null : left <= 0 ? "No free photos left" : left === 1 ? "1 free photo left" : `${left} free photos left`;

/**
 * What the recipe screen says when a photo can't be used. Neither uses a free photo. A blank or black photo usually
 * means the camera didn't capture (an emulator's virtual camera can do this), so the gallery is offered as well.
 */
export const not_food_message = (reason?: "unusable") =>
  reason === "unusable"
    ? "That photo came out blank or too dark to see the dish. Retake it in good light, or choose one from your photos. It didn't use a free photo."
    : "That doesn't look like a meal or a drink. Try again, closer up and in good light.";
