/* 이 컴퓨터의 자료와 서버(Supabase)를 맞춰 주는 부분
   - 입력은 언제나 이 컴퓨터에 먼저 저장됩니다 (인터넷이 끊겨도 일이 멈추지 않게)
   - 잠시 뒤 자동으로 서버에 올라가고, 다른 기기에서 로그인하면 그대로 보입니다 */
window.Sync = (function () {

  var state = { busy: false, lastAt: null, error: '', pending: 0 };
  var timer = null;
  var listeners = [];

  function onChange(fn) { listeners.push(fn); }
  function emit() {
    state.pending = DB.dirtyCount();
    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
  }
  function status() { state.pending = DB.dirtyCount(); return state; }

  function tms(v) { var t = Date.parse(v || ''); return isNaN(t) ? 0 : t; }

  /* ---------- 서버에서 받아오기 ---------- */
  function pull() {
    return Promise.all([SB.pullAll(), SB.pullSettings()]).then(function (res) {
      var rows = res[0] || [], st = res[1];
      var byCol = {};
      rows.forEach(function (r) { (byCol[r.collection] = byCol[r.collection] || []).push(r); });

      DB.SYNCED.forEach(function (col) {
        var dirty = DB.dirtyMap(col);
        var map = {};
        DB.list(col).forEach(function (x) { if (x && x.id) map[x.id] = x; });

        (byCol[col] || []).forEach(function (r) {
          if (dirty[r.rec_id]) return;              // 아직 못 보낸 내 변경이 우선
          if (r.deleted) { delete map[r.rec_id]; return; }
          var cur = map[r.rec_id];
          if (!cur || tms(r.updated_at) > tms(cur.updatedAt)) {
            map[r.rec_id] = Object.assign({}, r.data, { id: r.rec_id });
          }
        });

        DB.write(col, Object.keys(map).map(function (k) { return map[k]; }));
      });

      if (st && !DB.read('dirty:settings', false)) {
        if (st.settings && Object.keys(st.settings).length) DB.write('settings', st.settings);
        if (st.templates && Object.keys(st.templates).length) DB.write('templates', st.templates);
      }
      return rows.length;
    });
  }

  /* ---------- 서버로 올리기 ---------- */
  function push() {
    var rows = [], touched = {};
    DB.SYNCED.forEach(function (col) {
      var dirty = DB.dirtyMap(col);
      var ids = Object.keys(dirty);
      if (!ids.length) return;
      touched[col] = ids;
      var map = {};
      DB.list(col).forEach(function (x) { if (x && x.id) map[x.id] = x; });
      var now = new Date().toISOString();
      ids.forEach(function (id) {
        var item = map[id];
        var gone = dirty[id] === 'd' || !item;
        rows.push({
          user_id: SB.userId(), collection: col, rec_id: id,
          data: gone ? {} : item, deleted: gone, updated_at: now
        });
      });
    });

    var settingsDirty = DB.read('dirty:settings', false);
    if (!rows.length && !settingsDirty) return Promise.resolve(0);

    // 한 번에 너무 많이 보내지 않도록 나눠서 올립니다
    var chunks = [];
    for (var i = 0; i < rows.length; i += 200) chunks.push(rows.slice(i, i + 200));

    var job = chunks.reduce(function (chain, c) {
      return chain.then(function () { return SB.pushRecords(c); });
    }, Promise.resolve());

    if (settingsDirty) {
      job = job.then(function () { return SB.pushSettings(DB.settings(), DB.templates()); });
    }

    return job.then(function () {
      Object.keys(touched).forEach(function (col) { DB.clearDirty(col, touched[col]); });
      if (settingsDirty) DB.write('dirty:settings', false);
      return rows.length;
    });
  }

  /* ---------- 올리고 받아오기 ---------- */
  function run(opts) {
    opts = opts || {};
    if (state.busy) return Promise.resolve(state);
    if (!SB.loggedIn()) return Promise.resolve(state);
    state.busy = true; state.error = ''; emit();

    return push()
      .then(function () { return opts.pushOnly ? null : pull(); })
      .then(function () {
        state.busy = false;
        state.lastAt = new Date().toISOString();
        state.error = '';
        emit();
        if (opts.rerender !== false && typeof App !== 'undefined') App.render();
        return state;
      })
      .catch(function (e) {
        state.busy = false;
        state.error = e.message || '동기화에 실패했어요.';
        emit();
        return state;
      });
  }

  /* ---------- 바뀐 게 있으면 잠시 뒤 자동으로 올리기 ---------- */
  function start() {
    stop();
    timer = setInterval(function () {
      if (!SB.loggedIn() || state.busy) return;
      if (DB.dirtyCount() > 0) run({ pushOnly: true, rerender: false });
    }, 5000);
    window.addEventListener('beforeunload', function () {
      // 창을 닫기 전에 남은 변경을 한 번 더 보냅니다
      if (SB.loggedIn() && DB.dirtyCount() > 0) { try { push(); } catch (e) {} }
    });
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function lastText() {
    if (state.busy) return '저장하는 중...';
    if (state.error) return '서버 저장 실패 — ' + String(state.error).split('\n')[0];
    var n = DB.dirtyCount();
    if (n > 0) return '보낼 변경 ' + n + '건 (곧 자동 저장됩니다)';
    if (!state.lastAt) return '아직 서버와 맞춘 적 없음';
    var d = new Date(state.lastAt);
    return '서버에 저장됨 · ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
  }

  return {
    pull: pull, push: push, run: run, start: start, stop: stop,
    status: status, onChange: onChange, lastText: lastText
  };
})();
