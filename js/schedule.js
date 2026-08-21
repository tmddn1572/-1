(() => {
  const REPEAT_LABEL = { none: '', daily: '매일 반복', weekly: '매주 반복', monthly: '매월 반복' };

  const POINTS_PER_ITEM = 10;

  let allSchedules = [];
  let allChecklistItems = [];
  let allDdays = [];
  let viewYear, viewMonth; // viewMonth: 0-11
  let selectedDate = Utils.todayStr();
  let editingId = null;
  let currentSubtasks = [];
  let editingDdayId = null;
  const expandedChecklistIds = new Set(); // "체크리스트 추가"를 눌러 하위 항목 UI를 펼친 항목의 id

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

  const checklistForm = document.getElementById('checklist-form');
  const checklistInput = document.getElementById('checklist-input');
  const checklistRepeatSelect = document.getElementById('checklist-repeat-select');
  const checklistRepeatHint = document.getElementById('checklist-repeat-hint');
  const checklistList = document.getElementById('checklist-list');
  const dashTodayRatio = document.getElementById('dash-today-ratio');
  const dashTodayScore = document.getElementById('dash-today-score');
  const dashTotalScore = document.getElementById('dash-total-score');
  const dashPerfectDays = document.getElementById('dash-perfect-days');
  const dashStreak = document.getElementById('dash-streak');

  const subtaskToggleBtn = document.getElementById('subtask-toggle-btn');
  const subtaskSection = document.getElementById('subtask-section');

  const ddayScroll = document.getElementById('dday-scroll');
  const ddayAddBtn = document.getElementById('dday-add-btn');
  const ddayModalOverlay = document.getElementById('dday-modal-overlay');
  const ddayModalClose = document.getElementById('dday-modal-close');
  const ddayForm = document.getElementById('dday-form');
  const ddayDeleteBtn = document.getElementById('dday-delete-btn');

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
      const holidayName = holidayNameOn(c.dateStr);
      if (holidayName) classes.push('holiday');
      const hasEvent = schedulesOn(c.dateStr).length > 0;
      return `<button type="button" class="${classes.join(' ')}" data-date="${c.dateStr}">
        <span class="cal-cell-num">${c.dayNum}</span>
        ${holidayName ? `<span class="cal-holiday-label">${Utils.escapeHtml(holidayName)}</span>` : ''}
        ${hasEvent ? '<span class="cal-dot"></span>' : ''}
      </button>`;
    }).join('');

    calGrid.querySelectorAll('.cal-cell').forEach((btn) => {
      btn.addEventListener('click', async () => {
        selectedDate = btn.dataset.date;
        const d = Utils.strToDate(selectedDate);
        if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) {
          viewYear = d.getFullYear();
          viewMonth = d.getMonth();
        }
        renderCalendar();
        renderDayPanel();
        await refreshDayChecklist();
      });
    });
  }

  function renderDayPanel() {
    const holidayName = holidayNameOn(selectedDate);
    dayPanelTitle.innerHTML = holidayName
      ? `${Utils.escapeHtml(Utils.displayDate(selectedDate))} <span class="day-panel-holiday"><svg class="icon" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> ${Utils.escapeHtml(holidayName)}</span>`
      : Utils.escapeHtml(Utils.displayDate(selectedDate));
    const items = schedulesOn(selectedDate);
    if (items.length === 0) {
      dayList.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg class="icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>이 날은 등록된 일정이 없어요.</div>`;
      return;
    }
    dayList.innerHTML = items.map((s) => `
      <div class="card" data-id="${s.id}">
        <div class="card-top">
          <div class="card-title">${Utils.escapeHtml(s.title)}</div>
          ${s.time ? `<div class="card-time">${Utils.displayTime(s.time)}</div>` : ''}
        </div>
        ${s.memo ? `<div class="card-body">${Utils.escapeHtml(s.memo)}</div>` : ''}
        ${s.repeat && s.repeat !== 'none' ? `<div class="card-tags"><span class="tag-pill"><svg class="icon" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ${REPEAT_LABEL[s.repeat]}</span></div>` : ''}
        ${subtaskProgressHtml(s.subtasks)}
      </div>
    `).join('');

    dayList.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('click', () => {
        const s = allSchedules.find((x) => x.id === card.dataset.id);
        if (s) openModal(s);
      });
    });
  }

  // ===== 하위 체크리스트 (일정 · 오늘의 할 일 공용 컴포넌트) =====
  // subtask 객체: { id, text, done, time(선택, null 허용) }
  // 예전에 저장된 { completed } 필드도 읽을 때 done으로 보정해준다.

  function normalizeSubtasks(subtasks) {
    if (!Array.isArray(subtasks)) return [];
    return subtasks.map((t) => ({
      id: t.id || Utils.genId(),
      text: t.text || '',
      done: typeof t.done === 'boolean' ? t.done : !!t.completed,
      time: t.time || null,
    }));
  }

  function subtaskProgressHtml(subtasks) {
    const list = normalizeSubtasks(subtasks);
    if (list.length === 0) return '';
    const total = list.length;
    const done = list.filter((t) => t.done).length;
    const pct = Math.round((done / total) * 100);
    return `
      <div class="card-progress">
        <div class="card-progress-bar"><div class="card-progress-fill ${done === total ? 'complete' : ''}" style="width:${pct}%"></div></div>
        <span class="card-progress-label">${done}/${total} 완료</span>
      </div>`;
  }

  function subtaskListHtml(subtasks) {
    return normalizeSubtasks(subtasks).map((t) => `
      <div class="subtask-item ${t.done ? 'completed' : ''}" data-id="${t.id}">
        <input type="checkbox" class="subtask-checkbox" ${t.done ? 'checked' : ''} aria-label="완료 체크" />
        <div class="subtask-text">${Utils.escapeHtml(t.text)}${t.time ? `<span class="subtask-time">· ${Utils.displayTime(t.time)}</span>` : ''}</div>
        <button type="button" class="subtask-delete" aria-label="삭제"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    `).join('');
  }

  // sectionEl 안의 .subtask-list / .subtask-input / .subtask-time-input / .subtask-add-btn 을 찾아
  // getList/setList로 주입받은 데이터에 대해 체크/삭제/추가를 바인딩한다.
  // 일정 모달(메모리 버퍼, 저장 시 한 번에 반영)과 오늘의 할 일(항목마다 즉시 저장) 양쪽에서 재사용.
  function bindSubtaskSection(sectionEl, { getList, setList, onChange }) {
    const listEl = sectionEl.querySelector('.subtask-list');
    const textInput = sectionEl.querySelector('.subtask-input');
    const timeInput = sectionEl.querySelector('.subtask-time-input');
    const addBtn = sectionEl.querySelector('.subtask-add-btn');

    function paint() {
      listEl.innerHTML = subtaskListHtml(getList());
      listEl.querySelectorAll('.subtask-item').forEach((row) => {
        const id = row.dataset.id;
        row.querySelector('.subtask-checkbox').addEventListener('change', (e) => {
          const list = normalizeSubtasks(getList());
          const t = list.find((x) => x.id === id);
          if (t) t.done = e.target.checked;
          setList(list);
          row.classList.toggle('completed', e.target.checked);
          if (onChange) onChange();
        });
        row.querySelector('.subtask-delete').addEventListener('click', () => {
          setList(normalizeSubtasks(getList()).filter((x) => x.id !== id));
          paint();
          if (onChange) onChange();
        });
      });
    }

    function addFromInputs() {
      const text = textInput.value.trim();
      if (!text) return;
      const list = normalizeSubtasks(getList());
      list.push({ id: Utils.genId(), text, done: false, time: timeInput.value || null });
      setList(list);
      textInput.value = '';
      timeInput.value = '';
      textInput.focus();
      paint();
      if (onChange) onChange();
    }

    addBtn.addEventListener('click', addFromInputs);
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addFromInputs(); }
    });

    paint();
    return { repaint: paint };
  }

  // ----- 일정 모달용 바인딩 -----
  const scheduleSubtasks = bindSubtaskSection(subtaskSection, {
    getList: () => currentSubtasks,
    setList: (arr) => { currentSubtasks = arr; },
  });

  subtaskToggleBtn.addEventListener('click', () => {
    subtaskToggleBtn.classList.add('hidden');
    subtaskSection.classList.remove('hidden');
  });

  // ===== D-day =====

  async function loadDdays() {
    allDdays = await DB.getAll('ddays');
  }

  function ddayDiffDays(dateStr) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((Utils.strToDate(dateStr) - Utils.strToDate(Utils.todayStr())) / msPerDay);
  }

  function ddayLabel(diff) {
    if (diff === 0) return 'D-DAY';
    return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  }

  function sortedDdays() {
    return [...allDdays].sort((a, b) => {
      const da = ddayDiffDays(a.date);
      const db_ = ddayDiffDays(b.date);
      const aPast = da < 0, bPast = db_ < 0;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return aPast ? db_ - da : da - db_;
    });
  }

  function renderDdays() {
    const items = sortedDdays();
    if (items.length === 0) {
      ddayScroll.innerHTML = '<span class="dday-empty">등록된 D-day가 없어요</span>';
      return;
    }
    ddayScroll.innerHTML = items.map((d) => {
      const diff = ddayDiffDays(d.date);
      const classes = ['dday-chip'];
      if (diff === 0) classes.push('today');
      if (diff < 0) classes.push('past');
      return `
        <button type="button" class="${classes.join(' ')}" data-id="${d.id}">
          <span class="dday-chip-value">${ddayLabel(diff)}</span>
          <span class="dday-chip-title">${Utils.escapeHtml(d.title)}</span>
        </button>`;
    }).join('');

    ddayScroll.querySelectorAll('.dday-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const d = allDdays.find((x) => x.id === chip.dataset.id);
        if (d) openDdayModal(d);
      });
    });
  }

  function openDdayModal(dday) {
    editingDdayId = dday ? dday.id : null;
    document.getElementById('dday-modal-title').textContent = dday ? 'D-day 수정' : 'D-day 추가';
    ddayDeleteBtn.classList.toggle('hidden', !dday);
    document.getElementById('f-dday-title').value = dday ? dday.title : '';
    document.getElementById('f-dday-date').value = dday ? dday.date : Utils.todayStr();
    ddayModalOverlay.classList.add('open');
  }

  function closeDdayModal() {
    ddayModalOverlay.classList.remove('open');
    ddayForm.reset();
    editingDdayId = null;
  }

  ddayAddBtn.addEventListener('click', () => openDdayModal(null));
  ddayModalClose.addEventListener('click', closeDdayModal);
  ddayModalOverlay.addEventListener('click', (e) => { if (e.target === ddayModalOverlay) closeDdayModal(); });

  ddayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('f-dday-title').value.trim();
    const date = document.getElementById('f-dday-date').value;
    if (!title || !date) return;

    const existing = editingDdayId ? allDdays.find((d) => d.id === editingDdayId) : null;
    const obj = {
      id: editingDdayId || Utils.genId(),
      title, date,
      createdAt: existing ? existing.createdAt : Date.now(),
    };
    await DB.put('ddays', obj);
    await loadDdays();
    renderDdays();
    closeDdayModal();
    Utils.toast('저장했어요');
  });

  ddayDeleteBtn.addEventListener('click', async () => {
    if (!editingDdayId) return;
    if (!confirm('이 D-day를 삭제할까요?')) return;
    await DB.remove('ddays', editingDdayId);
    await loadDdays();
    renderDdays();
    closeDdayModal();
    Utils.toast('삭제했어요');
  });

  // ===== 체크리스트 (게이미피케이션) =====

  // 예전 버전의 repeatDaily(boolean) 데이터를 repeat 문자열로 읽어올 때 보정
  function normalizeChecklistItem(it) {
    if (!it.repeat) it.repeat = it.repeatDaily ? 'daily' : 'none';
    return it;
  }

  async function loadChecklist() {
    allChecklistItems = (await DB.getAll('checklistItems')).map(normalizeChecklistItem);
  }

  // 반복 항목의 루트(템플릿)를 찾아, 선택한 날짜가 반복 주기에 해당하는데 아직 인스턴스가 없으면 만들어준다.
  async function ensureRecurringInstances(dateStr) {
    const roots = allChecklistItems.filter((it) => it.repeat !== 'none' && it.groupId === it.id);
    let changed = false;
    for (const root of roots) {
      if (!occursOn(root, dateStr)) continue;
      const exists = allChecklistItems.some((it) => it.groupId === root.id && it.date === dateStr);
      if (!exists) {
        const clone = {
          id: Utils.genId(),
          date: dateStr,
          text: root.text,
          completed: false,
          repeat: root.repeat,
          groupId: root.id,
          createdAt: Date.now(),
          completedAt: null,
        };
        await DB.put('checklistItems', clone);
        allChecklistItems.push(clone);
        changed = true;
      }
    }
    return changed;
  }

  function checklistItemsOn(dateStr) {
    return allChecklistItems
      .filter((it) => it.date === dateStr)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function buildDateStatsMap() {
    const map = {};
    allChecklistItems.forEach((it) => {
      if (!map[it.date]) map[it.date] = { total: 0, completed: 0 };
      map[it.date].total += 1;
      if (it.completed) map[it.date].completed += 1;
    });
    return map;
  }

  function computeStreak(map) {
    const today = Utils.todayStr();
    let streak = 0;
    const todayEntry = map[today];
    if (todayEntry && todayEntry.total > 0 && todayEntry.completed === todayEntry.total) streak++;
    const cursor = Utils.strToDate(today);
    cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const ds = Utils.dateToStr(cursor);
      const entry = map[ds];
      if (entry && entry.total > 0 && entry.completed === entry.total) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function renderDashboard() {
    const map = buildDateStatsMap();
    const today = Utils.todayStr();
    const todayEntry = map[today] || { total: 0, completed: 0 };
    const totalCompleted = allChecklistItems.reduce((n, it) => n + (it.completed ? 1 : 0), 0);
    const perfectDays = Object.values(map).filter((d) => d.total > 0 && d.completed === d.total).length;
    const streak = computeStreak(map);

    dashTodayRatio.textContent = `${todayEntry.completed}/${todayEntry.total}`;
    dashTodayScore.textContent = `+${todayEntry.completed * POINTS_PER_ITEM}`;
    dashTotalScore.textContent = `${totalCompleted * POINTS_PER_ITEM}`;
    dashPerfectDays.textContent = `${perfectDays}일`;
    dashStreak.textContent = `${streak}일`;
  }

  function subtaskSectionFragmentHtml() {
    return `
      <div class="subtask-section subtask-section-inline" data-role="subtask-section">
        <div class="subtask-list"></div>
        <div class="subtask-add-row">
          <input type="text" class="subtask-input" placeholder="할 일을 입력하고 추가" maxlength="60" />
          <input type="time" class="subtask-time-input" aria-label="시간 (선택)" />
          <button type="button" class="btn btn-secondary btn-sm subtask-add-btn" aria-label="하위 항목 추가"><svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        </div>
      </div>`;
  }

  function bindChecklistItemSubtasks(sectionEl, item, unit) {
    bindSubtaskSection(sectionEl, {
      getList: () => normalizeSubtasks(item.subtasks),
      setList: (arr) => { item.subtasks = arr; DB.put('checklistItems', item); },
      onChange: () => {
        unit.querySelector('.card-progress-slot').innerHTML = subtaskProgressHtml(item.subtasks);
      },
    });
  }

  function checklistUnitHtml(it) {
    const hasSubtasks = normalizeSubtasks(it.subtasks).length > 0;
    const revealed = hasSubtasks || expandedChecklistIds.has(it.id);
    return `
      <div class="checklist-unit" data-id="${it.id}">
        <div class="checklist-item ${it.completed ? 'completed' : ''}">
          <input type="checkbox" class="checklist-checkbox" ${it.completed ? 'checked' : ''} aria-label="완료 체크" />
          <div class="checklist-text">${Utils.escapeHtml(it.text)}${it.repeat !== 'none' ? `<span class="checklist-repeat-badge"><svg class="icon" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ${REPEAT_LABEL[it.repeat]}</span>` : ''}</div>
          <button type="button" class="checklist-delete" aria-label="삭제"><svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
        <div class="card-progress-slot">${subtaskProgressHtml(it.subtasks)}</div>
        ${revealed ? subtaskSectionFragmentHtml() : `<button type="button" class="subtask-toggle-btn subtask-toggle-btn-inline" data-role="reveal-subtasks"><svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 체크리스트 추가</button>`}
      </div>`;
  }

  function renderChecklist() {
    const items = checklistItemsOn(selectedDate);
    if (items.length === 0) {
      checklistList.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg class="icon" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>아직 등록한 할 일이 없어요.</div>`;
      return;
    }
    checklistList.innerHTML = items.map(checklistUnitHtml).join('');

    checklistList.querySelectorAll('.checklist-unit').forEach((unit) => {
      const id = unit.dataset.id;
      const item = allChecklistItems.find((x) => x.id === id);
      if (!item) return;

      const row = unit.querySelector('.checklist-item');
      row.querySelector('.checklist-checkbox').addEventListener('change', (e) => toggleChecklistItem(id, row, e.target.checked));
      row.querySelector('.checklist-delete').addEventListener('click', () => deleteChecklistItem(id));

      const revealBtn = unit.querySelector('[data-role="reveal-subtasks"]');
      if (revealBtn) {
        revealBtn.addEventListener('click', () => {
          expandedChecklistIds.add(id);
          revealBtn.remove();
          unit.insertAdjacentHTML('beforeend', subtaskSectionFragmentHtml());
          bindChecklistItemSubtasks(unit.querySelector('[data-role="subtask-section"]'), item, unit);
        });
      } else {
        bindChecklistItemSubtasks(unit.querySelector('[data-role="subtask-section"]'), item, unit);
      }
    });
  }

  async function toggleChecklistItem(id, rowEl, checked) {
    const item = allChecklistItems.find((it) => it.id === id);
    if (!item) return;
    item.completed = checked;
    item.completedAt = checked ? Date.now() : null;
    await DB.put('checklistItems', item);

    rowEl.classList.toggle('completed', checked);
    rowEl.classList.remove('pop');
    void rowEl.offsetWidth;
    rowEl.classList.add('pop');

    const float = document.createElement('span');
    float.className = `score-float ${checked ? 'gain' : 'loss'}`;
    float.textContent = checked ? `+${POINTS_PER_ITEM}` : `-${POINTS_PER_ITEM}`;
    rowEl.appendChild(float);
    setTimeout(() => float.remove(), 800);

    renderDashboard();
    ['dash-today-ratio', 'dash-today-score', 'dash-total-score', 'dash-perfect-days', 'dash-streak']
      .forEach((id2) => bump(document.getElementById(id2)));
  }

  async function addChecklistItem(text, repeat) {
    const id = Utils.genId();
    const item = {
      id,
      date: selectedDate,
      text,
      completed: false,
      repeat,
      groupId: repeat !== 'none' ? id : null,
      createdAt: Date.now(),
      completedAt: null,
    };
    await DB.put('checklistItems', item);
    allChecklistItems.push(item);
    renderChecklist();
    renderDashboard();
  }

  async function deleteChecklistItem(id) {
    const item = allChecklistItems.find((it) => it.id === id);
    if (!item) return;

    if (item.repeat !== 'none' && item.groupId) {
      if (!confirm('반복 항목입니다. 삭제하면 이 항목의 모든 날짜 기록(완료 표시·점수 포함)이 함께 삭제됩니다. 계속할까요?')) return;
      const groupIds = allChecklistItems.filter((it) => it.groupId === item.groupId).map((it) => it.id);
      for (const gid of groupIds) {
        await DB.remove('checklistItems', gid);
      }
      allChecklistItems = allChecklistItems.filter((it) => it.groupId !== item.groupId);
    } else {
      await DB.remove('checklistItems', id);
      allChecklistItems = allChecklistItems.filter((it) => it.id !== id);
    }
    renderChecklist();
    renderDashboard();
  }

  function updateChecklistRepeatHint() {
    const value = checklistRepeatSelect.value;
    if (value === 'none') {
      checklistRepeatHint.hidden = true;
      return;
    }
    const d = Utils.strToDate(selectedDate);
    let msg = '<svg class="icon" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> 매일 반복 항목으로 추가돼요.';
    if (value === 'weekly') msg = `<svg class="icon" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> 매주 ${Utils.WEEKDAYS_KR[d.getDay()]}요일마다 반복 항목으로 추가돼요.`;
    else if (value === 'monthly') msg = `<svg class="icon" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> 매달 ${d.getDate()}일마다 반복 항목으로 추가돼요.`;
    checklistRepeatHint.innerHTML = msg;
    checklistRepeatHint.hidden = false;
  }
  checklistRepeatSelect.addEventListener('change', updateChecklistRepeatHint);

  checklistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = checklistInput.value.trim();
    if (!text) return;
    addChecklistItem(text, checklistRepeatSelect.value);
    checklistInput.value = '';
    checklistInput.focus();
    // 반복 선택은 유지됩니다 (같은 요일에 여러 개를 이어서 등록하기 편하도록).
  });

  async function refreshDayChecklist() {
    await ensureRecurringInstances(selectedDate);
    renderChecklist();
    renderDashboard();
    updateChecklistRepeatHint();
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

    currentSubtasks = normalizeSubtasks(schedule && schedule.subtasks);
    scheduleSubtasks.repaint();
    const hasSubtasks = currentSubtasks.length > 0;
    subtaskToggleBtn.classList.toggle('hidden', hasSubtasks);
    subtaskSection.classList.toggle('hidden', !hasSubtasks);

    modalOverlay.classList.add('open');
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    form.reset();
    editingId = null;
    currentSubtasks = [];
    subtaskToggleBtn.classList.remove('hidden');
    subtaskSection.classList.add('hidden');
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
      subtasks: currentSubtasks,
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
    await refreshDayChecklist();
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
  document.getElementById('today-btn').addEventListener('click', async () => {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDate = Utils.todayStr();
    renderCalendar();
    renderDayPanel();
    await refreshDayChecklist();
  });

  (async function init() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    await loadAll();
    await loadChecklist();
    await loadDdays();
    renderDdays();
    renderCalendar();
    renderDayPanel();
    await refreshDayChecklist();
  })();
})();
