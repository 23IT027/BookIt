import { useEffect, useState, useCallback } from 'react';
import socketService from './socketService';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(socketService.isConnected());

  useEffect(() => {
    socketService.connect();

    const checkConnection = setInterval(() => {
      setIsConnected(socketService.isConnected());
    }, 1000);

    return () => {
      clearInterval(checkConnection);
    };
  }, []);

  return { isConnected, socketService };
}

export function useSlotUpdates(providerId, onSlotTaken, onBookingCancelled) {
  const { isConnected } = useSocket();

  useEffect(() => {
    if (!providerId || !isConnected) return;

    socketService.joinProvider(providerId);

    if (onSlotTaken) {
      socketService.onSlotTaken(onSlotTaken);
    }

    if (onBookingCancelled) {
      socketService.onBookingCancelled(onBookingCancelled);
    }

    return () => {
      socketService.leaveProvider(providerId);
      socketService.removeAllListeners();
    };
  }, [providerId, isConnected, onSlotTaken, onBookingCancelled]);

  return { isConnected };
}

export function useAvailabilityUpdates(providerId, onUpdate) {
  const { isConnected } = useSocket();

  useEffect(() => {
    if (!providerId || !isConnected) return;

    socketService.joinProvider(providerId);

    if (onUpdate) {
      socketService.onAvailabilityUpdated(onUpdate);
    }

    return () => {
      socketService.removeAllListeners();
    };
  }, [providerId, isConnected, onUpdate]);

  return { isConnected };
}

// Alias for useSlotUpdates for backward compatibility
export function useSlotEvents(providerId, callbacks = {}) {
  const { onSlotTaken, onBookingCancelled, onSlotUpdated } = callbacks;
  const { isConnected } = useSocket();

  useEffect(() => {
    if (!providerId || !isConnected) return;

    socketService.joinProvider(providerId);

    if (onSlotTaken) {
      socketService.onSlotTaken(onSlotTaken);
    }

    if (onBookingCancelled) {
      socketService.onBookingCancelled(onBookingCancelled);
    }

    if (onSlotUpdated) {
      socketService.on('slot-updated', onSlotUpdated);
    }

    return () => {
      socketService.leaveProvider(providerId);
      socketService.removeAllListeners();
    };
  }, [providerId, isConnected, onSlotTaken, onBookingCancelled, onSlotUpdated]);

  return { isConnected };
}
