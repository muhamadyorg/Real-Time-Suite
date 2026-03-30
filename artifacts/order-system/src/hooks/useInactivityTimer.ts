import { useState, useEffect, useCallback, useRef } from 'react';

export function useInactivityTimer(timeoutSeconds: number, onTimeout: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    setSecondsLeft(timeoutSeconds);
  }, [timeoutSeconds]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onTimeoutRef.current();
          return timeoutSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      events.forEach(event => document.removeEventListener(event, resetTimer));
      clearInterval(interval);
    };
  }, [resetTimer, timeoutSeconds]);

  return { secondsLeft };
}
