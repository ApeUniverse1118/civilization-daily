/*!
 * Civilization Radar - Text to Speech Player
 * 高质量语音播报：智能音色优选 + 段落级高亮 + 完整播放控制
 */
(function () {
  'use strict';

  /* ============ 配置 ============ */
  var CFG = {
    accent: '#8a6228',
    accentDeep: '#5f4319',
    accentSoft: '#efe5cf',
    maxSegChars: 180,        // 单段最大字符数（超过则按句拆分，避免Chrome截断）
    defaultRate: 1.0,
    rateSteps: [0.75, 0.85, 1.0, 1.1, 1.25, 1.5],
    storageKey: 'civradar_tts_pref'
  };

  /* ============ 工具 ============ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function trim(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function loadPref() {
    try { return JSON.parse(localStorage.getItem(CFG.storageKey)) || {}; } catch (e) { return {}; }
  }
  function savePref(p) {
    try { localStorage.setItem(CFG.storageKey, JSON.stringify(p)); } catch (e) {}
  }

  /* ============ 音色管理 ============ */
  var voiceCache = [];
  var voiceReady = false;
  var voiceCallbacks = [];

  function ensureVoices(cb) {
    if (voiceReady && voiceCache.length) { cb(voiceCache); return; }
    voiceCallbacks.push(cb);
    function refresh() {
      voiceCache = window.speechSynthesis.getVoices() || [];
      if (voiceCache.length) {
        voiceReady = true;
        var cbs = voiceCallbacks; voiceCallbacks = [];
        cbs.forEach(function (fn) { fn(voiceCache); });
      }
    }
    refresh();
    window.speechSynthesis.onvoiceschanged = refresh;
    // 兜底：1.5秒后强制触发
    setTimeout(function () { if (!voiceReady) refresh(); }, 1500);
  }

  function isChineseVoice(v) {
    var l = (v.lang || '').toLowerCase();
    var n = (v.name || '').toLowerCase();
    return l.indexOf('zh') === 0 || n.indexOf('chinese') >= 0 || n.indexOf('mandarin') >= 0 || n.indexOf('中文') >= 0;
  }

  function voiceScore(v) {
    var n = (v.name || '').toLowerCase();
    var s = 0;
    if (/online|natural|neural|神经网络|在线/.test(n)) s += 10;
    if (/xiaoxiao|晓晓/.test(n)) s += 8;
    if (/yunxi|云希/.test(n)) s += 7;
    if (/yunyang|云扬/.test(n)) s += 6;
    if (/yunjian|云健/.test(n)) s += 5;
    if (/xiaohan|晓涵/.test(n)) s += 5;
    if (/xiaomo|晓墨/.test(n)) s += 4;
    if (/huihui|慧慧/.test(n)) s += 3;
    if (/kangkang|康康/.test(n)) s += 2;
    if (/yaoyao|瑶瑶/.test(n)) s += 2;
    if (v.localService) s += 1;
    return s;
  }

  function getChineseVoices() {
    return voiceCache.filter(isChineseVoice).sort(function (a, b) {
      return voiceScore(b) - voiceScore(a);
    });
  }

  function pickBestVoice(prefName) {
    var list = getChineseVoices();
    if (!list.length) return null;
    if (prefName) {
      var found = list.filter(function (v) { return v.name === prefName; })[0];
      if (found) return found;
    }
    return list[0];
  }

  /* ============ 文本提取（段落数组） ============ */
  // 返回 [{text, element}]，element 用于高亮；element 可为 null（纯文本段）
  function extractSegments() {
    var segs = [];
    function push(text, element) {
      text = trim(text);
      if (!text) return;
      // 长段按句号/问号/感叹号拆分
      if (text.length > CFG.maxSegChars) {
        var parts = text.match(/[^。！？!?]+[。！？!?]?/g) || [text];
        var buf = '';
        parts.forEach(function (p) {
          if ((buf + p).length > CFG.maxSegChars && buf) {
            segs.push({ text: buf, element: element });
            buf = p;
          } else {
            buf += p;
          }
        });
        if (buf) segs.push({ text: buf, element: element });
      } else {
        segs.push({ text: text, element: element });
      }
    }

    // 1. 标题
    var h1 = $('.page-head h1');
    if (h1) push('文明进程日报。' + trim(h1.textContent), h1);

    // 2. 今日核心判断 obs-box
    var obs = $('.obs-box');
    if (obs) {
      var obsTitle = $('.obs-title, .obs-box h3, .obs-box h2', obs);
      if (obsTitle) push('今日核心判断。' + trim(obsTitle.textContent), obs);
      $$('.obs-box p, .obs-box .obs-content', obs).forEach(function (p) {
        push(trim(p.textContent), p);
      });
    }

    // 3. 各分区事件
    $$('.dsec').forEach(function (sec) {
      var secTitle = $('.dsec-title', sec);
      if (secTitle) push(trim(secTitle.textContent).replace(/\s*\d+\s*条\s*$/, ''), secTitle);

      $$('.event-card', sec).forEach(function (card) {
        var h3 = $('h3', card);
        if (h3) push(trim(h3.textContent), h3);

        // 时间说明
        var tnote = $('.ev-tnote', card);
        if (tnote) push(trim(tnote.textContent).replace(/^⏱\s*时间说明[：:]?\s*/, ''), tnote);

        // 发生了什么 / 为什么重要
        $$('.ev-blk', card).forEach(function (blk) {
          var lb = $('.lb', blk);
          var p = $('p', blk);
          var label = lb ? trim(lb.textContent) : '';
          var content = p ? trim(p.textContent) : trim(blk.textContent);
          if (label && content) {
            push(label + '。' + content, blk);
          } else if (content) {
            push(content, blk);
          }
        });
      });
    });

    // 4. 评分汇总（score-table 中的文字）
    var st = $('.score-table');
    if (st) {
      var rows = $$('tbody tr', st);
      if (rows.length) {
        var summary = '评分汇总。';
        rows.forEach(function (r) {
          var tds = $$('td', r);
          if (tds.length >= 2) {
            summary += trim(tds[0].textContent) + '，' + trim(tds[1].textContent) + '分。';
          }
        });
        push(summary, st);
      }
    }

    // 5. 自检清单
    $$('.chk-block').forEach(function (chk) {
      var chkTitle = $('h3, h4, .chk-title', chk);
      if (chkTitle) push(trim(chkTitle.textContent), chkTitle);
      $$('.chk-item, .chk-block li, .chk-block p', chk).forEach(function (item) {
        push(trim(item.textContent).replace(/^[☑✅■□▪•\-\d\.]+\s*/, ''), item);
      });
    });

    return segs;
  }

  /* ============ 播放器类 ============ */
  function Player(segments) {
    this.segs = segments;
    this.idx = 0;
    this.playing = false;
    this.paused = false;
    this.rate = CFG.defaultRate;
    this.voice = null;
    this.currentUtter = null;
    this.highlightCls = 'tts-highlight';
    this.listeners = {};
  }

  Player.prototype.on = function (ev, fn) {
    (this.listeners[ev] = this.listeners[ev] || []).push(fn);
  };
  Player.prototype.emit = function (ev, data) {
    (this.listeners[ev] || []).forEach(function (fn) { fn(data); });
  };

  Player.prototype._clearHighlight = function () {
    $$('.' + this.highlightCls).forEach(function (e) {
      e.classList.remove(this.highlightCls);
    }, this);
  };

  Player.prototype._highlight = function (element) {
    this._clearHighlight();
    if (element && element.classList) {
      element.classList.add(this.highlightCls);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  Player.prototype._speakCurrent = function () {
    var self = this;
    if (this.idx >= this.segs.length) {
      this.stop();
      this.emit('end');
      return;
    }
    var seg = this.segs[this.idx];
    var u = new SpeechSynthesisUtterance(seg.text);
    u.lang = 'zh-CN';
    u.rate = this.rate;
    u.pitch = 1.0;
    if (this.voice) u.voice = this.voice;
    u.onend = function () {
      if (!self.playing) return;
      self.idx++;
      self.emit('progress', { idx: self.idx, total: self.segs.length });
      self._speakCurrent();
    };
    u.onerror = function (e) {
      // interrupted / canceled 是正常操作，不报错
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('TTS error:', e.error);
      // 出错则跳过当前段继续
      if (self.playing) {
        self.idx++;
        self.emit('progress', { idx: self.idx, total: self.segs.length });
        self._speakCurrent();
      }
    };
    this.currentUtter = u;
    this._highlight(seg.element);
    this.emit('progress', { idx: this.idx, total: this.segs.length });
    window.speechSynthesis.speak(u);
  };

  Player.prototype.play = function () {
    if (!this.segs.length) return;
    if (this.paused) {
      window.speechSynthesis.resume();
      this.paused = false;
      this.playing = true;
      this.emit('state', 'playing');
      return;
    }
    this.playing = true;
    this.paused = false;
    if (this.idx >= this.segs.length) this.idx = 0;
    window.speechSynthesis.cancel();
    this._speakCurrent();
    this.emit('state', 'playing');
  };

  Player.prototype.pause = function () {
    if (!this.playing) return;
    window.speechSynthesis.pause();
    this.paused = true;
    this.emit('state', 'paused');
  };

  Player.prototype.toggle = function () {
    if (this.playing && !this.paused) this.pause();
    else this.play();
  };

  Player.prototype.stop = function () {
    this.playing = false;
    this.paused = false;
    window.speechSynthesis.cancel();
    this._clearHighlight();
    this.emit('state', 'stopped');
  };

  Player.prototype.next = function () {
    if (this.idx < this.segs.length - 1) {
      this.idx++;
      if (this.playing) {
        window.speechSynthesis.cancel();
        this._speakCurrent();
      } else {
        this.emit('progress', { idx: this.idx, total: this.segs.length });
      }
    }
  };

  Player.prototype.prev = function () {
    if (this.idx > 0) {
      this.idx--;
      if (this.playing) {
        window.speechSynthesis.cancel();
        this._speakCurrent();
      } else {
        this.emit('progress', { idx: this.idx, total: this.segs.length });
      }
    }
  };

  Player.prototype.setRate = function (r) {
    this.rate = r;
    if (this.playing && !this.paused) {
      // 重新开始当前段以应用新语速
      window.speechSynthesis.cancel();
      this._speakCurrent();
    }
  };

  Player.prototype.setVoice = function (v) {
    this.voice = v;
    if (this.playing && !this.paused) {
      window.speechSynthesis.cancel();
      this._speakCurrent();
    }
  };

  Player.prototype.jumpTo = function (i) {
    if (i >= 0 && i < this.segs.length) {
      this.idx = i;
      if (this.playing) {
        window.speechSynthesis.cancel();
        this._speakCurrent();
      } else {
        this.emit('progress', { idx: this.idx, total: this.segs.length });
      }
    }
  };

  /* ============ UI 构建 ============ */
  function buildUI(player, pref) {
    // 注入样式
    var style = el('style');
    style.textContent = [
      '.tts-fab{position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:10px;}',
      '.tts-fab-btn{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,' + CFG.accent + ',' + CFG.accentDeep + ');color:#fff;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(138,98,40,.4);display:flex;align-items:center;justify-content:center;font-size:22px;transition:transform .2s,box-shadow .2s;}',
      '.tts-fab-btn:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(138,98,40,.55);}',
      '.tts-fab-btn.playing{background:linear-gradient(135deg,' + CFG.accentDeep + ',' + CFG.accent + ');animation:tts-pulse 1.5s infinite;}',
      '@keyframes tts-pulse{0%,100%{box-shadow:0 0 0 0 rgba(138,98,40,.5);}50%{box-shadow:0 0 0 12px rgba(138,98,40,0);}}',
      '.tts-panel{width:320px;background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.15);overflow:hidden;border:1px solid ' + CFG.accentSoft + ';}',
      '.tts-panel-head{background:linear-gradient(135deg,' + CFG.accent + ',' + CFG.accentDeep + ');color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}',
      '.tts-panel-head .tts-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;}',
      '.tts-panel-head .tts-close{background:none;border:none;color:#fff;cursor:pointer;font-size:18px;opacity:.8;padding:2px 6px;}',
      '.tts-panel-head .tts-close:hover{opacity:1;}',
      '.tts-panel-body{padding:14px 16px;}',
      '.tts-progress-row{display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:6px;}',
      '.tts-progress-bar{height:4px;background:' + CFG.accentSoft + ';border-radius:2px;overflow:hidden;margin-bottom:14px;}',
      '.tts-progress-fill{height:100%;background:linear-gradient(90deg,' + CFG.accent + ',' + CFG.accentDeep + ');border-radius:2px;transition:width .3s;}',
      '.tts-controls{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;}',
      '.tts-btn{width:38px;height:38px;border-radius:50%;border:1px solid ' + CFG.accentSoft + ';background:#fff;color:' + CFG.accentDeep + ';cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all .15s;}',
      '.tts-btn:hover{background:' + CFG.accentSoft + ';}',
      '.tts-btn.tts-play{width:48px;height:48px;background:linear-gradient(135deg,' + CFG.accent + ',' + CFG.accentDeep + ');color:#fff;border:none;font-size:18px;}',
      '.tts-btn.tts-play:hover{opacity:.9;}',
      '.tts-btn:disabled{opacity:.35;cursor:not-allowed;}',
      '.tts-settings{display:flex;flex-direction:column;gap:10px;}',
      '.tts-setting-row{display:flex;align-items:center;gap:10px;font-size:12px;color:#555;}',
      '.tts-setting-row label{min-width:36px;flex-shrink:0;}',
      '.tts-setting-row select{flex:1;padding:5px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;background:#fff;color:#333;}',
      '.tts-rate-btns{display:flex;gap:4px;flex:1;}',
      '.tts-rate-btn{flex:1;padding:4px 0;border:1px solid ' + CFG.accentSoft + ';background:#fff;color:' + CFG.accentDeep + ';border-radius:5px;cursor:pointer;font-size:11px;transition:all .15s;}',
      '.tts-rate-btn.active{background:' + CFG.accent + ';color:#fff;border-color:' + CFG.accent + ';}',
      '.tts-rate-btn:hover{background:' + CFG.accentSoft + ';}',
      '.tts-rate-btn.active:hover{background:' + CFG.accent + ';}',
      '.tts-highlight{background:linear-gradient(transparent 60%,' + CFG.accentSoft + ' 60%);border-radius:3px;transition:background .3s;}',
      '.tts-seg-list{max-height:160px;overflow-y:auto;margin-top:10px;border-top:1px solid #eee;padding-top:8px;}',
      '.tts-seg-item{padding:5px 8px;font-size:11px;color:#888;cursor:pointer;border-radius:4px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.tts-seg-item:hover{background:' + CFG.accentSoft + ';color:' + CFG.accentDeep + ';}',
      '.tts-seg-item.current{background:' + CFG.accentSoft + ';color:' + CFG.accentDeep + ';font-weight:600;}',
      '@media(max-width:480px){.tts-panel{width:calc(100vw - 40px);}.tts-fab{right:12px;bottom:12px;}}'
    ].join('\n');
    document.head.appendChild(style);

    // 容器
    var wrap = el('div', 'tts-fab');
    var panel = el('div', 'tts-panel');
    panel.style.display = 'none';

    // 头部
    var head = el('div', 'tts-panel-head');
    head.appendChild(el('div', 'tts-title', '🔊 语音播报'));
    var closeBtn = el('button', 'tts-close', '×');
    closeBtn.title = '收起';
    head.appendChild(closeBtn);
    panel.appendChild(head);

    // 主体
    var body = el('div', 'tts-panel-body');

    // 进度
    var progRow = el('div', 'tts-progress-row');
    var progText = el('span', '', '准备就绪');
    var progPct = el('span', '', '0%');
    progRow.appendChild(progText);
    progRow.appendChild(progPct);
    body.appendChild(progRow);

    var progBar = el('div', 'tts-progress-bar');
    var progFill = el('div', 'tts-progress-fill');
    progFill.style.width = '0%';
    progBar.appendChild(progFill);
    body.appendChild(progBar);

    // 控制按钮
    var ctrl = el('div', 'tts-controls');
    var prevBtn = el('button', 'tts-btn', '⏮');
    prevBtn.title = '上一段';
    var playBtn = el('button', 'tts-btn tts-play', '▶');
    playBtn.title = '播放/暂停';
    var stopBtn = el('button', 'tts-btn', '⏹');
    stopBtn.title = '停止';
    var nextBtn = el('button', 'tts-btn', '⏭');
    nextBtn.title = '下一段';
    ctrl.appendChild(prevBtn);
    ctrl.appendChild(playBtn);
    ctrl.appendChild(stopBtn);
    ctrl.appendChild(nextBtn);
    body.appendChild(ctrl);

    // 设置：语速
    var rateRow = el('div', 'tts-setting-row');
    rateRow.appendChild(el('label', '', '语速'));
    var rateBtns = el('div', 'tts-rate-btns');
    CFG.rateSteps.forEach(function (r) {
      var b = el('button', 'tts-rate-btn' + (r === player.rate ? ' active' : ''), r + 'x');
      b.dataset.rate = r;
      b.addEventListener('click', function () {
        player.setRate(parseFloat(r));
        $$('.tts-rate-btn', rateBtns).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        pref.rate = r; savePref(pref);
      });
      rateBtns.appendChild(b);
    });
    rateRow.appendChild(rateBtns);
    body.appendChild(rateRow);

    // 设置：音色
    var voiceRow = el('div', 'tts-setting-row');
    voiceRow.appendChild(el('label', '', '音色'));
    var voiceSel = el('select');
    voiceSel.style.flex = '1';
    voiceRow.appendChild(voiceSel);
    body.appendChild(voiceRow);

    // 段落列表
    var segList = el('div', 'tts-seg-list');
    segList.style.display = 'none';
    body.appendChild(segList);

    panel.appendChild(body);
    wrap.appendChild(panel);

    // 浮动按钮
    var fab = el('button', 'tts-fab-btn', '🎧');
    fab.title = '语音播报全文';
    wrap.appendChild(fab);

    document.body.appendChild(wrap);

    /* ---- 事件绑定 ---- */
    var panelOpen = false;
    function togglePanel() {
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? 'block' : 'none';
      if (panelOpen) renderSegList();
    }
    fab.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', togglePanel);

    playBtn.addEventListener('click', function () {
      player.toggle();
    });
    stopBtn.addEventListener('click', function () { player.stop(); player.idx = 0; updateUI(); });
    prevBtn.addEventListener('click', function () { player.prev(); });
    nextBtn.addEventListener('click', function () { player.next(); });

    // 键盘快捷键：空格
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !e.target.matches('input,textarea,select')) {
        e.preventDefault();
        player.toggle();
      }
    });

    /* ---- 状态更新 ---- */
    function updateUI() {
      var total = player.segs.length;
      var cur = Math.min(player.idx + 1, total);
      var pct = total ? Math.round((cur / total) * 100) : 0;
      progText.textContent = player.playing ? ('第 ' + cur + ' / ' + total + ' 段') : ('共 ' + total + ' 段');
      progPct.textContent = pct + '%';
      progFill.style.width = pct + '%';
      playBtn.innerHTML = (player.playing && !player.paused) ? '⏸' : '▶';
      fab.classList.toggle('playing', player.playing && !player.paused);
      prevBtn.disabled = player.idx === 0;
      nextBtn.disabled = player.idx >= total - 1;
      // 段落列表高亮
      $$('.tts-seg-item', segList).forEach(function (item, i) {
        item.classList.toggle('current', i === player.idx);
      });
    }

    function renderSegList() {
      segList.innerHTML = '';
      player.segs.forEach(function (seg, i) {
        var item = el('div', 'tts-seg-item', (i + 1) + '. ' + seg.text);
        item.addEventListener('click', function () { player.jumpTo(i); if (!player.playing) player.play(); });
        segList.appendChild(item);
      });
      segList.style.display = 'block';
      updateUI();
    }

    player.on('state', updateUI);
    player.on('progress', updateUI);
    player.on('end', function () {
      player.idx = 0;
      updateUI();
    });

    /* ---- 音色填充 ---- */
    function fillVoices() {
      var list = getChineseVoices();
      voiceSel.innerHTML = '';
      if (!list.length) {
        var opt = el('option', '', '系统默认音色');
        opt.value = '';
        voiceSel.appendChild(opt);
        voiceSel.disabled = true;
        return;
      }
      voiceSel.disabled = false;
      list.forEach(function (v) {
        var opt = el('option', '', v.name + (v.localService ? ' (本地)' : ' (在线)'));
        opt.value = v.name;
        voiceSel.appendChild(opt);
      });
      // 恢复偏好
      var chosen = pickBestVoice(pref.voice);
      if (chosen) {
        voiceSel.value = chosen.name;
        player.setVoice(chosen);
      }
    }

    voiceSel.addEventListener('change', function () {
      var name = voiceSel.value;
      var v = voiceCache.filter(function (x) { return x.name === name; })[0] || null;
      player.setVoice(v);
      pref.voice = name; savePref(pref);
    });

    ensureVoices(fillVoices);
    updateUI();

    return { wrap: wrap, player: player };
  }

  /* ============ 初始化 ============ */
  function init() {
    // 仅在日报/雷达内容页启用
    var isContentPage = $('.page-head') && ($$('.event-card').length > 0 || $$('.dsec').length > 0);
    if (!isContentPage) return;
    if (!('speechSynthesis' in window)) return;

    var pref = loadPref();
    var segments = extractSegments();
    if (!segments.length) return;

    var player = new Player(segments);
    if (pref.rate) player.rate = pref.rate;

    buildUI(player, pref);

    // 页面卸载时停止
    window.addEventListener('beforeunload', function () {
      window.speechSynthesis.cancel();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
