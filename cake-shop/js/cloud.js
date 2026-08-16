/* 깃허브 백업
   주문·재고·원가표·사진을 사장님의 "비공개" 깃허브 저장소에 올리고 내려받습니다.
   - 토큰은 이 컴퓨터에만 저장되며, 백업 파일(JSON)에는 절대 포함되지 않습니다.
   - 공개 저장소에는 올리지 못하도록 막아 두었습니다 (고객 개인정보 보호). */
window.Cloud = (function () {

  var API = 'https://api.github.com';
  var DATA_PATH = 'data/backup.json';
  var PHOTO_DIR = 'photos/';

  /* ---------- 설정 ---------- */
  function cfg() {
    return Object.assign({ repo: '', lastSyncAt: '', lastCheck: null, autoPull: false }, DB.read('github', {}));
  }
  // 보기 전용(읽기만 되는) 토큰으로 연결되어 있는지
  function isReadOnly() {
    var c = cfg().lastCheck;
    return !!(c && c.canPush === false);
  }
  function saveCfg(c) { return DB.write('github', Object.assign(cfg(), c)); }
  // 토큰은 별도 키에 저장 -> 백업 파일(exportAll)에 섞여 나가지 않음
  function token() { return DB.read('githubToken', ''); }
  function saveToken(t) { DB.write('githubToken', cleanToken(t)); }

  /* ---------- 토큰 다듬기 / 확인 ----------
     붙여넣을 때 따라오는 빈칸·줄바꿈·따옴표·보이지 않는 문자를 걷어냅니다. */
  function cleanToken(raw) {
    return String(raw || '')
      .replace(/^\s*bearer\s+/i, '')          // "Bearer " 를 같이 복사한 경우
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')   // 눈에 안 보이는 문자 (제로폭 문자, 줄바꿈 없는 공백)
      .replace(/["'`]/g, '')                  // 따옴표
      .replace(/\s+/g, '');                   // 모든 빈칸·줄바꿈 (토큰에는 빈칸이 없음)
  }

  // 토큰이 "모양이라도 맞는지" 미리 확인 (깃허브에 물어보기 전에)
  function tokenInfo(raw) {
    var t = cleanToken(raw);
    if (!t) return { ok: false, kind: 'none', len: 0, msg: '토큰이 비어 있어요.' };
    if (/^github_pat_[A-Za-z0-9_]{20,}$/.test(t)) return { ok: true, kind: '세밀한 토큰 (fine-grained)', len: t.length };
    if (/^ghp_[A-Za-z0-9]{30,}$/.test(t)) return { ok: true, kind: '옛날 방식 토큰 (classic)', len: t.length };
    if (/^[0-9a-f]{40}$/i.test(t)) return { ok: true, kind: '옛날 방식 토큰 (classic)', len: t.length };
    if (/^github_pat_/.test(t)) {
      return { ok: false, kind: 'short', len: t.length,
               msg: '토큰이 중간에 잘린 것 같아요. github_pat_ 로 시작하는 건 맞지만 길이가 너무 짧습니다 (' + t.length + '자). 보통 90자가 넘습니다.' };
    }
    return { ok: false, kind: 'unknown', len: t.length,
             msg: '토큰 모양이 아니에요 (' + t.length + '자). 토큰은 보통 github_pat_ 으로 시작합니다. ' +
                  '저장소 주소나 토큰 이름을 잘못 붙여넣지 않았는지 확인해 주세요.' };
  }

  // 화면에 보여줄 때 가운데를 가림
  function maskToken(raw) {
    var t = cleanToken(raw);
    if (!t) return '(비어 있음)';
    if (t.length <= 18) return t.slice(0, 4) + '…' + t.slice(-2);
    return t.slice(0, 14) + '…' + t.slice(-4);
  }
  function configured() { return !!(cfg().repo && token()); }

  /* ---------- 글자 <-> base64 (한글 안전) ---------- */
  function toB64(str) {
    var bytes = new TextEncoder().encode(str);
    return bytesToB64(bytes);
  }
  function bytesToB64(bytes) {
    var bin = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function b64ToBytes(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function fromB64(b64) { return new TextDecoder().decode(b64ToBytes(b64)); }
  function blobToB64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('사진을 읽지 못했어요')); };
      r.readAsDataURL(blob);
    });
  }

  /* ---------- 통신 ---------- */
  function fail(msg, status) { var e = new Error(msg); e.status = status; return e; }

  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, opts.headers || {});
    if (token()) headers.Authorization = 'Bearer ' + token();

    return fetch(API + path, Object.assign({}, opts, { headers: headers }))
      .catch(function () {
        // 인터넷이 끊겼거나, 파일을 직접 열었을 때 브라우저 보안정책에 막힌 경우
        var e = fail('깃허브에 연결하지 못했어요.\n' +
          '① 인터넷이 연결되어 있는지 확인해 주세요.\n' +
          '② 그래도 안 되면 브라우저 보안정책 때문일 수 있어요. ' +
          '아래 [손으로 백업하기]를 쓰시면 100% 확실하게 저장됩니다.');
        e.network = true;
        throw e;
      })
      .then(function (res) {
        if (res.status === 401) throw fail('토큰이 잘못되었거나 만료됐어요. 새로 발급해서 다시 넣어주세요.', 401);
        if (res.status === 403) throw fail('권한이 없어요. 토큰 권한에서 Contents를 "Read and write"로 설정했는지 확인해 주세요.', 403);
        if (res.status === 404) throw fail('저장소를 찾을 수 없어요. 저장소 이름(아이디/저장소)과 토큰 권한을 확인해 주세요.', 404);
        if (res.status === 409 || res.status === 422) throw fail('깃허브에 이미 다른 내용이 저장되어 있어요. [깃허브에서 불러오기]를 먼저 해보세요.', res.status);
        if (!res.ok) throw fail('깃허브 오류가 발생했어요 (코드 ' + res.status + ')', res.status);
        return res.status === 204 ? null : res.json();
      });
  }

  // 파일 읽기 - 없으면 null (오류 아님)
  function getFile(path) {
    var c = cfg();
    return api('/repos/' + c.repo + '/contents/' + path + '?ref=' + encodeURIComponent(c.branch || 'main'))
      .catch(function (e) {
        if (e.status === 404) return null;   // 아직 백업한 적이 없는 상태
        throw e;
      });
  }

  function putFile(path, base64, sha, message) {
    var c = cfg();
    var body = { message: message, content: base64 };
    if (sha) body.sha = sha;
    if (c.branch) body.branch = c.branch;
    return api('/repos/' + c.repo + '/contents/' + path, {
      method: 'PUT', body: JSON.stringify(body)
    });
  }

  /* ---------- 연결 확인 ---------- */
  function check() {
    var c = cfg();
    if (!c.repo) return Promise.reject(fail('저장소 이름을 먼저 넣어주세요. (예: 아이디/cake-shop-data)'));
    if (!/^[\w.-]+\/[\w.-]+$/.test(c.repo)) {
      return Promise.reject(fail('저장소 이름은 "아이디/저장소이름" 모양이어야 해요. (예: heerinkim/cake-shop-data)'));
    }
    if (!token()) return Promise.reject(fail('토큰을 먼저 넣어주세요.'));

    return api('/repos/' + c.repo).then(function (repo) {
      var info = {
        name: repo.full_name,
        isPrivate: !!repo.private,
        canPush: !!(repo.permissions && repo.permissions.push),
        branch: repo.default_branch || 'main',
        checkedAt: new Date().toISOString()
      };
      saveCfg({ branch: info.branch, lastCheck: info });
      return info;
    });
  }

  /* ---------- 자세히 진단하기 ----------
     깃허브는 "권한이 없는 저장소"도 "없는 저장소"라고 답합니다(404).
     그래서 이름이 맞는데도 못 찾는다고 나올 수 있어, 원인을 직접 찾아봅니다. */
  function diagnose() {
    var out = {
      tokenOk: false, login: '', target: cfg().repo,
      repos: [], targetOk: false, ownerMismatch: false, reason: ''
    };
    if (!token()) { out.reason = 'no-token'; return Promise.resolve(out); }

    return api('/user').then(function (u) {
      out.tokenOk = true;
      out.login = u.login || '';
      var owner = String(out.target).split('/')[0] || '';
      out.ownerMismatch = !!(owner && out.login && owner.toLowerCase() !== out.login.toLowerCase());
      // 이 토큰이 실제로 볼 수 있는 저장소 목록
      return api('/user/repos?per_page=100&sort=updated').catch(function () { return []; });
    }).then(function (arr) {
      out.repos = (arr || []).map(function (r) {
        return { full_name: r.full_name, isPrivate: !!r.private };
      });
      out.targetOk = out.repos.some(function (r) {
        return r.full_name.toLowerCase() === String(out.target).toLowerCase();
      });
      if (!out.repos.length) out.reason = 'no-repos';
      else if (!out.targetOk) out.reason = 'not-in-list';
      else out.reason = 'ok';
      return out;
    }).catch(function (e) {
      out.reason = e.status === 401 ? 'bad-token' : 'network';
      out.message = e.message;
      return out;
    });
  }

  /* ---------- 올리기 ---------- */
  function upload(onStep) {
    var step = onStep || function () {};
    var c = cfg();

    return check().then(function (info) {
      if (!info.canPush) {
        throw fail('이 토큰은 <보기 전용>이라서 저장은 할 수 없어요.\n' +
                   '자료를 보는 것만 가능합니다. 저장까지 하시려면 사장님께 ' +
                   '"Contents: Read and write" 토큰을 받아야 합니다.');
      }
      if (!info.isPrivate) {
        throw fail('⚠️ 이 저장소는 "공개(Public)" 입니다. 고객 이름과 전화번호가 전 세계에 공개되므로 올릴 수 없습니다. ' +
                   '깃허브에서 비공개(Private) 저장소를 만들어 그 이름을 넣어주세요.');
      }
      return uploadPhotos(step);
    }).then(function (photoCount) {
      step('주문 자료를 올리는 중...');
      var data = DB.exportAll();
      data.syncedAt = new Date().toISOString();
      var json = JSON.stringify(data, null, 2);

      return getFile(DATA_PATH).then(function (cur) {
        var stamp = U.korDateFull(U.today()) + ' ' + new Date().toTimeString().slice(0, 5);
        return putFile(DATA_PATH, toB64(json), cur && cur.sha, '주문 자료 백업 - ' + stamp);
      }).then(function () {
        saveCfg({ lastSyncAt: new Date().toISOString() });
        return { photos: photoCount, orders: DB.list('orders').length };
      });
    });
  }

  // 아직 안 올린 사진만 올립니다
  function uploadPhotos(step) {
    var metas = DB.list('photos').filter(function (m) { return !m.remoteAt; });
    if (!metas.length) return Promise.resolve(0);

    var done = 0;
    return metas.reduce(function (chain, meta) {
      return chain.then(function () {
        step('사진 올리는 중... (' + (done + 1) + '/' + metas.length + ')');
        return DB.photoGet(meta.id).then(function (blob) {
          if (!blob) return null;                       // 사진 파일이 없으면 건너뜀
          return blobToB64(blob).then(function (b64) {
            var path = PHOTO_DIR + meta.id + '.jpg';
            return getFile(path).then(function (cur) {
              return putFile(path, b64, cur && cur.sha, '사진 백업 - ' + (meta.title || meta.id));
            });
          });
        }).then(function () {
          DB.upsert('photos', { id: meta.id, remoteAt: new Date().toISOString() });
          done++;
        });
      });
    }, Promise.resolve()).then(function () { return done; });
  }

  /* ---------- 내려받기 ---------- */
  function download(onStep) {
    var step = onStep || function () {};
    return check().then(function () {
      step('주문 자료를 내려받는 중...');
      return getFile(DATA_PATH);
    }).then(function (file) {
      if (!file) throw fail('깃허브에 아직 백업이 없어요. 먼저 [깃허브에 저장]을 해주세요.');
      var data;
      try { data = JSON.parse(fromB64(file.content)); }
      catch (e) { throw fail('백업 파일을 읽지 못했어요. 파일이 손상됐을 수 있습니다.'); }
      DB.importAll(data);
      return downloadPhotos(step);
    }).then(function (n) {
      saveCfg({ lastSyncAt: new Date().toISOString() });
      return { photos: n, orders: DB.list('orders').length };
    });
  }

  // 이 컴퓨터에 없는 사진만 내려받습니다
  function downloadPhotos(step) {
    var metas = DB.list('photos');
    if (!metas.length) return Promise.resolve(0);
    var done = 0;

    return metas.reduce(function (chain, meta) {
      return chain.then(function () {
        return DB.photoGet(meta.id).then(function (has) {
          if (has) return null;                          // 이미 있으면 건너뜀
          step('사진 내려받는 중... (' + (done + 1) + '/' + metas.length + ')');
          return getFile(PHOTO_DIR + meta.id + '.jpg').then(function (file) {
            if (!file || !file.content) return null;
            var blob = new Blob([b64ToBytes(file.content)], { type: 'image/jpeg' });
            return DB.photoPut(meta.id, blob).then(function () { done++; });
          });
        }).catch(function () { /* 사진 한 장 실패로 전체가 멈추지 않도록 */ });
      });
    }, Promise.resolve()).then(function () { return done; });
  }

  /* ---------- 마지막 저장 시각 ---------- */
  function lastSyncText() {
    var t = cfg().lastSyncAt;
    if (!t) return '아직 저장한 적 없음';
    var d = new Date(t);
    var days = U.diffDays(t.slice(0, 10), U.today());
    var when = U.korDateFull(t.slice(0, 10)) + ' ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
    return when + (days >= 1 ? ' (' + days + '일 전)' : ' (오늘)');
  }

  return {
    cfg: cfg, saveCfg: saveCfg, token: token, saveToken: saveToken, configured: configured,
    isReadOnly: isReadOnly,
    cleanToken: cleanToken, tokenInfo: tokenInfo, maskToken: maskToken,
    check: check, diagnose: diagnose, upload: upload, download: download, lastSyncText: lastSyncText,
    DATA_PATH: DATA_PATH
  };
})();
