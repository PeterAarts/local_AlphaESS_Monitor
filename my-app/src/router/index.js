// src/router/index.js - Updated with MainLayout
import { createRouter, createWebHistory } from 'vue-router';
import MainLayout from '../layouts/MainLayout.vue';

const routes = [
  {
    path: '/setupWizard',
    name: 'SetupWizard',
    component: () => import('../views/SetupWizard.vue'),
    meta: { title: 'Setup Wizard', layout: 'none' }
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: 'Dashboard' }
      },
      {
        path: 'history',
        name: 'History',
        component: () => import('../views/History.vue'),
        meta: { title: 'History' }
      },
      {
        path: 'control',
        name: 'Control',
        component: () => import('../views/Control.vue'),
        meta: { title: 'Control Panel' }
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: () => import('../views/Analytics.vue'),
        meta: { title: 'Analytics' }
      },
      {
        path: 'events',
        name: 'Events',
        component: () => import('../views/Events.vue'),
        meta: { title: 'System Events' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: 'Settings' }
      },
      {
        path: 'test',
        name: 'Test',
        component: () => import('../views/TestPrimeVue.vue'),
        meta: { title: 'Test' }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title} - AlphaESS Monitor` || 'AlphaESS Monitor';
  next();
});

export default router;