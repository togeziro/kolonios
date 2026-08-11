/**
 * Common type definitions used across the application.
 */

/**
 * Type for search/filter parameters that are typically passed as query strings.
 * Use this instead of `Record<string, unknown>` for better type safety and consistency.
 */
export type SearchParams = Record<string, unknown>;

/**
 * Type for navigation with search parameters.
 * Use this when working with TanStack Router's navigate function with search params.
 */
export type NavigateWithSearch = (opts: {
  search?: SearchParams | ((prev: SearchParams) => SearchParams);
  replace?: boolean;
}) => void;

/**
 * Navigation item type for sidebar/menu navigation.
 */
export interface NavItem {
  title: string;
  url: string;
  icon: string;
  isActive: boolean;
  shortcut?: string[];
  module: string;
  hiddenForAdmin?: boolean;
  items?: NavItem[];
}
