# WebSocket Auto-Refresh Implementation Guide

## Overview

This implementation adds real-time WebSocket communication between your AlphaESS API server and frontend, enabling:

1. **Automatic auto-refresh disable** when 503 status is returned on login
2. **Real-time connection status updates** via WebSocket
3. **Automatic auto-refresh restart** when ModBus reconnects during an active session
4. **Proper state management** using Pinia store

## Architecture

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│   Vue Frontend  │◄────────────────────────────┤   API Server     │
│                 │                             │                  │
│  - Pinia Store  │    modbus_connected event  │  - WebSocket     │
│  - Auto-refresh │◄────────────────────────────┤  - DataCollector │
│  - WebSocket    │                             │  - ModBus Client │
└─────────────────┘                             └──────────────────┘
        │                                               │
        │                                               │
        └───────── HTTP API Calls ────────────────────►│
                   (returns 503 if no ModBus)
```

## Key Features

### 1. Auto-Refresh Management
- ✅ Starts when ModBus is connected
- ✅ Stops immediately on 503 response
- ✅ Restarts automatically when ModBus reconnects
- ✅ User can manually pause/resume (only when connected)

### 2. WebSocket Events
- `modbus_connected` - Triggers auto-refresh restart
- `modbus_disconnected` - Triggers auto-refresh stop
- `power_update` - Real-time power data updates
- `connection_status` - Periodic status checks

### 3. State Management
- Centralized in Pinia store
- Reactive connection status
- Auto-refresh control
- Error handling

## Installation Steps

### Step 1: Install Dependencies

```bash
# Backend
npm install ws

# Frontend (if not already installed)
npm install pinia
```

### Step 2: Backend Files

#### A. Update `src/services/dataCollector.js`

Replace with: `dataCollector_with_websocket.js`

Key changes:
- Added `updateConnectionStatus()` method
- Detects connection state changes
- Broadcasts to WebSocket server on state change

#### B. Create `src/services/websocketServer.js`

Copy: `websocketServer.js`

Features:
- WebSocket server on `/ws/power-data`
- Monitors ModBus connection state
- Broadcasts connection events to all clients
- Periodic power data updates
- Heartbeat to detect dead connections

#### C. Update `src/app.js` or `src/index.js`

Replace with: `app_with_websocket.js`

Changes:
- Creates HTTP server (for WebSocket)
- Initializes WebSocket server
- Links dataCollector to WebSocket server

### Step 3: Frontend Files

#### A. Create Store: `src/stores/systemStore.js`

Copy: `systemStore.js`

Features:
- Auto-refresh management
- Connection state tracking
- API call handling with 503 detection
- Methods to start/stop auto-refresh

#### B. Create Service: `src/services/websocketService.js`

Copy: `websocketService.js`

Features:
- WebSocket connection management
- Automatic reconnection
- Event handling system
- Integration with system store

#### C. Update Main Component: `src/App.vue`

Replace with: `App_complete.vue`

Changes:
- Integrates system store
- Connects to WebSocket
- Sets up event listeners
- Initializes on mount

#### D. Create/Update Banner: `src/components/ConnectionStatusBanner.vue`

Copy: `ConnectionStatusBanner_enhanced.vue`

Features:
- Shows connection status
- Auto-refresh indicator (LIVE/PAUSED)
- Pause/Resume button
- Retry button
- Last update timestamp

### Step 4: Configure Pinia (if not already done)

In `src/main.js`:

```javascript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.mount('#app');
```

## Usage in Components

### Example: Dashboard Component

```vue
<template>
  <div class="dashboard">
    <h1>AlphaESS Monitor</h1>
    
    <!-- Show connection status -->
    <div v-if="!systemStore.isConnected" class="warning">
      ModBus disconnected - showing cached data
    </div>

    <!-- System data -->
    <div v-if="systemStore.systemData.status">
      <p>Battery SOC: {{ systemStore.systemData.status.battery.soc }}%</p>
      <p>PV Power: {{ systemStore.systemData.status.pv.power }}W</p>
      <p>Grid Power: {{ systemStore.systemData.status.grid.power }}W</p>
    </div>

    <!-- Manual refresh button -->
    <button @click="refresh" :disabled="systemStore.isLoading">
      {{ systemStore.isLoading ? 'Loading...' : 'Refresh' }}
    </button>
  </div>
</template>

<script setup>
import { useSystemStore } from '@/stores/systemStore';

const systemStore = useSystemStore();

async function refresh() {
  await systemStore.manualRefresh();
}
</script>
```

## WebSocket Message Types

### From Server to Client

#### 1. `modbus_connected`
Sent when ModBus connection is restored.

```json
{
  "type": "modbus_connected",
  "timestamp": "2025-01-06T10:30:00.000Z",
  "message": "ModBus connection restored - auto-refresh should restart"
}
```

**Client Action:** Restart auto-refresh

#### 2. `modbus_disconnected`
Sent when ModBus connection is lost.

```json
{
  "type": "modbus_disconnected",
  "timestamp": "2025-01-06T10:30:00.000Z",
  "message": "ModBus connection lost - auto-refresh should stop"
}
```

**Client Action:** Stop auto-refresh

#### 3. `power_update`
Periodic power data updates (every 10 seconds when connected).

```json
{
  "type": "power_update",
  "data": {
    "battery": { "soc": 85, "power": -1500 },
    "pv": { "power": 3200 },
    "grid": { "power": 200 },
    "load": { "power": 1900 }
  },
  "timestamp": "2025-01-06T10:30:00.000Z"
}
```

**Client Action:** Update UI with new data

#### 4. `connection_status`
Connection status information.

```json
{
  "type": "connection_status",
  "connected": true,
  "connectionStatus": {
    "connected": true,
    "lastAttempt": "2025-01-06T10:30:00.000Z",
    "errorMessage": null
  },
  "timestamp": "2025-01-06T10:30:00.000Z"
}
```

### From Client to Server

#### 1. `request_status`
Request current connection status.

```json
{
  "type": "request_status"
}
```

#### 2. `ping`
Heartbeat ping.

```json
{
  "type": "ping"
}
```

**Server Response:** `pong`

## Flow Diagrams

### Login Flow with 503 Handling

```
User loads page
    │
    ├─► Store.initialize()
    │       │
    │       ├─► Fetch complete-status
    │       ├─► Fetch pv-details  
    │       └─► Fetch dispatch-status
    │
    ├─► Any returns 503?
    │       │
    │       YES ─► isConnected = false
    │       │      autoRefreshEnabled = false
    │       │      Show error banner
    │       │
    │       NO ──► isConnected = true
    │              Start auto-refresh
    │              Show connected banner
    │
    └─► Connect WebSocket
            Listen for connection events
```

### Reconnection Flow During Session

```
ModBus disconnects
    │
    ├─► DataCollector detects disconnect
    │       │
    │       └─► updateConnectionStatus(false, error)
    │               │
    │               └─► WebSocketServer.broadcastModbusDisconnected()
    │
    └─► Client receives 'modbus_disconnected' event
            │
            └─► Store.handleConnectionLost()
                    │
                    ├─► isConnected = false
                    ├─► Stop auto-refresh
                    └─► Update banner (red)

─── Time passes ───

ModBus reconnects
    │
    ├─► DataCollector reconnects successfully
    │       │
    │       └─► updateConnectionStatus(true, null)
    │               │
    │               └─► WebSocketServer.broadcastModbusConnected()
    │
    └─► Client receives 'modbus_connected' event
            │
            └─► Store.handleConnectionRestored()
                    │
                    ├─► isConnected = true
                    ├─► Load fresh data
                    ├─► Start auto-refresh
                    └─► Update banner (green)
```

## Testing

### Test 1: Initial Load with ModBus Disconnected

1. Stop AlphaESS inverter
2. Start API server
3. Open frontend
4. **Expected:**
   - Red banner: "ModBus Disconnected"
   - No auto-refresh running
   - Error message displayed
   - No data visible (or cached data)

### Test 2: Auto-Refresh Stops on 503

1. Start with ModBus connected
2. Auto-refresh should be running (LIVE badge)
3. Stop AlphaESS inverter
4. **Expected:**
   - Within 5 seconds, banner turns red
   - Auto-refresh stops immediately
   - "ModBus Disconnected" message
   - Last update timestamp frozen

### Test 3: Auto-Refresh Restarts on Reconnection

1. Start with ModBus disconnected (red banner)
2. Restart AlphaESS inverter
3. Wait for reconnection (check server logs)
4. **Expected:**
   - Within 10 seconds, WebSocket event received
   - Banner turns green automatically
   - Auto-refresh restarts (LIVE badge appears)
   - Fresh data loads
   - Updates resume every 5 seconds

### Test 4: Manual Pause/Resume

1. With ModBus connected
2. Click "Pause" button
3. **Expected:**
   - Badge changes to "PAUSED"
   - Auto-refresh stops
   - Banner stays green
   - Can click "Resume" to restart

### Test 5: WebSocket Disconnection

1. Stop API server
2. **Expected:**
   - WebSocket attempts reconnection
   - Status indicator shows "Disconnected" (if debug enabled)
   - Frontend continues working with last data
   - When server restarts, WebSocket reconnects automatically

## Configuration Options

### Backend Configuration

In `dataCollector_with_websocket.js`:

```javascript
// Snapshot collection interval (also reconnection attempts)
snapshotInterval: 10000  // 10 seconds

// WebSocket power update interval
powerUpdateInterval: 10000  // 10 seconds in websocketServer.js

// Connection monitoring interval
connectionCheckInterval: 5000  // 5 seconds in websocketServer.js
```

### Frontend Configuration

In `systemStore.js`:

```javascript
// Auto-refresh interval
startAutoRefresh(5000)  // 5 seconds

// In App_complete.vue
const showDebug = ref(false)  // Enable WebSocket debug indicator
```

In `websocketService.js`:

```javascript
maxReconnectAttempts: 10
reconnectDelay: 3000  // 3 seconds base delay
```

## Troubleshooting

### Auto-refresh doesn't stop on disconnect

1. Check server logs for connection state changes
2. Verify WebSocket is connected (check debug indicator)
3. Check browser console for `modbus_disconnected` event
4. Verify store `handleConnectionLost()` is called

### Auto-refresh doesn't restart on reconnect

1. Check server logs for "ModBus connection restored"
2. Verify WebSocket sends `modbus_connected` event
3. Check browser console for event reception
4. Verify store `handleConnectionRestored()` is called
5. Check `isConnected` state in store

### WebSocket not connecting

1. Verify server started with WebSocket support
2. Check WebSocket URL matches server (default: `ws://localhost:3000/ws/power-data`)
3. Check browser console for connection errors
4. Verify no CORS issues
5. Check firewall settings

### 503 responses but auto-refresh still running

1. Verify `loadAllData()` checks for 503 status
2. Check `Promise.allSettled()` is handling responses correctly
3. Verify `stopAutoRefresh()` is called when 503 detected
4. Check browser network tab for actual status codes

## API Endpoints Status Reference

### Always Available (Work without ModBus)
- ✅ `GET /api/health` - Server health
- ✅ `GET /api/alphaess/collector-status` - Service status
- ✅ `GET /api/system/architecture` - System config
- ✅ `GET /api/history/*` - Historical data

### Require ModBus (Return 503 if disconnected)
- ⚠️ `GET /api/alphaess/complete-status` - Real-time status
- ⚠️ `GET /api/alphaess/pv-details` - PV details
- ⚠️ `GET /api/alphaess/dispatch-status` - Dispatch config
- ⚠️ `POST /api/alphaess/charge` - Start charging
- ⚠️ `POST /api/alphaess/discharge` - Start discharging
- ⚠️ `POST /api/alphaess/stop` - Stop dispatch

## Security Considerations

### WebSocket Authentication (Future Enhancement)

```javascript
// In websocketService.js
connect(url, token) {
  this.ws = new WebSocket(url);
  
  this.ws.onopen = () => {
    // Send authentication
    this.send({ type: 'auth', token });
  };
}

// In websocketServer.js
handleClientMessage(ws, data) {
  if (data.type === 'auth') {
    // Verify token
    if (validateToken(data.token)) {
      ws.isAuthenticated = true;
    }
  }
}
```

## Performance Optimization

### Reduce Network Traffic

```javascript
// Only send updates when data actually changes
let lastDataHash = null;

const currentHash = hash(powerData);
if (currentHash !== lastDataHash) {
  this.broadcast({ type: 'power_update', data: powerData });
  lastDataHash = currentHash;
}
```

### Batch Updates

```javascript
// Collect updates and send in batches
const updates = [];
updates.push(powerData);

if (updates.length >= 10 || timeSinceLastSend > 30000) {
  this.broadcast({ type: 'power_batch', data: updates });
  updates.length = 0;
}
```

## Summary

This implementation provides:

- ✅ Automatic auto-refresh disable on 503 at login
- ✅ Real-time WebSocket communication
- ✅ Automatic auto-refresh restart on reconnection
- ✅ Proper state management with Pinia
- ✅ User controls (pause/resume)
- ✅ Connection status visibility
- ✅ Automatic reconnection handling
- ✅ No manual intervention required

The system is now fully responsive to ModBus connection state changes in real-time!