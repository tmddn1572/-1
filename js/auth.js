// 간단한 클라이언트 측 잠금 (완전한 보안이 아님) - 투자기록/일기 공용 비밀번호
const Auth = (() => {
  const HASH_KEY = 'ptw_pw_hash';
  const SALT_KEY = 'ptw_pw_salt';
  const SESSION_KEY = 'ptw_unlocked';

  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    return bufToHex(digest);
  }

  function randomSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return bufToHex(arr.buffer);
  }

  function isPasswordSet() {
    return !!localStorage.getItem(HASH_KEY);
  }

  async function setPassword(pw) {
    const salt = randomSalt();
    const hash = await sha256Hex(salt + pw);
    localStorage.setItem(SALT_KEY, salt);
    localStorage.setItem(HASH_KEY, hash);
  }

  async function verifyPassword(pw) {
    const salt = localStorage.getItem(SALT_KEY);
    const hash = localStorage.getItem(HASH_KEY);
    if (!salt || !hash) return false;
    const candidate = await sha256Hex(salt + pw);
    return candidate === hash;
  }

  function resetPassword() {
    localStorage.removeItem(HASH_KEY);
    localStorage.removeItem(SALT_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isUnlocked() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function markUnlocked() {
    sessionStorage.setItem(SESSION_KEY, '1');
  }

  function lock() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  // gateEl: 잠금화면을 그릴 컨테이너, contentEl: 잠금 해제 후 보여줄 실제 콘텐츠, onUnlock: 콜백
  function guard(gateEl, contentEl, onUnlock) {
    function showApp() {
      gateEl.hidden = true;
      contentEl.hidden = false;
      onUnlock();
    }

    if (isUnlocked()) {
      showApp();
      return;
    }

    if (!isPasswordSet()) {
      renderSetup();
    } else {
      renderLogin();
    }

    function renderSetup() {
      gateEl.innerHTML = `
        <a href="index.html" class="lock-back" aria-label="홈으로">←</a>
        <div class="lock-screen">
          <div class="lock-icon">🔒</div>
          <h2>비밀번호 최초 설정</h2>
          <p class="lock-desc">투자 기록과 일기에 공통으로 사용할 비밀번호를 설정하세요.</p>
          <form id="setup-form" class="lock-form">
            <input type="password" id="setup-pw1" placeholder="비밀번호 (4자 이상)" required minlength="4" autocomplete="new-password" />
            <input type="password" id="setup-pw2" placeholder="비밀번호 확인" required minlength="4" autocomplete="new-password" />
            <p class="lock-error hidden" id="setup-error"></p>
            <button type="submit" class="btn btn-primary btn-block">설정하고 시작하기</button>
          </form>
          <p class="lock-note">※ 완전한 보안이 아닌 간단한 잠금 기능입니다. 기기를 공유하는 경우 주의하세요.</p>
        </div>`;
      gateEl.querySelector('#setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw1 = gateEl.querySelector('#setup-pw1').value;
        const pw2 = gateEl.querySelector('#setup-pw2').value;
        const errEl = gateEl.querySelector('#setup-error');
        if (pw1 !== pw2) {
          errEl.textContent = '비밀번호가 일치하지 않습니다.';
          errEl.classList.remove('hidden');
          return;
        }
        await setPassword(pw1);
        markUnlocked();
        showApp();
      });
    }

    function renderLogin() {
      gateEl.innerHTML = `
        <a href="index.html" class="lock-back" aria-label="홈으로">←</a>
        <div class="lock-screen">
          <div class="lock-icon">🔒</div>
          <h2>비밀번호 입력</h2>
          <p class="lock-desc">투자 기록 · 일기 잠금을 해제하세요.</p>
          <form id="login-form" class="lock-form">
            <input type="password" id="login-pw" placeholder="비밀번호" required autocomplete="current-password" autofocus />
            <p class="lock-error hidden" id="login-error"></p>
            <button type="submit" class="btn btn-primary btn-block">잠금 해제</button>
          </form>
          <a href="settings.html" class="lock-forgot">비밀번호를 잊으셨나요?</a>
        </div>`;
      const form = gateEl.querySelector('#login-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw = gateEl.querySelector('#login-pw').value;
        const ok = await verifyPassword(pw);
        if (ok) {
          markUnlocked();
          showApp();
        } else {
          const errEl = gateEl.querySelector('#login-error');
          errEl.textContent = '비밀번호가 올바르지 않습니다.';
          errEl.classList.remove('hidden');
          form.classList.remove('shake');
          void form.offsetWidth;
          form.classList.add('shake');
          gateEl.querySelector('#login-pw').value = '';
        }
      });
    }
  }

  return { isPasswordSet, setPassword, verifyPassword, resetPassword, isUnlocked, markUnlocked, lock, guard };
})();
