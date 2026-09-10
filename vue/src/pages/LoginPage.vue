<template>
  <section class="login-page" aria-label="登录">
    <div class="login-card">
      <h2 class="login-card__title">无限拟合模型</h2>
      <p class="login-card__desc">请输入账号和密码</p>
      <form class="login-form" @submit.prevent="submit">
        <label class="login-field">
          <span class="login-field__label">账号</span>
          <input v-model="account" class="login-field__input" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required />
        </label>
        <label class="login-field">
          <span class="login-field__label">密码</span>
          <input v-model="password" class="login-field__input" type="password" autocomplete="current-password" enterkeyhint="go" required />
        </label>
        <p class="login-error" role="alert">{{ store.loginError }}</p>
        <button type="submit" class="login-submit" :disabled="loading">{{ loading ? '登录中' : '登录' }}</button>
      </form>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { store } from '@/composables/store.js';
import { useAuth } from '@/composables/useAuth.js';

const { login } = useAuth();
const account = ref('');
const password = ref('');
const loading = ref(false);

async function submit() {
  if (loading.value) return;
  loading.value = true;
  try {
    await login(account.value.trim(), password.value);
  } finally {
    loading.value = false;
  }
}
</script>
