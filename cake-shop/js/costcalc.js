/* 원가표 + 원가 계산
   1순위: 사장님이 직접 적어둔 [메뉴별 원가표]
   2순위: 원가표 이름 + 옵션 키워드(2단 ×1.8 등)
   3순위: (선택) 재료 단가 + 레시피로 계산 */
window.Cost = (function () {

  /* ================= 계산 엔진 ================= */

  // 띄어쓰기 제거 + 소문자 (이름 비교용)
  function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

  // 재료 1단위(1g, 1ml, 1개)당 가격
  function unitCost(ing) {
    var qty = U.toNum(ing.packQty);
    if (!qty) return 0;
    return U.toNum(ing.packPrice) / qty;
  }

  // 원가로부터 추천 판매가 (설정의 마진율 기준, 1,000원 단위 올림)
  function suggestPrice(cost) {
    var margin = Math.min(95, Math.max(0, U.toNum(DB.settings().defaultMarginPct))) / 100;
    if (margin >= 1) return Math.round(cost);
    return Math.ceil((cost / (1 - margin)) / 1000) * 1000;
  }

  // 레시피 1개의 원가 계산 (재료 + 포장 + 인건비)
  function recipeCost(recipe) {
    var ings = DB.list('ingredients');
    var inv = DB.list('inventory');
    var set = DB.settings();
    var lines = [], material = 0, packaging = 0;

    (recipe.items || []).forEach(function (it) {
      var ing = ings.find(function (x) { return x.id === it.ingId; });
      if (!ing) return;
      var cost = unitCost(ing) * U.toNum(it.qty);
      material += cost;
      lines.push({ kind: '재료', name: ing.name, qty: U.toNum(it.qty) + ing.unit, cost: cost });
    });

    (recipe.packItems || []).forEach(function (it) {
      var item = inv.find(function (x) { return x.id === it.invId; });
      if (!item) return;
      var cost = U.toNum(item.unitPrice) * U.toNum(it.qty);
      packaging += cost;
      lines.push({ kind: '포장', name: item.name, qty: U.toNum(it.qty) + (item.unit || '개'), cost: cost });
    });

    var labor = recipe.labor === '' || recipe.labor === undefined || recipe.labor === null
      ? U.toNum(set.laborPerCake) : U.toNum(recipe.labor);

    return { lines: lines, material: material, packaging: packaging, labor: labor,
             base: material + packaging + labor };
  }

  // 입력한 글에 들어있는 옵션 키워드 찾기
  function matchOptions(n) {
    var multiplier = 1, adds = [], applied = [];
    DB.list('options').forEach(function (op) {
      var k = norm(op.keyword);
      if (!k || n.indexOf(k) < 0) return;
      applied.push(op);
      if (op.type === 'multiply') multiplier *= U.toNum(op.value) || 1;
      else adds.push({ name: op.keyword, cost: U.toNum(op.value) });
    });
    return { multiplier: multiplier, adds: adds, applied: applied,
             addSum: adds.reduce(function (a, b) { return a + b.cost; }, 0) };
  }

  // 이름이 들어있는 항목 중 가장 긴(=구체적인) 것 고르기
  function bestMatch(listArr, n) {
    var found = null;
    listArr.forEach(function (x) {
      var xn = norm(x.name);
      if (xn && n.indexOf(xn) >= 0) {
        if (!found || xn.length > norm(found.name).length) found = x;
      }
    });
    return found;
  }

  /* 글로 적은 주문내용 -> 원가/판매가
     예: "생화케이크 2단", "딸기케이크 1호 레터링" */
  function calcFromText(text) {
    var n = norm(text);
    if (!n) return { ok: false, reason: '내용을 입력해 주세요.' };

    var menus = DB.list('menus');

    // 1순위 - 원가표에 이름이 똑같이 있으면 그 값을 그대로 사용
    var exact = menus.find(function (m) { return norm(m.name) === n; });
    if (exact) {
      return {
        ok: true, source: 'menu-exact', sourceLabel: '원가표에서 찾음',
        name: exact.name, input: text,
        total: Math.round(U.toNum(exact.cost)),
        price: Math.round(U.toNum(exact.price)) || 0,
        suggested: Math.round(U.toNum(exact.price)) || suggestPrice(U.toNum(exact.cost)),
        multiplier: 1, adds: [], applied: [], lines: []
      };
    }

    // 2순위 - 원가표 이름이 일부 들어있으면 + 옵션 키워드 적용
    var menu = bestMatch(menus, n);
    if (menu) {
      var op = matchOptions(n);
      var base = U.toNum(menu.cost);
      var total = base * op.multiplier + op.addSum;
      var basePrice = U.toNum(menu.price);
      var suggested = basePrice
        ? Math.ceil((basePrice * op.multiplier + op.addSum) / 1000) * 1000
        : suggestPrice(total);
      return {
        ok: true, source: 'menu-option',
        sourceLabel: op.applied.length ? '원가표 + 옵션 적용' : '원가표에서 찾음',
        name: menu.name, input: text,
        base: base, total: Math.round(total), price: 0, suggested: suggested,
        multiplier: op.multiplier, adds: op.adds, applied: op.applied, lines: []
      };
    }

    // 3순위 - 재료·레시피로 계산 (선택 기능)
    var recipe = bestMatch(DB.list('recipes'), n);
    if (recipe) {
      var rc = recipeCost(recipe);
      var op2 = matchOptions(n);
      var total2 = rc.base * op2.multiplier + op2.addSum;
      return {
        ok: true, source: 'recipe', sourceLabel: '재료로 계산함',
        name: recipe.name, input: text,
        lines: rc.lines, material: rc.material, packaging: rc.packaging, labor: rc.labor,
        base: rc.base, total: Math.round(total2), price: 0, suggested: suggestPrice(total2),
        multiplier: op2.multiplier, adds: op2.adds, applied: op2.applied
      };
    }

    return {
      ok: false, unknown: true, input: text,
      reason: '원가표에서 "' + text + '" 을(를) 찾지 못했어요.',
      hint: '아래 [메뉴별 원가표]에 이 이름과 원가를 한 번만 적어두면 다음부터는 자동으로 계산됩니다.'
    };
  }

  /* ================= 화면 ================= */

  function render(view) {
    view.innerHTML =
      calcCard() +
      menuCard() +
      optionCard() +
      advancedCard();
    bind(view);
    var last = DB.read('lastCalc', '');
    if (last) { U.$('#calcInput').value = last; runCalc(); }
  }

  /* ---------- 계산기 ---------- */
  function calcCard() {
    return '' +
    '<div class="card">' +
      '<h2>🧮 원가 계산기</h2>' +
      '<p class="hint">주문 내용을 그대로 적어보세요. 예) <code>생화케이크 2단</code>, <code>딸기케이크 1호</code></p>' +
      '<div class="inline-field">' +
        '<div><input id="calcInput" placeholder="생화케이크 2단" autocomplete="off"></div>' +
        '<button class="btn" id="calcRun">계산</button>' +
      '</div>' +
      '<div id="calcResult"></div>' +
    '</div>';
  }

  function runCalc() {
    var text = U.$('#calcInput').value.trim();
    DB.write('lastCalc', text);
    var r = calcFromText(text);
    var box = U.$('#calcResult');

    if (!r.ok) {
      box.innerHTML = '<div class="warn" style="margin-top:12px">' + U.esc(r.reason) +
        (r.hint ? '<br>' + U.esc(r.hint) : '') + '</div>' +
        (r.unknown ? '<div class="row" style="margin-top:10px">' +
          '<button class="btn small" id="calcAddMenu">➕ "' + U.esc(text) + '" 원가표에 추가</button></div>' : '');
      if (r.unknown) U.$('#calcAddMenu').onclick = function () { menuModal(null, text); };
      return;
    }

    var profit = U.toNum(r.suggested) - U.toNum(r.total);
    var rate = r.suggested ? Math.round(profit / r.suggested * 100) : 0;

    var detail = '';
    if (r.source === 'recipe') {
      var rows = r.lines.map(function (l) {
        return '<tr><td><span class="badge ' + (l.kind === '포장' ? 'gray' : '') + '">' + l.kind + '</span></td>' +
          '<td>' + U.esc(l.name) + '</td><td class="num">' + U.esc(l.qty) + '</td>' +
          '<td class="num">' + U.won(l.cost) + '</td></tr>';
      }).join('');
      rows += '<tr><td><span class="badge amber">인건비</span></td><td>작업 수고비</td><td class="num">-</td>' +
              '<td class="num">' + U.won(r.labor) + '</td></tr>';
      detail = '<div class="table-wrap"><table>' +
        '<thead><tr><th>구분</th><th>항목</th><th class="num">사용량</th><th class="num">금액</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' + calcFooter(r) + '</table></div>';
    } else if (r.source === 'menu-option' && (r.multiplier !== 1 || r.adds.length)) {
      detail = '<div class="table-wrap"><table><tbody>' +
        '<tr><td>원가표의 "' + U.esc(r.name) + '"</td><td class="num">' + U.won(r.base) + '</td></tr>' +
        (r.multiplier !== 1 ? '<tr><td>옵션 배수 ×' + r.multiplier.toFixed(2) + '</td><td class="num">' + U.won(r.base * r.multiplier) + '</td></tr>' : '') +
        r.adds.map(function (a) { return '<tr><td>추가: ' + U.esc(a.name) + '</td><td class="num">' + U.won(a.cost) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td>최종 원가</td><td class="num">' + U.won(r.total) + '</td></tr></tfoot></table></div>';
    }

    box.innerHTML = '' +
      '<div class="divider"></div>' +
      '<div class="grid four" style="margin-bottom:12px">' +
        stat('찾은 메뉴', U.esc(r.name) + '<br><span class="badge ' + srcCls(r.source) + '">' + r.sourceLabel + '</span>', '') +
        stat('원가', U.won(r.total), 'amber') +
        stat(r.price ? '판매가' : '추천 판매가', U.won(r.suggested), 'rose') +
        stat('이익', U.won(profit) + ' (' + rate + '%)', 'mint') +
      '</div>' +
      detail +
      '<div class="row" style="margin-top:12px">' +
        '<button class="btn ghost small" id="calcToOrder">이 내용으로 주문서 작성</button>' +
        (r.source === 'recipe' ? '<button class="btn ghost small" id="calcSaveMenu">원가표에 저장해 두기</button>' : '') +
      '</div>';

    U.$('#calcToOrder').onclick = function () {
      location.hash = '#orders';
      setTimeout(function () {
        var f = U.$('#orderForm'); if (!f) return;
        f.request.value = r.input;
        f.price.value = r.suggested;
        f.cost.value = r.total;
        f.customerName.focus();
        U.toast('주문서에 옮겼어요');
      }, 60);
    };
    var saveBtn = U.$('#calcSaveMenu');
    if (saveBtn) saveBtn.onclick = function () { menuModal(null, r.input, r.total, r.suggested); };
  }

  function calcFooter(r) {
    return '<tfoot>' +
      '<tr><td colspan="3">기본 원가 합계</td><td class="num">' + U.won(r.base) + '</td></tr>' +
      (r.multiplier !== 1 ? '<tr><td colspan="3">옵션 배수 ×' + r.multiplier.toFixed(2) + '</td><td class="num">' + U.won(r.base * r.multiplier) + '</td></tr>' : '') +
      r.adds.map(function (a) { return '<tr><td colspan="3">추가: ' + U.esc(a.name) + '</td><td class="num">' + U.won(a.cost) + '</td></tr>'; }).join('') +
      '<tr><td colspan="3">최종 원가</td><td class="num">' + U.won(r.total) + '</td></tr>' +
    '</tfoot>';
  }

  function srcCls(src) {
    return src === 'recipe' ? 'gray' : src === 'menu-option' ? 'amber' : 'mint';
  }
  function stat(label, value, cls) {
    return '<div class="stat ' + cls + '"><div class="label">' + label + '</div>' +
           '<div class="value" style="font-size:17px">' + value + '</div></div>';
  }

  /* ---------- 메뉴별 원가표 (직접 입력) ---------- */
  function menuCard() {
    var menus = DB.list('menus').slice().sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name));
    });
    var rows = menus.map(menuRow).join('');
    var totalCost = menus.reduce(function (a, m) { return a + U.toNum(m.cost); }, 0);

    return '' +
    '<div class="card">' +
      '<div class="row"><h2 style="margin:0">💰 메뉴별 원가표</h2><div class="spacer"></div>' +
        '<button class="btn ghost small" id="menuCsv">CSV 저장</button>' +
        '<button class="btn small" id="addMenu">+ 메뉴 추가</button></div>' +
      '<p class="hint">사장님이 직접 원가를 적어두는 표입니다. 여기에 적어두면 계산기와 주문서의 ' +
      '[자동계산]이 이 값을 사용합니다. <b>표 안의 숫자는 바로 고쳐 쓸 수 있어요.</b></p>' +
      (menus.length
        ? '<div class="table-wrap"><table>' +
            '<thead><tr><th>메뉴 이름</th><th class="num">원가</th><th class="num">판매가</th>' +
            '<th class="num">이익</th><th class="num">이익률</th><th>메모</th><th></th></tr></thead>' +
            '<tbody id="menuBody">' + rows + '</tbody>' +
            '<tfoot><tr><td>메뉴 ' + menus.length + '개</td><td class="num">평균 ' +
              U.won(menus.length ? totalCost / menus.length : 0) + '</td><td colspan="5"></td></tr></tfoot>' +
          '</table></div>'
        : '<div class="empty">아직 등록된 메뉴가 없어요.<br>[+ 메뉴 추가]를 눌러 자주 만드는 케이크부터 적어보세요.</div>') +
    '</div>';
  }

  function menuRow(m) {
    var cost = U.toNum(m.cost), price = U.toNum(m.price);
    var profit = price - cost;
    var rate = price ? Math.round(profit / price * 100) : 0;
    return '<tr data-menu="' + m.id + '">' +
      '<td><input class="m-name" value="' + U.esc(m.name) + '" style="min-width:130px"></td>' +
      '<td class="num"><input class="m-cost" type="number" min="0" step="any" style="width:100px" value="' + U.esc(m.cost) + '"></td>' +
      '<td class="num"><input class="m-price" type="number" min="0" step="any" style="width:100px" value="' + U.esc(m.price) + '"></td>' +
      '<td class="num m-profit" style="color:' + (profit >= 0 ? 'var(--mint)' : 'var(--red)') + '"><b>' + U.num(profit) + '</b></td>' +
      '<td class="num m-rate">' + (price ? rate + '%' : '-') + '</td>' +
      '<td><input class="m-memo" value="' + U.esc(m.memo || '') + '" style="min-width:110px"></td>' +
      '<td class="num"><button class="icon-btn" data-del-menu="' + m.id + '">🗑️</button></td></tr>';
  }

  // 표에서 바로 고쳤을 때: 저장하고 이익 칸만 다시 그림 (화면 전체를 새로 그리지 않아 입력이 끊기지 않음)
  function saveMenuRow(tr) {
    var cost = U.toNum(U.$('.m-cost', tr).value);
    var price = U.toNum(U.$('.m-price', tr).value);
    DB.upsert('menus', {
      id: tr.dataset.menu,
      name: U.$('.m-name', tr).value.trim(),
      cost: cost, price: price,
      memo: U.$('.m-memo', tr).value.trim()
    });
    var profit = price - cost;
    var rate = price ? Math.round(profit / price * 100) : 0;
    var pc = U.$('.m-profit', tr);
    pc.innerHTML = '<b>' + U.num(profit) + '</b>';
    pc.style.color = profit >= 0 ? 'var(--mint)' : 'var(--red)';
    U.$('.m-rate', tr).textContent = price ? rate + '%' : '-';
    U.toast('저장했어요');
  }

  function menuModal(id, presetName, presetCost, presetPrice) {
    var m = id ? DB.find('menus', id)
               : { name: presetName || '', cost: presetCost || '', price: presetPrice || '', memo: '' };
    var html = '' +
      '<div class="field"><label>메뉴 이름 <span style="color:var(--rose)">*</span></label>' +
        '<input id="mName" value="' + U.esc(m.name) + '" placeholder="예: 생화케이크 2단"></div>' +
      '<div class="grid two">' +
        '<div class="field"><label>원가 (재료·포장·수고비 합쳐서)</label>' +
          '<input id="mCost" type="number" min="0" step="any" value="' + U.esc(m.cost) + '" placeholder="45000"></div>' +
        '<div class="field"><label>판매가</label>' +
          '<input id="mPrice" type="number" min="0" step="any" value="' + U.esc(m.price) + '" placeholder="145000"></div>' +
      '</div>' +
      '<div id="mPreview" class="info" style="margin-bottom:12px"></div>' +
      '<div class="field"><label>메모</label><input id="mMemo" value="' + U.esc(m.memo || '') + '" placeholder="예: 생화 시세에 따라 변동"></div>' +
      '<div class="row end"><button class="btn ghost" id="mCancel">취소</button><button class="btn" id="mSave">저장</button></div>';

    U.modal(id ? '메뉴 수정' : '메뉴 추가', html, function (body) {
      function preview() {
        var c = U.toNum(U.$('#mCost', body).value), p = U.toNum(U.$('#mPrice', body).value);
        if (!c) { U.$('#mPreview', body).textContent = '원가를 넣으면 이익이 계산됩니다.'; return; }
        if (!p) {
          U.$('#mPreview', body).textContent =
            '판매가를 비워두면 마진율 ' + DB.settings().defaultMarginPct + '% 기준 ' + U.won(suggestPrice(c)) + ' 을 추천합니다.';
          return;
        }
        U.$('#mPreview', body).textContent =
          '이익 ' + U.won(p - c) + ' (이익률 ' + Math.round((p - c) / p * 100) + '%)';
      }
      preview();
      U.$('#mCost', body).oninput = preview;
      U.$('#mPrice', body).oninput = preview;
      U.$('#mCancel', body).onclick = U.closeModal;
      U.$('#mSave', body).onclick = function () {
        var name = U.$('#mName', body).value.trim();
        if (!name) { U.toast('메뉴 이름을 적어주세요'); return; }
        DB.upsert('menus', {
          id: m.id, name: name,
          cost: U.toNum(U.$('#mCost', body).value),
          price: U.toNum(U.$('#mPrice', body).value),
          memo: U.$('#mMemo', body).value.trim()
        });
        U.closeModal(); U.toast('저장했어요'); App.render();
      };
    });
  }

  /* ---------- 옵션 키워드 ---------- */
  function optionCard() {
    var ops = DB.list('options');
    var rows = ops.map(function (o) {
      return '<tr><td><b>' + U.esc(o.keyword) + '</b></td>' +
        '<td>' + (o.type === 'multiply' ? '<span class="badge">배수</span>' : '<span class="badge mint">추가금액</span>') + '</td>' +
        '<td class="num">' + (o.type === 'multiply' ? '×' + o.value : U.won(o.value)) + '</td>' +
        '<td>' + U.esc(o.memo || '') + '</td>' +
        '<td class="num"><button class="icon-btn" data-del-opt="' + o.id + '">🗑️</button></td></tr>';
    }).join('');
    return '' +
    '<div class="card">' +
      '<div class="row"><h2 style="margin:0">🏷️ 옵션 키워드</h2><div class="spacer"></div>' +
      '<button class="btn small" id="addOption">+ 옵션 추가</button></div>' +
      '<p class="hint">원가표에 없는 조합이 들어와도 자동으로 계산되게 해줍니다. ' +
      '예) 원가표에 <code>생화케이크</code>만 있어도 <code>생화케이크 2단</code>을 입력하면 원가를 1.8배로 계산합니다. ' +
      '<b>원가표에 이름이 정확히 있으면 옵션은 적용되지 않습니다.</b></p>' +
      (ops.length ? '<div class="table-wrap"><table><thead><tr><th>키워드</th><th>방식</th><th class="num">값</th><th>메모</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty">등록된 옵션이 없어요.</div>') +
    '</div>';
  }

  function optionModal() {
    var html = '' +
      '<div class="field"><label>키워드</label><input id="oKey" placeholder="예: 2단"></div>' +
      '<div class="field"><label>방식</label><select id="oType">' +
        '<option value="multiply">배수 (원가 × 값)</option><option value="add">추가금액 (원가 + 값)</option></select></div>' +
      '<div class="field"><label>값</label><input id="oVal" type="number" step="any" placeholder="1.8 또는 8000"></div>' +
      '<div class="field"><label>메모</label><input id="oMemo" placeholder="2단 케이크는 재료·수고가 약 1.8배"></div>' +
      '<div class="row end"><button class="btn ghost" id="oCancel">취소</button><button class="btn" id="oSave">저장</button></div>';
    U.modal('옵션 추가', html, function (body) {
      U.$('#oCancel', body).onclick = U.closeModal;
      U.$('#oSave', body).onclick = function () {
        var k = U.$('#oKey', body).value.trim();
        if (!k) { U.toast('키워드를 적어주세요'); return; }
        DB.upsert('options', {
          keyword: k, type: U.$('#oType', body).value,
          value: U.toNum(U.$('#oVal', body).value), memo: U.$('#oMemo', body).value.trim()
        });
        U.closeModal(); U.toast('저장했어요'); App.render();
      };
    });
  }

  /* ---------- (선택) 재료로 계산하기 ---------- */
  function advancedCard() {
    return '' +
    '<details class="card adv">' +
      '<summary>🧈 재료로 계산하기 <span class="cap-sub">(선택 · 평소엔 안 쓰셔도 됩니다)</span></summary>' +
      '<p class="hint" style="margin-top:12px">재료 단가와 레시피를 등록해 두면, 원가표에 없는 메뉴는 재료비로 계산해 줍니다. ' +
      '원가를 처음 잡아볼 때나 재료값이 올랐을 때 확인용으로 쓰세요.</p>' +
      recipeSection() +
      ingredientSection() +
    '</details>';
  }

  function recipeSection() {
    var recipes = DB.list('recipes');
    var rows = recipes.map(function (r) {
      var c = recipeCost(r);
      return '<tr><td><b>' + U.esc(r.name) + '</b>' + (r.memo ? '<br><span class="cap-sub">' + U.esc(r.memo) + '</span>' : '') + '</td>' +
        '<td class="num">' + (r.items || []).length + '개</td>' +
        '<td class="num">' + U.won(c.material) + '</td>' +
        '<td class="num">' + U.won(c.packaging) + '</td>' +
        '<td class="num">' + U.won(c.labor) + '</td>' +
        '<td class="num"><b>' + U.won(c.base) + '</b></td>' +
        '<td class="num"><button class="icon-btn" data-edit-recipe="' + r.id + '">✏️</button>' +
        '<button class="icon-btn" data-del-recipe="' + r.id + '">🗑️</button></td></tr>';
    }).join('');

    return '<div class="divider"></div>' +
      '<div class="row"><h3 style="margin:0">🍰 레시피</h3><div class="spacer"></div>' +
      '<button class="btn ghost small" id="addRecipe">+ 레시피 추가</button></div>' +
      (recipes.length ? '<div class="table-wrap"><table><thead><tr><th>이름</th><th class="num">재료수</th>' +
        '<th class="num">재료비</th><th class="num">포장비</th><th class="num">인건비</th><th class="num">합계</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty">등록된 레시피가 없어요.</div>');
  }

  function ingredientSection() {
    var ings = DB.list('ingredients');
    var rows = ings.map(function (g) {
      return '<tr data-ing="' + g.id + '">' +
        '<td><input class="f-name" value="' + U.esc(g.name) + '" style="min-width:110px"></td>' +
        '<td class="num"><input class="f-price" type="number" min="0" step="any" style="width:95px" value="' + U.esc(g.packPrice) + '"></td>' +
        '<td class="num"><input class="f-qty" type="number" min="0" step="any" style="width:85px" value="' + U.esc(g.packQty) + '"></td>' +
        '<td><input class="f-unit" style="width:60px" value="' + U.esc(g.unit) + '"></td>' +
        '<td class="num"><b>' + U.won(unitCost(g)) + '</b> /' + U.esc(g.unit) + '</td>' +
        '<td>' + (g.url ? '<a href="' + U.esc(g.url) + '" target="_blank" rel="noopener">구매처</a>' : '<span class="cap-sub">-</span>') + '</td>' +
        '<td class="num"><button class="icon-btn" data-del-ing="' + g.id + '">🗑️</button></td></tr>';
    }).join('');

    return '<div class="divider"></div>' +
      '<div class="row"><h3 style="margin:0">🧈 재료 단가</h3><div class="spacer"></div>' +
      '<button class="btn ghost small" id="ingCsv">CSV 저장</button>' +
      '<button class="btn ghost small" id="addIngredient">+ 재료 추가</button></div>' +
      '<p class="hint">구매한 가격과 용량을 적으면 1g(또는 1개)당 단가를 자동으로 계산합니다.</p>' +
      (ings.length ? '<div class="table-wrap"><table><thead><tr><th>재료명</th><th class="num">구매가</th>' +
        '<th class="num">용량</th><th>단위</th><th class="num">단가</th><th>링크</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty">등록된 재료가 없어요.</div>');
  }

  function recipeModal(id) {
    var r = id ? DB.find('recipes', id) : { name: '', items: [], packItems: [], labor: '', memo: '' };
    var ings = DB.list('ingredients');
    var inv = DB.list('inventory');

    function ingRow(it) {
      it = it || { ingId: '', qty: '' };
      return '<div class="row ing-row" style="gap:6px;margin-bottom:6px">' +
        '<select class="ing-sel" style="flex:2">' + '<option value="">재료 선택</option>' +
          ings.map(function (g) { return '<option value="' + g.id + '"' + (g.id === it.ingId ? ' selected' : '') + '>' + U.esc(g.name) + ' (' + U.won(unitCost(g)) + '/' + U.esc(g.unit) + ')</option>'; }).join('') +
        '</select>' +
        '<input class="ing-qty" style="flex:1" type="number" min="0" step="any" placeholder="사용량" value="' + U.esc(it.qty) + '">' +
        '<button class="icon-btn rm-row">🗑️</button></div>';
    }
    function packRow(it) {
      it = it || { invId: '', qty: 1 };
      return '<div class="row pack-row" style="gap:6px;margin-bottom:6px">' +
        '<select class="pack-sel" style="flex:2"><option value="">포장자재 선택</option>' +
          inv.map(function (g) { return '<option value="' + g.id + '"' + (g.id === it.invId ? ' selected' : '') + '>' + U.esc(g.name) + ' (' + U.won(g.unitPrice) + ')</option>'; }).join('') +
        '</select>' +
        '<input class="pack-qty" style="flex:1" type="number" min="0" step="any" placeholder="개수" value="' + U.esc(it.qty) + '">' +
        '<button class="icon-btn rm-row">🗑️</button></div>';
    }

    var html = '' +
      '<div class="field"><label>케이크 이름 <span style="color:var(--rose)">*</span></label>' +
      '<input id="rName" value="' + U.esc(r.name) + '" placeholder="예: 생화케이크"></div>' +
      '<div class="field"><label>들어가는 재료</label><div id="ingRows">' +
        ((r.items || []).length ? r.items.map(ingRow).join('') : ingRow()) +
      '</div><button class="btn ghost small" id="addIng">+ 재료 줄 추가</button></div>' +
      '<div class="field"><label>포장 자재 (상자 · 리본 · 보냉백)</label><div id="packRows">' +
        ((r.packItems || []).length ? r.packItems.map(packRow).join('') : packRow()) +
      '</div><button class="btn ghost small" id="addPack">+ 포장 줄 추가</button></div>' +
      '<div class="field"><label>인건비 (비워두면 설정값 ' + U.won(DB.settings().laborPerCake) + ' 사용)</label>' +
      '<input id="rLabor" type="number" min="0" step="any" value="' + U.esc(r.labor) + '" placeholder="8000"></div>' +
      '<div class="field"><label>메모</label><input id="rMemo" value="' + U.esc(r.memo || '') + '"></div>' +
      '<div class="row end"><button class="btn ghost" id="rCancel">취소</button><button class="btn" id="rSave">저장</button></div>';

    U.modal(id ? '레시피 수정' : '레시피 추가', html, function (body) {
      body.addEventListener('click', function (e) {
        if (e.target.classList.contains('rm-row')) e.target.closest('.row').remove();
      });
      U.$('#addIng', body).onclick = function () { U.$('#ingRows', body).insertAdjacentHTML('beforeend', ingRow()); };
      U.$('#addPack', body).onclick = function () { U.$('#packRows', body).insertAdjacentHTML('beforeend', packRow()); };
      U.$('#rCancel', body).onclick = U.closeModal;
      U.$('#rSave', body).onclick = function () {
        var name = U.$('#rName', body).value.trim();
        if (!name) { U.toast('케이크 이름을 적어주세요'); return; }
        var items = U.$$('.ing-row', body).map(function (row) {
          return { ingId: U.$('.ing-sel', row).value, qty: U.toNum(U.$('.ing-qty', row).value) };
        }).filter(function (x) { return x.ingId && x.qty > 0; });
        var packItems = U.$$('.pack-row', body).map(function (row) {
          return { invId: U.$('.pack-sel', row).value, qty: U.toNum(U.$('.pack-qty', row).value) };
        }).filter(function (x) { return x.invId && x.qty > 0; });
        DB.upsert('recipes', {
          id: r.id, name: name, items: items, packItems: packItems,
          labor: U.$('#rLabor', body).value, memo: U.$('#rMemo', body).value.trim()
        });
        U.closeModal(); U.toast('저장했어요'); App.render();
      };
    });
  }

  function ingredientModal(id) {
    var g = id ? DB.find('ingredients', id) : { name: '', packPrice: '', packQty: '', unit: 'g', url: '' };
    var html = '' +
      '<div class="field"><label>재료명 <span style="color:var(--rose)">*</span></label><input id="gName" value="' + U.esc(g.name) + '" placeholder="예: 무염버터"></div>' +
      '<div class="grid two">' +
        '<div class="field"><label>구매 가격(원)</label><input id="gPrice" type="number" min="0" step="any" value="' + U.esc(g.packPrice) + '" placeholder="12900"></div>' +
        '<div class="field"><label>구매 용량</label><input id="gQty" type="number" min="0" step="any" value="' + U.esc(g.packQty) + '" placeholder="1000"></div>' +
      '</div>' +
      '<div class="field"><label>단위 (g, ml, 개, 송이 …)</label><input id="gUnit" value="' + U.esc(g.unit) + '"></div>' +
      '<div class="field"><label>구매처 링크 (선택)</label><input id="gUrl" value="' + U.esc(g.url || '') + '" placeholder="https://"></div>' +
      '<div class="row end"><button class="btn ghost" id="gCancel">취소</button><button class="btn" id="gSave">저장</button></div>';
    U.modal(id ? '재료 수정' : '재료 추가', html, function (body) {
      U.$('#gCancel', body).onclick = U.closeModal;
      U.$('#gSave', body).onclick = function () {
        var name = U.$('#gName', body).value.trim();
        if (!name) { U.toast('재료명을 적어주세요'); return; }
        DB.upsert('ingredients', {
          id: g.id, name: name,
          packPrice: U.toNum(U.$('#gPrice', body).value),
          packQty: U.toNum(U.$('#gQty', body).value),
          unit: U.$('#gUnit', body).value.trim() || 'g',
          url: U.$('#gUrl', body).value.trim(),
          priceCheckedAt: U.today()
        });
        U.closeModal(); U.toast('저장했어요'); App.render();
      };
    });
  }

  /* ---------- 이벤트 연결 ---------- */
  function bind(view) {
    U.$('#calcRun', view).onclick = runCalc;
    U.$('#calcInput', view).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') runCalc();
    });
    U.$('#addMenu', view).onclick = function () { menuModal(null); };
    U.$('#addOption', view).onclick = optionModal;
    U.$('#addRecipe', view).onclick = function () { recipeModal(null); };
    U.$('#addIngredient', view).onclick = function () { ingredientModal(null); };

    U.$('#menuCsv', view).onclick = function () {
      var rows = [['메뉴 이름', '원가', '판매가', '이익', '이익률(%)', '메모']];
      DB.list('menus').forEach(function (m) {
        var c = U.toNum(m.cost), p = U.toNum(m.price);
        rows.push([m.name, c, p, p - c, p ? Math.round((p - c) / p * 100) : '', m.memo || '']);
      });
      U.downloadCsv('메뉴별_원가표.csv', rows);
      U.toast('CSV 파일을 저장했어요');
    };
    U.$('#ingCsv', view).onclick = function () {
      var rows = [['재료명', '구매가', '용량', '단위', '단가', '구매처']];
      DB.list('ingredients').forEach(function (g) {
        rows.push([g.name, g.packPrice, g.packQty, g.unit, Math.round(unitCost(g)), g.url || '']);
      });
      U.downloadCsv('재료단가.csv', rows);
    };

    view.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.delMenu && U.confirmBox('이 메뉴를 원가표에서 지울까요?')) {
        DB.remove('menus', t.dataset.delMenu); App.render();
      }
      if (t.dataset.editRecipe) recipeModal(t.dataset.editRecipe);
      if (t.dataset.delRecipe && U.confirmBox('이 레시피를 삭제할까요?')) {
        DB.remove('recipes', t.dataset.delRecipe); App.render();
      }
      if (t.dataset.delIng && U.confirmBox('이 재료를 삭제할까요?')) {
        DB.remove('ingredients', t.dataset.delIng); App.render();
      }
      if (t.dataset.delOpt && U.confirmBox('이 옵션을 삭제할까요?')) {
        DB.remove('options', t.dataset.delOpt); App.render();
      }
    });

    // 표에서 바로 수정
    view.addEventListener('change', function (e) {
      var menuTr = e.target.closest('tr[data-menu]');
      if (menuTr) { saveMenuRow(menuTr); return; }

      var ingTr = e.target.closest('tr[data-ing]');
      if (ingTr) {
        DB.upsert('ingredients', {
          id: ingTr.dataset.ing,
          name: U.$('.f-name', ingTr).value.trim(),
          packPrice: U.toNum(U.$('.f-price', ingTr).value),
          packQty: U.toNum(U.$('.f-qty', ingTr).value),
          unit: U.$('.f-unit', ingTr).value.trim() || 'g'
        });
        U.toast('저장했어요'); App.render();
      }
    });
  }

  return {
    render: render, calcFromText: calcFromText, recipeCost: recipeCost,
    unitCost: unitCost, suggestPrice: suggestPrice
  };
})();
