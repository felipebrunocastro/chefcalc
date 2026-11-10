import { useEffect, useState } from 'react';

// Roteador mínimo (History API): '/', '/app', '/entrar', '/cadastro'.
const EVT = 'chefcalc:navigate';

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(EVT));
  if (!path.includes('#')) window.scrollTo({ top: 0 });
}

export function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener('popstate', on);
    window.addEventListener(EVT, on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener(EVT, on); };
  }, []);
  return path;
}
