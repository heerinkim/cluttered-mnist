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
    return request('/auth/v1/signup?redirect_to=' + encodeURIComponent(appUrl()), {
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
    return request('/auth/v1/recover?redirect_to=' + encodeURIComponent(appUrl()), {
      method: 'POST', noAuth: true,
      body: JSON.stringify({ email: String(email || '').trim() })
    });
  }

  // 메일 링크를 눌렀을 때 돌아올 주소 (파일로 열어 쓰는 경우는 보내지 않습니다)
  function appUrl() {
    if (!/^https?:$/.test(location.protocol)) return 'https://solopreneur111.co.kr/';
    return location.origin + location.pathname;
  }

  /* 비밀번호 재설정 메일의 링크를 누르면 주소 끝에 로그인 정보가 붙어서 돌아옵니다.
     그것을 주워서 로그인 상태로 만들어 줍니다. */
  function captureUrlSession() {
    var h = String(location.hash || '');
    if (h.indexOf('access_token=') < 0) return null;
    var p = new URLSearchParams(h.replace(/^#/, ''));
    var at = p.get('access_token');
    if (!at) return null;
    var kind = p.get('type') || '';
    saveSession({
      access_token: at,
      refresh_token: p.get('refresh_token') || '',
      expires_at: Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600),
      user: null
    });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    // 사용자 정보를 채워 둡니다
    return auth('/auth/v1/user').then(function (u) {
      if (u && u.id) saveSession(Object.assign({}, session, { user: u }));
      return kind;
    }).catch(function () { return kind; });
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

  /* ---------- 사용 후기 ---------- */
  function submitReview(body, author, rating) {
    return rpc('submit_review', { p_body: body, p_author: author || null, p_rating: rating || 5 });
  }
  function myReview() { return rpc('my_review'); }
  function publicReviews() {
    // 로그인하지 않은 분도 소개 화면에서 후기를 볼 수 있어야 합니다
    return request('/rest/v1/rpc/public_reviews', { method: 'POST', noAuth: true, body: '{}' })
      .then(function (r) { return r || []; }).catch(function () { return []; });
  }
  function adminReviews() { return rpc('admin_reviews'); }
  function setReviewApproved(id, on) { return rpc('set_review_approved', { p_id: id, p_on: !!on }); }
  function deleteReview(id) { return rpc('delete_review', { p_id: id }); }
  function addReviewAsAdmin(author, body, rating) {
    return rpc('add_review_as_admin', { p_author: author, p_body: body, p_rating: rating || 5 });
  }

  /* ---------- 초대 코드 확인 (로그인 전에도 호출) ---------- */
  function checkInvite(code) {
    return request('/rest/v1/rpc/check_invite', {
      method: 'POST', noAuth: true,
      body: JSON.stringify({ p_code: String(code || '') })
    }).then(function (r) { return r === true; }).catch(function () { return false; });
  }

  /* ---------- 카드결제 (토스페이먼츠) ----------
     금액과 주문번호는 서버가 정하고, 승인도 서버에서 합니다.
     비밀키(시크릿 키)는 브라우저에 들어오지 않습니다. */
  function startCardPayment(plan) { return rpc('start_card_payment', { p_plan: plan }); }
  function failCardPayment(orderId, reason) {
    return rpc('fail_card_payment', { p_order_id: orderId, p_reason: reason || '' })
      .catch(function () { return null; });
  }
  function confirmCardPayment(p) {
    return fresh().then(function () {
      return fetch(URL + '/functions/v1/toss-confirm', {
        method: 'POST',
        headers: {
          'apikey': ANON,
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(p)
      });
    }).then(function (res) {
      return res.text().then(function (t) {
        var body = null; try { body = JSON.parse(t); } catch (e) {}
        if (!res.ok) throw fail((body && body.error) || '결제 확인에 실패했어요.', res.status);
        return body || {};
      });
    });
  }

  /* ---------- 갤러리 사진 (Supabase Storage) ---------- */
  var BUCKET = 'cake-photos';
  function photoPath(id) { return userId() + '/' + id + '.jpg'; }

  function uploadPhoto(id, blob) {
    return fresh().then(function () {
      return fetch(URL + '/storage/v1/object/' + BUCKET + '/' + photoPath(id), {
        method: 'POST',
        headers: {
          'apikey': ANON,
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': blob.type || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: blob
      });
    }).then(function (res) {
      if (res.ok) return true;
      return res.text().then(function (t) {
        var body = null; try { body = JSON.parse(t); } catch (e) {}
        throw fail(humanError(body, res.status), res.status);
      });
    });
  }

  function downloadPhoto(id) {
    return fresh().then(function () {
      return fetch(URL + '/storage/v1/object/' + BUCKET + '/' + photoPath(id), {
        headers: { 'apikey': ANON, 'Authorization': 'Bearer ' + session.access_token }
      });
    }).then(function (res) {
      if (res.status === 404) return null;        // 서버에 아직 없는 사진
      if (!res.ok) return null;
      return res.blob();
    }).catch(function () { return null; });
  }

  function deletePhoto(id) {
    return fresh().then(function () {
      return fetch(URL + '/storage/v1/object/' + BUCKET + '/' + photoPath(id), {
        method: 'DELETE',
        headers: { 'apikey': ANON, 'Authorization': 'Bearer ' + session.access_token }
      });
    }).then(function () { return true; }).catch(function () { return false; });
  }

  function myPayments() {
    return auth('/rest/v1/payments?select=*&order=created_at.desc&limit=24');
  }

  /* ---------- 구독 (무통장입금) ---------- */
  function rpc(name, body) {
    return auth('/rest/v1/rpc/' + name, {
      method: 'POST', body: JSON.stringify(body || {})
    });
  }
  // 입금하겠다고 신청 (금액은 서버가 정합니다)
  function requestBankTransfer(plan, depositor) {
    return rpc('request_bank_transfer', { p_plan: plan, p_depositor: depositor || null });
  }
  function amIAdmin() { return rpc('am_i_admin').then(function (v) { return v === true; }); }
  // 입금 받을 계좌 (관리자가 정하고, 회원은 보기만)
  function getServiceConfig() {
    return auth('/rest/v1/service_config?select=*&limit=1')
      .then(function (rows) { return (rows && rows[0]) || null; });
  }
  function saveServiceConfig(cfg) {
    return auth('/rest/v1/service_config?id=eq.true', {
      method: 'PATCH', headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        bank_name: cfg.bank, bank_account: cfg.account,
        bank_holder: cfg.holder,
        toss_client_key: cfg.tossKey || null,
        card_enabled: !!cfg.cardEnabled,
        updated_at: new Date().toISOString()
      })
    });
  }
  function adminPayments(status) { return rpc('admin_payments', { p_status: status || 'pending' }); }
  function approvePayment(id) { return rpc('approve_payment', { p_id: id }); }
  function rejectPayment(id) { return rpc('reject_payment', { p_id: id }); }

  loadSession();

  return {
    URL: URL, COLLECTIONS: COLLECTIONS,
    loggedIn: loggedIn, user: user, userId: userId, loadSession: loadSession,
    signUp: signUp, signIn: signIn, signOut: signOut,
    resetPassword: resetPassword, changePassword: changePassword,
    myAccess: myAccess, saveShop: saveShop,
    requestBankTransfer: requestBankTransfer, amIAdmin: amIAdmin,
    getServiceConfig: getServiceConfig, saveServiceConfig: saveServiceConfig,
    adminPayments: adminPayments, approvePayment: approvePayment, rejectPayment: rejectPayment,
    pullAll: pullAll, pushRecords: pushRecords,
    pullSettings: pullSettings, pushSettings: pushSettings,
    myPayments: myPayments,
    uploadPhoto: uploadPhoto, downloadPhoto: downloadPhoto, deletePhoto: deletePhoto,
    startCardPayment: startCardPayment, confirmCardPayment: confirmCardPayment,
    failCardPayment: failCardPayment,
    captureUrlSession: captureUrlSession,
    checkInvite: checkInvite,
    submitReview: submitReview, myReview: myReview, publicReviews: publicReviews,
    adminReviews: adminReviews, setReviewApproved: setReviewApproved,
    deleteReview: deleteReview, addReviewAsAdmin: addReviewAsAdmin
  };
})();
