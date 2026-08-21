(() => {
  const pwCard = document.getElementById('password-card');
  const pwModalOverlay = document.getElementById('pw-modal-overlay');
  const pwModalTitle = document.getElementById('pw-modal-title');
  const pwForm = document.getElementById('pw-form');
  const currentPwField = document.getElementById('current-pw-field');
  const pwError = document.getElementById('pw-error');
  let mode = 'setup'; // 'setup' | 'change'

  function renderPasswordCard() {
    if (Auth.isPasswordSet()) {
      pwCard.innerHTML = `
        <button type="button" class="settings-row" id="change-pw-btn"><span>비밀번호 변경</span><span><svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></span></button>
        <button type="button" class="settings-row" id="reset-pw-btn"><span style="color:var(--danger)">비밀번호 초기화</span><span><svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></span></button>
      `;
      document.getElementById('change-pw-btn').addEventListener('click', () => openPwModal('change'));
      document.getElementById('reset-pw-btn').addEventListener('click', resetFlow);
    } else {
      pwCard.innerHTML = `
        <button type="button" class="settings-row" id="setup-pw-btn">
          <span>비밀번호 설정<div class="settings-row-desc">투자 기록 · 일기 잠금에 사용할 비밀번호를 만들어요</div></span>
          <span><svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>
      `;
      document.getElementById('setup-pw-btn').addEventListener('click', () => openPwModal('setup'));
    }
  }

  function openPwModal(m) {
    mode = m;
    pwModalTitle.textContent = m === 'setup' ? '비밀번호 설정' : '비밀번호 변경';
    currentPwField.classList.toggle('hidden', m !== 'change');
    document.getElementById('pw-current').required = m === 'change';
    pwForm.reset();
    pwError.classList.add('hidden');
    pwModalOverlay.classList.add('open');
  }
  function closePwModal() {
    pwModalOverlay.classList.remove('open');
  }
  document.getElementById('pw-modal-close').addEventListener('click', closePwModal);
  pwModalOverlay.addEventListener('click', (e) => { if (e.target === pwModalOverlay) closePwModal(); });

  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const new1 = document.getElementById('pw-new1').value;
    const new2 = document.getElementById('pw-new2').value;
    pwError.classList.add('hidden');

    if (new1 !== new2) {
      pwError.textContent = '새 비밀번호가 일치하지 않습니다.';
      pwError.classList.remove('hidden');
      return;
    }
    if (mode === 'change') {
      const current = document.getElementById('pw-current').value;
      const ok = await Auth.verifyPassword(current);
      if (!ok) {
        pwError.textContent = '현재 비밀번호가 올바르지 않습니다.';
        pwError.classList.remove('hidden');
        return;
      }
    }
    await Auth.setPassword(new1);
    Auth.markUnlocked();
    closePwModal();
    renderPasswordCard();
    Utils.toast(mode === 'setup' ? '비밀번호를 설정했어요' : '비밀번호를 변경했어요');
  });

  function resetFlow() {
    if (!confirm('비밀번호를 초기화할까요? 저장된 일정 · 투자기록 · 일기 데이터는 삭제되지 않지만, 다음 접근 시 새 비밀번호를 설정해야 해요.')) return;
    Auth.resetPassword();
    renderPasswordCard();
    Utils.toast('비밀번호를 초기화했어요');
  }

  // ===== 데이터 백업 =====
  document.getElementById('export-btn').addEventListener('click', async () => {
    const [schedules, investments, diaries, checklistItems, ddays] = await Promise.all([
      DB.getAll('schedules'), DB.getAll('investments'), DB.getAll('diaries'), DB.getAll('checklistItems'), DB.getAll('ddays'),
    ]);
    const payload = {
      app: 'personal-tracker-pwa', version: 3, exportedAt: new Date().toISOString(),
      schedules, investments, diaries, checklistItems, ddays,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = `${d.getFullYear()}${Utils.pad2(d.getMonth() + 1)}${Utils.pad2(d.getDate())}`;
    a.href = url;
    a.download = `personal-tracker-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Utils.toast('백업 파일을 내보냈어요');
  });

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('invalid');
      const counts = {
        schedules: Array.isArray(data.schedules) ? data.schedules.length : 0,
        investments: Array.isArray(data.investments) ? data.investments.length : 0,
        diaries: Array.isArray(data.diaries) ? data.diaries.length : 0,
        checklistItems: Array.isArray(data.checklistItems) ? data.checklistItems.length : 0,
        ddays: Array.isArray(data.ddays) ? data.ddays.length : 0,
      };
      if (!confirm(`백업 파일을 가져올까요?\n일정 ${counts.schedules}개, 투자기록 ${counts.investments}개, 일기 ${counts.diaries}개, 체크리스트 ${counts.checklistItems}개, D-day ${counts.ddays}개\n\n기존 데이터는 모두 삭제되고 이 파일 내용으로 대체됩니다.`)) return;

      if (Array.isArray(data.schedules)) { await DB.clear('schedules'); await DB.bulkPut('schedules', data.schedules); }
      if (Array.isArray(data.investments)) { await DB.clear('investments'); await DB.bulkPut('investments', data.investments); }
      if (Array.isArray(data.diaries)) { await DB.clear('diaries'); await DB.bulkPut('diaries', data.diaries); }
      if (Array.isArray(data.checklistItems)) { await DB.clear('checklistItems'); await DB.bulkPut('checklistItems', data.checklistItems); }
      if (Array.isArray(data.ddays)) { await DB.clear('ddays'); await DB.bulkPut('ddays', data.ddays); }

      Utils.toast('가져오기를 완료했어요');
    } catch (err) {
      alert('올바른 백업 파일이 아니에요.');
    }
  });

  renderPasswordCard();
})();
