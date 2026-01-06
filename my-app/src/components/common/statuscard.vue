<!-- src/components/common/StatusCard.vue -->
<template>
  <Card :class="['status-card', cardClass]">
    <template #content>
      <div class="card-header">
        <div class="card-icon-wrapper">
          <img v-if="icon" :src="icon" :alt="title" class="card-icon-img" />
          <i v-else-if="iconClass" :class="iconClass"></i>
        </div>
        <h3 class="card-title" :class="titleClass">{{ title }}</h3>
      </div>
      <div class="card-body">
        <slot name="stats">
          <div v-for="stat in stats" :key="stat.label" class="stat-row">
            <span class="stat-label">{{ stat.label }}</span>
            <span class="stat-value">
              {{ stat.value }} 
              <span v-if="stat.unit" class="stat-unit">{{ stat.unit }}</span>
            </span>
          </div>
        </slot>
      </div>
    </template>
  </Card>
</template>

<script setup>
import Card from 'primevue/card';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: null
  },
  iconClass: {
    type: String,
    default: null
  },
  titleClass: {
    type: String,
    default: ''
  },
  cardClass: {
    type: String,
    default: ''
  },
  stats: {
    type: Array,
    default: () => []
  }
});
</script>

<style scoped>
.status-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.status-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  border-color: #cbd5e1;
}

.card-header {
  text-align: center;
  padding: 1.25rem 1rem 0.5rem;
}

.card-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.75rem;
  transition: all 0.3s ease;
}

.card-icon-img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.status-card:hover .card-icon-wrapper {
  transform: scale(1.1);
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  text-align: center;
}

.card-body {
  padding: 0.5rem 1rem 1rem 1rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
}

.stat-unit {
  font-size: 0.875rem;
  font-weight: 400;
  color: #9ca3af;
  margin-left: 0.25rem;
}

/* Color variants */
.blue-text { color: #3b82f6; }
.green-text { color: #10b981; }
.orange-text { color: #f59e0b; }
</style>