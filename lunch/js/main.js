const MENU = [
  {
    id: 'meat',
    name: '肉食主义',
    desc: '大口吃肉，今天就选硬菜。',
    cover: './assets/rice.png',
    items: [
      { name: '红烧排骨', desc: '酱香浓一点，配米饭很稳。', tags: ['排骨', '红烧'] },
      { name: '炒鸡', desc: '家常炒鸡，香辣下饭。', tags: ['鸡肉', '下饭'] },
      { name: '咖喱鸡', desc: '咖喱汤汁浓，适合拌饭。', tags: ['鸡肉', '咖喱'] },
      { name: '番茄牛腩', desc: '番茄酸甜，牛腩炖软。', tags: ['牛腩', '酸甜'] },
      { name: '肉末豆腐', desc: '豆腐嫩，肉末香，口味不重。', tags: ['豆腐', '肉末'] },
      { name: '红烧肉', desc: '肥瘦相间，甜咸口。', tags: ['猪肉', '红烧'] },
      { name: '红烧猪蹄', desc: '软糯胶香，适合慢慢吃。', tags: ['猪蹄', '红烧'] },
      { name: '卤鸡腿', desc: '卤香入味，简单顶饱。', tags: ['鸡腿', '卤味'] },
    ],
  },
  {
    id: 'vegetable',
    name: '素菜',
    desc: '清爽一点，配肉也合适。',
    cover: './assets/light.png',
    items: [
      { name: '番茄炒蛋', desc: '酸甜家常，最稳的素菜。', tags: ['鸡蛋', '番茄'] },
      { name: '炒土豆丝', desc: '脆口清爽，简单下饭。', tags: ['土豆', '爽口'] },
      { name: '炒豆芽', desc: '清脆不腻，适合配肉菜。', tags: ['豆芽', '清爽'] },
    ],
  },
  {
    id: 'soup',
    name: '汤锅',
    desc: '热乎乎的汤和面。',
    cover: './assets/soup.png',
    items: [
      { name: '排骨汤', desc: '清炖排骨汤，暖胃不腻。', tags: ['排骨', '汤'] },
      { name: '丸子汤', desc: '丸子配清汤，简单热乎。', tags: ['丸子', '汤'] },
      { name: '紫菜汤', desc: '清淡快手，配饭刚好。', tags: ['紫菜', '清淡'] },
      { name: '炝锅面', desc: '热汤面，想吃主食就选它。', tags: ['面', '热汤'] },
    ],
  },
];

const statsPanelEl = document.getElementById('stats-panel');
const categoryRailEl = document.getElementById('category-rail');
const menuScrollEl = document.getElementById('menu-scroll');
const submitBarEl = document.getElementById('submit-bar');
const submitDishEl = document.getElementById('submit-dish');
const submitMetaEl = document.getElementById('submit-meta');
const submitChoiceButtonEl = document.getElementById('submit-choice');
const submitStatusEl = document.getElementById('submit-status');
const STORAGE_KEY = 'chenzhuqi-lunch-choice-history';
const SUPABASE_URL = 'https://rxggjijrfafcrmtkqkuv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8B1PLTeHhtPou4lPt9cl6w_O2hipMVY';
const LUNCH_ORDERS_ENDPOINT = `${SUPABASE_URL}/rest/v1/lunch_orders`;
const LUNCH_ORDERS_QUERY = 'select=id,selected_at,category,name,created_at&order=selected_at.desc';

let activeCategoryId = MENU[0]?.id || '';
let currentPage = 'order';
let syncingFromRail = false;
let syncTimer = 0;
let syncFrame = 0;
let submitPending = false;
let submitFeedback = '';
let submitFeedbackType = '';
let statsRecords = [];
let statsLoading = false;
let statsLoaded = false;
let statsError = '';
let choiceHistory = readChoiceHistory();

function buildDishId(sectionId, itemIndex) {
  return `${sectionId}-${itemIndex}`;
}

function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateKeyFromTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : getTodayKey(date);
}

function formatDateLabel(dateKey) {
  if (dateKey === getTodayKey()) return '今天';
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function readChoiceHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function saveChoiceHistory() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choiceHistory));
  } catch (_err) {
    // 本地存储不可用时仍保留当前页面内的选择状态。
  }
}

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function getTodayChoice() {
  const choice = choiceHistory[getTodayKey()] || null;
  return choice && findDishById(choice.dishId) ? choice : null;
}

function getTodayRecord() {
  const choice = choiceHistory[getTodayKey()] || null;
  return choice && choice.dishName ? choice : null;
}

function findDishById(dishId) {
  for (const section of MENU) {
    const itemIndex = section.items.findIndex((item, index) => buildDishId(section.id, index) === dishId);
    if (itemIndex >= 0) {
      return {
        dishId,
        item: section.items[itemIndex],
        section,
      };
    }
  }
  return null;
}

function getHistoryRecords() {
  return Object.values(choiceHistory)
    .filter((record) => record && record.date && record.dishName)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function normalizeLunchOrderRows(rows) {
  const mappedRecords = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const selectedAt = row?.selected_at || row?.created_at || '';
      return {
        id: row?.id || '',
        date: getDateKeyFromTimestamp(selectedAt),
        selectedAt,
        dishName: row?.name || '',
        sectionName: row?.category || '',
      };
    })
    .filter((record) => record.date && record.dishName && record.sectionName);

  const latestByDate = new Map();
  mappedRecords.forEach((record) => {
    const existing = latestByDate.get(record.date);
    if (!existing || String(record.selectedAt).localeCompare(String(existing.selectedAt)) > 0) {
      latestByDate.set(record.date, record);
    }
  });

  return Array.from(latestByDate.values())
    .sort((a, b) => (
      b.date.localeCompare(a.date)
      || String(b.selectedAt).localeCompare(String(a.selectedAt))
    ));
}

async function fetchLunchOrderRecords() {
  const res = await fetch(`${LUNCH_ORDERS_ENDPOINT}?${LUNCH_ORDERS_QUERY}`, {
    headers: getSupabaseHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return normalizeLunchOrderRows(await res.json());
}

async function loadStatsPanel({ force = false } = {}) {
  if (statsLoading || (statsLoaded && !force)) {
    renderStatsPanel();
    return;
  }

  statsLoading = true;
  statsError = '';
  renderStatsPanel();

  try {
    statsRecords = await fetchLunchOrderRecords();
    statsLoaded = true;
  } catch (_err) {
    statsError = '统计加载失败';
  } finally {
    statsLoading = false;
    renderStatsPanel();
  }
}

function getRecordInfo(record) {
  const dish = record.dishId ? findDishById(record.dishId) : null;
  const matchedSection = dish?.section || MENU.find((section) => (
    section.id === record.sectionId || section.name === record.sectionName
  ));

  return {
    dishName: record.dishName || dish?.item.name || '未命名',
    sectionId: record.sectionId || matchedSection?.id || record.sectionName || 'unknown',
    sectionName: record.sectionName || matchedSection?.name || '未分类',
  };
}

function getDishStats(records) {
  const counts = new Map();
  records.forEach((record) => {
    const info = getRecordInfo(record);
    const current = counts.get(info.dishName) || {
      dishName: info.dishName,
      sectionName: info.sectionName,
      count: 0,
    };
    current.count += 1;
    counts.set(info.dishName, current);
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.dishName.localeCompare(b.dishName, 'zh-Hans-CN'));
}

function getSectionStats(records) {
  const counts = new Map(MENU.map((section, index) => [section.id, {
    sectionId: section.id,
    sectionName: section.name,
    count: 0,
    order: index,
  }]));

  records.forEach((record) => {
    const info = getRecordInfo(record);
    const current = counts.get(info.sectionId) || {
      sectionId: info.sectionId,
      sectionName: info.sectionName,
      count: 0,
      order: MENU.length,
    };
    current.count += 1;
    counts.set(info.sectionId, current);
  });

  return Array.from(counts.values())
    .sort((a, b) => a.order - b.order || a.sectionName.localeCompare(b.sectionName, 'zh-Hans-CN'));
}

function getPercentValue(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function renderStatsPanel() {
  if (statsLoading && !statsLoaded) {
    statsPanelEl.innerHTML = '<section class="stats-block"><div class="stats-empty">加载中...</div></section>';
    return;
  }

  if (statsError && !statsRecords.length) {
    statsPanelEl.innerHTML = `<section class="stats-block"><div class="stats-empty">${escapeHtml(statsError)}</div></section>`;
    return;
  }

  const records = statsRecords;
  const todayChoice = records.find((record) => record.date === getTodayKey()) || null;
  const dishStats = getDishStats(records);
  const sectionStats = getSectionStats(records);
  const dishStatMap = new Map(dishStats.map((stat) => [stat.dishName, stat]));
  const dishRankMap = new Map(dishStats.map((stat, index) => [stat.dishName, index + 1]));
  const sectionStatMap = new Map(sectionStats.map((stat) => [stat.sectionId, stat]));
  const favoriteDish = dishStats[0] || null;
  const favoriteSection = sectionStats
    .filter((stat) => stat.count > 0)
    .sort((a, b) => b.count - a.count || a.order - b.order)[0] || null;

  const categoryMarkup = sectionStats.map((stat) => {
    const percent = getPercentValue(stat.count, records.length);
    const isTop = favoriteSection?.sectionId === stat.sectionId;

    return `
      <div class="stats-category${isTop ? ' is-top' : ''}">
        <div class="stats-category__head">
          <strong>${escapeHtml(stat.sectionName)}</strong>
          <span>${stat.count}次</span>
        </div>
        <div class="stats-category__meter" aria-label="${escapeHtml(stat.sectionName)}占比${percent}%">
          <span style="--value: ${percent}%"></span>
        </div>
        <span class="stats-category__percent">${percent}%</span>
      </div>
    `;
  }).join('');

  const historyMarkup = records.length
    ? records.map((record) => {
      const info = getRecordInfo(record);
      const dishStat = dishStatMap.get(info.dishName);
      const sectionStat = sectionStatMap.get(info.sectionId);
      const rank = dishRankMap.get(info.dishName);

      return `
      <li class="stats-list__item">
        <span class="stats-list__date">${formatDateLabel(record.date)}</span>
        <div class="stats-list__main">
          <strong>${escapeHtml(info.dishName)}</strong>
          <span>${escapeHtml(info.sectionName)}</span>
        </div>
        <div class="stats-list__chips">
          <span>本菜 ${dishStat?.count || 0}次</span>
          <span>分类 ${sectionStat?.count || 0}次</span>
          <span>常选 #${rank || '-'}</span>
        </div>
      </li>
    `;
    }).join('')
    : '<li class="stats-empty">暂无记录</li>';

  statsPanelEl.innerHTML = `
    <section class="stats-block stats-block--overview">
      <div class="stats-block__header">
        <h2>数据统计</h2>
        <span>${statsLoading ? '刷新中' : '接口数据'}</span>
      </div>
      <div class="stats-summary">
        <div class="stats-summary__item">
          <span class="stats-summary__label">记录天数</span>
          <span class="stats-summary__value">${records.length}天</span>
        </div>
        <div class="stats-summary__item${todayChoice ? ' stats-summary__item--today' : ''}">
          <span class="stats-summary__label">今日</span>
          <span class="stats-summary__value">${todayChoice ? escapeHtml(todayChoice.dishName) : '未提交'}</span>
        </div>
        <div class="stats-summary__item">
          <span class="stats-summary__label">菜品数</span>
          <span class="stats-summary__value">${dishStats.length}道</span>
        </div>
        <div class="stats-summary__item${favoriteDish ? ' stats-summary__item--favorite' : ''}">
          <span class="stats-summary__label">常选</span>
          <span class="stats-summary__value">${favoriteDish ? escapeHtml(favoriteDish.dishName) : '-'}</span>
          <span class="stats-summary__note">${favoriteDish ? `${favoriteDish.count}次` : '暂无'}</span>
        </div>
      </div>
    </section>
    <section class="stats-block">
      <div class="stats-block__header">
        <h2>分类占比</h2>
        <span>${favoriteSection ? `偏好 ${escapeHtml(favoriteSection.sectionName)}` : '暂无偏好'}</span>
      </div>
      <div class="stats-categories">${categoryMarkup}</div>
    </section>
    <section class="stats-block">
      <div class="stats-block__header">
        <h2>每日列表</h2>
        <span>${records.length}天</span>
      </div>
      <ul class="stats-list">${historyMarkup}</ul>
    </section>
  `;
}

function setSubmitFeedback(message = '', type = '') {
  submitFeedback = message;
  submitFeedbackType = type;
  renderSubmitBar();
}

function renderSubmitBar() {
  if (!submitBarEl || !submitDishEl || !submitMetaEl || !submitChoiceButtonEl || !submitStatusEl) return;

  const choice = getTodayChoice();
  if (!choice) {
    submitBarEl.hidden = true;
    submitDishEl.textContent = '未选择';
    submitMetaEl.textContent = '请选择今日想吃的饭';
    submitStatusEl.textContent = '';
    submitStatusEl.className = 'submit-bar__status';
    submitChoiceButtonEl.disabled = true;
    submitChoiceButtonEl.textContent = '提交';
    return;
  }

  submitBarEl.hidden = false;
  submitDishEl.textContent = choice.dishName;
  submitMetaEl.textContent = `${choice.sectionName} · ${choice.submittedAt ? '已提交' : '待提交'}`;
  submitChoiceButtonEl.disabled = submitPending || Boolean(choice.submittedAt);
  submitChoiceButtonEl.textContent = submitPending ? '提交中' : (choice.submittedAt ? '已提交' : '提交');
  submitStatusEl.textContent = submitFeedback;
  submitStatusEl.className = `submit-bar__status${submitFeedbackType ? ` is-${submitFeedbackType}` : ''}`;
}

async function submitLunchOrder(record) {
  const res = await fetch(LUNCH_ORDERS_ENDPOINT, {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function submitCurrentChoice() {
  if (submitPending) return;

  const todayKey = getTodayKey();
  const choice = getTodayChoice();
  if (!choice) {
    setSubmitFeedback('请先选择', 'error');
    return;
  }
  if (choice.submittedAt) return;

  const submittedAt = new Date().toISOString();
  submitPending = true;
  setSubmitFeedback('', '');

  try {
    const result = await submitLunchOrder({
      selected_at: submittedAt,
      category: choice.sectionName,
      name: choice.dishName,
    });

    choiceHistory[todayKey] = {
      ...choiceHistory[todayKey],
      submittedAt,
      remoteOrderId: result?.id || choiceHistory[todayKey]?.remoteOrderId || '',
    };
    saveChoiceHistory();
    setSubmitFeedback('已提交', 'success');
    statsLoaded = false;
    statsError = '';
    if (currentPage === 'stats') {
      loadStatsPanel({ force: true });
    }
  } catch (_err) {
    setSubmitFeedback('提交失败', 'error');
  } finally {
    submitPending = false;
    renderSubmitBar();
  }
}

function updateSelectedDishCards() {
  const selectedDishId = getTodayChoice()?.dishId || '';
  menuScrollEl.querySelectorAll('[data-dish-id]').forEach((button) => {
    const selected = button.getAttribute('data-dish-id') === selectedDishId;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    const selectedBadge = button.querySelector('.dish-card__selected');
    if (selectedBadge) {
      selectedBadge.hidden = !selected;
    }
  });
}

function toggleDishChoice(dishId) {
  const todayKey = getTodayKey();
  const currentChoice = getTodayChoice();

  if (currentChoice?.dishId === dishId) {
    delete choiceHistory[todayKey];
  } else {
    const dish = findDishById(dishId);
    if (!dish) return;
    choiceHistory[todayKey] = {
      date: todayKey,
      dishId,
      dishName: dish.item.name,
      sectionId: dish.section.id,
      sectionName: dish.section.name,
    };
  }

  saveChoiceHistory();
  renderStatsPanel();
  setSubmitFeedback('', '');
  renderSubmitBar();
  updateSelectedDishCards();
}

function renderCategoryRail() {
  categoryRailEl.innerHTML = MENU.map((section) => `
    <button
      type="button"
      class="category-button${section.id === activeCategoryId ? ' is-active' : ''}"
      data-category-id="${section.id}"
      aria-pressed="${section.id === activeCategoryId ? 'true' : 'false'}"
    >${section.name}</button>
  `).join('');
}

function buildTagClass(index) {
  return index === 1 ? 'dish-card__tag dish-card__tag--green' : 'dish-card__tag';
}

function renderMenuSections() {
  menuScrollEl.innerHTML = MENU.map((section) => `
    <section class="menu-section" id="section-${section.id}" data-section-id="${section.id}">
      <header class="section-header">
        <div>
          <h2 class="section-header__title">${section.name}</h2>
          <p class="section-header__desc">${section.desc}</p>
          <div class="section-header__count">${section.items.length} 道可选</div>
        </div>
        <img class="section-header__thumb" src="${section.cover}" alt="${section.name}" loading="lazy" />
      </header>

      <div class="dish-list">
        ${section.items.map((item, itemIndex) => {
          const dishId = buildDishId(section.id, itemIndex);
          const selected = getTodayChoice()?.dishId === dishId;

          return `
          <button
            type="button"
            class="dish-card${selected ? ' is-selected' : ''}"
            data-dish-id="${dishId}"
            aria-pressed="${selected ? 'true' : 'false'}"
          >
            <div class="dish-card__body">
              <div class="dish-card__head">
                <h3 class="dish-card__title">${item.name}</h3>
                <span class="dish-card__selected"${selected ? '' : ' hidden'}>已选</span>
              </div>
              <p class="dish-card__desc">${item.desc}</p>
              <div class="dish-card__meta">
                ${item.tags.map((tag, tagIndex) => `<span class="${buildTagClass(tagIndex)}">${tag}</span>`).join('')}
              </div>
            </div>
            <img class="dish-card__image" src="${section.cover}" alt="${item.name}" loading="lazy" />
          </button>
        `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

function setActiveCategory(id) {
  if (!id) return;
  activeCategoryId = id;
  categoryRailEl.querySelectorAll('.category-button').forEach((button) => {
    const active = button.getAttribute('data-category-id') === id;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (active) {
      button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });
}

function scrollMenuToCategory(id) {
  const target = document.getElementById(`section-${id}`);
  if (!target) return;
  const maxScrollTop = Math.max(0, menuScrollEl.scrollHeight - menuScrollEl.clientHeight);
  const targetTop = Math.min(Math.max(0, target.offsetTop - 10), maxScrollTop);

  syncingFromRail = true;
  window.clearTimeout(syncTimer);
  window.cancelAnimationFrame(syncFrame);
  menuScrollEl.scrollTo({
    top: targetTop,
    behavior: 'smooth',
  });

  const waitForScroll = () => {
    if (Math.abs(menuScrollEl.scrollTop - targetTop) <= 2) {
      syncingFromRail = false;
      return;
    }
    syncFrame = window.requestAnimationFrame(waitForScroll);
  };

  syncFrame = window.requestAnimationFrame(waitForScroll);
  syncTimer = window.setTimeout(() => {
    window.cancelAnimationFrame(syncFrame);
    syncingFromRail = false;
  }, 900);
}

function getCurrentSectionId() {
  const sections = Array.from(menuScrollEl.querySelectorAll('[data-section-id]'));
  const currentTop = menuScrollEl.scrollTop + 24;
  let currentId = sections[0]?.getAttribute('data-section-id') || '';

  for (const section of sections) {
    if (section.offsetTop <= currentTop) {
      currentId = section.getAttribute('data-section-id') || currentId;
    }
  }

  return currentId;
}

function bindCategoryRail() {
  categoryRailEl.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-category-id]') : null;
    if (!button) return;
    const id = button.getAttribute('data-category-id') || '';
    setActiveCategory(id);
    scrollMenuToCategory(id);
  });
}

function bindStatsPanel() {
  statsPanelEl.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-clear-today]') : null;
    if (!button) return;
    delete choiceHistory[getTodayKey()];
    saveChoiceHistory();
    renderStatsPanel();
    setSubmitFeedback('', '');
    renderSubmitBar();
    updateSelectedDishCards();
  });
}

function bindDishSelection() {
  menuScrollEl.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-dish-id]') : null;
    if (!button) return;
    toggleDishChoice(button.getAttribute('data-dish-id') || '');
  });
}

function setPage(mode) {
  const orderPage = document.getElementById('order-page');
  const statsPage = document.getElementById('stats-page');
  const btnOrder = document.getElementById('btn-tab-order');
  const btnStats = document.getElementById('btn-tab-stats');
  if (!orderPage || !statsPage || !btnOrder || !btnStats) return;

  const toStats = mode === 'stats';
  currentPage = toStats ? 'stats' : 'order';

  orderPage.hidden = toStats;
  statsPage.hidden = !toStats;
  btnOrder.classList.toggle('is-active', !toStats);
  btnOrder.setAttribute('aria-selected', toStats ? 'false' : 'true');
  btnStats.classList.toggle('is-active', toStats);
  btnStats.setAttribute('aria-selected', toStats ? 'true' : 'false');

  if (toStats) loadStatsPanel({ force: true });
}

function bindPageSwitch() {
  document.getElementById('btn-tab-order')?.addEventListener('click', () => setPage('order'));
  document.getElementById('btn-tab-stats')?.addEventListener('click', () => setPage('stats'));
}

function bindSubmitChoice() {
  submitChoiceButtonEl?.addEventListener('click', submitCurrentChoice);
}

function bindMenuScroll() {
  menuScrollEl.addEventListener('scroll', () => {
    if (syncingFromRail) return;
    const id = getCurrentSectionId();
    if (id && id !== activeCategoryId) {
      setActiveCategory(id);
    }
  }, { passive: true });
}

renderStatsPanel();
renderCategoryRail();
renderMenuSections();
renderSubmitBar();
bindCategoryRail();
bindStatsPanel();
bindDishSelection();
bindPageSwitch();
bindSubmitChoice();
bindMenuScroll();
setPage(currentPage);
