import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useOfflineStatus() {
    const [isOffline, setIsOffline] = useState(false);
    const [connectionType, setConnectionType] = useState<string>('unknown');

    useEffect(() => {
        // Get initial state
        NetInfo.fetch().then(state => {
            setIsOffline(!state.isConnected);
            setConnectionType(state.type);
        });

        // Subscribe to network state changes
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
            setConnectionType(state.type);
        });

        return () => unsubscribe();
    }, []);

    return {
        isOffline,
        isConnected: !isOffline,
        connectionType
    };
}
