// ==UserScript==
// @name         PeachMitao 外置播放器助手 (VLC / PotPlayer / IINA / MPV)
// @namespace    https://github.com/kylo1989/peachmitao-external-player
// @version      2.0.0
// @description  深度适配 PeachMitao /api/external-playback 接口，无需启动网页播放器即可秒取 6 小时有效原盘直链，一键唤起本地 VLC、PotPlayer、IINA、MPV。
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
        if (html.includes('peachmitao') || html.includes('external-playback')) return true;

        return false;
    }

    let currentAssetId = '';
    const ticketUrlCache = new Map(); // assetId -> ticketUrl
    let latestTicketUrl = '';
    let isActivated = isPeachSite();
    let uiInjected = false;

    // 递归从 JSON 对象中提取包含 ticket= 的原盘直链
    function extractTicketUrlFromData(data, depth = 0) {
        if (!data || depth > 5) return '';
        if (typeof data === 'string') {
            if (data.includes('ticket=') && !data.includes('.m3u8') && !data.includes('/hls/')) {
                try {
                    return new URL(data, location.origin).href;
                } catch (e) {
                    return data;
                }
            }
            return '';
        }
        if (Array.isArray(data)) {
            for (const item of data) {
                const found = extractTicketUrlFromData(item, depth + 1);
                if (found) return found;
            }
        } else if (typeof data === 'object') {
            // 优先匹配常见字段名
            const priorityKeys = ['url', 'stream_url', 'streamUrl', 'playback_url', 'playbackUrl', 'direct_url', 'directUrl'];
            for (const k of priorityKeys) {
                if (typeof data[k] === 'string' && data[k].includes('ticket=')) {
                    try {
                        return new URL(data[k], location.origin).href;
                    } catch (e) {
                        return data[k];
                    }
                }
            }
            for (const val of Object.values(data)) {
                const found = extractTicketUrlFromData(val, depth + 1);
                if (found) return found;
            }
        }
        return '';
    }

    // 从 API 请求 URL 中嗅探当前作品资产 ID
    function sniffAssetIdFromUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return;
        try {
            const u = new URL(rawUrl, location.origin);
            // 1. 匹配 /api/external-playback?id=54
            if (u.pathname.includes('/api/external-playback')) {
                isActivated = true;
                const id = u.searchParams.get('id');
                if (id) setCurrentAssetId(id);
                return;
            }
            // 2. 匹配详情接口 /api/videos/54, /api/items/54, /api/media/54, /api/assets/54, /stream/54, /stream/hls/54
            const m = u.pathname.match(/\/(?:api\/(?:videos|items|media|assets|works|ledger)|stream(?:\/hls)?)\/([a-zA-Z0-9_-]+)(?:\/|$)/);
            if (m && m[1] && m[1] !== 'hls' && m[1] !== 'list' && m[1] !== 'search') {
                setCurrentAssetId(m[1]);
            }
        } catch (e) {}
    }

    function setCurrentAssetId(id) {
        if (!id) return;
        currentAssetId = String(id);
        if (isActivated) {
            ensureUI();
            syncMountTarget();
            updateUIState();
        }
    }

    function recordTicketUrl(url, assetId = currentAssetId) {
        if (!url || !url.includes('ticket=')) return;
        isActivated = true;
        latestTicketUrl = url;
        if (assetId) {
            ticketUrlCache.set(String(assetId), url);
        }
        ensureUI();
        syncMountTarget();
        updateUIState();
    }

    // 主动调用 Peach 官方接口 POST /api/external-playback?id=<id> 获取 6 小时有效原盘直链
    async function fetchOfficialTicketUrl() {
        // 1. 优先命中当前资产缓存
        if (currentAssetId && ticketUrlCache.has(currentAssetId)) {
            return ticketUrlCache.get(currentAssetId);
        }

        // 2. 主动请求官方签发接口
        if (currentAssetId) {
            try {
                const resp = await origFetch.call(window, `${location.origin}/api/external-playback?id=${encodeURIComponent(currentAssetId)}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });
                if (resp.ok) {
                    const text = await resp.text();
                    let found = '';
                    try {
                        found = extractTicketUrlFromData(JSON.parse(text));
                    } catch (e) {
                        const match = text.match(/https?:\/\/[^\s"'<>]+ticket=[^\s"'<>]+|\/stream\/[^\s"'<>]+ticket=[^\s"'<>]+/);
                        if (match) found = new URL(match[0], location.origin).href;
                    }
                    if (found) {
                        recordTicketUrl(found, currentAssetId);
                        return found;
                    }
                }
            } catch (e) {}
        }

        // 3. 兜底：若页面已有“网络播放地址 / VR”选项，自动模拟触发一次原生按钮获取直链
        const nativeUrl = await triggerNativePlaybackButton();
        if (nativeUrl) return nativeUrl;

        return latestTicketUrl;
    }

    // 模拟触发 Peach 原生的“网络播放地址 / VR”获取链接
    function triggerNativePlaybackButton() {
        return new Promise((resolve) => {
            const container = getTopMountContainer();
            if (!container) return resolve('');

            const selects = container.querySelectorAll('select');
            let targetSelect = null;
            for (const sel of selects) {
                for (const opt of sel.options) {
                    if (opt.text.includes('网络播放地址') || opt.text.includes('VR')) {
                        targetSelect = sel;
                        sel.value = opt.value;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
                if (targetSelect) break;
            }

            if (targetSelect && targetSelect.parentElement) {
                const openBtn = Array.from(targetSelect.parentElement.querySelectorAll('button'))
                    .find(b => b.textContent.trim() === '打开');
                if (openBtn) {
                    openBtn.click();
                }
            }

            let attempts = 0;
            const timer = setInterval(() => {
                attempts++;
                if (currentAssetId && ticketUrlCache.has(currentAssetId)) {
                    clearInterval(timer);
                    resolve(ticketUrlCache.get(currentAssetId));
                } else if (latestTicketUrl) {
                    clearInterval(timer);
                    resolve(latestTicketUrl);
                } else if (attempts >= 15) {
                    clearInterval(timer);
                    resolve('');
                }
            }, 150);
        });
    }

    // Hook window.fetch（仅嗅探 ID 与 /api/external-playback 响应，绝不抓取 .ts 切片）
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
        sniffAssetIdFromUrl(reqUrl);

        const response = await origFetch.apply(this, args);
        try {
            if (reqUrl && reqUrl.includes('/api/external-playback')) {
                const clone = response.clone();
                clone.text().then(text => {
                    try {
                        const found = extractTicketUrlFromData(JSON.parse(text));
                        if (found) recordTicketUrl(found);
                    } catch (e) {}
                }).catch(() => {});
            }
        } catch (e) {}
        return response;
    };

    // Hook XMLHttpRequest
    const origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        sniffAssetIdFromUrl(url);
        this.addEventListener('load', function () {
            try {
                if (typeof url === 'string' && url.includes('/api/external-playback')) {
                    const found = extractTicketUrlFromData(JSON.parse(this.responseText));
                    if (found) recordTicketUrl(found);
                }
            } catch (e) {}
        });
        return origXhrOpen.apply(this, arguments);
    };

    function getTopMountContainer() {
        if (document.fullscreenElement) return document.fullscreenElement;
        const openDialogs = document.querySelectorAll('dialog[open]');
        if (openDialogs.length > 0) {
            return openDialogs[openDialogs.length - 1];
        }
        return document.body || document.documentElement;
    }

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

    async function launchPlayer(type) {
        showToast('正在向 Peach 申请原盘直链...');
        const streamUrl = await fetchOfficialTicketUrl();
        if (!streamUrl) {
            showToast('未能获取直链，请先点击页面上的“打开”按钮');
            return;
        }

        GM_setClipboard(streamUrl);

        if (type === 'vlc') {
            location.href = 'vlc://' + streamUrl;
            showToast('正在唤起 VLC（直链已同步复制，也可直接 Ctrl+V）');
        } else if (type === 'pot') {
            location.href = 'potplayer://' + streamUrl;
            showToast('正在唤起 PotPlayer...');
        } else if (type === 'iina') {
            location.href = 'iina://weblink?url=' + encodeURIComponent(streamUrl);
            showToast('正在唤起 IINA...');
        } else if (type === 'mpv') {
            location.href = 'mpv://' + streamUrl;
            showToast('正在唤起 MPV...');
        } else if (type === 'copy') {
            showToast('6小时有效原盘直链已复制到剪贴板！');
        }
    }

    // 在 Peach 原生的“打开”按钮旁边也嵌入一组快捷按钮
    function injectInlineButtons() {
        const container = getTopMountContainer();
        if (!container) return;

        const buttons = container.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent.trim() === '打开' && btn.parentElement && !btn.parentElement.querySelector('.peach-inline-ext-group')) {
                const selectEl = btn.parentElement.querySelector('select');
                if (!selectEl) continue;

                const group = document.createElement('span');
                group.className = 'peach-inline-ext-group';
                group.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:6px;';

                const makeInlineBtn = (label, bg, type) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.textContent = label;
                    b.style.cssText = `padding:6px 12px;border:none;border-radius:6px;background:${bg};color:#fff;font-size:13px;font-weight:500;cursor:pointer;line-height:1.4;`;
                    b.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        launchPlayer(type);
                    };
                    return b;
                };

                group.appendChild(makeInlineBtn('VLC', '#ea580c', 'vlc'));
                group.appendChild(makeInlineBtn('PotPlayer', '#d97706', 'pot'));
                group.appendChild(makeInlineBtn('复制直链', '#059669', 'copy'));
                btn.parentElement.appendChild(group);
            }
        }
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
            <span id="peach-ext-status" style="color:#4ade80 !important;font-size:12px !important;margin-right:2px !important;" title="已对接 Peach 原盘直链接口">● 原盘直链</span>
            <button id="peach-btn-vlc" style="${btnBaseStyle}background:#ea580c !important;" title="自动唤起本地 VLC">VLC</button>
            <button id="peach-btn-pot" style="${btnBaseStyle}background:#d97706 !important;" title="自动唤起 Windows 本地 PotPlayer">PotPlayer</button>
            <button id="peach-btn-iina" style="${btnBaseStyle}background:#2563eb !important;" title="自动唤起 macOS 本地 IINA">IINA</button>
            <button id="peach-btn-mpv" style="${btnBaseStyle}background:#7c3aed !important;" title="自动唤起本地 MPV">MPV</button>
            <button id="peach-btn-copy" style="${btnBaseStyle}background:#059669 !important;" title="复制 6 小时有效原盘直链">复制直链</button>
            <button id="peach-btn-toggle" style="background:transparent !important;border:none !important;color:#9ca3af !important;cursor:pointer !important;font-size:14px !important;padding:0 4px !important;pointer-events:auto !important;" title="收起/展开">×</button>
        `;

        target.appendChild(bar);
        syncMountTarget();

        bar.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', () => { btn.style.filter = 'brightness(1.15)'; });
            btn.addEventListener('mouseleave', () => { btn.style.filter = 'none'; });
        });

        document.getElementById('peach-btn-vlc').onclick = (e) => { e.stopPropagation(); launchPlayer('vlc'); };
        document.getElementById('peach-btn-pot').onclick = (e) => { e.stopPropagation(); launchPlayer('pot'); };
        document.getElementById('peach-btn-iina').onclick = (e) => { e.stopPropagation(); launchPlayer('iina'); };
        document.getElementById('peach-btn-mpv').onclick = (e) => { e.stopPropagation(); launchPlayer('mpv'); };
        document.getElementById('peach-btn-copy').onclick = (e) => { e.stopPropagation(); launchPlayer('copy'); };

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
        if (statusEl) {
            statusEl.style.setProperty('color', '#4ade80', 'important');
            statusEl.textContent = currentAssetId ? `● 资产 #${currentAssetId}` : '● 原盘直链';
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        if (isPeachSite()) {
            isActivated = true;
            ensureUI();
        }

        let syncTimer = null;
        const observer = new MutationObserver(() => {
            if (isActivated) {
                ensureUI();
                injectInlineButtons();
                clearTimeout(syncTimer);
                syncTimer = setTimeout(syncMountTarget, 80);
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['open']
        });

        document.addEventListener('fullscreenchange', syncMountTarget);
    });
})();
