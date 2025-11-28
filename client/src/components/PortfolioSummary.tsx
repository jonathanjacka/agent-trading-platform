interface PortfolioSummaryProps {
  totalValue: number;
  cash: number;
  totalGain: number;
  totalGainPercent: number;
}

export const PortfolioSummary = ({
  totalValue,
  cash,
  totalGain,
  totalGainPercent,
}: PortfolioSummaryProps) => {
  const isPositive = totalGainPercent >= 0;

  return (
    <div className='card-body p-6 space-y-4'>
      <div className='stats shadow w-full h-32'>
        <div className='stat place-items-center'>
          <div className='stat-title text-lg'>Total Gain/Loss</div>
          <div
            className={`stat-value text-4xl ${isPositive ? 'text-success' : 'text-error'}`}
          >
            {isPositive ? '+' : ''}
            {totalGainPercent.toFixed(2)}%
          </div>
          <div className='stat-desc text-base'>
            $
            {totalGain.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      <div className='stats stats-horizontal shadow w-full h-28'>
        <div className='stat place-items-center'>
          <div className='stat-title'>Total Value</div>
          <div className='stat-value text-primary text-xl'>
            $
            {totalValue.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
          <div className='stat-desc'>Portfolio</div>
        </div>
        <div className='stat place-items-center'>
          <div className='stat-title'>Cash</div>
          <div className='stat-value text-secondary text-xl'>
            $
            {cash.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </div>
          <div className='stat-desc'>Available</div>
        </div>
      </div>
    </div>
  );
};
