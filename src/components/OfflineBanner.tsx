import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = React.useState(false);
  const [showOnlineMessage, setShowOnlineMessage] = React.useState(false);

  React.useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowOnlineMessage(false);
    } else if (wasOffline) {
      // Show "back online" message briefly
      setShowOnlineMessage(true);
      const timer = setTimeout(() => {
        setShowOnlineMessage(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 text-center shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <WifiOff size={20} />
          <span className="font-medium">You're offline. Some features may be limited.</span>
        </div>
      </div>
    );
  }

  if (showOnlineMessage) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white px-4 py-2 text-center shadow-lg animate-slide-down">
        <div className="flex items-center justify-center gap-2">
          <Wifi size={20} />
          <span className="font-medium">You're back online!</span>
        </div>
      </div>
    );
  }

  return null;
};
