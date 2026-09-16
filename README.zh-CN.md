<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/zool-wordmark-white.svg" />
    <img src="docs/brand/zool-wordmark-ink.svg" alt="ZOOL" width="168" />
  </picture>
</p>

<p align="center">
  为 <a href="https://github.com/komari-monitor/komari">Komari</a> 与
  <a href="https://github.com/nezhahq/nezha">哪吒监控</a> 打造的安静的状态页。<br />
  <sub>认真打磨软件，让日常更从容。</sub>
</p>

<p align="center">
  <a href="https://github.com/foru17/zool-theme/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/foru17/zool-theme?style=flat-square&color=191B1A&label=release" /></a>
  <a href="https://github.com/foru17/zool-theme/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/foru17/zool-theme/total?style=flat-square&color=191B1A" /></a>
  <a href="https://github.com/foru17/zool-theme/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/foru17/zool-theme?style=flat-square&color=191B1A" /></a>
  <a href="https://github.com/foru17/zool-theme/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/foru17/zool-theme/ci.yml?branch=main&style=flat-square&label=ci" /></a>
  <a href="https://github.com/foru17/zool-theme/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/foru17/zool-theme?style=flat-square&color=53695A" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-53695A?style=flat-square" /></a>
  <br />
  <img alt="Komari 1.4+" src="https://img.shields.io/badge/Komari-1.4%2B-B8C8BE?style=flat-square" />
  <img alt="Nezha v1" src="https://img.shields.io/badge/Nezha-v1-B8C8BE?style=flat-square" />
  <img alt="Zero external requests" src="https://img.shields.io/badge/external%20requests-0-B8C8BE?style=flat-square" />
  <img alt="Languages" src="https://img.shields.io/badge/i18n-en%20·%20zh--CN%20·%20zh--TW%20·%20ja-B8C8BE?style=flat-square" />
</p>

<p align="center">
  <a href="README.md">English</a> · 简体中文
</p>

<p align="center">
  <img src="docs/screenshots/home-light.png" alt="ZOOL 主题浅色模式" width="880" />
</p>

## 用 AI 安装

把下面这段交给 Claude Code、Codex 或任何能访问你服务器的编码代理：

```text
在 https://<host> 的 <Komari|哪吒> 面板上安装 ZOOL 主题。
按照 https://raw.githubusercontent.com/foru17/zool-theme/main/skills/zool-install/SKILL.md 执行：
识别面板、下载最新 Release 并校验 SHA256SUMS、先备份、安装、验证，最后告诉我回滚命令。
```

这个 skill 在任何破坏性操作前都会先询问，也不会删除主题目录。想长期使用，可把
[`skills/zool-install`](skills/zool-install) 复制到 `~/.claude/skills/`。

## 手动安装

从 [Releases](https://github.com/foru17/zool-theme/releases/latest) 下载 `zool-komari-v1.0.0.zip`
或 `zool-nezha-v1.0.0.zip`。

**Komari** —— 管理后台 → 设置 → 主题 → 上传 zip → 选择 **ZOOL**。
命令行安装与升级见 [docs/install-komari.md](docs/install-komari.md)。

**哪吒** —— 把 `zool-dist/` 解压到 compose 文件旁，挂载到面板正在使用的模板目录上：

```yaml
services:
  dashboard:
    volumes:
      - ./data:/dashboard/data
      - ./zool-dist:/dashboard/user-dist:ro   # 设置 → 主题 中选中的模板名
```

然后执行 `docker compose up -d`。配置项与回滚见 [docs/install-nezha.md](docs/install-nezha.md)。

## 你会得到

- **一眼看清整个机群。** 在线节点、带宽、流量、需要注意的机器、月度成本——不放没有意义的平均值。
- **有形状的读数。** CPU、内存、磁盘用绿、黄、红格条表示，数值变化时逐格推进；上下行并排；系统用品牌色方形图标。
- **卡片或台账。** 笔记本上一行四张卡片，长列表用紧凑台账；一键在平铺与分组之间切换；按分组和地区筛选，筛选结果可以用链接分享。
- **如实的状态。** 等待不是离线。掉线的节点保留最后读数并注明最后上报时间，从未上报的节点直接说明。
- **节点详情页。** 实时指标、历史与延迟图表、系统、网络与计费信息。
- **随处可用。** 浅色、深色或跟随系统；English、简体中文、繁體中文、日本語；为手机认真适配。

<p align="center">
  <img src="docs/screenshots/states-light.png" alt="离线、上报延迟与从未上报的节点" width="880" />
</p>

## 设计

- **纸与墨。** 暖白纸面、墨色文字、细线分隔，只在数字需要时才用颜色。
- **不喧宾夺主。** 不用渐变、发光，也不为动而动。
- **默认私密。** 字体、国旗与图标随主题分发，只和你自己的面板通信。
- **小而持续维护。** 用手绘 SVG 代替图表库，gzip 后约 125 KB 的 JavaScript，在真实的 Komari 与哪吒机群上测试。

## 配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `defaultAppearance` | `system` | `system`、`light` 或 `dark`；访客自行选择前使用 |
| `defaultView` | `ledger` | `ledger` 或 `cards` |
| `defaultDensity` | `comfortable` | 台账行高：`comfortable` 或 `compact` |
| `defaultLanguage` | `auto` | `auto`、`en`、`zh-CN`、`zh-TW` 或 `ja` |
| `siteTitle` | *（空）* | 覆盖站点名称 |
| `showOverview` | `true` | 首页总览带 |
| `showCost` | `true` | 月度成本，按币种汇总并折算为 30 天 |
| `showGroups` | `true` | 提供分组选择 |
| `defaultGrouped` | `false` | 访客「按分组展示」按钮的默认状态 |
| `showRegions` | `true` | 地区筛选 |
| `showBilling` | `true` | 卡片上显示价格与到期时间 |
| `showOffline` | `true` | 列出离线节点 |
| `hiddenNodes` | `[]` | 在首页、搜索与节点切换器中隐藏的节点 |
| `hideAdminEntry` | `false` | 隐藏登录按钮 |
| `footerNote` | *（空）* | 页脚的一行文字 |

Komari 在管理后台设置；哪吒编辑 `zool-dist/config.js`，无需重新构建。

## 开发

需要 Node.js 22+ 与 pnpm。

```bash
pnpm install
pnpm dev:demo          # 合成数据，包含所有节点状态
pnpm dev               # Komari：代理 /api 到 ZOOL_UPSTREAM
pnpm dev:nezha         # 哪吒：代理 /api 到 ZOOL_UPSTREAM
pnpm check             # 类型检查、测试、i18n
pnpm build && pnpm check:size && pnpm package
```

代码结构与新增后端见 [docs/architecture.md](docs/architecture.md)，仪表规则见
[docs/instruments.md](docs/instruments.md)。

## 致谢

基于 [Komari](https://github.com/komari-monitor/komari) 与 [哪吒监控](https://github.com/nezhahq/nezha)
的公开 API。字体 [Inter](https://rsms.me/inter/)（SIL OFL），界面图标 [Lucide](https://lucide.dev)（ISC），
国旗 [flag-icons](https://github.com/lipis/flag-icons)（MIT），系统图标 [Simple Icons](https://simpleicons.org)
（CC0；图标为各自权利人的商标，底板颜色取自 Simple Icons 登记的品牌色，Windows 图形为本项目自绘）。

## Star 趋势

<a href="https://star-history.com/#foru17/zool-theme&Date">
  <img src="https://api.star-history.com/svg?repos=foru17/zool-theme&type=Date" alt="Star history" width="600" />
</a>

## 许可

[MIT](LICENSE)。ZOOL 名称与标志为 ZOOL LLC 的商标。

<p align="center"><sub>由 <a href="https://zool.app">ZOOL</a> 出品</sub></p>
