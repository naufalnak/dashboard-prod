import { useEffect, useRef, useState } from 'react';

// Mirrors the original animNum(): eases the displayed number from its
// previous value to the new target over ~600ms instead of jumping instantly.
export function useAnimatedNumber(target, decimals = 0) {
  const [display, setDisplay] = useState(target ?? 0);
  const prevRef = useRef(target ?? 0);

  useEffect(() => {
    if (target == null) return;
    const start = prevRef.current;
    const dur = 600, steps = 20;
    let i = 0;
    const t = setInterval(() => {
      i++;
      const v = start + (target - start) * (i / steps);
      setDisplay(i >= steps ? target : v);
      if (i >= steps) { prevRef.current = target; clearInterval(t); }
    }, dur / steps);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (display ?? 0).toFixed(decimals);
}
