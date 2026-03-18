import { useEffect, useState } from 'react';
import { hasSeenMobileMiniTour, setMobileMiniTourSeen } from '@/utils/storage';
import { settingsApi } from '@/api/settings.api';

export function useMiniTour() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const seen = await hasSeenMobileMiniTour();
        if (!seen && mounted) {
          setVisible(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const complete = async () => {
    setVisible(false);
    await setMobileMiniTourSeen();
    try {
      await settingsApi.updateMy({
        tour: {
          mobile: {
            completedAt: new Date().toISOString(),
          },
        },
      });
    } catch {
      // ignore backend error
    }
  };

  return {
    loading,
    visible,
    complete,
    dismiss: () => setVisible(false),
  };
}

