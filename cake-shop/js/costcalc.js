/* 원가 계산기
   - 재료 단가표(밀가루/버터/계란...) + 레시피(케이크 종류) + 옵션 키워드(2단, 3호, 생화...)
   - "생화케이크 2단" 처럼 글로 적으면 원가를 계산해 줍니다. */
window.Cost = (function () {

  /* ================= 계산 엔진 ================= */

  // 재료 1단위(1g, 1ml, 1개)당 가격
  function unitCost(ing) {
    var qty = U.toNum(ing.packQty);
    if (!qty) return 0;
    return U.toNum(ing.packPrice) / qty;
  }

  // 띄어쓰기 제거 + 소문자 (검색 비교용)
  function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

  // 레시피 1개의 기본 원가 계산
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

  // 글자로 적은 주문내용 -> 원가 계산
  // 예: "생화케이크 2단", "레터링케이크 1호 생화"
  function calcFromText(text) {
    var n = norm(text);
    if (!n) return { ok: false, reason: '내용을 입력해 주세요.' };

    var recipes = DB.list('recipes');
    // 이름이 들어있는 레시피 중 가장 긴(=구체적인) 것을 고름
    var matched = null;
    recipes.forEach(function (r) {
      var rn = norm(r.name);
      if (rn && n.indexOf(rn) >= 0) {
        if (!matched || rn.length > norm(matched.name).length) matched = r;
      }
    });
    if (!matched) {
      return { ok: false, reason: '등록된 케이크 종류를 찾지 못했어요.',
               hint: '아래 [케이크 종류(레시피)]에 이름을 먼저 등록해 주세요. 예: 생화케이크' };
    }

    var base = recipeCost(matched);
    // 옵션 키워드 적용 (배수 / 추가금액)
    var multiplier = 1, adds = [], applied = [];
    DB.list('options').forEach(function (op) {
      var k = norm(op.keyword);
      if (!k || n.indexOf(k) < 0) return;
      applied.push(op);
      if (op.type === 'multiply') multiplier *= U.toNum(op.value) || 1;
      else adds.push({ name: op.keyword, cost: U.toNum(op.value) });
    });

    var addSum = adds.reduce(function (a, b) { return a + b.cost; }, 0);
    var total = base.base * multiplier + addSum;

    var set = DB.settings();
    var margin = Math.min(95, Math.max(0, U.toNum(set.defaultMarginPct))) / 100;
    var suggested = margin < 1 ? Math.ceil((total / (1 - margin)) / 1000) * 1000 : total;

    return {
      ok: true, recipe: matched, lines: base.lines,
      material: base.material, packaging: base.packaging, labor: base.labor,
      base: base.base, multiplier: multiplier, adds: adds, applied: applied,
      total: Math.round(total), suggested: suggested, input: text
    };
  }

  /* ================= 화면 ================= */

  function render(view) {
    view.innerHTML =
      calcCard() +
      recipeCard() +
      ingredientCard() +
      optionCard();
    bind(view);
    // 마지막으로 계산한 내용이 있으면 다시 보여주기
    var last = DB.read('lastCalc', '');
    if (last) { U.$('#calcInput').value = last; runCalc(); }
  }

  function calcCard() {
    return '' +
    '<div class="card">' +
      '<h2>🧮 원가 계산기</h2>' +
      '<p class="hint">주문 내용을 그대로 적어보세요. 예) <code>생화케이크 2단</code>, <code>레터링케이크 1호</code></p>' +
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
        (r.hint ? '<br>' + U.esc(r.hint) : '') + '</div>';
      return;
    }
    var rows = r.lines.map(function (l) {
      return '<tr><td><span class="badge ' + (l.kind === '포장' ? 'gray' : '') + '">' + l.kind + '</span></td>' +
        '<td>' + U.esc(l.name) + '</td><td class="num">' + U.esc(l.qty) + '</td>' +
        '<td class="num">' + U.won(l.cost) + '</td></tr>';
    }).join('');
    rows += '<tr><td><span class="badge amber">인건비</span></td><td>작업 수고비</td><td class="num">-</td>' +
            '<td class="num">' + U.won(r.labor) + '</td></tr>';

    var optText = r.applied.length
      ? r.applied.map(function (o) {
          return U.esc(o.keyword) + (o.type === 'multiply' ? ' ×' + o.value : ' +' + U.won(o.value));
        }).join(', ')
      : '없음';

    box.innerHTML = '' +
      '<div class="divider"></div>' +
      '<div class="grid four" style="margin-bottom:12px">' +
        stat('찾은 케이크', U.esc(r.recipe.name), '') +
        stat('적용 옵션', optText, '') +
        stat('총 원가', U.won(r.total), 'rose') +
        stat('추천 판매가', U.won(r.suggested), 'mint') +
      '</div>' +
      '<div class="table-wrap"><table>' +
        '<thead><tr><th>구분</th><th>항목</th><th class="num">사용량</th><th class="num">금액</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '<tfoot>' +
          '<tr><td colspan="3">기본 원가 합계</td><td class="num">' + U.won(r.base) + '</td></tr>' +
          (r.multiplier !== 1 ? '<tr><td colspan="3">옵션 배수 ×' + r.multiplier.toFixed(2) + '</td><td class="num">' + U.won(r.base * r.multiplier) + '</td></tr>' : '') +
          (r.adds.length ? r.adds.map(function (a) { return '<tr><td colspan="3">추가: ' + U.esc(a.name) + '</td><td class="num">' + U.won(a.cost) + '</td></tr>'; }).join('') : '') +
          '<tr><td colspan="3">최종 원가</td><td class="num">' + U.won(r.total) + '</td></tr>' +
        '</tfoot>' +
      '</table></div>' +
      '<p class="hint" style="margin-top:10px">추천 판매가는 설정의 마진율(' + DB.settings().defaultMarginPct + '%) 기준입니다. ' +
      '1,000원 단위로 올림했어요.</p>' +
      '<div class="row"><button class="btn ghost small" id="calcToOrder">이 내용으로 주문서 작성</button></div>';

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
  }

  function stat(label, value, cls) {
    return '<div class="stat ' + cls + '"><div class="label">' + label + '</div>' +
           '<div class="value" style="font-size:17px">' + value + '</div></div>';
  }

  /* ---------- 레시피 ---------- */
  function recipeCard() {
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

    return '' +
    '<div class="card">' +
      '<div class="row"><h2 style="margin:0">🍰 케이크 종류 (레시피)</h2><div class="spacer"></div>' +
      '<button class="btn small" id="addRecipe">+ 종류 추가</button></div>' +
      '<p class="hint">케이크 한 개를 만들 때 들어가는 재료와 포장을 등록해 두면, 위 계산기가 이 값을 사용합니다.</p>' +
      (recipes.length ? '<div class="table-wrap"><table><thead><tr><th>이름</th><th class="num">재료수</th>' +
        '<th class="num">재료비</th><th class="num">포장비</th><th class="num">인건비</th><th class="num">합계</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty">아직 등록된 케이크 종류가 없어요.<br>[+ 종류 추가]를 눌러 첫 레시피를 만들어 보세요.</div>') +
    '</div>';
  }

  function recipeModal(id) {
    var r = id ? DB.find('recipes', id) : { name: '', items: [], packItems: [], labor: '', memo: '' };
    var ings = DB.list('ingredients');
    var inv = DB.list('inventory');
    if (!ings.length) { U.toast('먼저 아래 [재료 단가]를 등록해 주세요'); }

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
      '<input id="rLabor" type="number" min="0" value="' + U.esc(r.labor) + '" placeholder="8000"></div>' +
      '<div class="field"><label>메모</label><input id="rMemo" value="' + U.esc(r.memo || '') + '"></div>' +
      '<div class="row end"><button class="btn ghost" id="rCancel">취소</button><button class="btn" id="rSave">저장</button></div>';

    U.modal(id ? '레시피 수정' : '케이크 종류 추가', html, function (body) {
      body.addEventListener('click', function (e) {
        if (e.target.classList.contains('rm-row')) e.target.closest('.row').remove();
      });
      U.$('#addIng', body).onclick = function () {
        U.$('#ingRows', body).insertAdjacentHTML('beforeend', ingRow());
      };
      U.$('#addPack', body).onclick = function () {
        U.$('#packRows', body).insertAdjacentHTML('beforeend', packRow());
      };
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

  /* ---------- 재료 단가 ---------- */
  function ingredientCard() {
    var ings = DB.list('ingredients');
    var rows = ings.map(function (g) {
      return '<tr data-ing="' + g.id + '">' +
        '<td><input class="f-name" value="' + U.esc(g.name) + '"></td>' +
        '<td class="num"><input class="f-price" type="number" min="0" style="width:100px" value="' + U.esc(g.packPrice) + '"></td>' +
        '<td class="num"><input class="f-qty" type="number" min="0" step="any" style="width:90px" value="' + U.esc(g.packQty) + '"></td>' +
        '<td><input class="f-unit" style="width:60px" value="' + U.esc(g.unit) + '"></td>' +
        '<td class="num"><b>' + U.won(unitCost(g)) + '</b> /' + U.esc(g.unit) + '</td>' +
        '<td>' + (g.url ? '<a href="' + U.esc(g.url) + '" target="_blank" rel="noopener">링크</a>' : '<span class="cap-sub">-</span>') +
          '<br><span class="cap-sub">' + (g.priceCheckedAt ? U.korDate(g.priceCheckedAt) + ' 확인' : '미확인') + '</span></td>' +
        '<td class="num"><button class="icon-btn" data-ing-price="' + g.id + '" title="쿠팡 가격 갱신">🛒</button>' +
        '<button class="icon-btn" data-del-ing="' + g.id + '">🗑️</button></td></tr>';
    }).join('');

    return '' +
    '<div class="card">' +
      '<div class="row"><h2 style="margin:0">🧈 재료 단가</h2><div class="spacer"></div>' +
      '<button class="btn ghost small" id="ingCsv">CSV 저장</button>' +
      '<button class="btn small" id="addIngredient">+ 재료 추가</button></div>' +
      '<p class="hint">구매한 가격과 용량을 적으면 1g(또는 1개)당 단가를 자동으로 계산합니다. ' +
      '표 안의 숫자는 바로 고쳐 쓸 수 있어요.</p>' +
      (ings.length ? '<div class="table-wrap"><table><thead><tr><th>재료명</th><th class="num">구매가</th>' +
        '<th class="num">용량</th><th>단위</th><th class="num">단가</th><th>쿠팡</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty">아직 등록된 재료가 없어요.</div>') +
      '<div class="warn" style="margin-top:12px">🛒 <b>쿠팡 가격 자동 수집 안내</b> — 쿠팡은 프로그램이 가격을 자동으로 ' +
      '가져가는 것을 막아두고 있어서, 이 페이지만으로는 자동 수집이 되지 않습니다. ' +
      '대신 🛒 버튼을 누르면 <b>쿠팡 페이지를 열고 → 가격을 붙여넣어 → 단가를 갱신</b>하는 반자동 방식으로 처리합니다. ' +
      '완전 자동으로 만들려면 서버가 필요해요 (README의 "쿠팡 자동화" 참고).</div>' +
    '</div>';
  }

  function ingredientModal(id) {
    var g = id ? DB.find('ingredients', id) : { name: '', packPrice: '', packQty: '', unit: 'g', url: '' };
    var html = '' +
      '<div class="field"><label>재료명 <span style="color:var(--rose)">*</span></label><input id="gName" value="' + U.esc(g.name) + '" placeholder="예: 무염버터"></div>' +
      '<div class="grid two">' +
        '<div class="field"><label>구매 가격(원)</label><input id="gPrice" type="number" min="0" value="' + U.esc(g.packPrice) + '" placeholder="12900"></div>' +
        '<div class="field"><label>구매 용량</label><input id="gQty" type="number" min="0" step="any" value="' + U.esc(g.packQty) + '" placeholder="1000"></div>' +
      '</div>' +
      '<div class="field"><label>단위 (g, ml, 개, 송이 …)</label><input id="gUnit" value="' + U.esc(g.unit) + '"></div>' +
      '<div class="field"><label>쿠팡 상품 주소 (선택)</label><input id="gUrl" value="' + U.esc(g.url || '') + '" placeholder="https://www.coupang.com/vp/products/..."></div>' +
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

  // 쿠팡 가격 반자동 갱신
  function coupangModal(id) {
    var g = DB.find('ingredients', id);
    if (!g) return;
    var html = '' +
      '<p class="hint">1) 아래 [쿠팡에서 열기]로 상품 페이지를 엽니다. 2) 가격 부분을 복사해서 3) 아래 칸에 붙여넣고 [가격 읽기]를 누르세요.</p>' +
      '<div class="field"><label>쿠팡 상품 주소</label><input id="cUrl" value="' + U.esc(g.url || '') + '" placeholder="https://www.coupang.com/vp/products/..."></div>' +
      '<div class="row" style="margin-bottom:12px">' +
        '<button class="btn ghost small" id="cOpen">쿠팡에서 열기</button>' +
        '<button class="btn ghost small" id="cSearch">쿠팡에서 "' + U.esc(g.name) + '" 검색</button>' +
      '</div>' +
      '<div class="field"><label>복사한 내용 붙여넣기</label><textarea id="cPaste" placeholder="예) 12,900원 무료배송"></textarea></div>' +
      '<div class="row"><button class="btn ghost small" id="cParse">가격 읽기</button></div>' +
      '<div class="divider"></div>' +
      '<div class="grid two">' +
        '<div class="field"><label>구매 가격(원)</label><input id="cPrice" type="number" value="' + U.esc(g.packPrice) + '"></div>' +
        '<div class="field"><label>구매 용량 (' + U.esc(g.unit) + ')</label><input id="cQty" type="number" step="any" value="' + U.esc(g.packQty) + '"></div>' +
      '</div>' +
      '<div id="cPreview" class="info" style="margin-bottom:12px"></div>' +
      '<div class="row end"><button class="btn ghost" id="cCancel">취소</button><button class="btn" id="cSave">단가 갱신</button></div>';

    U.modal('🛒 ' + g.name + ' 가격 갱신', html, function (body) {
      function preview() {
        var p = U.toNum(U.$('#cPrice', body).value), q = U.toNum(U.$('#cQty', body).value);
        U.$('#cPreview', body).textContent = q ? ('새 단가: ' + U.won(p / q) + ' / ' + g.unit) : '용량을 입력하면 단가가 계산됩니다.';
      }
      preview();
      U.$('#cPrice', body).oninput = preview;
      U.$('#cQty', body).oninput = preview;
      U.$('#cOpen', body).onclick = function () {
        var url = U.$('#cUrl', body).value.trim();
        if (!url) { U.toast('상품 주소를 먼저 넣어주세요'); return; }
        window.open(url, '_blank', 'noopener');
      };
      U.$('#cSearch', body).onclick = function () {
        window.open('https://www.coupang.com/np/search?q=' + encodeURIComponent(g.name), '_blank', 'noopener');
      };
      U.$('#cParse', body).onclick = function () {
        var t = U.$('#cPaste', body).value;
        var price = parsePrice(t), qty = parseQty(t);
        if (price) U.$('#cPrice', body).value = price;
        if (qty) U.$('#cQty', body).value = qty;
        preview();
        U.toast(price ? ('가격 ' + U.won(price) + ' 을(를) 읽었어요') : '가격을 찾지 못했어요. 직접 입력해 주세요.');
      };
      U.$('#cCancel', body).onclick = U.closeModal;
      U.$('#cSave', body).onclick = function () {
        DB.upsert('ingredients', {
          id: g.id,
          packPrice: U.toNum(U.$('#cPrice', body).value),
          packQty: U.toNum(U.$('#cQty', body).value),
          url: U.$('#cUrl', body).value.trim(),
          source: 'coupang',
          priceCheckedAt: U.today()
        });
        U.closeModal(); U.toast('단가를 갱신했어요'); App.render();
      };
    });
  }

  // 붙여넣은 글에서 "12,900원" 같은 가격 찾기 (가장 처음 나오는 값)
  function parsePrice(text) {
    var m = String(text).match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})\s*원/);
    if (m) return U.toNum(m[1]);
    m = String(text).match(/([0-9]{1,3}(?:,[0-9]{3})+)/);
    return m ? U.toNum(m[1]) : 0;
  }
  // "1kg", "500g", "30구" 같은 용량 찾기 -> g/ml/개 로 환산
  function parseQty(text) {
    var s = String(text).replace(/\s+/g, '');
    var m = s.match(/([0-9]+(?:\.[0-9]+)?)(kg|g|l|ml|개|구|입|매)/i);
    if (!m) return 0;
    var v = parseFloat(m[1]), u = m[2].toLowerCase();
    if (u === 'kg' || u === 'l') return v * 1000;
    return v;
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
      '<p class="hint">주문 내용에 이 단어가 들어 있으면 자동으로 반영됩니다. ' +
      '예) <code>2단</code> = 원가 1.8배, <code>생화</code> = 8,000원 추가</p>' +
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

  /* ---------- 이벤트 연결 ---------- */
  function bind(view) {
    U.$('#calcRun', view).onclick = runCalc;
    U.$('#calcInput', view).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') runCalc();
    });
    U.$('#addRecipe', view).onclick = function () { recipeModal(null); };
    U.$('#addIngredient', view).onclick = function () { ingredientModal(null); };
    U.$('#addOption', view).onclick = optionModal;
    U.$('#ingCsv', view).onclick = function () {
      var rows = [['재료명', '구매가', '용량', '단위', '단가', '쿠팡주소', '확인일']];
      DB.list('ingredients').forEach(function (g) {
        rows.push([g.name, g.packPrice, g.packQty, g.unit, Math.round(unitCost(g)), g.url || '', g.priceCheckedAt || '']);
      });
      U.downloadCsv('재료단가.csv', rows);
    };

    view.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.editRecipe) recipeModal(t.dataset.editRecipe);
      if (t.dataset.delRecipe && U.confirmBox('이 레시피를 삭제할까요?')) {
        DB.remove('recipes', t.dataset.delRecipe); App.render();
      }
      if (t.dataset.delIng && U.confirmBox('이 재료를 삭제할까요?')) {
        DB.remove('ingredients', t.dataset.delIng); App.render();
      }
      if (t.dataset.ingPrice) coupangModal(t.dataset.ingPrice);
      if (t.dataset.delOpt && U.confirmBox('이 옵션을 삭제할까요?')) {
        DB.remove('options', t.dataset.delOpt); App.render();
      }
    });

    // 재료 표 안에서 직접 수정
    view.addEventListener('change', function (e) {
      var tr = e.target.closest('tr[data-ing]');
      if (!tr) return;
      DB.upsert('ingredients', {
        id: tr.dataset.ing,
        name: U.$('.f-name', tr).value.trim(),
        packPrice: U.toNum(U.$('.f-price', tr).value),
        packQty: U.toNum(U.$('.f-qty', tr).value),
        unit: U.$('.f-unit', tr).value.trim() || 'g'
      });
      U.toast('저장했어요'); App.render();
    });
  }

  return { render: render, calcFromText: calcFromText, recipeCost: recipeCost, unitCost: unitCost };
})();
