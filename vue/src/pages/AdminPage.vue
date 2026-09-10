<template>
  <section class="panel admin-page" aria-label="后台管理">
    <div class="admin-filter-tabs" role="tablist">
      <button
        v-for="(label, value) in filters"
        :key="value"
        type="button"
        class="admin-filter-tab"
        :class="{ 'is-active': store.adminFilter === value }"
        @click="changeFilter(value)"
      >{{ label }}</button>
    </div>
    <div class="admin-active-names" aria-label="当前筛选策略名称">
      <button
        type="button"
        class="admin-active-names__sort"
        :class="{ 'is-active': store.adminSortByExpires }"
        @click="store.adminSortByExpires = !store.adminSortByExpires"
      >排序 {{ nameCounts.length }}</button>
      <button
        v-for="item in nameCounts"
        :key="item.name"
        type="button"
        class="admin-active-names__item"
        :class="[`admin-active-names__item--${item.chip}`, { 'is-active': store.adminNameFilter === item.name.toLowerCase() }]"
        @click="toggleName(item.name)"
      >
        {{ item.name }}
        <span v-if="item.count > 1" class="admin-active-names__count">{{ item.count }}</span>
      </button>
    </div>
    <div v-if="store.selectionMode" class="admin-selection">
      <span class="admin-selection__count">已选 {{ store.selectedIds.length }} 条</span>
      <div class="admin-selection__buttons">
        <button type="button" class="admin-selection__btn" @click="selectAll">全选</button>
        <button type="button" class="admin-selection__btn" @click="clearSelection">取消</button>
        <button type="button" class="admin-selection__btn admin-selection__btn--danger" @click="deleteSelected">删除所选</button>
      </div>
    </div>
    <div v-if="store.adminError" class="admin-sync-error">{{ store.adminError }}</div>
    <div v-else-if="!displayRows.length" class="admin-list-empty">{{ store.adminNameFilter ? '无匹配策略' : '' }}</div>
    <div class="admin-list">
      <AdminStrategyCard
        v-for="row in displayRows"
        :key="row.id"
        :row="row"
        :rows="store.adminRows"
        @reload="load"
      />
    </div>
  </section>

  <StatusPicker />
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { ADMIN_FILTER } from '@/config';
import { store, showToast } from '@/composables/store.js';
import { fetchStrategies, deleteStrategies } from '@/api/strategies.js';
import { formatStrategyCardTitle, getAdminVisibleRows, getAdminModeChipClass } from '@/domain/types.js';
import { collectAdminNameCounts } from '@/domain/adminCard.js';
import { getStrategyEndAt } from '@/domain/timeStatus.js';
import AdminStrategyCard from '@/components/AdminStrategyCard.vue';
import StatusPicker from '@/components/StatusPicker.vue';

const filters = ADMIN_FILTER.labels;
const visibleRows = computed(() => getAdminVisibleRows(store.adminRows));
const nameCounts = computed(() => collectAdminNameCounts(visibleRows.value).map((item) => ({
  ...item,
  chip: getAdminModeChipClass(item.mode),
})));
const displayRows = computed(() => {
  let rows = visibleRows.value;
  if (store.adminNameFilter) {
    rows = rows.filter((row) => formatStrategyCardTitle(row.strategyName).toLowerCase() === store.adminNameFilter);
  }
  if (!store.adminSortByExpires) return rows;
  return rows.slice().sort((a, b) => {
    const aTs = getStrategyEndAt(a)?.getTime();
    const bTs = getStrategyEndAt(b)?.getTime();
    if (aTs == null && bTs == null) return 0;
    if (aTs == null) return 1;
    if (bTs == null) return -1;
    return aTs - bTs;
  });
});

function toggleName(name) {
  const key = String(name || '').toLowerCase();
  store.adminNameFilter = store.adminNameFilter === key ? '' : key;
}

async function load() {
  store.adminError = '';
  try {
    store.adminRows = await fetchStrategies(store.adminFilter);
  } catch (err) {
    store.adminRows = [];
    store.adminError = String(err?.message || '同步失败');
  }
}

function changeFilter(value) {
  store.adminFilter = value;
  store.adminNameFilter = '';
  load();
}

function selectAll() {
  store.selectedIds = displayRows.value.map((row) => String(row.id));
}

function clearSelection() {
  store.selectedIds = [];
  store.selectionMode = false;
}

async function deleteSelected() {
  if (!store.selectedIds.length) return;
  if (!window.confirm(`确认删除所选 ${store.selectedIds.length} 条？`)) return;
  await deleteStrategies(store.selectedIds);
  showToast('已删除');
  clearSelection();
  await load();
}

let pressTimer = null;
function onPointerDown(e) {
  const card = e.target.closest('.admin-item');
  if (!card) return;
  pressTimer = setTimeout(() => {
    store.selectionMode = true;
  }, 500);
}
function onPointerUp() {
  clearTimeout(pressTimer);
}

onMounted(() => {
  load();
  window.addEventListener('ok-admin-reload', load);
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerup', onPointerUp);
});
onUnmounted(() => {
  window.removeEventListener('ok-admin-reload', load);
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('pointerup', onPointerUp);
});
</script>
