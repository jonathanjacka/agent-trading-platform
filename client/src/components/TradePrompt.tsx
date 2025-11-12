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
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter trade prompt (e.g., 'Buy 10 shares of TSLA')"
            className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none'
            rows={3}
            disabled={isPending}
          />
        </div>

        <button
          type='submit'
          disabled={isPending || !prompt.trim()}
          className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200'
        >
          {isPending ? (
            <span className='flex items-center justify-center'>
              <svg
                className='animate-spin -ml-1 mr-3 h-5 w-5 text-white'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                ></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
              Executing Trade...
            </span>
          ) : (
            'Execute Trade'
          )}
        </button>
      </form>

      {/* Success Message */}
      {isSuccess && data && (
        <div className='mt-4 p-4 bg-green-50 border border-green-200 rounded-lg'>
          <div className='flex items-start'>
            <svg
              className='h-5 w-5 text-green-500 mt-0.5 mr-2'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                clipRule='evenodd'
              />
            </svg>
            <div className='flex-1'>
              <p className='text-sm font-medium text-green-800'>
                Trade Executed Successfully
              </p>
              <p className='text-sm text-green-700 mt-1'>{data.result}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {isError && (
        <div className='mt-4 p-4 bg-red-50 border border-red-200 rounded-lg'>
          <div className='flex items-start'>
            <svg
              className='h-5 w-5 text-red-500 mt-0.5 mr-2'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                clipRule='evenodd'
              />
            </svg>
            <div className='flex-1'>
              <p className='text-sm font-medium text-red-800'>Trade Failed</p>
              <p className='text-sm text-red-700 mt-1'>
                {error?.message || 'An error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
