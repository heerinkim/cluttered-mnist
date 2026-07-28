/* 고객 알림 - 주문 당일 / 픽업 전날 / 픽업 후 3가지 문자 */
window.Notify = (function () {

  var STAGES = [
    { key: 'orderDay',    label: '주문 당일',  emoji: '🧾', desc: '주문을 받은 날 보내는 확인 문자' },
    { key: 'dayBefore',   label: '픽업 전날',  emoji: '⏰', desc: '픽업 하루 전에 보내는 안내 문자' },
    { key: 'afterPickup', label: '픽업 후',    emoji: '💐', desc: '픽업 다음 날 보내는 감사 문자' }
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

  /* ---------- 보낼 대상 찾기 ---------- */
  function queue() {
    var today = U.today();
    var tomorrow = U.addDays(today, 1);
    var yesterday = U.addDays(today, -1);
    var orders = DB.list('orders').filter(function (o) { return o.status !== 'canceled'; });

    function sent(o, k) { return !!(o.notify && o.notify[k] && o.notify[k].sent); }

    return {
      orderDay: orders.filter(function (o) {
        var od = o.orderDate || (o.createdAt || '').slice(0, 10);
        return od && U.diffDays(od, today) <= 1 && !sent(o, 'orderDay');
      }),
      dayBefore: orders.filter(function (o) {
        return o.pickupDate === tomorrow && !sent(o, 'dayBefore');
      }),
      afterPickup: orders.filter(function (o) {
        return (o.pickupDate === yesterday || (o.pickupDate === today && o.status === 'done')) && !sent(o, 'afterPickup');
      })
    };
  }

  function markSent(orderId, stage, value) {
    var o = DB.find('orders', orderId); if (!o) return;
    var n = Object.assign({}, o.notify || {});
    n[stage] = value ? { sent: true, at: new Date().toISOString() } : { sent: false };
    DB.upsert('orders', { id: orderId, notify: n });
  }

  /* ---------- 화면 ---------- */
  function render(view) {
    var q = queue();
    var total = STAGES.reduce(function (a, s) { return a + q[s.key].length; }, 0);
    var set = DB.settings();

    view.innerHTML = '' +
      '<div class="card">' +
        '<h2>💬 오늘 보낼 알림 ' + (total ? '<span class="badge">' + total + '건</span>' : '') + '</h2>' +
        '<p class="hint">고객 연락처로 문자를 보냅니다. [문자 보내기]를 누르면 휴대폰 문자앱이 내용이 채워진 채로 열려요. ' +
        '컴퓨터에서는 [복사]를 눌러 카카오톡 등에 붙여넣으세요.</p>' +
        '<div class="grid three">' +
          STAGES.map(function (s) {
            return '<div class="stat ' + (q[s.key].length ? 'rose' : '') + '">' +
              '<div class="label">' + s.emoji + ' ' + s.label + '</div>' +
              '<div class="value">' + q[s.key].length + '건</div></div>';
          }).join('') +
        '</div>' +
      '</div>' +

      STAGES.map(function (s) { return stageCard(s, q[s.key]); }).join('') +

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
        '<div class="field"><select id="resSource" style="max-width:320px">' +
          '<option value="manual"' + (set.reservationSource === 'manual' ? ' selected' : '') + '>직접 입력 (주문서에 사장님이 입력)</option>' +
          '<option value="naver"' + (set.reservationSource === 'naver' ? ' selected' : '') + '>네이버 예약에서 가져오기 (붙여넣기)</option>' +
        '</select></div>' +
        '<div class="warn">📱 <b>문자 자동 발송에 대해</b> — 지금은 버튼을 누르면 문자앱이 열리는 <b>반자동</b> 방식입니다(무료). ' +
        '사장님이 누르지 않아도 정해진 시간에 <b>자동으로</b> 문자가 나가게 하려면, 문자 발송 서비스(솔라피·알리고 등) 가입과 ' +
        '작은 서버가 필요하고 건당 약 10~30원의 발송 비용이 듭니다. 원하시면 그 단계도 같이 만들 수 있어요. (README 참고)</div>' +
      '</div>';

    bind(view, q);
  }

  function stageCard(stage, list) {
    var body = list.length ? list.map(function (o) {
      var msg = buildMessage(stage.key, o);
      return '<div class="q-item" data-order="' + o.id + '" data-stage="' + stage.key + '">' +
        '<div class="row"><b>' + U.esc(o.customerName) + '</b>' +
          '<span class="cap-sub">' + U.esc(U.phone(o.phone) || '연락처 없음') + '</span>' +
          '<div class="spacer"></div>' +
          '<span class="badge">픽업 ' + U.korDate(o.pickupDate) + ' ' + U.esc(o.pickupTime || '') + '</span></div>' +
        '<div class="q-msg">' + U.esc(msg) + '</div>' +
        '<div class="row">' +
          (U.phoneDigits(o.phone) ? '<button class="btn small" data-sms>📱 문자 보내기</button>' : '<span class="badge red">연락처 없음</span>') +
          '<button class="btn ghost small" data-copy>📋 복사</button>' +
          '<button class="btn mint small" data-mark>✓ 보냄 표시</button>' +
        '</div></div>';
    }).join('') : '<div class="empty">지금 보낼 ' + stage.label + ' 알림이 없어요.</div>';

    return '<div class="card"><h2>' + stage.emoji + ' ' + stage.label +
      (list.length ? ' <span class="badge">' + list.length + '</span>' : '') + '</h2>' +
      '<p class="hint">' + stage.desc + '</p>' + body + '</div>';
  }

  /* ---------- 문자앱 열기 ---------- */
  function smsLink(phone, text) {
    var num = U.phoneDigits(phone);
    var isIOS = /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
    var sep = isIOS ? '&' : '?';
    return 'sms:' + num + sep + 'body=' + encodeURIComponent(text);
  }

  function bind(view, q) {
    view.addEventListener('click', function (e) {
      var item = e.target.closest('.q-item');
      if (item) {
        var id = item.dataset.order, stage = item.dataset.stage;
        var o = DB.find('orders', id);
        if (!o) return;
        var msg = buildMessage(stage, o);
        if (e.target.hasAttribute('data-sms')) {
          window.location.href = smsLink(o.phone, msg);
          setTimeout(function () { markSent(id, stage, true); App.render(); }, 1200);
        }
        if (e.target.hasAttribute('data-copy')) U.copyText(msg);
        if (e.target.hasAttribute('data-mark')) { markSent(id, stage, true); U.toast('보냄으로 표시했어요'); App.render(); }
      }
    });

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

  return { render: render, queue: queue, buildMessage: buildMessage, STAGES: STAGES };
})();
