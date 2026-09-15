/* ============================================================
   全球文明进程重大事件日报 · Civilization Daily
   Vanilla JavaScript v2 · GitHub Pages 兼容 · 无外部依赖
   升级：滚动页头状态 / 阅读进度条 / 克制的一次性浮现
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener("DOMContentLoaded", function () {

    /* ---------- 移动端导航切换 ---------- */
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".main-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", function (e) {
        if (nav.classList.contains("open") && !nav.contains(e.target) && e.target !== toggle) {
          nav.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
      /* 点击导航链接后收起 */
      Array.prototype.forEach.call(nav.querySelectorAll("a"), function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    /* ---------- 当前导航高亮 ---------- */
    var path = location.pathname.replace(/\/+$/, "");
    var links = document.querySelectorAll(".main-nav a");
    Array.prototype.forEach.call(links, function (a) {
      var href = a.getAttribute("href") || "";
      if (!href || href.indexOf("#") === 0) { return; }
      var hrefNorm = href.replace(/^\.\//, "").replace(/index\.html$/, "").replace(/\/+$/, "");
      var pathNorm = path.replace(/^.*\/(daily|categories)\//, "$1/");
      var pathRel = path.split("/").pop() || "index.html";
      if (hrefNorm === pathRel || hrefNorm === pathNorm || (hrefNorm === "" && pathRel === "index.html")) {
        a.classList.add("active");
      }
    });

    /* ---------- 页头滚动状态 ---------- */
    var header = document.querySelector(".site-header");
    if (header) {
      var onScrollHeader = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 8);
      };
      window.addEventListener("scroll", onScrollHeader, { passive: true });
      onScrollHeader();
    }

    /* ---------- 阅读进度条 ---------- */
    var progress = document.querySelector(".read-progress");
    if (!progress) {
      progress = document.createElement("div");
      progress.className = "read-progress";
      document.body.appendChild(progress);
    }
    var ticking = false;
    var onScrollProgress = function () {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        progress.style.width = pct.toFixed(2) + "%";
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScrollProgress, { passive: true });
    window.addEventListener("resize", onScrollProgress, { passive: true });
    onScrollProgress();

    /* ---------- 返回顶部 ---------- */
    var backTop = document.querySelector(".backtop");
    if (backTop) {
      var show = function () {
        if (window.scrollY > 480) { backTop.classList.add("show"); }
        else { backTop.classList.remove("show"); }
      };
      window.addEventListener("scroll", show, { passive: true });
      show();
      backTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }

    /* ---------- 时间轴「最新」标记 ---------- */
    var tl = document.querySelector(".timeline");
    if (tl) {
      var first = tl.querySelector(".tl-item");
      if (first) { first.classList.add("is-latest"); }
    }

    /* ---------- 表格自动加 wrap（防御，兼容两种评分表类名） ---------- */
    Array.prototype.forEach.call(
      document.querySelectorAll("table.stbl, table.score-table"),
      function (tbl) {
        if (tbl.parentNode && !tbl.parentNode.classList.contains("tbl-wrap")) {
          var w = document.createElement("div");
          w.className = "tbl-wrap";
          tbl.parentNode.insertBefore(w, tbl);
          w.appendChild(tbl);
        }
      }
    );

    /* ---------- 滚动浮现（克制：仅一次、上移 18px、600ms；系统减弱动效时禁用） ---------- */
    if (!reduceMotion && "IntersectionObserver" in window) {
      var targets = document.querySelectorAll(
        ".daily-card, .cat-card, .tl-item, .archive-item, .event-card, .g-card, .rf, .hist-group, .tlp, .chk-block, .read-nav > a, .related-block, .score-block"
      );
      if (targets.length > 0) {
        document.documentElement.classList.add("js-reveal");
        var io = new IntersectionObserver(function (entries) {
          Array.prototype.forEach.call(entries, function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
        Array.prototype.forEach.call(targets, function (el) {
          el.classList.add("reveal");
          io.observe(el);
        });
      }
    }

  });
})();
