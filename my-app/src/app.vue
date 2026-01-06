<!-- src/App.vue -->
<template>
  <div id="app">
    <Menubar :model="menuItems">
      <template #start>
        <div class="flex items-center gap-2">
          <i class="pi pi-bolt text-2xl" style="color: var(--color-solar)"></i>
          <span class="font-bold text-xl">Alpha ESS Monitor</span>
        </div>
      </template>
      <template #end>
        <div class="flex items-center gap-3">
          <Badge :value="lastUpdate" severity="success" />
          <Button 
            icon="pi pi-refresh" 
            rounded 
            text 
            @click="refreshData"
            :loading="systemStore.isLoading"
          />
        </div>
      </template>
    </Menubar>

    <Toast />
    <ConfirmDialog />

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from './stores/system';
import { useToast } from 'primevue/usetoast';
import Menubar from 'primevue/menubar';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { formatDistanceToNow } from 'date-fns';

const router = useRouter();
const systemStore = useSystemStore();
const toast = useToast();

const menuItems = ref([
  {
    label: 'Dashboard',
    icon: 'pi pi-home',
    command: () => router.push('/')
  },
  {
    label: 'History',
    icon: 'pi pi-chart-line',
    command: () => router.push('/history')
  },
  {
    label: 'Control',
    icon: 'pi pi-sliders-h',
    command: () => router.push('/control')
  },
  {
    label: 'Analytics',
    icon: 'pi pi-chart-bar',
    command: () => router.push('/analytics')
  },
  {
    label: 'Events',
    icon: 'pi pi-list',
    command: () => router.push('/events')
  },
  {
    label: 'Settings',
    icon: 'pi pi-cog',
    command: () => router.push('/settings')
  }
]);

const lastUpdate = computed(() => {
  if (!systemStore.lastUpdate) return 'Never';
  return formatDistanceToNow(systemStore.lastUpdate, { addSuffix: true });
});

async function refreshData() {
  try {
    await Promise.all([
      systemStore.fetchStatus(),
      systemStore.fetchPVDetails(),
      systemStore.fetchDispatchStatus()
    ]);
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to refresh data',
      life: 5000
    });
  }
}

let intervalId;
onMounted(() => {
  refreshData();
  // Auto-refresh every 10 seconds
  intervalId = setInterval(refreshData, 10000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>

<style scoped>
#app {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.main-content {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-3 {
  gap: 0.75rem;
}
</style>