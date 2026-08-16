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
    settings: Settings
  };

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
    U.$$('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.route === route);
    });
    try {
      ROUTES[route].render(view);
    } catch (e) {
      view.innerHTML = '<div class="card"><h2>문제가 생겼어요</h2><p class="hint">' +
        U.esc(e.message) + '</p><button class="btn ghost" onclick="location.hash=\'#home\'">홈으로</button></div>';
      console.error(e);
    }
    refreshShopName();
    window.scrollTo({ top: 0 });
  }

  function refreshShopName() {
    var s = DB.settings();
    var name = s.shopName || '케이크 공방';
    U.$('#shopName').textContent = name;
    // 보낼 알림이 있으면 브라우저 탭 제목에 건수를 붙여 놓치지 않게 함
    var n = 0;
    try { n = Notify.totalCount(); } catch (e) { n = 0; }
    document.title = (n ? '(' + n + ') ' : '') + name + ' 운영 노트';
  }

  function start() {
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
