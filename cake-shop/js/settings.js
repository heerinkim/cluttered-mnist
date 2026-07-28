/* 설정 + 백업/복원 */
window.Settings = (function () {

  function render(view) {
    var s = DB.settings();
    var counts = {
      orders: DB.list('orders').length,
      inventory: DB.list('inventory').length,
      ingredients: DB.list('ingredients').length,
      recipes: DB.list('recipes').length,
      photos: DB.list('photos').length
    };

    view.innerHTML = '' +
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
        '<div class="warn">모든 자료는 <b>이 브라우저 안에만</b> 저장됩니다. 인터넷으로 나가지 않아 안전하지만, ' +
        '브라우저 기록을 지우거나 컴퓨터를 바꾸면 사라질 수 있어요. ' +
        '<b>일주일에 한 번은 아래 [백업 파일 내려받기]</b>를 눌러 파일을 보관해 주세요.</div>' +
        '<div class="grid three" style="margin:12px 0">' +
          '<div class="stat"><div class="label">주문</div><div class="value">' + counts.orders + '</div></div>' +
          '<div class="stat"><div class="label">재고 품목</div><div class="value">' + counts.inventory + '</div></div>' +
          '<div class="stat"><div class="label">재료 · 레시피</div><div class="value">' + counts.ingredients + ' · ' + counts.recipes + '</div></div>' +
        '</div>' +
        '<div class="row">' +
          '<button class="btn" id="bkExport">⬇️ 백업 파일 내려받기</button>' +
          '<label class="btn ghost" for="bkFile" style="margin:0">⬆️ 백업 파일 불러오기</label>' +
          '<input type="file" id="bkFile" accept="application/json,.json" style="display:none;width:auto">' +
        '</div>' +
        '<p class="hint" style="margin-top:8px">※ 갤러리 사진은 파일 용량이 커서 백업 파일에 포함되지 않습니다(사진 설명만 저장). ' +
        '중요한 사진은 휴대폰·컴퓨터에도 원본을 보관해 주세요.</p>' +
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
            'GitHub Pages 주소로 열거나 시크릿 모드를 꺼 주세요.') + '</p>' +
      '</div>';

    bind(view);
  }

  function bind(view) {
    U.$('#sSave', view).onclick = function () {
      DB.saveSettings({
        shopName: U.$('#sName', view).value.trim() || '케이크 공방',
        ownerPhone: U.$('#sPhone', view).value.trim(),
        laborPerCake: U.toNum(U.$('#sLabor', view).value),
        defaultMarginPct: U.toNum(U.$('#sMargin', view).value)
      });
      U.toast('저장했어요'); App.render(); App.refreshShopName();
    };

    U.$('#bkExport', view).onclick = function () {
      var data = JSON.stringify(DB.exportAll(), null, 2);
      U.downloadBlob(new Blob([data], { type: 'application/json' }),
        '케이크공방_백업_' + U.today() + '.json');
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
