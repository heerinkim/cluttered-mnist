/* 정식 공개 전 비공개 유지
   - 초대 코드가 담긴 링크로 들어온 분, 그리고 이미 회원이신 분만 화면을 봅니다
   - 그 밖에는 "준비 중" 안내만 보입니다
   - 코드는 이 파일에 적혀 있지 않습니다. 서버(Supabase)에 물어봐서 확인합니다 */
window.Invite = (function () {

  var KEY = 'cakeshop:invitePass';
  var PARAM = 'invite';
  var passed = false;

  function has() { return passed; }

  function remember() {
    passed = true;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
  }

  function stored() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  /* 앱이 시작될 때 먼저 불립니다.
     통과하면 true, 막아야 하면 false 를 돌려줍니다. */
  function check() {
    // 이미 로그인한 회원은 그냥 통과 (초대 코드와 무관)
    if (SB.loggedIn()) { passed = true; return Promise.resolve(true); }
    if (stored()) { passed = true; return Promise.resolve(true); }
    // 가입 인증·비밀번호 재설정 메일의 링크를 누르고 온 경우에도 통과시킵니다.
    // (그 주소에는 서버가 발급한 로그인 정보가 붙어 있습니다)
    if (String(location.hash || '').indexOf('access_token=') >= 0) {
      passed = true; remember(); return Promise.resolve(true);
    }

    var code = '';
    try { code = new URLSearchParams(location.search).get(PARAM) || ''; } catch (e) { code = ''; }
    if (!code) return Promise.resolve(false);

    return SB.checkInvite(code).then(function (ok) {
      if (!ok) return false;
      remember();
      // 주소창에서 코드를 지워 둡니다 (남이 어깨너머로 보는 것 방지)
      try { history.replaceState(null, '', location.pathname + (location.hash || '')); } catch (e) {}
      return true;
    }).catch(function () { return false; });
  }

  /* "준비 중" 화면 — 코드를 직접 넣어볼 수도 있게 해 둡니다 */
  function renderClosed(view) {
    view.innerHTML =
      '<div class="card auth-card">' +
        '<div class="auth-hero">' +
          '<div class="auth-logo">🔨</div>' +
          '<h2>준비 중입니다</h2>' +
          '<p class="hint">1인 사업자를 위한 운영 노트를 만들고 있습니다.<br>' +
          '정식 공개 전까지는 초대받은 분만 볼 수 있어요.</p>' +
        '</div>' +
        '<form id="invForm" novalidate style="margin-top:8px">' +
          '<div class="field"><label>초대 코드</label>' +
            '<input name="code" placeholder="초대 링크를 받으셨다면 그 링크로 들어와 주세요" autocomplete="off"></div>' +
          '<button class="btn wide" type="submit">들어가기</button>' +
        '</form>' +
        '<div id="invMsg"></div>' +
      '</div>';

    U.$('#invForm', view).onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      var code = (f.code.value || '').trim();
      var box = U.$('#invMsg', view);
      if (!code) { box.innerHTML = '<div class="warn" style="margin-top:12px">초대 코드를 적어주세요.</div>'; return; }
      U.$$('button, input', f).forEach(function (el) { el.disabled = true; });
      box.innerHTML = '<div class="info" style="margin-top:12px">확인하는 중...</div>';
      SB.checkInvite(code).then(function (ok) {
        if (ok) { remember(); location.reload(); return; }
        U.$$('button, input', f).forEach(function (el) { el.disabled = false; });
        box.innerHTML = '<div class="warn" style="margin-top:12px">맞지 않는 코드예요. 받으신 링크를 다시 확인해 주세요.</div>';
      }).catch(function () {
        U.$$('button, input', f).forEach(function (el) { el.disabled = false; });
        box.innerHTML = '<div class="warn" style="margin-top:12px">확인하지 못했어요. 인터넷 연결을 확인해 주세요.</div>';
      });
    };
  }

  return { check: check, has: has, renderClosed: renderClosed };
})();
