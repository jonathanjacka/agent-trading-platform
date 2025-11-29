import { TransactionsTable } from './TransactionsTable';
import type { Transaction } from '../types';

interface TransactionsSectionProps {
  transactions?: Transaction[];
  isLoading: boolean;
}

export const TransactionsSection = ({
  transactions,
  isLoading,
}: TransactionsSectionProps) => {
  return (
    <div className='h-80 overflow-y-auto'>
      {isLoading ? (
        <div className='skeleton h-32 w-full'></div>
      ) : (
        <TransactionsTable transactions={transactions || []} />
      )}
    </div>
  );
};
