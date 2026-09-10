<template>
  <div v-if="store.statusPicker.open" id="status-picker" class="status-picker">
    <div class="status-picker__backdrop" @click="close"></div>
    <div class="status-picker__sheet" role="dialog">
      <div class="status-picker__grabber"></div>
      <div class="status-picker__header">
        <h2 class="status-picker__title">盈利状态</h2>
        <p class="status-picker__desc">选择状态并填写备注，点击提交后生效。</p>
      </div>
      <div class="status-picker__options">
        <button
          type="button"
          class="status-picker__option status-picker__option--profit"
          :aria-pressed="store.statusPicker.status === 'profit'"
          @click="store.statusPicker.status = 'profit'"
        >
          <span class="status-picker__option-title">盈利</span>
          <span class="status-picker__option-note">本单已开单并盈利</span>
        </button>
        <button
          type="button"
          class="status-picker__option status-picker__option--loss"
          :aria-pressed="store.statusPicker.status === 'loss'"
          @click="store.statusPicker.status = 'loss'"
        >
          <span class="status-picker__option-title">亏损</span>
          <span class="status-picker__option-note">本单已开单并亏损</span>
        </button>
        <button
          type="button"
          class="status-picker__option status-picker__option--not-filled"
          :aria-pressed="store.statusPicker.status === 'not_filled'"
          @click="store.statusPicker.status = 'not_filled'"
        >
          <span class="status-picker__option-title">未成交</span>
          <span class="status-picker__option-note">本单未成交或放弃</span>
        </button>
      </div>
      <label class="status-picker__remark">
        <span class="status-picker__remark-label">备注</span>
        <textarea v-model="store.statusPicker.remark" class="status-picker__remark-input" rows="2" placeholder="选填"></textarea>
      </label>
      <p class="status-picker__error" role="alert">{{ store.statusPicker.error }}</p>
      <div class="status-picker__actions">
        <button type="button" class="status-picker__cancel" @click="close">取消</button>
        <button type="button" class="status-picker__submit" :disabled="store.statusPicker.loading" @click="submit">提交</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { store, showToast } from '@/composables/store.js';
import { updateStrategyOutcomeStatus } from '@/api/strategies.js';

function close() {
  store.statusPicker.open = false;
}

async function submit() {
  const picker = store.statusPicker;
  if (!['profit', 'loss', 'not_filled'].includes(picker.status)) {
    picker.error = '请先选择盈利状态。';
    return;
  }
  picker.loading = true;
  picker.error = '';
  try {
    await updateStrategyOutcomeStatus(picker.id, picker.status, picker.remark);
    close();
    showToast('已更新');
    window.dispatchEvent(new Event('ok-admin-reload'));
  } catch {
    picker.error = '提交失败。请检查网络或 Supabase 权限。';
  } finally {
    picker.loading = false;
  }
}
</script>
