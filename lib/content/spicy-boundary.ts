export type ContentBoundaryMode = "sweet" | "spicy";

type NsfwEntity = {
  isNSFW?: boolean | null;
  is_nsfw?: boolean | null;
};

export function getContentBoundaryMode(
  nsfwEnabled: boolean,
): ContentBoundaryMode {
  return nsfwEnabled ? "spicy" : "sweet";
}

export function isSpicyEntity(entity: NsfwEntity | null | undefined): boolean {
  return entity?.isNSFW === true || entity?.is_nsfw === true;
}

export function allowsEntityInBoundary(
  entity: NsfwEntity | null | undefined,
  mode: ContentBoundaryMode,
): boolean {
  return mode === "spicy" || !isSpicyEntity(entity);
}

export function filterEntitiesByBoundary<T extends NsfwEntity>(
  entities: T[],
  mode: ContentBoundaryMode,
): T[] {
  if (mode === "spicy") return entities;
  return entities.filter((entity) => allowsEntityInBoundary(entity, mode));
}

