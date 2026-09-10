<template>
  <section class="panel obs-page" aria-label="观测日志">
    <div class="admin-filter-tabs" role="tablist">
      <button
        v-for="(label, value) in filters"
        :key="value"
        type="button"
        class="admin-filter-tab"
        :class="{ 'is-active': store.obsFilter === value }"
        @click="changeFilter(value)"
      >{{ label }}</button>
    </div>
    <div v-if="store.obsSelectionMode" class="admin-selection">
      <span class="admin-selection__count">已选 {{ store.obsSelectedIds.length }} 条</span>
      <div class="admin-selection__buttons">
        <button type="button" class="admin-selection__btn" @click="selectAll">全选</button>
        <button type="button" class="admin-selection__btn" @click="clearSelection">取消</button>
        <button type="button" class="admin-selection__btn admin-selection__btn--danger" @click="deleteSelected">删除所选</button>
      </div>
    </div>
    <div class="obs-list">
      <article v-for="record in store.obsRows" :key="record.id" class="admin-item admin-item--flat obs-record">
        <header class="admin-item__head obs-record__head">
          <label v-if="store.obsSelectionMode" class="admin-item__selector">
            <input type="checkbox" class="admin-item__select" :checked="store.obsSelectedIds.includes(record.id)" @change="toggle(record.id)">
            <span class="admin-item__checkmark"></span>
          </label>
          <span v-if="record.createdAt" class="obs-record__time">{{ formatTime(record.createdAt) }}</span>
        </header>
        <div v-if="record.items[0]" class="obs-template">
          <div class="obs-template__row">
            <p v-if="record.items[0].name" class="obs-template__name">{{ record.items[0].name }}</p>
            <p v-if="record.items[0].description" class="obs-template__desc">{{ record.items[0].description }}</p>
          </div>
        </div>
      </article>
    </div>
    <div class="obs-footer">
      <button type="button" class="obs-footer__btn" @click="store.obsFormOpen = true">新增记录</button>
    </div>
  </section>

  <div v-if="store.obsFormOpen" class="status-picker obs-form-picker">
    <div class="status-picker__backdrop" @click="store.obsFormOpen = false"></div>
    <div class="status-picker__sheet obs-form-picker__sheet" role="dialog">
      <div class="obs-form-picker__grabber"></div>
      <div class="obs-form-list">
        <div class="obs-form-row">
          <label class="obs-form-field">
            <span class="obs-form-field__label">名称</span>
            <input v-model="store.obsForm.name" class="obs-form-row__input obs-form-row__name" type="text" placeholder="选填" autocomplete="off" />
          </label>
          <label class="obs-form-field">
            <span class="obs-form-field__label">描述</span>
            <textarea v-model="store.obsForm.description" class="obs-form-row__input obs-form-row__desc" rows="3" placeholder="选填"></textarea>
          </label>
        </div>
      </div>
      <p class="status-picker__error">{{ store.obsError }}</p>
      <div class="status-picker__actions">
        <button type="button" class="status-picker__cancel" @click="store.obsFormOpen = false">取消</button>
        <button type="button" class="status-picker__submit" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { OBS } from '@/config';
import { store, showToast } from '@/composables/store.js';
import { createObservationRecord, deleteObservationRecords, fetchObservationRecords } from '@/api/observations.js';
import { formatStartSlotValue } from '@/utils/time.js';

const filters = OBS.filterLabels;

function formatTime(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : formatStartSlotValue(d);
}

async function load() {
  store.obsRows = await fetchObservationRecords(store.obsFilter);
}

function changeFilter(value) {
  store.obsFilter = value;
  load();
}

function toggle(id) {
  if (store.obsSelectedIds.includes(id)) {
    store.obsSelectedIds = store.obsSelectedIds.filter((item) => item !== id);
  } else {
    store.obsSelectedIds = [...store.obsSelectedIds, id];
  }
}

function selectAll() {
  store.obsSelectedIds = store.obsRows.map((row) => row.id);
}

function clearSelection() {
  store.obsSelectedIds = [];
  store.obsSelectionMode = false;
}

async function deleteSelected() {
  if (!store.obsSelectedIds.length) return;
  if (!window.confirm(`确认删除所选 ${store.obsSelectedIds.length} 条？`)) return;
  await deleteObservationRecords(store.obsSelectedIds);
  showToast('已删除');
  clearSelection();
  await load();
}

async function save() {
  const items = [{ name: store.obsForm.name, description: store.obsForm.description }].filter((item) => item.name || item.description);
  if (!items.length) {
    store.obsError = '请填写名称或描述。';
    return;
  }
  store.obsError = '';
  try {
    await createObservationRecord(items);
    store.obsFormOpen = false;
    store.obsForm = { name: '', description: '' };
    showToast('已保存');
    await load();
  } catch (err) {
    store.obsError = String(err?.message || '保存失败');
  }
}

onMounted(load);
</script>
