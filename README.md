# PeachMitao 外置播放器助手 (PeachMitao External Player)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tampermonkey](https://img.shields.io/badge/Userscript-Tampermonkey-green.svg)](https://www.tampermonkey.net/)

一款专为自建 **PeachMitao** 影视项目打造的油猴（Tampermonkey）增强脚本。它能够自动嗅探网页播放器的真实视频流直链，一键自动唤起本地独立播放器（**VLC**、**PotPlayer**、**IINA**、**MPV**）播放，彻底解决浏览器 4K 硬解卡顿与音轨不兼容问题。

---

## 📦 一键安装

安装前请确保浏览器已安装 **[Tampermonkey（篡改猴）](https://www.tampermonkey.net/)** 或 **[ScriptCat（脚本猫）](https://docs.scriptcat.org/)** 扩展，然后点击下方任意按钮即可自动唤起安装界面：

[![点击一键安装 (GitHub)](https://img.shields.io/badge/🚀_点击一键安装-GitHub_直连-2ea44f?style=for-the-badge)](https://raw.githubusercontent.com/kylo1989/peachmitao-external-player/main/peachmitao-external-player.user.js)
&nbsp;
[![点击一键安装 (国内加速)](https://img.shields.io/badge/⚡_点击一键安装-国内_CDN_加速-007ec6?style=for-the-badge)](https://cdn.jsdelivr.net/gh/kylo1989/peachmitao-external-player@main/peachmitao-external-player.user.js)

---

## 🖥️ Windows 一键唤起 VLC 配置（必看）

Windows 下 PotPlayer 安装时会自动注册 `potplayer://` 协议，但 **VLC 官方安装包默认不会注册 `vlc://` 协议**。

如需实现点击网页 `VLC` 按钮**自动弹出 VLC 播放器**，只需下载本仓库中的 [`register-vlc-protocol.bat`](./register-vlc-protocol.bat)，**右键选择“以管理员身份运行”** 即可自动完成协议注册（脚本会自动定位 `C:\Program Files\VideoLAN\VLC\vlc.exe`，绿色版手动输入路径即可）。

> **免配置兜底**：即使不注册 `vlc://` 协议，每次点击网页上的 `VLC` 按钮时，脚本也会同步将直链复制到剪贴板，切到 VLC 窗口按下 `Ctrl + V` 回车同样可以秒播。

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
- **全平台主流播放器支持**：
  - **VLC**：一键自动唤起（需运行一次 `register-vlc-protocol.bat`）+ 自动复制直链双保险。
  - **PotPlayer**：一键自动唤起（Windows 原生支持）。
  - **IINA**：一键自动唤起（macOS 原生支持）。
  - **MPV**：一键自动唤起（需注册 `mpv://` 协议）。

---

## 🎮 使用说明

1. 打开你部署的 PeachMitao 网页并进入任意影片的播放页面。
2. 当视频开始加载时，脚本会自动捕获视频直链，并在页面右上角浮现悬浮控制栏，直接点击对应的播放器按钮即可唤起播放。
3. **如果使用了高度魔改的域名导致未自动显示面板**：点击浏览器右上角的 **油猴扩展图标** → 点击 **“✅ 为当前站点启用外置播放器”** 即可永久绑定该域名。

---

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源。
