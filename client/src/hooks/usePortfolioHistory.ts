import { useQuery } from '@tanstack/react-query';
import { tradersApi } from '../services/api';

export const usePortfolioHistory = (traderName: string, limit: number = 50) => {
  return useQuery({
    queryKey: ['portfolioHistory', traderName, limit],
    queryFn: () => tradersApi.getPortfolioHistory(traderName, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes - historical data doesn't change often
    enabled: !!traderName,
  });
};
