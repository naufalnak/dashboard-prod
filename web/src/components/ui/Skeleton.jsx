export default function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  className = '',
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: radius,
      }}
    />
  );
}

// Skeleton rows for tables built with raw <table>/<tbody> (rather than the
// div-based TableSkeleton), so it can be dropped straight into a <tbody>.
export function TableRowsSkeleton({ rows = 5, columns = 6, colSpan }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {colSpan ? (
            <td colSpan={colSpan} style={{ padding: '10px 8px' }}>
              <Skeleton height={14} radius={4} />
            </td>
          ) : (
            Array.from({ length: columns }).map((_, c) => (
              <td key={c} style={{ padding: '10px 8px' }}>
                <Skeleton height={14} radius={4} />
              </td>
            ))
          )}
        </tr>
      ))}
    </>
  );
}