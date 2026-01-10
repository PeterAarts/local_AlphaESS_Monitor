<!-- src/App.vue - Simplified with MainLayout -->
<template>
  <div id="app">
    <!-- Initial Loading Screen -->
    <div v-if="isInitializing" class="loading-screen">
      <div class="loading-content">
        <i class="pi pi-spin pi-spinner" style="font-size: 3rem; color: #6366f1;"></i>
        <p>Loading AlphaESS Monitor...</p>
        <p class="loading-substep">{{ loadingStep }}</p>
      </div>
    </div>

    <!-- Router View (MainLayout or SetupWizard) -->
    <router-view v-else />
    
    <!-- Toast Notifications -->
    <Toast />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSystemStore } from './stores/system';
import { useConfigStore } from './stores/config';
import { useToast } from 'primevue/usetoast';
import Toast from 'primevue/toast';

const router = useRouter();
const route = useRoute();
const systemStore = useSystemStore();
const configStore = useConfigStore();
const toast = useToast();

// State
const isInitializing = ref(true);
const loadingStep = ref('Checking configuration...');

/**
 * Initialize application - LOADS CONFIGURATION FIRST!
 */
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing application...');
    
    // Step 1: Load configuration
    loadingStep.value = 'Loading configuration...';
    await configStore.loadConfiguration();
    
    // Step 2: Check if setup is needed
    loadingStep.value = 'Checking setup status...';
    if (!configStore.setupCompleted) {
      console.log('⚠️ Setup not completed - showing wizard');
      router.push('/setupWizard');
      isInitializing.value = false;
      return;
    }
    
    // Step 3: Initialize system store (check ModBus connection)
    loadingStep.value = 'Connecting to system...';
    await systemStore.initialize();
    
    // Step 4: Navigate to appropriate page
    loadingStep.value = 'Loading dashboard...';
    if (route.path === '/setupWizard') {
      router.push('/');
    }
    
    console.log('✅ Application initialized successfully');
    
  } catch (error) {
    console.error('❌ Error initializing application:', error);
    
    toast.add({
      severity: 'error',
      summary: 'Initialization Error',
      detail: 'Failed to load application. Please check your connection.',
      life: 5000
    });
    
    // Show setup wizard as fallback
    router.push('/setupWizard');
    
  } finally {
    isInitializing.value = false;
  }
};

/**
 * Auto-refresh data
 */
let refreshInterval = null;

const startAutoRefresh = () => {
  if (refreshInterval) return;
  
  refreshInterval = setInterval(() => {
    if (systemStore.isConnected && systemStore.autoRefreshEnabled) {
      systemStore.fetchStatus();
    }
  }, 5000); // Refresh every 5 seconds
};

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
};

// Watch for connection changes
watch(() => systemStore.autoRefreshEnabled, (enabled) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

// Initialize on mount
onMounted(async () => {
  await initializeApp();
  
  // Start auto-refresh if connected
  if (systemStore.isConnected && systemStore.autoRefreshEnabled) {
    startAutoRefresh();
  }
});

// Cleanup on unmount
onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style>
#app {
  min-height: 100vh;
  background: #f8fafc;
}

.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f8fafc;
}

.loading-content {
  text-align: center;
}

.loading-content p {
  margin-top: 1rem;
  color: #64748b;
  font-size: 1rem;
}

.loading-substep {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-top: 0.5rem;
}
</style>