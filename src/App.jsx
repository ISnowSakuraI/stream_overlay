import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { useWebSocket } from './hooks/useWebSocket';
import { useNotificationSound } from './hooks/useNotificationSound';

import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import AlertsPage from './pages/AlertsPage';
import OverlayPage from './pages/OverlayPage';
import TTSPage from './pages/TTSPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  // Declare ref first — it holds the playNotification function once the hook is ready.
  // Using a ref (not state) means the onAlert callback passed to useWebSocket never
  // changes identity, so the WebSocket effect does not re-run on every settings update.
  const playRef = React.useRef(null);

  const {
    isConnected, messages, settings, alertConfigs, status, viewerCount, sendEvent
  } = useWebSocket({
    // This stable function closure reads playRef.current at call-time, so it always
    // uses the latest version of playNotification without any stale-closure issue.
    onAlert: (alertType) => playRef.current?.(alertType),
  });

  // After settings arrive from the server, update the ref with the real function.
  const { playNotification } = useNotificationSound(settings);
  playRef.current = playNotification;

  return (
    <div className="app-container">
      <Sidebar isConnected={isConnected} status={status} />
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={<DashboardPage messages={messages} status={status} viewerCount={viewerCount} sendEvent={sendEvent} />}
          />
          <Route
            path="/chat"
            element={<ChatPage messages={messages} />}
          />
          <Route
            path="/alerts"
            element={<AlertsPage alertConfigs={alertConfigs} sendEvent={sendEvent} />}
          />
          <Route
            path="/overlay"
            element={<OverlayPage settings={settings} sendEvent={sendEvent} />}
          />
          <Route
            path="/tts"
            element={<TTSPage settings={settings} />}
          />
          <Route
            path="/settings"
            element={<SettingsPage settings={settings} status={status} />}
          />
        </Routes>
      </main>
    </div>
  );
}
