import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tradersApi } from '../services/api';

export const useTrade = (traderName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prompt: string) => tradersApi.executeTrade(traderName, prompt),
    onSuccess: () => {
      // Invalidate queries to refresh data after trade
      queryClient.invalidateQueries({ queryKey: ['portfolio', traderName] });
      queryClient.invalidateQueries({ queryKey: ['transactions', traderName] });
      queryClient.invalidateQueries({
        queryKey: ['portfolioHistory', traderName],
      });
    },
  });
};
