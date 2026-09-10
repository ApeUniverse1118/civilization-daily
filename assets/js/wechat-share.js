/* ============================================================
 * 全球文明进程重大事件日报 · 转发到微信
 * ------------------------------------------------------------
 * 网页端无法直接唤起微信客户端分享对话框（微信封闭生态），
 * 采用通用方案：悬浮「微信」按钮 → 弹出当前页二维码 → 
 * 微信扫一扫 / 长按识别打开页面 → 右上角「···」转发给朋友或朋友圈。
 * 提供「复制链接」兜底，CDN 二维码库加载失败时优雅降级。
 * 本文件自包含（动态注入样式/按钮/弹窗），不依赖现有 CSS 结构。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__wxShareInited) return;
  window.__wxShareInited = true;

  /* ---------- 分享目标地址：优先 canonical，保证微信内打开为规范页 ---------- */
  function currentUrl() {
    var c = document.querySelector('link[rel="canonical"]');
    if (c && c.href) return c.href;
    return location.origin + location.pathname;
  }
  var url = currentUrl();

  /* ---------- 注入样式 ---------- */
  var style = document.createElement('style');
  style.textContent =
    '.wx-share-btn{position:fixed;right:22px;bottom:76px;z-index:70;width:42px;height:42px;' +
    'border-radius:50%;background:#07c160;border:none;cursor:pointer;display:flex;' +
    'align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(7,193,96,.35);' +
    'transition:transform .18s ease,background .18s ease;}' +
    '.wx-share-btn:hover{transform:translateY(-2px);background:#06ad56;}' +
    '.wx-share-mask{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.5);' +
    'display:none;align-items:center;justify-content:center;padding:20px;}' +
    '.wx-share-mask.show{display:flex;}' +
    '.wx-share-box{background:#fff;border-radius:14px;max-width:340px;width:100%;' +
    'padding:26px 24px 20px;text-align:center;position:relative;' +
    'box-shadow:0 12px 40px rgba(0,0,0,.25);}' +
    '.wx-share-close{position:absolute;top:10px;right:14px;border:none;background:none;' +
    'font-size:22px;color:#999;cursor:pointer;line-height:1;padding:4px;}' +
    '.wx-share-box h3{margin:0 0 4px;font-size:17px;color:#111;}' +
    '.wx-share-sub{font-size:12.5px;color:#888;margin-bottom:16px;}' +
    '.wx-share-qr{width:200px;height:200px;margin:0 auto 14px;border:1px solid #eee;' +
    'border-radius:10px;display:flex;align-items:center;justify-content:center;' +
    'overflow:hidden;background:#fff;}' +
    '.wx-share-qr img,.wx-share-qr canvas{display:block;}' +
    '.wx-share-qr .wx-qr-fallback{font-size:12px;color:#999;padding:0 14px;line-height:1.7;}' +
    '.wx-share-steps{font-size:12.5px;color:#555;text-align:left;background:#f7f7f7;' +
    'border-radius:8px;padding:10px 14px;line-height:1.8;margin-bottom:14px;}' +
    '.wx-share-copy{width:100%;padding:10px;border:none;border-radius:8px;background:#07c160;' +
    'color:#fff;font-size:14px;cursor:pointer;}' +
    '.wx-share-copy:hover{background:#06ad56;}' +
    '@media(max-width:680px){.wx-share-btn{right:14px;bottom:76px;}}';
  document.head.appendChild(style);

  /* ---------- 悬浮按钮（微信图标） ---------- */
  var btn = document.createElement('button');
  btn.className = 'wx-share-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', '转发到微信');
  btn.setAttribute('title', '转发到微信');
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">' +
    '<path d="M8.7 4C5.1 4 2.2 6.5 2.2 9.5c0 1.7 1 3.2 2.5 4.2l-.6 1.9 2.2-1.1c.8.2 1.6.4 2.4.4h.3c-.2-.6-.3-1.2-.3-1.9 0-2.4 1.3-4.9 3.7-6.4-1-1.1-2.2-1.6-3.7-1.6zm-2 3.4a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8zm4.1 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8zM16 8.4c-3.2 0-5.8 2.2-5.8 4.9s2.6 4.9 5.8 4.9c.7 0 1.4-.1 2-.3l1.9.9-.5-1.7c1.5-.8 2.4-2.2 2.4-3.8 0-2.7-2.6-4.9-5.8-4.9zm-2.3 3.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm3.2 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>' +
    '</svg>';
  document.body.appendChild(btn);

  /* ---------- 弹窗 ---------- */
  var mask = document.createElement('div');
  mask.className = 'wx-share-mask';
  mask.innerHTML =
    '<div class="wx-share-box" role="dialog" aria-label="转发到微信">' +
    '<button type="button" class="wx-share-close" aria-label="关闭">×</button>' +
    '<h3>转发到微信</h3>' +
    '<div class="wx-share-sub">微信扫一扫 · 长按识别二维码</div>' +
    '<div class="wx-share-qr"><div class="wx-qr-fallback">二维码加载中…</div></div>' +
    '<div class="wx-share-steps">1. 打开微信「扫一扫」或长按识别上方二维码<br>' +
    '2. 打开页面后，点击右上角「···」<br>' +
    '3. 选择「转发给朋友」或「分享到朋友圈」</div>' +
    '<button type="button" class="wx-share-copy">复制链接</button>' +
    '</div>';
  document.body.appendChild(mask);

  var qrBox = mask.querySelector('.wx-share-qr');
  var copyBtn = mask.querySelector('.wx-share-copy');

  /* ---------- 动态加载二维码库（双 CDN 备用） ---------- */
  function loadQr() {
    return new Promise(function (resolve, reject) {
      if (window.QRCode) return resolve();
      var srcs = [
        'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
        'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js'
      ];
      var i = 0;
      (function next() {
        if (i >= srcs.length) return reject(new Error('qrcode load failed'));
        var s = document.createElement('script');
        s.src = srcs[i++];
        s.async = true;
        s.onload = function () { window.QRCode ? resolve() : next(); };
        s.onerror = next;
        document.head.appendChild(s);
      })();
    });
  }
  var qrStarted = false;
  function renderQr() {
    if (qrStarted) return;
    qrStarted = true;
    loadQr().then(function () {
      qrBox.innerHTML = '';
      new QRCode(qrBox, {
        text: url,
        width: 200,
        height: 200,
        correctLevel: QRCode.CorrectLevel.M
      });
    }).catch(function () {
      qrBox.innerHTML =
        '<div class="wx-qr-fallback">二维码服务暂不可用<br>' +
        '请点击下方「复制链接」，粘贴到微信发送</div>';
    });
  }

  /* ---------- 复制链接（Clipboard API + 兼容兜底） ---------- */
  function copyLink() {
    function done(ok) {
      copyBtn.textContent = ok ? '链接已复制 ✓' : '复制失败，请长按链接手动复制';
      copyBtn.classList.add('copied');
      setTimeout(function () {
        copyBtn.textContent = '复制链接';
        copyBtn.classList.remove('copied');
      }, 2000);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done(true); }, fallback);
    } else {
      fallback();
    }
  }
  copyBtn.addEventListener('click', copyLink);

  /* ---------- 开关 ---------- */
  function open() { mask.classList.add('show'); renderQr(); document.body.style.overflow = 'hidden'; }
  function close() { mask.classList.remove('show'); document.body.style.overflow = ''; }
  btn.addEventListener('click', open);
  mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
  mask.querySelector('.wx-share-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
