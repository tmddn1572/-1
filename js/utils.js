// 공용 유틸리티: 날짜 포맷, id 생성 등
const Utils = (() => {
  function pad2(n) { return String(n).padStart(2, '0'); }

  function genId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function dateToStr(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function todayStr() { return dateToStr(new Date()); }

  // 'YYYY-MM-DD' -> Date (로컬 자정, 타임존 오프셋 문제 방지를 위해 직접 파싱)
  function strToDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const WEEKDAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

  function displayDate(s) {
    const d = strToDate(s);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS_KR[d.getDay()]})`;
  }

  function displayDateShort(s) {
    const d = strToDate(s);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS_KR[d.getDay()]})`;
  }

  function displayTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? '오전' : '오후';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${ampm} ${h12}:${pad2(m)}`;
  }

  function displayDateTime(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${displayTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`)}`;
  }

  function nowLocalInputValue() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('global-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  return {
    pad2, genId, dateToStr, todayStr, strToDate, WEEKDAYS_KR,
    displayDate, displayDateShort, displayTime, displayDateTime,
    nowLocalInputValue, escapeHtml, debounce, toast
  };
})();
