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
      <table className='min-w-full divide-y divide-gray-200'>
        <thead className='bg-gray-50'>
          <tr>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Date
            </th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Type
            </th>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Symbol
            </th>
            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Quantity
            </th>
            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Price
            </th>
            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Total
            </th>
          </tr>
        </thead>
        <tbody className='bg-white divide-y divide-gray-200'>
          {transactions.map((transaction) => {
            const isBuy = transaction.type === 'BUY';
            const badgeColor = isBuy
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800';
            const total = transaction.quantity * transaction.price;

            return (
              <tr key={transaction.id} className='hover:bg-gray-50'>
                <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-600'>
                  {format(new Date(transaction.timestamp), 'MMM d, HH:mm')}
                </td>
                <td className='px-4 py-3 whitespace-nowrap'>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badgeColor}`}
                  >
                    {transaction.type}
                  </span>
                </td>
                <td className='px-4 py-3 whitespace-nowrap font-medium text-gray-900'>
                  {transaction.symbol}
                </td>
                <td className='px-4 py-3 whitespace-nowrap text-right text-gray-900'>
                  {transaction.quantity}
                </td>
                <td className='px-4 py-3 whitespace-nowrap text-right text-gray-900'>
                  ${transaction.price.toFixed(2)}
                </td>
                <td className='px-4 py-3 whitespace-nowrap text-right font-medium text-gray-900'>
                  $
                  {total.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {transactions.length > 0 && transactions[0].rationale && (
        <div className='mt-4 p-4 bg-blue-50 rounded-lg'>
          <p className='text-sm font-medium text-gray-700 mb-1'>
            Latest Trade Rationale:
          </p>
          <p className='text-sm text-gray-600'>{transactions[0].rationale}</p>
        </div>
      )}
    </div>
  );
};
