import { useQuery } from '@tanstack/react-query';
import { tradersApi } from '../services/api';

export const usePortfolio = (traderName: string) => {
  return useQuery({
    queryKey: ['portfolio', traderName],
    queryFn: () => tradersApi.getPortfolio(traderName),
    refetchInterval: 30000, // 30 seconds for real-time prices
    enabled: !!traderName,
  });
};
