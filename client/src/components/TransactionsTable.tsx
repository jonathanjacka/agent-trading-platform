import { format } from 'date-fns';
import type { Transaction } from '../types';

interface TransactionsTableProps {
  transactions: Transaction[];
}

export const TransactionsTable = ({ transactions }: TransactionsTableProps) => {
  if (!transactions || transactions.length === 0) {
    return (
      <div className='text-center py-8 text-gray-500'>No transactions yet</div>
    );
  }

  return (
    <div className='overflow-x-auto'>
      <table className='table table-xs table-pin-rows'>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Symbol</th>
            <th className='text-right'>Quantity</th>
            <th className='text-right'>Price</th>
            <th className='text-right'>Total</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const isBuy = transaction.type === 'BUY';
            const total = transaction.quantity * transaction.price;

            return (
              <tr key={transaction.id} className='hover'>
                <td className='text-xs'>
                  {format(new Date(transaction.timestamp), 'MMM d, HH:mm')}
                </td>
                <td>
                  <div
                    className={`badge badge-sm ${isBuy ? 'badge-success' : 'badge-error'}`}
                  >
                    {transaction.type}
                  </div>
                </td>
                <td>
                  <div className='badge badge-primary badge-outline badge-sm'>
                    {transaction.symbol}
                  </div>
                </td>
                <td className='text-right font-mono'>{transaction.quantity}</td>
                <td className='text-right font-mono'>
                  ${transaction.price.toFixed(2)}
                </td>
                <td className='text-right font-mono font-bold'>
                  $
                  {total.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {transactions.length > 0 && transactions[0].rationale && (
        <div className='alert alert-info mt-4'>
          <div>
            <div className='font-semibold'>Latest Trade Rationale:</div>
            <div className='prose prose-sm max-w-none mt-1'>
              <p>{transactions[0].rationale}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
