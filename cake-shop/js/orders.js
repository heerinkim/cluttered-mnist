/* 주문 등록 + 픽업 달력 */
window.Orders = (function () {

  var calMonth = U.thisMonth();   // 달력에 보이는 달
  var editingId = null;           // 수정 중인 주문

  /* ---------- 주문 목록 도우미 ---------- */
  function all() {
    return DB.list('orders').slice().sort(function (a, b) {
      return (a.pickupDate + (a.pickupTime || '')).localeCompare(b.pickupDate + (b.pickupTime || ''));
    });
  }
  function byDate(date) { return all().filter(function (o) { return o.pickupDate === date; }); }
  function byMonth(m) { return all().filter(function (o) { return (o.pickupDate || '').slice(0, 7) === m; }); }

  /* ================= 화면 ================= */
  function render(view) {
    view.innerHTML = formCard() + calendarCard() + upcomingCard();
    bind(view);
  }

  function formCard() {
    var set = DB.settings();
    return '' +
    '<div class="card">' +
      '<div class="row"><h2 style="margin:0">📝 주문서 작성</h2><div class="spacer"></div>' +
        '<button class="btn ghost small" id="pasteImport">💬 채팅 내용으로 주문 만들기</button>' +
      '</div>' +
      '<p class="hint">별표(<span style="color:var(--rose)">*</span>) 항목만 필수입니다. 저장하면 아래 달력의 픽업 날짜에 자동으로 표시돼요.</p>' +
      '<form id="orderForm" novalidate>' +
        '<input type="hidden" name="oid">' +
        '<div class="grid two">' +
          '<div class="field"><label>고객이름 <span style="color:var(--rose)">*</span></label>' +
            '<input name="customerName" required placeholder="김민지" autocomplete="off"></div>' +
          '<div class="field"><label>연락처</label>' +
            '<input name="phone" placeholder="010-1234-5678" inputmode="numeric" autocomplete="off"></div>' +
          '<div class="field"><label>픽업날짜 <span style="color:var(--rose)">*</span></label>' +
            '<input name="pickupDate" type="date" required value="' + U.today() + '"></div>' +
          '<div class="field"><label>픽업시간</label>' +
            '<input name="pickupTime" type="time" value="14:00"></div>' +
        '</div>' +
        '<div class="field"><label>주문요청사항</label>' +
          '<textarea name="request" placeholder="예: 생화케이크 2단 / 문구 &quot;생일 축하해&quot; / 핑크톤"></textarea></div>' +
        '<div class="grid three">' +
          '<div class="field"><label>가격 (판매가)</label>' +
            '<input name="price" type="number" min="0" step="any" placeholder="65000"></div>' +
          '<div class="field"><label>원가 <button type="button" class="btn ghost small" id="autoCost" style="padding:2px 8px;font-size:11px">자동계산</button></label>' +
            '<input name="cost" type="number" min="0" step="any" placeholder="24000"></div>' +
          '<div class="field"><label>예약금 (받은 돈)</label>' +
            '<input name="deposit" type="number" min="0" step="any" placeholder="20000"></div>' +
        '</div>' +
        '<div class="field"><label>참고사항</label>' +
          '<textarea name="note" placeholder="예: 알러지 - 견과류 제외 / 주차 문의"></textarea></div>' +
        '<div class="grid two">' +
          '<div class="field"><label>주문 경로</label><select name="source">' +
            '<option value="manual"' + (set.reservationSource === 'manual' ? ' selected' : '') + '>직접 입력</option>' +
            '<option value="paste"' + (set.reservationSource === 'paste' ? ' selected' : '') + '>채팅 붙여넣기</option>' +
            '<option value="phone">전화</option><option value="instagram">인스타그램</option>' +
          '</select></div>' +
          '<div class="field"><label>상태</label><select name="status">' +
            '<option value="reserved">예약</option><option value="done">픽업 완료</option><option value="canceled">취소</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="row end">' +
          '<button type="button" class="btn ghost" id="formReset">새로 작성</button>' +
          '<button type="submit" class="btn" id="formSubmit">주문 저장</button>' +
        '</div>' +
      '</form>' +
    '</div>';
  }

  /* ---------- 달력 ---------- */
  function calendarCard() {
    return '<div class="card">' +
      '<div class="cal-head">' +
        '<button class="btn ghost small" id="calPrev">‹ 이전달</button>' +
        '<div class="cal-title" id="calTitle">' + U.monthTitle(calMonth) + '</div>' +
        '<button class="btn ghost small" id="calNext">다음달 ›</button>' +
      '</div>' +
      '<div id="calBody">' + calendarGrid() + '</div>' +
      '<p class="hint" style="margin-top:10px">날짜를 누르면 그날의 주문을 자세히 볼 수 있어요.</p>' +
    '</div>';
  }

  function calendarGrid() {
    var p = calMonth.split('-'), y = +p[0], m = +p[1];
    var first = new Date(y, m - 1, 1);
    var startDow = first.getDay();
    var days = U.lastDayOfMonth(calMonth);
    var today = U.today();
    var html = U.DOW.map(function (d, i) {
      return '<div class="dow' + (i === 0 ? ' sun' : '') + '">' + d + '</div>';
    }).join('');

    for (var i = 0; i < startDow; i++) html += '<div class="day empty"></div>';

    for (var d = 1; d <= days; d++) {
      var date = calMonth + '-' + U.pad(d);
      var list = byDate(date).filter(function (o) { return o.status !== 'canceled'; });
      var dow = new Date(y, m - 1, d).getDay();
      var cls = 'day' + (dow === 0 ? ' sun' : '') + (date === today ? ' today' : '');
      var evs = list.slice(0, 3).map(function (o) {
        return '<div class="ev' + (o.status === 'done' ? ' done' : '') + '">' +
          (o.pickupTime ? U.esc(o.pickupTime) + ' ' : '') + U.esc(o.customerName) + '</div>';
      }).join('');
      var more = list.length > 3 ? '<div class="more">+' + (list.length - 3) + '건 더</div>' : '';
      html += '<div class="' + cls + '" data-date="' + date + '"><div class="dnum">' + d + '</div>' + evs + more + '</div>';
    }
    return '<div class="cal">' + html + '</div>';
  }

  function dayModal(date) {
    var list = byDate(date);
    var body = list.length ? list.map(function (o) {
      return '<div class="q-item">' +
        '<div class="row"><b>' + U.esc(o.customerName) + '</b>' +
        '<span class="badge ' + statusCls(o.status) + '">' + statusText(o.status) + '</span>' +
        '<div class="spacer"></div>' +
        '<span class="cap-sub">' + U.esc(o.pickupTime || '') + '</span></div>' +
        (o.phone ? '<div class="cap-sub">📞 ' + U.esc(U.phone(o.phone)) + '</div>' : '') +
        (o.request ? '<div style="margin-top:6px;white-space:pre-wrap">' + U.esc(o.request) + '</div>' : '') +
        (o.note ? '<div class="cap-sub" style="margin-top:4px">📌 ' + U.esc(o.note) + '</div>' : '') +
        '<div class="row" style="margin-top:8px">' +
          '<span class="badge gray">판매 ' + U.won(o.price) + '</span>' +
          '<span class="badge gray">원가 ' + U.won(o.cost) + '</span>' +
          '<span class="badge mint">이익 ' + U.won(U.toNum(o.price) - U.toNum(o.cost)) + '</span>' +
        '</div>' +
        '<div class="row" style="margin-top:8px">' +
          '<button class="btn ghost small" data-edit-order="' + o.id + '">수정</button>' +
          (o.status !== 'done' ? '<button class="btn mint small" data-done-order="' + o.id + '">픽업 완료</button>' : '') +
          '<button class="btn danger small" data-del-order="' + o.id + '">삭제</button>' +
        '</div></div>';
    }).join('') : '<div class="empty">이 날짜에는 주문이 없어요.</div>';

    U.modal(U.korDateFull(date) + ' 주문 ' + list.length + '건', body, function (m) {
      m.addEventListener('click', function (e) {
        var t = e.target;
        if (t.dataset.editOrder) { U.closeModal(); loadToForm(t.dataset.editOrder); }
        if (t.dataset.doneOrder) { DB.upsert('orders', { id: t.dataset.doneOrder, status: 'done' }); U.closeModal(); U.toast('픽업 완료로 바꿨어요'); App.render(); }
        if (t.dataset.delOrder && U.confirmBox('이 주문을 삭제할까요?')) { DB.remove('orders', t.dataset.delOrder); U.closeModal(); U.toast('삭제했어요'); App.render(); }
      });
    });
  }

  function statusText(s) { return s === 'done' ? '픽업완료' : s === 'canceled' ? '취소' : '예약'; }
  function statusCls(s) { return s === 'done' ? 'mint' : s === 'canceled' ? 'red' : ''; }

  /* ---------- 다가오는 픽업 ---------- */
  function upcomingCard() {
    var today = U.today();
    var list = all().filter(function (o) {
      return o.status === 'reserved' && o.pickupDate >= today;
    }).slice(0, 8);
    if (!list.length) return '<div class="card"><h2>📅 다가오는 픽업</h2><div class="empty">예정된 픽업이 없어요.</div></div>';
    var rows = list.map(function (o) {
      var dday = U.diffDays(today, o.pickupDate);
      return '<tr><td>' + U.korDate(o.pickupDate) + ' ' + U.esc(o.pickupTime || '') +
        ' <span class="badge">' + (dday === 0 ? '오늘' : dday === 1 ? '내일' : 'D-' + dday) + '</span></td>' +
        '<td>' + U.esc(o.customerName) + '</td>' +
        '<td>' + U.esc((o.request || '').slice(0, 30)) + '</td>' +
        '<td class="num">' + U.won(o.price) + '</td>' +
        '<td class="num"><button class="icon-btn" data-edit-order="' + o.id + '">✏️</button></td></tr>';
    }).join('');
    return '<div class="card"><h2>📅 다가오는 픽업</h2><div class="table-wrap"><table>' +
      '<thead><tr><th>픽업</th><th>고객</th><th>주문내용</th><th class="num">가격</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  /* ---------- 폼 처리 ---------- */
  function loadToForm(id) {
    var o = DB.find('orders', id); if (!o) return;
    editingId = id;
    var f = U.$('#orderForm');
    f.oid.value = o.id;
    f.customerName.value = o.customerName || '';
    f.phone.value = o.phone || '';
    f.pickupDate.value = o.pickupDate || '';
    f.pickupTime.value = o.pickupTime || '';
    f.request.value = o.request || '';
    f.price.value = o.price || '';
    f.cost.value = o.cost || '';
    f.deposit.value = o.deposit || '';
    f.note.value = o.note || '';
    f.source.value = o.source || 'manual';
    f.status.value = o.status || 'reserved';
    U.$('#formSubmit').textContent = '수정 저장';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    U.toast('주문을 불러왔어요');
  }

  function resetForm() {
    editingId = null;
    var f = U.$('#orderForm');
    f.reset();
    f.oid.value = '';
    f.pickupDate.value = U.today();
    f.pickupTime.value = '14:00';
    U.$('#formSubmit').textContent = '주문 저장';
  }

  function saveForm(e) {
    e.preventDefault();
    var f = e.target;
    var name = f.customerName.value.trim();
    if (!name) { U.toast('고객이름을 적어주세요'); return; }
    if (!f.pickupDate.value) { U.toast('픽업날짜를 골라주세요'); return; }

    var isNew = !f.oid.value;
    var saved = DB.upsert('orders', {
      id: f.oid.value || undefined,
      customerName: name,
      phone: U.phone(f.phone.value.trim()),
      pickupDate: f.pickupDate.value,
      pickupTime: f.pickupTime.value,
      request: f.request.value.trim(),
      price: U.toNum(f.price.value),
      cost: U.toNum(f.cost.value),
      deposit: U.toNum(f.deposit.value),
      note: f.note.value.trim(),
      source: f.source.value,
      status: f.status.value,
      orderDate: f.oid.value ? undefined : U.today()
    });
    calMonth = saved.pickupDate.slice(0, 7);
    resetForm();
    U.toast(isNew ? '주문을 저장했어요 🎂' : '수정했어요');
    App.render();
  }

  /* ---------- 채팅 내용으로 주문 만들기 ---------- */

  // 서식 예시 (사장님이 고객에게 보내거나, 메모할 때 쓰는 양식)
  var FORM_SAMPLE =
    '고객이름: \n연락처: \n픽업날짜: \n픽업시간: \n주문요청사항: \n가격: \n참고사항: ';

  function pasteModal() {
    var html = '' +
      '<p class="hint">카톡·문자·메모에 적힌 예약 내용을 <b>그대로 복사해서 아래에 붙여넣으면</b> 주문 목록으로 만들어 드립니다. ' +
      '등록하기 전에 내용을 고칠 수 있어요.</p>' +
      '<div class="info">✅ <b>서식대로 적은 글</b>(고객이름: / 연락처: / 픽업날짜: …)은 정확하게 읽습니다.<br>' +
      '✅ <b>카톡 대화를 그대로</b> 붙여넣어도 이름·전화번호·날짜·금액을 최대한 찾아냅니다.</div>' +
      '<div class="row" style="margin:10px 0">' +
        '<button class="btn ghost small" id="pvCopyForm">📋 서식 복사</button>' +
        '<button class="btn ghost small" id="pvSample">예시 넣어보기</button>' +
      '</div>' +
      '<div class="field"><label>붙여넣기</label>' +
      '<textarea id="pvText" style="min-height:150px" placeholder="고객이름: 김민지&#10;연락처: 010-1234-5678&#10;픽업날짜: 2026-08-11&#10;주문요청사항: 생화케이크 2단&#10;가격: 145000"></textarea></div>' +
      '<div class="row"><button class="btn" id="pvParse">내용 읽기</button>' +
      '<span class="cap-sub">여러 건이면 이어서 붙여넣으세요</span></div>' +
      '<div id="pvPreview"></div>';

    U.modal('💬 채팅 내용으로 주문 만들기', html, function (body) {
      U.$('#pvCopyForm', body).onclick = function () { U.copyText(FORM_SAMPLE); };
      U.$('#pvSample', body).onclick = function () {
        U.$('#pvText', body).value =
          '고객이름: 김민지\n연락처: 010-1234-5678\n픽업날짜: ' + U.addDays(U.today(), 7) +
          '\n픽업시간: 14:00\n주문요청사항: 생화케이크 2단\n가격: 145000\n참고사항: 핑크톤\n\n' +
          '고객이름: 박서준\n연락처: 010-2222-3333\n픽업날짜: ' + U.addDays(U.today(), 9) +
          '\n주문요청사항: 딸기케이크 1호\n가격: 48000';
      };
      U.$('#pvParse', body).onclick = function () { showPreview(body); };
    });
  }

  function showPreview(body) {
    var rows = parseReservations(U.$('#pvText', body).value);
    var box = U.$('#pvPreview', body);
    if (!rows.length) {
      box.innerHTML = '<div class="warn" style="margin-top:12px">읽을 수 있는 예약을 찾지 못했어요.<br>' +
        '최소한 <b>이름과 픽업날짜</b>는 들어 있어야 합니다. [📋 서식 복사]를 눌러 그 모양대로 적어보세요.</div>';
      return;
    }

    var existing = DB.list('orders');
    box.innerHTML = '<div class="divider"></div>' +
      '<p class="hint">' + rows.length + '건을 찾았어요. 확인하고 고친 뒤 등록하세요.</p>' +
      rows.map(function (r, i) {
        var dup = existing.some(function (o) {
          return o.customerName === r.customerName && o.pickupDate === r.pickupDate;
        });
        var c = Cost.calcFromText(r.request);
        var cost = c.ok ? Math.round(c.total / 10) * 10 : 0;
        if (!r.price && c.ok) r.price = c.suggested;
        return '<div class="q-item pv-row" data-i="' + i + '">' +
          '<div class="row" style="margin-bottom:8px">' +
            '<label style="margin:0"><input type="checkbox" class="pv-chk" style="width:auto"' +
              (dup ? '' : ' checked') + '> 등록</label>' +
            '<div class="spacer"></div>' +
            (dup ? '<span class="badge red">이미 등록된 예약</span>'
                 : (c.ok ? '<span class="badge mint">원가 자동입력됨</span>' : '')) +
          '</div>' +
          '<div class="grid two pv-grid">' +
            '<div class="field"><label>고객이름</label><input class="pv-name" value="' + U.esc(r.customerName) + '"></div>' +
            '<div class="field"><label>연락처</label><input class="pv-phone" value="' + U.esc(r.phone) + '"></div>' +
            '<div class="field"><label>픽업날짜</label><input class="pv-date" type="date" value="' + U.esc(r.pickupDate) + '"></div>' +
            '<div class="field"><label>픽업시간</label><input class="pv-time" type="time" value="' + U.esc(r.pickupTime) + '"></div>' +
          '</div>' +
          '<div class="field"><label>주문요청사항</label><input class="pv-req" value="' + U.esc(r.request) + '"></div>' +
          '<div class="grid two pv-grid">' +
            '<div class="field"><label>가격</label><input class="pv-price" type="number" step="any" value="' + U.esc(r.price || '') + '"></div>' +
            '<div class="field"><label>원가</label><input class="pv-cost" type="number" step="any" value="' + U.esc(cost || '') + '"></div>' +
          '</div>' +
          '<div class="field" style="margin:0"><label>참고사항</label><input class="pv-note" value="' + U.esc(r.note || '') + '"></div>' +
        '</div>';
      }).join('') +
      '<div class="row end" style="margin-top:12px"><button class="btn" id="pvSave">선택한 주문 등록</button></div>';

    U.$('#pvSave', body).onclick = function () {
      var n = 0;
      U.$$('.pv-row', body).forEach(function (row) {
        if (!U.$('.pv-chk', row).checked) return;
        var name = U.$('.pv-name', row).value.trim();
        var date = U.$('.pv-date', row).value;
        if (!name || !date) return;
        DB.upsert('orders', {
          customerName: name,
          phone: U.phone(U.$('.pv-phone', row).value.trim()),
          pickupDate: date,
          pickupTime: U.$('.pv-time', row).value || '14:00',
          request: U.$('.pv-req', row).value.trim(),
          price: U.toNum(U.$('.pv-price', row).value),
          cost: U.toNum(U.$('.pv-cost', row).value),
          note: U.$('.pv-note', row).value.trim(),
          deposit: 0, source: 'paste', status: 'reserved', orderDate: U.today()
        });
        n++;
      });
      U.closeModal();
      U.toast(n ? n + '건 등록했어요 🎂' : '등록된 주문이 없어요');
      App.render();
    };
  }

  /* ---------- 붙여넣은 글 읽기 ---------- */

  // 서식에서 쓰는 이름표들 (사장님이 조금 다르게 적어도 알아듣도록)
  var LABELS = [
    { key: 'customerName', words: ['고객이름', '고객명', '예약자', '성함', '이름'] },
    { key: 'phone',        words: ['연락처', '전화번호', '핸드폰', '휴대폰', '전화', '번호'] },
    { key: 'pickupDate',   words: ['픽업날짜', '픽업일자', '픽업일', '수령일', '픽업', '날짜'] },
    { key: 'pickupTime',   words: ['픽업시간', '수령시간', '시간'] },
    { key: 'request',      words: ['주문요청사항', '주문내용', '요청사항', '주문', '요청', '메뉴', '내용'] },
    { key: 'price',        words: ['판매가', '결제금액', '가격', '금액'] },
    { key: 'note',         words: ['참고사항', '특이사항', '참고', '비고', '메모'] }
  ];
  // 긴 단어부터 찾아야 "픽업날짜"가 "픽업"으로 잘리지 않음
  var LABEL_WORDS = LABELS.reduce(function (a, l) { return a.concat(l.words); }, [])
    .sort(function (a, b) { return b.length - a.length; });
  var LABEL_RE = new RegExp('(' + LABEL_WORDS.join('|') + ')\\s*[:：]', 'g');
  // 콜론 없이 "이름 김민지 / 전화 010-…" 처럼 적은 경우용
  var LABEL_RE_LOOSE = new RegExp('(?:^|[\\s/|,\\-])(' + LABEL_WORDS.join('|') + ')\\s*[:：]?[ \\t]+', 'g');
  function labelKey(word) {
    var f = LABELS.find(function (l) { return l.words.indexOf(word) >= 0; });
    return f ? f.key : null;
  }

  function parseReservations(text) {
    var raw = String(text || '');
    if (!raw.trim()) return [];
    // 1) "고객이름: 김민지" 처럼 콜론이 있는 서식
    var labeled = parseLabeled(raw, LABEL_RE);
    if (labeled.length) return labeled;
    // 2) "이름 김민지 / 전화 010-..." 처럼 콜론 없이 적은 서식
    //    (이름표가 3종류 이상 나올 때만 서식으로 인정 - 일반 대화를 오해하지 않도록)
    var loose = parseLabeled(raw, LABEL_RE_LOOSE, 3);
    if (loose.length) return loose;
    var byLine = parseFree(raw, true);
    if (byLine.length) return byLine;
    return parseFree(raw, false);   // 줄마다 못 찾으면 전체를 한 건으로
  }

  /* 방식 A - "고객이름: 김민지" 처럼 이름표가 있는 글 */
  function parseLabeled(text, re, minKinds) {
    re.lastIndex = 0;
    var marks = [], kinds = {}, m;
    while ((m = re.exec(text)) !== null) {
      var key = labelKey(m[1]);
      if (!key) continue;
      kinds[key] = true;
      marks.push({ key: key, start: m.index, valueFrom: m.index + m[0].length });
    }
    if (!marks.length) return [];
    if (minKinds && Object.keys(kinds).length < minKinds) return [];

    var out = [], cur = null;
    marks.forEach(function (mk, i) {
      var end = i + 1 < marks.length ? marks[i + 1].start : text.length;
      var value = text.slice(mk.valueFrom, end)
        .replace(/^[\s\-|/,]+/, '').replace(/[\s\-|/,]+$/, '').trim();
      // 이미 채운 항목이 또 나오면 다음 사람 주문으로 봄
      if (!cur || cur[mk.key] !== undefined) {
        if (cur) out.push(cur);
        cur = {};
      }
      cur[mk.key] = value;
    });
    if (cur) out.push(cur);

    return out.map(normalize).filter(function (r) {
      return r.customerName && r.customerName !== '이름없음';
    });
  }

  /* 방식 B - 카톡 대화처럼 자유롭게 적힌 글 */
  function parseFree(text, perLine) {
    var chunks = perLine ? String(text).split(/\r?\n/) : [String(text)];
    var out = [];
    var speaker = '';

    chunks.forEach(function (chunk) {
      var s = String(chunk).replace(/\t/g, ' ');
      if (!s.trim()) return;

      // 카톡 내보내기 형식의 말머리 제거
      var k1 = s.match(/^\[([^\]]{1,20})\]\s*\[[^\]]{1,20}\]\s*/);
      if (k1) { speaker = k1[1]; s = s.slice(k1[0].length); }
      var k2 = s.match(/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(오전|오후)\s*\d{1,2}:\d{2},\s*([^:]{1,20}):\s*/);
      if (k2) { speaker = k2[2].trim(); s = s.slice(k2[0].length); }

      var pm = s.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/);
      var date = findDate(s);
      if (!pm && !date) return;

      var mm = s.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,7})\s*원/);
      var price = mm ? U.toNum(mm[1]) : 0;

      var rest = s;
      [pm && pm[0], mm && mm[0]].forEach(function (x) { if (x) rest = rest.replace(x, ' '); });
      var time = findTime(rest);
      rest = stripDateTime(rest);

      // 카톡 말머리가 있으면 그 사람이 곧 고객
      var name = speaker || pickName(rest);
      var request = cleanRequest(rest, name);

      out.push(normalize({
        customerName: name, phone: pm ? pm[0] : '', pickupDate: date,
        pickupTime: time, request: request, price: price
      }));
    });

    return out.filter(function (r) { return r.customerName && r.customerName !== '이름없음'; });
  }

  /* ---------- 값 다듬기 ---------- */

  // 이름이 아닌 흔한 말들 (카톡 대화에서 이름으로 잘못 잡히는 것 방지)
  var NOT_NAME = /^(안녕하세요|안녕하십니까|감사합니다|감사해요|고맙습니다|부탁드립니다|부탁드려요|부탁해요|죄송합니다|알겠습니다|알겠어요|가능할까요|가능한가요|가능해요|맞나요|맞을까요|문의드립니다|문의드려요|예약이요|주문이요|네네|넵넵|여보세요|사장님)$/;
  function looksLikeName(w) {
    if (!w) return false;
    if (NOT_NAME.test(w)) return false;
    if (/케이크|주문|예약|픽업|가격|금액|문의|배송|포장/.test(w)) return false;
    return true;
  }
  // 남은 글에서 사람 이름처럼 보이는 첫 단어 고르기
  function pickName(text) {
    // "박지훈입니다", "김민지예요", "이서연님" 처럼 뒤에 말이 붙은 경우를 먼저 봄
    var tagged = text.match(/([가-힣]{2,4})(?:입니다|입니당|이라고|이에요|예요|이구요|이고요|님|씨)/);
    if (tagged && looksLikeName(tagged[1])) return tagged[1];
    var re = /[가-힣]{2,4}/g, m;
    while ((m = re.exec(text)) !== null) {
      if (looksLikeName(m[0])) return m[0];
    }
    return '';
  }

  // 주문내용에서 인사말·이름·군더더기를 걷어냄 (미리보기에서 고칠 수 있으니 완벽할 필요는 없음)
  function cleanRequest(text, name) {
    var s = text;
    if (name) s = s.replace(new RegExp(name + '(입니다|입니당|이라고|이에요|예요|이구요|이고요|님|씨)?', 'g'), ' ');
    return s
      .replace(/(안녕하세요|안녕하십니까|감사합니다|감사해요|고맙습니다|부탁드립니다|부탁드려요|부탁해요|예약할게요|예약이요|주문할게요|주문이요|맞나요|맞을까요|가능할까요|가능한가요|찾으러 ?갈게요|가지러 ?갈게요)/g, ' ')
      .replace(/(예약자|연락처|고객명|고객이름|픽업날짜|픽업시간|참고사항|주문요청사항)/g, ' ')
      .replace(/[?!]+/g, ' ')
      // 전화번호·날짜를 걷어내고 남은 조사 부스러기 정리
      .replace(/(^|\s)(이고요|이구요|입니다|입니당|이에요|예요|에|은|는|이|가|요)(?=\s|$)/g, ' ')
      .replace(/\s{2,}/g, ' ').replace(/^[\s/,|\-]+|[\s/,|\-]+$/g, '').trim();
  }

  function findDate(s) {
    var m = s.match(/(20\d{2})\s*[-.\/년]\s*(\d{1,2})\s*[-.\/월]\s*(\d{1,2})/);
    if (m) return m[1] + '-' + U.pad(+m[2]) + '-' + U.pad(+m[3]);
    m = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (m) return yearFor(+m[1], +m[2]);
    m = s.match(/(?:^|[^\d])(\d{1,2})\s*[\/.]\s*(\d{1,2})(?![\d:])/);
    if (m) return yearFor(+m[1], +m[2]);
    return '';
  }
  // 월/일만 적혀 있으면 올해로 보되, 이미 지난 날짜면 내년으로
  function yearFor(mon, day) {
    var now = new Date();
    var y = now.getFullYear();
    var d = y + '-' + U.pad(mon) + '-' + U.pad(day);
    if (d < U.today()) d = (y + 1) + '-' + U.pad(mon) + '-' + U.pad(day);
    return d;
  }
  function findTime(s) {
    var ampm = s.match(/(오전|오후)\s*(\d{1,2})\s*(?:시|:)\s*(\d{1,2})?/);
    if (ampm) {
      var h = +ampm[2];
      if (ampm[1] === '오후' && h < 12) h += 12;
      if (ampm[1] === '오전' && h === 12) h = 0;
      return U.pad(h) + ':' + U.pad(ampm[3] ? +ampm[3] : 0);
    }
    var m = s.match(/(?:^|[^\d])(\d{1,2})\s*:\s*(\d{2})/);
    if (m) return U.pad(+m[1]) + ':' + U.pad(+m[2]);
    m = s.match(/(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/);
    if (m) {
      var h = +m[1];
      // "2시" 처럼 오전/오후를 안 적었으면 케이크 픽업 시간대(오후)로 봄
      if (h >= 1 && h <= 8) h += 12;
      return U.pad(h) + ':' + U.pad(m[2] ? +m[2] : 0);
    }
    return '';
  }
  function stripDateTime(s) {
    return s
      .replace(/20\d{2}\s*[-.\/년]\s*\d{1,2}\s*[-.\/월]\s*\d{1,2}\s*일?/g, ' ')
      .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, ' ')
      .replace(/(오전|오후)?\s*\d{1,2}\s*[:시]\s*\d{0,2}\s*분?/g, ' ')
      .replace(/\d{1,2}\s*[\/.]\s*\d{1,2}/g, ' ');
  }

  // 읽어낸 값을 주문 형식으로 정리
  function normalize(r) {
    var date = r.pickupDate ? (findDate(r.pickupDate) || r.pickupDate) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = '';
    // 시간을 따로 안 적고 "픽업날짜: 12월 24일 오후 5시" 처럼 함께 적은 경우도 읽어냄
    var time = (r.pickupTime && findTime(r.pickupTime)) ||
               (r.pickupDate && findTime(String(r.pickupDate).replace(/20\d{2}\s*[-.\/년]\s*\d{1,2}\s*[-.\/월]\s*\d{1,2}\s*일?/g, ' '))) || '';
    var name = String(r.customerName || '').replace(/(님|씨)$/, '').trim();
    return {
      customerName: name,
      phone: U.phone(String(r.phone || '').trim()),
      pickupDate: date || U.today(),
      pickupTime: time || '14:00',
      request: String(r.request || '').trim(),
      price: U.toNum(r.price),
      note: String(r.note || '').trim()
    };
  }

  /* ---------- 이벤트 연결 ---------- */
  function bind(view) {
    U.$('#orderForm', view).addEventListener('submit', saveForm);
    U.$('#formReset', view).onclick = resetForm;
    U.$('#pasteImport', view).onclick = pasteModal;

    U.$('#autoCost', view).onclick = function () {
      var f = U.$('#orderForm', view);
      var r = Cost.calcFromText(f.request.value);
      if (!r.ok) { U.toast(r.reason); return; }
      f.cost.value = Math.round(r.total / 10) * 10;   // 10원 단위로 정리
      if (!U.toNum(f.price.value)) f.price.value = r.suggested;
      U.toast('원가 ' + U.won(r.total) + ' — ' + r.name + ' (' + r.sourceLabel + ')');
    };

    U.$('#calPrev', view).onclick = function () { calMonth = U.shiftMonth(calMonth, -1); refreshCal(); };
    U.$('#calNext', view).onclick = function () { calMonth = U.shiftMonth(calMonth, 1); refreshCal(); };

    view.addEventListener('click', function (e) {
      var day = e.target.closest('.day[data-date]');
      if (day) { dayModal(day.dataset.date); return; }
      var t = e.target;
      if (t.dataset.editOrder) loadToForm(t.dataset.editOrder);
    });

    function refreshCal() {
      U.$('#calTitle', view).textContent = U.monthTitle(calMonth);
      U.$('#calBody', view).innerHTML = calendarGrid();
    }
  }

  return { render: render, all: all, byMonth: byMonth, byDate: byDate,
           statusText: statusText, statusCls: statusCls, parseReservations: parseReservations };
})();
