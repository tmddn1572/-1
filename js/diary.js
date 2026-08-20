(() => {
  let entries = [];
  let editingId = null;
  let selectedEmotion = '';

  const listEl = document.getElementById('diary-list');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('diary-form');
  const deleteBtn = document.getElementById('delete-btn');
  const emotionGroup = document.getElementById('emotion-group');
  const dateInput = document.getElementById('f-date');

  async function loadAll() {
    entries = await DB.getAll('diaries');
  }

  function findByDate(dateStr, excludeId) {
    return entries.find((e) => e.date === dateStr && e.id !== excludeId) || null;
  }

  function renderList() {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg class="icon" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>아직 작성한 일기가 없어요. + 버튼으로 오늘을 기록해보세요.</div>`;
      return;
    }
    listEl.innerHTML = sorted.map((e) => {
      const preview = e.text.length > 60 ? e.text.slice(0, 60) + '…' : e.text;
      return `
        <div class="card" data-id="${e.id}">
          <div class="card-top">
            <div class="card-title">${Utils.displayDate(e.date)}</div>
            ${e.emotion ? `<span class="tag-pill">${e.emotion}</span>` : ''}
          </div>
          <div class="card-body">${Utils.escapeHtml(preview)}</div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('click', () => {
        const e = entries.find((x) => x.id === card.dataset.id);
        if (e) openModal(e);
      });
    });
  }

  emotionGroup.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.value;
      selectedEmotion = selectedEmotion === v ? '' : v;
      emotionGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.value === selectedEmotion));
    });
  });

  function openModal(entry) {
    editingId = entry ? entry.id : null;
    modalTitle.textContent = entry ? '일기 수정' : '일기 쓰기';
    deleteBtn.classList.toggle('hidden', !entry);

    document.getElementById('f-id').value = entry ? entry.id : '';
    dateInput.value = entry ? entry.date : Utils.todayStr();
    dateInput.readOnly = false;
    document.getElementById('f-text').value = entry ? entry.text : '';

    selectedEmotion = entry ? (entry.emotion || '') : '';
    emotionGroup.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.value === selectedEmotion));

    modalOverlay.classList.add('open');
  }

  // 새 일기 작성 중 이미 그 날짜에 일기가 있으면 자동으로 불러오기
  dateInput.addEventListener('change', () => {
    if (editingId) return;
    const existing = findByDate(dateInput.value, null);
    if (existing) {
      Utils.toast('해당 날짜에 이미 일기가 있어 불러왔어요');
      openModal(existing);
    }
  });

  function closeModal() {
    modalOverlay.classList.remove('open');
    form.reset();
    selectedEmotion = '';
    emotionGroup.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    editingId = null;
  }

  document.getElementById('add-btn').addEventListener('click', () => openModal(null));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = dateInput.value;
    const text = document.getElementById('f-text').value.trim();
    if (!date || !text) return;

    const conflict = findByDate(date, editingId);
    const finalId = editingId || (conflict ? conflict.id : Utils.genId());
    const existing = entries.find((x) => x.id === finalId);

    const obj = {
      id: finalId,
      date,
      text,
      emotion: selectedEmotion || null,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    await DB.put('diaries', obj);
    await loadAll();
    renderList();
    closeModal();
    Utils.toast('저장했어요');
  });

  deleteBtn.addEventListener('click', async () => {
    if (!editingId) return;
    if (!confirm('이 일기를 삭제할까요?')) return;
    await DB.remove('diaries', editingId);
    await loadAll();
    renderList();
    closeModal();
    Utils.toast('삭제했어요');
  });

  document.getElementById('lock-btn').addEventListener('click', () => {
    if (confirm('투자 기록 · 일기를 다시 잠글까요?')) Auth.lock();
  });

  const gateEl = document.getElementById('lock-gate');
  const contentEl = document.getElementById('app-content');
  Auth.guard(gateEl, contentEl, async () => {
    await loadAll();
    renderList();
  });
})();
