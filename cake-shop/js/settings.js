/* 설정 + 백업/복원 */
window.Settings = (function () {

  function render(view) {
    var s = DB.settings();
    var counts = {
      orders: DB.list('orders').length,
      menus: DB.list('menus').length,
      inventory: DB.list('inventory').length,
      photos: DB.list('photos').length
    };

    view.innerHTML = '' +
      accountCard() +
      '<div class="card">' +
        '<h2>⚙️ 가게 정보</h2>' +
        '<div class="grid two">' +
          '<div class="field"><label>가게 이름</label><input id="sName" value="' + U.esc(s.shopName) + '"></div>' +
          '<div class="field"><label>사장님 연락처</label><input id="sPhone" value="' + U.esc(s.ownerPhone) + '" placeholder="010-0000-0000"></div>' +
          '<div class="field"><label>기본 인건비 (케이크 1개당, 원)</label><input id="sLabor" type="number" value="' + U.esc(s.laborPerCake) + '"></div>' +
          '<div class="field"><label>목표 마진율 (%)</label><input id="sMargin" type="number" min="0" max="95" value="' + U.esc(s.defaultMarginPct) + '"></div>' +
        '</div>' +
        '<p class="hint">마진율 ' + s.defaultMarginPct + '% = 판매가의 ' + (100 - s.defaultMarginPct) + '%가 원가라는 뜻이에요. ' +
        '원가 30,000원이면 추천 판매가는 약 ' + U.won(Math.ceil((30000 / (1 - Math.min(0.95, s.defaultMarginPct / 100))) / 1000) * 1000) + '.</p>' +
        '<div class="row end"><button class="btn" id="sSave">저장</button></div>' +
      '</div>' +

      '<div class="card">' +
        '<h2>💾 백업 (아주 중요!)</h2>' +
        '<div class="info">입력하신 자료는 <b>이 컴퓨터에 먼저 저장되고, 곧바로 서버에도 저장됩니다.</b> ' +
        '그래서 컴퓨터를 바꾸거나 휴대폰으로 로그인해도 그대로 보입니다. 갤러리 사진도 함께 저장됩니다.<br>' +
        '아래 [백업 파일 내려받기]는 <b>엑셀처럼 따로 보관하고 싶을 때</b> 쓰시면 됩니다.</div>' +
        '<div class="grid three" style="margin:12px 0">' +
          '<div class="stat"><div class="label">주문</div><div class="value">' + counts.orders + '</div></div>' +
          '<div class="stat"><div class="label">재고 품목</div><div class="value">' + counts.inventory + '</div></div>' +
          '<div class="stat"><div class="label">원가표 메뉴</div><div class="value">' + counts.menus + '</div></div>' +
        '</div>' +
        '<div class="row">' +
          '<button class="btn" id="bkExport">⬇️ 백업 파일 내려받기</button>' +
          '<label class="btn ghost" for="bkFile" style="margin:0">⬆️ 백업 파일 불러오기</label>' +
          '<input type="file" id="bkFile" accept="application/json,.json" style="display:none;width:auto">' +
        '</div>' +
        '<p class="hint" style="margin-top:8px">※ 백업 파일에는 <b>갤러리 사진 파일은 들어가지 않습니다</b>(사진 설명만 저장). ' +
        '사진은 서버에 따로 보관되고 있어서, 다시 로그인하면 그대로 보입니다.</p>' +
      '</div>' +

      '<div class="card">' +
        '<h2>🧪 예시 데이터 / 초기화</h2>' +
        '<div class="row">' +
          '<button class="btn ghost" id="seedBtn">예시 데이터 넣기</button>' +
          '<button class="btn danger" id="resetBtn">전체 초기화</button>' +
        '</div>' +
        '<p class="hint" style="margin-top:8px">전체 초기화는 되돌릴 수 없어요. 먼저 백업 파일을 받아두세요.</p>' +
      '</div>' +

      '<div class="card">' +
        '<h2>ℹ️ 저장 상태</h2>' +
        '<p class="hint">브라우저 저장소: ' + (DB.storageOk
          ? '<span class="badge mint">정상</span>'
          : '<span class="badge red">사용 불가</span> — 주소창에 <code>file://</code> 로 열었거나 시크릿 모드일 수 있어요. ' +
            'solopreneur111.co.kr 주소로 열거나 시크릿 모드를 꺼 주세요.') + '</p>' +
      '</div>';

    bind(view);
  }

  /* ---------- 내 계정 ---------- */
  function accountCard() {
    if (!SB.loggedIn()) return '';
    var a = Auth.info() || {};
    var email = (SB.user() && SB.user().email) || '';
    var stateBadge = !a.active
      ? '<span class="badge red">이용 종료</span>'
      : Auth.onTrial()
        ? '<span class="badge amber">무료 체험 ' + Auth.daysLeft() + '일 남음</span>'
        : '<span class="badge mint">구독 중</span>';

    return '' +
    '<div class="card">' +
      '<div class="row"><h2 style="margin:0">👤 내 계정</h2><div class="spacer"></div>' + stateBadge + '</div>' +
      '<p class="hint">' + U.esc(email) + ' · ' + U.esc(a.shop_name || '') + '</p>' +
      '<div class="info" id="syncInfo">☁️ ' + U.esc(Sync.lastText()) + '</div>' +
      '<p class="hint" style="margin-top:8px">입력하신 자료는 이 컴퓨터에 먼저 저장되고, 곧바로 서버에도 올라갑니다. ' +
      '다른 기기에서 같은 계정으로 로그인하면 그대로 보여요.</p>' +
      '<div class="row">' +
        '<button class="btn ghost" id="acctSync">☁️ 지금 서버와 맞추기</button>' +
        '<button class="btn ghost" id="acctSub">💳 구독 / 이용 기간</button>' +
        '<button class="btn ghost" id="acctPw">🔑 비밀번호 바꾸기</button>' +
        '<div class="spacer"></div>' +
        '<button class="btn ghost" id="acctOut">로그아웃</button>' +
      '</div>' +
    '</div>';
  }

  function bindAccount(view) {
    if (!SB.loggedIn()) return;
    var sync = U.$('#acctSync', view);
    if (sync) sync.onclick = function () {
      U.toast('서버와 맞추는 중...');
      Sync.run().then(function (st) {
        U.toast(st.error ? ('실패 — ' + String(st.error).split('\n')[0]) : '서버와 맞췄어요');
      });
    };
    var sub = U.$('#acctSub', view);
    if (sub) sub.onclick = function () { location.hash = '#subscribe'; };
    var out = U.$('#acctOut', view);
    if (out) out.onclick = Auth.signOut;
    var pw = U.$('#acctPw', view);
    if (pw) pw.onclick = function () {
      U.modal('비밀번호 바꾸기',
        '<div class="field"><label>새 비밀번호 (6자 이상)</label><input id="pw1" type="password"></div>' +
        '<div class="field"><label>한 번 더</label><input id="pw2" type="password"></div>' +
        '<div id="pwMsg"></div>' +
        '<div class="row end"><button class="btn ghost" id="pwCancel">취소</button>' +
        '<button class="btn" id="pwSave">바꾸기</button></div>',
        function (body) {
          U.$('#pwCancel', body).onclick = U.closeModal;
          U.$('#pwSave', body).onclick = function () {
            var a = U.$('#pw1', body).value, b = U.$('#pw2', body).value;
            if (a.length < 6) { U.$('#pwMsg', body).innerHTML = '<div class="warn">6자 이상으로 정해주세요.</div>'; return; }
            if (a !== b) { U.$('#pwMsg', body).innerHTML = '<div class="warn">두 비밀번호가 달라요.</div>'; return; }
            SB.changePassword(a).then(function () { U.closeModal(); U.toast('비밀번호를 바꿨어요'); })
              .catch(function (e) { U.$('#pwMsg', body).innerHTML = '<div class="warn">' + U.esc(e.message) + '</div>'; });
          };
        });
    };
  }

  function bind(view) {
    bindAccount(view);
    view.addEventListener('click', function (e) {
      if (e.target.dataset.open) window.open(e.target.dataset.open, '_blank', 'noopener');
    });
    U.$('#sSave', view).onclick = function () {
      DB.saveSettings({
        shopName: U.$('#sName', view).value.trim() || '내 가게',
        ownerPhone: U.$('#sPhone', view).value.trim(),
        laborPerCake: U.toNum(U.$('#sLabor', view).value),
        defaultMarginPct: U.toNum(U.$('#sMargin', view).value)
      });
      U.toast('저장했어요'); App.render(); App.refreshShopName();
    };

    U.$('#bkExport', view).onclick = function () {
      var data = JSON.stringify(DB.exportAll(), null, 2);
      U.downloadBlob(new Blob([data], { type: 'application/json' }),
        '운영노트_백업_' + U.today() + '.json');
      U.toast('백업 파일을 내려받았어요');
    };

    var file = U.$('#bkFile', view);
    file.onchange = function () {
      var f = file.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!U.confirmBox('지금 자료를 백업 파일 내용으로 바꿉니다. 계속할까요?')) return;
          DB.importAll(data);
          U.toast('불러왔어요'); App.render(); App.refreshShopName();
        } catch (e) { U.toast('불러오기 실패: ' + e.message); }
      };
      reader.readAsText(f);
      file.value = '';
    };

    U.$('#seedBtn', view).onclick = function () {
      if (!U.confirmBox('예시 데이터를 추가할까요? (기존 자료는 지워지지 않아요)')) return;
      Seed.install(); U.toast('예시 데이터를 넣었어요'); App.render();
    };

    U.$('#resetBtn', view).onclick = function () {
      if (!U.confirmBox('정말 모든 자료를 지울까요? 되돌릴 수 없습니다.')) return;
      if (!U.confirmBox('마지막 확인입니다. 백업 파일은 받으셨나요?')) return;
      DB.clearAll(); DB.write('seeded', true);
      U.toast('초기화했어요'); App.render(); App.refreshShopName();
    };
  }

  return { render: render };
})();
