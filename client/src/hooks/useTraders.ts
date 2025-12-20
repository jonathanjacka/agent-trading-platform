import { useQuery } from '@tanstack/react-query';
import { tradersApi } from '../services/api';

export const useTraders = () => {
  return useQuery({
    queryKey: ['traders'],
    queryFn: tradersApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes - traders list rarely changes
  });
};
