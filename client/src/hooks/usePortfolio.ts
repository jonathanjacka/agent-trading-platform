import { useQuery } from '@tanstack/react-query';
import { tradersApi } from '../services/api';

export const usePortfolio = (traderName: string) => {
  return useQuery({
    queryKey: ['portfolio', traderName],
    queryFn: () => tradersApi.getPortfolio(traderName),
    staleTime: 60000, // Data considered fresh for 1 minute
    refetchInterval: 60000, // Poll every 60 seconds (was 30s)
    refetchIntervalInBackground: false, // Don't poll when tab is hidden
    enabled: !!traderName,
  });
};
