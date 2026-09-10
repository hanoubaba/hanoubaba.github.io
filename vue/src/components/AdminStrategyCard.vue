<template>
  <article :class="model.cardClass">
    <div v-if="model.remark" class="admin-item__remark-stamp">{{ model.remark }}</div>
    <header class="admin-item__head">
      <label v-if="store.selectionMode" class="admin-item__selector" :aria-label="`选择 ${model.title}`">
        <input type="checkbox" class="admin-item__select" :checked="model.selected" @change="toggleSelect">
        <span class="admin-item__checkmark" aria-hidden="true"></span>
      </label>
      <div class="admin-item__head-main">
        <div class="admin-item__title-wrap">
          <span class="admin-item__title">{{ model.title }}</span>
          <span v-if="model.sideLabel" class="admin-item__side" :class="`admin-item__side--${model.sideMod}`">{{ model.sideLabel }}</span>
          <span v-if="model.currentModeTagClass" :class="model.currentModeTagClass">{{ model.currentModeLabel }}</span>
          <span v-if="model.timeframe" class="admin-item__timeframe" :class="`admin-item__timeframe--${model.timeframe}`">{{ model.timeframe }}</span>
          <button type="button" class="admin-outcome-status admin-outcome-status--actionable" :class="`admin-outcome-status--${outcome.type}`" @click="openStatus">{{ outcome.label }}</button>
        </div>
      </div>
      <div v-if="model.timeBadge" class="admin-item__head-right">
        <div class="admin-time-status admin-time-status--active" :class="{ 'admin-time-status--urgent': model.timeBadgeUrgent }">
          <span class="admin-time-status__tag admin-time-status__value">{{ countdown }}</span>
        </div>
      </div>
    </header>
    <div class="admin-item__table">
      <div class="admin-item__concessions admin-item__concessions--no-stop" :class="{ 'admin-item__concessions--side-actions': model.sideActions }">
        <div class="admin-concession admin-concession--head">
          <span class="admin-concession__rate">{{ model.rateHeader }}</span>
          <span class="admin-concession__price">价格</span>
          <span :class="model.sideActions ? 'admin-concession__actions' : 'admin-concession__qty'">{{ model.qtyHeader }}</span>
        </div>
        <template v-for="(group, gi) in model.grouped" :key="gi">
          <div v-if="group.zone === 'beyond'" class="admin-concession-beyond-group">
            <div
              v-for="(item, ii) in group.items"
              :key="ii"
              class="admin-concession"
              :class="{ 'admin-concession--current is-current': item.current }"
            >
              <span class="admin-concession__rate">{{ item.rateLabel }}</span>
              <button type="button" class="admin-concession__price admin-copy-value" @click="copy(item.price)">{{ item.price }}</button>
              <span v-if="model.sideActions" class="admin-concession__actions">
                <button
                  v-if="item.isRRow"
                  type="button"
                  class="admin-concession__fold-link"
                  @click="toggleFold"
                >{{ expanded ? '收起' : '展开' }}<span class="admin-concession__fold-caret">{{ expanded ? '▴' : '▾' }}</span></button>
                <template v-else-if="!item.is100R">
                  <button type="button" class="admin-concession__side-btn admin-concession__side-btn--long" @click="sideAction('long', item)">做多</button>
                  <button type="button" class="admin-concession__side-btn admin-concession__side-btn--short" @click="sideAction('short', item)">做空</button>
                </template>
              </span>
              <span v-else class="admin-concession__qty">{{ item.hideAssistQty ? '' : item.quantity }}</span>
            </div>
          </div>
          <div v-else-if="group.zone === 'within'" class="admin-concession-within-group">
            <div
              v-for="(item, ii) in group.items"
              :key="ii"
              class="admin-concession"
              :class="{ 'admin-concession--current is-current': item.current }"
            >
              <span class="admin-concession__rate">{{ item.rateLabel }}</span>
              <button type="button" class="admin-concession__price admin-copy-value" @click="copy(item.price)">{{ item.price }}</button>
              <span v-if="model.sideActions" class="admin-concession__actions">
                <button
                  v-if="item.isRRow"
                  type="button"
                  class="admin-concession__fold-link"
                  @click="toggleFold"
                >{{ expanded ? '收起' : '展开' }}<span class="admin-concession__fold-caret">{{ expanded ? '▴' : '▾' }}</span></button>
                <template v-else-if="!item.is100R">
                  <button type="button" class="admin-concession__side-btn admin-concession__side-btn--long" @click="sideAction('long', item)">做多</button>
                  <button type="button" class="admin-concession__side-btn admin-concession__side-btn--short" @click="sideAction('short', item)">做空</button>
                </template>
              </span>
              <span v-else class="admin-concession__qty">{{ item.hideAssistQty ? '' : item.quantity }}</span>
            </div>
          </div>
          <template v-else>
            <div
              v-for="(item, ii) in group.items"
              :key="ii"
              class="admin-concession"
              :class="{ 'admin-concession--current is-current': item.current }"
            >
              <span class="admin-concession__rate">{{ item.rateLabel }}</span>
              <button type="button" class="admin-concession__price admin-copy-value" @click="copy(item.price)">{{ item.price }}</button>
              <span v-if="model.sideActions" class="admin-concession__actions">
                <button
                  v-if="item.isRRow"
                  type="button"
                  class="admin-concession__fold-link"
                  @click="toggleFold"
                >{{ expanded ? '收起' : '展开' }}<span class="admin-concession__fold-caret">{{ expanded ? '▴' : '▾' }}</span></button>
                <template v-else-if="!item.is100R">
                  <button type="button" class="admin-concession__side-btn admin-concession__side-btn--long" @click="sideAction('long', item)">做多</button>
                  <button type="button" class="admin-concession__side-btn admin-concession__side-btn--short" @click="sideAction('short', item)">做空</button>
                </template>
              </span>
              <span v-else class="admin-concession__qty">{{ item.hideAssistQty ? '' : item.quantity }}</span>
            </div>
          </template>
        </template>
      </div>
      <div v-if="model.showTpSl" class="admin-item__tp-sl" aria-label="止盈止损">
        <span class="admin-item__tp-sl-item admin-item__tp-sl-spacer" aria-hidden="true"></span>
        <button
          type="button"
          class="admin-item__tp-sl-item admin-item__tp-sl-item--tp admin-copy-value"
          title="点击复制"
          @click="copy(model.takeProfitLabel)"
        >
          <span class="admin-item__tp-sl-label">止盈</span>
          <span class="admin-item__tp-sl-value">{{ model.takeProfitLabel }}</span>
        </button>
        <button
          type="button"
          class="admin-item__tp-sl-item admin-item__tp-sl-item--sl admin-copy-value"
          title="点击复制"
          @click="copy(model.stopLabel)"
        >
          <span class="admin-item__tp-sl-label">止损</span>
          <span class="admin-item__tp-sl-value">{{ model.stopLabel }}</span>
        </button>
      </div>
      <div v-if="!model.isTierAssistStrategy" class="admin-item__sub">
        <span class="admin-item__time-range">{{ model.timeRange }}</span>
        <button v-if="model.canShowEdit" type="button" class="admin-edit-btn" @click="edit">修改</button>
      </div>
    </div>
    <div v-if="model.optionalModes.length" class="admin-item__modes">
      <div class="admin-view-switch" role="group">
        <button
          v-for="mode in model.optionalModes"
          :key="mode.value"
          type="button"
          class="admin-view-switch__btn"
          :class="`admin-view-switch__btn--${mode.mod}`"
          @click="switchMode(mode.value)"
        >{{ mode.label }}</button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { FRONT_MODE, PAGES, VIEW_MODE } from '@/config';
import { store, getUnitCost, showToast } from '@/composables/store.js';
import { buildAdminCardModel, findRelatedByType } from '@/domain/adminCard.js';
import { buildTierAssistViewState } from '@/domain/counterTrend.js';
import { formatCountdownTo, formatStartSlotValue, parseDateValue } from '@/utils/time.js';
import { STRATEGY_TYPE } from '@/config';
import { updateStrategyView } from '@/api/strategies.js';
import { getAdminStrategyTypeInfo } from '@/domain/types.js';
import { getOutcomeStatusInfo } from '@/domain/timeStatus.js';

const props = defineProps({
  row: { type: Object, required: true },
  rows: { type: Array, default: () => [] },
});
const emit = defineEmits(['reload']);
const now = ref(new Date());
let timer = null;

const expanded = computed(() => store.expandedCounterIds.includes(String(props.row.id)));
const model = computed(() => buildAdminCardModel(props.row, {
  rows: props.rows,
  unitCost: getUnitCost(),
  selectedIds: store.selectedIds,
  selectionMode: store.selectionMode,
  expanded: expanded.value,
}));
const countdown = computed(() => {
  if (!model.value.expiresAt) return '';
  return formatCountdownTo(parseDateValue(model.value.expiresAt), now.value);
});
const outcome = computed(() => getOutcomeStatusInfo(props.row.outcomeStatus));

function toggleFold() {
  const id = String(props.row.id);
  const next = store.expandedCounterIds.slice();
  const i = next.indexOf(id);
  if (i >= 0) next.splice(i, 1);
  else next.push(id);
  store.expandedCounterIds = next;
}

function toggleSelect() {
  const id = String(props.row.id);
  if (store.selectedIds.includes(id)) {
    store.selectedIds = store.selectedIds.filter((item) => item !== id);
  } else {
    store.selectedIds = [...store.selectedIds, id];
  }
}

async function copy(text) {
  const value = String(text ?? '').trim();
  if (!value || value === '—') return;
  try {
    await navigator.clipboard.writeText(value);
    showToast('已复制');
  } catch {
    showToast('复制失败');
  }
}

async function sideAction(side, item) {
  const result = buildTierAssistViewState(props.row, side, item.rate, item.price);
  if (result.error) {
    showToast(result.error);
    return;
  }
  try {
    await updateStrategyView(props.row.id, {
      viewMode: VIEW_MODE.tierAssist,
      viewState: result.viewState,
    });
    showToast(`已切换挡位辅助（${side === 'short' ? '做空' : '做多'}）`);
    emit('reload');
  } catch {
    showToast('视图切换失败，请先执行 supabase.sql');
  }
}

async function switchMode(nextMode) {
  if (nextMode === VIEW_MODE.fish && !findRelatedByType(props.row, props.rows, STRATEGY_TYPE.fish)) {
    store.frontMode = FRONT_MODE.fish;
    store.fishForm.name = model.value.title === '未命名' ? '' : model.value.title;
    store.fishForm.from = '';
    store.fishForm.to = '';
    store.fishForm.error = '';
    store.page = PAGES.front;
    showToast('请完善吃鱼助手后保存');
    return;
  }
  try {
    await updateStrategyView(props.row.id, { viewMode: nextMode, viewState: props.row.viewState });
    emit('reload');
  } catch {
    showToast('视图切换失败，请先执行 supabase.sql');
  }
}

function edit() {
  const target = props.rows.find((item) => String(item.id) === String(model.value.editTargetId)) || props.row;
  const type = getAdminStrategyTypeInfo(target).type;
  store.editingId = String(target.id);
  store.editingPreserve = {
    description: target.description,
    outcomeStatus: target.outcomeStatus,
    outcomeRemark: target.outcomeRemark,
    viewMode: target.viewMode,
    viewState: target.viewState,
  };
  if (type === STRATEGY_TYPE.fish || model.value.showFishView) {
    store.frontMode = FRONT_MODE.fish;
    store.fishForm.name = String(target.strategyName || '');
    store.fishForm.from = String(target.inputPrice || '');
    store.fishForm.to = String(target.inputStopLoss || '');
  } else {
    store.frontMode = FRONT_MODE.trend;
    store.trendForm.name = String(target.strategyName || '');
    store.trendForm.openPrice = String(target.inputPrice || '');
    store.trendForm.stopPrice = String(target.inputStopLoss || '');
    store.trendTimeframe = target.timeframe || store.trendTimeframe;
    const startAt = parseDateValue(target.startAt);
    if (startAt) {
      store.trendForm.startTime = formatStartSlotValue(startAt);
    }
  }
  store.page = PAGES.front;
}

function openStatus() {
  store.statusPicker = {
    open: true,
    id: String(props.row.id),
    status: '',
    remark: String(props.row.outcomeRemark || ''),
    error: '',
    loading: false,
  };
}

onMounted(() => {
  timer = setInterval(() => { now.value = new Date(); }, 1000);
});
onUnmounted(() => clearInterval(timer));
</script>
