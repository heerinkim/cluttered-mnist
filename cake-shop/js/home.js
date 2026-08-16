/* 홈 - 오늘 할 일 한눈에 보기 */
window.Home = (function () {

  function render(view) {
    var today = U.today();
    var tomorrow = U.addDays(today, 1);
    var month = U.thisMonth();
    var todayList = Orders.byDate(today).filter(function (o) { return o.status !== 'canceled'; });
    var tomorrowList = Orders.byDate(tomorrow).filter(function (o) { return o.status !== 'canceled'; });
    var live = Orders.byMonth(month).filter(function (o) { return o.status !== 'canceled'; });
    var sales = live.reduce(function (a, o) { return a + U.toNum(o.price); }, 0);
    // 원가는 월별정산과 똑같은 기준으로 (주문서 값 우선, 없으면 원가표에서)
    var cost = live.reduce(function (a, o) { return a + Cost.orderCost(o).value; }, 0);
    var q = Notify.queue();
    var notifyCount = Notify.STAGES.reduce(function (a, s) { return a + q[s.key].length; }, 0);
    var lowStock = DB.list('inventory').filter(Inventory.isLow);

    view.innerHTML = '' +
      '<div class="card">' +
        '<h2>👋 오늘도 좋은 하루 되세요!</h2>' +
        '<div class="grid four">' +
          tile('오늘 픽업', todayList.length + '건', todayList.length ? 'rose' : '') +
          tile('내일 픽업', tomorrowList.length + '건', '') +
          tile(U.monthTitle(month) + ' 매출', U.won(sales), 'mint') +
          tile('보낼 알림', notifyCount + '건', notifyCount ? 'amber' : '') +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<h2>🎂 오늘 픽업 (' + U.korDateFull(today) + ')</h2>' +
        (todayList.length ? list(todayList) : '<div class="empty">오늘 픽업 예정인 케이크가 없어요.</div>') +
      '</div>' +

      '<div class="card">' +
        '<h2>⏰ 내일 준비할 것</h2>' +
        (tomorrowList.length ? list(tomorrowList) : '<div class="empty">내일 픽업 예정이 없어요.</div>') +
      '</div>' +

      '<div class="card">' +
        '<h2>📊 이번 달 요약</h2>' +
        '<div class="grid four">' +
          tile('주문', live.length + '건', '') +
          tile('매출', U.won(sales), 'rose') +
          tile('원가', U.won(cost), 'amber') +
          tile('이익', U.won(sales - cost), 'mint') +
        '</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn ghost small" data-go="monthly">월별정산 자세히 보기 →</button></div>' +
      '</div>' +

      (lowStock.length ? '<div class="card"><h2>📦 재고가 부족해요</h2>' +
        '<div class="warn">' + lowStock.map(function (i) {
          return U.esc(i.name) + ' <b>' + U.num(i.qty) + U.esc(i.unit || '개') + '</b> 남음';
        }).join('<br>') + '</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn ghost small" data-go="inventory">재고 관리로 가기 →</button></div></div>' : '') +

      backupReminder() +

      '<div class="card">' +
        '<h2>⚡ 바로 가기</h2>' +
        '<div class="row">' +
          '<button class="btn" data-go="orders">📝 주문 등록</button>' +
          '<button class="btn ghost" data-go="cost">🧮 원가 계산</button>' +
          '<button class="btn ghost" data-go="notify">💬 알림 보내기</button>' +
          '<button class="btn ghost" data-go="gallery">🖼️ 갤러리</button>' +
        '</div>' +
      '</div>';

    view.addEventListener('click', function (e) {
      if (e.target.dataset.go) location.hash = '#' + e.target.dataset.go;
    });
  }

  function tile(label, value, cls) {
    return '<div class="stat ' + cls + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
  }

  // 백업한 지 오래됐으면 알려줍니다 (자료를 잃지 않는 게 제일 중요해서)
  function backupReminder() {
    var last = Cloud.cfg().lastSyncAt;
    var days = last ? U.diffDays(last.slice(0, 10), U.today()) : 999;
    if (days < 3) return '';
    var msg = !last
      ? '아직 깃허브에 백업한 적이 없어요. 컴퓨터가 고장 나면 자료가 사라집니다.'
      : '마지막 백업이 <b>' + days + '일 전</b>이에요. 오늘 자료를 올려두세요.';
    return '<div class="card"><h2>☁️ 백업하셨나요?</h2>' +
      '<div class="warn">' + msg + '</div>' +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn" data-go="settings">지금 백업하러 가기 →</button></div></div>';
  }

  function list(orders) {
    return '<div class="table-wrap"><table><thead><tr><th>시간</th><th>고객</th><th>주문내용</th><th class="num">잔금</th><th>상태</th></tr></thead><tbody>' +
      orders.map(function (o) {
        var rest = Math.max(0, U.toNum(o.price) - U.toNum(o.deposit));
        return '<tr><td><b>' + U.esc(o.pickupTime || '-') + '</b></td>' +
          '<td>' + U.esc(o.customerName) + '<br><span class="cap-sub">' + U.esc(U.phone(o.phone)) + '</span></td>' +
          '<td>' + U.esc(o.request || '') + (o.note ? '<br><span class="cap-sub">📌 ' + U.esc(o.note) + '</span>' : '') + '</td>' +
          '<td class="num">' + U.won(rest) + '</td>' +
          '<td><span class="badge ' + Orders.statusCls(o.status) + '">' + Orders.statusText(o.status) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  return { render: render };
})();
