import { PortfolioChart } from './PortfolioChart';
import type { PortfolioValue } from '../types';

interface PortfolioHistorySectionProps {
  history?: PortfolioValue[];
  isLoading: boolean;
}

export const PortfolioHistorySection = ({
  history,
  isLoading,
}: PortfolioHistorySectionProps) => {
  return (
    <div className='card-body p-6 border-t'>
      <h3 className='card-title text-lg'>Portfolio History</h3>
      {isLoading ? (
        <div className='skeleton h-48 w-full'></div>
      ) : (
        <PortfolioChart data={history || []} />
      )}
    </div>
  );
};
