# 多网站自动签到助手 - Chrome 扩展

基于 linux.do OAuth2.0 授权的多网站自动签到工具（浏览器扩展版）

## 功能特点

✅ **自动 OAuth 登录** - 基于 linux.do OAuth2.0 完成站点登录  
✅ **后台签到** - 定时或手动触发批量签到  
✅ **定时签到** - 默认每天 09:00 自动执行签到，可在弹窗中修改
✅ **手动签到** - 点击扩展图标可立即签到  
✅ **站点跳转** - 点击站点列表中的站点名打开签到页面  
✅ **配置导入导出** - 支持站点配置备份和迁移  
✅ **Badge 状态** - 扩展图标显示签到进度和结果  
✅ **可视化界面** - 查看签到状态和历史记录

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
├── schedule.js
├── site-url.js
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

3. **测试签到**
   - 点击扩展图标
   - 点击"立即签到"按钮
   - 查看签到结果

### 日常使用

- **自动签到**：默认每天 09:00 自动执行，可在扩展弹窗中修改
- **手动签到**：随时点击扩展图标 → 立即签到
- **查看状态**：点击扩展图标查看签到历史
- **打开站点**：点击站点列表中的站点名，可打开该站点的签到页面

---

## 配置说明

### 修改自动签到时间

点击扩展图标，在弹窗中的“每日签到”时间选择器里选择时间并保存。默认时间仍由 `config.js` 中的 `GLOBAL_CONFIG.autoSignTime` 提供。

### 添加新站点

在弹窗中点击“添加站点”，输入域名或完整签到页链接即可。输入完整链接时，扩展会保存域名用于签到接口，同时保存链接用于站点列表点击跳转。

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

1. 扩展从站点接口读取 linux.do OAuth 配置
2. 在浏览器标签页中完成 linux.do OAuth 授权
3. 捕获目标站点认证请求头并缓存到本地
4. 调用 New API 签到接口
5. 保存签到结果并通过 Badge 展示状态
6. 当检测到认证过期或 Cloudflare 拦截时，自动重新登录或切换到标签页执行

---

## 更新日志

### v1.1.0

- 支持在弹窗中修改每日自动签到时间
- 支持在添加站点时输入完整签到页链接
- 站点列表中的站点名可点击打开签到页面
- 弹窗版本号更新为 v1.1.0

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
