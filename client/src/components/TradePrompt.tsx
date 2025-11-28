import { useState } from 'react';
import { useTrade } from '../hooks';

interface TradePromptProps {
  traderName: string;
}

export const TradePrompt = ({ traderName }: TradePromptProps) => {
  const [prompt, setPrompt] = useState('');
  const {
    mutate: executeTrade,
    isPending,
    isSuccess,
    isError,
    data,
    error,
  } = useTrade(traderName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      executeTrade(prompt);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <fieldset className='fieldset'>
          <label className='label' htmlFor={`${traderName}-trade-prompt`}>
            <span className='label-text'>Trade Instruction</span>
          </label>
          <textarea
            id={`${traderName}-trade-prompt`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter trade prompt (e.g., 'Buy 10 shares of TSLA')"
            className='textarea textarea-bordered w-full'
            rows={3}
            disabled={isPending}
          />
          <label className='label'>
            <span className='label-text-alt'>
              Use natural language to describe your trade
            </span>
          </label>

          <button
            type='submit'
            disabled={isPending || !prompt.trim()}
            className='btn btn-primary w-full mt-2'
          >
            {isPending ? (
              <>
                <span className='loading loading-spinner'></span>
                Executing Trade...
              </>
            ) : (
              'Execute Trade'
            )}
          </button>
        </fieldset>
      </form>

      {/* Success Message */}
      {isSuccess && data && (
        <div className='alert alert-success mt-4'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='stroke-current shrink-0 h-6 w-6'
            fill='none'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <div>
            <div className='font-bold'>Trade Executed Successfully</div>
            <div className='text-sm'>{data.result}</div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {isError && (
        <div className='alert alert-error mt-4'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='stroke-current shrink-0 h-6 w-6'
            fill='none'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
          <div>
            <div className='font-bold'>Trade Failed</div>
            <div className='text-sm'>
              {error?.message || 'An error occurred'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
