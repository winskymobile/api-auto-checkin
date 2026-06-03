# 多网站自动签到助手 - Chrome 扩展

支持 New API、Sub2API、ZenAPI 等站点的多网站自动签到工具（浏览器扩展版），可在接口签到失败时打开站点页面查找签到按钮。

## 功能特点

- ✅ **自动 OAuth 登录** - 基于 linux.do OAuth2.0 完成站点登录
- ✅ **自动站点识别** - 新增站点默认自动识别 New API、Sub2API、ZenAPI 等类型
- ✅ **后台签到** - 定时或手动触发批量签到
- ✅ **定时签到** - 默认每天 09:00 自动执行签到，可在弹窗中修改
- ✅ **手动签到** - 点击扩展图标可立即签到
- ✅ **站点跳转** - 点击站点列表中的站点名打开签到页面
- ✅ **页面兜底签到** - 接口签到失败后打开填写的页面并查找签到按钮
- ✅ **访问模式** - 部分站点可配置为每天仅访问页面
- ✅ **配置导入导出** - 支持站点配置备份和迁移
- ✅ **Badge 状态** - 扩展图标显示签到进度和结果
- ✅ **可视化界面** - 查看签到状态和历史记录

---

## 安装步骤

### 1. 准备扩展文件

确保 `chrome-extension` 文件夹包含以下文件：
```
chrome-extension/
├── manifest.json
├── background.js
├── popup.html
├── popup.js
├── config.js
├── auth-headers.js
├── checkin-result.js
├── newapi-auth.js
├── tab-options.js
├── site-name.js
├── zenapi-auth.js
├── schedule.js
├── site-url.js
├── backup-config.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 2. 安装到 Chrome

1. **打开 Chrome 扩展管理页面**
   - 在地址栏输入：`chrome://extensions/`
   - 或点击：菜单 → 更多工具 → 扩展程序

2. **开启开发者模式**
   - 点击右上角的"开发者模式"开关

3. **加载扩展**
   - 点击"加载已解压的扩展程序"
   - 选择 `chrome-extension` 文件夹
   - 点击"选择文件夹"

4. **完成！**
   - 扩展已安装，可以在工具栏看到扩展图标

---

## 使用方法

### 首次使用

1. **登录 linux.do**
   - 确保当前 Chrome 已登录 linux.do

2. **添加站点**
   - 点击扩展图标
   - 点击“添加站点”
   - 输入域名或完整签到页链接，例如 `example.com` 或 `https://www.baidu.com/console/personal`
   - 如果该站点只需要访问页面，勾选“仅访问”

3. **测试签到**
   - 点击扩展图标
   - 点击"立即签到"按钮
   - 查看签到结果

### 日常使用

- **自动签到**：默认每天 09:00 自动执行，可在扩展弹窗中修改
- **手动签到**：随时点击扩展图标 → 立即签到
- **查看状态**：点击扩展图标查看签到历史
- **打开站点**：点击站点列表中的站点名，可打开该站点的签到页面
- **导入导出**：导出文件包含站点配置（含类型、模式、签到页链接）和自动签到时间；导入旧版配置时，缺少 `type` 的站点会补为 `auto`，下次签到时重新识别

---

## 配置说明

### 修改自动签到时间

点击扩展图标，在弹窗中的“每日签到”时间选择器里选择时间并保存。默认时间仍由 `config.js` 中的 `GLOBAL_CONFIG.autoSignTime` 提供。

### 添加新站点

在弹窗中点击“添加站点”，输入域名或完整签到页链接即可。输入完整链接时，扩展会保存域名用于接口签到，同时保存链接用于站点列表点击跳转和页面兜底签到。新增站点默认使用自动类型，由扩展在签到时识别；如果站点不需要签到接口，添加时勾选“仅访问”即可。

### 支持的站点类型

- **New API**：支持 linux.do OAuth 登录、`/api/user/checkin` 等接口的站点
- **Sub2API**：支持本地 token 和 `/api/v1/user/check-in` 的站点
- **ZenAPI**：支持 linux.do OAuth 登录、`/api/u/checkin` 的站点
- **页面签到站点**：接口签到失败后，打开填写的签到页链接，查找“签到 / 签 / Check in”等按钮并点击
- **访问模式站点**：不执行签到接口，仅定时访问页面并记录结果

也可以编辑 `config.js` 文件，在 `DEFAULT_SITES` 数组中添加：

```javascript
const DEFAULT_SITES = [
  { domain: 'example.com', name: 'example.com', enabled: true },
  {
    domain: 'www.baidu.com',
    name: 'www.baidu.com',
    enabled: true,
    pageUrl: 'https://www.baidu.com/console/personal'
  }
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

### 禁用某个站点

将站点的 `enabled` 改为 `false`：

```javascript
{
  siteId: 'ai_xingyungept',
  siteName: 'ai.xingyungept.cn',
  enabled: false, // 禁用此站点
  // ...
}
```

---

## 常见问题

### Q1: 扩展安装后没有图标？

**答**：图标是可选的，不影响功能。如需添加图标：
1. 准备 16x16, 48x48, 128x128 三个尺寸的 PNG 图片
2. 命名为 icon16.png, icon48.png, icon128.png
3. 放入 `icons` 文件夹
4. 重新加载扩展

### Q2: 签到失败提示"未找到 Cookie"？

**答**：需要先在浏览器中登录目标网站：
1. 打开目标网站（如 https://ai.xingyungept.cn）
2. 使用 linux.do 账号登录
3. 确保登录成功后，再执行签到

### Q3: 签到失败提示"Cookie 已失效"？

**答**：Cookie 过期了，需要重新登录：
1. 打开目标网站
2. 退出登录
3. 重新使用 linux.do 登录
4. 再次尝试签到

### Q4: 如何查看签到日志？

**答**：
1. 打开 `chrome://extensions/`
2. 找到本扩展
3. 点击"service worker"（或"背景页"）
4. 在控制台查看详细日志

### Q5: 自动签到没有执行？

**答**：确保：
1. Chrome 浏览器保持运行（可以最小化）
2. 扩展没有被禁用
3. 检查扩展的定时器是否正常（查看背景页日志）

### Q6: 可以在其他浏览器使用吗？

**答**：
- **Edge**：可以，Edge 基于 Chromium，完全兼容
- **Firefox**：需要修改 manifest.json（Manifest V2）
- **Safari**：不支持

---

## 技术说明

### 权限说明

- **cookies**：读取网站 Cookie 用于签到
- **storage**：保存签到记录和配置
- **alarms**：设置定时任务
- **tabs**：打开站点页面并辅助 OAuth 登录
- **scripting**：在标签页上下文中完成 OAuth、请求头捕获和 Cloudflare 兼容处理
- **webRequest**：捕获站点页面发出的认证请求头

### 数据安全

- ✅ 所有数据存储在本地（Chrome Storage）
- ✅ Cookie 不会上传到任何服务器
- ✅ 开源代码，可审计

### 工作原理

1. 扩展根据站点域名和保存配置自动识别站点类型
2. 优先读取缓存的认证信息
3. 缓存失效时先后台检查浏览器已有登录态，仍不可用才按站点类型触发 linux.do OAuth 或读取 token
4. 调用对应站点类型的签到接口
5. 接口签到失败时打开配置的签到页链接，查找并点击签到按钮
6. 页面按钮不可点击、按钮文案显示已签到，或接口返回已签到时，结果记为“已签”
7. 保存签到结果并通过 Badge 展示状态
8. 当检测到认证过期或 Cloudflare 拦截时，先重新检查浏览器已有登录态，再按需 OAuth 或切换到标签页执行

---

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

### v1.0.0 (2026-03-08)
- ✨ 首次发布
- ✅ 支持 3 个站点自动签到
- ✅ 定时签到功能
- ✅ 手动签到功能
- ✅ 可视化界面
- ✅ Badge 状态提示

---

## 开发者

如需修改或扩展功能，请参考：
- [Chrome Extension 官方文档](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 迁移指南](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

## 许可证

MIT License

---

## 支持

如有问题或建议，请提交 Issue。
