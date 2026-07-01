# Codex 启动 Prompt

> 复制下方分隔线之间的内容到 Codex，并按附件清单上传 PRD 和 8 张截图。

---

你是一位资深全栈工程师。请基于附件中的 PRD 和 8 张设计截图，从零搭建一个名为 **Potato** 的极简风番茄钟网站，落地为可直接 `pnpm dev` 启动的 Next.js 14 项目。

## 必须严格遵守

1. **以截图为视觉准绳**：四套主题的颜色、按钮的 monochrome 填充、排行榜抽屉的布局、字体的字重和字距，都要像素级对齐截图。截图之间的任何不一致，以 PRD 第 3 节"设计系统"为准。
2. **字体唯一**：全站只用 Geist Mono（含倒计时、按钮、正文、榜单），不要混入其他字体。
3. **按钮规则不可妥协**：Primary / Pill 强调按钮一律 `bg: var(--fg); color: var(--bg)`，绝不允许出现"浅彩色底 + 白字"的低对比组合。这是上一版被推翻的设计。
4. **零登录**：不要加任何 auth、邮箱、OAuth、modal 引导。打开即用。
5. **国旗用 SVG 图片**（jsDelivr `flag-icons@7.2.3`），不要用 emoji，也不要用字母代码徽章。

## 技术栈

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + CSS 变量（主题用 `[data-theme="xxx"]` 切换）
- Zustand 管全局偏好（主题 / 昵称 / 国旗 / 音乐 / 当日计数）
- 后端：Next.js Route Handlers + Vercel KV（最简方案）
- 字体：next/font 加载 Geist Mono

## 交付物

1. 完整可运行项目，根目录有 `README.md` 说明启动 / 部署步骤
2. `app/globals.css` 中四套主题的 CSS 变量按 PRD 表格 1:1 写入
3. 排行榜后端 `POST /api/pomodoro/complete` 和 `GET /api/leaderboard/today` 都要可工作（无 KV 时降级到内存 Map，方便本地跑）
4. Lighthouse 性能 ≥ 95
5. 移动端断点（< 768px）按 PRD 第 9 节适配
6. 计时器在标签页隐藏后仍准确（用 `performance.now()` 校准，不要裸 setInterval）

## 实施顺序（建议）

1. 搭骨架 → 把四套主题 CSS 变量 + 全局字体 + Tailwind 配置先就位
2. 实现首屏静态布局（顶 bar + 中央 stage + 底栏），不接交互
3. 接计时器交互（Start / Pause / Reset / Mode 切换）
4. 接主题切换 + 音乐控件（音轨先用 public/audio/ 占位 mp3）
5. 实现排行榜抽屉 UI + 昵称卡片 + 国旗循环
6. 接后端 API + Vercel KV
7. 跑 Lighthouse，调到 95+
8. 移动端断点适配
9. 写 README

## 反馈节点

每完成上面一个阶段，请：
- 截一张当前状态的截图
- 简述这一步做了什么 / 遇到了什么 / 下一步打算做什么
- 等我 ack 再进入下一阶段

不要一口气全做完再来汇报。

---

## 附件清单（请一起上传）

| # | 文件 | 用途 |
|---|---|---|
| 1 | `potato-pomodoro-prd.md` | 完整需求文档 |
| 2 | `01-cream-default.png` | 奶油主题默认态 |
| 3 | `02-night-theme.png` | 深夜主题 |
| 4 | `03-forest-theme.png` | 森林主题 |
| 5 | `04-mist-theme.png` | 雾蓝主题 |
| 6 | `05-leaderboard-open.png` | 排行榜抽屉 + 昵称卡片 |
| 7 | `06-running-state.png` | 倒计时运行中 |
| 8 | `07-short-break-mode.png` | Short break 模式 |
| 9 | `08-mobile-portrait.png` | 移动端竖屏 |
