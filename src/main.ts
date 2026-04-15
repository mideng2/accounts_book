import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter } from '@/app/router';
import { ensureSeedData } from '@/db/seed';
import '@/assets/icons/iconfont.js';
import App from './App.vue';
import '@/styles/main.less';

async function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();

  await ensureSeedData();

  app.use(pinia);
  app.use(createRouter());
  app.mount('#app');
}

void bootstrap();
