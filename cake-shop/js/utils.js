/* 공통 도구 모음 (날짜, 금액, 화면 그리기 도우미) */
window.U = (function () {

  /* ---------- 날짜 ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }

  // Date -> "2026-07-27"
  function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  // "2026-07-27" -> Date (시간은 00:00, 로컬 기준)
  function parseYmd(s) {
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function today() { return ymd(new Date()); }
  // 날짜 문자열에 일수 더하기 ("2026-07-27", 1) -> "2026-07-28"
  function addDays(s, n) {
    var d = parseYmd(s); if (!d) return '';
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  // "2026-07-27" -> "7월 27일 (월)"
  function korDate(s) {
    var d = parseYmd(s); if (!d) return '';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DOW[d.getDay()] + ')';
  }
  // "2026-07-27" -> "2026년 7월 27일 (월)"
  function korDateFull(s) {
    var d = parseYmd(s); if (!d) return '';
    return d.getFullYear() + '년 ' + korDate(s);
  }
  // "2026-07" 형태의 이번 달
  function thisMonth() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  // "2026-07" 을 n개월 이동
  function shiftMonth(m, n) {
    var p = m.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function monthTitle(m) { var p = m.split('-'); return +p[0] + '년 ' + (+p[1]) + '월'; }
  // 해당 달의 마지막 날짜 (28~31)
  function lastDayOfMonth(m) { var p = m.split('-'); return new Date(+p[0], +p[1], 0).getDate(); }
  // 두 날짜 사이 일수 (b - a)
  function diffDays(a, b) {
    var da = parseYmd(a), db = parseYmd(b);
    if (!da || !db) return 0;
    return Math.round((db - da) / 86400000);
  }

  /* ---------- 금액/숫자 ---------- */
  function won(n) {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString('ko-KR') + '원';
  }
  function num(n) { return (Math.round(Number(n) || 0)).toLocaleString('ko-KR'); }
  // "35,000원" / "35000" -> 35000
  function toNum(v) {
    if (v === null || v === undefined) return 0;
    var s = String(v).replace(/[^0-9.\-]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  // 전화번호 정리: 01012345678 -> 010-1234-5678
  function phone(p) {
    var d = String(p || '').replace(/[^0-9]/g, '');
    if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    return p || '';
  }
  function phoneDigits(p) { return String(p || '').replace(/[^0-9]/g, ''); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- 화면 도우미 ---------- */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function modal(title, html, onOpen) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
    if (onOpen) onOpen($('#modalBody'));
  }
  function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }

  function confirmBox(msg) { return window.confirm(msg); }

  // 표를 CSV 파일로 내려받기 (엑셀에서 열림)
  function downloadCsv(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c === null || c === undefined ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
    // 엑셀 한글 깨짐 방지용 BOM
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), filename);
  }
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast('복사했어요'); })
        .catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
    return Promise.resolve();
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('복사했어요'); } catch (e) { toast('복사 실패 - 직접 선택해 주세요'); }
    ta.remove();
  }

  return {
    ymd: ymd, parseYmd: parseYmd, today: today, addDays: addDays, korDate: korDate,
    korDateFull: korDateFull, thisMonth: thisMonth, shiftMonth: shiftMonth,
    monthTitle: monthTitle, lastDayOfMonth: lastDayOfMonth, diffDays: diffDays, DOW: DOW, pad: pad,
    won: won, num: num, toNum: toNum, phone: phone, phoneDigits: phoneDigits, uid: uid,
    esc: esc, $: $, $$: $$, toast: toast, modal: modal, closeModal: closeModal,
    confirmBox: confirmBox, downloadCsv: downloadCsv, downloadBlob: downloadBlob, copyText: copyText
  };
})();
