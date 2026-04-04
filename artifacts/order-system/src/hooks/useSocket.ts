import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getGetOrdersQueryKey, getGetOrdersSummaryQueryKey } from '@workspace/api-client-react';

let socket: Socket | null = null;
let currentToken: string | null = null;

// settings:updated hodisasini eshituvchilar
type SettingsCb = (s: Record<string, boolean>) => void;
const _settingsCbs = new Set<SettingsCb>();

export function subscribeToSettingsUpdated(cb: SettingsCb): () => void {
  _settingsCbs.add(cb);
  return () => _settingsCbs.delete(cb);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    socket?.disconnect();
    socket = null;
    currentToken = null;
  });
}

function getOrCreateSocket(token: string | null): Socket {
  if (!socket) {
    socket = io({
      path: '/api/socket.io',
      auth: { token: token ?? '' },
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
  }

  if (token !== currentToken) {
    currentToken = token;
    socket.auth = { token: token ?? '' };
    if (socket.connected) {
      socket.disconnect();
    }
    if (token) {
      socket.connect();
    }
  } else if (token && !socket.connected) {
    socket.connect();
  }

  return socket;
}

export function useSocket(token: string | null = null, storeId: number | null = null) {
  const queryClient = useQueryClient();
  const storeIdRef = useRef(storeId);
  storeIdRef.current = storeId;

  useEffect(() => {
    const s = getOrCreateSocket(token);

    const invalidateOrders = () => {
      queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
      queryClient.invalidateQueries({ queryKey: [getGetOrdersSummaryQueryKey()[0]] });
    };

    const joinStore = () => {
      if (storeIdRef.current) {
        s.emit('join-store', storeIdRef.current);
      }
    };

    const handleConnect = () => {
      joinStore();
      invalidateOrders();
    };

    const handleReconnect = () => {
      joinStore();
      invalidateOrders();
    };

    const handleSettingsUpdated = (data: Record<string, boolean>) => {
      _settingsCbs.forEach(cb => cb(data));
    };

    s.on('connect', handleConnect);
    s.on('reconnect', handleReconnect);
    s.on('order:created', invalidateOrders);
    s.on('order:updated', invalidateOrders);
    s.on('order:deleted', invalidateOrders);
    s.on('settings:updated', handleSettingsUpdated);

    if (s.connected && storeId) {
      joinStore();
    }

    // When tab becomes visible → refetch immediately
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        invalidateOrders();
        if (storeIdRef.current && s.connected) {
          joinStore();
        } else if (token && !s.connected) {
          s.connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      s.off('connect', handleConnect);
      s.off('reconnect', handleReconnect);
      s.off('order:created', invalidateOrders);
      s.off('order:updated', invalidateOrders);
      s.off('order:deleted', invalidateOrders);
      s.off('settings:updated', handleSettingsUpdated);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [queryClient, token, storeId]);
}
