import { usePortfolio, useTransactions, usePortfolioHistory } from '../hooks';
import { PortfolioChart } from './PortfolioChart';
import { HoldingsTable } from './HoldingsTable';
import { TransactionsTable } from './TransactionsTable';
import { TradePrompt } from './TradePrompt';

interface TraderCardProps {
  traderName: string;
  strategy: string;
}

export const TraderCard = ({ traderName, strategy }: TraderCardProps) => {
  const { data: portfolio, isLoading: portfolioLoading } =
    usePortfolio(traderName);
  const { data: transactions, isLoading: transactionsLoading } =
    useTransactions(traderName);
  const { data: history, isLoading: historyLoading } =
    usePortfolioHistory(traderName);

  if (portfolioLoading) {
    return (
      <div className='bg-white rounded-lg shadow-lg p-6 animate-pulse'>
        <div className='h-8 bg-gray-200 rounded w-3/4 mb-4'></div>
        <div className='h-4 bg-gray-200 rounded w-1/2'></div>
      </div>
    );
  }

  if (!portfolio) return null;

  const isPositive = portfolio.totalGainPercent >= 0;
  const gainColor = isPositive ? 'text-green-600' : 'text-red-600';
  const gainBg = isPositive ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className='bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-full'>
      {/* Header */}
      <div className='bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6'>
        <h2 className='text-2xl font-bold mb-2'>{traderName}</h2>
        <p className='text-blue-100 text-sm'>{strategy}</p>
      </div>

      {/* Portfolio Summary */}
      <div className='p-6 border-b'>
        <div className='grid grid-cols-2 gap-4 mb-4'>
          <div>
            <p className='text-sm text-gray-600'>Total Value</p>
            <p className='text-2xl font-bold'>
              $
              {portfolio.totalValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-600'>Cash</p>
            <p className='text-2xl font-bold'>
              $
              {portfolio.cash.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className={`${gainBg} rounded-lg p-4`}>
          <p className='text-sm text-gray-600 mb-1'>Total Gain/Loss</p>
          <div className='flex items-baseline gap-2'>
            <p className={`text-xl font-bold ${gainColor}`}>
              $
              {portfolio.totalGain.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className={`text-lg font-semibold ${gainColor}`}>
              ({isPositive ? '+' : ''}
              {portfolio.totalGainPercent.toFixed(2)}%)
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className='p-6 border-b'>
        <h3 className='text-lg font-semibold mb-4'>Portfolio History</h3>
        {historyLoading ? (
          <div className='h-48 bg-gray-100 rounded animate-pulse'></div>
        ) : (
          <PortfolioChart data={history || []} />
        )}
      </div>

      {/* Holdings */}
      <div className='p-6 border-b'>
        <h3 className='text-lg font-semibold mb-4'>Current Holdings</h3>
        <HoldingsTable holdings={portfolio.holdings} />
      </div>

      {/* Transactions */}
      <div className='p-6 border-b'>
        <h3 className='text-lg font-semibold mb-4'>Recent Transactions</h3>
        {transactionsLoading ? (
          <div className='h-32 bg-gray-100 rounded animate-pulse'></div>
        ) : (
          <TransactionsTable transactions={transactions || []} />
        )}
      </div>

      {/* Trade Prompt */}
      <div className='p-6 mt-auto'>
        <h3 className='text-lg font-semibold mb-4'>Execute Trade</h3>
        <TradePrompt traderName={traderName} />
      </div>
    </div>
  );
};
