// src/services/websocketService.js
import { useSystemStore } from '@/stores/systemStore';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000;
    this.reconnectTimeout = null;
    this.isIntentionalClose = false;
    this.listeners = new Map();
  }

  connect(url = 'ws://localhost:3000/ws/power-data') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('⚠️ WebSocket already connected');
      return;
    }

    console.log('🔌 Connecting to WebSocket:', url);
    this.isIntentionalClose = false;

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }

  setupEventHandlers() {
    this.ws.onopen = (event) => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', event);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error, event.data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      this.emit('disconnected', event);

      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  handleMessage(data) {
    console.log('📨 WebSocket message:', data.type);

    switch (data.type) {
      case 'connection_status':
        this.handleConnectionStatus(data);
        break;
      
      case 'power_update':
        this.emit('powerUpdate', data.data);
        break;
      
      case 'modbus_connected':
        this.handleModbusConnected(data);
        break;
      
      case 'modbus_disconnected':
        this.handleModbusDisconnected(data);
        break;
      
      default:
        this.emit('message', data);
    }
  }

  handleConnectionStatus(data) {
    console.log('📊 Connection status update:', data.connected);
    this.emit('connectionStatus', data);
  }

  handleModbusConnected(data) {
    console.log('🔄 ModBus reconnected!');
    
    // Get system store and restart auto-refresh
    const systemStore = useSystemStore();
    systemStore.handleConnectionRestored();
    
    this.emit('modbusConnected', data);
  }

  handleModbusDisconnected(data) {
    console.log('⚠️ ModBus disconnected!');
    
    // Get system store and stop auto-refresh
    const systemStore = useSystemStore();
    systemStore.handleConnectionLost();
    
    this.emit('modbusDisconnected', data);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ Cannot send message - WebSocket not connected');
    }
  }

  disconnect() {
    console.log('🛑 Intentionally closing WebSocket');
    this.isIntentionalClose = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  // Getters
  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}

// Export singleton instance
export default new WebSocketService();