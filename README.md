# dsh-plugins

DeepSeek Harness 插件集合。

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

窗口在后台时，会话从"运行中"转为"空闲"就发一条**系统通知**（Windows 操作中心 / macOS 通知中心）。

- 触发：订阅转发事件 `api-session/status`，去抖 800ms 合并同一会话的连续轮次
- 只在前台不可见/窗口失焦时发送；点击通知会聚焦窗口并打开该会话
- 依赖：`dsh.client.inject` 里的 api-remotes（`ctx.remote.$on`）、client-locale；不需要 Host 服务
- 已知限制：应用完全退出时不会有通知；子会话（subagent）通过 `api-session/added` 的父会话字段过滤
