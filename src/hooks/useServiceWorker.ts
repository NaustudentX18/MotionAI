/**
 * useServiceWorker.ts — SW registration, push notification subscription,
 * and update detection hook.
 */

import { useState, useEffect, useCallback } from 'react';

export type SwStatus = 'registering' | 'registered' | 'failed' | 'unsupported';
export type PushStatus = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'subscribing';

export function useServiceWorker() {
  const [swStatus, setSwStatus] = useState<SwStatus>('registering');
  const [pushStatus, setPushStatus] = useState<PushStatus>(
    'Notification' in window
      ? Notification.permission === 'granted'
        ? 'granted'
        : Notification.permission === 'denied'
          ? 'denied'
          : 'prompt'
      : 'unsupported'
  );
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwStatus('unsupported');
      return;
    }

    let isMounted = true;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        if (!isMounted) return;

        setRegistration(reg);
        setSwStatus('registered');

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        // Re-check push permission status
        if ('Notification' in window) {
          setPushStatus(
            Notification.permission === 'granted' ? 'granted' :
            Notification.permission === 'denied' ? 'denied' : 'prompt'
          );
        }
      } catch (err) {
        if (isMounted) {
          setSwStatus('failed');
          console.warn('SW registration failed:', err);
        }
      }
    };

    // Wait for load to register
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => {
        isMounted = false;
        window.removeEventListener('load', register);
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!registration || !('Notification' in window)) return false;

    setPushStatus('subscribing');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('denied');
        return false;
      }

      // Subscribe with a placeholder endpoint — real push requires
      // a VAPID key on the server. This sets up the plumbing so that
      // when VAPID is configured, push works.
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: undefined, // VAPID key goes here when configured
      });

      setPushStatus('granted');
      console.log('Push subscription:', subscription.endpoint);
      return true;
    } catch (err) {
      console.warn('Push subscription failed:', err);
      setPushStatus(
        Notification.permission === 'granted' ? 'granted' : 'denied'
      );
      return false;
    }
  }, [registration]);

  const skipUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  const activateUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [registration]);

  return {
    swStatus,
    pushStatus,
    updateAvailable,
    registration,
    subscribeToPush,
    skipUpdate,
    activateUpdate,
  };
}
