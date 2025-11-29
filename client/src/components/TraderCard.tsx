import {
  usePortfolio,
  useTransactions,
  usePortfolioHistory,
  useTradeLogs,
  useAnalytics,
} from '../hooks';
import { TraderCardHeader } from './TraderCardHeader';
import { PortfolioSummary } from './PortfolioSummary';
import { PortfolioHistorySection } from './PortfolioHistorySection';
import { HoldingsSection } from './HoldingsSection';
import { TransactionsSection } from './TransactionsSection';
import { TradeSection } from './TradeSection';
import { TradeLogsTable } from './TradeLogsTable';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { useState } from 'react';

interface TraderCardProps {
  traderName: string;
  strategy: string;
}

export const TraderCard = ({ traderName, strategy }: TraderCardProps) => {
  const [showLogs, setShowLogs] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  const { data: portfolio, isLoading: portfolioLoading } =
    usePortfolio(traderName);
  const { data: transactions, isLoading: transactionsLoading } =
    useTransactions(traderName);
  const { data: history, isLoading: historyLoading } =
    usePortfolioHistory(traderName);
  const { logs, isLoading: logsLoading } = useTradeLogs(traderName, {
    limit: 20,
    autoRefresh: true,
  });
  const { analytics, isLoading: analyticsLoading } = useAnalytics(traderName, {
    autoRefresh: true,
  });

  if (portfolioLoading) {
    return (
      <div className='card bg-base-100 shadow-xl animate-pulse'>
        <div className='card-body'>
          <div className='h-8 bg-base-300 rounded w-3/4 mb-4'></div>
          <div className='h-4 bg-base-300 rounded w-1/2'></div>
        </div>
      </div>
    );
  }

  if (!portfolio) return null;

  return (
    <div className='card bg-base-100 shadow-xl flex flex-col h-full'>
      <TraderCardHeader traderName={traderName} strategy={strategy} />
      <PortfolioSummary
        totalValue={portfolio.totalValue}
        cash={portfolio.cash}
        totalGain={portfolio.totalGain}
        totalGainPercent={portfolio.totalGainPercent}
      />
      <PortfolioHistorySection history={history} isLoading={historyLoading} />
      <HoldingsSection holdings={portfolio.holdings} />

      {/* Recent Transactions Section */}
      <div className='card-body'>
        <div className='flex items-center justify-between mb-2'>
          <h3 className='card-title text-lg'>Recent Transactions</h3>
          <button
            className='btn btn-ghost btn-sm'
            onClick={() => setShowTransactions(!showTransactions)}
          >
            {showTransactions ? (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 15l7-7 7 7'
                />
              </svg>
            ) : (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            )}
          </button>
        </div>
        {showTransactions && (
          <TransactionsSection
            transactions={transactions}
            isLoading={transactionsLoading}
          />
        )}
      </div>

      {/* Analytics Dashboard Section */}
      <div className='card-body'>
        <div className='flex items-center justify-between mb-2'>
          <h3 className='card-title text-lg'>Performance Analytics</h3>
          <button
            className='btn btn-ghost btn-sm'
            onClick={() => setShowAnalytics(!showAnalytics)}
          >
            {showAnalytics ? (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 15l7-7 7 7'
                />
              </svg>
            ) : (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            )}
          </button>
        </div>
        {showAnalytics && (
          <AnalyticsDashboard
            analytics={analytics}
            isLoading={analyticsLoading}
          />
        )}
      </div>

      {/* Trade Logs Section */}
      <div className='card-body'>
        <div className='flex items-center justify-between mb-2'>
          <h3 className='card-title text-lg'>Trade History</h3>
          <button
            className='btn btn-ghost btn-sm'
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 15l7-7 7 7'
                />
              </svg>
            ) : (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            )}
          </button>
        </div>
        {showLogs && <TradeLogsTable logs={logs} isLoading={logsLoading} />}
      </div>

      <TradeSection traderName={traderName} />
    </div>
  );
};
