/** The same name cleanup the server uses, so "Piña Colada", "pina colada" and "PINA COLADA" all match. */
export function normalize_dish_name(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9&' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
