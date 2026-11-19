/* 화면 전환(라우터) + 시작 */
window.App = (function () {

  var ROUTES = {
    home: Home,
    orders: Orders,
    monthly: Monthly,
    inventory: Inventory,
    gallery: Gallery,
    cost: Cost,
    notify: Notify,
    settings: Settings,
    subscribe: { render: function (v) { Auth.renderSubscribe(v); } }
  };

  // 이용 기간이 끝나도 자료를 보고 내려받는 것은 막지 않습니다
  var READ_ONLY_OK = ['home', 'monthly', 'orders', 'gallery', 'cost', 'settings', 'subscribe'];

  function current() {
    var r = (location.hash || '#home').slice(1);
    return ROUTES[r] ? r : 'home';
  }

  function render() {
    var route = current();
    // 화면을 새 요소로 갈아끼웁니다.
    // (이전 화면에 붙여둔 클릭 이벤트가 쌓여서 두 번씩 실행되는 것을 막기 위함)
    var old = U.$('#view');
    var view = document.createElement('main');
    view.id = 'view';
    view.className = 'view';
    old.parentNode.replaceChild(view, old);
    // 비밀번호 재설정 링크로 들어왔으면 새 비밀번호부터 정합니다
    if (Auth.isRecovering()) {
      document.body.classList.add('logged-out');
      try { Auth.renderNewPassword(view); } catch (e) { console.error(e); }
      window.scrollTo({ top: 0 });
      return;
    }
    // 로그인하지 않았으면 회원가입 / 로그인 화면만 보여줍니다
    if (!SB.loggedIn()) {
      document.body.classList.add('logged-out');
      try { Auth.renderGate(view); } catch (e) { console.error(e); }
      window.scrollTo({ top: 0 });
      return;
    }
    document.body.classList.remove('logged-out');

    U.$$('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.route === route);
    });

    // 이용 기간이 끝났으면, 쓰기가 필요한 화면은 구독 안내로 바꿔줍니다
    var acc = Auth.info();
    if (acc && !acc.active && READ_ONLY_OK.indexOf(route) < 0) {
      view.innerHTML = Auth.banner();
      var sub = document.createElement('div');
      view.appendChild(sub);
      Auth.renderExpired(sub);
      bindBanner(view);
      window.scrollTo({ top: 0 });
      return;
    }

    try {
      view.insertAdjacentHTML('afterbegin', Auth.banner());
      bindBanner(view);
      var host = document.createElement('div');
      view.appendChild(host);
      ROUTES[route].render(host);
    } catch (e) {
      view.innerHTML = '<div class="card"><h2>문제가 생겼어요</h2><p class="hint">' +
        U.esc(e.message) + '</p><button class="btn ghost" onclick="location.hash=\'#home\'">홈으로</button></div>';
      console.error(e);
    }
    refreshShopName();
    window.scrollTo({ top: 0 });
  }

  function bindBanner(view) {
    view.addEventListener('click', function (e) {
      var go = e.target.dataset && e.target.dataset.go;
      if (go && (go === 'subscribe' || ROUTES[go])) location.hash = '#' + go;
    });
  }

  function refreshShopName() {
    var s = DB.settings();
    var name = s.shopName || '내 가게';
    U.$('#shopName').textContent = name;
    // 보낼 알림이 있으면 브라우저 탭 제목에 건수를 붙여 놓치지 않게 함
    var n = 0;
    try { n = Notify.totalCount(); } catch (e) { n = 0; }
    document.title = (n ? '(' + n + ') ' : '') + name + ' · 1인CEO 운영노트';
    refreshAcctChip();
  }

  // 상단 오른쪽: 저장 상태 + 계정 메뉴
  function refreshAcctChip() {
    var chip = U.$('#acctChip');
    if (!chip) return;
    if (!SB.loggedIn()) { chip.innerHTML = ''; return; }
    var st = Sync.status();
    var cls = st.busy ? 'busy' : (st.error ? 'err' : '');
    chip.innerHTML =
      '<button class="acct-btn" id="syncBtn" title="' + U.esc(Sync.lastText()) + '">' +
        '<span class="sync-dot ' + cls + '"></span> ' +
        (st.pending ? st.pending + '건 저장 대기' : '저장됨') + '</button>' +
      '<button class="acct-btn" id="acctBtn">👤 내 계정</button>';
    U.$('#syncBtn').onclick = function () { Sync.run(); U.toast('서버와 맞추는 중...'); };
    U.$('#acctBtn').onclick = function () { location.hash = '#settings'; };
  }

  function start() {
    SB.loadSession();
    // 메일 링크(인증·비밀번호 재설정)를 눌러서 들어온 경우 주소에 붙어 온 로그인 정보를 받습니다
    var urlSession = null;
    try { urlSession = SB.captureUrlSession(); } catch (e) { urlSession = null; }
    if (SB.loggedIn()) DB.setScope(SB.userId());
    Seed.installIfEmpty();
    refreshShopName();
    U.$('#todayLabel').textContent = U.korDateFull(U.today());

    U.$$('#tabs button').forEach(function (b) {
      b.onclick = function () { location.hash = '#' + b.dataset.route; };
    });
    window.addEventListener('hashchange', render);

    U.$('#modalClose').onclick = U.closeModal;
    U.$('#modal').addEventListener('click', function (e) {
      if (e.target.id === 'modal') U.closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !U.$('#modal').hidden) U.closeModal();
    });

    if (!DB.storageOk) {
      U.toast('저장이 안 되는 환경이에요. 설정 화면의 안내를 확인해 주세요.');
    }
    render();

    // 메일 링크로 들어온 경우: 비밀번호 재설정이면 새 비밀번호 화면, 그 밖에는 바로 로그인
    if (urlSession && urlSession.then) {
      urlSession.then(function (kind) {
        if (kind === 'recovery') {
          Auth.setRecovering(true);
          render();
          return;
        }
        DB.setScope(SB.userId());
        return Auth.afterLogin().catch(function () { render(); });
      }).catch(function () { render(); });
      return;
    }

    // 로그인 상태면 서버에서 최신 자료를 가져오고 자동 저장을 켭니다
    if (SB.loggedIn()) {
      Auth.refreshAccess().then(function () {
        render();
        // 카드 결제창에서 돌아온 경우 결제를 확정합니다
        return Auth.handleTossReturn();
      }).then(function (paid) {
        if (paid) { location.hash = '#subscribe'; render(); }
        return Sync.run({ rerender: false });
      }).then(function () {
        Sync.start();
        render();
      }).catch(function (e) {
        U.toast('서버 연결 실패 — 이 컴퓨터의 자료로 계속 쓰실 수 있어요');
        console.warn(e);
      });
    }
    autoPull();
  }

  // "열 때마다 최신 자료 불러오기"를 켜둔 경우 (주로 알바생 컴퓨터)
  function autoPull() {
    if (!Cloud.cfg().autoPull || !Cloud.configured()) return;
    U.toast('최신 자료를 불러오는 중...');
    Cloud.download(function () {})
      .then(function (r) {
        U.toast('최신 자료를 불러왔어요 (주문 ' + r.orders + '건)');
        render();
      })
      .catch(function (e) {
        U.toast('자동 불러오기 실패 — ' + String(e.message).split('\n')[0]);
      });
  }

  // 화면이 이미 준비된 뒤에 불러와도 정상 동작하도록
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  return { render: render, refreshShopName: refreshShopName };
})();
