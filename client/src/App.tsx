import { useTraders } from './hooks';
import { TraderCard } from './components';

function App() {
  const { data: traders, isLoading, error } = useTraders();

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-100 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto'></div>
          <p className='mt-4 text-gray-600 text-lg'>Loading traders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-100 flex items-center justify-center'>
        <div className='bg-white rounded-lg shadow-lg p-8 max-w-md'>
          <div className='text-red-500 mb-4'>
            <svg
              className='h-12 w-12 mx-auto'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                clipRule='evenodd'
              />
            </svg>
          </div>
          <h2 className='text-xl font-bold text-gray-900 mb-2 text-center'>
            Connection Error
          </h2>
          <p className='text-gray-600 text-center'>
            Unable to connect to the trading platform. Make sure the backend
            server is running on port 3000.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-100'>
      {/* Header */}
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-[1920px] mx-auto px-6 py-6'>
          <h1 className='text-3xl font-bold text-gray-900'>
            ACME Trading Platform
          </h1>
          <p className='text-gray-600 mt-1'>AI-Powered Autonomous Traders</p>
        </div>
      </header>

      {/* Main Content */}
      <main className='max-w-[1920px] mx-auto px-6 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6'>
          {traders?.map((trader) => (
            <div key={trader.name} className='flex'>
              <TraderCard traderName={trader.name} strategy={trader.strategy} />
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className='bg-white border-t mt-12'>
        <div className='max-w-[1920px] mx-auto px-6 py-4'>
          <p className='text-center text-gray-500 text-sm'>
            Real-time portfolio updates every 30 seconds
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
