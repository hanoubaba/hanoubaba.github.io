import { computed, reactive } from 'vue';
import {
  ADMIN_FILTER,
  APP,
  COST,
  FRONT_MODE,
  OBS,
  PAGES,
  TIME,
} from '@/config';
import { normalizeUnitCost } from '@/domain/price.js';

export const store = reactive({
  page: PAGES.admin,
  authed: false,
  loginError: '',
  toast: '',
  toastTimer: null,
  moreOpen: false,
  unitCost: COST.defaultUnit,

  frontMode: FRONT_MODE.trend,
  trendTimeframe: TIME.default,
  trendForm: {
    name: '',
    startTime: '',
    openPrice: '',
    stopPrice: '',
    error: '',
  },
  fishForm: {
    name: '',
    from: '',
    to: '',
    error: '',
  },
  editingId: null,
  editingPreserve: null,
  timePickerOpen: false,
  timePickerScope: 'trend',

  adminFilter: ADMIN_FILTER.default,
  adminNameFilter: '',
  adminSortByExpires: false,
  adminRows: [],
  adminError: '',
  adminLoading: false,
  selectionMode: false,
  selectedIds: [],
  expandedCounterIds: [],
  statusPicker: {
    open: false,
    id: '',
    status: '',
    remark: '',
    error: '',
    loading: false,
  },

  stats: { totalCount: 0, winRate: 0, openRate: 0 },
  recent10: null,
  statsError: '',

  obsFilter: OBS.defaultFilter,
  obsRows: [],
  obsSelectionMode: false,
  obsSelectedIds: [],
  obsFormOpen: false,
  obsForm: { name: '', description: '' },
  obsError: '',

  casesImages: [],
  casesIndex: 0,
  casesEmpty: false,
});

export function showToast(message, duration = APP.toastDuration) {
  store.toast = String(message ?? '');
  if (store.toastTimer) clearTimeout(store.toastTimer);
  store.toastTimer = setTimeout(() => {
    store.toast = '';
    store.toastTimer = null;
  }, duration);
}

export function getUnitCost() {
  return normalizeUnitCost(store.unitCost) ?? COST.defaultUnit;
}

export const currentPage = computed(() => store.page);
export const isLogin = computed(() => !store.authed);
