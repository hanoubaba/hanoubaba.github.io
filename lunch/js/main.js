const MENU = [
  {
    id: 'rice',
    name: '盖饭',
    desc: '下饭稳妥，工作日最省脑子。',
    cover: './assets/rice.png',
    items: [
      { name: '黄焖鸡米饭', price: 22, desc: '鸡腿肉、香菇、青椒，酱香很足。', sales: '月售 186', tags: ['热销', '米饭'] },
      { name: '台式卤肉饭', price: 24, desc: '卤肉碎配卤蛋，口味偏甜咸。', sales: '月售 132', tags: ['经典', '卤香'] },
      { name: '照烧鸡排饭', price: 25, desc: '鸡排外脆内嫩，适合想吃得扎实一点。', sales: '月售 168', tags: ['招牌', '鸡排'] },
      { name: '黑椒牛柳饭', price: 28, desc: '黑椒香气更重，配菜也更足。', sales: '月售 119', tags: ['牛肉', '重口'] },
    ],
  },
  {
    id: 'noodle',
    name: '粉面',
    desc: '出餐快，汤面拌面都能选。',
    cover: './assets/noodle.png',
    items: [
      { name: '兰州牛肉面', price: 20, desc: '清汤红油分层，牛肉片加香菜。', sales: '月售 208', tags: ['汤面', '清爽'] },
      { name: '重庆小面', price: 18, desc: '麻辣鲜香，适合想吃得更刺激一点。', sales: '月售 174', tags: ['麻辣', '拌面'] },
      { name: '酸辣粉', price: 19, desc: '红薯粉更滑，酸度更突出。', sales: '月售 153', tags: ['开胃', '粉类'] },
      { name: '肥肠米线', price: 24, desc: '汤底更浓，带一点酸豆角香。', sales: '月售 91', tags: ['米线', '浓汤'] },
    ],
  },
  {
    id: 'snack',
    name: '小吃简餐',
    desc: '吃得快一点，也适合拼单。',
    cover: './assets/snack.png',
    items: [
      { name: '沙县蒸饺套餐', price: 16, desc: '蒸饺配炖盅，分量轻巧。', sales: '月售 143', tags: ['轻量', '套餐'] },
      { name: '生煎锅贴', price: 17, desc: '底部酥脆，适合配豆浆。', sales: '月售 157', tags: ['人气', '脆口'] },
      { name: '鸡腿手抓饼', price: 15, desc: '酱香偏甜，适合边走边吃。', sales: '月售 121', tags: ['便捷', '饼类'] },
      { name: '炸鸡年糕杯', price: 21, desc: '韩式甜辣风味，满足感更强。', sales: '月售 88', tags: ['韩式', '小食'] },
    ],
  },
  {
    id: 'light',
    name: '轻食',
    desc: '下午不犯困的组合。',
    cover: './assets/light.png',
    items: [
      { name: '鸡胸沙拉碗', price: 26, desc: '鸡胸、玉米、紫甘蓝、油醋汁。', sales: '月售 111', tags: ['低负担', '高蛋白'] },
      { name: '牛油果虾仁卷', price: 29, desc: '口感更清爽，适合天气热的时候。', sales: '月售 74', tags: ['冷食', '清爽'] },
      { name: '全麦三明治', price: 18, desc: '火腿鸡蛋搭配生菜番茄。', sales: '月售 127', tags: ['便当', '轻量'] },
      { name: '酸奶水果杯', price: 16, desc: '可以配主食，也能单独加餐。', sales: '月售 98', tags: ['加餐', '甜口'] },
    ],
  },
  {
    id: 'soup',
    name: '汤锅',
    desc: '想吃热乎的就看这里。',
    cover: './assets/soup.png',
    items: [
      { name: '番茄肥牛锅', price: 29, desc: '酸甜汤底，配金针菇和粉丝。', sales: '月售 138', tags: ['暖胃', '肥牛'] },
      { name: '酸菜鱼单人锅', price: 32, desc: '鱼片更嫩，酸菜味更立体。', sales: '月售 116', tags: ['单人锅', '招牌'] },
      { name: '麻辣烫自选锅', price: 24, desc: '微麻微辣，蔬菜肉丸都能搭。', sales: '月售 192', tags: ['自选', '热辣'] },
      { name: '菌菇鸡汤锅', price: 28, desc: '汤底清鲜，适合不想吃辣。', sales: '月售 83', tags: ['清汤', '菌菇'] },
    ],
  },
  {
    id: 'drink',
    name: '饮品配餐',
    desc: '补一个饮品，或者甜口收尾。',
    cover: './assets/drink.png',
    items: [
      { name: '鲜榨柠檬茶', price: 12, desc: '酸甜清口，配炸物很合适。', sales: '月售 223', tags: ['解腻', '冷饮'] },
      { name: '无糖豆浆', price: 8, desc: '热饮稳妥，早餐午餐都能配。', sales: '月售 165', tags: ['热饮', '低糖'] },
      { name: '杨枝甘露', price: 15, desc: '芒果和西米更多，适合甜口。', sales: '月售 118', tags: ['甜品', '冰爽'] },
      { name: '乌龙奶茶', price: 14, desc: '茶味更重，甜度中等。', sales: '月售 149', tags: ['奶茶', '加餐'] },
    ],
  },
];

const heroStripEl = document.getElementById('hero-strip');
const categoryRailEl = document.getElementById('category-rail');
const menuScrollEl = document.getElementById('menu-scroll');

let activeCategoryId = MENU[0]?.id || '';
let syncingFromRail = false;
let syncTimer = 0;

function formatPrice(price) {
  return `¥${price}`;
}

function renderHeroStrip() {
  const picks = MENU.map((section) => ({
    section: section.name,
    item: section.items[0],
  })).slice(0, 3);

  heroStripEl.innerHTML = picks.map(({ section, item }) => `
    <article class="hero-card">
      <p class="hero-card__label">${section}</p>
      <h2 class="hero-card__name">${item.name}</h2>
      <p class="hero-card__price">${formatPrice(item.price)}</p>
    </article>
  `).join('');
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
          <div class="section-header__count">${section.items.length} 款在售</div>
        </div>
        <img class="section-header__thumb" src="${section.cover}" alt="${section.name}" loading="lazy" />
      </header>

      <div class="dish-list">
        ${section.items.map((item) => `
          <article class="dish-card">
            <div class="dish-card__body">
              <h3 class="dish-card__title">${item.name}</h3>
              <p class="dish-card__desc">${item.desc}</p>
              <div class="dish-card__meta">
                ${item.tags.map((tag, tagIndex) => `<span class="${buildTagClass(tagIndex)}">${tag}</span>`).join('')}
              </div>
              <div class="dish-card__bottom">
                <span class="dish-card__sales">${item.sales}</span>
                <strong class="dish-card__price">${formatPrice(item.price)}</strong>
              </div>
            </div>
            <img class="dish-card__image" src="${section.cover}" alt="${item.name}" loading="lazy" />
          </article>
        `).join('')}
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
  syncingFromRail = true;
  menuScrollEl.scrollTo({
    top: target.offsetTop - 10,
    behavior: 'smooth',
  });
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncingFromRail = false;
  }, 260);
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

function bindMenuScroll() {
  menuScrollEl.addEventListener('scroll', () => {
    if (syncingFromRail) return;
    const id = getCurrentSectionId();
    if (id && id !== activeCategoryId) {
      setActiveCategory(id);
    }
  }, { passive: true });
}

renderHeroStrip();
renderCategoryRail();
renderMenuSections();
bindCategoryRail();
bindMenuScroll();
