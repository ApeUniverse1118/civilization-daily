/*!
 * Civilization Radar - Text to Speech Player v2
 * 主引擎：Edge TTS 在线神经语音（晓晓/云希等高质量音色）
 * 降级：Web Speech API（浏览器原生）
 */
(function () {
  'use strict';

  var CFG = {
    accent: '#8a6228',
    accentDeep: '#5f4319',
    accentSoft: '#efe5cf',
    maxSegChars: 200,
    defaultRate: 1.0,
    rateSteps: [0.75, 0.85, 1.0, 1.1, 1.25, 1.5],
    storageKey: 'civradar_tts_pref',
    edgeEndpoint: 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1',
    trustedToken: '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
  };

  var EDGE_VOICES = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 · 温暖女声（推荐）' },
    { id: 'zh-CN-YunxiNeural', name: '云希 · 新闻男声' },
    { id: 'zh-CN-YunyangNeural', name: '云扬 · 专业男声' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊 · 活泼女声' },
    { id: 'zh-CN-XiaohanNeural', name: '晓涵 · 温柔女声' },
    { id: 'zh-CN-YunjianNeural', name: '云健 · 沉稳男声' },
    { id: 'zh-CN-XiaomoNeural', name: '晓墨 · 知性女声' },
    { id: 'zh-CN-YunyeNeural', name: '云野 · 自然男声' }
  ];

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function trim(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function uid() { return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }
  function loadPref() { try { return JSON.parse(localStorage.getItem(CFG.storageKey)) || {}; } catch (e) { return {}; } }
  function savePref(p) { try { localStorage.setItem(CFG.storageKey, JSON.stringify(p)); } catch (e) {} }
  function escapeXml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ============ Edge TTS 引擎 ============ */
  function EdgeTTS() {
    this.available = false;
    this.testing = false;
  }

  EdgeTTS.prototype._token = async function () {
    var now = Date.now();
    var rounded = Math.floor(now / 600000) * 600000;
    var ft = Math.floor(rounded * 10000) + 116444736000000000;
    var str = ft.toString() + CFG.trustedToken;
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('').toUpperCase();
  };

  EdgeTTS.prototype.testConnection = function () {
    var self = this;
    return new Promise(function (resolve) {
      if (self.available) { resolve(true); return; }
      if (self.testing) { resolve(false); return; }
      self.testing = true;
      self._token().then(function (token) {
        var url = CFG.edgeEndpoint + '?TrustedClientToken=' + CFG.trustedToken +
          '&Sec-MS-GEC=' + token +
          '&Sec-MS-GEC-Version=1-130.0.2849.68' +
          '&ConnectionId=' + uid();
        var ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        var timer = setTimeout(function () { try { ws.close(); } catch (e) {} self.testing = false; resolve(false); }, 8000);
        ws.onopen = function () {
          clearTimeout(timer);
          self.available = true; self.testing = false;
          try { ws.close(); } catch (e) {}
          resolve(true);
        };
        ws.onerror = function () { clearTimeout(timer); self.available = false; self.testing = false; resolve(false); };
        ws.onclose = function () { clearTimeout(timer); self.testing = false; resolve(self.available); };
      }).catch(function () { self.testing = false; resolve(false); });
    });
  };

  EdgeTTS.prototype.synthesize = function (text, voiceId, rate) {
    var self = this;
    return new Promise(function (resolve, reject) {
      self._token().then(function (token) {
        var connId = uid();
        var url = CFG.edgeEndpoint + '?TrustedClientToken=' + CFG.trustedToken +
          '&Sec-MS-GEC=' + token +
          '&Sec-MS-GEC-Version=1-130.0.2849.68' +
          '&ConnectionId=' + connId;
        var ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        var chunks = [];
        var settled = false;
        var ratePct = Math.round((rate - 1.0) * 100);
        var rateStr = (ratePct >= 0 ? '+' : '') + ratePct + '%';

        function cleanup() { try { ws.close(); } catch (e) {} }
        function fail(err) { if (!settled) { settled = true; cleanup(); reject(err); } }
        var timeout = setTimeout(function () { fail(new Error('Edge TTS timeout')); }, 15000);

        ws.onopen = function () {
          var config = 'X-Timestamp: ' + new Date().toUTCString() + '\r\n' +
            'Content-Type: application/json; charset=utf-8\r\n' +
            'Path: speech.config\r\n\r\n' +
            JSON.stringify({ context: { synthesis: { audio: {
              metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false, outputDuration: '1' },
              outputformat: 'audio-24khz-48kbitrate-mono-mp3'
            }, language: { autoDetection: false } } } });
          ws.send(config);

          var ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>" +
            "<voice name='" + voiceId + "'>" +
            "<prosody pitch='+0Hz' rate='" + rateStr + "' volume='+0%'>" +
            escapeXml(text) +
            "</prosody></voice></speak>";
          var ssmlMsg = 'X-RequestId: ' + uid() + '\r\n' +
            'Content-Type: application/ssml+xml\r\n' +
            'X-Timestamp: ' + new Date().toUTCString() + '\r\n' +
            'Path: ssml\r\n\r\n' + ssml;
          ws.send(ssmlMsg);
        };

        ws.onmessage = function (ev) {
          if (typeof ev.data === 'string') {
            if (ev.data.indexOf('Path:turn.end') >= 0) {
              clearTimeout(timeout); settled = true; cleanup();
              if (chunks.length) resolve(new Blob(chunks, { type: 'audio/mpeg' }));
              else reject(new Error('No audio data'));
            }
          } else {
            if (ev.data.byteLength > 2) chunks.push(ev.data.slice(2));
          }
        };

        ws.onerror = function () { clearTimeout(timeout); fail(new Error('WebSocket error')); };
        ws.onclose = function () {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            if (chunks.length) resolve(new Blob(chunks, { type: 'audio/mpeg' }));
            else reject(new Error('Connection closed'));
          }
        };
      }).catch(reject);
    });
  };

  /* ============ 文本提取 ============ */
  function extractSegments() {
    var segs = [];
    function push(text, element) {
      text = trim(text);
      if (!text) return;
      if (text.length > CFG.maxSegChars) {
        var parts = text.match(/[^。！？!?]+[。！？!?]?/g) || [text];
        var buf = '';
        parts.forEach(function (p) {
          if ((buf + p).length > CFG.maxSegChars && buf) { segs.push({ text: buf, element: element }); buf = p; }
          else buf += p;
        });
        if (buf) segs.push({ text: buf, element: element });
      } else segs.push({ text: text, element: element });
    }

    var h1 = $('.page-head h1');
    if (h1) push('文明进程日报。' + trim(h1.textContent), h1);
    var obs = $('.obs-box');
    if (obs) {
      var obsTitle = $('.obs-title, .obs-box h3, .obs-box h2', obs);
      if (obsTitle) push('今日核心判断。' + trim(obsTitle.textContent), obs);
      $$('.obs-box p, .obs-box .obs-content', obs).forEach(function (p) { push(trim(p.textContent), p); });
    }
    $$('.dsec').forEach(function (sec) {
      var secTitle = $('.dsec-title', sec);
      if (secTitle) push(trim(secTitle.textContent).replace(/\s*\d+\s*条\s*$/, ''), secTitle);
      $$('.event-card', sec).forEach(function (card) {
        var h3 = $('h3', card);
        if (h3) push(trim(h3.textContent), h3);
        var tnote = $('.ev-tnote', card);
        if (tnote) push(trim(tnote.textContent).replace(/^⏱\s*时间说明[：:]?\s*/, ''), tnote);
        $$('.ev-blk', card).forEach(function (blk) {
          var lb = $('.lb', blk), p = $('p', blk);
          var label = lb ? trim(lb.textContent) : '';
          var content = p ? trim(p.textContent) : trim(blk.textContent);
          if (label && content) push(label + '。' + content, blk);
          else if (content) push(content, blk);
        });
      });
    });
    var st = $('.score-table');
    if (st) {
      var rows = $$('tbody tr', st);
      if (rows.length) {
        var summary = '评分汇总。';
        rows.forEach(function (r) {
          var tds = $$('td', r);
          if (tds.length >= 2) summary += trim(tds[0].textContent) + '，' + trim(tds[1].textContent) + '分。';
        });
        push(summary, st);
      }
    }
    $$('.chk-block').forEach(function (chk) {
      var chkTitle = $('h3, h4, .chk-title', chk);
      if (chkTitle) push(trim(chkTitle.textContent), chkTitle);
      $$('.chk-item, .chk-block li, .chk-block p', chk).forEach(function (item) {
        push(trim(item.textContent).replace(/^[☑✅■□▪•\-\d\.]+\s*/, ''), item);
      });
    });
    return segs;
  }

  /* ============ Web Speech 降级 ============ */
  function voiceScore(v) {
    var n = (v.name || '').toLowerCase(); var s = 0;
    if (/online|natural|neural/.test(n)) s += 10;
    if (/xiaoxiao|xiaoyi|xiaohan/.test(n)) s += 5;
    if (/yunxi|yunyang|yunjian/.test(n)) s += 4;
    if (v.localService) s += 1;
    return s;
  }
  function pickWebVoice() {
    try {
      var vs = window.speechSynthesis.getVoices().filter(function (v) { return (v.lang || '').toLowerCase().indexOf('zh') === 0; });
      vs.sort(function (a, b) { return voiceScore(b) - voiceScore(a); });
      return vs[0] || null;
    } catch (e) { return null; }
  }

  /* ============ 播放器 ============ */
  function Player(segments, edgeEngine) {
    this.segs = segments; this.idx = 0; this.playing = false; this.paused = false;
    this.rate = 1.0; this.edgeEngine = edgeEngine;
    this.edgeVoice = 'zh-CN-XiaoxiaoNeural';
    this.audio = null; this.edgeMode = false; this.currentUrl = null;
    this.listeners = {}; this.highlightCls = 'tts-highlight';
  }
  Player.prototype.on = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
  Player.prototype.emit = function (ev, d) { (this.listeners[ev] || []).forEach(function (fn) { fn(d); }); };
  Player.prototype._clearHL = function () { $$('.' + this.highlightCls).forEach(function (e) { e.classList.remove(this.highlightCls); }, this); };
  Player.prototype._hl = function (el) {
    this._clearHL();
    if (el && el.classList) { el.classList.add(this.highlightCls); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };
  Player.prototype._stopAudio = function () {
    if (this.audio) {
      this.audio.pause(); this.audio.currentTime = 0;
      if (this.currentUrl) { URL.revokeObjectURL(this.currentUrl); this.currentUrl = null; }
      this.audio = null;
    }
  };
  Player.prototype._playEdgeSeg = function () {
    var self = this;
    if (!this.playing) return;
    if (this.idx >= this.segs.length) { this.stop(); this.emit('end'); return; }
    var seg = this.segs[this.idx];
    this._hl(seg.element);
    this.emit('progress', { idx: this.idx, total: this.segs.length });
    this.edgeEngine.synthesize(seg.text, this.edgeVoice, this.rate).then(function (blob) {
      if (!self.playing) return;
      if (self.currentUrl) URL.revokeObjectURL(self.currentUrl);
      self.currentUrl = URL.createObjectURL(blob);
      self.audio = new Audio(self.currentUrl);
      self.audio.onended = function () { if (self.playing) { self.idx++; self._playEdgeSeg(); } };
      self.audio.onerror = function () { self._playWebSeg(); };
      self.audio.play().catch(function () { self._playWebSeg(); });
    }).catch(function () { self.edgeMode = false; self._playWebSeg(); });
  };
  Player.prototype._playWebSeg = function () {
    var self = this;
    if (!this.playing) return;
    if (this.idx >= this.segs.length) { this.stop(); this.emit('end'); return; }
    var seg = this.segs[this.idx];
    this._hl(seg.element);
    this.emit('progress', { idx: this.idx, total: this.segs.length });
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(seg.text);
    u.lang = 'zh-CN'; u.rate = this.rate; u.pitch = 1.0;
    var v = pickWebVoice(); if (v) u.voice = v;
    u.onend = function () { if (self.playing) { self.idx++; self._playWebSeg(); } };
    u.onerror = function (e) { if (e.error === 'interrupted' || e.error === 'canceled') return; if (self.playing) { self.idx++; self._playWebSeg(); } };
    window.speechSynthesis.speak(u);
  };
  Player.prototype.play = function () {
    if (!this.segs.length) return;
    if (this.paused) {
      if (this.edgeMode && this.audio) this.audio.play();
      else if ('speechSynthesis' in window) window.speechSynthesis.resume();
      this.paused = false; this.playing = true; this.emit('state', 'playing'); return;
    }
    this.playing = true; this.paused = false;
    if (this.idx >= this.segs.length) this.idx = 0;
    this._stopAudio();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.edgeMode ? this._playEdgeSeg() : this._playWebSeg();
    this.emit('state', 'playing');
  };
  Player.prototype.pause = function () {
    if (!this.playing) return;
    if (this.edgeMode && this.audio) this.audio.pause();
    else if ('speechSynthesis' in window) window.speechSynthesis.pause();
    this.paused = true; this.emit('state', 'paused');
  };
  Player.prototype.toggle = function () { if (this.playing && !this.paused) this.pause(); else this.play(); };
  Player.prototype.stop = function () {
    this.playing = false; this.paused = false;
    this._stopAudio();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this._clearHL(); this.emit('state', 'stopped');
  };
  Player.prototype.next = function () {
    if (this.idx < this.segs.length - 1) {
      this.idx++;
      if (this.playing) { this._stopAudio(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); this.edgeMode ? this._playEdgeSeg() : this._playWebSeg(); }
      else this.emit('progress', { idx: this.idx, total: this.segs.length });
    }
  };
  Player.prototype.prev = function () {
    if (this.idx > 0) {
      this.idx--;
      if (this.playing) { this._stopAudio(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); this.edgeMode ? this._playEdgeSeg() : this._playWebSeg(); }
      else this.emit('progress', { idx: this.idx, total: this.segs.length });
    }
  };
  Player.prototype.setRate = function (r) {
    this.rate = r;
    if (this.playing && !this.paused) {
      this._stopAudio(); if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      this.edgeMode ? this._playEdgeSeg() : this._playWebSeg();
    }
  };
  Player.prototype.setEdgeVoice = function (vid) {
    this.edgeVoice = vid;
    if (this.playing && !this.paused && this.edgeMode) { this._stopAudio(); this._playEdgeSeg(); }
  };

  /* ============ UI ============ */
  function buildUI(player, edgeEngine, pref) {
    var style = el('style');
    style.textContent = [
      '.tts-fab{position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:10px;}',
      '.tts-fab-btn{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,'+CFG.accent+','+CFG.accentDeep+');color:#fff;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(138,98,40,.4);display:flex;align-items:center;justify-content:center;font-size:22px;transition:transform .2s;}',
      '.tts-fab-btn:hover{transform:scale(1.08);}',
      '.tts-fab-btn.playing{animation:tts-pulse 1.5s infinite;}',
      '@keyframes tts-pulse{0%,100%{box-shadow:0 0 0 0 rgba(138,98,40,.5);}50%{box-shadow:0 0 0 12px rgba(138,98,40,0);}}',
      '.tts-panel{width:330px;background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.15);overflow:hidden;border:1px solid '+CFG.accentSoft+';}',
      '.tts-panel-head{background:linear-gradient(135deg,'+CFG.accent+','+CFG.accentDeep+');color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}',
      '.tts-panel-head .tts-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;}',
      '.tts-engine-badge{font-size:10px;background:rgba(255,255,255,.25);padding:2px 8px;border-radius:10px;margin-left:6px;}',
      '.tts-close{background:none;border:none;color:#fff;cursor:pointer;font-size:18px;opacity:.8;padding:2px 6px;}',
      '.tts-panel-body{padding:14px 16px;}',
      '.tts-progress-row{display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:6px;}',
      '.tts-progress-bar{height:4px;background:'+CFG.accentSoft+';border-radius:2px;overflow:hidden;margin-bottom:14px;}',
      '.tts-progress-fill{height:100%;background:linear-gradient(90deg,'+CFG.accent+','+CFG.accentDeep+');transition:width .3s;}',
      '.tts-controls{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;}',
      '.tts-btn{width:38px;height:38px;border-radius:50%;border:1px solid '+CFG.accentSoft+';background:#fff;color:'+CFG.accentDeep+';cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;}',
      '.tts-btn:hover{background:'+CFG.accentSoft+';}',
      '.tts-btn.tts-play{width:48px;height:48px;background:linear-gradient(135deg,'+CFG.accent+','+CFG.accentDeep+');color:#fff;border:none;font-size:18px;}',
      '.tts-btn:disabled{opacity:.35;cursor:not-allowed;}',
      '.tts-setting-row{display:flex;align-items:center;gap:10px;font-size:12px;color:#555;margin-bottom:10px;}',
      '.tts-setting-row label{min-width:36px;flex-shrink:0;}',
      '.tts-setting-row select{flex:1;padding:5px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;background:#fff;color:#333;}',
      '.tts-rate-btns{display:flex;gap:4px;flex:1;}',
      '.tts-rate-btn{flex:1;padding:4px 0;border:1px solid '+CFG.accentSoft+';background:#fff;color:'+CFG.accentDeep+';border-radius:5px;cursor:pointer;font-size:11px;}',
      '.tts-rate-btn.active{background:'+CFG.accent+';color:#fff;border-color:'+CFG.accent+';}',
      '.tts-highlight{background:linear-gradient(transparent 60%,'+CFG.accentSoft+' 60%);border-radius:3px;}',
      '.tts-loading{text-align:center;font-size:12px;padding:8px;line-height:1.5;}',
      '@media(max-width:480px){.tts-panel{width:calc(100vw - 40px);}}'
    ].join('\n');
    document.head.appendChild(style);

    var wrap = el('div', 'tts-fab');
    var panel = el('div', 'tts-panel');
    panel.style.display = 'none';
    var head = el('div', 'tts-panel-head');
    var titleWrap = el('div', 'tts-title');
    titleWrap.appendChild(document.createTextNode('🔊 语音播报'));
    var badge = el('span', 'tts-engine-badge', '检测中...');
    titleWrap.appendChild(badge);
    head.appendChild(titleWrap);
    var closeBtn = el('button', 'tts-close', '×');
    head.appendChild(closeBtn);
    panel.appendChild(head);

    var body = el('div', 'tts-panel-body');
    var progRow = el('div', 'tts-progress-row');
    var progText = el('span', '', '准备就绪');
    var progPct = el('span', '', '0%');
    progRow.appendChild(progText); progRow.appendChild(progPct);
    body.appendChild(progRow);
    var progBar = el('div', 'tts-progress-bar');
    var progFill = el('div', 'tts-progress-fill');
    progFill.style.width = '0%';
    progBar.appendChild(progFill);
    body.appendChild(progBar);

    var ctrl = el('div', 'tts-controls');
    var prevBtn = el('button', 'tts-btn', '⏮'); prevBtn.title = '上一段';
    var playBtn = el('button', 'tts-btn tts-play', '▶'); playBtn.title = '播放/暂停';
    var stopBtn = el('button', 'tts-btn', '⏹'); stopBtn.title = '停止';
    var nextBtn = el('button', 'tts-btn', '⏭'); nextBtn.title = '下一段';
    ctrl.appendChild(prevBtn); ctrl.appendChild(playBtn); ctrl.appendChild(stopBtn); ctrl.appendChild(nextBtn);
    body.appendChild(ctrl);

    var engineStatus = el('div', 'tts-loading', '正在连接高质量语音引擎...');
    engineStatus.style.color = CFG.accent;
    body.appendChild(engineStatus);

    var voiceRow = el('div', 'tts-setting-row');
    voiceRow.appendChild(el('label', '', '音色'));
    var voiceSel = el('select');
    voiceSel.style.flex = '1';
    EDGE_VOICES.forEach(function (v) {
      var opt = el('option', '', v.name);
      opt.value = v.id;
      if (v.id === player.edgeVoice) opt.selected = true;
      voiceSel.appendChild(opt);
    });
    voiceRow.appendChild(voiceSel);
    body.appendChild(voiceRow);

    var rateRow = el('div', 'tts-setting-row');
    rateRow.appendChild(el('label', '', '语速'));
    var rateBtns = el('div', 'tts-rate-btns');
    CFG.rateSteps.forEach(function (r) {
      var b = el('button', 'tts-rate-btn' + (r === player.rate ? ' active' : ''), r + 'x');
      b.addEventListener('click', function () {
        player.setRate(r);
        $$('.tts-rate-btn', rateBtns).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        pref.rate = r; savePref(pref);
      });
      rateBtns.appendChild(b);
    });
    rateRow.appendChild(rateBtns);
    body.appendChild(rateRow);

    panel.appendChild(body);
    wrap.appendChild(panel);
    var fab = el('button', 'tts-fab-btn', '🎧');
    fab.title = '语音播报全文';
    wrap.appendChild(fab);
    document.body.appendChild(wrap);

    voiceSel.addEventListener('change', function () { player.setEdgeVoice(voiceSel.value); pref.edgeVoice = voiceSel.value; savePref(pref); });

    var panelOpen = false;
    function togglePanel() { panelOpen = !panelOpen; panel.style.display = panelOpen ? 'block' : 'none'; }
    fab.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', togglePanel);
    playBtn.addEventListener('click', function () { player.toggle(); });
    stopBtn.addEventListener('click', function () { player.stop(); player.idx = 0; updateUI(); });
    prevBtn.addEventListener('click', function () { player.prev(); });
    nextBtn.addEventListener('click', function () { player.next(); });
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !e.target.matches('input,textarea,select')) { e.preventDefault(); player.toggle(); }
    });

    function updateUI() {
      var total = player.segs.length;
      var cur = Math.min(player.idx + 1, total);
      var pct = total ? Math.round(cur / total * 100) : 0;
      progText.textContent = player.playing ? ('第 ' + cur + ' / ' + total + ' 段') : ('共 ' + total + ' 段');
      progPct.textContent = pct + '%';
      progFill.style.width = pct + '%';
      playBtn.innerHTML = (player.playing && !player.paused) ? '⏸' : '▶';
      fab.classList.toggle('playing', player.playing && !player.paused);
      prevBtn.disabled = player.idx === 0;
      nextBtn.disabled = player.idx >= total - 1;
    }
    player.on('state', updateUI);
    player.on('progress', updateUI);
    player.on('end', function () { player.idx = 0; updateUI(); });

    edgeEngine.testConnection().then(function (ok) {
      if (ok) {
        player.edgeMode = true;
        badge.textContent = '神经语音';
        badge.style.background = 'rgba(255,255,255,.35)';
        engineStatus.textContent = '✅ 高质量神经语音已就绪';
        engineStatus.style.color = '#4a7c3f';
      } else {
        player.edgeMode = false;
        badge.textContent = '浏览器语音';
        engineStatus.textContent = '⚠ 高质量语音暂不可用，已降级浏览器内置语音';
        engineStatus.style.color = '#b8860b';
      }
    });
    updateUI();
  }

  function init() {
    var isContent = $('.page-head') && ($$('.event-card').length > 0 || $$('.dsec').length > 0);
    if (!isContent) return;
    var pref = loadPref();
    var segments = extractSegments();
    if (!segments.length) return;
    var edgeEngine = new EdgeTTS();
    var player = new Player(segments, edgeEngine);
    if (pref.rate) player.rate = pref.rate;
    if (pref.edgeVoice) player.edgeVoice = pref.edgeVoice;
    buildUI(player, edgeEngine, pref);
    window.addEventListener('beforeunload', function () {
      player.stop();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
