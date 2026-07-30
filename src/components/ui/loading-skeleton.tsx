import { Skeleton } from './skeleton';

export function LoadingSkeleton({
  rows = 5,
  className
}: {
  rows?: number | string[];
  className?: string;
}) {
  const rowClasses =
    typeof rows === 'number' ? Array.from({ length: rows }, () => 'h-12 w-full') : rows;

  return (
    <div className='space-y-2'>
      {rowClasses.map((cls, i) => (
        <Skeleton key={i} className={`${cls}${className ? ` ${className}` : ''}`} />
      ))}
    </div>
  );
}
