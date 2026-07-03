import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type SubStatus = 'active' | 'trialing' | 'inactive' | 'loading';

// Considers the subscription valid while active/trialing and not expired.
export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubStatus>('loading');

  const load = useCallback(async () => {
    if (!user) { setStatus('inactive'); return; }
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) { setStatus('inactive'); return; }

    const notExpired = !data.current_period_end || new Date(data.current_period_end) > new Date();
    if ((data.status === 'active' || data.status === 'trialing') && notExpired) {
      setStatus(data.status as SubStatus);
    } else {
      setStatus('inactive');
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { status, isActive: status === 'active' || status === 'trialing', reload: load };
}
