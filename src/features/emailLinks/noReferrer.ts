import { useEffect } from 'react';

/**
 * The address holds the key (`hash`): no page this page links to or loads
 * from may receive it in a Referer header.
 */
export function useNoReferrer(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.prepend(meta);
    return () => meta.remove();
  }, []);
}
