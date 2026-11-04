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
