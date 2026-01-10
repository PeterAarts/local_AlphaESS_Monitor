<!-- src/layouts/MainLayout.vue - Main App Layout with Navigation -->
<template>
  <div class="main-layout">
    <!-- Top Navigation Bar -->
    <header class="app-header">
      <div class="header-left">
        <Button 
          icon="pi pi-bars" 
          @click="toggleSidebar"
          text
          rounded
          class="menu-toggle"
        />
        <div class="app-logo">
          <i class="pi pi-bolt"></i>
          <span class="app-title">AlphaESS Monitor</span>
        </div>
      </div>

      <div class="header-center">
        <!-- Connection Status -->
        <div class="connection-status" :class="{ connected: systemStore.isConnected }">
          <i :class="systemStore.isConnected ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i>
          <span>{{ systemStore.isConnected ? 'Connected' : 'Disconnected' }}</span>
        </div>
      </div>

      <div class="header-right">
        <!-- Refresh Button -->
        <Button 
          icon="pi pi-refresh" 
          @click="handleRefresh"
          :loading="systemStore.isLoading"
          text
          rounded
          v-tooltip.bottom="'Refresh Data'"
        />
        
        <!-- Settings Button -->
        <Button 
          icon="pi pi-cog" 
          @click="navigateTo('/settings')"
          text
          rounded
          v-tooltip.bottom="'Settings'"
        />
        
        <!-- User Menu -->
        <Button 
          icon="pi pi-user" 
          @click="toggleUserMenu"
          text
          rounded
          v-tooltip.bottom="'User Menu'"
        />
      </div>
    </header>

    <!-- Main Content Area -->
    <div class="layout-content">
      <!-- Sidebar Navigation -->
      <aside class="app-sidebar" :class="{ collapsed: sidebarCollapsed }">
        <nav class="sidebar-nav">
          <router-link 
            v-for="item in menuItems" 
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ active: isActive(item.path) }"
          >
            <i :class="item.icon"></i>
            <span v-if="!sidebarCollapsed" class="nav-label">{{ item.label }}</span>
          </router-link>
        </nav>

        <!-- Sidebar Footer -->
        <div class="sidebar-footer">
          <div v-if="!sidebarCollapsed && configStore.selectedModel" class="system-info">
            <div class="info-item">
              <i class="pi pi-microchip"></i>
              <span>{{ configStore.selectedModel.model_name }}</span>
            </div>
            <div class="info-item">
              <i class="pi pi-bolt"></i>
              <span>Battery: {{ systemStore.status.battery.soc }}%</span>
            </div>
            <div class="info-item">
              <i class="pi pi-sun"></i>
              <span>Solar: {{ formatPower(systemStore.status.pv.power) }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content (Router View) -->
      <main class="app-main">
        <!-- Error Banner -->
        <div v-if="systemStore.error" class="error-banner">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ systemStore.error }}</span>
          <Button 
            label="Retry" 
            @click="systemStore.manualRefresh"
            size="small"
            outlined
          />
        </div>

        <!-- Router View -->
        <router-view />
      </main>
    </div>

    <!-- User Menu Overlay -->
    <OverlayPanel ref="userMenuRef">
      <div class="user-menu">
        <div class="user-info">
          <i class="pi pi-user"></i>
          <div>
            <div class="user-name">Administrator</div>
            <div class="user-email">admin@alphaess.local</div>
          </div>
        </div>
        
        <Divider />
        
        <div class="menu-items">
          <a @click="navigateTo('/settings')" class="menu-item">
            <i class="pi pi-cog"></i>
            <span>Settings</span>
          </a>
          <a @click="openSetupWizard" class="menu-item">
            <i class="pi pi-wrench"></i>
            <span>Run Setup Wizard</span>
          </a>
          <a @click="reloadConfiguration" class="menu-item">
            <i class="pi pi-refresh"></i>
            <span>Reload Configuration</span>
          </a>
          <a @click="handleLogout" class="menu-item">
            <i class="pi pi-sign-out"></i>
            <span>Logout</span>
          </a>
        </div>
      </div>
    </OverlayPanel>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSystemStore } from '../stores/system';
import { useConfigStore } from '../stores/config';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import OverlayPanel from 'primevue/overlaypanel';
import Divider from 'primevue/divider';

const router = useRouter();
const route = useRoute();
const systemStore = useSystemStore();
const configStore = useConfigStore();
const toast = useToast();

// State
const sidebarCollapsed = ref(false);
const userMenuRef = ref();

// Menu Items
const menuItems = ref([
  { path: '/', label: 'Dashboard', icon: 'pi pi-home' },
  { path: '/history', label: 'History', icon: 'pi pi-calendar' },
  { path: '/control', label: 'Control', icon: 'pi pi-sliders-h' },
  { path: '/analytics', label: 'Analytics', icon: 'pi pi-chart-bar' },
  { path: '/events', label: 'Events', icon: 'pi pi-list' },
  { path: '/settings', label: 'Settings', icon: 'pi pi-cog' },
]);

/**
 * Check if route is active
 */
const isActive = (path) => {
  if (path === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(path);
};

/**
 * Toggle sidebar
 */
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

/**
 * Toggle user menu
 */
const toggleUserMenu = (event) => {
  userMenuRef.value?.toggle(event);
};

/**
 * Navigate to route
 */
const navigateTo = (path) => {
  userMenuRef.value?.hide();
  router.push(path);
};

/**
 * Handle refresh
 */
const handleRefresh = async () => {
  await systemStore.fetchStatus();
  
  toast.add({
    severity: 'info',
    summary: 'Refreshed',
    detail: 'System data updated',
    life: 2000
  });
};

/**
 * Open setup wizard
 */
const openSetupWizard = () => {
  userMenuRef.value?.hide();
  router.push('/setupWizard');
};

/**
 * Reload configuration
 */
const reloadConfiguration = async () => {
  userMenuRef.value?.hide();
  
  toast.add({
    severity: 'info',
    summary: 'Reloading',
    detail: 'Reloading configuration...',
    life: 2000
  });
  
  await configStore.reloadConfiguration();
  
  toast.add({
    severity: 'success',
    summary: 'Reloaded',
    detail: 'Configuration reloaded successfully',
    life: 2000
  });
};

/**
 * Handle logout
 */
const handleLogout = () => {
  userMenuRef.value?.hide();
  
  // Clear any session data
  localStorage.clear();
  
  // Navigate to setup
  router.push('/setupWizard');
  
  toast.add({
    severity: 'info',
    summary: 'Logged Out',
    detail: 'You have been logged out',
    life: 3000
  });
};

/**
 * Format power value
 */
const formatPower = (watts) => {
  if (Math.abs(watts) >= 1000) {
    return `${(watts / 1000).toFixed(2)} kW`;
  }
  return `${watts} W`;
};
</script>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f8fafc;
}

/* Header */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  height: 64px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

.app-logo i {
  color: #6366f1;
  font-size: 1.5rem;
}

.app-title {
  display: none;
}

@media (min-width: 768px) {
  .app-title {
    display: inline;
  }
}

/* Connection Status */
.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 0.875rem;
  font-weight: 500;
}

.connection-status.connected {
  background: #f0fdf4;
  color: #16a34a;
}

.connection-status i {
  font-size: 1rem;
}

/* Content Area */
.layout-content {
  display: flex;
  flex: 1;
}

/* Sidebar */
.app-sidebar {
  width: 240px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.app-sidebar.collapsed {
  width: 64px;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: #64748b;
  text-decoration: none;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: #f8fafc;
  color: #1e293b;
}

.nav-item.active {
  background: #f0f4ff;
  color: #6366f1;
  border-left-color: #6366f1;
}

.nav-item i {
  font-size: 1.25rem;
  min-width: 1.25rem;
}

.nav-label {
  font-weight: 500;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
}

.system-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.info-item i {
  color: #6366f1;
}

/* Main Content */
.app-main {
  flex: 1;
  overflow-y: auto;
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  margin: 1.5rem;
}

.error-banner i {
  font-size: 1.25rem;
}

.error-banner span {
  flex: 1;
}

/* User Menu */
.user-menu {
  min-width: 250px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.user-info i {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f4ff;
  color: #6366f1;
  border-radius: 50%;
  font-size: 1.25rem;
}

.user-name {
  font-weight: 600;
  color: #1e293b;
}

.user-email {
  font-size: 0.875rem;
  color: #64748b;
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  color: #64748b;
  text-decoration: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:hover {
  background: #f8fafc;
  color: #1e293b;
}

.menu-item i {
  width: 1.25rem;
}

/* Responsive */
@media (max-width: 768px) {
  .app-sidebar {
    position: fixed;
    left: 0;
    top: 64px;
    bottom: 0;
    transform: translateX(-100%);
    z-index: 50;
  }

  .app-sidebar:not(.collapsed) {
    transform: translateX(0);
  }

  .header-center {
    display: none;
  }
}
</style>