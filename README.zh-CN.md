<p align="center">
  <img src="./icon-128.png" alt="Atlas Sidebar" width="96" height="96">
</p>

<h1 align="center">Atlas Sidebar</h1>

<p align="center"><strong>网页内容与提示词工作台</strong></p>

<p align="center">
  在浏览网页的同时收集文字、链接、截图、文档和视频字幕，整理好以后再复制、下载，或加入 ChatGPT。
</p>

<p align="center">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

> Atlas Sidebar 是一个非官方的个人项目，与 OpenAI、ChatGPT、Atlas、YouTube 或哔哩哔哩没有隶属或授权关系。

## 演示视频

https://github.com/user-attachments/assets/27f3408b-ca9c-4bcb-89c2-bb6a1436332f

[下载 1080p 演示视频（28 MB）](https://github.com/Johnny-xuan/Atlas-Sidebar/releases/download/v0.27.0/Atlas-Sidebar-Demo-1080p.mp4)

## 为什么做这个插件

OpenAI 已经宣布，随着浏览器式 Agent 工作能力向 ChatGPT 演进，Atlas 计划于 **2026 年 8 月 9 日停止工作**。详见官方 Help Center 通知：[Evolving Atlas into ChatGPT for browser-based agentic work](https://help.openai.com/en/articles/20001371-evolving-atlas-into-chatgpt-for-browser-based-agentic-work)。

Atlas 浏览器中有一个我很喜欢的侧边栏：浏览网页时，不必离开当前页面，就能在旁边打开 ChatGPT，并把正在阅读的内容快速带进对话。

我不想失去的不只是一个 UI，而是一整套顺手的工作流：选中文字、截一张图、下载论文、找出视频字幕，再把从多个网页收集的素材组合起来，提出一个真正完整的问题。步骤都不难，但一天重复几十次以后，非常打断阅读和思考。

Atlas Sidebar 是一次独立的“拯救 Atlas”尝试。它不复刻整个浏览器，也不会替你自动提问；它只把最有价值、由用户控制的闭环重新带回来：

**从当前页面取内容 → 暂存在侧边栏 → 由你检查和选择 → 再复制、下载或加入 ChatGPT。**

## 能做什么

- **侧边栏浏览器**：在 Chrome Side Panel 中输入网址并打开页面，默认可使用 ChatGPT；地址、前进后退和页面状态会同步。
- **页面收藏与最近访问**：保存当前侧边栏页面、自定义名称、搜索、批量选择和删除，在多个对话或任务之间快速切换。
- **持久草稿区**：可以跨网页连续收集课程、论文、截图和字幕；切换标签页、关闭侧边栏、Reload 或重启 Chrome 都不会清空，只有你删除或点击“清空”才移除。
- **文字与链接**：选中文字后点击旁边的小“＋”，或使用右键菜单加入素材；也可直接保存当前页面链接。
- **截图与文档**：截取当前可见页面，提取网页正文，读取远程 PDF，或从本地选择文件。PDF 和图片会保留原文件。
- **YouTube 与 Bilibili 字幕**：检测视频是否真的存在字幕，选择人工或自动字幕轨道，并生成可下载的 TXT/VTT；传入 ChatGPT 时始终作为文档附件，无字幕、受限和检测失败会分别提示，不生成虚假字幕。
- **Saved prompts**：保存常用提示词，使用可选 `{variable}` 字段；可以在侧边栏先填，也可保留到 ChatGPT 输入区再编辑，并通过 JSON 在本地导入或导出。
- **三个素材出口**：复制到剪贴板，供任意 AI 或应用手动粘贴；下载到本机；或显式加入当前 ChatGPT 输入框/附件区。
- **个性化设置**：支持多种界面语言、字幕首选语言、功能拖动排序、浅色/深色模式和多套顶部栏主题。

## 安装

Atlas Sidebar 目前以本地 unpacked extension 方式使用，不经过 Chrome Web Store。

1. 在 [GitHub Releases](https://github.com/Johnny-xuan/Atlas-Sidebar/releases/latest) 下载最新的 `Atlas-Sidebar-v*.zip`。
2. 解压后会得到 `atlas-sidebar` 文件夹。把它放在一个不会被移动或删除的固定位置。
3. 在 Chrome 地址栏打开 `chrome://extensions`。
4. 打开右上角的“开发者模式”。
5. 点击“加载已解压的扩展程序”，选择刚才的 `atlas-sidebar` 文件夹。
6. 点击浏览器工具栏中的 Atlas Sidebar 图标，Chrome 会在右侧打开侧边栏。
7. 如果要读取本地 `file://` PDF，请在扩展详情页额外打开“允许访问文件网址”。

如果你要在侧边栏里使用 ChatGPT，请先在**同一个 Chrome 用户配置**的普通标签页登录 [chatgpt.com](https://chatgpt.com/)。插件会使用浏览器已有的登录状态，不会保存或导出你的 Cookie、Token、密码或账号凭证。

### 更新

为了保留设置、Saved prompts、已保存页面和最近访问，请始终更新同一个 `atlas-sidebar` 文件夹：

1. 下载并解压新版本。
2. 用新文件替换原 `atlas-sidebar` 文件夹中的文件，不要换到另一个路径。
3. 回到 `chrome://extensions`，在 Atlas Sidebar 卡片上点击“重新加载”。

草稿素材、设置、Saved prompts、已保存页面和最近访问都保存在本机；更新同一个扩展目录、Reload 或重启 Chrome 后仍会保留。草稿不会自动过期，需要你在素材区删除单项或点击“清空”。卸载扩展会删除这些本地数据，重要提示词请先在设置页导出 JSON 备份。

## 基本用法

打开 Atlas Sidebar 后，你可以在左侧正常浏览网页，右侧保持 ChatGPT 或另一个任务页面：

1. 在不同网页中选中文字，点击选区旁的“＋”；也可以依次加入链接、截图、文档、字幕和 Saved prompt。
2. 在持久草稿区（界面中的“临时素材”）检查跨网页收集的内容，并勾选真正需要的项目。
3. 选择“复制所选”“下载所选”或“添加到 ChatGPT”。
4. 内容加入 ChatGPT 后仍然只是草稿，由你确认后手动发送。

## 隐私与安全

- 插件不需要 API Key，不包含远程服务、遥测或广告。
- 页面内容只在你主动操作后读取，并保存在当前浏览器的本地扩展存储或 IndexedDB 中；Atlas Sidebar 没有服务器，不会自动把这些内容上传到任何地方。
- Saved prompts、外观设置和页面列表只保存在本机。
- 插件不会自动发送 ChatGPT 消息，也不会读取浏览器保存的密码。
- 为了在侧边栏中打开网页，插件会对当前由用户输入的域名临时调整 iframe 防护响应头；离开该页面或关闭侧边栏后会清理对应规则。

## 已知限制

- 部分网站会通过脚本、登录跳转、弹窗或浏览器策略拒绝嵌入，此时可以使用顶部的“在标签页打开”。
- ChatGPT、YouTube 和 Bilibili 的页面结构或接口变化，可能暂时影响内容加入或字幕提取。
- 本地 PDF 需要手动允许文件网址访问；也可以使用素材区里的“本地文件”按钮绕过该权限限制。
- 自动字幕来自视频平台已有的语音识别结果；Atlas Sidebar 不自行对视频做语音转录。

## 兼容性

当前版本：`0.27.0`<br>
当前验证环境：Chrome/Chromium（Manifest V3）
