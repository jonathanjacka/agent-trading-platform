import { useQuery } from '@tanstack/react-query';
import { tradersApi } from '../services/api';

export const usePortfolioHistory = (traderName: string, limit: number = 50) => {
  return useQuery({
    queryKey: ['portfolioHistory', traderName, limit],
    queryFn: () => tradersApi.getPortfolioHistory(traderName, limit),
    enabled: !!traderName,
  });
};
