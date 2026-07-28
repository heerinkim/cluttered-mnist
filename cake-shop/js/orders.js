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
        '<button class="btn ghost small" id="naverImport">🟢 네이버 예약 가져오기</button>' +
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
            '<option value="naver"' + (set.reservationSource === 'naver' ? ' selected' : '') + '>네이버 예약</option>' +
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

  /* ---------- 네이버 예약 가져오기 ---------- */
  function naverModal() {
    var html = '' +
      '<div class="info">네이버 예약은 로그인이 필요해서 프로그램이 자동으로 가져올 수 없어요. ' +
      '대신 <b>네이버 예약 관리 화면의 내용을 복사해서 아래에 붙여넣으면</b> 자동으로 정리해 드립니다. ' +
      '(엑셀 다운로드 파일의 내용을 붙여넣어도 됩니다.)</div>' +
      '<div class="field" style="margin-top:12px"><label>붙여넣기</label>' +
      '<textarea id="nvText" style="min-height:150px" placeholder="김민지 010-1234-5678 2026-08-03 14:00 생화케이크 1호 65,000원"></textarea></div>' +
      '<div class="row"><button class="btn ghost small" id="nvParse">내용 읽기</button>' +
      '<span class="cap-sub">한 줄에 예약 하나씩</span></div>' +
      '<div id="nvPreview"></div>';
    U.modal('🟢 네이버 예약 가져오기', html, function (body) {
      U.$('#nvParse', body).onclick = function () {
        var rows = parseReservations(U.$('#nvText', body).value);
        if (!rows.length) { U.$('#nvPreview', body).innerHTML = '<div class="warn" style="margin-top:12px">읽을 수 있는 예약을 찾지 못했어요. 이름·전화번호·날짜가 한 줄에 있어야 해요.</div>'; return; }
        U.$('#nvPreview', body).innerHTML = '<div class="divider"></div>' +
          '<div class="table-wrap"><table><thead><tr><th></th><th>이름</th><th>연락처</th><th>픽업일</th><th>시간</th><th>내용</th><th class="num">가격</th></tr></thead><tbody>' +
          rows.map(function (r, i) {
            return '<tr><td><input type="checkbox" class="nv-chk" data-i="' + i + '" checked style="width:auto"></td>' +
              '<td>' + U.esc(r.customerName) + '</td><td>' + U.esc(r.phone) + '</td><td>' + U.esc(r.pickupDate) + '</td>' +
              '<td>' + U.esc(r.pickupTime) + '</td><td>' + U.esc(r.request) + '</td><td class="num">' + U.num(r.price) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="row end" style="margin-top:12px"><button class="btn" id="nvSave">선택한 예약 등록</button></div>';
        U.$('#nvSave', body).onclick = function () {
          var n = 0;
          U.$$('.nv-chk', body).forEach(function (chk) {
            if (!chk.checked) return;
            var r = rows[+chk.dataset.i];
            // 같은 사람 + 같은 날짜가 이미 있으면 건너뜀 (중복 방지)
            var dup = DB.list('orders').some(function (o) {
              return o.customerName === r.customerName && o.pickupDate === r.pickupDate;
            });
            if (dup) return;
            DB.upsert('orders', Object.assign({}, r, {
              source: 'naver', status: 'reserved', orderDate: U.today(), cost: 0, deposit: 0, note: ''
            }));
            n++;
          });
          U.closeModal();
          U.toast(n + '건 등록했어요' + (n === 0 ? ' (이미 등록된 예약)' : ''));
          App.render();
        };
      };
    });
  }

  // 붙여넣은 글에서 예약 정보 뽑아내기
  function parseReservations(text) {
    var out = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var raw = line.trim();
      if (!raw) return;
      var s = raw.replace(/\t/g, ' ');

      // 전화번호
      var pm = s.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/);
      // 날짜: 2026-08-03 / 2026.08.03 / 8월 3일
      var dm = s.match(/(20\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
      var date = '';
      if (dm) {
        date = dm[1] + '-' + U.pad(+dm[2]) + '-' + U.pad(+dm[3]);
      } else {
        var km = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
        if (km) date = new Date().getFullYear() + '-' + U.pad(+km[1]) + '-' + U.pad(+km[2]);
      }
      if (!pm && !date) return;   // 전화번호도 날짜도 없으면 예약 줄이 아님

      // 시간
      var tm = s.match(/(\d{1,2})\s*[:시]\s*(\d{2})?/);
      var time = tm ? U.pad(+tm[1]) + ':' + U.pad(tm[2] ? +tm[2] : 0) : '';
      // 시간이 날짜의 일부로 잘못 잡히는 경우 방지
      if (tm && dm && s.indexOf(tm[0]) === s.indexOf(dm[0])) time = '';

      // 가격
      var mm = s.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,7})\s*원/);
      var price = mm ? U.toNum(mm[1]) : 0;

      // 이름: 한글 2~5자 중 첫 번째 (전화/날짜/가격 부분 제거 후)
      var rest = s;
      [pm && pm[0], dm && dm[0], mm && mm[0], tm && tm[0]].forEach(function (x) { if (x) rest = rest.replace(x, ' '); });
      var nm = rest.match(/[가-힣]{2,5}(?=[\s,\/]|$)/);
      var name = nm ? nm[0] : (rest.trim().split(/\s+/)[0] || '이름없음');

      // 주문내용: 이름/숫자 제거 후 남은 글
      var request = rest.replace(name, ' ').replace(/[예약자|연락처|픽업|주문|고객|메뉴|상태|확정|완료]{2,}/g, ' ')
        .replace(/\s+/g, ' ').trim();

      out.push({
        customerName: name, phone: U.phone(pm ? pm[0] : ''), pickupDate: date || U.today(),
        pickupTime: time || '14:00', request: request, price: price
      });
    });
    return out;
  }

  /* ---------- 이벤트 연결 ---------- */
  function bind(view) {
    U.$('#orderForm', view).addEventListener('submit', saveForm);
    U.$('#formReset', view).onclick = resetForm;
    U.$('#naverImport', view).onclick = naverModal;

    U.$('#autoCost', view).onclick = function () {
      var f = U.$('#orderForm', view);
      var r = Cost.calcFromText(f.request.value);
      if (!r.ok) { U.toast(r.reason); return; }
      f.cost.value = Math.round(r.total / 10) * 10;   // 10원 단위로 정리
      if (!U.toNum(f.price.value)) f.price.value = r.suggested;
      U.toast('원가 ' + U.won(r.total) + ' (' + r.recipe.name + ')');
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
