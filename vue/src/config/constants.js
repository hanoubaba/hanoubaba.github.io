/** 统一业务常量：所有模式、档位、接口、文案从这里读取，避免散落魔法值 */

export const APP = {
  title: '无限拟合模型',
  toastDuration: 1500,
};

export const PAGES = {
  front: 'front',
  admin: 'admin',
  stats: 'stats',
  methodology: 'methodology',
  cases: 'cases',
  observations: 'observations',
};

export const PAGE_TABS = [
  { id: PAGES.front, label: '前台', kind: 'main' },
  { id: PAGES.admin, label: '后台管理', kind: 'main' },
  { id: PAGES.observations, label: '观测日志', kind: 'main' },
  { id: PAGES.methodology, label: '方法论', kind: 'more' },
  { id: PAGES.stats, label: '数据统计', kind: 'more' },
  { id: PAGES.cases, label: '典型案例', kind: 'more' },
];

export const FRONT_MODE = {
  trend: 'trend',
  assist: 'assist',
  fish: 'fish',
};

export const VIEW_MODE = {
  trend: 'trend',
  counterTrend: 'counter_trend',
  tierAssist: 'tier_assist',
  fish: 'fish',
};

export const POSITION_SIDE = {
  long: 'long',
  short: 'short',
  flat: 'flat',
};

export const OUTCOME_STATUS = {
  pending: 'pending',
  profit: 'profit',
  loss: 'loss',
  notFilled: 'not_filled',
};

export const TIME = {
  default: '8h',
  assistDefault: '8h',
  minutes: {
    '1h': 60,
    '4h': 240,
    '8h': 480,
    '1d': 1440,
  },
  labels: {
    '1h': '1小时',
    '4h': '4小时',
    '8h': '8小时',
    '1d': '1天',
  },
  frontTrend: ['4h', '8h', '1d'],
  startSlotCount: 5,
};

export const COST = {
  openBase: 100,
  multiplierMin: 1,
  multiplierMax: 10,
  multiplierDefault: 3,
  defaultUnit: 100,
  premiumTotals: [500, 1000],
  premiumOpenCost: 150,
};

export const GRADE = {
  premium: '优质',
  normal: '普通',
};

export const TIER = {
  defaultCount: 3,
  legacyCounts: [5, 6, 7],
  priceAdjustmentRate: 0,
  bestRateMax: 0.3,
  concessionRates: [
    { rate: 0, display: true, reuseMinTierCost: true },
    { rate: 0.1, display: true, reuseMinTierCost: true },
    { rate: 0.2, costShare: 1 / 3 },
    { rate: 0.5, costShare: 1 / 3 },
    { rate: 0.8, costShare: 1 / 3 },
  ],
};

export const RISK = {
  takeProfitR: 1,
  refTakeProfitR: 3,
  bestTakeProfitR: 5,
  durationPeriods: 10,
  assistDurationPeriods: 3,
  countdownUrgentHours: 4,
};

export const ASSIST = {
  takeProfitMultiple: 2,
  titleSuffix: ' (顺势而为)',
  hideQuantityRate: 0.8,
  ratios: [
    { rate: 0.1, label: '10%（鱼头三选一）', reuseMinTierCost: true },
    { rate: 0.2, label: '20%（鱼头三选一）', reuseMinTierCost: true },
    { rate: 0.3, label: '30%（鱼头三选一）', costShare: 3 / 5 },
    { rate: 0.5, label: '50%', costShare: 2 / 5 },
    { rate: 0.8, label: '80%（鱼尾）', costShare: 0 },
  ],
  legacyRates: [
    [1 / 3, 1 / 2, 2 / 3],
    [0.3, 0.5, 0.66],
    [0.3, 0.5, 0.7],
    [0.33, 0.48, 0.75],
    [0.3, 0.48, 0.8],
    [0.1, 0.2, 0.3, 0.48, 0.8],
    [0.1, 0.2, 0.3, 0.5, 0.8],
    Array.from({ length: 10 }, (_, index) => (index + 1) / 10),
    Array.from({ length: 9 }, (_, index) => (index + 2) / 10),
  ],
};

export const FISH = {
  takeProfitMultiple: 1,
  timeframe: '1d',
  timeframeMinutes: 1440,
  validPeriods: 3650,
  titleSuffix: ' (吃鱼助手)',
};

export const COUNTER_TREND = {
  entryMultiples: [3, 5],
  priceOnlyMultiples: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  stopMultiple: 10,
  collapsedMaxRate: 50,
  foldHideRate: 100,
};

export const TIER_ASSIST = {
  titleSuffix: ' (挡位辅助)',
  takeProfitMultiple: 1,
  rates: [
    { rate: 0, display: true, costShare: 1 / 2 },
    { rate: 0.1, display: true, costShare: 1 / 2 },
  ],
  legacyRates: [[0, 0.1, 0.2]],
};

export const TRADE_MODE = {
  normal: 'normal',
};

export const ADMIN_FILTER = {
  default: 'active',
  labels: {
    all: '全部',
    active: '进行中',
    createdToday: '今日创建',
    dueToday: '今日到期',
  },
};

export const OBS = {
  dailyTimeframe: '1d',
  durationPeriods: 9,
  defaultFilter: 'createdToday',
  filterLabels: {
    all: '全部',
    createdToday: '今日创建',
  },
};

export const CASES = {
  dir: import.meta.env.DEV ? './cases/' : '../ok/cases/',
  extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  maxCount: 99,
};

export const FORMAT = {
  adminDecimalPlaces: 3,
};

export const LABELS = {
  untitled: '未命名',
  viewModes: {
    [VIEW_MODE.trend]: '趋势立项',
    [VIEW_MODE.counterTrend]: '趋势力预测',
    [VIEW_MODE.tierAssist]: '挡位辅助',
    [VIEW_MODE.fish]: '吃鱼助手',
    assist: '顺势而为',
  },
  sides: {
    [POSITION_SIDE.long]: '做多',
    [POSITION_SIDE.short]: '做空',
  },
  outcomes: {
    [OUTCOME_STATUS.pending]: { label: '待定', type: 'pending' },
    [OUTCOME_STATUS.profit]: { label: '盈利', type: 'profit' },
    [OUTCOME_STATUS.loss]: { label: '亏损', type: 'loss' },
    [OUTCOME_STATUS.notFilled]: { label: '未成交', type: 'not-filled' },
  },
};

export const STRATEGY_TYPE = {
  trend: 'trend',
  assist: 'assist',
  fish: 'fish',
  tierAssist: 'tier_assist',
};
