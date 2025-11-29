import type { TradeLog } from '../hooks/useTradeLogs';
import { exportToCSV } from '../utils/csvExport';

interface TradeLogsTableProps {
  logs: TradeLog[];
  isLoading: boolean;
  traderName?: string;
}

export function TradeLogsTable({
  logs,
  isLoading,
  traderName = 'trader',
}: TradeLogsTableProps) {
  const handleExportCSV = () => {
    const exportData = logs.map((log) => ({
      timestamp: log.timestamp,
      action: log.action,
      symbol: log.symbol || '',
      quantity: log.quantity || '',
      price: log.price || '',
      success: log.success ? 'Yes' : 'No',
      execution_time_ms: log.execution_time_ms,
      prompt: log.prompt,
      rationale: log.rationale || '',
      error_message: log.error_message || '',
    }));

    const timestamp = new Date().toISOString().split('T')[0];
    exportToCSV(exportData, `${traderName}-trade-logs-${timestamp}`);
  };
  if (isLoading) {
    return (
      <div className='flex justify-center items-center py-8'>
        <span className='loading loading-spinner loading-lg'></span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className='alert alert-info'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          fill='none'
          viewBox='0 0 24 24'
          className='stroke-current shrink-0 w-6 h-6'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
          ></path>
        </svg>
        <span>No trade logs found for this trader.</span>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <div className='flex justify-end'>
        <button
          className='btn btn-sm btn-outline'
          onClick={handleExportCSV}
          disabled={logs.length === 0}
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='h-4 w-4 mr-1'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
            />
          </svg>
          Export CSV
        </button>
      </div>
      <div className='overflow-x-auto'>
        <table className='table table-zebra table-sm'>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Symbol</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Status</th>
              <th>Execution</th>
              <th>Prompt</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className='whitespace-nowrap'>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td>
                  <span
                    className={`badge badge-sm ${
                      log.action === 'BUY'
                        ? 'badge-success'
                        : log.action === 'SELL'
                          ? 'badge-warning'
                          : log.action === 'HOLD'
                            ? 'badge-info'
                            : 'badge-error'
                    }`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className='font-semibold'>{log.symbol || '-'}</td>
                <td>{log.quantity?.toLocaleString() || '-'}</td>
                <td>{log.price ? `$${log.price.toFixed(2)}` : '-'}</td>
                <td>
                  {log.success ? (
                    <div className='flex items-center gap-1 text-success'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='h-4 w-4'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                      <span className='text-xs'>Success</span>
                    </div>
                  ) : (
                    <div className='flex items-center gap-1 text-error'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        className='h-4 w-4'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                      <span className='text-xs'>Failed</span>
                    </div>
                  )}
                </td>
                <td className='text-xs'>{log.execution_time_ms}ms</td>
                <td className='max-w-xs truncate text-xs' title={log.prompt}>
                  {log.prompt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
