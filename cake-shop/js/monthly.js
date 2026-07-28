/* 월별 정산 - 한 달(1일~말일) 주문 전체 리스트 + 매출/원가 한눈에 보기 */
window.Monthly = (function () {

  var month = U.thisMonth();

  function render(view) {
    var orders = Orders.byMonth(month);
    var live = orders.filter(function (o) { return o.status !== 'canceled'; });

    var sales = sum(live, 'price');
    var cost = sum(live, 'cost');
    var profit = sales - cost;
    var rate = sales ? Math.round(profit / sales * 100) : 0;
    var deposit = sum(live.filter(function (o) { return o.status !== 'done'; }), 'deposit');

    view.innerHTML = '' +
      '<div class="card">' +
        '<div class="cal-head">' +
          '<button class="btn ghost small" id="mPrev">‹ 이전달</button>' +
          '<div class="cal-title">' + U.monthTitle(month) + ' 정산 <span class="cap-sub" style="font-weight:400">(1일~' + U.lastDayOfMonth(month) + '일)</span></div>' +
          '<button class="btn ghost small" id="mNext">다음달 ›</button>' +
        '</div>' +
        '<div class="grid four">' +
          tile('주문 건수', live.length + '건', '') +
          tile('총 매출', U.won(sales), 'rose') +
          tile('총 원가', U.won(cost), 'amber') +
          tile('순이익', U.won(profit) + ' (' + rate + '%)', 'mint') +
        '</div>' +
        (deposit ? '<p class="hint" style="margin-top:10px">받은 예약금 중 아직 픽업 전인 금액: <b>' + U.won(deposit) + '</b></p>' : '') +
      '</div>' +

      '<div class="card">' +
        '<div class="row"><h2 style="margin:0">📋 주문 전체 리스트</h2><div class="spacer"></div>' +
        '<button class="btn ghost small" id="mCsv">엑셀(CSV) 저장</button></div>' +
        (orders.length ? orderTable(orders) : '<div class="empty">이 달에는 주문이 없어요.</div>') +
      '</div>' +

      (live.length ? '<div class="card"><h2>🗓️ 날짜별 합계</h2>' + dailyTable(live) + '</div>' : '') +

      '<div class="card"><h2>🏆 케이크별 순위</h2>' +
        (live.length ? rankTable(live) : '<div class="empty">데이터가 없어요.</div>') +
      '</div>';

    bind(view, orders);
  }

  function sum(arr, key) {
    return arr.reduce(function (a, o) { return a + U.toNum(o[key]); }, 0);
  }
  function tile(label, value, cls) {
    return '<div class="stat ' + cls + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
  }

  function orderTable(orders) {
    var rows = orders.map(function (o) {
      var profit = U.toNum(o.price) - U.toNum(o.cost);
      return '<tr' + (o.status === 'canceled' ? ' style="opacity:.45"' : '') + '>' +
        '<td>' + U.korDate(o.pickupDate) + '<br><span class="cap-sub">' + U.esc(o.pickupTime || '') + '</span></td>' +
        '<td><b>' + U.esc(o.customerName) + '</b><br><span class="cap-sub">' + U.esc(U.phone(o.phone)) + '</span></td>' +
        '<td>' + U.esc(o.request || '') + (o.note ? '<br><span class="cap-sub">📌 ' + U.esc(o.note) + '</span>' : '') + '</td>' +
        '<td class="num">' + U.num(o.price) + '</td>' +
        '<td class="num">' + U.num(o.cost) + '</td>' +
        '<td class="num" style="color:' + (profit >= 0 ? 'var(--mint)' : 'var(--red)') + '"><b>' + U.num(profit) + '</b></td>' +
        '<td><span class="badge ' + Orders.statusCls(o.status) + '">' + Orders.statusText(o.status) + '</span></td>' +
        '</tr>';
    }).join('');
    var live = orders.filter(function (o) { return o.status !== 'canceled'; });
    return '<div class="table-wrap"><table>' +
      '<thead><tr><th>픽업날짜</th><th>고객</th><th>주문내용</th><th class="num">매출</th><th class="num">원가</th><th class="num">이익</th><th>상태</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="3">합계 (취소 제외)</td>' +
        '<td class="num">' + U.num(sum(live, 'price')) + '</td>' +
        '<td class="num">' + U.num(sum(live, 'cost')) + '</td>' +
        '<td class="num">' + U.num(sum(live, 'price') - sum(live, 'cost')) + '</td><td></td></tr></tfoot>' +
      '</table></div>';
  }

  function dailyTable(live) {
    var map = {};
    live.forEach(function (o) {
      var d = o.pickupDate;
      if (!map[d]) map[d] = { n: 0, price: 0, cost: 0 };
      map[d].n++; map[d].price += U.toNum(o.price); map[d].cost += U.toNum(o.cost);
    });
    var rows = Object.keys(map).sort().map(function (d) {
      var v = map[d];
      return '<tr><td>' + U.korDate(d) + '</td><td class="num">' + v.n + '건</td>' +
        '<td class="num">' + U.num(v.price) + '</td><td class="num">' + U.num(v.cost) + '</td>' +
        '<td class="num">' + U.num(v.price - v.cost) + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>날짜</th><th class="num">건수</th>' +
      '<th class="num">매출</th><th class="num">원가</th><th class="num">이익</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function rankTable(live) {
    var map = {};
    live.forEach(function (o) {
      // 주문내용 첫 줄을 케이크 이름처럼 사용
      var key = (o.request || '기타').split('\n')[0].slice(0, 24) || '기타';
      if (!map[key]) map[key] = { n: 0, price: 0 };
      map[key].n++; map[key].price += U.toNum(o.price);
    });
    var rows = Object.keys(map).map(function (k) { return { k: k, v: map[k] }; })
      .sort(function (a, b) { return b.v.n - a.v.n || b.v.price - a.v.price; })
      .slice(0, 10)
      .map(function (x, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + U.esc(x.k) + '</td><td class="num">' + x.v.n + '건</td>' +
          '<td class="num">' + U.num(x.v.price) + '</td></tr>';
      }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>순위</th><th>주문내용</th><th class="num">건수</th><th class="num">매출</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function bind(view, orders) {
    U.$('#mPrev', view).onclick = function () { month = U.shiftMonth(month, -1); App.render(); };
    U.$('#mNext', view).onclick = function () { month = U.shiftMonth(month, 1); App.render(); };
    U.$('#mCsv', view).onclick = function () {
      var rows = [['픽업날짜', '픽업시간', '고객이름', '연락처', '주문요청사항', '가격(매출)', '원가', '이익', '예약금', '참고사항', '경로', '상태']];
      orders.forEach(function (o) {
        rows.push([o.pickupDate, o.pickupTime || '', o.customerName, U.phone(o.phone), o.request || '',
          U.toNum(o.price), U.toNum(o.cost), U.toNum(o.price) - U.toNum(o.cost), U.toNum(o.deposit),
          o.note || '', o.source || '', Orders.statusText(o.status)]);
      });
      U.downloadCsv(month + '_주문정산.csv', rows);
      U.toast('CSV 파일을 저장했어요');
    };
  }

  return { render: render, setMonth: function (m) { month = m; } };
})();
