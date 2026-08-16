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
    var readOnly = Cloud.isReadOnly();
    var statusHtml = '';
    if (chk) {
      statusHtml = chk.isPrivate
        ? '<div class="info">✅ <b>' + U.esc(chk.name) + '</b> — 비공개 저장소로 확인됐어요. 안심하고 쓰셔도 됩니다.' +
          (readOnly ? '<br>👀 이 토큰은 <b>보기 전용</b>입니다. 자료를 <b>볼 수만</b> 있고 저장은 안 됩니다.' : '') + '</div>'
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
        '<div class="field"><label>토큰 (Personal access token) ' +
            '<button type="button" class="btn ghost small" id="ghEye" style="padding:1px 8px;font-size:11px">👁 보기</button></label>' +
          '<input id="ghToken" type="password" value="' + U.esc(Cloud.token()) + '" placeholder="github_pat_..." ' +
            'autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" data-1p-ignore></div>' +
      '</div>' +
      '<div id="ghTokenInfo">' + tokenInfoHtml() + '</div>' +
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
        (readOnly
          ? '<span class="badge amber">보기 전용이라 저장 버튼은 사용할 수 없어요</span>'
          : '<button class="btn" id="ghUpload">⬆️ 깃허브에 저장</button>') +
        '<button class="btn ghost" id="ghDownload">⬇️ 깃허브에서 불러오기</button>' +
        '<button class="btn ghost" id="ghShare">👥 알바생에게 공유하기</button>' +
      '</div>' +
      '<label class="row" style="margin-top:10px;font-weight:500;cursor:pointer">' +
        '<input type="checkbox" id="ghAuto" style="width:auto"' + (c.autoPull ? ' checked' : '') + '>' +
        '<span>앱을 열 때마다 깃허브에서 <b>최신 자료를 자동으로 불러오기</b>' +
        '<br><span class="cap-sub">알바생 컴퓨터에서 켜두면 항상 최신 주문을 봅니다. ' +
        '사장님 컴퓨터에서는 <b>꺼두세요</b> (입력 중인 자료가 덮어써질 수 있어요)</span></span>' +
      '</label>' +
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

  // 붙여넣은 토큰이 제대로 들어갔는지 눈으로 확인시켜 줍니다
  function tokenInfoHtml(raw) {
    var t = raw === undefined ? Cloud.token() : raw;
    if (!t) return '';
    var info = Cloud.tokenInfo(t);
    if (info.ok) {
      return '<div class="info">✅ 토큰 모양은 정상이에요 — <b>' + U.esc(info.kind) + '</b> · ' +
        info.len + '자 · <code>' + U.esc(Cloud.maskToken(t)) + '</code><br>' +
        '<span class="cap-sub">모양이 맞아도 만료되었거나 권한이 없으면 연결에 실패할 수 있어요.</span></div>';
    }
    return '<div class="warn">⚠️ ' + U.esc(info.msg) +
      (info.len ? '<br>지금 들어 있는 값: <code>' + U.esc(Cloud.maskToken(t)) + '</code>' : '') + '</div>';
  }

  /* ---------- 알바생에게 공유하기 ---------- */
  function shareHelp() {
    var repo = Cloud.cfg().repo || '아이디/cake-shop-data';
    var owner = String(repo).split('/')[0];
    var pagesUrl = 'https://' + owner + '.github.io/cluttered-mnist/cake-shop/';

    function guideText(link) {
      return '[' + (DB.settings().shopName || '케이크 공방') + '] 주문 확인 방법\n\n' +
        '1) 아래 주소를 눌러 주세요\n' + link + '\n\n' +
        '2) 맨 위 [⚙️ 설정] 을 누르고 아래로 내려서 [☁️ 깃허브 백업] 을 찾으세요\n\n' +
        '3) 아래 두 가지를 그대로 넣어주세요\n' +
        '   · 저장소: ' + repo + '\n' +
        '   · 토큰: (여기에 사장님이 알려준 보기 전용 토큰을 붙여넣기)\n\n' +
        '4) [설정 저장] → [⬇️ 깃허브에서 불러오기] 를 누르면 주문이 보입니다\n\n' +
        '5) "앱을 열 때마다 최신 자료 자동으로 불러오기" 를 체크해 두면 편합니다\n\n' +
        '※ 보기 전용이라 자료를 바꾸거나 지울 수 없으니 안심하고 눌러보세요.';
    }

    U.modal('👥 알바생에게 공유하기', '' +
      '<p class="hint">알바생이 <b>주문·달력·재고를 보기만</b> 할 수 있게 해줍니다. ' +
      '자료를 바꾸거나 지울 수는 없습니다.</p>' +

      '<div class="warn">🔑 <b>알바생에게는 반드시 "보기 전용" 토큰을 주세요.</b> ' +
      '사장님이 쓰시는 토큰을 그대로 주면 알바생이 자료를 지울 수도 있습니다.</div>' +

      '<div class="divider"></div>' +
      '<h3>1단계 — 보기 전용 토큰 만들기</h3>' +
      '<ol style="padding-left:20px;line-height:1.9">' +
        '<li>아래 [보기 전용 토큰 만들기] 를 누릅니다</li>' +
        '<li>이름은 <code>알바생용</code>, Expiration 은 원하는 기간으로</li>' +
        '<li>Repository access → <b>Only select repositories</b> → <code>' + U.esc(repo.split('/')[1] || 'cake-shop-data') + '</code> 선택</li>' +
        '<li>Permissions → Repository permissions → <b>Contents</b> 를 ' +
          '<b style="color:var(--rose-dark)">Read-only</b> 로 (Read and write 아님!)</li>' +
        '<li>Generate token → 복사</li>' +
      '</ol>' +
      '<div class="row"><button class="btn ghost small" data-open="https://github.com/settings/personal-access-tokens/new">보기 전용 토큰 만들기</button></div>' +

      '<div class="divider"></div>' +
      '<h3>2단계 — 알바생이 열 주소 정하기</h3>' +
      '<p class="hint">둘 중 편한 방법을 고르세요.</p>' +
      '<div class="field"><label>방법 A · 인터넷 주소로 열기 (링크 공유, 무료)</label>' +
        '<input id="shLink" value="' + U.esc(pagesUrl) + '">' +
        '<p class="hint" style="margin-top:6px">깃허브 저장소 <b>Settings → Pages</b> 에서 브랜치를 고르고 저장하면 만들어지는 주소예요. ' +
        '앱 화면만 열리고 <b>고객 자료는 들어 있지 않습니다</b>(토큰을 넣어야 보입니다).</p></div>' +
      '<div class="info">방법 B · <b>파일 그대로 보내기</b> — ' +
        '<code>케이크공방-운영노트.html</code> 파일을 카톡으로 보내주면, 알바생이 받아서 더블클릭하면 됩니다. ' +
        '주소를 만들 필요가 없어 더 간단해요.</div>' +

      '<div class="divider"></div>' +
      '<h3>3단계 — 알바생에게 보낼 안내문</h3>' +
      '<div class="q-msg" id="shText">' + U.esc(guideText(pagesUrl)) + '</div>' +
      '<div class="row">' +
        '<button class="btn" id="shCopy">📋 안내문 복사</button>' +
        '<button class="btn ghost" id="shClose">닫기</button>' +
      '</div>' +
      '<p class="hint" style="margin-top:8px">※ 토큰은 안내문에 넣지 않았습니다. ' +
      '카톡으로 <b>따로</b> 보내주세요.</p>',
      function (body) {
        body.addEventListener('click', function (e) {
          if (e.target.dataset.open) window.open(e.target.dataset.open, '_blank', 'noopener');
        });
        U.$('#shLink', body).addEventListener('input', function () {
          U.$('#shText', body).textContent = guideText(this.value.trim());
        });
        U.$('#shCopy', body).onclick = function () { U.copyText(U.$('#shText', body).textContent); };
        U.$('#shClose', body).onclick = U.closeModal;
      });
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

    // 토큰을 눈으로 확인 (붙여넣기가 제대로 됐는지 보려고)
    var eye = U.$('#ghEye', view), tokenBox = U.$('#ghToken', view);
    eye.onclick = function () {
      var showing = tokenBox.type === 'text';
      tokenBox.type = showing ? 'password' : 'text';
      eye.textContent = showing ? '👁 보기' : '🙈 가리기';
    };
    // 붙여넣는 즉시 모양을 확인해 줍니다
    tokenBox.addEventListener('input', function () {
      U.$('#ghTokenInfo', view).innerHTML = tokenInfoHtml(tokenBox.value);
    });
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

    U.$('#ghShare', view).onclick = shareHelp;
    U.$('#ghAuto', view).onchange = function () {
      Cloud.saveCfg({ autoPull: this.checked });
      U.toast(this.checked ? '앱을 열 때 자동으로 불러옵니다' : '자동 불러오기를 껐어요');
    };

    var upBtn = U.$('#ghUpload', view);
    if (upBtn) upBtn.onclick = function () {
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
      var info = Cloud.tokenInfo(Cloud.token());
      return '<div class="warn">' +
        '<b>깃허브가 이 토큰을 받아주지 않았어요.</b><br>' +
        '지금 들어 있는 값: <code>' + U.esc(Cloud.maskToken(Cloud.token())) + '</code> (' + info.len + '자)<br><br>' +
        (info.ok
          ? '모양은 맞으니 <b>토큰이 만료됐거나 삭제된 것</b>일 가능성이 큽니다.<br>'
          : '<b>' + U.esc(info.msg) + '</b><br>') +
        '<b>이 순서로 확인해 보세요</b><br>' +
        '① 토큰 목록에서 만든 토큰이 <b>Expired(만료)</b> 로 표시돼 있지 않은지<br>' +
        '② 만들 때 <b>Generate token</b> 을 눌러 나온 화면의 <b>복사 아이콘</b>으로 복사했는지 ' +
        '(화면의 글자를 마우스로 긁으면 일부만 복사될 수 있어요)<br>' +
        '③ 위 토큰 칸의 <b>[👁 보기]</b> 를 눌러 <code>github_pat_</code> 로 시작하고 뒤가 잘리지 않았는지<br><br>' +
        '👉 <b>가장 빠른 해결은 토큰을 새로 하나 만드는 것입니다.</b> 몇 개를 만들어도 괜찮아요.' +
        '</div>' +
        '<div class="row" style="margin-top:10px">' +
          '<button class="btn ghost small" data-open="https://github.com/settings/personal-access-tokens">내 토큰 목록 (만료 확인)</button>' +
          '<button class="btn small" data-open="https://github.com/settings/personal-access-tokens/new">토큰 새로 만들기</button>' +
        '</div>';
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
