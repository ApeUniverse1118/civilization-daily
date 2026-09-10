/* ============================================================
 * 全球文明进程重大事件日报 · 转发到微信
 * ------------------------------------------------------------
 * 功能一：二维码转发 —— 悬浮「微信」按钮 → 当前页二维码 →
 *         微信扫一扫/长按识别打开 → 右上角「···」转发。
 * 功能二：分享卡片 —— 一键生成 1080×1440 竖版海报卡片
 *         （标题/摘要/二维码/品牌标），保存后可直接发送到
 *         微信好友、微信群、朋友圈。
 * 说明：网页无法直接唤起微信客户端分享对话框（封闭生态），
 *       本实现为静态站通用合规方案；卡片完全由 canvas 矢量绘制，
 *       零外部图片依赖，无 CORS 风险。CDN 二维码库失败时优雅降级。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__wxShareInited) return;
  window.__wxShareInited = true;

  /* ---------- 页面信息 ---------- */
  function currentUrl() {
    var c = document.querySelector('link[rel="canonical"]');
    if (c && c.href) return c.href;
    return location.origin + location.pathname;
  }
  var url = currentUrl();
  var pageTitle = (document.title || '').split('｜')[0].trim() || (document.title || '').trim();
  var metaDesc = document.querySelector('meta[name="description"]');
  var desc = metaDesc && metaDesc.content ? metaDesc.content : '';
  var siteName = '全球文明进程重大事件日报';
  var dateMatch = pageTitle.match(/(\d{4}-\d{2}-\d{2})/);
  var dateStr = dateMatch ? dateMatch[1] : (function () {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  })();
  var issueMatch = (document.querySelector('.meta-row') || { textContent: '' }).textContent.match(/第\s*\d+\s*期/);
  var badge = dateStr + (issueMatch ? ' · ' + issueMatch[0] : '');

  /* ---------- 注入样式 ---------- */
  var style = document.createElement('style');
  style.textContent =
    '.wx-share-btn{position:fixed;right:22px;bottom:76px;z-index:70;width:42px;height:42px;' +
    'border-radius:50%;background:#07c160;border:none;cursor:pointer;display:flex;' +
    'align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(7,193,96,.35);' +
    'transition:transform .18s ease,background .18s ease;}' +
    '.wx-share-btn:hover{transform:translateY(-2px);background:#06ad56;}' +
    '.wx-share-mask{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);' +
    'display:none;align-items:center;justify-content:center;padding:20px;}' +
    '.wx-share-mask.show{display:flex;}' +
    '.wx-share-box{background:#fff;border-radius:14px;max-width:360px;width:100%;' +
    'padding:26px 24px 20px;text-align:center;position:relative;max-height:92vh;' +
    'overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.28);}' +
    '.wx-share-close{position:absolute;top:10px;right:14px;border:none;background:none;' +
    'font-size:22px;color:#999;cursor:pointer;line-height:1;padding:4px;z-index:2;}' +
    '.wx-share-view{display:none;}' +
    '.wx-share-view.show{display:block;}' +
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
    'color:#fff;font-size:14px;cursor:pointer;margin-bottom:10px;}' +
    '.wx-share-copy:hover{background:#06ad56;}' +
    '.wx-share-copy.copied{background:#06ad56;}' +
    '.wx-share-gen{width:100%;padding:10px;border:1px solid #07c160;border-radius:8px;' +
    'background:#fff;color:#07c160;font-size:14px;cursor:pointer;}' +
    '.wx-share-gen:hover{background:#f0faf4;}' +
    '.wx-card-preview{width:100%;max-width:300px;margin:6px auto 10px;border-radius:10px;' +
    'display:block;box-shadow:0 4px 18px rgba(0,0,0,.14);}' +
    '.wx-card-tip{font-size:12.5px;color:#888;line-height:1.8;margin-bottom:12px;}' +
    '.wx-card-actions{display:flex;gap:8px;}' +
    '.wx-card-actions button{flex:1;padding:10px;border:none;border-radius:8px;' +
    'font-size:14px;cursor:pointer;}' +
    '.wx-card-save{background:#07c160;color:#fff;}' +
    '.wx-card-back{background:#f2f2f2;color:#555;}' +
    '.wx-card-loading{font-size:13px;color:#999;padding:60px 0;}' +
    '@media(max-width:680px){.wx-share-btn{right:14px;bottom:76px;}}';
  document.head.appendChild(style);

  /* ---------- 悬浮按钮 ---------- */
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

  /* ---------- 弹窗（双视图） ---------- */
  var mask = document.createElement('div');
  mask.className = 'wx-share-mask';
  mask.innerHTML =
    '<div class="wx-share-box" role="dialog" aria-label="转发到微信">' +
    '<button type="button" class="wx-share-close" aria-label="关闭">×</button>' +
    '<div class="wx-share-view show" data-view="share">' +
    '<h3>转发到微信</h3>' +
    '<div class="wx-share-sub">微信扫一扫 · 长按识别二维码</div>' +
    '<div class="wx-share-qr"><div class="wx-qr-fallback">二维码加载中…</div></div>' +
    '<div class="wx-share-steps">1. 打开微信「扫一扫」或长按识别二维码<br>' +
    '2. 打开页面后，点击右上角「···」转发<br>' +
    '3. 或点下方「生成分享卡片」，直接发好友 / 群 / 朋友圈</div>' +
    '<button type="button" class="wx-share-copy">复制链接</button>' +
    '<button type="button" class="wx-share-gen">🖼 生成分享卡片</button>' +
    '</div>' +
    '<div class="wx-share-view" data-view="card">' +
    '<h3>分享卡片</h3>' +
    '<div class="wx-share-sub">保存图片后，即可发微信好友 / 群 / 朋友圈</div>' +
    '<div class="wx-card-loading">卡片生成中…</div>' +
    '<div class="wx-card-preview-wrap" style="display:none">' +
    '<img class="wx-card-preview" alt="分享卡片" src="">' +
    '<div class="wx-card-tip">📱 手机端：长按图片 → 「发送给朋友」或「保存图片」<br>' +
    '💻 电脑端：点击下方「保存卡片」下载后拖入微信</div>' +
    '<div class="wx-card-actions">' +
    '<button type="button" class="wx-card-save">保存卡片</button>' +
    '<button type="button" class="wx-card-back">返回</button>' +
    '</div></div>' +
    '</div>' +
    '</div>';
  document.body.appendChild(mask);

  var qrBox = mask.querySelector('.wx-share-qr');
  var copyBtn = mask.querySelector('.wx-share-copy');
  var genBtn = mask.querySelector('.wx-share-gen');
  var cardLoading = mask.querySelector('.wx-card-loading');
  var cardWrap = mask.querySelector('.wx-card-preview-wrap');
  var cardImg = mask.querySelector('.wx-card-preview');
  var saveBtn = mask.querySelector('.wx-card-save');
  var backBtn = mask.querySelector('.wx-card-back');

  function showView(name) {
    mask.querySelectorAll('.wx-share-view').forEach(function (v) {
      v.classList.toggle('show', v.getAttribute('data-view') === name);
    });
  }

  /* ---------- 二维码库（双 CDN 备用） ---------- */
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
      new QRCode(qrBox, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    }).catch(function () {
      qrBox.innerHTML =
        '<div class="wx-qr-fallback">二维码服务暂不可用<br>' +
        '请点击下方「复制链接」，粘贴到微信发送</div>';
    });
  }

  /* ---------- 复制链接 ---------- */
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

  /* ---------- 分享卡片（canvas 海报） ---------- */
  var posterReady = false;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth) {
    var lines = [];
    var cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      if (ctx.measureText(cur + ch).width > maxWidth) {
        lines.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawPoster() {
    var W = 1080, H = 1440;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    var BG = '#f5f2ea', SURF = '#fffdf7', INK = '#23201a',
        GOLD = '#96682c', GOLD_D = '#6f4a1e', GOLD_SOFT = '#efe5d2',
        LINE = '#e2dccb', SUB = '#5a5448';
    var SERIF = 'Georgia, "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
    var SANS = 'PingFang SC, "Microsoft YaHei", "Hiragino Sans GB", sans-serif';

    /* 背景 */
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    /* 画框 */
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 40, 40, W - 80, H - 80, 28);
    ctx.stroke();

    /* 顶部品牌行 */
    ctx.fillStyle = GOLD;
    ctx.fillRect(96, 112, 8, 44);
    ctx.fillStyle = GOLD_D;
    ctx.font = '36px ' + SERIF;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(siteName, 128, 147);
    ctx.fillStyle = GOLD;
    ctx.font = '500 13px ' + SANS;
    ctx.textAlign = 'right';
    ctx.fillText('C I V I L I Z A T I O N   W A T C H', W - 96, 138);
    ctx.textAlign = 'left';
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(96, 196);
    ctx.lineTo(W - 96, 196);
    ctx.stroke();

    /* 日期徽章 */
    ctx.font = '24px ' + SANS;
    var bw = ctx.measureText(badge).width + 40;
    ctx.fillStyle = GOLD_SOFT;
    roundRect(ctx, 96, 232, bw, 48, 24);
    ctx.fill();
    ctx.fillStyle = GOLD_D;
    ctx.fillText(badge, 116, 264);

    /* 主标题 */
    ctx.fillStyle = INK;
    ctx.font = '48px ' + SERIF;
    var titleLines = wrapLines(ctx, pageTitle, 820).slice(0, 3);
    var ty = 330;
    titleLines.forEach(function (ln, i) {
      var t = ln;
      if (i === titleLines.length - 1 && wrapLines(ctx, pageTitle, 820).length > 3) t += '…';
      ctx.fillText(t, 96, ty);
      ty += 70;
    });

    /* 摘要 */
    ctx.fillStyle = SUB;
    ctx.font = '28px ' + SANS;
    var descLines = wrapLines(ctx, desc, 820).slice(0, 4);
    var dy = ty + 36;
    descLines.forEach(function (ln, i) {
      var t = ln;
      if (i === descLines.length - 1 && wrapLines(ctx, desc, 820).length > 4) t += '…';
      ctx.fillText(t, 96, dy);
      dy += 46;
    });

    /* 二维码面板 */
    ctx.fillStyle = SURF;
    roundRect(ctx, 96, 1060, W - 192, 300, 20);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 96, 1060, W - 192, 300, 20);
    ctx.stroke();

    var qrCanvas = null;
    if (window.QRCode) {
      var holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden;';
      document.body.appendChild(holder);
      try {
        new QRCode(holder, { text: url, width: 320, height: 320, correctLevel: QRCode.CorrectLevel.M });
        qrCanvas = holder.querySelector('canvas') || holder.querySelector('img');
      } catch (e) { qrCanvas = null; }
      document.body.removeChild(holder);
    }
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 136, 1080, 260, 260);
    } else {
      ctx.fillStyle = '#f2efe6';
      roundRect(ctx, 136, 1080, 260, 260, 12);
      ctx.fill();
      ctx.fillStyle = SUB;
      ctx.font = '26px ' + SANS;
      ctx.textAlign = 'center';
      ctx.fillText('微信扫码', 266, 1190);
      ctx.fillText('阅读原文', 266, 1230);
      ctx.textAlign = 'left';
    }

    /* 面板右侧文字 */
    ctx.fillStyle = INK;
    ctx.font = '34px ' + SERIF;
    ctx.fillText('长按识别二维码', 452, 1182);
    ctx.fillStyle = GOLD_D;
    ctx.font = '26px ' + SANS;
    ctx.fillText('阅读完整内容', 452, 1232);
    ctx.fillStyle = GOLD;
    ctx.font = '20px ' + SANS;
    ctx.fillText('civilization-radar.com', 452, 1290);

    /* 底部落款 */
    ctx.fillStyle = GOLD;
    ctx.font = '22px ' + SERIF;
    ctx.textAlign = 'center';
    ctx.fillText('记录人类文明演进中的关键节点', W / 2, 1372);
    ctx.textAlign = 'left';

    return canvas.toDataURL('image/png');
  }

  function generateCard() {
    showView('card');
    cardLoading.style.display = 'block';
    cardWrap.style.display = 'none';
    setTimeout(function () {
      var dataUrl;
      try {
        dataUrl = drawPoster();
      } catch (e) {
        dataUrl = null;
      }
      if (!dataUrl) {
        cardLoading.style.display = 'block';
        cardLoading.textContent = '卡片生成失败，请尝试「复制链接」转发';
        return;
      }
      cardLoading.style.display = 'none';
      cardImg.src = dataUrl;
      cardWrap.style.display = 'block';
      saveBtn.onclick = function () {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'civilization-radar-' + dateStr + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      posterReady = true;
    }, 60);
  }

  genBtn.addEventListener('click', generateCard);
  backBtn.addEventListener('click', function () { showView('share'); });

  /* ---------- 开关 ---------- */
  function open() {
    mask.classList.add('show');
    renderQr();
    document.body.style.overflow = 'hidden';
  }
  function close() {
    mask.classList.remove('show');
    document.body.style.overflow = '';
  }
  btn.addEventListener('click', open);
  mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
  mask.querySelector('.wx-share-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
