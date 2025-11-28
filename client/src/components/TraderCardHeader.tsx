import { useState } from 'react';

interface TraderCardHeaderProps {
  traderName: string;
  strategy: string;
}

export const TraderCardHeader = ({
  traderName,
  strategy,
}: TraderCardHeaderProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`bg-primary text-primary-content px-8 py-4 transition-all duration-300 ${isExpanded ? 'h-auto' : 'h-38'}`}
    >
      <div className='flex flex-col'>
        <h2 className='card-title text-xl break-words line-clamp-1 mb-2'>
          {traderName}
        </h2>
        <div
          className={`text-sm text-secondary-content ${isExpanded ? '' : 'line-clamp-3'}`}
        >
          {strategy}
        </div>
      </div>
      <div className='flex justify-end mt-2'>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className='btn btn-xs btn-ghost text-primary-content opacity-70 hover:opacity-100'
        >
          {isExpanded ? 'See Less' : 'See More'}
        </button>
      </div>
    </div>
  );
};
