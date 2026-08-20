(() => {
  const EMOTIONS = ['불안', '확신', '조급함', '무덤덤', '흥분', '후회'];
  const RESULT_LABEL = { correct: '맞음', incorrect: '틀림', ambiguous: '애매함' };

  let records = [];
  let editingId = null;
  let searchTerm = '';
  let activeFilters = new Set();

  const listEl = document.getElementById('record-list');
  const searchInput = document.getElementById('search-input');
  const tagFilterEl = document.getElementById('tag-filter');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('record-form');
  const deleteBtn = document.getElementById('delete-btn');
  const emotionGroup = document.getElementById('emotion-group');
  const confidencePicker = document.getElementById('confidence-picker');
  const resultSeg = document.getElementById('result-segmented');

  let selectedEmotions = new Set();
  let selectedConfidence = 0;

  function renderTagFilter() {
    tagFilterEl.innerHTML = EMOTIONS.map((tag) => `<button type="button" class="chip ${activeFilters.has(tag) ? 'active' : ''}" data-tag="${tag}">${tag}</button>`).join('');
    tagFilterEl.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const t = chip.dataset.tag;
        if (activeFilters.has(t)) activeFilters.delete(t); else activeFilters.add(t);
        renderTagFilter();
        renderList();
      });
    });
  }

  async function loadAll() {
    records = await DB.getAll('investments');
  }

  function filteredSorted() {
    return records
      .filter((r) => !searchTerm || r.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter((r) => activeFilters.size === 0 || (r.emotions || []).some((e) => activeFilters.has(e)))
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime) || (b.createdAt || 0) - (a.createdAt || 0));
  }

  function renderList() {
    const items = filteredSorted();
    if (items.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg class="icon" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>${records.length === 0 ? '아직 기록이 없어요. + 버튼으로 추가해보세요.' : '조건에 맞는 기록이 없어요.'}</div>`;
      return;
    }
    listEl.innerHTML = items.map((r) => {
      const badge = r.result && r.result.status
        ? `<span class="badge badge-${r.result.status}">${RESULT_LABEL[r.result.status]}</span>`
        : `<span class="badge badge-pending">미확인</span>`;
      const stars = '★'.repeat(r.confidence || 0) + '☆'.repeat(5 - (r.confidence || 0));
      return `
        <div class="card" data-id="${r.id}">
          <div class="card-top">
            <div>
              <div class="card-title">${Utils.escapeHtml(r.symbol)}</div>
              <div class="card-meta">${Utils.displayDateTime(r.dateTime)} · <span style="color:var(--warning)">${stars}</span></div>
            </div>
            ${badge}
          </div>
          <div class="card-body">${Utils.escapeHtml(r.action)}</div>
          ${(r.emotions && r.emotions.length) ? `<div class="card-tags">${r.emotions.map((e) => `<span class="tag-pill">${e}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('');

    listEl.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('click', () => {
        const r = records.find((x) => x.id === card.dataset.id);
        if (r) openModal(r);
      });
    });
  }

  searchInput.addEventListener('input', Utils.debounce((e) => {
    searchTerm = e.target.value.trim();
    renderList();
  }, 150));

  emotionGroup.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.value;
      if (selectedEmotions.has(v)) selectedEmotions.delete(v); else selectedEmotions.add(v);
      chip.classList.toggle('active');
    });
  });

  confidencePicker.querySelectorAll('.confidence-star').forEach((star) => {
    star.addEventListener('click', () => {
      selectedConfidence = Number(star.dataset.value);
      updateConfidenceUI();
    });
  });
  function updateConfidenceUI() {
    confidencePicker.querySelectorAll('.confidence-star').forEach((s) => {
      s.classList.toggle('active', Number(s.dataset.value) <= selectedConfidence);
    });
  }

  let selectedResult = '';
  resultSeg.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      selectedResult = b.dataset.value;
      resultSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    });
  });

  function openModal(record) {
    editingId = record ? record.id : null;
    modalTitle.textContent = record ? '투자 기록 수정' : '투자 기록 추가';
    deleteBtn.classList.toggle('hidden', !record);

    document.getElementById('f-id').value = record ? record.id : '';
    document.getElementById('f-datetime').value = record ? record.dateTime : Utils.nowLocalInputValue();
    document.getElementById('f-symbol').value = record ? record.symbol : '';
    document.getElementById('f-action').value = record ? record.action : '';
    document.getElementById('f-rationale').value = record ? (record.rationale || '') : '';
    document.getElementById('f-expectation').value = record ? (record.expectation || '') : '';
    document.getElementById('f-result-note').value = record && record.result ? (record.result.note || '') : '';

    selectedEmotions = new Set(record ? (record.emotions || []) : []);
    emotionGroup.querySelectorAll('.chip').forEach((chip) => chip.classList.toggle('active', selectedEmotions.has(chip.dataset.value)));

    selectedConfidence = record ? (record.confidence || 0) : 0;
    updateConfidenceUI();

    selectedResult = record && record.result ? (record.result.status || '') : '';
    resultSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === selectedResult));

    modalOverlay.classList.add('open');
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    form.reset();
    selectedEmotions = new Set();
    selectedConfidence = 0;
    selectedResult = '';
    emotionGroup.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    updateConfidenceUI();
    resultSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.value === ''));
    editingId = null;
  }

  document.getElementById('add-btn').addEventListener('click', () => openModal(null));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dateTime = document.getElementById('f-datetime').value;
    const symbol = document.getElementById('f-symbol').value.trim();
    const action = document.getElementById('f-action').value.trim();
    if (!dateTime || !symbol || !action) return;

    const existing = editingId ? records.find((r) => r.id === editingId) : null;
    const obj = {
      id: editingId || Utils.genId(),
      dateTime,
      symbol,
      action,
      rationale: document.getElementById('f-rationale').value.trim(),
      expectation: document.getElementById('f-expectation').value.trim(),
      emotions: Array.from(selectedEmotions),
      confidence: selectedConfidence,
      result: {
        status: selectedResult || null,
        note: document.getElementById('f-result-note').value.trim(),
      },
      createdAt: existing ? existing.createdAt : Date.now(),
    };
    await DB.put('investments', obj);
    await loadAll();
    renderList();
    closeModal();
    Utils.toast('저장했어요');
  });

  deleteBtn.addEventListener('click', async () => {
    if (!editingId) return;
    if (!confirm('이 기록을 삭제할까요?')) return;
    await DB.remove('investments', editingId);
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
    renderTagFilter();
    await loadAll();
    renderList();
  });
})();
