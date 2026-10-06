import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket({ onAlert } = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [settings, setSettings] = useState(null);
  const [alertConfigs, setAlertConfigs] = useState([]);
  const [status, setStatus] = useState({ youtube: {}, twitch: {} });
  const [viewerCount, setViewerCount] = useState({ youtube: null, twitch: null });
  const wsRef = useRef(null);
  const mountedRef = useRef(true);
  const reconnectTimerRef = useRef(null);
  const onAlertRef = useRef(onAlert);
  // L-18: exponential backoff delay ref
  const reconnectDelayRef = useRef(3000);

  useEffect(() => { onAlertRef.current = onAlert; }, [onAlert]);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.log('[Dashboard WS] Connected');
        // L-18: reset backoff on successful connect
        reconnectDelayRef.current = 3000;
        setIsConnected(true);
        fetch('/api/auth/status')
          .then(r => r.json())
          .then(d => {
            if (!mountedRef.current) return;
            if (d.youtube) setStatus(prev => ({ ...prev, youtube: { ...d.youtube, connected: d.youtube.isConnected || d.youtube.connected } }));
            if (d.twitch)  setStatus(prev => ({ ...prev, twitch:  { ...d.twitch,  connected: d.twitch.isConnected  || d.twitch.connected } }));
          })
          .catch((err) => console.error('[Dashboard WS] Status fetch error:', err));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const { event: ev, data } = JSON.parse(event.data);
          if (ev === 'init') {
            if (data.settings) setSettings(data.settings);
            if (data.alertConfigs) setAlertConfigs(data.alertConfigs);
            if (data.messages) setMessages(data.messages);
          } else if (ev === 'chat:message') {
            setMessages(prev => [...prev.slice(-199), data]);
          } else if (ev === 'chat:clear') {
            setMessages([]);
          } else if (ev === 'settings:update') {
            setSettings(data);
          } else if (ev === 'alertConfigs:update') {
            setAlertConfigs(data);
          } else if (ev === 'connection:status') {
            setStatus(prev => ({ ...prev, [data.platform]: data }));
          } else if (ev === 'viewer:count') {
            setViewerCount(prev => ({ ...prev, [data.platform]: data.count }));
          } else if (ev === 'alert:trigger') {
            if (onAlertRef.current) onAlertRef.current(data.type);
          }
        } catch (err) {
          console.error('[Dashboard WS] Error parsing message:', err);
        }
      };

      // L-18: Exponential backoff reconnect (3s → 4.5s → ... → max 30s)
      ws.onclose = () => {
        if (!mountedRef.current) return;
        const delay = reconnectDelayRef.current;
        console.log(`[Dashboard WS] Disconnected — reconnecting in ${(delay / 1000).toFixed(1)}s...`);
        setIsConnected(false);
        reconnectTimerRef.current = setTimeout(connect, delay);
        reconnectDelayRef.current = Math.min(delay * 1.5, 30000);
      };

      ws.onerror = (err) => {
        console.error('[Dashboard WS] Error:', err);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  const sendEvent = useCallback((event, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, data }));
    }
  }, []);

  return {
    isConnected,
    messages,
    settings,
    alertConfigs,
    status,
    viewerCount,
    sendEvent
    // M-13: removed unused exports setSettings/setAlertConfigs/setMessages
  };
}
