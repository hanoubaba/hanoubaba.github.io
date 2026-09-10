<template>
  <section class="panel cases-page" aria-label="典型案例">
    <div v-if="!empty" id="cases-carousel" class="cases-carousel">
      <div class="cases-carousel__viewport" ref="viewport" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp">
        <div class="cases-carousel__track" :style="trackStyle">
          <figure v-for="(file, i) in images" :key="file" class="cases-carousel__slide">
            <img class="cases-carousel__img" :src="src(file)" :alt="file" :loading="i === 0 ? 'eager' : 'lazy'" draggable="false" />
          </figure>
        </div>
      </div>
    </div>
    <p v-else class="cases-empty">暂无案例图片。请将图片放入 ok/cases 文件夹，按序号命名：01.jpg、02.png、03.webp …（两位序号，连续编号）。</p>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { CASES } from '@/config';

const images = ref([]);
const empty = ref(false);
const index = ref(0);
const viewport = ref(null);
const dragging = ref(false);
const startX = ref(0);

const trackStyle = computed(() => ({
  transform: `translateX(-${index.value * 100}%)`,
  transition: dragging.value ? 'none' : 'transform 0.32s ease',
}));

function src(file) {
  return `${CASES.dir}${encodeURIComponent(file)}`;
}

function checkExists(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function discover() {
  const found = [];
  for (let i = 1; i <= CASES.maxCount; i += 1) {
    const base = String(i).padStart(2, '0');
    let hit = null;
    for (const ext of CASES.extensions) {
      const file = `${base}.${ext}`;
      if (await checkExists(src(file))) {
        hit = file;
        break;
      }
    }
    if (hit) found.push(hit);
    else if (found.length) break;
  }
  images.value = found;
  empty.value = found.length === 0;
}

function onDown(e) {
  dragging.value = true;
  startX.value = e.clientX;
  e.currentTarget.setPointerCapture?.(e.pointerId);
}

function onMove() {}

function onUp(e) {
  if (!dragging.value) return;
  dragging.value = false;
  const dx = e.clientX - startX.value;
  if (dx < -40) index.value = Math.min(index.value + 1, images.value.length - 1);
  else if (dx > 40) index.value = Math.max(index.value - 1, 0);
}

onMounted(discover);
</script>
