/* 케이크 디자인 갤러리
   사진은 브라우저 안(IndexedDB)에 저장되고 인터넷으로 올라가지 않습니다. */
window.Gallery = (function () {

  var urlCache = {};   // id -> objectURL (화면을 다시 그릴 때 정리)
  var tagFilter = '전체';

  function render(view) {
    releaseUrls();
    var photos = DB.list('photos').slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    var tags = {};
    photos.forEach(function (p) { (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var tagList = Object.keys(tags).sort();
    var shown = tagFilter === '전체' ? photos : photos.filter(function (p) { return (p.tags || []).indexOf(tagFilter) >= 0; });

    view.innerHTML = '' +
      '<div class="card">' +
        '<div class="row"><h2 style="margin:0">🖼️ 케이크 디자인 갤러리</h2><div class="spacer"></div>' +
          '<label class="btn small" for="photoInput" style="margin:0">+ 사진 올리기</label>' +
          '<input type="file" id="photoInput" accept="image/*" multiple style="display:none;width:auto">' +
        '</div>' +
        '<p class="hint">사진 ' + photos.length + '장 · 여러 장을 한 번에 올릴 수 있어요. ' +
        '사진은 자동으로 가볍게 줄여서 저장합니다.</p>' +
        (tagList.length ? '<div class="row" style="margin-bottom:12px">' +
          ['전체'].concat(tagList).map(function (t) {
            return '<button class="btn ' + (t === tagFilter ? '' : 'ghost') + ' small" data-tag="' + U.esc(t) + '">' +
              U.esc(t) + (t === '전체' ? '' : ' ' + tags[t]) + '</button>';
          }).join('') + '</div>' : '') +
        (shown.length ? '<div class="gal" id="galGrid">' + shown.map(card).join('') + '</div>'
          : '<div class="empty">아직 사진이 없어요.<br>지금까지 만든 케이크 사진을 올려보세요 🎂</div>') +
      '</div>';

    bind(view);
    shown.forEach(loadImage);
  }

  function card(p) {
    return '<figure data-photo="' + p.id + '">' +
      '<img id="img-' + p.id + '" alt="' + U.esc(p.title || '케이크 사진') + '" loading="lazy">' +
      '<figcaption><div class="cap-title">' + U.esc(p.title || '(제목 없음)') + '</div>' +
      '<div class="cap-sub">' + (p.date ? U.korDate(p.date) : '') +
      ((p.tags || []).length ? ' · ' + U.esc(p.tags.join(', ')) : '') + '</div></figcaption></figure>';
  }

  function loadImage(p) {
    DB.photoGet(p.id).then(function (blob) {
      if (!blob) return;
      var el = document.getElementById('img-' + p.id);
      if (!el) return;
      var url = URL.createObjectURL(blob);
      urlCache[p.id] = url;
      el.src = url;
    }).catch(function () { });
  }
  function releaseUrls() {
    Object.keys(urlCache).forEach(function (k) { URL.revokeObjectURL(urlCache[k]); });
    urlCache = {};
  }

  /* ---------- 업로드 (자동 축소) ---------- */
  function handleFiles(files) {
    var arr = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
    if (!arr.length) return;
    U.toast(arr.length + '장 저장 중...');
    var chain = Promise.resolve();
    arr.forEach(function (file) {
      chain = chain.then(function () { return shrink(file); }).then(function (blob) {
        var meta = DB.upsert('photos', {
          title: file.name.replace(/\.[^.]+$/, '').slice(0, 40),
          date: U.today(), tags: [], memo: ''
        });
        return DB.photoPut(meta.id, blob);
      });
    });
    chain.then(function () { U.toast('사진을 저장했어요'); App.render(); })
      .catch(function (e) { U.toast('저장 실패: ' + e.message); });
  }

  // 긴 변 1400px 이하 JPEG 로 변환 (용량 절약)
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1400;
        var w = img.width, h = img.height;
        var scale = Math.min(1, max / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) {
          resolve(blob || file);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요')); };
      img.src = url;
    });
  }

  /* ---------- 자세히 보기 / 수정 ---------- */
  function detail(id) {
    var p = DB.find('photos', id); if (!p) return;
    var html = '<div class="lightbox"><img id="bigImg" alt=""></div>' +
      '<div class="field"><label>제목</label><input id="pTitle" value="' + U.esc(p.title || '') + '"></div>' +
      '<div class="grid two">' +
        '<div class="field"><label>만든 날짜</label><input id="pDate" type="date" value="' + U.esc(p.date || '') + '"></div>' +
        '<div class="field"><label>태그 (쉼표로 구분)</label><input id="pTags" value="' + U.esc((p.tags || []).join(', ')) + '" placeholder="생화, 2단, 웨딩"></div>' +
      '</div>' +
      '<div class="field"><label>메모</label><textarea id="pMemo">' + U.esc(p.memo || '') + '</textarea></div>' +
      '<div class="row end"><button class="btn danger" id="pDel">삭제</button>' +
      '<button class="btn ghost" id="pClose">닫기</button><button class="btn" id="pSave">저장</button></div>';

    U.modal(p.title || '사진', html, function (body) {
      DB.photoGet(id).then(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var img = U.$('#bigImg', body);
        if (img) { img.src = url; img.onload = function () { setTimeout(function () { URL.revokeObjectURL(url); }, 3000); }; }
      });
      U.$('#pClose', body).onclick = U.closeModal;
      U.$('#pSave', body).onclick = function () {
        DB.upsert('photos', {
          id: id,
          title: U.$('#pTitle', body).value.trim(),
          date: U.$('#pDate', body).value,
          tags: U.$('#pTags', body).value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
          memo: U.$('#pMemo', body).value.trim()
        });
        U.closeModal(); U.toast('저장했어요'); App.render();
      };
      U.$('#pDel', body).onclick = function () {
        if (!U.confirmBox('이 사진을 삭제할까요?')) return;
        DB.photoDel(id).finally(function () {
          DB.remove('photos', id); U.closeModal(); U.toast('삭제했어요'); App.render();
        });
      };
    });
  }

  function bind(view) {
    var input = U.$('#photoInput', view);
    input.onchange = function () { handleFiles(input.files); input.value = ''; };
    view.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.tag) { tagFilter = t.dataset.tag; App.render(); return; }
      var fig = t.closest('figure[data-photo]');
      if (fig) detail(fig.dataset.photo);
    });
  }

  return { render: render };
})();
