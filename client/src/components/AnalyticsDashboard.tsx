import type { TraderAnalytics } from '../hooks/useAnalytics';
import { StatCard } from './StatCard';
import {
  LightningIcon,
  DollarIcon,
  ChartIcon,
  WarningIcon,
} from '../icons/analytics';

interface AnalyticsDashboardProps {
  analytics: TraderAnalytics | null;
  isLoading: boolean;
}

export function AnalyticsDashboard({
  analytics,
  isLoading,
}: AnalyticsDashboardProps) {
  if (isLoading) {
    return (
      <div className='flex justify-center items-center py-8'>
        <span className='loading loading-spinner loading-lg'></span>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className='alert alert-warning'>
        <WarningIcon />
        <span>No analytics data available.</span>
      </div>
    );
  }

  const { performance, financial, behavior } = analytics;

  return (
    <div className='space-y-4'>
      {/* Win Rate & Total P&L */}
      <div className='stats stats-vertical lg:stats-horizontal shadow w-full'>
        <StatCard
          title='Win Rate'
          value={`${Math.round(performance.winRateDecimal * 100)}%`}
          description={`${performance.successfulTrades} wins / ${performance.failedTrades} losses`}
          valueClassName={
            performance.winRateDecimal >= 0.7
              ? 'text-success'
              : performance.winRateDecimal >= 0.5
                ? 'text-warning'
                : 'text-error'
          }
          icon={<LightningIcon />}
        />
        <StatCard
          title='Total P&L'
          value={`$${financial.totalProfitLoss.toFixed(2)}`}
          description={`${financial.totalProfitLoss >= 0 ? '↗︎' : '↘︎'} From trades`}
          valueClassName={
            financial.totalProfitLoss >= 0 ? 'text-success' : 'text-error'
          }
          icon={<DollarIcon />}
        />
      </div>

      {/* Best Trade & Worst Trade */}
      <div className='stats stats-vertical lg:stats-horizontal shadow w-full'>
        <StatCard
          title='Best Trade'
          value={`$${financial.bestTradeGain.toFixed(2)}`}
          description='Maximum gain'
          valueClassName='text-success'
        />
        <StatCard
          title='Worst Trade'
          value={`$${financial.worstTradeLoss.toFixed(2)}`}
          description='Maximum loss'
          valueClassName='text-error'
        />
      </div>

      {/* Total Trades & Avg Trade Size */}
      <div className='stats stats-vertical lg:stats-horizontal shadow w-full'>
        <StatCard
          title='Total Trades'
          value={performance.totalTrades}
          description={`${behavior.tradesPerDay.toFixed(2)} per day avg`}
          icon={<ChartIcon />}
        />
        <StatCard
          title='Avg Trade Size'
          value={`$${financial.avgTradeSize.toFixed(2)}`}
          description='Per transaction'
        />
      </div>

      {/* Behavior Details */}
      <div className='card bg-base-200 shadow'>
        <div className='card-body'>
          <h3 className='card-title text-sm mb-2'>Trading Behavior</h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <p className='text-xs opacity-70'>Most Traded Symbol</p>
              <p className='text-xl font-semibold'>
                {behavior.mostTradedSymbol}
              </p>
            </div>
            <div>
              <p className='text-xs opacity-70'>Avg Execution Time</p>
              <p className='text-xl font-semibold'>
                {behavior.avgExecutionTimeMs.toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
