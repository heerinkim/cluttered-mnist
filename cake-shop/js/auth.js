/* 회원가입 · 로그인 · 이용 기간(무료 체험 / 구독) 화면 */
window.Auth = (function () {

  var PRICE = 9900;             // 월 구독료
  var PRICE_YEAR = 99000;       // 연 구독료 (2개월 무료)
  var TRIAL_MONTHS = 3;         // 무료 체험 기간

  /* 무통장입금 받을 계좌 — 관리자가 구독 화면에서 직접 입력합니다 (서버에 저장) */
  var BANK = { bank: '', account: '', holder: '' };
  function bankReady() { return !!(BANK.bank && BANK.account && BANK.holder); }
  function loadBank() {
    return SB.getServiceConfig().then(function (c) {
      if (c) BANK = { bank: c.bank_name || '', account: c.bank_account || '', holder: c.bank_holder || '' };
      return BANK;
    }).catch(function () { return BANK; });
  }
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
        '<span><a href="terms.html#terms" target="_blank" rel="noopener">이용약관</a> · ' +
        '<a href="terms.html#privacy" target="_blank" rel="noopener">개인정보처리방침</a>과 ' +
        '아래 안내를 읽고 동의합니다 <span style="color:var(--rose)">*</span></span></label>' +
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
        '<h2>요금제</h2>' +
        '<div class="grid two plans">' +
          planCard('monthly', '월 결제', PRICE, '매달 결제', '') +
          planCard('yearly', '연 결제', PRICE_YEAR, '1년치 한 번에', '2개월 무료') +
        '</div>' +
        '<p class="hint" style="margin-top:10px">부가세 포함 · 가입 후 ' + TRIAL_MONTHS + '개월 무료 · 언제든 해지</p>' +
      '</div>' +

      '<div class="card" id="payBox">' +
        '<h2>🏦 무통장입금</h2>' +
        '<p class="hint">카드 자동결제는 준비 중입니다. 지금은 <b>계좌이체</b>로 받고 있어요.</p>' +
        '<div id="payState"><p class="hint">확인하는 중...</p></div>' +
      '</div>' +

      '<div id="adminBox"></div>' +

      '<div class="card">' +
        '<h2>내 결제 내역</h2>' +
        '<div id="payList"><p class="hint">불러오는 중...</p></div>' +
      '</div>';

    loadBank().then(function () { bindSubscribe(view); });
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

  var chosenPlan = 'yearly';

  function planCard(plan, title, amount, sub, badge) {
    var perMonth = plan === 'yearly' ? Math.round(amount / 12) : amount;
    return '<label class="plan' + (chosenPlan === plan ? ' on' : '') + '" data-plan="' + plan + '">' +
      '<input type="radio" name="plan" value="' + plan + '"' + (chosenPlan === plan ? ' checked' : '') + '>' +
      '<div class="plan-body">' +
        '<div class="row" style="gap:6px"><b>' + title + '</b>' +
          (badge ? '<span class="badge mint">' + badge + '</span>' : '') + '</div>' +
        '<div class="plan-amt">' + U.won(amount) + '</div>' +
        '<div class="cap-sub">' + sub +
          (plan === 'yearly' ? ' · 한 달에 ' + U.won(perMonth) + ' 꼴' : '') + '</div>' +
      '</div></label>';
  }

  /* ---------- 무통장입금 안내 / 신청 ---------- */
  function bindSubscribe(view) {
    view.addEventListener('click', function (e) {
      var lab = e.target.closest('[data-plan]');
      if (lab) {
        chosenPlan = lab.dataset.plan;
        U.$$('.plan', view).forEach(function (el) { el.classList.toggle('on', el.dataset.plan === chosenPlan); });
        drawPayState(view);
      }
    });
    drawPayState(view);
    drawAdmin(view);
  }

  function drawPayState(view) {
    var box = U.$('#payState', view);
    if (!box) return;
    SB.myPayments().then(function (rows) {
      var pending = (rows || []).filter(function (p) { return p.status === 'pending'; })[0];
      if (pending) { box.innerHTML = pendingHtml(pending); bindCancelHint(view); return; }
      box.innerHTML = requestHtml();
      var btn = U.$('#reqPay', view);
      if (btn) btn.onclick = function () {
        var who = (U.$('#depositor', view) || {}).value || '';
        if (!who.trim()) { U.toast('입금하실 분 이름을 적어주세요'); return; }
        btn.disabled = true;
        SB.requestBankTransfer(chosenPlan, who.trim()).then(function () {
          U.toast('입금 신청을 접수했어요');
          drawPayState(view);
        }).catch(function (err) { btn.disabled = false; U.toast(err.message); });
      };
    }).catch(function () { box.innerHTML = '<div class="warn">상태를 불러오지 못했어요.</div>'; });
  }

  function requestHtml() {
    var amount = chosenPlan === 'yearly' ? PRICE_YEAR : PRICE;
    var label = chosenPlan === 'yearly' ? '연 결제' : '월 결제';
    if (!bankReady()) {
      return '<div class="warn"><b>입금 계좌가 아직 등록되지 않았습니다.</b><br>' +
        '서비스를 여는 사장님께서 계좌번호를 알려주시면 이 자리에 표시됩니다.</div>';
    }
    return '' +
      '<div class="bank-box">' +
        '<div class="bank-row"><span>입금 은행</span><b>' + U.esc(BANK.bank) + '</b></div>' +
        '<div class="bank-row"><span>계좌번호</span><b>' + U.esc(BANK.account) +
          ' <button class="btn ghost small" id="copyAcct">복사</button></b></div>' +
        '<div class="bank-row"><span>예금주</span><b>' + U.esc(BANK.holder) + '</b></div>' +
        '<div class="bank-row total"><span>' + label + ' 금액</span><b>' + U.won(amount) + '</b></div>' +
      '</div>' +
      '<div class="field" style="margin-top:12px"><label>입금하실 분 이름 <span style="color:var(--rose)">*</span></label>' +
        '<input id="depositor" placeholder="홍길동" autocomplete="name"></div>' +
      '<p class="hint">입금자명이 다르면 확인이 늦어질 수 있어요. 적어주신 이름으로 보내주세요.</p>' +
      '<button class="btn wide" id="reqPay">입금 신청하기</button>' +
      '<p class="hint" style="margin-top:8px">신청 후 입금해 주시면, 확인되는 대로 이용 기간이 늘어납니다 ' +
      '(보통 영업일 기준 하루 이내).</p>';
  }

  function pendingHtml(p) {
    var label = p.plan === 'yearly' ? '연 결제' : '월 결제';
    return '<div class="info"><b>⏳ 입금 확인을 기다리는 중입니다.</b><br>' +
      label + ' · <b>' + U.won(p.amount) + '</b> · 입금자명 <b>' + U.esc(p.depositor_name || '-') + '</b><br>' +
      '신청일 ' + U.korDateFull(String(p.created_at).slice(0, 10)) + '</div>' +
      (bankReady()
        ? '<div class="bank-box" style="margin-top:12px">' +
            '<div class="bank-row"><span>입금 계좌</span><b>' + U.esc(BANK.bank) + ' ' + U.esc(BANK.account) + '</b></div>' +
            '<div class="bank-row"><span>예금주</span><b>' + U.esc(BANK.holder) + '</b></div>' +
            '<div class="bank-row total"><span>보내실 금액</span><b>' + U.won(p.amount) + '</b></div>' +
          '</div>' : '') +
      '<p class="hint" style="margin-top:10px">아직 입금 전이시면 위 계좌로 보내주세요. ' +
      '확인되면 자동으로 이용 기간이 늘어납니다.</p>';
  }

  function bindCancelHint(view) {
    var c = U.$('#copyAcct', view);
    if (c) c.onclick = function (e) { e.preventDefault(); U.copyText(BANK.account); };
  }

  /* ---------- 관리자: 입금 확인 ---------- */
  function drawAdmin(view) {
    var box = U.$('#adminBox', view);
    if (!box) return;
    SB.amIAdmin().then(function (isAdmin) {
      if (!isAdmin) { box.innerHTML = ''; return; }
      return SB.adminPayments('pending').then(function (rows) {
        box.innerHTML =
          '<div class="card"><h2>🔑 입금 받을 계좌 (관리자)</h2>' +
            '<p class="hint">여기에 적은 계좌가 회원들의 구독 화면에 보입니다.</p>' +
            '<div class="grid three">' +
              '<div class="field"><label>은행</label><input id="bkBank" value="' + U.esc(BANK.bank) + '" placeholder="국민은행"></div>' +
              '<div class="field"><label>계좌번호</label><input id="bkAcct" value="' + U.esc(BANK.account) + '" placeholder="123456-78-901234"></div>' +
              '<div class="field"><label>예금주</label><input id="bkHold" value="' + U.esc(BANK.holder) + '" placeholder="홍길동"></div>' +
            '</div>' +
            '<div class="row end"><button class="btn" id="bkSave">계좌 저장</button></div>' +
          '</div>' +
          '<div class="card"><h2>🔑 입금 확인 (관리자)</h2>' +
          (!rows || !rows.length
            ? '<div class="empty">확인을 기다리는 입금 신청이 없어요.</div>'
            : '<div class="table-wrap"><table><thead><tr><th>신청일</th><th>가게</th><th>입금자명</th>' +
              '<th class="num">금액</th><th>요금제</th><th></th></tr></thead><tbody>' +
              rows.map(function (r) {
                return '<tr><td>' + U.korDate(String(r.created_at).slice(0, 10)) + '</td>' +
                  '<td>' + U.esc(r.shop_name) + '<br><span class="cap-sub">' + U.esc(r.email) + '</span></td>' +
                  '<td>' + U.esc(r.depositor_name || '-') + '</td>' +
                  '<td class="num">' + U.won(r.amount) + '</td>' +
                  '<td>' + (r.plan === 'yearly' ? '연' : '월') + '</td>' +
                  '<td class="num"><button class="btn mint small" data-approve="' + r.id + '">입금 확인</button> ' +
                  '<button class="btn ghost small" data-reject="' + r.id + '">취소</button></td></tr>';
              }).join('') + '</tbody></table></div>') + '</div>';

        var save = U.$('#bkSave', box);
        if (save) save.onclick = function () {
          var cfg = {
            bank: U.$('#bkBank', box).value.trim(),
            account: U.$('#bkAcct', box).value.trim(),
            holder: U.$('#bkHold', box).value.trim()
          };
          save.disabled = true;
          SB.saveServiceConfig(cfg).then(function () {
            BANK = cfg;
            U.toast('계좌를 저장했어요');
            save.disabled = false;
            drawPayState(view);
          }).catch(function (err) { save.disabled = false; U.toast(err.message); });
        };

        box.addEventListener('click', function (e) {
          var t = e.target;
          if (t.dataset.approve) {
            if (!U.confirmBox('입금을 확인하고 이용 기간을 늘릴까요?')) return;
            t.disabled = true;
            SB.approvePayment(t.dataset.approve).then(function () {
              U.toast('처리했어요'); drawAdmin(view);
            }).catch(function (err) { t.disabled = false; U.toast(err.message); });
          }
          if (t.dataset.reject) {
            if (!U.confirmBox('이 신청을 취소할까요?')) return;
            SB.rejectPayment(t.dataset.reject).then(function () {
              U.toast('취소했어요'); drawAdmin(view);
            }).catch(function (err) { U.toast(err.message); });
          }
        });
      });
    }).catch(function () { box.innerHTML = ''; });
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
