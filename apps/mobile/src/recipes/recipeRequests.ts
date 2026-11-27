// A response may publish only while the request that started it still owns the recipe flow.
export function create_recipe_requests() {
  let revision = 0;
  const invalidate = () => {
    revision += 1;
  };
  const capture = () => {
    const started = revision;
    return () => revision === started;
  };
  return {
    invalidate,
    capture,
    begin: () => {
      invalidate();
      return capture();
    },
  };
}
export type RecipeRequests = ReturnType<typeof create_recipe_requests>;
