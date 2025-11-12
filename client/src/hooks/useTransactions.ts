import { useQuery } from '@tanstack/react-query';
import { tradersApi } from '../services/api';

export const useTransactions = (traderName: string, limit: number = 10) => {
  return useQuery({
    queryKey: ['transactions', traderName, limit],
    queryFn: () => tradersApi.getTransactions(traderName, limit),
    enabled: !!traderName,
  });
};
