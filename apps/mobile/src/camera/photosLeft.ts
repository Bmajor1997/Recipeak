/** Home's and the camera's count of free photos: nothing while it's unknown (or for Premium, which has no limit). */
export const photos_left_text = (left: number | null | undefined) =>
  left == null ? null : left <= 0 ? "No free photos left" : left === 1 ? "1 free photo left" : `${left} free photos left`;
