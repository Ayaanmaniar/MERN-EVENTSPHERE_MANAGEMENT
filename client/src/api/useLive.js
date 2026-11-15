import { useEffect, useRef } from 'react';
import { getSocket } from './socket';

// useLive(expoId, { 'schedule:changed': fn, 'booth:updated': fn, ... })
export default function useLive(expoId, handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const s = getSocket();
    const names = Object.keys(ref.current);
    const wrappers = names.map((n) => [n, (...a) => ref.current[n](...a)]);
    if (expoId) {
      const join = () => s.emit('expo:join', expoId);
      join();
      s.on('connect', join);
      wrappers.forEach(([n, f]) => s.on(n, f));
      return () => {
        s.emit('expo:leave', expoId);
        s.off('connect', join);
        wrappers.forEach(([n, f]) => s.off(n, f));
      };
    }
    wrappers.forEach(([n, f]) => s.on(n, f));
    return () => wrappers.forEach(([n, f]) => s.off(n, f));
  }, [expoId]);
}
