/* 회원가입 · 로그인 · 이용 기간(무료 체험 / 구독) 화면 */
window.Auth = (function () {

  var PRICE = 9900;             // 월 구독료
  var TRIAL_MONTHS = 3;         // 무료 체험 기간
  var access = null;            // { shop_name, trial_ends_at, subscribed_until, active, days_left }
  var mode = 'login';           // 'login' | 'signup' | 'reset'

  function info() { return access; }
  function setAccess(a) { access = a; return a; }

  function refreshAccess() {
    if (!SB.loggedIn()) { access = null; return Promise.resolve(null); }
    return SB.myAccess().then(setAccess).catch(function () { return access; });
  }

  // 결제하지 않아도 되는 상태인지
  function active() { return !!(access && access.active); }
  function onTrial() {
    return !!(access && access.trial_ends_at && Date.now() < Date.parse(access.trial_ends_at)
              && !(access.subscribed_until && Date.now() < Date.parse(access.subscribed_until)));
  }
  function daysLeft() { return access ? Number(access.days_left || 0) : 0; }

  /* ================= 로그인 전 화면 ================= */
  function renderGate(view) {
    view.innerHTML =
      '<div class="card auth-card">' +
        '<div class="auth-hero">' +
          '<div class="auth-logo">🎂</div>' +
          '<h2>케이크 공방 운영 노트</h2>' +
          '<p class="hint">주문 · 달력 · 정산 · 재고 · 원가 · 갤러리 · 고객알림을 한 곳에서.<br>' +
          '<b>가입 후 ' + TRIAL_MONTHS + '개월 무료</b>, 이후 월 ' + U.won(PRICE) + '.</p>' +
        '</div>' +
        '<div class="row auth-tabs">' +
          '<button class="btn ' + (mode === 'login' ? '' : 'ghost') + '" data-mode="login">로그인</button>' +
          '<button class="btn ' + (mode === 'signup' ? '' : 'ghost') + '" data-mode="signup">회원가입</button>' +
        '</div>' +
        (mode === 'signup' ? signupForm() : mode === 'reset' ? resetForm() : loginForm()) +
        '<div id="authMsg"></div>' +
      '</div>' +
      featureCard();
    bindGate(view);
  }

  function loginForm() {
    return '<form id="loginForm" novalidate>' +
      '<div class="field"><label>이메일</label>' +
        '<input name="email" type="email" autocomplete="username" placeholder="sajang@example.com"></div>' +
      '<div class="field"><label>비밀번호</label>' +
        '<input name="password" type="password" autocomplete="current-password" placeholder="••••••"></div>' +
      '<button class="btn wide" type="submit">로그인</button>' +
      '<div class="row" style="margin-top:10px;justify-content:center">' +
        '<button type="button" class="btn ghost small" data-mode="reset">비밀번호를 잊으셨나요?</button>' +
      '</div>' +
    '</form>';
  }

  function signupForm() {
    return '<form id="signupForm" novalidate>' +
      '<div class="field"><label>가게 이름 <span style="color:var(--rose)">*</span></label>' +
        '<input name="shopName" placeholder="그랫피케이크" autocomplete="organization"></div>' +
      '<div class="grid two">' +
        '<div class="field"><label>사장님 성함</label>' +
          '<input name="ownerName" placeholder="김희린" autocomplete="name"></div>' +
        '<div class="field"><label>사장님 연락처</label>' +
          '<input name="ownerPhone" placeholder="010-0000-0000" inputmode="numeric"></div>' +
      '</div>' +
      '<div class="field"><label>이메일 <span style="color:var(--rose)">*</span></label>' +
        '<input name="email" type="email" autocomplete="username" placeholder="sajang@example.com"></div>' +
      '<div class="grid two">' +
        '<div class="field"><label>비밀번호 <span style="color:var(--rose)">*</span></label>' +
          '<input name="password" type="password" autocomplete="new-password" placeholder="6자 이상"></div>' +
        '<div class="field"><label>비밀번호 확인 <span style="color:var(--rose)">*</span></label>' +
          '<input name="password2" type="password" autocomplete="new-password"></div>' +
      '</div>' +
      '<label class="row agree"><input type="checkbox" name="agree" style="width:auto">' +
        '<span>아래 안내를 읽고 동의합니다 <span style="color:var(--rose)">*</span></span></label>' +
      '<div class="info" style="margin-top:8px">' +
        '· 가입일로부터 <b>' + TRIAL_MONTHS + '개월 무료</b>로 쓰실 수 있습니다. 체험 기간에는 결제 수단을 받지 않습니다.<br>' +
        '· 체험이 끝나면 <b>월 ' + U.won(PRICE) + '</b>입니다. 결제하지 않으셔도 <b>기존 자료는 계속 보고 내려받을 수 있고</b>, 새로 저장만 막힙니다.<br>' +
        '· 입력하신 주문·고객 정보는 사장님 계정에만 보이며, 다른 가게는 볼 수 없습니다.' +
      '</div>' +
      '<button class="btn wide" type="submit" style="margin-top:12px">' + TRIAL_MONTHS + '개월 무료로 시작하기</button>' +
    '</form>';
  }

  function resetForm() {
    return '<form id="resetForm" novalidate>' +
      '<p class="hint">가입하신 이메일을 적어주시면 비밀번호를 다시 정하는 링크를 보내드립니다.</p>' +
      '<div class="field"><label>이메일</label><input name="email" type="email" placeholder="sajang@example.com"></div>' +
      '<button class="btn wide" type="submit">재설정 메일 받기</button>' +
      '<div class="row" style="margin-top:10px;justify-content:center">' +
        '<button type="button" class="btn ghost small" data-mode="login">← 로그인으로 돌아가기</button></div>' +
    '</form>';
  }

  function featureCard() {
    var items = [
      ['📝', '주문 · 달력', '주문서를 적으면 픽업 날짜에 자동으로 표시'],
      ['📊', '월별 정산', '매출 · 원가 · 이익을 한 표에서, 엑셀로 저장'],
      ['📦', '재고', '상자 · 보냉백 · 리본이 부족하면 미리 알림'],
      ['🖼️', '갤러리', '만든 케이크 사진을 태그로 정리'],
      ['💰', '원가표', '"생화케이크 2단" 적으면 원가와 판매가 계산'],
      ['💬', '고객 알림', '주문 당일 · 픽업 전날 · 픽업 후 문자 자동 작성']
    ];
    return '<div class="card"><h2>무엇을 할 수 있나요</h2><div class="grid two">' +
      items.map(function (x) {
        return '<div class="feature"><div class="f-ico">' + x[0] + '</div>' +
          '<div><b>' + x[1] + '</b><br><span class="cap-sub">' + x[2] + '</span></div></div>';
      }).join('') + '</div></div>';
  }

  function msg(html, kind) {
    var el = U.$('#authMsg');
    if (el) el.innerHTML = '<div class="' + (kind || 'warn') + '" style="margin-top:12px;white-space:pre-wrap">' + html + '</div>';
  }

  function bindGate(view) {
    view.addEventListener('click', function (e) {
      var m = e.target.dataset && e.target.dataset.mode;
      if (m) { mode = m; App.render(); }
    });

    var lf = U.$('#loginForm', view);
    if (lf) lf.onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.email.value.trim() || !f.password.value) { msg('이메일과 비밀번호를 모두 적어주세요.'); return; }
      busy(f, true); msg('로그인 중...', 'info');
      SB.signIn(f.email.value, f.password.value)
        .then(function () { return afterLogin(); })
        .catch(function (err) { busy(f, false); msg(U.esc(err.message)); });
    };

    var sf = U.$('#signupForm', view);
    if (sf) sf.onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      var shop = f.shopName.value.trim();
      if (!shop) { msg('가게 이름을 적어주세요.'); return; }
      if (!f.email.value.trim()) { msg('이메일을 적어주세요.'); return; }
      if ((f.password.value || '').length < 6) { msg('비밀번호는 6자 이상으로 정해주세요.'); return; }
      if (f.password.value !== f.password2.value) { msg('두 비밀번호가 서로 달라요.'); return; }
      if (!f.agree.checked) { msg('안내 내용에 동의해 주셔야 가입할 수 있어요.'); return; }

      busy(f, true); msg('가입하는 중...', 'info');
      SB.signUp({
        email: f.email.value, password: f.password.value, shopName: shop,
        ownerName: f.ownerName.value, ownerPhone: U.phone(f.ownerPhone.value.trim())
      }).then(function (r) {
        if (r.signedIn) return afterLogin(true);
        busy(f, false);
        msg('가입 신청이 됐어요! <b>' + U.esc(f.email.value.trim()) + '</b> 으로 보낸 인증 메일의 링크를 눌러주세요.<br>' +
            '인증을 마치면 [로그인]으로 들어오시면 됩니다.', 'info');
      }).catch(function (err) { busy(f, false); msg(U.esc(err.message)); });
    };

    var rf = U.$('#resetForm', view);
    if (rf) rf.onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      busy(f, true);
      SB.resetPassword(f.email.value).then(function () {
        busy(f, false);
        msg('재설정 메일을 보냈어요. 메일함을 확인해 주세요.', 'info');
      }).catch(function (err) { busy(f, false); msg(U.esc(err.message)); });
    };
  }

  function busy(form, on) {
    U.$$('button, input', form).forEach(function (el) { el.disabled = on; });
  }

  /* 로그인 직후: 이 컴퓨터 자료를 계정별로 분리하고 서버와 맞춥니다 */
  function afterLogin(isNew) {
    DB.setScope(SB.userId());
    msg('자료를 불러오는 중...', 'info');
    return refreshAccess().then(function () {
      return Sync.run({ rerender: false });
    }).then(function () {
      Sync.start();
      // 가입할 때 적은 가게 이름을 앱 설정에도 반영
      if (access && access.shop_name) {
        var s = DB.settings();
        if (!s.shopName || s.shopName === '케이크 공방' || isNew) {
          DB.saveSettings({ shopName: access.shop_name, ownerPhone: access.owner_phone || s.ownerPhone });
        }
      }
      location.hash = '#home';
      App.render(); App.refreshShopName();
      U.toast(isNew ? '환영합니다! ' + TRIAL_MONTHS + '개월 무료로 시작합니다 🎂' : '로그인했어요');
    });
  }

  function signOut() {
    if (!U.confirmBox('로그아웃할까요?\n이 컴퓨터에 남은 자료는 다시 로그인하면 그대로 보입니다.')) return;
    Sync.run({ pushOnly: true, rerender: false }).finally(function () {
      Sync.stop();
      SB.signOut().finally(function () {
        access = null;
        DB.setScope(null);
        mode = 'login';
        location.hash = '#home';
        App.render();
        U.toast('로그아웃했어요');
      });
    });
  }

  /* ================= 이용 기간이 끝났을 때 ================= */
  function renderExpired(view) {
    var ended = access && access.trial_ends_at ? U.korDateFull(String(access.trial_ends_at).slice(0, 10)) : '';
    view.innerHTML =
      '<div class="card">' +
        '<h2>🔒 이용 기간이 끝났습니다</h2>' +
        '<p class="hint">무료 체험이 ' + U.esc(ended) + ' 에 끝났어요. 계속 쓰시려면 구독을 시작해 주세요.</p>' +
        '<div class="info"><b>지금까지 쌓인 자료는 안전합니다.</b> 주문·정산·재고를 <b>계속 보실 수 있고</b>, ' +
        '엑셀(CSV)과 백업 파일로 <b>내려받기도 됩니다.</b> 새로 저장하고 고치는 것만 잠겨 있어요.</div>' +
        '<div class="price-box">' +
          '<div class="price-amt">' + U.won(PRICE) + '<span>/ 월</span></div>' +
          '<div class="cap-sub">부가세 포함 · 언제든 해지 가능</div>' +
        '</div>' +
        '<div class="row"><button class="btn wide" data-go="subscribe">구독 시작하기</button></div>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn ghost" data-go="monthly">자료 보기</button>' +
          '<button class="btn ghost" data-go="settings">백업 내려받기</button>' +
        '</div>' +
      '</div>';
    view.addEventListener('click', function (e) {
      var go = e.target.dataset && e.target.dataset.go;
      if (go) location.hash = '#' + go;
    });
  }

  /* ================= 구독 / 결제 화면 ================= */
  function renderSubscribe(view) {
    var a = access || {};
    var until = a.subscribed_until ? String(a.subscribed_until).slice(0, 10) : '';
    var trialEnd = a.trial_ends_at ? String(a.trial_ends_at).slice(0, 10) : '';

    view.innerHTML =
      '<div class="card">' +
        '<h2>💳 구독</h2>' +
        '<div class="grid three">' +
          tile('가게', U.esc(a.shop_name || '-'), '') +
          tile('상태', active() ? (onTrial() ? '무료 체험 중' : '구독 중') : '이용 종료', active() ? 'mint' : 'red') +
          tile('남은 기간', daysLeft() + '일', daysLeft() <= 14 ? 'amber' : '') +
        '</div>' +
        '<p class="hint" style="margin-top:10px">' +
          (trialEnd ? '무료 체험 종료일: <b>' + U.korDateFull(trialEnd) + '</b><br>' : '') +
          (until ? '구독 이용 종료일: <b>' + U.korDateFull(until) + '</b>' : '') +
        '</p>' +
      '</div>' +

      '<div class="card">' +
        '<h2>요금</h2>' +
        '<div class="price-box">' +
          '<div class="price-amt">' + U.won(PRICE) + '<span>/ 월</span></div>' +
          '<div class="cap-sub">부가세 포함 · 가입 후 ' + TRIAL_MONTHS + '개월 무료 · 언제든 해지</div>' +
        '</div>' +
        '<div class="warn"><b>결제 기능은 아직 연결되지 않았습니다.</b><br>' +
          '실제로 카드 결제를 받으려면 사업자등록과 결제대행사(PG) 가입이 필요합니다. ' +
          '아래 [준비 사항]을 참고해 주세요. 준비가 끝나면 이 자리에 결제 버튼이 붙습니다.</div>' +
        '<details class="adv" style="margin-top:12px">' +
          '<summary>결제를 받으려면 무엇이 필요한가요?</summary>' +
          '<ol style="padding-left:20px;line-height:2;margin-top:10px">' +
            '<li><b>사업자등록</b> + <b>통신판매업 신고</b> (구청/시청, 온라인 판매 필수)</li>' +
            '<li><b>결제대행사(PG) 가입</b> — 토스페이먼츠 · 포트원 · KG이니시스 등<br>' +
              '<span class="cap-sub">심사에 보통 3~10일. <b>정기결제(자동결제)</b>는 별도 심사가 필요합니다</span></li>' +
            '<li><b>이용약관 · 개인정보처리방침 · 환불정책</b> 게시 (전자상거래법상 의무)</li>' +
            '<li>결제 승인을 처리할 <b>서버 코드</b> — Supabase Edge Function 으로 붙일 수 있습니다</li>' +
          '</ol>' +
          '<p class="hint">수수료는 보통 결제액의 2~3.5%입니다. ' + U.won(PRICE) + ' 기준 건당 약 60~100원.</p>' +
        '</details>' +
      '</div>' +

      '<div class="card">' +
        '<h2>결제 내역</h2>' +
        '<div id="payList"><p class="hint">불러오는 중...</p></div>' +
      '</div>';

    SB.myPayments().then(function (rows) {
      var box = U.$('#payList', view);
      if (!box) return;
      if (!rows || !rows.length) { box.innerHTML = '<div class="empty">아직 결제 내역이 없어요.</div>'; return; }
      box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>날짜</th><th class="num">금액</th>' +
        '<th>상태</th><th>이용 기간</th></tr></thead><tbody>' +
        rows.map(function (p) {
          return '<tr><td>' + U.korDate(String(p.created_at).slice(0, 10)) + '</td>' +
            '<td class="num">' + U.won(p.amount) + '</td>' +
            '<td>' + U.esc(p.status) + '</td>' +
            '<td>' + (p.period_end ? U.korDate(String(p.period_end).slice(0, 10)) + ' 까지' : '-') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(function () {
      var box = U.$('#payList', view);
      if (box) box.innerHTML = '<div class="empty">내역을 불러오지 못했어요.</div>';
    });
  }

  function tile(label, value, cls) {
    return '<div class="stat ' + cls + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
  }

  /* 화면 위쪽에 띄우는 남은 기간 안내 */
  function banner() {
    if (!SB.loggedIn() || !access) return '';
    if (!access.active) {
      return '<div class="trial-bar expired">🔒 이용 기간이 끝났어요 — 보기·내려받기는 되지만 저장은 잠겨 있습니다 ' +
        '<button class="btn small" data-go="subscribe">구독하기</button></div>';
    }
    if (onTrial()) {
      var urgent = daysLeft() <= 14;
      return '<div class="trial-bar' + (urgent ? ' expired' : '') + '">' +
        (urgent ? '⏳' : '🎁') + ' 무료 체험 <b>' + daysLeft() + '일</b> 남았어요 ' +
        '<button class="btn ghost small" data-go="subscribe">구독 안내</button></div>';
    }
    return '';
  }

  return {
    PRICE: PRICE, TRIAL_MONTHS: TRIAL_MONTHS,
    info: info, refreshAccess: refreshAccess, active: active, onTrial: onTrial, daysLeft: daysLeft,
    renderGate: renderGate, renderExpired: renderExpired, renderSubscribe: renderSubscribe,
    afterLogin: afterLogin, signOut: signOut, banner: banner
  };
})();
