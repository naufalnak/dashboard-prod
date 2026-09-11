import Skeleton from './Skeleton';

export default function TableSkeleton({
  rows = 5,
  columns = 6,
}) {
  return (
    <div className="table-skeleton">
      {/* Header */}
      <div className="table-skeleton-row header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height={18} radius={6} />
        ))}
      </div>

      {/* Body */}
      {Array.from({ length: rows }).map((_, r) => (
        <div className="table-skeleton-row" key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} height={14} radius={4} />
          ))}
        </div>
      ))}
    </div>
  );
}