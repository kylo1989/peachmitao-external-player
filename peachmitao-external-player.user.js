// ==UserScript==
// @name         PeachMitao 外置播放器助手 (VLC / PotPlayer / IINA / MPV)
// @namespace    https://github.com/kylo1989/peachmitao-external-player
// @version      1.4.0
// @description  精准嗅探 PeachMitao 原始视频流直链 (ticket=)，屏蔽 HLS 切片干扰，穿透顶层弹窗一键唤起本地 VLC、PotPlayer、IINA、MPV 播放。
// @author       kylo1989
// @match        http://*/*
// @match        https://*/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY_ENABLED_HOSTS = 'peach_enabled_hosts_v1';
    const STORAGE_KEY_DISABLED_HOSTS = 'peach_disabled_hosts_v1';
    const currentHost = location.host;

    function getHostList(key) {
        try {
            return JSON.parse(GM_getValue(key, '[]'));
        } catch (e) {
            return [];
        }
    }

    function saveHostList(key, list) {
        GM_setValue(key, JSON.stringify([...new Set(list)]));
    }

    // 注册油猴菜单手动开关
    GM_registerMenuCommand('✅ 为当前站点启用外置播放器', () => {
        const enabled = getHostList(STORAGE_KEY_ENABLED_HOSTS);
        const disabled = getHostList(STORAGE_KEY_DISABLED_HOSTS).filter(h => h !== currentHost);
        enabled.push(currentHost);
        saveHostList(STORAGE_KEY_ENABLED_HOSTS, enabled);
        saveHostList(STORAGE_KEY_DISABLED_HOSTS, disabled);
        showToast(`已为 ${currentHost} 启用，刷新页面生效`);
        setTimeout(() => location.reload(), 800);
    });

    GM_registerMenuCommand('🚫 在当前站点禁用外置播放器', () => {
        const disabled = getHostList(STORAGE_KEY_DISABLED_HOSTS);
        const enabled = getHostList(STORAGE_KEY_ENABLED_HOSTS).filter(h => h !== currentHost);
        disabled.push(currentHost);
        saveHostList(STORAGE_KEY_DISABLED_HOSTS, disabled);
        saveHostList(STORAGE_KEY_ENABLED_HOSTS, enabled);
        const panel = document.getElementById('peach-ext-player-bar');
        if (panel) panel.remove();
        showToast(`已在 ${currentHost} 禁用本脚本`);
    });

    function isPeachSite() {
        const disabled = getHostList(STORAGE_KEY_DISABLED_HOSTS);
        if (disabled.includes(currentHost)) return false;

        const enabled = getHostList(STORAGE_KEY_ENABLED_HOSTS);
        if (enabled.includes(currentHost)) return true;

        const title = (document.title || '').toLowerCase();
        if (title.includes('peach') || title.includes('peachmitao')) return true;

        const html = document.documentElement ? document.documentElement.innerHTML.slice(0, 4000).toLowerCase() : '';
        if (html.includes('peachmitao') || html.includes('peach-player')) return true;

        return false;
    }

    let capturedStreamUrl = '';
    let hasTicketStream = false;
    let isActivated = isPeachSite();
    let uiInjected = false;

    // 过滤掉 HLS 临时切片 (.ts / .m4s)，只保留完整直链或主播放列表
    function isValidStreamUrl(url) {
        if (!url || typeof url !== 'string') return false;
        if (url.startsWith('blob:') || url.startsWith('data:')) return false;

        // 严格排除网页转码产生的单个切片文件，防止覆盖原始直链
        if (/\/hls\/.*\.(ts|m4s)(\?|$)/i.test(url) || /\.(ts|m4s)(\?|$)/i.test(url)) {
            return false;
        }

        // PeachMitao 原始直链最高特征
        if (url.includes('ticket=')) return true;

        // 兜底匹配完整视频文件或 m3u8 主索引
        if (/\.(mp4|mkv|avi|flv|mov|webm|m3u8)(\?|$)/i.test(url)) return true;

        return false;
    }

    function handleCapturedUrl(rawUrl) {
        if (!isValidStreamUrl(rawUrl)) return;

        const isTicket = rawUrl.includes('ticket=');
        if (isTicket) {
            isActivated = true;
        }
        if (!isActivated) return;

        // 如果已经捕获到带 ticket= 的原始直链，则不再被普通 m3u8 覆盖（除非来了新的 ticket= 链接）
        if (hasTicketStream && !isTicket) {
            return;
        }

        try {
            const fullUrl = new URL(rawUrl, location.origin).href;
            if (fullUrl === capturedStreamUrl) return;

            capturedStreamUrl = fullUrl;
            if (isTicket) {
                hasTicketStream = true;
            }

            ensureUI();
            syncMountTarget();
            updateUIState();
        } catch (e) {}
    }

    // 1. Hook window.fetch
    const origFetch = window.fetch;
    window.fetch = function (...args) {
        try {
            const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
            handleCapturedUrl(reqUrl);
        } catch (e) {}
        return origFetch.apply(this, args);
    };

    // 2. Hook XMLHttpRequest
    const origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        try {
            handleCapturedUrl(url);
        } catch (e) {}
        return origXhrOpen.apply(this, arguments);
    };

    // 3. 监听 DOM 中动态插入的 <video> / <source>
    function scanVideoElements() {
        if (!isActivated && !isPeachSite()) return;
        isActivated = true;
        document.querySelectorAll('video, video source').forEach(el => {
            const src = el.currentSrc || el.src || el.getAttribute('src');
            handleCapturedUrl(src);
        });
    }

    // 获取当前最顶层的有效可交互容器（穿透 <dialog open> 与全屏状态）
    function getTopMountContainer() {
        if (document.fullscreenElement) return document.fullscreenElement;
        const openDialogs = document.querySelectorAll('dialog[open]');
        if (openDialogs.length > 0) {
            return openDialogs[openDialogs.length - 1];
        }
        return document.body || document.documentElement;
    }

    // 确保悬浮栏始终处于 Top Layer 最顶端且不被模态框 inert 屏蔽
    function syncMountTarget() {
        const bar = document.getElementById('peach-ext-player-bar');
        if (!bar) return;

        const target = getTopMountContainer();
        if (target && bar.parentElement !== target) {
            target.appendChild(bar);
        }

        if (typeof bar.showPopover === 'function') {
            try {
                if (bar.matches(':popover-open')) {
                    bar.hidePopover();
                }
                bar.showPopover();
            } catch (e) {}
        }
    }

    function showToast(msg) {
        const old = document.getElementById('peach-ext-toast');
        if (old) old.remove();

        const toast = document.createElement('div');
        toast.id = 'peach-ext-toast';
        toast.textContent = msg;
        toast.setAttribute('popover', 'manual');
        toast.style.cssText = `
            position: fixed !important;
            inset: auto !important;
            top: 64px !important;
            right: 20px !important;
            margin: 0 !important;
            z-index: 2147483647 !important;
            background: rgba(24, 24, 28, 0.94) !important;
            color: #fff !important;
            padding: 8px 14px !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
            backdrop-filter: blur(6px) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            transition: opacity 0.25s ease !important;
            pointer-events: none !important;
        `;

        const target = getTopMountContainer();
        if (target) target.appendChild(toast);

        if (typeof toast.showPopover === 'function') {
            try { toast.showPopover(); } catch (e) {}
        }

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    function ensureUI() {
        if (uiInjected) return;
        const target = getTopMountContainer();
        if (!target) return;
        uiInjected = true;

        const bar = document.createElement('div');
        bar.id = 'peach-ext-player-bar';
        bar.setAttribute('popover', 'manual');
        bar.style.cssText = `
            position: fixed !important;
            inset: auto !important;
            top: 16px !important;
            right: 20px !important;
            margin: 0 !important;
            z-index: 2147483647 !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 6px 10px !important;
            background: rgba(20, 22, 28, 0.9) !important;
            backdrop-filter: blur(8px) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45) !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            pointer-events: auto !important;
            user-select: none !important;
        `;

        const btnBaseStyle = `
            padding: 5px 10px !important;
            border: none !important;
            border-radius: 5px !important;
            color: #fff !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            line-height: 1.4 !important;
            transition: filter 0.15s ease !important;
            pointer-events: auto !important;
        `;

        bar.innerHTML = `
            <span id="peach-ext-status" style="color:#4ade80 !important;font-size:12px !important;margin-right:2px !important;" title="已捕获视频流直链">● 已就绪</span>
            <button id="peach-btn-vlc" style="${btnBaseStyle}background:#ea580c !important;" title="自动唤起本地 VLC（同时已复制直链备用）">VLC</button>
            <button id="peach-btn-pot" style="${btnBaseStyle}background:#d97706 !important;" title="自动唤起 Windows 本地 PotPlayer">PotPlayer</button>
            <button id="peach-btn-iina" style="${btnBaseStyle}background:#2563eb !important;" title="自动唤起 macOS 本地 IINA">IINA</button>
            <button id="peach-btn-mpv" style="${btnBaseStyle}background:#7c3aed !important;" title="自动唤起本地 MPV">MPV</button>
            <button id="peach-btn-copy" style="${btnBaseStyle}background:#059669 !important;" title="仅复制视频流直链">复制直链</button>
            <button id="peach-btn-toggle" style="background:transparent !important;border:none !important;color:#9ca3af !important;cursor:pointer !important;font-size:14px !important;padding:0 4px !important;pointer-events:auto !important;" title="收起/展开">×</button>
        `;

        target.appendChild(bar);
        syncMountTarget();

        bar.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', () => { btn.style.filter = 'brightness(1.15)'; });
            btn.addEventListener('mouseleave', () => { btn.style.filter = 'none'; });
        });

        document.getElementById('peach-btn-vlc').onclick = (e) => {
            e.stopPropagation();
            if (!capturedStreamUrl) return showToast('尚未捕获到视频流，请先点击播放视频');
            GM_setClipboard(capturedStreamUrl);
            location.href = 'vlc://' + capturedStreamUrl;
            showToast('正在唤起 VLC（直链已同步复制，未注册协议可直接 Ctrl+V）');
        };

        document.getElementById('peach-btn-pot').onclick = (e) => {
            e.stopPropagation();
            if (!capturedStreamUrl) return showToast('尚未捕获到视频流，请先点击播放视频');
            location.href = 'potplayer://' + capturedStreamUrl;
            showToast('正在唤起 PotPlayer...');
        };

        document.getElementById('peach-btn-iina').onclick = (e) => {
            e.stopPropagation();
            if (!capturedStreamUrl) return showToast('尚未捕获到视频流，请先点击播放视频');
            location.href = 'iina://weblink?url=' + encodeURIComponent(capturedStreamUrl);
            showToast('正在唤起 IINA...');
        };

        document.getElementById('peach-btn-mpv').onclick = (e) => {
            e.stopPropagation();
            if (!capturedStreamUrl) return showToast('尚未捕获到视频流，请先点击播放视频');
            location.href = 'mpv://' + capturedStreamUrl;
            showToast('正在唤起 MPV...');
        };

        document.getElementById('peach-btn-copy').onclick = (e) => {
            e.stopPropagation();
            if (!capturedStreamUrl) return showToast('尚未捕获到视频流，请先点击播放视频');
            GM_setClipboard(capturedStreamUrl);
            showToast('视频原始直链已复制到剪贴板');
        };

        let collapsed = false;
        const toggleBtn = document.getElementById('peach-btn-toggle');
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            collapsed = !collapsed;
            const items = ['peach-ext-status', 'peach-btn-vlc', 'peach-btn-pot', 'peach-btn-iina', 'peach-btn-mpv', 'peach-btn-copy'];
            items.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.setProperty('display', collapsed ? 'none' : 'inline-block', 'important');
            });
            toggleBtn.textContent = collapsed ? '🎬' : '×';
            toggleBtn.title = collapsed ? '展开外置播放器面板' : '收起面板';
        };
    }

    function updateUIState() {
        const statusEl = document.getElementById('peach-ext-status');
        if (statusEl && capturedStreamUrl) {
            statusEl.style.setProperty('color', '#4ade80', 'important');
            statusEl.textContent = hasTicketStream ? '● 原盘直链' : '● 已捕获';
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        if (isPeachSite()) {
            isActivated = true;
        }
        scanVideoElements();

        let syncTimer = null;
        const observer = new MutationObserver(() => {
            scanVideoElements();
            if (uiInjected) {
                clearTimeout(syncTimer);
                syncTimer = setTimeout(syncMountTarget, 80);
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'open']
        });

        document.addEventListener('fullscreenchange', syncMountTarget);
    });
})();
