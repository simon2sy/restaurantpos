// Helpers to normalise backend response shapes.
// DRF list endpoints may return a raw array, a paginated object ({results:[...]}),
// or a wrapped object ({data:[...]}). These helpers handle all cases.

export const toList = (payload) => {
  // Already an array — the common DRF non-paginated shape
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  // Paginated DRF shape
  if (Array.isArray(payload.results)) return payload.results;
  // Custom wrappers used by some endpoints
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.categories)) return payload.categories;
  if (Array.isArray(payload.items)) return payload.items;
  // Anything else (e.g. a plain object) must never be mapped over
  return [];
};

export const toObject = (payload) =>
  (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data))
    ? payload.data
    : (payload || {});
