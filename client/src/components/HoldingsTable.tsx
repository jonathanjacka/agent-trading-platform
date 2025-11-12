import type { Holding } from '../types';

interface HoldingsTableProps {
  holdings: Holding[];
}

export const HoldingsTable = ({ holdings }: HoldingsTableProps) => {
  if (!holdings || holdings.length === 0) {
    return (
      <div className='text-center py-8 text-gray-500'>No holdings yet</div>
    );
  }

  return (
    <div className='overflow-x-auto'>
      <table className='min-w-full divide-y divide-gray-200'>
        <thead className='bg-gray-50'>
          <tr>
            <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Symbol
            </th>
            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Quantity
            </th>
            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Avg Price
            </th>
            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Current
            </th>
            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Value
            </th>
            <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Gain/Loss
            </th>
          </tr>
        </thead>
        <tbody className='bg-white divide-y divide-gray-200'>
          {holdings.map((holding) => {
            const gainPercentNum = parseFloat(holding.gainPercent);
            const isPositive = gainPercentNum >= 0;
            const gainColor = isPositive ? 'text-green-600' : 'text-red-600';

            return (
              <tr key={holding.symbol} className='hover:bg-gray-50'>
                <td className='px-4 py-3 whitespace-nowrap font-medium text-gray-900'>
                  {holding.symbol}
                </td>
                <td className='px-4 py-3 whitespace-nowrap text-right text-gray-900'>
                  {holding.quantity}
                </td>
                <td className='px-4 py-3 whitespace-nowrap text-right text-gray-600'>
                  ${holding.avgPrice.toFixed(2)}
                </td>
                <td className='px-4 py-3 whitespace-nowrap text-right text-gray-900'>
                  ${holding.currentPrice.toFixed(2)}
                </td>
                <td className='px-4 py-3 whitespace-nowrap text-right font-medium text-gray-900'>
                  $
                  {holding.currentValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td
                  className={`px-4 py-3 whitespace-nowrap text-right font-medium ${gainColor}`}
                >
                  $
                  {holding.gain.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  <span className='text-sm ml-1'>
                    ({isPositive ? '+' : ''}
                    {gainPercentNum.toFixed(2)}%)
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
