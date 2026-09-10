# 无限拟合模型 · Vue 重构

基于 `hanoubaba.github.io/ok` 的 Vue 3 重构版。接口、计算规则、视觉风格与原项目保持一致，重点把散落的魔法值收口到 `src/config/`。

## 本地运行

```bash
cd hanoubaba.github.io/vue
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

产物在 `dist/`。案例图片仍读取 `ok/cases/`（开发环境由 Vite 映射到 `/cases/`）。

## 结构

```
src/config/        统一常量：档位、R 倍数、模式、接口、文案
src/api/           复用原 Supabase REST（strategies / observations / settings / auth）
src/domain/        纯函数业务：止盈止损、让利档、趋势力预测、单据映射
src/composables/   页面状态
src/pages/         登录 / 前台 / 后台 / 观测 / 统计 / 方法论 / 案例
src/assets/style.css  沿用原 ok/css/style.css
```

登录、表结构、RPC 与原来相同，需要同一套 `ok/supabase.sql`。
