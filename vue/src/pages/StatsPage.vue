<template>
  <section class="panel stats-page" aria-label="数据统计">
    <h2 class="stats-page__title">数据统计</h2>
    <h3 class="stats-section-title">每档单位本金</h3>
    <div class="stats-unit-cost">
      <label class="stats-unit-cost__field">
        <input v-model="unitInput" class="stats-unit-cost__input" type="text" inputmode="decimal" autocomplete="off" placeholder="100" />
      </label>
      <button type="button" class="stats-unit-cost__save" :disabled="saving" @click="saveUnit">{{ saving ? '保存中' : '保存' }}</button>
    </div>
    <h3 class="stats-section-title">全部数据统计</h3>
    <div class="admin-stats">
      <div class="admin-stat"><span class="admin-stat__label">数量</span><span class="admin-stat__value">{{ stats.totalCount }}</span></div>
      <div class="admin-stat"><span class="admin-stat__label">胜率</span><span class="admin-stat__value">{{ Math.round(stats.winRate) }}%</span></div>
      <div class="admin-stat"><span class="admin-stat__label">开单率</span><span class="admin-stat__value">{{ Math.round(stats.openRate) }}%</span></div>
    </div>
    <h3 class="stats-section-title">近10单统计</h3>
    <div class="stats-recent-10">
      <div v-if="!recent" class="stats-loading">加载中...</div>
      <div v-else class="admin-stats">
        <div class="admin-stat"><span class="admin-stat__label">数量</span><span class="admin-stat__value">{{ recent.totalCount }}</span></div>
        <div class="admin-stat"><span class="admin-stat__label">胜率</span><span class="admin-stat__value">{{ Math.round(recent.winRate) }}%</span></div>
        <div class="admin-stat"><span class="admin-stat__label">开单率</span><span class="admin-stat__value">{{ Math.round(recent.openRate) }}%</span></div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { store, showToast } from '@/composables/store.js';
import { fetchRecent10Stats, fetchStrategyStats, saveAppSettings } from '@/api/strategies.js';
import { normalizeUnitCost } from '@/domain/price.js';

const unitInput = ref(String(store.unitCost));
const saving = ref(false);
const stats = ref({ totalCount: 0, winRate: 0, openRate: 0 });
const recent = ref(null);

async function saveUnit() {
  const cost = normalizeUnitCost(unitInput.value);
  if (cost == null) {
    showToast('请输入大于 0 的数字');
    return;
  }
  saving.value = true;
  try {
    await saveAppSettings(cost);
    store.unitCost = cost;
    showToast('单位本金已保存');
  } catch (err) {
    showToast(String(err?.message || '保存失败'));
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  unitInput.value = String(store.unitCost);
  try {
    stats.value = await fetchStrategyStats('all', '', { ignoreAdminFilters: true });
    recent.value = await fetchRecent10Stats();
  } catch (err) {
    showToast(String(err?.message || '加载失败'));
  }
});
</script>
