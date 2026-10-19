'use client';

import { useEffect, useState } from 'react';

/** "Good morning / afternoon / evening" by the viewer's own clock. */
export function Greeting() {
  const [text, setText] = useState('Welcome back');
  useEffect(() => {
    const h = new Date().getHours();
    setText(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);
  return <>{text}</>;
}
