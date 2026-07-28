/* 데이터 저장소
   - 글자 데이터(주문/재고/재료/레시피/설정)는 localStorage 에 저장합니다.
   - 사진은 용량이 커서 IndexedDB(브라우저 안의 큰 창고)에 따로 저장합니다.
   - 모든 데이터는 "사장님 브라우저 안"에만 저장되며 외부로 나가지 않습니다.
     => 그래서 설정 화면의 [백업 파일 내려받기]를 주기적으로 꼭 눌러주세요. */
window.DB = (function () {

  var PREFIX = 'cakeshop:';
  var memoryFallback = {};   // localStorage 를 못 쓰는 환경(사파리 파일열기 등) 대비
  var storageOk = (function () {
    try {
      window.localStorage.setItem(PREFIX + '__t', '1');
      window.localStorage.removeItem(PREFIX + '__t');
      return true;
    } catch (e) { return false; }
  })();

  function read(key, fallback) {
    var raw;
    try { raw = storageOk ? localStorage.getItem(PREFIX + key) : memoryFallback[key]; }
    catch (e) { raw = memoryFallback[key]; }
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }
  function write(key, value) {
    var raw = JSON.stringify(value);
    memoryFallback[key] = raw;
    if (storageOk) {
      try { localStorage.setItem(PREFIX + key, raw); }
      catch (e) { U.toast('저장 공간이 가득 찼어요. 설정에서 백업 후 정리해 주세요.'); }
    }
    return value;
  }

  /* ---------- 컬렉션(목록) 공통 ---------- */
  function list(key) { return read(key, []); }
  function saveList(key, arr) { return write(key, arr); }
  function upsert(key, item) {
    var arr = list(key);
    if (!item.id) { item.id = U.uid(); item.createdAt = new Date().toISOString(); }
    item.updatedAt = new Date().toISOString();
    var i = arr.findIndex(function (x) { return x.id === item.id; });
    if (i >= 0) arr[i] = Object.assign({}, arr[i], item); else arr.push(item);
    saveList(key, arr);
    return item;
  }
  function remove(key, id) {
    saveList(key, list(key).filter(function (x) { return x.id !== id; }));
  }
  function find(key, id) {
    return list(key).find(function (x) { return x.id === id; }) || null;
  }

  /* ---------- 설정 ---------- */
  var DEFAULT_SETTINGS = {
    shopName: '케이크 공방',
    ownerPhone: '',
    defaultMarginPct: 65,       // 판매가 제안 시 쓰는 마진율(%)
    laborPerCake: 8000,         // 케이크 1개당 기본 인건비(원)
    reservationSource: 'manual' // 'manual' 또는 'naver'
  };
  function settings() { return Object.assign({}, DEFAULT_SETTINGS, read('settings', {})); }
  function saveSettings(s) { return write('settings', Object.assign(settings(), s)); }

  /* ---------- 알림 문구 ---------- */
  var DEFAULT_TEMPLATES = {
    orderDay: '[{{가게이름}}] {{고객명}}님, 주문 감사합니다 🎂\n· 픽업: {{픽업일}} {{픽업시간}}\n· 내용: {{주문내용}}\n· 금액: {{금액}}\n변경이 필요하시면 편하게 연락 주세요!',
    dayBefore: '[{{가게이름}}] {{고객명}}님, 내일 {{픽업시간}}에 케이크 픽업 예정입니다 🍰\n· 내용: {{주문내용}}\n· 잔금: {{잔금}}\n케이크는 서늘한 곳에 보관해 주세요. 내일 뵙겠습니다!',
    afterPickup: '[{{가게이름}}] {{고객명}}님, 오늘 케이크는 어떠셨나요? 😊\n소중한 순간 함께하게 해주셔서 감사합니다.\n후기를 남겨주시면 큰 힘이 됩니다!'
  };
  function templates() { return Object.assign({}, DEFAULT_TEMPLATES, read('templates', {})); }
  function saveTemplates(t) { return write('templates', Object.assign(templates(), t)); }

  /* ---------- 사진 창고 (IndexedDB) ---------- */
  var idbPromise = null;
  function idb() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('이 브라우저는 사진 저장을 지원하지 않아요')); return; }
      var req = indexedDB.open('cakeshop-photos', 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return idbPromise;
  }
  function photoPut(id, blob) {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put(blob, id);
        tx.oncomplete = function () { resolve(id); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function photoGet(id) {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('photos', 'readonly');
        var r = tx.objectStore('photos').get(id);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function photoDel(id) {
    return idb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').delete(id);
        tx.oncomplete = function () { resolve(); };
      });
    });
  }

  /* ---------- 백업 / 복원 ---------- */
  function exportAll() {
    return {
      _type: 'cakeshop-backup',
      _version: 1,
      exportedAt: new Date().toISOString(),
      settings: settings(),
      templates: templates(),
      orders: list('orders'),
      inventory: list('inventory'),
      ingredients: list('ingredients'),
      recipes: list('recipes'),
      options: list('options'),
      photos: list('photos')   // 사진 설명만 (이미지 파일은 용량이 커서 제외)
    };
  }
  function importAll(data) {
    if (!data || data._type !== 'cakeshop-backup') throw new Error('백업 파일이 아니에요');
    if (data.settings) write('settings', data.settings);
    if (data.templates) write('templates', data.templates);
    ['orders', 'inventory', 'ingredients', 'recipes', 'options', 'photos'].forEach(function (k) {
      if (Array.isArray(data[k])) saveList(k, data[k]);
    });
  }
  function clearAll() {
    ['settings', 'templates', 'orders', 'inventory', 'ingredients', 'recipes', 'options', 'photos']
      .forEach(function (k) { write(k, k === 'settings' || k === 'templates' ? {} : []); });
  }

  return {
    storageOk: storageOk,
    list: list, saveList: saveList, upsert: upsert, remove: remove, find: find,
    settings: settings, saveSettings: saveSettings,
    templates: templates, saveTemplates: saveTemplates, DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    photoPut: photoPut, photoGet: photoGet, photoDel: photoDel,
    exportAll: exportAll, importAll: importAll, clearAll: clearAll,
    read: read, write: write
  };
})();
