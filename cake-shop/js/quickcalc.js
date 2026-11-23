/* 가입하지 않아도 바로 써보는 "이거 팔면 얼마 남나" 계산기
   - 소개 화면에 들어갑니다. 로그인도 가입도 필요 없습니다.
   - 적은 내용은 서버로 보내지 않고, 이 브라우저 안에서만 계산합니다. */
window.QuickCalc = (function () {

  var MIN_WAGE = 10320;          // 2026년 최저임금 시급
  var MIN_WAGE_YEAR = '2026';

  function html() {
    return '' +
      '<section class="card qc" id="quickCalc">' +
        '<div class="qc-head">' +
          '<h2>먼저 계산해 보세요</h2>' +
          '<p class="hint">가입하지 않으셔도 됩니다. 숫자 네 개만 넣으면 ' +
          '<b>이 메뉴 하나에 시간당 얼마 버는지</b> 바로 나옵니다.<br>' +
          '<span class="cap-sub">적으신 내용은 서버로 보내지 않습니다. 이 화면에서만 계산합니다.</span></p>' +
        '</div>' +

        '<div class="qc-grid">' +
          '<div class="field"><label>판매가 <span class="qc-unit">원</span></label>' +
            '<input id="qcPrice" type="number" inputmode="numeric" placeholder="88000"></div>' +
          '<div class="field"><label>재료비 <span class="qc-unit">원</span></label>' +
            '<input id="qcMat" type="number" inputmode="numeric" placeholder="34000"></div>' +
          '<div class="field"><label>포장·부자재 <span class="qc-unit">원</span></label>' +
            '<input id="qcPack" type="number" inputmode="numeric" placeholder="3000"></div>' +
          '<div class="field"><label>걸린 시간 <span class="qc-unit">시간</span></label>' +
            '<input id="qcHours" type="number" inputmode="decimal" step="0.5" placeholder="3"></div>' +
        '</div>' +

        '<div id="qcResult" class="qc-result qc-empty">' +
          '<p>숫자를 넣으면 여기에 결과가 나옵니다.</p>' +
        '</div>' +
      '</section>';
  }

  function num(id) {
    var el = document.getElementById(id);
    var v = el ? parseFloat(String(el.value).replace(/[^0-9.]/g, '')) : 0;
    return isNaN(v) ? 0 : v;
  }

  function won(n) {
    return Math.round(n).toLocaleString('ko-KR') + '원';
  }

  function calc() {
    var box = document.getElementById('qcResult');
    if (!box) return;

    var price = num('qcPrice'), mat = num('qcMat'), pack = num('qcPack'), hours = num('qcHours');
    if (price <= 0) {
      box.className = 'qc-result qc-empty';
      box.innerHTML = '<p>숫자를 넣으면 여기에 결과가 나옵니다.</p>';
      return;
    }

    var cost = mat + pack;
    var left = price - cost;
    var margin = price > 0 ? (left / price) * 100 : 0;
    var perHour = hours > 0 ? left / hours : null;

    // 시간당 수익을 최저임금과 견줘 봅니다
    var tone = 'good', verdict = '';
    if (left <= 0) {
      tone = 'bad';
      verdict = '<b>팔수록 손해입니다.</b> 재료비와 포장비가 판매가보다 큽니다.';
    } else if (perHour === null) {
      tone = margin < 40 ? 'warn' : 'good';
      verdict = '걸린 시간도 넣어보세요. <b>시간당 얼마 버는지</b>가 진짜 중요한 숫자입니다.';
    } else if (perHour < MIN_WAGE) {
      tone = 'bad';
      verdict = '시간당 <b>' + won(perHour) + '</b>입니다. ' +
        MIN_WAGE_YEAR + '년 최저임금(시급 ' + won(MIN_WAGE) + ')<b>보다 적습니다.</b><br>' +
        '남 밑에서 일해도 이보다는 받습니다. 가격을 올리거나 만드는 시간을 줄여야 합니다.';
    } else if (perHour < MIN_WAGE * 1.5) {
      tone = 'warn';
      verdict = '시간당 <b>' + won(perHour) + '</b>. 최저임금은 넘겼지만 ' +
        '<b>재료값이 조금만 올라도 금방 무너지는 구간</b>입니다.';
    } else {
      tone = 'good';
      verdict = '시간당 <b>' + won(perHour) + '</b>. ' +
        '최저임금의 <b>' + (perHour / MIN_WAGE).toFixed(1) + '배</b>입니다. 잘 남는 메뉴예요.';
    }

    box.className = 'qc-result qc-' + tone;
    box.innerHTML =
      '<div class="qc-nums">' +
        qcNum('남는 돈', won(left), tone) +
        qcNum('마진율', Math.round(margin) + '%', '') +
        qcNum('시간당', perHour === null ? '—' : won(perHour), tone, true) +
      '</div>' +
      '<p class="qc-verdict">' + verdict + '</p>' +
      (perHour !== null && left > 0
        ? '<p class="qc-hint">하루 8시간 이 메뉴만 만든다면 하루 <b>' + won(perHour * 8) + '</b> 입니다. ' +
          '여기서 임대료·전기요금·배달비는 아직 빼지 않았습니다.</p>'
        : '') +
      '<div class="qc-cta">' +
        '<p><b>이 계산을 주문마다, 매달 자동으로 보고 싶으시면</b></p>' +
        '<button class="btn" data-scroll="1">2개월 무료로 시작하기</button>' +
      '</div>';
  }

  function qcNum(label, value, tone, big) {
    return '<div class="qc-num' + (big ? ' big' : '') + ' ' + (tone || '') + '">' +
      '<div class="qc-label">' + label + '</div>' +
      '<div class="qc-value">' + value + '</div></div>';
  }

  function bind(view) {
    ['qcPrice', 'qcMat', 'qcPack', 'qcHours'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', calc);
    });
  }

  return { html: html, bind: bind, MIN_WAGE: MIN_WAGE };
})();
