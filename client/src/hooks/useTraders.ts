import { useQuery } from '@tanstack/react-query';
import { tradersApi } from '../services/api';

export const useTraders = () => {
  return useQuery({
    queryKey: ['traders'],
    queryFn: tradersApi.getAll,
    staleTime: 60000, // 1 minute
  });
};
