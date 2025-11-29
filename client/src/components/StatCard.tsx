interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  valueClassName?: string;
  icon?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  description,
  valueClassName = '',
  icon,
}: StatCardProps) {
  return (
    <div className='stat'>
      {icon && <div className='stat-figure text-primary'>{icon}</div>}
      <div className='stat-title'>{title}</div>
      <div className={`stat-value ${valueClassName}`}>{value}</div>
      {description && <div className='stat-desc'>{description}</div>}
    </div>
  );
}
