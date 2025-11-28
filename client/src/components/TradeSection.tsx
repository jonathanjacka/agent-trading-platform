import { TradePrompt } from './TradePrompt';

interface TradeSectionProps {
  traderName: string;
}

export const TradeSection = ({ traderName }: TradeSectionProps) => {
  return (
    <div className='card-body p-6 border-t mt-auto'>
      <h3 className='card-title text-lg'>Execute Trade</h3>
      <TradePrompt traderName={traderName} />
    </div>
  );
};
