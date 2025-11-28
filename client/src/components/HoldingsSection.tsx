import { HoldingsTable } from './HoldingsTable';
import type { Holding } from '../types';

interface HoldingsSectionProps {
  holdings: Holding[];
}

export const HoldingsSection = ({ holdings }: HoldingsSectionProps) => {
  return (
    <div className='card-body p-6 border-t'>
      <h3 className='card-title text-lg mb-4'>Current Holdings</h3>
      <div className='h-64 overflow-y-auto'>
        <HoldingsTable holdings={holdings} />
      </div>
    </div>
  );
};
