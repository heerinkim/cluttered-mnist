/* 재고 현황 - 케이크 상자, 보냉백, 리본 등 */
window.Inventory = (function () {

  var CATEGORIES = ['상자', '보냉백', '리본', '초·장식', '받침·트레이', '포장지', '기타'];
  var filter = '전체';

  function render(view) {
    var items = DB.list('inventory');
    var shown = filter === '전체' ? items : items.filter(function (i) { return i.category === filter; });
    shown = shown.slice().sort(function (a, b) {
      return (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || '');
    });

    var low = items.filter(isLow);
    var totalValue = items.reduce(function (a, i) { return a + U.toNum(i.qty) * U.toNum(i.unitPrice); }, 0);

    view.innerHTML = '' +
      '<div class="card">' +
        '<div class="grid three">' +
          tile('전체 품목', items.length + '종', '') +
          tile('재고 금액', U.won(totalValue), 'rose') +
          tile('부족 품목', low.length + '종', low.length ? 'amber' : 'mint') +
        '</div>' +
        (low.length ? '<div class="warn" style="margin-top:12px">⚠️ <b>주문이 필요해요:</b> ' +
          low.map(function (i) { return U.esc(i.name) + ' (' + U.num(i.qty) + U.esc(i.unit || '개') + ' 남음)'; }).join(', ') + '</div>' : '') +
      '</div>' +

      '<div class="card">' +
        '<div class="row"><h2 style="margin:0">📦 재고 현황</h2><div class="spacer"></div>' +
          '<button class="btn ghost small" id="invCsv">CSV 저장</button>' +
          '<button class="btn small" id="addItem">+ 품목 추가</button></div>' +
        '<div class="row" style="margin:10px 0">' +
          ['전체'].concat(CATEGORIES).map(function (c) {
            return '<button class="btn ' + (c === filter ? '' : 'ghost') + ' small" data-filter="' + c + '">' + c + '</button>';
          }).join('') +
        '</div>' +
        (shown.length ? table(shown) : '<div class="empty">등록된 품목이 없어요. [+ 품목 추가]를 눌러보세요.</div>') +
        '<p class="hint" style="margin-top:10px">➖ ➕ 버튼으로 수량을 바로 조절할 수 있어요. ' +
        '현재 수량이 안전재고 이하가 되면 빨갛게 표시되고 위에 알려드립니다.</p>' +
      '</div>';

    bind(view, shown);
  }

  function isLow(i) {
    var min = U.toNum(i.minQty);
    return min > 0 && U.toNum(i.qty) <= min;
  }
  function tile(label, value, cls) {
    return '<div class="stat ' + cls + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
  }

  function table(items) {
    var rows = items.map(function (i) {
      var qty = U.toNum(i.qty), unit = i.unit || '개';
      return '<tr' + (isLow(i) ? ' class="low"' : '') + '>' +
        '<td><b>' + U.esc(i.name) + '</b>' + (i.memo ? '<br><span class="cap-sub">' + U.esc(i.memo) + '</span>' : '') + '</td>' +
        '<td><span class="badge gray">' + U.esc(i.category || '기타') + '</span></td>' +
        '<td class="num" style="white-space:nowrap">' +
          '<button class="icon-btn" data-minus="' + i.id + '">➖</button>' +
          '<b style="display:inline-block;min-width:46px">' + U.num(qty) + '</b>' +
          '<button class="icon-btn" data-plus="' + i.id + '">➕</button>' +
          ' <span class="cap-sub">' + U.esc(unit) + '</span>' +
        '</td>' +
        '<td class="num">' + (U.toNum(i.minQty) || '-') + '</td>' +
        '<td class="num">' + U.won(i.unitPrice) + '</td>' +
        '<td class="num">' + U.won(qty * U.toNum(i.unitPrice)) + '</td>' +
        '<td class="num">' + (isLow(i) ? '<span class="badge red">부족</span>' : '<span class="badge mint">충분</span>') + '</td>' +
        '<td class="num"><button class="icon-btn" data-edit="' + i.id + '">✏️</button>' +
        '<button class="icon-btn" data-del="' + i.id + '">🗑️</button></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>품목</th><th>분류</th><th class="num">현재 수량</th>' +
      '<th class="num">안전재고</th><th class="num">개당 단가</th><th class="num">재고 금액</th><th class="num">상태</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function itemModal(id) {
    var it = id ? DB.find('inventory', id) : { name: '', category: '상자', qty: 0, unit: '개', minQty: 10, unitPrice: 0, memo: '' };
    var html = '' +
      '<div class="field"><label>품목명 <span style="color:var(--rose)">*</span></label>' +
        '<input id="iName" value="' + U.esc(it.name) + '" placeholder="예: 1호 케이크 상자 (화이트)"></div>' +
      '<div class="grid two">' +
        '<div class="field"><label>분류</label><select id="iCat">' +
          CATEGORIES.map(function (c) { return '<option' + (c === it.category ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><label>단위</label><input id="iUnit" value="' + U.esc(it.unit || '개') + '" placeholder="개, 롤, 장"></div>' +
        '<div class="field"><label>현재 수량</label><input id="iQty" type="number" step="any" value="' + U.esc(it.qty) + '"></div>' +
        '<div class="field"><label>안전재고 (이하면 알림)</label><input id="iMin" type="number" step="any" value="' + U.esc(it.minQty) + '"></div>' +
        '<div class="field"><label>개당 단가(원)</label><input id="iPrice" type="number" step="any" value="' + U.esc(it.unitPrice) + '"></div>' +
        '<div class="field"><label>구매처 링크 (선택)</label><input id="iUrl" value="' + U.esc(it.url || '') + '" placeholder="https://"></div>' +
      '</div>' +
      '<div class="field"><label>메모</label><input id="iMemo" value="' + U.esc(it.memo || '') + '" placeholder="예: 100개 묶음 구매"></div>' +
      '<div class="row end"><button class="btn ghost" id="iCancel">취소</button><button class="btn" id="iSave">저장</button></div>';

    U.modal(id ? '품목 수정' : '품목 추가', html, function (body) {
      U.$('#iCancel', body).onclick = U.closeModal;
      U.$('#iSave', body).onclick = function () {
        var name = U.$('#iName', body).value.trim();
        if (!name) { U.toast('품목명을 적어주세요'); return; }
        DB.upsert('inventory', {
          id: it.id, name: name,
          category: U.$('#iCat', body).value,
          unit: U.$('#iUnit', body).value.trim() || '개',
          qty: U.toNum(U.$('#iQty', body).value),
          minQty: U.toNum(U.$('#iMin', body).value),
          unitPrice: U.toNum(U.$('#iPrice', body).value),
          url: U.$('#iUrl', body).value.trim(),
          memo: U.$('#iMemo', body).value.trim()
        });
        U.closeModal(); U.toast('저장했어요'); App.render();
      };
    });
  }

  function adjust(id, delta) {
    var it = DB.find('inventory', id); if (!it) return;
    var next = Math.max(0, U.toNum(it.qty) + delta);
    DB.upsert('inventory', { id: id, qty: next });
    App.render();
  }

  function bind(view, shown) {
    U.$('#addItem', view).onclick = function () { itemModal(null); };
    U.$('#invCsv', view).onclick = function () {
      var rows = [['품목명', '분류', '현재수량', '단위', '안전재고', '개당단가', '재고금액', '메모']];
      DB.list('inventory').forEach(function (i) {
        rows.push([i.name, i.category, U.toNum(i.qty), i.unit, U.toNum(i.minQty), U.toNum(i.unitPrice),
          U.toNum(i.qty) * U.toNum(i.unitPrice), i.memo || '']);
      });
      U.downloadCsv('재고현황.csv', rows);
    };
    view.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.filter) { filter = t.dataset.filter; App.render(); }
      if (t.dataset.edit) itemModal(t.dataset.edit);
      if (t.dataset.del && U.confirmBox('이 품목을 삭제할까요?')) { DB.remove('inventory', t.dataset.del); App.render(); }
      if (t.dataset.plus) adjust(t.dataset.plus, 1);
      if (t.dataset.minus) adjust(t.dataset.minus, -1);
    });
  }

  return { render: render, CATEGORIES: CATEGORIES, isLow: isLow };
})();
