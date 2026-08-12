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
          '<div class="stat"><div class="label">원가표 메뉴</div><div class="value">' + counts.menus + '</div></div>' +
        '</div>' +
        '<div class="row">' +
          '<button class="btn" id="bkExport">⬇️ 백업 파일 내려받기</button>' +
          '<label class="btn ghost" for="bkFile" style="margin:0">⬆️ 백업 파일 불러오기</label>' +
          '<input type="file" id="bkFile" accept="application/json,.json" style="display:none;width:auto">' +
        '</div>' +
        '<p class="hint" style="margin-top:8px">※ 이 백업 파일에는 <b>갤러리 사진이 들어가지 않습니다</b>(사진 설명만 저장). ' +
        '사진까지 통째로 보관하려면 아래 <b>[☁️ 깃허브 백업]</b>을 쓰세요.</p>' +
      '</div>' +

      cloudCard() +

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

  /* ---------- 깃허브 백업 ---------- */
  function cloudCard() {
    var c = Cloud.cfg();
    var chk = c.lastCheck;
    var statusHtml = '';
    if (chk) {
      statusHtml = chk.isPrivate
        ? '<div class="info">✅ <b>' + U.esc(chk.name) + '</b> — 비공개 저장소로 확인됐어요. 안심하고 쓰셔도 됩니다.</div>'
        : '<div class="warn">🚨 <b>' + U.esc(chk.name) + '</b> 는 <b>공개(Public)</b> 저장소입니다. ' +
          '고객 이름·전화번호가 전 세계에 공개되므로 <b>저장이 막혀 있습니다.</b> ' +
          '깃허브에서 <b>비공개(Private)</b> 저장소를 새로 만들어 주세요.</div>';
    }

    return '' +
    '<div class="card">' +
      '<h2>☁️ 깃허브 백업</h2>' +
      '<p class="hint">자료를 사장님의 <b>비공개</b> 깃허브 저장소에 올려둡니다. ' +
      '컴퓨터가 고장 나거나 바뀌어도 [깃허브에서 불러오기] 한 번이면 그대로 돌아옵니다. 무료입니다.</p>' +
      '<div class="warn">🔒 <b>반드시 비공개(Private) 저장소를 쓰세요.</b> 고객 이름과 전화번호가 들어 있어서, ' +
      '공개 저장소에 올리면 누구나 볼 수 있고 나중에 지워도 기록에 남습니다. ' +
      '이 프로그램은 공개 저장소로는 저장되지 않도록 막아 두었습니다.</div>' +

      '<div class="grid two" style="margin-top:12px">' +
        '<div class="field"><label>저장소 (아이디/저장소이름)</label>' +
          '<input id="ghRepo" value="' + U.esc(c.repo || '') + '" placeholder="heerinkim/cake-shop-data" autocomplete="off"></div>' +
        '<div class="field"><label>토큰 (Personal access token)</label>' +
          '<input id="ghToken" type="password" value="' + U.esc(Cloud.token()) + '" placeholder="github_pat_..." autocomplete="off"></div>' +
      '</div>' +
      '<p class="hint">토큰은 <b>이 컴퓨터에만</b> 저장되고 백업 파일에는 들어가지 않습니다. ' +
      '만드는 방법은 아래 [발급 방법 보기]를 눌러주세요.</p>' +

      '<div class="row">' +
        '<button class="btn ghost" id="ghSave">설정 저장</button>' +
        '<button class="btn ghost" id="ghCheck">🔍 연결 테스트</button>' +
        '<button class="btn ghost" id="ghDiag">🩺 자세히 진단하기</button>' +
        '<button class="btn ghost small" id="ghHelp">발급 방법 보기</button>' +
      '</div>' +
      '<div id="ghStatus" style="margin-top:12px">' + statusHtml + '</div>' +

      '<div class="divider"></div>' +
      '<div class="row">' +
        '<button class="btn" id="ghUpload">⬆️ 깃허브에 저장</button>' +
        '<button class="btn ghost" id="ghDownload">⬇️ 깃허브에서 불러오기</button>' +
      '</div>' +
      '<p class="hint" style="margin-top:8px">마지막으로 깃허브에 저장한 때: <b>' + U.esc(Cloud.lastSyncText()) + '</b></p>' +
      '<div id="ghProgress"></div>' +

      '<details class="adv" style="margin-top:14px">' +
        '<summary>🖐️ 손으로 백업하기 (버튼이 안 될 때 · 100% 확실)</summary>' +
        '<p class="hint" style="margin-top:12px">위 버튼이 "연결하지 못했어요"라고 나오면 이 방법을 쓰세요. ' +
        '조금 번거롭지만 어떤 환경에서든 반드시 됩니다.</p>' +
        '<ol style="padding-left:20px;line-height:2">' +
          '<li>위쪽 <b>[⬇️ 백업 파일 내려받기]</b> 를 눌러 파일을 받습니다</li>' +
          '<li>깃허브의 <b>비공개 저장소</b>를 웹브라우저로 엽니다</li>' +
          '<li><b>Add file → Upload files</b> 를 누르고 받은 파일을 <b>끌어다 놓습니다</b></li>' +
          '<li>아래 <b>Commit changes</b> 를 누르면 끝입니다</li>' +
        '</ol>' +
        '<p class="hint">되돌릴 때는 깃허브에서 그 파일을 내려받아 <b>[⬆️ 백업 파일 불러오기]</b> 로 넣으면 됩니다.</p>' +
        '<div class="row"><button class="btn ghost small" id="ghOpenRepo">내 저장소 열기</button></div>' +
      '</details>' +
    '</div>';
  }

  function tokenHelp() {
    U.modal('토큰 발급 방법', '' +
      '<p class="hint">토큰은 이 프로그램이 사장님 대신 깃허브에 자료를 올릴 수 있게 해주는 <b>열쇠</b>입니다. ' +
      '비밀번호처럼 남에게 알려주지 마세요.</p>' +
      '<ol style="padding-left:20px;line-height:2">' +
        '<li>깃허브에서 <b>비공개(Private) 저장소</b>를 먼저 만듭니다<br>' +
          '<span class="cap-sub">github.com → 우측 상단 ➕ → New repository → 이름 <code>cake-shop-data</code> → <b>Private 선택</b> → Create</span></li>' +
        '<li><b>Settings → Developer settings → Personal access tokens → Fine-grained tokens</b> 로 갑니다<br>' +
          '<span class="cap-sub">주소를 바로 열려면 아래 버튼을 누르세요</span></li>' +
        '<li><b>Generate new token</b> 을 누릅니다</li>' +
        '<li>이름은 아무거나 (예: 케이크공방), <b>Expiration</b> 은 <b>No expiration</b> 또는 1년으로</li>' +
        '<li><b>Repository access</b> → <b>Only select repositories</b> → 방금 만든 <code>cake-shop-data</code> 선택</li>' +
        '<li><b>Permissions → Repository permissions → Contents</b> 를 <b>Read and write</b> 로 변경</li>' +
        '<li><b>Generate token</b> → 나온 글자를 <b>복사</b>해서 이 화면의 토큰 칸에 붙여넣기</li>' +
      '</ol>' +
      '<div class="warn">토큰은 만들 때 <b>딱 한 번만</b> 보입니다. 창을 닫기 전에 꼭 복사하세요. ' +
      '놓쳤으면 그냥 새로 만들면 됩니다.</div>' +
      '<div class="row" style="margin-top:12px">' +
        '<button class="btn ghost small" data-open="https://github.com/new">저장소 만들기 열기</button>' +
        '<button class="btn ghost small" data-open="https://github.com/settings/personal-access-tokens/new">토큰 만들기 열기</button>' +
        '<button class="btn" id="hClose">닫기</button>' +
      '</div>',
      function (body) {
        body.addEventListener('click', function (e) {
          if (e.target.dataset.open) window.open(e.target.dataset.open, '_blank', 'noopener');
        });
        U.$('#hClose', body).onclick = U.closeModal;
      });
  }

  function bindCloud(view) {
    var progress = U.$('#ghProgress', view);
    function step(msg) {
      progress.innerHTML = '<div class="info">⏳ ' + U.esc(msg) + '</div>';
    }
    function done(msg) { progress.innerHTML = '<div class="info">✅ ' + U.esc(msg) + '</div>'; }
    function oops(e) {
      progress.innerHTML = '<div class="warn" style="white-space:pre-wrap">❌ ' + U.esc(e.message) + '</div>';
    }
    function busy(on) {
      ['#ghUpload', '#ghDownload', '#ghCheck'].forEach(function (s) {
        var b = U.$(s, view); if (b) b.disabled = on;
      });
    }
    function saveFields() {
      Cloud.saveCfg({ repo: U.$('#ghRepo', view).value.trim() });
      Cloud.saveToken(U.$('#ghToken', view).value);
    }

    U.$('#ghSave', view).onclick = function () {
      saveFields(); U.toast('저장했어요'); App.render();
    };
    U.$('#ghHelp', view).onclick = tokenHelp;
    U.$('#ghOpenRepo', view).onclick = function () {
      var repo = U.$('#ghRepo', view).value.trim();
      if (!repo) { U.toast('저장소 이름을 먼저 넣어주세요'); return; }
      window.open('https://github.com/' + repo + '/upload/main/data', '_blank', 'noopener');
    };

    U.$('#ghCheck', view).onclick = function () {
      saveFields(); busy(true); step('깃허브에 연결하는 중...');
      Cloud.check().then(function (info) {
        busy(false);
        if (!info.isPrivate) {
          progress.innerHTML = '<div class="warn">🚨 <b>' + U.esc(info.name) + '</b> 는 공개(Public) 저장소예요. ' +
            '고객 정보가 공개되므로 저장할 수 없습니다. 비공개 저장소를 새로 만들어 주세요.</div>';
        } else if (!info.canPush) {
          progress.innerHTML = '<div class="warn">토큰에 저장 권한이 없어요. Contents를 "Read and write"로 바꿔주세요.</div>';
        } else {
          done('연결 성공! ' + info.name + ' (비공개) 에 저장할 수 있어요.');
        }
        App.render();
      }).catch(function (e) { busy(false); oops(e); });
    };

    U.$('#ghDiag', view).onclick = function () {
      saveFields(); busy(true); step('토큰과 저장소를 확인하는 중...');
      Cloud.diagnose().then(function (d) {
        busy(false);
        progress.innerHTML = diagnosisHtml(d);
        // "이 저장소로 설정" 버튼 연결
        U.$$('[data-pick]', progress).forEach(function (btn) {
          btn.onclick = function () {
            U.$('#ghRepo', view).value = btn.dataset.pick;
            Cloud.saveCfg({ repo: btn.dataset.pick });
            U.toast('저장소를 ' + btn.dataset.pick + ' 로 바꿨어요');
            App.render();
          };
        });
      }).catch(function (e) { busy(false); oops(e); });
    };

    U.$('#ghUpload', view).onclick = function () {
      saveFields(); busy(true); step('시작하는 중...');
      Cloud.upload(step).then(function (r) {
        busy(false);
        done('깃허브에 저장했어요. 주문 ' + r.orders + '건' + (r.photos ? ' · 새 사진 ' + r.photos + '장' : '') + ' 백업 완료.');
        U.toast('깃허브 저장 완료 ☁️');
        App.render();
      }).catch(function (e) { busy(false); oops(e); });
    };

    U.$('#ghDownload', view).onclick = function () {
      if (!U.confirmBox('깃허브에 저장된 내용으로 이 컴퓨터의 자료를 바꿉니다.\n지금 이 컴퓨터에만 있는 최근 주문은 사라질 수 있어요.\n계속할까요?')) return;
      saveFields(); busy(true); step('시작하는 중...');
      Cloud.download(step).then(function (r) {
        busy(false);
        done('불러왔어요. 주문 ' + r.orders + '건' + (r.photos ? ' · 사진 ' + r.photos + '장' : '') + '.');
        U.toast('불러오기 완료');
        App.render(); App.refreshShopName();
      }).catch(function (e) { busy(false); oops(e); });
    };
  }

  // 진단 결과를 사장님이 바로 알아볼 수 있는 말로 풀어줍니다
  function diagnosisHtml(d) {
    if (d.reason === 'no-token') return '<div class="warn">토큰을 먼저 넣고 [설정 저장]을 눌러주세요.</div>';
    if (d.reason === 'network') return '<div class="warn" style="white-space:pre-wrap">' + U.esc(d.message || '깃허브에 연결하지 못했어요.') + '</div>';
    if (d.reason === 'bad-token') {
      return '<div class="warn"><b>토큰이 잘못되었거나 만료됐어요.</b><br>' +
        '토큰을 만들 때 나온 <code>github_pat_...</code> 글자를 <b>처음부터 끝까지</b> 복사했는지 확인해 주세요. ' +
        '앞뒤에 빈칸이 붙어도 안 됩니다. 잘 모르겠으면 <b>토큰을 새로 만드는 게 가장 빠릅니다.</b></div>';
    }

    var head = '<div class="info">✅ 토큰은 정상입니다. 깃허브 아이디: <b>' + U.esc(d.login) + '</b></div>';

    if (d.reason === 'no-repos') {
      return head + '<div class="warn" style="margin-top:10px">' +
        '<b>그런데 이 토큰이 볼 수 있는 저장소가 하나도 없어요.</b><br>' +
        '토큰을 만들 때 <b>Repository access</b> 에서 저장소를 선택하지 않으신 것 같습니다.<br><br>' +
        '👉 <b>토큰 설정 화면에서</b> Repository access → <b>Only select repositories</b> → ' +
        '<b>cake-shop-data 를 실제로 선택</b>한 뒤 저장하세요.<br>' +
        '👉 그리고 <b>Permissions → Contents</b> 를 <b>Read and write</b> 로 바꿔주세요. ' +
        '(이게 빠져 있으면 저장소가 아예 안 보입니다)' +
        '</div>' + repoLinks(d);
    }

    var list = '<div style="margin-top:10px"><b>이 토큰이 볼 수 있는 저장소</b>' +
      '<div class="table-wrap" style="margin-top:6px"><table><tbody>' +
      d.repos.slice(0, 20).map(function (r) {
        return '<tr><td>' + U.esc(r.full_name) + '</td>' +
          '<td>' + (r.isPrivate ? '<span class="badge mint">비공개</span>' : '<span class="badge red">공개</span>') + '</td>' +
          '<td class="num"><button class="btn ghost small" data-pick="' + U.esc(r.full_name) + '">이 저장소로 설정</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    if (d.reason === 'ok') {
      return head + '<div class="info" style="margin-top:10px">✅ <b>' + U.esc(d.target) +
        '</b> 도 잘 보입니다. [연결 테스트]를 다시 눌러보세요.</div>' + list;
    }

    // 토큰은 되는데 입력한 저장소만 안 보이는 경우 (가장 흔함)
    return head +
      '<div class="warn" style="margin-top:10px">' +
      '<b>토큰은 정상인데, 입력하신 <code>' + U.esc(d.target) + '</code> 만 보이지 않습니다.</b><br>' +
      (d.ownerMismatch
        ? '⚠️ 저장소 주인이 <b>' + U.esc(String(d.target).split('/')[0]) + '</b> 로 되어 있는데, ' +
          '토큰 주인은 <b>' + U.esc(d.login) + '</b> 입니다. 아이디 부분을 <b>' + U.esc(d.login) + '</b> 로 바꿔보세요.<br>'
        : '') +
      '아래 목록에 <b>cake-shop-data 가 있으면 [이 저장소로 설정]을 누르시면 끝</b>입니다.<br>' +
      '목록에 없다면 둘 중 하나입니다:<br>' +
      '① 토큰의 <b>Repository access</b> 에서 그 저장소를 선택하지 않았음<br>' +
      '② 토큰의 <b>Permissions → Contents</b> 가 <b>Read and write</b> 가 아님' +
      '</div>' + list + repoLinks(d);
  }

  function repoLinks(d) {
    return '<div class="row" style="margin-top:10px">' +
      '<button class="btn ghost small" data-open="https://github.com/settings/personal-access-tokens">내 토큰 설정 열기</button>' +
      '<button class="btn ghost small" data-open="https://github.com/' + U.esc(d.login || '') + '?tab=repositories">내 저장소 목록 열기</button>' +
      '</div>';
  }

  function bind(view) {
    bindCloud(view);
    view.addEventListener('click', function (e) {
      if (e.target.dataset.open) window.open(e.target.dataset.open, '_blank', 'noopener');
    });
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
