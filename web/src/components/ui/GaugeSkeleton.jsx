import Skeleton from './Skeleton';

export default function GaugeSkeleton() {
  return (
    <div className="gauge-card">
      <Skeleton width="45%" height={18} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '14px 0',
        }}
      >
        <Skeleton width={120} height={120} radius="50%" />
      </div>

      <Skeleton width="60%" height={14} />
    </div>
  );
}