<template>
  <section class="panel methodology-page" aria-label="方法论">
    <div class="methodology-content">
      <aside class="methodology-balance" aria-label="生命周期理论">
        <div class="methodology-balance__row">
          <div class="methodology-balance__side">
            <span class="methodology-balance__stage">趋势立项</span>
            <span class="methodology-balance__desc">时间10，空间3-5倍</span>
          </div>
          <span class="methodology-balance__arrow">==&gt;</span>
          <div class="methodology-balance__side">
            <span class="methodology-balance__stage">趋势力回调</span>
            <span class="methodology-balance__desc">时间空间都满足，止损空间翻倍非常安全</span>
          </div>
          <span class="methodology-balance__arrow">==&gt;</span>
          <div class="methodology-balance__side">
            <span class="methodology-balance__stage">调整等待</span>
            <span class="methodology-balance__desc">进入下一个周期</span>
          </div>
        </div>
      </aside>
      <article v-for="section in sections" :key="section.title" class="methodology-section">
        <h3 class="methodology-section__title">{{ section.title }}</h3>
        <div class="methodology-section__body">
          <p v-for="p in section.paragraphs || []" :key="p" class="methodology-section__text">{{ p }}</p>
          <ul v-if="section.items?.length" class="methodology-section__list">
            <li v-for="item in section.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { METHODOLOGY_SECTIONS } from '@/config';

const sections = [...METHODOLOGY_SECTIONS].reverse();
</script>
