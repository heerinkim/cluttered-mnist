/* 처음 열었을 때 넣어주는 예시 데이터
   (설정 화면에서 [전체 초기화] 후 [예시 데이터 넣기]로 다시 넣을 수 있어요) */
window.Seed = (function () {

  // 사장님이 직접 적는 메뉴별 원가표 (숫자는 예시이니 실제 값으로 바꿔주세요)
  function menus() {
    return [
      { name: '기본 생크림케이크 1호', cost: 17000, price: 38000, memo: '' },
      { name: '딸기케이크 1호',       cost: 21000, price: 48000, memo: '딸기 시세에 따라 변동' },
      { name: '생화케이크',           cost: 34000, price: 88000, memo: '생화 세척·와이어 작업 포함' },
      { name: '생화케이크 2단',       cost: 62000, price: 145000, memo: '' },
      { name: '레터링케이크 1호',      cost: 19000, price: 42000, memo: '' }
    ];
  }

  function ingredients() {
    return [
      { name: '무염버터',   packPrice: 12900, packQty: 1000, unit: 'g',  url: '', memo: '' },
      { name: '박력분',     packPrice: 3200,  packQty: 1000, unit: 'g',  url: '' },
      { name: '설탕',       packPrice: 2900,  packQty: 1000, unit: 'g',  url: '' },
      { name: '계란',       packPrice: 7500,  packQty: 30,   unit: '개', url: '' },
      { name: '생크림',     packPrice: 5800,  packQty: 500,  unit: 'ml', url: '' },
      { name: '딸기',       packPrice: 12000, packQty: 500,  unit: 'g',  url: '' },
      { name: '생화(장식용)', packPrice: 8000, packQty: 1,   unit: '세트', url: '' }
    ];
  }

  function inventory() {
    return [
      { name: '1호 케이크 상자 (화이트)', category: '상자',       qty: 42, unit: '개', minQty: 20, unitPrice: 1200 },
      { name: '2호 케이크 상자 (크라프트)', category: '상자',     qty: 15, unit: '개', minQty: 20, unitPrice: 1600 },
      { name: '보냉백 (소)',            category: '보냉백',      qty: 30, unit: '개', minQty: 15, unitPrice: 900 },
      { name: '보냉백 (대)',            category: '보냉백',      qty: 8,  unit: '개', minQty: 10, unitPrice: 1400 },
      { name: '새틴 리본 (핑크)',        category: '리본',        qty: 3,  unit: '롤', minQty: 2,  unitPrice: 4500 },
      { name: '숫자 초 세트',           category: '초·장식',     qty: 25, unit: '세트', minQty: 10, unitPrice: 800 },
      { name: '케이크 받침 1호',        category: '받침·트레이',  qty: 60, unit: '개', minQty: 30, unitPrice: 400 },
      { name: '아이스팩',              category: '기타',        qty: 55, unit: '개', minQty: 30, unitPrice: 300 }
    ];
  }

  function options() {
    return [
      { keyword: '2단',  type: 'multiply', value: 1.8, memo: '2단은 재료·수고가 약 1.8배' },
      { keyword: '3단',  type: 'multiply', value: 2.6, memo: '' },
      { keyword: '2호',  type: 'multiply', value: 1.35, memo: '1호 기준 대비' },
      { keyword: '3호',  type: 'multiply', value: 1.8, memo: '' },
      { keyword: '생화',  type: 'add',      value: 8000, memo: '생화 장식 추가 비용' },
      { keyword: '레터링', type: 'add',      value: 2000, memo: '문구 작업 추가' }
    ];
  }

  // 레시피는 재료/재고 id 가 필요해서 저장 후에 만듭니다
  function recipes(ingIds, invIds) {
    return [
      {
        name: '기본 생크림케이크',
        items: [
          { ingId: ingIds['박력분'], qty: 180 },
          { ingId: ingIds['설탕'], qty: 150 },
          { ingId: ingIds['계란'], qty: 5 },
          { ingId: ingIds['생크림'], qty: 400 },
          { ingId: ingIds['무염버터'], qty: 60 }
        ],
        packItems: [
          { invId: invIds['1호 케이크 상자 (화이트)'], qty: 1 },
          { invId: invIds['케이크 받침 1호'], qty: 1 },
          { invId: invIds['아이스팩'], qty: 1 }
        ],
        labor: '', memo: '1호 기준'
      },
      {
        name: '딸기케이크',
        items: [
          { ingId: ingIds['박력분'], qty: 180 },
          { ingId: ingIds['설탕'], qty: 150 },
          { ingId: ingIds['계란'], qty: 5 },
          { ingId: ingIds['생크림'], qty: 450 },
          { ingId: ingIds['딸기'], qty: 300 }
        ],
        packItems: [
          { invId: invIds['1호 케이크 상자 (화이트)'], qty: 1 },
          { invId: invIds['케이크 받침 1호'], qty: 1 },
          { invId: invIds['보냉백 (소)'], qty: 1 }
        ],
        labor: 10000, memo: '딸기 시즌 가격 변동 주의'
      },
      {
        name: '생화케이크',
        items: [
          { ingId: ingIds['박력분'], qty: 180 },
          { ingId: ingIds['설탕'], qty: 150 },
          { ingId: ingIds['계란'], qty: 5 },
          { ingId: ingIds['생크림'], qty: 400 },
          { ingId: ingIds['생화(장식용)'], qty: 1 }
        ],
        packItems: [
          { invId: invIds['2호 케이크 상자 (크라프트)'], qty: 1 },
          { invId: invIds['케이크 받침 1호'], qty: 1 },
          { invId: invIds['새틴 리본 (핑크)'], qty: 0.05 },
          { invId: invIds['보냉백 (대)'], qty: 1 }
        ],
        labor: 15000, memo: '생화 세척·와이어 작업 포함'
      }
    ];
  }

  function orders() {
    var t = U.today();
    return [
      { customerName: '김민지', phone: '010-1234-5678', pickupDate: U.addDays(t, 1), pickupTime: '14:00',
        request: '생화케이크 2단', price: 145000, cost: 62000, deposit: 50000,
        note: '핑크·화이트 톤, 리본 포함', source: 'manual', status: 'reserved', orderDate: t },
      { customerName: '박서준', phone: '010-2222-3333', pickupDate: t, pickupTime: '11:00',
        request: '딸기케이크 1호 / 레터링 "생일 축하해"', price: 48000, cost: 21000, deposit: 20000,
        note: '견과류 알러지', source: 'paste', status: 'reserved', orderDate: U.addDays(t, -3) },
      { customerName: '이하늘', phone: '010-9876-5432', pickupDate: U.addDays(t, -1), pickupTime: '16:30',
        request: '기본 생크림케이크 1호', price: 38000, cost: 16500, deposit: 0,
        note: '', source: 'manual', status: 'done', orderDate: U.addDays(t, -6) },
      { customerName: '정유나', phone: '010-4444-5555', pickupDate: U.addDays(t, 5), pickupTime: '13:00',
        request: '생화케이크 3호', price: 88000, cost: 39000, deposit: 30000,
        note: '웨딩 촬영용', source: 'manual', status: 'reserved', orderDate: U.addDays(t, -1) }
    ];
  }

  function install() {
    var ingIds = {}, invIds = {};
    menus().forEach(function (m) { DB.upsert('menus', m); });
    ingredients().forEach(function (g) { ingIds[g.name] = DB.upsert('ingredients', g).id; });
    inventory().forEach(function (i) { invIds[i.name] = DB.upsert('inventory', i).id; });
    options().forEach(function (o) { DB.upsert('options', o); });
    recipes(ingIds, invIds).forEach(function (r) { DB.upsert('recipes', r); });
    orders().forEach(function (o) { DB.upsert('orders', o); });
  }

  // 처음 실행이면 예시 데이터를 자동으로 넣습니다
  function installIfEmpty() {
    if (DB.read('seeded', false)) return;
    DB.write('seeded', true);
    if (DB.list('menus').length || DB.list('orders').length) return;
    install();
  }

  return { install: install, installIfEmpty: installIfEmpty };
})();
