import {
  usePortfolio,
  useTransactions,
  usePortfolioHistory,
} from '../hooks';
import { TraderCardHeader } from './TraderCardHeader';
import { PortfolioSummary } from './PortfolioSummary';
import { PortfolioHistorySection } from './PortfolioHistorySection';
import { HoldingsSection } from './HoldingsSection';
import { TransactionsSection } from './TransactionsSection';
import { TradeSection } from './TradeSection';

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
      <TransactionsSection
        transactions={transactions}
        isLoading={transactionsLoading}
      />
      <TradeSection traderName={traderName} />
    </div>
  );
};
