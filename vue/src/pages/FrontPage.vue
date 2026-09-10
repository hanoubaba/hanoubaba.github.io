<template>
  <section id="front-page">
    <div class="front-mode-switch" role="tablist" aria-label="前台模式" :class="{ 'is-locked': Boolean(store.editingId) }">
      <button type="button" class="front-mode-switch__btn" :class="{ 'is-active': store.frontMode === 'trend' }" @click="setMode('trend')">趋势立项</button>
      <button type="button" class="front-mode-switch__btn" :class="{ 'is-active': store.frontMode === 'fish' }" @click="setMode('fish')">吃鱼助手</button>
    </div>

    <div v-if="store.frontMode === 'trend'">
      <section class="panel" aria-label="参数输入">
        <div class="field">
          <span class="field-label">时间维度</span>
          <div class="timeframe-switch" role="tablist">
            <button
              v-for="tf in timeframes"
              :key="tf"
              type="button"
              class="timeframe-switch__btn"
              :class="{ 'is-active': store.trendTimeframe === tf }"
              @click="setTimeframe(tf)"
            >{{ tf }}</button>
          </div>
        </div>
        <label class="field field--spaced">
          <span class="field-label">名称</span>
          <input v-model="store.trendForm.name" class="field-input" autocomplete="off" />
        </label>
        <div class="field field--spaced">
          <span class="field-label">开始时间</span>
          <select v-if="!mobilePicker" v-model="store.trendForm.startTime" class="field-input field-input--select">
            <option value="">请选择</option>
            <option v-for="slot in slots" :key="slot.value" :value="slot.value">{{ slot.label }}</option>
          </select>
          <button
            v-else
            type="button"
            class="field-input field-input--select start-time-trigger"
            @click="openPicker"
          >{{ startLabel }}</button>
        </div>
        <label class="field field--spaced">
          <span class="field-label">开始价格</span>
          <input v-model="store.trendForm.openPrice" class="field-input" inputmode="decimal" autocomplete="off" />
        </label>
        <label class="field field--spaced">
          <span class="field-label">止损价格</span>
          <input v-model="store.trendForm.stopPrice" class="field-input" inputmode="decimal" autocomplete="off" />
        </label>
        <p class="error" role="alert">{{ store.trendForm.error }}</p>
      </section>
      <button type="button" class="btn-save-strategy" :disabled="saving" @click="saveTrend">{{ store.editingId ? '保存修改' : '保存' }}</button>
    </div>

    <div v-else>
      <section class="panel" aria-label="吃鱼助手参数">
        <label class="field">
          <span class="field-label">名称</span>
          <input v-model="store.fishForm.name" class="field-input" autocomplete="off" />
        </label>
        <label class="field field--spaced">
          <span class="field-label">from</span>
          <input v-model="store.fishForm.from" class="field-input" inputmode="decimal" autocomplete="off" />
        </label>
        <label class="field field--spaced">
          <span class="field-label">to</span>
          <input v-model="store.fishForm.to" class="field-input" inputmode="decimal" autocomplete="off" />
        </label>
        <p class="error" role="alert">{{ store.fishForm.error }}</p>
      </section>
      <button type="button" class="btn-save-strategy" :disabled="saving" @click="saveFish">{{ store.editingId ? '保存修改' : '保存' }}</button>
    </div>
  </section>

  <div v-if="store.timePickerOpen" class="time-picker">
    <div class="time-picker__backdrop" @click="store.timePickerOpen = false"></div>
    <div class="time-picker__sheet" role="dialog">
      <div class="time-picker__header">
        <h2 class="time-picker__title">选择开始时间</h2>
      </div>
      <div class="time-picker__list" role="listbox">
        <button
          v-for="slot in slots"
          :key="slot.value"
          type="button"
          class="time-picker__option"
          :class="{ 'is-selected': slot.value === store.trendForm.startTime }"
          @click="pickTime(slot.value)"
        >{{ slot.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { PAGES, TIME } from '@/config';
import { store, getUnitCost, showToast } from '@/composables/store.js';
import { toNumber } from '@/utils/format.js';
import { getTimeSlotsByMode, isMobileTimePickerEnabled, resolveStartTimeSelection } from '@/utils/time.js';
import { calcTakeProfit } from '@/domain/price.js';
import { buildFishRecord, buildTrendRecord } from '@/domain/builders.js';
import { createStrategy, updateStrategy } from '@/api/strategies.js';
import { RISK } from '@/config';

const timeframes = TIME.frontTrend;
const saving = ref(false);
const mobilePicker = ref(false);
const slots = computed(() => getTimeSlotsByMode(store.trendTimeframe));
const startLabel = computed(() => slots.value.find((s) => s.value === store.trendForm.startTime)?.label || '请选择');

function setMode(mode) {
  if (store.editingId) return;
  store.frontMode = mode;
}

function setTimeframe(tf) {
  store.trendTimeframe = tf;
  store.trendForm.startTime = resolveStartTimeSelection(tf, store.trendForm.startTime);
}

function openPicker() {
  store.timePickerOpen = true;
}

function pickTime(value) {
  store.trendForm.startTime = value;
  store.timePickerOpen = false;
}

function ensureSlots() {
  if (!store.trendForm.startTime) {
    store.trendForm.startTime = resolveStartTimeSelection(store.trendTimeframe, '');
  }
}

async function saveTrend() {
  const form = store.trendForm;
  const open = toNumber(form.openPrice);
  const stop = toNumber(form.stopPrice);
  form.error = '';
  if (open == null || stop == null) {
    form.error = '请输入有效的开始价格与止损价格（数字）。';
    return;
  }
  if (open <= 0 || stop <= 0) {
    form.error = '开始价格和止损价格须为大于 0 的数字。';
    return;
  }
  if (!form.startTime) {
    form.error = '请选择开始时间。';
    return;
  }
  if (open === stop) {
    form.error = '开始价格与止损价格不能相同，无法计算数量与方向。';
    return;
  }
  const tp = calcTakeProfit(open, stop, RISK.takeProfitR);
  if (tp == null) {
    form.error = '开始价格无效，请检查开始价格与止损价格。';
    return;
  }
  if (!String(form.name || '').trim()) {
    form.error = '保存前请填写名称。';
    return;
  }
  const built = buildTrendRecord({
    name: form.name,
    open,
    stop,
    startTimeValue: form.startTime,
    timeframe: store.trendTimeframe,
    description: store.editingPreserve?.description ?? '',
    preserve: store.editingPreserve,
  });
  saving.value = true;
  try {
    if (store.editingId) await updateStrategy(store.editingId, built.record);
    else await createStrategy(built.record);
    showToast('已保存');
    store.page = PAGES.admin;
    store.editingId = null;
    store.editingPreserve = null;
  } catch (err) {
    form.error = String(err?.message || '保存失败。请检查 Supabase 表和权限。');
  } finally {
    saving.value = false;
  }
}

async function saveFish() {
  const form = store.fishForm;
  const from = toNumber(form.from);
  const to = toNumber(form.to);
  form.error = '';
  if (from == null || to == null) {
    form.error = '请输入有效的 from 与 to（数字）。';
    return;
  }
  if (from <= 0 || to <= 0) {
    form.error = 'from 和 to 须为大于 0 的数字。';
    return;
  }
  if (from === to) {
    form.error = 'from 与 to 不能相同。';
    return;
  }
  if (!String(form.name || '').trim()) {
    form.error = '保存前请填写名称。';
    return;
  }
  const built = buildFishRecord({
    name: form.name,
    from,
    to,
    unitCost: getUnitCost(),
    description: store.editingPreserve?.description ?? '',
    preserve: store.editingPreserve,
  });
  if (!built) {
    form.error = '无法生成吃鱼助手档位，请检查 from / to。';
    return;
  }
  saving.value = true;
  try {
    if (store.editingId) await updateStrategy(store.editingId, built.record);
    else await createStrategy(built.record);
    showToast('已保存');
    store.page = PAGES.admin;
    store.editingId = null;
    store.editingPreserve = null;
  } catch (err) {
    form.error = String(err?.message || '保存失败。请检查 Supabase 表和权限。');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  mobilePicker.value = isMobileTimePickerEnabled();
  ensureSlots();
});
</script>
