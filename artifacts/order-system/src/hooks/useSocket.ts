import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getGetOrdersQueryKey, getGetOrdersSummaryQueryKey } from '@workspace/api-client-react';

let socket: Socket | null = null;

export function useSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) {
      const path = (import.meta.env.BASE_URL || '/') + 'socket.io';
      socket = io({ path });
    }

    const handleOrderUpdate = () => {
      queryClient.invalidateQueries({ queryKey: [getGetOrdersQueryKey()[0]] });
      queryClient.invalidateQueries({ queryKey: [getGetOrdersSummaryQueryKey()[0]] });
    };

    socket.on('order:created', handleOrderUpdate);
    socket.on('order:updated', handleOrderUpdate);

    return () => {
      socket?.off('order:created', handleOrderUpdate);
      socket?.off('order:updated', handleOrderUpdate);
    };
  }, [queryClient]);
}
