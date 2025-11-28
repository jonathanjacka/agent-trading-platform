import { useTraders } from './hooks';
import { TraderCard } from './components/TraderCard';
import { ThemeToggle } from './components/ThemeToggle';
import { Footer } from './components/Footer';

function App() {
  const { data: traders, isLoading, error } = useTraders();

  if (isLoading) {
    return (
      <div className='min-h-screen bg-base-200 flex items-center justify-center'>
        <div className='text-center'>
          <span className='loading loading-spinner loading-lg text-primary'></span>
          <p className='mt-4 text-base-content text-lg'>Loading traders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-base-200 flex items-center justify-center'>
        <div className='alert alert-error max-w-md shadow-lg'>
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
            <h3 className='font-bold'>Connection Error</h3>
            <div className='text-sm'>
              Unable to connect to the trading platform. Make sure the backend
              server is running on port 3000.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-base-200'>
      <div className='navbar bg-base-100 shadow-lg'>
        <div className='navbar-start'></div>
        <div className='navbar-center'>
          <h1 className='text-xl font-bold'>ACME Trading Platform</h1>
        </div>
        <div className='navbar-end gap-2'>
          <ThemeToggle />
          <div className='badge badge-warning badge-outline'>DEV</div>
        </div>
      </div>

      <main className='max-w-[1920px] mx-auto px-6 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6'>
          {traders?.map((trader) => (
            <TraderCard
              key={trader.name}
              traderName={trader.name}
              strategy={trader.strategy}
            />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
