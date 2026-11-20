# PeachMitao 外置播放器助手 (PeachMitao External Player)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tampermonkey](https://img.shields.io/badge/Userscript-Tampermonkey-green.svg)](https://www.tampermonkey.net/)

一款专为自建 **PeachMitao** 影视项目打造的油猴（Tampermonkey）增强脚本。它能够自动嗅探网页播放器的真实视频流直链，一键唤起本地独立播放器（**PotPlayer**、**IINA**、**MPV**）或一键复制直链至 **VLC** 播放。

---

## 📦 一键安装

安装前请确保浏览器已安装 **[Tampermonkey（篡改猴）](https://www.tampermonkey.net/)** 或 **[ScriptCat（脚本猫）](https://docs.scriptcat.org/)** 扩展，然后点击下方任意按钮即可自动唤起安装界面：

[![点击一键安装 (GitHub)](https://img.shields.io/badge/🚀_点击一键安装-GitHub_直连-2ea44f?style=for-the-badge)](https://raw.githubusercontent.com/kylo1989/peachmitao-external-player/main/peachmitao-external-player.user.js)
&nbsp;
[![点击一键安装 (国内加速)](https://img.shields.io/badge/⚡_点击一键安装-国内_CDN_加速-007ec6?style=for-the-badge)](https://cdn.jsdelivr.net/gh/kylo1989/peachmitao-external-player@main/peachmitao-external-player.user.js)

> **提示**：如遇默认分支名称为 `master` 而非 `main`，在创建仓库时选择 `main` 分支，或将上方链接中的 `main` 替换为 `master` 即可。

---

## ✨ 为什么需要这个脚本？

自建 NAS 影视库中的 4K 片源通常封装了 **MKV 容器**或 **AC3 / EAC3 / DTS 多声道音轨**。在部分浏览器（尤其是核显设备或精简版系统）中播放时，由于浏览器原生 `<video>` 标签不支持此类封装/音轨，网页端播放器会自动回退到 **WASM + WebGL 纯软解渲染**，导致：
- 显卡 `3D` 管线占用飙升至 `100%`，专用 `Video Decode` 硬件解码单元却处于 `0%` 闲置状态；
- 网页画面持续转圈、掉帧严重甚至浏览器标签页卡死。

通过本脚本直接将带鉴权票据（`ticket=`）的视频直链交给本地原生播放器，可完美调用显卡硬件解码，实现 **4K 秒开、低占用满帧播放、完整保留原盘多音轨与外挂字幕**。

---

## 🚀 核心特性

- **零配置通用适配**：无需手动修改代码中的 IP 或端口，自动兼容任意内网 IP、自定义端口及反向代理域名。
- **智能站点识别 + 菜单手动开关**：自动识别 PeachMitao 页面与 `ticket=` 流媒体特征，不干扰其他正常网页；支持通过油猴扩展菜单一键为任意自定义域名强制开启或禁用。
- **全链路视频流嗅探**：同时拦截 `fetch`、`XMLHttpRequest` 以及动态生成的 `<video>` 标签，秒级捕获真实播放流。
- **多平台播放器支持**：
  - **Windows**：一键唤起 **PotPlayer** / **MPV**，或一键复制直链至 **VLC**。
  - **macOS**：一键唤起 **IINA**。
- **无感轻量化悬浮栏**：毛玻璃紧凑设计，支持右上角一键收起，复制直链采用非阻塞式气泡提示。

---

## 🎮 使用说明

1. 打开你部署的 PeachMitao 网页并进入任意影片的播放页面。
2. 当视频开始加载时，脚本会自动捕获视频直链，并在页面右上角浮现悬浮控制栏：
   - **PotPlayer**：直接调用本地安装的 PotPlayer 播放（Windows 推荐）。
   - **IINA**：直接调用本地安装的 IINA 播放（macOS 推荐）。
   - **MPV**：通过 `mpv://` 协议调用本地 MPV（需提前配置协议关联）。
   - **复制直链(VLC)**：将完整视频直链复制到剪贴板，切换到 VLC 窗口按下 `Ctrl + V`（macOS 为 `Cmd + V`）回车即可播放。
3. **如果使用了高度魔改的域名导致未自动显示面板**：点击浏览器右上角的 **油猴扩展图标** → 点击 **“✅ 为当前站点启用外置播放器”** 即可永久绑定该域名。

---

## ❓ 常见问题 (FAQ)

**Q1：点击 `PotPlayer` 按钮浏览器没有反应？**  
A：请确认电脑已安装桌面版 PotPlayer（绿色免安装版需在 PotPlayer `设置 -> 关联` 中勾选协议关联，否则系统无法识别 `potplayer://` 协议）。若未关联协议，可直接使用 **“复制直链(VLC)”** 按钮后粘贴到任意播放器打开。

**Q2：为什么打开网页后悬浮栏没有立刻出现？**  
A：悬浮栏仅在侦测到视频流请求后才会动态渲染，避免在首页浏览海报墙时遮挡视线。点进具体影片播放页后即会自动出现。

---

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源。
