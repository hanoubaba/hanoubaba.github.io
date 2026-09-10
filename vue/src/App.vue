<template>
    <LoginPage v-if="!store.authed" />
  <main v-else id="app-root" class="container">
    <header class="header">
      <div class="header-bar">
        <button
          v-if="store.page === 'front'"
          type="button"
          class="header-action"
          @click="clearFront"
        >清空</button>
        <h1 class="title"></h1>
        <div class="header-actions">
          <div class="page-switch" role="tablist" aria-label="页面切换">
            <button type="button" class="page-switch__btn" :class="{ 'is-active': store.page === 'front' }" @click="setPage('front')">前台</button>
            <button type="button" class="page-switch__btn" :class="{ 'is-active': store.page === 'admin' }" @click="setPage('admin')">后台管理</button>
            <button type="button" class="page-switch__btn" :class="{ 'is-active': store.page === 'observations' }" @click="setPage('observations')">观测日志</button>
          </div>
          <div class="admin-more">
            <button type="button" class="admin-more__toggle" :class="{ 'is-active': moreActive }" aria-label="更多" @click="store.moreOpen = !store.moreOpen">···</button>
            <div v-if="store.moreOpen" class="admin-more__menu" role="menu">
              <button type="button" class="admin-more__item" @click="setPage('methodology')">方法论</button>
              <button type="button" class="admin-more__item" @click="setPage('stats')">数据统计</button>
              <button type="button" class="admin-more__item" @click="setPage('cases')">典型案例</button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <FrontPage v-if="store.page === 'front'" />
    <AdminPage v-else-if="store.page === 'admin'" />
    <StatsPage v-else-if="store.page === 'stats'" />
    <MethodologyPage v-else-if="store.page === 'methodology'" />
    <CasesPage v-else-if="store.page === 'cases'" />
    <ObservationsPage v-else-if="store.page === 'observations'" />
  </main>

  <div v-if="store.toast" id="app-toast" class="app-toast" role="status">{{ store.toast }}</div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { PAGES } from '@/config';
import { store } from '@/composables/store.js';
import { useAuth } from '@/composables/useAuth.js';
import LoginPage from '@/pages/LoginPage.vue';
import FrontPage from '@/pages/FrontPage.vue';
import AdminPage from '@/pages/AdminPage.vue';
import StatsPage from '@/pages/StatsPage.vue';
import MethodologyPage from '@/pages/MethodologyPage.vue';
import CasesPage from '@/pages/CasesPage.vue';
import ObservationsPage from '@/pages/ObservationsPage.vue';

const auth = useAuth();
const moreActive = computed(() => ['stats', 'methodology', 'cases'].includes(store.page));

function resetFront() {
  store.frontMode = 'trend';
  store.trendForm = { name: '', startTime: '', openPrice: '', stopPrice: '', error: '' };
  store.fishForm = { name: '', from: '', to: '', error: '' };
  store.editingId = null;
  store.editingPreserve = null;
}

function setPage(page) {
  store.moreOpen = false;
  store.page = page;
  if (page !== PAGES.front) {
    if (store.editingId) {
      store.editingId = null;
      store.editingPreserve = null;
    }
  } else if (!store.editingId) {
    resetFront();
  }
  if (page === PAGES.admin) {
    resetFront();
  }
}

function clearFront() {
  resetFront();
}

onMounted(() => {
  auth.bindSessionListeners();
  auth.init();
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.admin-more')) store.moreOpen = false;
  });
});
</script>
