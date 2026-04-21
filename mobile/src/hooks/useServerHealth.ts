import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { axiosInstance } from '@/api/axios.instance';

export type ServerHealthStatus = 'checking' | 'online' | 'offline';

type Options = {
  timeoutMs?: number;
};

export function useServerHealth(options: Options = {}) {
  const { timeoutMs = 2500 } = options;
  const [status, setStatus] = useState<ServerHealthStatus>('checking');

  const check = useCallback(async () => {
    setStatus('checking');
    try {
      await axiosInstance.get('/health', { timeout: timeoutMs });
      setStatus('online');
    } catch (e) {
      // Network errors, timeouts, CORS-like issues → treat as offline.
      if (axios.isAxiosError(e)) {
        setStatus('offline');
        return;
      }
      setStatus('offline');
    }
  }, [timeoutMs]);

  useEffect(() => {
    void check();
  }, [check]);

  return { status, check };
}

