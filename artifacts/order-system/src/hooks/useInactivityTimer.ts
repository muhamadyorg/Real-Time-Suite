import { useState, useEffect, useRef } from 'react';

export function useInactivityTimer(timeoutSeconds: number, onTimeout: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const remainingRef = useRef(timeoutSeconds);

  useEffect(() => {
    remainingRef.current = timeoutSeconds;
    setSecondsLeft(timeoutSeconds);

    const reset = () => {
      remainingRef.current = timeoutSeconds;
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach(event => document.addEventListener(event, reset));

    const interval = setInterval(() => {
      remainingRef.current -= 1;
      const left = remainingRef.current;
      setSecondsLeft(left);
      if (left <= 0) {
        remainingRef.current = timeoutSeconds;
        setSecondsLeft(timeoutSeconds);
        onTimeoutRef.current();
      }
    }, 1000);

    return () => {
      events.forEach(event => document.removeEventListener(event, reset));
      clearInterval(interval);
    };
  }, [timeoutSeconds]);

  return { secondsLeft };
}
