/* ============================================================
   全球文明进程重大事件日报 · Civilization Daily
   Vanilla JavaScript · GitHub Pages 兼容 · 无外部依赖
   ============================================================ */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {

    /* ---------- 移动端导航切换 ---------- */
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".main-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", nav.classList.contains("open") ? "true" : "false");
      });
      document.addEventListener("click", function (e) {
        if (nav.classList.contains("open") && !nav.contains(e.target) && e.target !== toggle) {
          nav.classList.remove("open");
        }
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    /* ---------- 时间轴「最新」标记 ---------- */
    var tl = document.querySelector(".timeline");
    if (tl) {
      var first = tl.querySelector(".tl-item");
      if (first) { first.classList.add("is-latest"); }
    }

    /* ---------- 表格自动加 wrap（防御） ---------- */
    Array.prototype.forEach.call(document.querySelectorAll("table.stbl"), function (tbl) {
      if (tbl.parentNode && !tbl.parentNode.classList.contains("tbl-wrap")) {
        var w = document.createElement("div");
        w.className = "tbl-wrap";
        tbl.parentNode.insertBefore(w, tbl);
        w.appendChild(tbl);
      }
    });

  });
})();
