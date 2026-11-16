/* Supabase 연결 (회원가입 · 로그인 · 자료 저장)
   외부 라이브러리 없이 필요한 기능만 직접 호출합니다.
   - 로그인 정보(토큰)는 이 브라우저에만 저장됩니다.
   - 각 가게는 자기 자료만 보입니다 (서버에서 막아둠). */
window.SB = (function () {

  var URL = 'https://brdjglmsqepleyymckcf.supabase.co';
  var ANON = 'sb_publishable_IV5qpJB7rxQaQxfpcNDUDA_O7Dg_xs9';
  var SESSION_KEY = 'cakeshop:session';

  var session = null;     // { access_token, refresh_token, expires_at, user }

  /* ---------- 세션 보관 ---------- */
  function loadSession() {
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { session = null; }
    return session;
  }
  function saveSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* 저장 못 해도 이번 접속 동안은 동작 */ }
    return s;
  }
  function user() { return session && session.user; }
  function userId() { return session && session.user && session.user.id; }
  function loggedIn() { return !!(session && session.access_token); }

  /* ---------- 공통 호출 ---------- */
  function fail(msg, status) { var e = new Error(msg); e.status = status; return e; }

  function request(path, opts) {
    opts = opts || {};
    var headers = Object.assign({
      'apikey': ANON,
      'Content-Type': 'application/json'
    }, opts.headers || {});
    if (session && session.access_token && !opts.noAuth) {
      headers.Authorization = 'Bearer ' + session.access_token;
    }
    return fetch(URL + path, Object.assign({}, opts, { headers: headers }))
      .catch(function () {
        throw fail('인터넷에 연결되어 있는지 확인해 주세요.\n' +
                   '연결이 안 되는 동안에도 이 컴퓨터에 저장된 자료는 그대로 보입니다.');
      })
      .then(function (res) {
        if (res.status === 204) return null;
        return res.text().then(function (text) {
          var body = null;
          try { body = text ? JSON.parse(text) : null; } catch (e) { body = { raw: text }; }
          if (!res.ok) throw fail(humanError(body, res.status), res.status);
          return body;
        });
      });
  }

  // 서버가 돌려준 영어 오류를 사장님이 알아볼 수 있는 말로 바꿉니다
  function humanError(body, status) {
    var msg = (body && (body.msg || body.message || body.error_description || body.error)) || '';
    var code = (body && body.code) || '';
    var m = String(msg);

    if (/already registered|already been registered|User already exists/i.test(m)) {
      return '이미 가입된 이메일이에요. [로그인]으로 들어가시거나 비밀번호 찾기를 해주세요.';
    }
    if (/Invalid login credentials/i.test(m)) {
      return '이메일 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요.';
    }
    if (/Email not confirmed/i.test(m)) {
      return '이메일 인증이 아직 안 되었어요. 받은 메일함에서 인증 링크를 눌러주세요.';
    }
    if (/Password should be at least/i.test(m)) {
      return '비밀번호는 6자 이상으로 정해주세요.';
    }
    if (/is invalid/i.test(m) && /email/i.test(m)) {
      return '이 이메일 주소는 쓸 수 없어요. 실제로 메일을 받을 수 있는 주소를 적어주세요.\n' +
             '(example.com 처럼 시험용 주소는 막혀 있습니다)';
    }
    if (/valid email/i.test(m) || /Unable to validate email/i.test(m)) {
      return '이메일 주소 형식이 올바르지 않아요.';
    }
    if (/rate limit|too many requests/i.test(m) || status === 429) {
      return '잠시 뒤에 다시 시도해 주세요. (요청이 너무 잦습니다)';
    }
    if (code === '42501' || status === 403) {
      return '이용 기간이 끝나서 새로 저장할 수 없어요. 구독을 시작하시면 다시 저장됩니다.\n' +
             '(지금까지의 자료는 그대로 보고 내려받을 수 있습니다)';
    }
    if (status === 401) return '로그인이 만료됐어요. 다시 로그인해 주세요.';
    return m || ('서버 오류가 발생했어요 (코드 ' + status + ')');
  }

  /* ---------- 토큰 자동 갱신 ---------- */
  function fresh() {
    if (!session) return Promise.reject(fail('로그인이 필요해요.', 401));
    var now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at - 60 > now) return Promise.resolve(session);
    return refresh();
  }
  function refresh() {
    if (!session || !session.refresh_token) return Promise.reject(fail('로그인이 필요해요.', 401));
    return request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', noAuth: true,
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(storeAuth).catch(function (e) {
      if (e.status === 400 || e.status === 401) { saveSession(null); }
      throw e;
    });
  }
  function storeAuth(r) {
    if (!r || !r.access_token) throw fail('로그인 정보를 받지 못했어요.');
    return saveSession({
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      expires_at: r.expires_at || (Math.floor(Date.now() / 1000) + (r.expires_in || 3600)),
      user: r.user || (session && session.user)
    });
  }
  // 로그인이 필요한 호출은 토큰을 먼저 확인하고, 만료되면 한 번 더 시도합니다
  function auth(path, opts) {
    return fresh().then(function () { return request(path, opts); })
      .catch(function (e) {
        if (e.status !== 401) throw e;
        return refresh().then(function () { return request(path, opts); });
      });
  }

  /* ---------- 회원가입 / 로그인 ---------- */
  function signUp(info) {
    return request('/auth/v1/signup', {
      method: 'POST', noAuth: true,
      body: JSON.stringify({
        email: String(info.email || '').trim(),
        password: info.password,
        data: {
          shop_name: String(info.shopName || '').trim(),
          owner_name: String(info.ownerName || '').trim(),
          owner_phone: String(info.ownerPhone || '').trim()
        }
      })
    }).then(function (r) {
      // 이메일 인증을 켜둔 경우 토큰 없이 사용자 정보만 돌아옵니다
      if (r && r.access_token) { storeAuth(r); return { signedIn: true, user: r.user }; }
      return { signedIn: false, user: r };
    });
  }

  function signIn(email, password) {
    return request('/auth/v1/token?grant_type=password', {
      method: 'POST', noAuth: true,
      body: JSON.stringify({ email: String(email || '').trim(), password: password })
    }).then(function (r) { storeAuth(r); return r.user; });
  }

  function signOut() {
    var had = loggedIn();
    var done = had ? auth('/auth/v1/logout', { method: 'POST' }).catch(function () {}) : Promise.resolve();
    return done.then(function () { saveSession(null); });
  }

  function resetPassword(email) {
    return request('/auth/v1/recover', {
      method: 'POST', noAuth: true,
      body: JSON.stringify({ email: String(email || '').trim() })
    });
  }

  function changePassword(newPassword) {
    return auth('/auth/v1/user', {
      method: 'PUT', body: JSON.stringify({ password: newPassword })
    });
  }

  /* ---------- 가게 정보 / 이용 기간 ---------- */
  function myAccess() {
    return auth('/rest/v1/rpc/my_access', { method: 'POST', body: '{}' })
      .then(function (rows) { return (rows && rows[0]) || null; });
  }
  function saveShop(fields) {
    var body = {};
    if (fields.shopName !== undefined) body.shop_name = fields.shopName;
    if (fields.ownerName !== undefined) body.owner_name = fields.ownerName;
    if (fields.ownerPhone !== undefined) body.owner_phone = fields.ownerPhone;
    return auth('/rest/v1/shops?id=eq.' + encodeURIComponent(userId()), {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    });
  }

  /* ---------- 업무 자료 ---------- */
  var COLLECTIONS = ['orders', 'menus', 'inventory', 'ingredients', 'recipes', 'options', 'photos'];

  function pullAll() {
    return auth('/rest/v1/records?select=collection,rec_id,data,deleted,updated_at' +
                '&user_id=eq.' + encodeURIComponent(userId()) + '&order=updated_at.asc');
  }
  function pushRecords(rows) {
    if (!rows.length) return Promise.resolve(null);
    return auth('/rest/v1/records?on_conflict=user_id,collection,rec_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows)
    });
  }
  function pullSettings() {
    return auth('/rest/v1/app_settings?select=settings,templates,updated_at' +
                '&user_id=eq.' + encodeURIComponent(userId()))
      .then(function (rows) { return (rows && rows[0]) || null; });
  }
  function pushSettings(settings, templates) {
    return auth('/rest/v1/app_settings?on_conflict=user_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{
        user_id: userId(), settings: settings, templates: templates,
        updated_at: new Date().toISOString()
      }])
    });
  }

  function myPayments() {
    return auth('/rest/v1/payments?select=*&order=created_at.desc&limit=24');
  }

  loadSession();

  return {
    URL: URL, COLLECTIONS: COLLECTIONS,
    loggedIn: loggedIn, user: user, userId: userId, loadSession: loadSession,
    signUp: signUp, signIn: signIn, signOut: signOut,
    resetPassword: resetPassword, changePassword: changePassword,
    myAccess: myAccess, saveShop: saveShop,
    pullAll: pullAll, pushRecords: pushRecords,
    pullSettings: pullSettings, pushSettings: pushSettings,
    myPayments: myPayments
  };
})();
