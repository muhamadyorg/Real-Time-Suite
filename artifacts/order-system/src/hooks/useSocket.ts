import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getGetOrdersQueryKey, getGetOrdersSummaryQueryKey } from '@workspace/api-client-react';

let socket: Socket | null = null;
let currentToken: string | null = null;

// Disconnect old socket on HMR module replacement
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    socket?.disconnect();
    socket = null;
    currentToken = null;
  });
}

function getOrCreateSocket(token: string | null): Socket {
  // Socket.io lives on the API server, which is proxied via /api prefix.
  // The Replit proxy strips /api and forwards to the API server at /socket.io
  const socketPath = '/api/socket.io';

  if (!socket) {
    socket = io({
      path: socketPath,
      auth: { token: token ?? '' },
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
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

    const handleConnect = () => {
      if (storeIdRef.current) {
        s.emit('join-store', storeIdRef.current);
      }
    };

    const handleOrderUpdate = () => {
      queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
      queryClient.invalidateQueries({ queryKey: [getGetOrdersSummaryQueryKey()[0]] });
    };

    s.on('connect', handleConnect);
    s.on('order:created', handleOrderUpdate);
    s.on('order:updated', handleOrderUpdate);

    if (s.connected && storeId) {
      s.emit('join-store', storeId);
    }

    return () => {
      s.off('connect', handleConnect);
      s.off('order:created', handleOrderUpdate);
      s.off('order:updated', handleOrderUpdate);
    };
  }, [queryClient, token, storeId]);
}
