# PeachMitao 外置播放器助手 (PeachMitao External Player)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tampermonkey](https://img.shields.io/badge/Userscript-Tampermonkey-green.svg)](https://www.tampermonkey.net/)

一款深度适配自建 **[PeachMitao](https://github.com/peach-mitao/peach)** 影视项目的油猴（Tampermonkey）增强脚本。直接对接 Peach 官方直链签发接口（`POST /api/external-playback`），**无需启动网页播放器（零卡顿）**即可秒取 6 小时有效的原盘直链，一键自动拉起本地 **VLC**、**PotPlayer**、**IINA** 或 **MPV** 硬解播放 4K 视频。

---

## 📦 一键安装

安装前请确保浏览器已安装 **[Tampermonkey（篡改猴）](https://www.tampermonkey.net/)** 或 **[ScriptCat（脚本猫）](https://docs.scriptcat.org/)** 扩展，然后点击下方任意按钮即可自动唤起安装界面：

[![点击一键安装 (GitHub)](https://img.shields.io/badge/🚀_点击一键安装-GitHub_直连-2ea44f?style=for-the-badge)](https://raw.githubusercontent.com/kylo1989/peachmitao-external-player/main/peachmitao-external-player.user.js)
&nbsp;
[![点击一键安装 (国内加速)](https://img.shields.io/badge/⚡_点击一键安装-国内_CDN_加速-007ec6?style=for-the-badge)](https://cdn.jsdelivr.net/gh/kylo1989/peachmitao-external-player@main/peachmitao-external-player.user.js)

---

## 🖥️ Windows 一键拉起 VLC 配置（必看）

Windows 下 PotPlayer 安装时会自动注册 `potplayer://` 协议，但 **VLC 官方安装包默认不会注册 `vlc://` 协议**。

如需实现点击网页 `VLC` 按钮**自动弹出 VLC 播放器**，只需下载本仓库中的 [`register-vlc-protocol.bat`](./register-vlc-protocol.bat) 并**双击运行**（会自动申请管理员权限并生成纯批处理协议启动器 `C:\ProgramData\VLC-Protocol\launch-vlc.bat`，无任何脚本拦截兼容问题）。

> **免配置兜底**：即使不注册 `vlc://` 协议，每次点击网页上的 `VLC` 按钮时，脚本也会同步将原盘直链复制到剪贴板，切到 VLC 窗口按下 `Ctrl + V` 回车同样可以秒播。

---

## ✨ 核心特性

- **对接官方直链接口（彻底杜绝网页卡死）**：直接调用 Peach 的 `POST /api/external-playback?id=...` 签发接口获取 6 小时有效原盘直链，无需先加载网页播放器，彻底屏蔽 HLS `.ts` 切片干扰，避免核显设备网页端软解死锁。
- **原生弹窗深度融合**：既在页面顶层（Top Layer）提供可折叠悬浮栏，又直接在 Peach 详情弹窗的 **“打开”** 按钮旁嵌入 `VLC`、`PotPlayer`、`复制直链` 快捷按钮。
- **零配置通用适配**：自动兼容任意内网 IP、自定义端口及反向代理域名；支持通过油猴扩展菜单一键为任意自定义域名强制开启或禁用。
- **全平台播放器支持**：支持 Windows（**VLC** / **PotPlayer** / **MPV**）与 macOS（**IINA** / **MPV**）。

---

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源。
