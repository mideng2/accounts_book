# Accounts Book

一个基于 `Vue 3 + Vite + PWA` 的个人记账应用，支持：

- 手动记账
- 支付宝 CSV 导入
- 招商银行 PDF 导入
- 资产类型与资产快照管理
- 本地备份与恢复

当前项目按 `GitHub Pages` 子路径部署配置，目标地址为：

`https://mideng2.github.io/accounts_book/`

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

默认会启动一个本地开发服务器，用于日常开发调试。

## 本地构建

构建生产版本：

```bash
npm run build
```

构建产物输出到：

`dist/`

如果想本地预览生产构建结果：

```bash
npm run preview
```

## GitHub Pages 部署

本项目已经适配 `GitHub Pages` 子路径部署：

- 仓库地址：`https://github.com/mideng2/accounts_book`
- 站点地址：`https://mideng2.github.io/accounts_book/`

### 已完成的配置

- `vite.config.ts` 已设置 `base: '/accounts_book/'`
- PWA `manifest` 已适配 `/accounts_book/` 路径
- 路由已切换为 `hash` 模式，避免 GitHub Pages 刷新子页面 404
- 已提供 GitHub Actions 工作流：
  - `.github/workflows/deploy.yml`

### 部署步骤

1. 提交并推送代码：

```bash
git add .
git commit -m "Update app"
git push origin main
```

2. 打开 GitHub 仓库：

`Settings -> Pages`

3. 在 `Build and deployment` 中选择：

`Source -> GitHub Actions`

4. 等待 Actions 执行完成

5. 访问：

`https://mideng2.github.io/accounts_book/`

## 安装为桌面 PWA

部署成功后，可以直接在 PC 浏览器中安装为桌面应用。

推荐使用：

- Chrome
- Edge

步骤：

1. 打开 `https://mideng2.github.io/accounts_book/`
2. 在地址栏右侧点击“安装应用”
3. 安装后可直接固定到桌面或任务栏

## 数据存储说明

本项目数据保存在浏览器本地：

- `IndexedDB`
- `localStorage`

这意味着：

1. `localhost` 的数据和 `GitHub Pages` 上的数据不是同一份
2. 换浏览器、换设备、清理浏览器站点数据后，本地数据可能丢失
3. 正式使用前建议定期导出备份

## 数据迁移

如果你已经在本地开发版里录入过数据，想迁移到 GitHub Pages 线上版：

1. 在本地开发版中使用“备份导出”导出 JSON
2. 打开线上版 `https://mideng2.github.io/accounts_book/`
3. 在线上版中使用“备份恢复”导入该 JSON

这样可以把本地已有账单和资产数据迁过去。

## 常见问题

### 1. 为什么线上版打开后是空数据？

因为浏览器会把 `localhost` 和 `https://mideng2.github.io/accounts_book/` 视为两个不同站点，本地存储不会自动共享。

### 2. 为什么我更新代码后页面没有立刻变？

因为项目启用了 PWA 缓存。一般刷新一次，或关闭页面后重新打开即可看到新版本。

### 3. 为什么 GitHub Pages 上不用后端也能运行？

因为这个项目是纯前端静态应用，数据处理和本地存储都在浏览器里完成，GitHub Pages 只负责托管静态文件。

## 技术栈

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- LESS
- Dexie
- ECharts
- vite-plugin-pwa

