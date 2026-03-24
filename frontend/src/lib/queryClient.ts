import { QueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

export const queryClient = new QueryClient();

const hasPrefix = (queryKey: QueryKey, prefixes: readonly string[]) => {
  const [firstKey] = queryKey;
  return typeof firstKey === 'string' && prefixes.some((prefix) => firstKey.startsWith(prefix));
};

const clearQueriesByPrefix = (prefixes: readonly string[]) => {
  queryClient.removeQueries({
    predicate: (query) => hasPrefix(query.queryKey, prefixes),
  });
  queryClient.getMutationCache().clear();
};

export const clearStaffQueryCache = () => {
  clearQueriesByPrefix(['staff-', 'support-tickets', 'support-messages', 'team-members', 'staff-client-documents', 'staff-chart-of-accounts']);
};

export const clearClientQueryCache = () => {
  clearQueriesByPrefix(['client-dashboard-', 'client-support-', 'client-documents']);
};
