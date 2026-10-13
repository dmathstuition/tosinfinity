'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

function keyToBytes(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Opt-in device notifications. Shown only where the browser supports Web Push. */
export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<'unsupported' | 'off' | 'on' | 'blocked' | 'busy'>('busy');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('blocked');
    navigator.serviceWorker.getRegistration().then(async (reg) => setState((await reg?.pushManager.getSubscription()) ? 'on' : 'off')).catch(() => setState('off'));
  }, []);

  const enable = async () => {
    setState('busy');
    setNote('');
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setState(Notification.permission === 'denied' ? 'blocked' : 'off');
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidKey) });
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error('save failed');
      setState('on');
    } catch {
      setState('off');
      setNote('Notifications could not be turned on for this device.');
    }
  };

  const disable = async () => {
    setState('busy');
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState('off');
  };

  if (state === 'unsupported') return <p className="text-sm text-muted">This browser does not support device notifications. You will still see notifications inside your account.</p>;
  if (state === 'blocked') return <p className="text-sm text-muted">Notifications are blocked for this site in your browser settings.</p>;
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted">{state === 'on' ? 'This device will receive notifications about classes, work and messages.' : 'Get a notification on this device for classes, work and messages.'}</p>
      <div>
        {state === 'on'
          ? <Button variant="outline" size="sm" onClick={disable}>Turn off on this device</Button>
          : <Button variant="secondary" size="sm" onClick={enable} disabled={state === 'busy'}>{state === 'busy' ? 'Please wait…' : 'Turn on notifications'}</Button>}
      </div>
      <p role="status" className="text-sm text-bad">{note}</p>
    </div>
  );
}
