<!-- src/views/History.vue -->
<template>
  <div class="history">
    <h1 class="page-title">History</h1>

    <Card>
      <template #title>Historical Data</template>
      <template #content>
        <p>Historical data visualization coming soon...</p>
        <p class="text-sm mt-2" style="color: #6b7280">
          Charts and analytics will be displayed here
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