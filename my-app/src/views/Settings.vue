<!-- src/views/Settings.vue -->
<template>
  <div class="settings">
    <h1 class="page-title">Settings</h1>

    <Card>
      <template #title>System Configuration</template>
      <template #content>
        <p>System settings and configuration coming soon...</p>
        <p class="text-sm mt-2" style="color: #6b7280">
          Tariffs, battery capacity, and other settings will be configurable here
        </p>
      </template>
    </Card>
  </div>
</template>

<script setup>
import Card from 'primevue/card';
</script>

<style scoped>
.page-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: #111827;
}
</style>
