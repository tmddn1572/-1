(() => {
  const REPEAT_LABEL = { none: '', daily: '매일 반복', weekly: '매주 반복', monthly: '매월 반복' };

  let allSchedules = [];
  let viewYear, viewMonth; // viewMonth: 0-11
  let selectedDate = Utils.todayStr();
  let editingId = null;

  const monthLabel = document.getElementById('month-label');
  const calGrid = document.getElementById('cal-grid');
  const dayPanelTitle = document.getElementById('day-panel-title');
  const dayList = document.getElementById('day-list');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('schedule-form');
  const deleteBtn = document.getElementById('delete-btn');
  const repeatSeg = document.getElementById('repeat-segmented');
  const repeatHint = document.getElementById('repeat-hint');

  function occursOn(schedule, dateStr) {
    if (dateStr < schedule.date) return false;
    if (schedule.repeat === 'none' || !schedule.repeat) return dateStr === schedule.date;
    const d = Utils.strToDate(dateStr);
    const s = Utils.strToDate(schedule.date);
    if (schedule.repeat === 'daily') return true;
    if (schedule.repeat === 'weekly') return d.getDay() === s.getDay();
    if (schedule.repeat === 'monthly') return d.getDate() === s.getDate();
    return false;
  }

  function schedulesOn(dateStr) {
    return allSchedules
      .filter((s) => occursOn(s, dateStr))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }

  async function loadAll() {
    allSchedules = await DB.getAll('schedules');
  }

  function renderCalendar() {
    monthLabel.textContent = `${viewYear}년 ${viewMonth + 1}월`;
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const todayStr = Utils.todayStr();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
      const dayNum = daysInPrevMonth - startWeekday + 1 + i;
      const d = new Date(viewYear, viewMonth - 1, dayNum);
      cells.push({ dateStr: Utils.dateToStr(d), dayNum, out: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      cells.push({ dateStr: Utils.dateToStr(dt), dayNum: d, out: false });
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const idx = cells.length - (startWeekday + daysInMonth);
      const dt = new Date(viewYear, viewMonth + 1, idx + 1);
      cells.push({ dateStr: Utils.dateToStr(dt), dayNum: dt.getDate(), out: true });
      if (cells.length >= 42) break;
    }

    calGrid.innerHTML = cells.map((c, i) => {
      const weekday = i % 7;
      const classes = ['cal-cell'];
      if (c.out) classes.push('out');
      if (weekday === 0) classes.push('sun');
      if (weekday === 6) classes.push('sat');
      if (c.dateStr === todayStr) classes.push('today');
      if (c.dateStr === selectedDate) classes.push('selected');
      const hasEvent = schedulesOn(c.dateStr).length > 0;
      return `<button type="button" class="${classes.join(' ')}" data-date="${c.dateStr}">
        <span class="cal-cell-num">${c.dayNum}</span>
        ${hasEvent ? '<span class="cal-dot"></span>' : ''}
      </button>`;
    }).join('');

    calGrid.querySelectorAll('.cal-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedDate = btn.dataset.date;
        const d = Utils.strToDate(selectedDate);
        if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) {
          viewYear = d.getFullYear();
          viewMonth = d.getMonth();
        }
        renderCalendar();
        renderDayPanel();
      });
    });
  }

  function renderDayPanel() {
    dayPanelTitle.textContent = Utils.displayDate(selectedDate);
    const items = schedulesOn(selectedDate);
    if (items.length === 0) {
      dayList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗓️</div>이 날은 등록된 일정이 없어요.</div>`;
      return;
    }
    dayList.innerHTML = items.map((s) => `
      <div class="card" data-id="${s.id}">
        <div class="card-top">
          <div class="card-title">${Utils.escapeHtml(s.title)}</div>
          ${s.time ? `<div class="card-time">${Utils.displayTime(s.time)}</div>` : ''}
        </div>
        ${s.memo ? `<div class="card-body">${Utils.escapeHtml(s.memo)}</div>` : ''}
        ${s.repeat && s.repeat !== 'none' ? `<div class="card-tags"><span class="tag-pill">🔁 ${REPEAT_LABEL[s.repeat]}</span></div>` : ''}
      </div>
    `).join('');

    dayList.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('click', () => {
        const s = allSchedules.find((x) => x.id === card.dataset.id);
        if (s) openModal(s);
      });
    });
  }

  function setRepeatValue(value) {
    repeatSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === value));
    repeatHint.hidden = value === 'none';
  }
  function getRepeatValue() {
    return repeatSeg.querySelector('button.active').dataset.value;
  }
  repeatSeg.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => setRepeatValue(b.dataset.value));
  });

  function openModal(schedule) {
    editingId = schedule ? schedule.id : null;
    modalTitle.textContent = schedule ? '일정 수정' : '일정 추가';
    deleteBtn.classList.toggle('hidden', !schedule);
    document.getElementById('f-id').value = schedule ? schedule.id : '';
    document.getElementById('f-title').value = schedule ? schedule.title : '';
    document.getElementById('f-date').value = schedule ? schedule.date : selectedDate;
    document.getElementById('f-time').value = schedule ? (schedule.time || '') : '';
    document.getElementById('f-memo').value = schedule ? (schedule.memo || '') : '';
    setRepeatValue(schedule ? (schedule.repeat || 'none') : 'none');
    modalOverlay.classList.add('open');
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    form.reset();
    editingId = null;
  }

  document.getElementById('add-btn').addEventListener('click', () => openModal(null));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('f-title').value.trim();
    const date = document.getElementById('f-date').value;
    const time = document.getElementById('f-time').value;
    const memo = document.getElementById('f-memo').value.trim();
    const repeat = getRepeatValue();
    if (!title || !date) return;

    const obj = {
      id: editingId || Utils.genId(),
      title, date, time, memo, repeat,
      createdAt: editingId ? (allSchedules.find((s) => s.id === editingId)?.createdAt || Date.now()) : Date.now(),
    };
    await DB.put('schedules', obj);
    await loadAll();
    selectedDate = date;
    const d = Utils.strToDate(date);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderCalendar();
    renderDayPanel();
    closeModal();
    Utils.toast('저장했어요');
  });

  deleteBtn.addEventListener('click', async () => {
    if (!editingId) return;
    if (!confirm('이 일정을 삭제할까요? 반복 일정인 경우 전체 반복 일정이 삭제됩니다.')) return;
    await DB.remove('schedules', editingId);
    await loadAll();
    renderCalendar();
    renderDayPanel();
    closeModal();
    Utils.toast('삭제했어요');
  });

  document.getElementById('prev-month').addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderCalendar();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderCalendar();
  });
  document.getElementById('today-btn').addEventListener('click', () => {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDate = Utils.todayStr();
    renderCalendar();
    renderDayPanel();
  });

  (async function init() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    await loadAll();
    renderCalendar();
    renderDayPanel();
  })();
})();
