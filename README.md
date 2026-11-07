# dsh-plugins

DeepSeek Harness 插件集合。

## 版本与索引

- 每个插件是独立包，**版本写在各自的 `package.json` 的 `version` 字段**（当前都是 `1.0.0`）；这是 monorepo，不再使用 git tag 标记版本。
- 根目录的 [`index.json`](index.json) 是 **插件市场索引（format 1）**，可被 DSH 的 Plugin Market 作为索引源读取。文档结构由 `@deepseek-ai/dsh-plugin-market-index` 校验（`format: 1`、`title.en`、`plugins[].versions[].source` 等）。

要把本仓库作为索引源，先把它放到一个可访问的静态地址（例如 GitHub Pages / jsDelivr），然后在 DSH 的 Settings → Plugins → Market 里添加该 `index.json` 的 URL。

索引里的 `source` 是 **git**，固定在某个提交上，安装参数形如：

```
git+https://github.com/SevenBit250/awe-dsh-plugins.git#<40 位 SHA>&path:/mcp-connectors
```

所以改动插件代码后，需要把 `index.json` 里两个版本的 `commit` 更新为包含该改动的提交 SHA（索引文件本身可以在之后的提交里更新，安装始终指向被固定的那个 commit）。若改为发布到 npm，则把 `source` 换成 `{ "type": "npm" }`（或带 `registry`）。

## mcp-connectors

侧栏「连接器」面板：管理 MCP 服务器连接，服务器工具以 `mcp__<名称>__<工具>` 直接提供给模型。

| 文件 | 作用 |
| --- | --- |
| `mcp-connectors/index.js` | Host 半区：把配置里的每个连接器挂载成一个 `@deepseek-ai/dsh-mcp-client` 实例 |
| `mcp-connectors/client.js` | Web 半区：侧栏按钮 + 连接器管理页（读写插件自身的 volatile 配置） |
| `mcp-connectors/cordis.patch.yml` | bundle patch：插入 `mcp-connectors` 行 |
| `mcp-connectors/locale/` `icon.svg` | 插件显示名、描述与图标 |

### 安装到本机 DSH

通过 Plugin Manager 安装本目录下的 `mcp-connectors/`（local directory），然后刷新页面。

### 依赖

Host 半区 `import '@deepseek-ai/dsh-mcp-client'`，因此 `mcp-connectors/node_modules` 必须存在：

```sh
cd mcp-connectors
pnpm install
```

### 改动生效

- Host 半区（`index.js`）改动：在 Plugin Manager 里关闭再启用该插件，或重启 DSH。
- Web 半区（`client.js`）改动：刷新页面（F5）。

## dsh-notifications

会话在后台时发**系统通知**（Windows 操作中心 / macOS 通知中心），覆盖两类事件：

| 事件 | 触发 | 通知 |
| --- | --- | --- |
| 任务完成 | `api-session/status` 由 running 变 idle | 「任务完成」+ 会话标题 |
| 需要你处理 | 会话状态里的 `pendingInput` 新增 `approval` / `question` / `other` | 「需要审批」「等待你的回答」「等待你处理」 |

实现要点：

- 完成通知：去抖 800ms，合并同一会话的连续轮次
- 待处理通知：对**运行中**的会话开 `ctx.remote.session.observeState` 流（Host 推送，不轮询——后台窗口的定时器会被节流），`pendingInput` 里出现新类型时通知；该类型被处理掉后再次出现会重新通知
  - `pendingInput` 来自 Host 的 pending Remote request 采样：`approval/request`、`user-questions/request` 以及其他阻塞式请求（如计划卡）分别映射为 `approval` / `question` / `other`
  - 流意外结束时，若会话仍在运行会在 5 秒后重连
- 后台判定：由 `visibilitychange` 与窗口 `focus`/`blur` 事件维护状态位，**不在触发时临时探测** `hasFocus()`
- 通知对象保留引用到关闭，避免被 GC 提前回收；不使用 `tag`，避免后一条静默覆盖前一条
- 通知只带系统默认声音；点击通知会聚焦窗口并打开该会话
- 依赖：api-remotes（`ctx.remote.$on` / `ctx.remote.session.observeState`）、client-locale；不需要 Host 服务
- 已知限制：应用完全退出时不会有通知；子会话（subagent）通过 `api-session/added` 的父会话字段过滤
