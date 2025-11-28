import type { Holding } from '../types';

interface HoldingsTableProps {
  holdings: Holding[];
}

export const HoldingsTable = ({ holdings }: HoldingsTableProps) => {
  if (!holdings || holdings.length === 0) {
    return <div className='text-center py-8 opacity-50'>No holdings yet</div>;
  }

  return (
    <div className='overflow-x-auto'>
      <table className='table table-xs table-zebra'>
        <thead>
          <tr>
            <th>Symbol</th>
            <th className='text-right'>Qty</th>
            <th className='text-right'>Avg Price</th>
            <th className='text-right'>Current</th>
            <th className='text-right'>Value</th>
            <th className='text-right'>Gain/Loss</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => {
            const gainPercentNum = parseFloat(holding.gainPercent);
            const isPositive = gainPercentNum >= 0;

            return (
              <tr key={holding.symbol} className='hover'>
                <td>
                  <div className='badge badge-primary badge-outline'>
                    {holding.symbol}
                  </div>
                </td>
                <td className='text-right font-mono'>{holding.quantity}</td>
                <td className='text-right font-mono'>
                  ${holding.avgPrice.toFixed(2)}
                </td>
                <td className='text-right font-mono font-bold'>
                  ${holding.currentPrice.toFixed(2)}
                </td>
                <td className='text-right font-mono font-bold'>
                  $
                  {holding.currentValue.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td
                  className={`text-right font-mono font-bold ${
                    isPositive ? 'text-success' : 'text-error'
                  }`}
                >
                  $
                  {holding.gain.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                  <span className='text-xs ml-1'>
                    ({isPositive ? '+' : ''}
                    {gainPercentNum.toFixed(1)}%)
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
