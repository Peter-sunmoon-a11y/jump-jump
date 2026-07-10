# 跳跳之星 Web Demo

竖屏像素风长按蓄力跳跃游戏。项目以 React 作为宿主 UI，Phaser 负责游戏场景，Matter.js 负责失败后的刚体坠落。

线上地址：<https://jump-jump.lucas-xue2020.workers.dev>

## 启动与验证

```bash
npm install
npm run dev
npm test
npm run smoke   # 需要 Chromium，默认 /snap/bin/chromium
npm run build
```

## 工程边界

- `src/game`：确定性关卡、跳跃、落点、奖励与 Phaser 场景。
- `src/platform/PlatformAdapter.ts`：宿主平台必须实现的契约。
- `src/platform/mockPlatform.ts`：完整模拟平台，使用 localStorage 保存账户、局次和战绩。
- `src/audio`：无需音频文件的 Web Audio 程序音效。
- `src/App.tsx`：React 宿主、结算、续跳、排行榜、充值与设置界面。

## 迁移到现有 React 宿主

1. 保留 `game`、`audio` 及 `PhaserGame` 模块。
2. 用真实实现替换 `mockPlatform`，实现 `PlatformAdapter`。
3. 登录态、余额、充值弹窗可以直接改用宿主现有组件。
4. Phaser 只在进入游戏后动态加载，不参与服务端渲染。
5. 每局必须锁定 `roundId`、配置版本、随机种子和种子证明。
6. 服务端按 `roundId` 幂等结算，客户端结果只能作为待验证事件摘要。

## 模拟平台覆盖能力

- Play 扣除和平台余额
- 充值档位
- 远程游戏配置
- 活动局次互斥
- 可验证随机种子证明
- 续跳购买记录
- 刷新后的自动补结算
- 重复结算防护
- 战绩与本周奖励榜

模拟数据不会产生真实资产变动。正式环境应由服务端签名配置、验证事件并执行最终结算。

## Cloudflare Workers + D1

线上模式使用 Cloudflare Worker、D1 和静态资源 binding。每个浏览器首次访问会生成匿名 UUID，服务端为其创建稳定玩家 ID 并签发 HMAC Token。

```bash
npm run build:cf
npm run cf:migrate:local
npm run cf:dev
```

生产部署：

```bash
npm run cf:migrate:remote
npm run cf:deploy
npx wrangler secret put DEVICE_SECRET
npx wrangler secret put ADMIN_TOKEN
```

管理员统计 API 需要 `Authorization: Bearer <ADMIN_TOKEN>`：

```text
GET /api/admin/stats
GET /api/admin/players
GET /api/admin/rounds
GET /api/admin/rewards
GET /api/admin/play-ledger
GET /api/admin/leaderboard/weekly
```

Cloudflare D1 数据库结构位于 `migrations/`，Worker 实现位于 `worker/`。生产构建自动使用 HTTP PlatformAdapter；普通 `npm run dev` 默认继续使用离线模拟平台。

匿名身份同时保存在 localStorage 和 IndexedDB；服务端仅保存设备 UUID 的 SHA-256 哈希，并使用签名 Token 鉴权，不采集 Canvas、字体、显卡或 IP 组合指纹。
