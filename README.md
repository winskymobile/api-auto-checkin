# 多网站自动签到 Chrome 扩展

基于 linux.do OAuth2 授权的多网站自动签到 Chrome 扩展，支持所有使用 New API 平台的站点。

## 功能特性

- **自动 OAuth 登录**：自动完成 linux.do OAuth2 授权流程
- **后台签到**：完全后台执行，不打开可见窗口
- **Badge 通知**：扩展图标显示签到进度和结果
- **定时签到**：默认每天 09:00 自动执行签到，可在扩展弹窗中修改
- **站点管理**：可视化添加、删除、启用/禁用站点
- **站点跳转**：站点列表中的站点名可点击，直接打开对应签到页面
- **完整链接添加**：添加站点时支持输入域名或完整签到页链接
- **访问模式**：部分站点可配置为每天仅访问页面，不执行签到接口
- **配置导入导出**：支持站点配置的备份和迁移
- **缓存机制**：认证信息缓存，减少重复登录
- **Cloudflare 防护绕过**：自动检测并绕过 Cloudflare Bot Management

## 安装方法

1. 下载或克隆本项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `chrome-extension` 文件夹

## 使用说明

### 首次使用

1. 确保已在 linux.do 登录
2. 点击扩展图标打开弹窗
3. 点击"+ 添加站点"按钮
4. 输入站点域名或签到页链接（如 `example.com` 或 `https://www.baidu.com/console/personal`）
5. 如果该站点只需要访问页面，勾选“仅访问”
6. 点击"立即签到"测试

### 自动签到

扩展默认会在每天 09:00 自动执行签到，也可以在扩展弹窗中选择自己的每日签到时间。

### Badge 通知

- **签到中**：显示进度（如 "1/3"、"2/3"）
- **签到成功**：绿色背景 + "✓"
- **有失败**：红色背景 + "✗N"（N为失败数量）
- Badge 会在 5 秒后自动消失

### 站点管理

- **启用/禁用**：点击站点前的开关
- **删除站点**：点击站点右侧的 "×" 按钮
- **打开站点**：点击站点名打开签到页面
- **查看状态**：每个站点显示最近一次签到结果

### 配置导入导出

- **导出**：点击"导出配置"按钮，保存为 JSON 文件。导出内容只包含站点配置和自动签到时间
- **导入**：点击"导入配置"按钮，选择 JSON 文件
  - 覆盖模式：替换所有现有站点
  - 合并模式：只添加新站点，保留现有站点
  - 如果配置中包含 `autoSignTime`，会同步恢复每日自动签到时间

## 支持的站点

所有使用 New API 平台且支持 linux.do OAuth 登录的站点。

添加新站点时，可以输入域名，扩展会自动配置签到接口；也可以输入完整签到页链接，站点列表点击时会直接打开该页面。如果站点不需要签到接口，添加时勾选“仅访问”即可。

## 技术说明

### OAuth 流程

1. 在浏览器标签页中获取站点的 `linuxdo_client_id`（绕过 Cloudflare）
2. 在标签页中获取 OAuth `state` 参数（CSRF 保护）
3. 在同一标签页中打开 linux.do 授权页面
4. 自动点击"允许"按钮
5. 捕获回调 URL 中的 `code` 参数
6. 调用站点的 OAuth 回调 API 完成登录
7. 验证 session 是否建立（检查 localStorage['user']）
8. 导航到登录页并捕获认证请求头（Cookie + New-API-User）
9. 验证认证头有效性

### 认证机制

New API 平台使用两种认证方式：

1. **Session Cookie**：服务端 session 认证
2. **New-API-User 请求头**：从 localStorage['user'] 读取用户 ID

扩展会同时捕获这两种认证信息，确保签到请求成功。

### 缓存策略

- 认证头缓存在 `chrome.storage.local` 中
- 每次签到前检查缓存是否有效
- 401 错误时自动重新登录并更新缓存
- Cloudflare 错误时自动重新登录并标记站点

### Cloudflare 防护处理

扩展采用智能检测机制处理 Cloudflare Bot Management：

1. **默认模式**：优先使用 service worker 发起请求（速度快）
2. **自动检测**：当检测到 Cloudflare 拦截（返回 HTML 验证页面）时
3. **自动切换**：标记该站点并切换到浏览器标签页执行模式
4. **持久化标记**：标记保存在缓存中，后续签到直接使用标签页模式
5. **绕过验证**：在真实浏览器环境中执行请求，获取有效的 cf_clearance cookie

这种机制确保：
- 无 Cloudflare 防护的站点保持高速签到
- 有 Cloudflare 防护的站点自动绕过验证
- 无需手动配置，全自动识别和处理

## 常见问题

### 签到失败

1. 确保已在 linux.do 登录
2. 检查站点是否支持 linux.do OAuth
3. 查看浏览器控制台日志（F12 → Console）

### 无法添加站点

1. 确保输入的是有效域名（如 `example.com`）或完整链接（如 `https://www.baidu.com/console/personal`）
2. 域名必须包含 `.`

### Badge 不显示

1. 在 `chrome://extensions/` 重新加载扩展
2. 检查扩展图标是否固定在工具栏

## 文件结构

```
chrome-extension/
├── manifest.json       # 扩展清单
├── background.js       # 后台服务（OAuth、签到逻辑）
├── config.js           # 配置文件（默认站点、全局配置）
├── schedule.js         # 定时签到时间校验和下次执行时间计算
├── site-url.js         # 站点输入解析和签到页面跳转 URL 生成
├── backup-config.js    # 导入导出配置格式处理
├── popup.html          # 弹窗界面
├── popup.js            # 弹窗脚本（UI 交互）
└── icons/             # 扩展图标
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 开发说明

### 修改定时时间

点击扩展图标，在弹窗中的“每日签到”时间选择器里选择时间并保存。默认时间仍由 `config.js` 中的 `GLOBAL_CONFIG.autoSignTime` 提供。

### 添加默认站点

编辑 `config.js` 中的 `DEFAULT_SITES`：

```javascript
const DEFAULT_SITES = [
  { domain: 'example.com', name: 'Example Site', enabled: true },
  {
    domain: 'www.baidu.com',
    name: 'www.baidu.com',
    enabled: true,
    pageUrl: 'https://www.baidu.com/console/personal'
  },
  // 添加更多站点...
];
```

`pageUrl` 是可选字段。未配置时，点击站点名会默认打开 `https://域名/console/personal`。

### 添加访问模式站点

如果某些站点不需要调用签到接口，只需要每天访问页面，在“+ 添加站点”表单中勾选“仅访问”即可。

也可以在默认站点配置或导入配置中加入 `mode: 'visit'`：

```javascript
const DEFAULT_SITES = [
  {
    domain: 'www.baidu.com',
    name: 'www.baidu.com',
    enabled: true,
    mode: 'visit',
    pageUrl: 'https://www.baidu.com/console/personal'
  }
];
```

访问模式会在定时任务中后台打开站点页面，等待页面加载后关闭标签页。页面不是 Chrome 错误页，且 `document.readyState` 为 `interactive` 或 `complete` 时，结果记为成功。

### 调试

1. 打开 `chrome://extensions/`
2. 找到扩展，点击"service worker"
3. 在 DevTools 中查看日志

## 更新日志

### v1.14

- 优化弹窗控件高度、焦点态、站点行 hover 和空状态展示
- 修复站点启用/禁用切换后弹窗滚动位置回到顶部的问题
- 弹窗版本号更新为 v1.14

### v1.13

- 优化弹窗配色为灰阶极简风格
- 保留签到状态、访问模式等语义颜色识别
- 将配置导入导出与每日签到时间设置合并为一行
- 弹窗版本号更新为 v1.13

### v1.1.2

- 支持在弹窗中修改每日自动签到时间
- 支持在添加站点时输入完整签到页链接
- 站点列表中的站点名可点击打开签到页面
- 支持访问模式站点，每天仅访问页面也可计为成功
- 添加站点时可通过“仅访问”勾选项配置访问模式
- 导出配置仅包含站点配置和自动签到时间
- 导入配置时可同步恢复自动签到时间
- 弹窗版本号更新为 v1.1.2

### v1.0.0

- 首次发布多站点自动签到扩展
- 支持 linux.do OAuth 自动登录
- 支持手动签到、定时签到、Badge 状态提示和配置导入导出

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
