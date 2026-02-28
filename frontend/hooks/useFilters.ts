import { useFilterContext, FilterState, FilterContextValue } from '@/contexts/FilterContext';

export type { FilterState, FilterContextValue };

/**
 * Custom hook that returns all filter context values.
 * Use this hook in any component or data hook that needs to read or update filters.
 */
export function useFilters(): FilterContextValue {
  return useFilterContext();
}

/**
 * Builds a full API URL path with filter query parameters appended.
 *
 * @param basePath - The base API path (e.g. "/metrics/overview")
 * @param extraParams - Optional additional params to merge with filter params
 * @param queryParams - The filter query params from toQueryParams()
 * @returns The params record to pass to apiGet
 *
 * Usage example in a data hook:
 *   const { toQueryParams } = useFilters();
 *   const params = buildApiParams('/metrics/overview', {}, toQueryParams());
 *   return apiGet('/metrics/overview', params);
 */
export function buildApiParams(
  extraParams: Record<string, string>,
  filterParams: Record<string, string>,
): Record<string, string> {
  return { ...filterParams, ...extraParams };
}
