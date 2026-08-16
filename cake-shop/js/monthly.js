/* 월별 정산 - 한 달(1일~말일) 주문 전체 리스트 + 매출/원가 한눈에 보기
   원가는 주문서에 적어둔 값을 우선 쓰고, 비어 있으면 [원가표] 값을 자동으로 가져옵니다. */
window.Monthly = (function () {

  var month = U.thisMonth();

  function render(view) {
    var orders = Orders.byMonth(month);
    var live = orders.filter(function (o) { return o.status !== 'canceled'; });

    var sales = sum(live, 'price');
    var cost = live.reduce(function (a, o) { return a + Cost.orderCost(o).value; }, 0);
    var profit = sales - cost;
    var rate = sales ? Math.round(profit / sales * 100) : 0;
    var deposit = sum(live.filter(function (o) { return o.status !== 'done'; }), 'deposit');

    // 원가가 어디서 왔는지 세어봅니다
    var fromMenu = live.filter(function (o) { return Cost.orderCost(o).from === 'menu'; });
    var noCost = live.filter(function (o) { return Cost.orderCost(o).from === 'none'; });

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
        costNotice(fromMenu, noCost) +
      '</div>' +

      '<div class="card">' +
        '<div class="row"><h2 style="margin:0">📋 주문 전체 리스트</h2><div class="spacer"></div>' +
        '<button class="btn ghost small" id="mRecalc">🔄 원가 전체 다시 계산</button>' +
        '<button class="btn ghost small" id="mCsv">엑셀(CSV) 저장</button></div>' +
        (orders.length ? orderTable(orders) : '<div class="empty">이 달에는 주문이 없어요.</div>') +
        '<p class="hint" style="margin-top:10px">' +
          '<span class="badge">원가표</span> 표시는 주문서에 원가를 적지 않아서 ' +
          '<b>원가표에서 자동으로 가져온</b> 값이라는 뜻입니다.</p>' +
      '</div>' +

      (live.length ? '<div class="card"><h2>🗓️ 날짜별 합계</h2>' + dailyTable(live) + '</div>' : '') +

      '<div class="card"><h2>🏆 케이크별 순위</h2>' +
        (live.length ? rankTable(live) : '<div class="empty">데이터가 없어요.</div>') +
      '</div>';

    bind(view, orders, fromMenu);
  }

  /* ---------- 원가 출처 안내 ---------- */
  function costNotice(fromMenu, noCost) {
    var html = '';
    if (fromMenu.length) {
      html += '<div class="info" style="margin-top:12px">💰 원가를 적지 않은 주문 <b>' + fromMenu.length + '건</b>은 ' +
        '<b>원가표 값으로 자동 계산</b>해서 위 금액에 넣었어요. ' +
        '<button class="btn ghost small" id="mFill" style="margin-left:6px">주문서에 저장해 두기</button></div>';
    }
    if (noCost.length) {
      html += '<div class="warn" style="margin-top:10px">⚠️ 원가를 알 수 없는 주문이 <b>' + noCost.length + '건</b> 있어요 ' +
        '(' + noCost.slice(0, 3).map(function (o) { return U.esc(o.customerName); }).join(', ') +
        (noCost.length > 3 ? ' 외' : '') + '). ' +
        '<b>원가표</b>에 해당 메뉴를 추가하거나 주문서에 원가를 직접 적어주세요. ' +
        '<button class="btn ghost small" id="mGoCost" style="margin-left:6px">원가표로 가기</button></div>';
    }
    return html;
  }

  function sum(arr, key) {
    return arr.reduce(function (a, o) { return a + U.toNum(o[key]); }, 0);
  }
  function tile(label, value, cls) {
    return '<div class="stat ' + cls + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
  }

  function orderTable(orders) {
    var rows = orders.map(function (o) {
      var c = Cost.orderCost(o);
      var profit = U.toNum(o.price) - c.value;
      var costCell = c.from === 'none'
        ? '<span class="badge red">없음</span>'
        : U.num(c.value) + (c.from === 'menu' ? ' <span class="badge">원가표</span>' : '');
      return '<tr' + (o.status === 'canceled' ? ' style="opacity:.45"' : '') + '>' +
        '<td>' + U.korDate(o.pickupDate) + '<br><span class="cap-sub">' + U.esc(o.pickupTime || '') + '</span></td>' +
        '<td><b>' + U.esc(o.customerName) + '</b><br><span class="cap-sub">' + U.esc(U.phone(o.phone)) + '</span></td>' +
        '<td>' + U.esc(o.request || '') + (o.note ? '<br><span class="cap-sub">📌 ' + U.esc(o.note) + '</span>' : '') + '</td>' +
        '<td class="num">' + U.num(o.price) + '</td>' +
        '<td class="num">' + costCell + '</td>' +
        '<td class="num" style="color:' + (profit >= 0 ? 'var(--mint)' : 'var(--red)') + '"><b>' + U.num(profit) + '</b></td>' +
        '<td><span class="badge ' + Orders.statusCls(o.status) + '">' + Orders.statusText(o.status) + '</span></td>' +
        '</tr>';
    }).join('');

    var live = orders.filter(function (o) { return o.status !== 'canceled'; });
    var totalSales = sum(live, 'price');
    var totalCost = live.reduce(function (a, o) { return a + Cost.orderCost(o).value; }, 0);

    return '<div class="table-wrap"><table>' +
      '<thead><tr><th>픽업날짜</th><th>고객</th><th>주문내용</th><th class="num">매출</th><th class="num">원가</th><th class="num">이익</th><th>상태</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="3">합계 (취소 제외)</td>' +
        '<td class="num">' + U.num(totalSales) + '</td>' +
        '<td class="num">' + U.num(totalCost) + '</td>' +
        '<td class="num">' + U.num(totalSales - totalCost) + '</td><td></td></tr></tfoot>' +
      '</table></div>';
  }

  function dailyTable(live) {
    var map = {};
    live.forEach(function (o) {
      var d = o.pickupDate;
      if (!map[d]) map[d] = { n: 0, price: 0, cost: 0 };
      map[d].n++;
      map[d].price += U.toNum(o.price);
      map[d].cost += Cost.orderCost(o).value;
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
      // 원가표에서 찾은 메뉴 이름이 있으면 그걸로 묶고, 없으면 주문내용 첫 줄로 묶습니다
      var c = Cost.orderCost(o);
      var key = (c.name || (o.request || '기타').split('\n')[0].slice(0, 24)) || '기타';
      if (!map[key]) map[key] = { n: 0, price: 0, cost: 0 };
      map[key].n++;
      map[key].price += U.toNum(o.price);
      map[key].cost += c.value;
    });
    var rows = Object.keys(map).map(function (k) { return { k: k, v: map[k] }; })
      .sort(function (a, b) { return b.v.n - a.v.n || b.v.price - a.v.price; })
      .slice(0, 10)
      .map(function (x, i) {
        var p = x.v.price - x.v.cost;
        return '<tr><td>' + (i + 1) + '</td><td>' + U.esc(x.k) + '</td><td class="num">' + x.v.n + '건</td>' +
          '<td class="num">' + U.num(x.v.price) + '</td>' +
          '<td class="num">' + U.num(x.v.cost) + '</td>' +
          '<td class="num" style="color:' + (p >= 0 ? 'var(--mint)' : 'var(--red)') + '">' + U.num(p) + '</td></tr>';
      }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>순위</th><th>메뉴</th><th class="num">건수</th>' +
      '<th class="num">매출</th><th class="num">원가</th><th class="num">이익</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function bind(view, orders, fromMenu) {
    U.$('#mPrev', view).onclick = function () { month = U.shiftMonth(month, -1); App.render(); };
    U.$('#mNext', view).onclick = function () { month = U.shiftMonth(month, 1); App.render(); };

    var goCost = U.$('#mGoCost', view);
    if (goCost) goCost.onclick = function () { location.hash = '#cost'; };

    // 자동 계산된 원가를 주문서에 실제로 적어 둡니다
    var fill = U.$('#mFill', view);
    if (fill) fill.onclick = function () {
      if (!U.confirmBox('원가가 비어 있는 주문 ' + fromMenu.length + '건에 원가표 값을 넣을까요?')) return;
      var n = 0;
      fromMenu.forEach(function (o) {
        var c = Cost.orderCost(o);
        if (c.from === 'menu' && c.value > 0) { DB.upsert('orders', { id: o.id, cost: c.value }); n++; }
      });
      U.toast(n + '건의 원가를 저장했어요');
      App.render();
    };

    // 원가표를 고친 뒤 이번 달 전체를 다시 계산
    U.$('#mRecalc', view).onclick = function () {
      var live = orders.filter(function (o) { return o.status !== 'canceled'; });
      if (!U.confirmBox(U.monthTitle(month) + ' 주문 ' + live.length + '건의 원가를 원가표 기준으로 다시 계산합니다.\n' +
                        '주문서에 직접 적어두신 원가도 덮어씁니다. 계속할까요?')) return;
      var n = 0, miss = 0;
      live.forEach(function (o) {
        var r = Cost.calcFromText(o.request || '');
        if (r.ok) { DB.upsert('orders', { id: o.id, cost: Math.round(r.total / 10) * 10 }); n++; }
        else miss++;
      });
      U.toast(n + '건 다시 계산했어요' + (miss ? ' (원가표에 없는 ' + miss + '건은 그대로)' : ''));
      App.render();
    };

    U.$('#mCsv', view).onclick = function () {
      var rows = [['픽업날짜', '픽업시간', '고객이름', '연락처', '주문요청사항', '가격(매출)', '원가', '원가출처', '이익', '예약금', '참고사항', '경로', '상태']];
      orders.forEach(function (o) {
        var c = Cost.orderCost(o);
        rows.push([o.pickupDate, o.pickupTime || '', o.customerName, U.phone(o.phone), o.request || '',
          U.toNum(o.price), c.value,
          c.from === 'order' ? '직접 입력' : c.from === 'menu' ? '원가표' : '없음',
          U.toNum(o.price) - c.value, U.toNum(o.deposit),
          o.note || '', o.source || '', Orders.statusText(o.status)]);
      });
      U.downloadCsv(month + '_주문정산.csv', rows);
      U.toast('CSV 파일을 저장했어요');
    };
  }

  return { render: render, setMonth: function (m) { month = m; } };
})();
