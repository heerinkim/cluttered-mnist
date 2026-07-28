/* 고객 알림 - 주문 당일 / 픽업 전날 / 픽업 후 3가지 문자
   문자는 사장님 요금제의 기본 제공 문자를 쓰기 때문에 추가 비용이 들지 않습니다.
   (버튼을 누르면 문자앱이 내용이 채워진 채로 열립니다) */
window.Notify = (function () {

  var STAGES = [
    { key: 'orderDay',    label: '주문 당일',  emoji: '🧾', desc: '주문을 받은 날 보내는 확인 문자' },
    { key: 'dayBefore',   label: '픽업 전날',  emoji: '⏰', desc: '픽업 하루 전에 보내는 안내 문자' },
    { key: 'afterPickup', label: '픽업 후',    emoji: '💐', desc: '픽업이 끝난 뒤 보내는 감사 문자' }
  ];

  /* ---------- 문구 만들기 ---------- */
  function buildMessage(stageKey, order) {
    var t = DB.templates()[stageKey] || '';
    var set = DB.settings();
    var price = U.toNum(order.price), dep = U.toNum(order.deposit);
    var map = {
      '가게이름': set.shopName || '케이크 공방',
      '고객명': order.customerName || '',
      '픽업일': U.korDate(order.pickupDate),
      '픽업시간': order.pickupTime || '',
      '주문내용': (order.request || '').replace(/\n/g, ' '),
      '금액': U.won(price),
      '예약금': U.won(dep),
      '잔금': U.won(Math.max(0, price - dep)),
      '참고사항': order.note || ''
    };
    return t.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (m, k) {
      return map.hasOwnProperty(k) ? map[k] : m;
    });
  }

  /* ---------- 보낼 대상 찾기 ----------
     아직 안 보낸 건은 날짜가 지나도 사라지지 않고 "놓침"으로 남습니다. */
  function queue() {
    var today = U.today();
    var tomorrow = U.addDays(today, 1);
    var orders = DB.list('orders').filter(function (o) { return o.status !== 'canceled'; });

    function sent(o, k) { return !!(o.notify && o.notify[k] && o.notify[k].sent); }
    function withLate(o, isLate) { return { order: o, late: isLate }; }

    var q = { orderDay: [], dayBefore: [], afterPickup: [] };

    orders.forEach(function (o) {
      var od = o.orderDate || (o.createdAt || '').slice(0, 10);

      // 주문 당일 - 주문받은 날. 못 보냈으면 7일까지 놓침으로 남김
      if (od && !sent(o, 'orderDay')) {
        var dOrder = U.diffDays(od, today);
        if (dOrder >= 0 && dOrder <= 7) q.orderDay.push(withLate(o, dOrder >= 1));
      }

      // 픽업 전날 - 내일 픽업이면 오늘 발송. 픽업 당일까지 못 보냈으면 놓침
      if (!sent(o, 'dayBefore') && o.pickupDate >= today) {
        if (o.pickupDate === tomorrow) q.dayBefore.push(withLate(o, false));
        else if (o.pickupDate === today) q.dayBefore.push(withLate(o, true));
      }

      // 픽업 후 - 픽업이 끝난 뒤. 7일까지 남김
      if (!sent(o, 'afterPickup')) {
        var dPick = U.diffDays(o.pickupDate, today);
        if (dPick >= 1 && dPick <= 7) q.afterPickup.push(withLate(o, dPick >= 2));
        else if (dPick === 0 && o.status === 'done') q.afterPickup.push(withLate(o, false));
      }
    });

    // 픽업이 가까운 순서로
    Object.keys(q).forEach(function (k) {
      q[k].sort(function (a, b) { return (a.order.pickupDate || '').localeCompare(b.order.pickupDate || ''); });
    });
    return q;
  }

  function totalCount() {
    var q = queue();
    return STAGES.reduce(function (a, s) { return a + q[s.key].length; }, 0);
  }

  function markSent(orderId, stage, value) {
    var o = DB.find('orders', orderId); if (!o) return;
    var n = Object.assign({}, o.notify || {});
    n[stage] = value ? { sent: true, at: new Date().toISOString() } : { sent: false, at: '' };
    DB.upsert('orders', { id: orderId, notify: n });
  }

  // 최근에 보낸 기록
  function history(limit) {
    var out = [];
    DB.list('orders').forEach(function (o) {
      STAGES.forEach(function (s) {
        var rec = o.notify && o.notify[s.key];
        if (rec && rec.sent && rec.at) out.push({ order: o, stage: s, at: rec.at });
      });
    });
    out.sort(function (a, b) { return b.at.localeCompare(a.at); });
    return out.slice(0, limit || 10);
  }

  /* ---------- 화면 ---------- */
  function render(view) {
    var q = queue();
    var total = STAGES.reduce(function (a, s) { return a + q[s.key].length; }, 0);
    var set = DB.settings();
    var lateCount = STAGES.reduce(function (a, s) {
      return a + q[s.key].filter(function (x) { return x.late; }).length;
    }, 0);

    view.innerHTML = '' +
      '<div class="card">' +
        '<h2>💬 오늘 보낼 알림 ' + (total ? '<span class="badge">' + total + '건</span>' : '') + '</h2>' +
        '<p class="hint">사장님 요금제의 기본 문자를 쓰기 때문에 <b>추가 비용이 들지 않습니다.</b> ' +
        '[문자 보내기]를 누르면 휴대폰 문자앱이 내용이 채워진 채로 열려요. 보내기만 누르시면 됩니다.</p>' +
        '<div class="grid three">' +
          STAGES.map(function (s) {
            return '<div class="stat ' + (q[s.key].length ? 'rose' : '') + '">' +
              '<div class="label">' + s.emoji + ' ' + s.label + '</div>' +
              '<div class="value">' + q[s.key].length + '건</div></div>';
          }).join('') +
        '</div>' +
        (lateCount ? '<div class="warn" style="margin-top:12px">⚠️ 보낼 때를 <b>놓친 알림이 ' + lateCount + '건</b> 있어요. ' +
          '아래 <span class="badge red">놓침</span> 표시를 확인해 주세요.</div>' : '') +
        (total ? '<div class="row" style="margin-top:12px"><button class="btn" id="startSend">📱 순서대로 보내기 시작</button>' +
          '<span class="cap-sub">한 건 보낼 때마다 다음 사람으로 넘어갑니다</span></div>' : '') +
      '</div>' +

      STAGES.map(function (s) { return stageCard(s, q[s.key]); }).join('') +

      historyCard() +

      '<div class="card">' +
        '<h2>💻 컴퓨터에서 무료로 문자 보내기</h2>' +
        '<p class="hint">휴대폰을 들지 않고 컴퓨터에서 바로 보내고 싶다면, 아래 서비스로 휴대폰을 연결해 두세요. ' +
        '문자는 사장님 휴대폰에서 나가므로 <b>추가 요금이 없습니다.</b></p>' +
        '<div class="row">' +
          '<button class="btn ghost small" data-open="https://messages.google.com/web">안드로이드 · 메시지 웹</button>' +
          '<button class="btn ghost small" data-open="https://www.samsung.com/sec/apps/samsung-messages/">갤럭시 · 삼성 메시지</button>' +
        '</div>' +
        '<p class="hint" style="margin-top:8px">아이폰은 같은 애플 계정의 맥에서 메시지 앱으로 보낼 수 있어요.</p>' +
      '</div>' +

      '<div class="card">' +
        '<h2>✍️ 알림 문구 편집</h2>' +
        '<p class="hint">중괄호 두 개로 감싼 부분은 주문 내용으로 자동으로 바뀝니다: ' +
        ['가게이름', '고객명', '픽업일', '픽업시간', '주문내용', '금액', '예약금', '잔금'].map(function (v) {
          return '<code>{{' + v + '}}</code>';
        }).join(' ') + '</p>' +
        STAGES.map(function (s) {
          return '<div class="field"><label>' + s.emoji + ' ' + s.label + ' <span style="font-weight:400">— ' + s.desc + '</span></label>' +
            '<textarea data-tpl="' + s.key + '" style="min-height:110px">' + U.esc(DB.templates()[s.key]) + '</textarea></div>';
        }).join('') +
        '<div class="row end"><button class="btn ghost" id="tplReset">기본 문구로 되돌리기</button>' +
        '<button class="btn" id="tplSave">문구 저장</button></div>' +
      '</div>' +

      '<div class="card">' +
        '<h2>⚙️ 예약 받는 방식</h2>' +
        '<div class="field"><select id="resSource" style="max-width:340px">' +
          '<option value="manual"' + (set.reservationSource === 'manual' ? ' selected' : '') + '>직접 입력 (주문서에 사장님이 입력)</option>' +
          '<option value="paste"' + (set.reservationSource === 'paste' ? ' selected' : '') + '>채팅 내용 붙여넣기</option>' +
        '</select></div>' +
        '<p class="hint">주문서 화면의 [💬 채팅 내용으로 주문 만들기]는 어느 쪽을 골라도 언제든 쓸 수 있어요. ' +
        '이 설정은 주문서의 <b>주문 경로 기본값</b>만 정합니다.</p>' +
        '<div class="warn">📱 정해진 시각에 <b>사장님이 안 눌러도 자동으로</b> 문자가 나가게 하려면 문자 발송 서비스 가입 · ' +
        '발신번호 사전등록 · 작은 서버가 필요하고 건당 10~20원이 듭니다. 주문이 많아져 손으로 보내기 번거로워지면 그때 붙이면 됩니다.</div>' +
      '</div>';

    bind(view);
  }

  function stageCard(stage, list) {
    var body = list.length ? list.map(function (x, i) {
      var o = x.order;
      var msg = buildMessage(stage.key, o);
      return '<div class="q-item send-item" data-order="' + o.id + '" data-stage="' + stage.key + '">' +
        '<div class="row">' +
          '<span class="badge gray">' + (i + 1) + ' / ' + list.length + '</span>' +
          '<b>' + U.esc(o.customerName) + '</b>' +
          '<span class="cap-sub">' + U.esc(U.phone(o.phone) || '연락처 없음') + '</span>' +
          (x.late ? '<span class="badge red">놓침</span>' : '') +
          '<div class="spacer"></div>' +
          '<span class="badge">픽업 ' + U.korDate(o.pickupDate) + ' ' + U.esc(o.pickupTime || '') + '</span></div>' +
        '<div class="q-msg">' + U.esc(msg) + '</div>' +
        '<div class="row">' +
          (U.phoneDigits(o.phone) ? '<button class="btn small" data-sms>📱 문자 보내기</button>'
                                  : '<span class="badge red">연락처가 없어 문자를 보낼 수 없어요</span>') +
          '<button class="btn ghost small" data-copy>📋 카톡용 복사</button>' +
          '<button class="btn mint small" data-mark>✓ 보냄 표시</button>' +
        '</div></div>';
    }).join('') : '<div class="empty">지금 보낼 ' + stage.label + ' 알림이 없어요.</div>';

    return '<div class="card" id="stage-' + stage.key + '"><h2>' + stage.emoji + ' ' + stage.label +
      (list.length ? ' <span class="badge">' + list.length + '</span>' : '') + '</h2>' +
      '<p class="hint">' + stage.desc + '</p>' + body + '</div>';
  }

  function historyCard() {
    var h = history(10);
    if (!h.length) return '';
    return '<details class="card adv"><summary>📮 보낸 기록 ' +
      '<span class="cap-sub">(최근 ' + h.length + '건)</span></summary>' +
      '<div class="table-wrap" style="margin-top:12px"><table>' +
      '<thead><tr><th>보낸 때</th><th>고객</th><th>종류</th><th></th></tr></thead><tbody>' +
      h.map(function (x) {
        return '<tr><td>' + U.korDate(x.at.slice(0, 10)) + ' ' + U.esc(x.at.slice(11, 16)) + '</td>' +
          '<td>' + U.esc(x.order.customerName) + '</td>' +
          '<td>' + x.stage.emoji + ' ' + x.stage.label + '</td>' +
          '<td class="num"><button class="btn ghost small" data-undo="' + x.order.id + '" data-undo-stage="' + x.stage.key + '">되돌리기</button></td></tr>';
      }).join('') + '</tbody></table></div></details>';
  }

  /* ---------- 문자앱 열기 ---------- */
  function smsLink(phone, text) {
    var num = U.phoneDigits(phone);
    var isIOS = /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
    var sep = isIOS ? '&' : '?';
    return 'sms:' + num + sep + 'body=' + encodeURIComponent(text);
  }

  function bind(view) {
    view.addEventListener('click', function (e) {
      var t = e.target;

      if (t.dataset.open) { window.open(t.dataset.open, '_blank', 'noopener'); return; }

      if (t.dataset.undo) {
        markSent(t.dataset.undo, t.dataset.undoStage, false);
        U.toast('안 보낸 상태로 되돌렸어요'); App.render(); return;
      }

      var item = t.closest('.send-item');
      if (item) {
        var id = item.dataset.order, stage = item.dataset.stage;
        var o = DB.find('orders', id);
        if (!o) return;
        var msg = buildMessage(stage, o);
        if (t.hasAttribute('data-sms')) {
          window.location.href = smsLink(o.phone, msg);
          setTimeout(function () { markSent(id, stage, true); next(); }, 1200);
        }
        if (t.hasAttribute('data-copy')) U.copyText(msg);
        if (t.hasAttribute('data-mark')) { markSent(id, stage, true); next(); }
      }
    });

    // 보낸 뒤 남은 건수를 알려주고 다음 대상으로 이동
    function next() {
      var left = totalCount();
      U.toast(left ? '보냄 표시 완료 — ' + left + '건 남았어요' : '오늘 보낼 알림을 모두 끝냈어요 🎉');
      App.render();
      if (left) scrollToFirst();
    }
    function scrollToFirst() {
      setTimeout(function () {
        var first = U.$('.send-item');
        if (!first) return;
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        first.style.outline = '2px solid var(--rose)';
        setTimeout(function () { first.style.outline = ''; }, 1600);
      }, 60);
    }

    var start = U.$('#startSend', view);
    if (start) start.onclick = scrollToFirst;

    U.$('#tplSave', view).onclick = function () {
      var t = {};
      U.$$('[data-tpl]', view).forEach(function (ta) { t[ta.dataset.tpl] = ta.value; });
      DB.saveTemplates(t); U.toast('문구를 저장했어요'); App.render();
    };
    U.$('#tplReset', view).onclick = function () {
      if (!U.confirmBox('기본 문구로 되돌릴까요?')) return;
      DB.write('templates', {}); U.toast('되돌렸어요'); App.render();
    };
    U.$('#resSource', view).onchange = function () {
      DB.saveSettings({ reservationSource: this.value });
      U.toast('예약 받는 방식을 바꿨어요');
    };
  }

  return { render: render, queue: queue, totalCount: totalCount,
           buildMessage: buildMessage, STAGES: STAGES };
})();
