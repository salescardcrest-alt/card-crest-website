/* ============================================================
   Card Crest — marketCore.js
   Pure logic for the benefit-sharing marketplace. No DOM, no storage.
   Mirrors the SQL functions in supabase/05_marketplace.sql, so the same
   numbers appear in the browser preview and in the database.
   ============================================================ */
(function (w) {
  'use strict';
  var Core = {};

  Core.MODULES = ['LOUNGE', 'MOVIE', 'ORDER', 'PAY'];
  Core.MODULE_LABEL = { LOUNGE: 'Lounge access', MOVIE: 'Movie offer', ORDER: 'Order & Earn', PAY: 'Pay & Earn' };

  /* ---------- state machine ---------- */
  Core.TRANSITIONS = {
    CREATED:   ['PAID', 'CANCELLED'],
    PAID:      ['ACCEPTED', 'EXPIRED', 'CANCELLED'],
    ACCEPTED:  ['FULFILLED', 'PAID', 'DISPUTED', 'REFUNDED'],
    FULFILLED: ['CONFIRMED', 'DISPUTED', 'REFUNDED'],
    CONFIRMED: ['SETTLED'],
    DISPUTED:  ['SETTLED', 'REFUNDED'],
    EXPIRED:   ['REFUNDED'],
    CANCELLED: ['REFUNDED'],
    SETTLED:   [],
    REFUNDED:  []
  };
  Core.canTransition = function (from, to) {
    return (Core.TRANSITIONS[from] || []).indexOf(to) > -1;
  };
  Core.isFinal = function (status) { return status === 'SETTLED' || status === 'REFUNDED' || (status === 'CANCELLED'); };

  /* ---------- money ---------- */
  var r2 = Core.r2 = function (n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; };

  Core.DEFAULT_FEES = [
    /* SPLIT (Order & Earn, Pay & Earn): the discount is shared buyerPct / holderPct / platformPct.
       The buyer pays the full price minus their own share. */
    /* Lounges: a fixed price split between the cardholder and the platform. listValue is the usual entry price, shown as the buyer's saving. */
    { id: 'fee-lounge-dom', module: 'LOUNGE', subtype: 'DOMESTIC', label: 'Domestic lounge', mode: 'FIXED',
      fee: 500, platformAmt: 250, listValue: 1500, acceptHours: 12, confirmHours: 6, penalty: 100, active: true },
    { id: 'fee-lounge-intl', module: 'LOUNGE', subtype: 'INTERNATIONAL', label: 'International lounge', mode: 'FIXED',
      fee: 1000, platformAmt: 500, listValue: 2500, acceptHours: 12, confirmHours: 6, penalty: 200, active: true },
    /* Order & Earn and Pay & Earn: SPLIT shares the discount buyerPct / holderPct / platformPct. */
    { id: 'fee-movie-flat', module: 'MOVIE', subtype: 'FLAT_500_OFF_2_SEATS', label: '₹500 off on 2 seats', mode: 'FIXED',
      fee: 300, platformAmt: 100, discount: 500, acceptHours: 12, confirmHours: 3, penalty: 100, active: true },
    { id: 'fee-movie-bogo', module: 'MOVIE', subtype: 'BOGO', label: 'Buy one get one', mode: 'FIXED',
      fee: 300, platformAmt: 100, cap: 0, acceptHours: 12, confirmHours: 3, penalty: 100, active: true },
    { id: 'fee-order', module: 'ORDER', subtype: 'DEFAULT', label: 'Order & Earn', mode: 'SPLIT',
      buyerPct: 40, holderPct: 30, platformPct: 30, acceptHours: 24, confirmHours: 168, penalty: 150, active: true },
    { id: 'fee-pay', module: 'PAY', subtype: 'DEFAULT', label: 'Pay & Earn', mode: 'SPLIT',
      buyerPct: 40, holderPct: 30, platformPct: 30, acceptHours: 12, confirmHours: 24, penalty: 100, active: true }
  ];

  Core.feeFor = function (fees, module, subtype) {
    return (fees || []).filter(function (f) {
      return f.module === module && f.subtype === subtype && f.active !== false;
    })[0] || null;
  };

  Core.validateFee = function (c) {
    if (!(c.acceptHours > 0) || !(c.confirmHours >= 0)) return 'Time windows must be positive.';
    if (c.penalty < 0) return 'Penalty cannot be negative.';
    if (c.mode === 'SPLIT') {
      var pcts = [c.buyerPct, c.holderPct, c.platformPct];
      if (pcts.some(function (p) { return !(p >= 0 && p <= 100); })) return 'Each share must be between 0 and 100 percent.';
      if (Math.abs(pcts[0] + pcts[1] + pcts[2] - 100) > 0.001) return 'Buyer, cardholder and platform shares must add up to 100%.';
      if (c.module === 'LOUNGE' && !(c.listValue > 0)) return 'Enter the usual lounge entry price.';
    } else if (c.mode === 'PERCENT') {
      if (!(c.feePct > 0) || c.feePct > 50) return 'Fee percent must be between 0 and 50.';
      if (c.minFee < 0) return 'Minimum fee cannot be negative.';
      if (c.platformPct < 0 || c.platformPct > 100) return 'Platform share must be 0 to 100 percent of the fee.';
    } else {
      if (!(c.fee > 0)) return 'Fee must be more than zero.';
      if (c.platformAmt < 0 || c.platformAmt > c.fee) return 'Platform share cannot be more than the fee.';
      if (c.listValue !== undefined && c.listValue !== null && c.listValue !== '' && c.listValue < c.fee) return 'The usual price cannot be less than what the buyer pays.';
    }
    return '';
  };

  /* Price breakdown shown to the buyer and frozen onto the request.
     input: LOUNGE {} | MOVIE {seatCount, ticketTotal} | ORDER/PAY {listPrice, expectedPrice}
     returns { ok, q } or { ok:false, error } */
  Core.quote = function (module, cfg, input) {
    if (!cfg) return { ok: false, error: 'This option is not available right now.' };
    var q = { original: 0, discount: 0, reimbursement: 0, fee: 0, platform: 0, holderFee: 0, total: 0, saved: null, holderReceives: 0 };
    var n = function (v) { return Number(v); };
    var CAP = (module === 'ORDER' || module === 'PAY') ? 200000 : 1000000;
    var TOO_BIG = { ok: false, error: 'Amounts above ₹' + CAP.toLocaleString('en-IN') + ' are not supported here. Check the numbers you entered.' };
    if (module !== 'LOUNGE' && [input.ticketTotal, input.listPrice, input.expectedPrice].some(function (v) { return n(v) > CAP; })) return TOO_BIG;

    if (cfg.mode === 'SPLIT') {
      /* the discount D is shared: buyer keeps buyerPct, cardholder gets holderPct, platform gets the rest */
      var D, reimb = 0, listP;
      if (module === 'LOUNGE') {
        listP = r2(cfg.listValue); D = listP;
      } else {
        var lp = n(input.listPrice), ep = n(input.expectedPrice);
        if (!(lp > 0) || !(ep > 0)) return { ok: false, error: 'Enter both prices.' };
        if (ep >= lp) return { ok: false, error: 'The price after the card offer must be less than the listed price.' };
        listP = r2(lp); D = r2(lp - ep); reimb = r2(ep);
      }
      var buyerShare = r2(D * cfg.buyerPct / 100), holderShare = r2(D * cfg.holderPct / 100);
      q.original = listP; q.discount = D; q.reimbursement = reimb;
      q.fee = r2(D - buyerShare);                    // what the buyer adds on top of the offer price
      q.holderFee = holderShare; q.platform = r2(D - buyerShare - holderShare);
      q.total = r2(reimb + q.fee); q.saved = buyerShare;
      q.holderReceives = r2(reimb + holderShare);
      q.split = { buyerPct: cfg.buyerPct, holderPct: cfg.holderPct, platformPct: cfg.platformPct, buyerShare: buyerShare };
      if (q.saved <= 0) return { ok: false, error: 'The saving is too small to share. Pick a bigger discount.' };
      return { ok: true, q: q };
    }
    if (module === 'LOUNGE') {
      q.fee = r2(cfg.fee); q.platform = r2(cfg.platformAmt);
      q.total = q.fee;
      q.original = cfg.listValue > q.fee ? r2(cfg.listValue) : q.fee;   // usual entry price
      q.discount = r2(q.original - q.fee); q.saved = q.discount > 0 ? q.discount : null;
    } else if (module === 'MOVIE') {
      var total = n(input.ticketTotal), seats = n(input.seatCount);
      if (!(total > 0)) return { ok: false, error: 'Enter the ticket total for all seats.' };
      if (cfg.subtype === 'FLAT_500_OFF_2_SEATS') {
        if (seats !== 2) return { ok: false, error: 'This offer works for exactly 2 seats.' };
        if (!(total > cfg.discount)) return { ok: false, error: 'The ticket total must be more than ₹' + cfg.discount + ' for this offer.' };
        q.discount = r2(cfg.discount);
      } else { // BOGO
        if (seats !== 2) return { ok: false, error: 'Buy-one-get-one needs exactly 2 seats.' };
        q.discount = r2(total / 2);
        if (cfg.cap > 0) q.discount = Math.min(q.discount, r2(cfg.cap));
      }
      q.original = r2(total);
      q.reimbursement = r2(total - q.discount);
      q.fee = r2(cfg.fee); q.platform = r2(cfg.platformAmt);
      q.total = r2(q.reimbursement + q.fee);
      q.saved = r2(q.discount - q.fee);
    } else { // ORDER, PAY
      var list = n(input.listPrice), exp = n(input.expectedPrice);
      if (!(list > 0) || !(exp > 0)) return { ok: false, error: 'Enter both prices.' };
      if (exp >= list) return { ok: false, error: 'The price after the card offer must be less than the listed price.' };
      q.original = r2(list);
      q.discount = r2(list - exp);
      q.reimbursement = r2(exp);
      q.fee = r2(Math.max(cfg.minFee || 0, exp * cfg.feePct / 100));
      q.platform = r2(q.fee * cfg.platformPct / 100);
      q.total = r2(q.reimbursement + q.fee);
      q.saved = r2(list - q.total);
    }
    q.holderFee = r2(q.fee - q.platform);
    q.holderReceives = r2(q.reimbursement + q.holderFee);
    if (q.saved !== null && q.saved <= 0) {
      return { ok: false, error: 'After the service fee this deal would not save you anything, so it cannot be booked.' };
    }
    return { ok: true, q: q };
  };

  Core.snapshot = function (cfg, q) {
    return {
      cfgId: cfg.id, subtype: cfg.subtype, label: cfg.label, mode: cfg.mode,
      reimbursement: q.reimbursement, fee: q.fee, platform: q.platform, holderFee: q.holderFee,
      total: q.total, original: q.original, discount: q.discount, saved: q.saved, split: q.split || null,
      acceptHours: cfg.acceptHours, confirmHours: cfg.confirmHours, penalty: cfg.penalty
    };
  };

  /* Cardholder paid a different amount than estimated (movie / order / pay). */
  Core.adjust = function (snap, actual) {
    var diff = r2(Number(actual) - snap.reimbursement);
    return { diff: diff, refund: diff < 0 ? -diff : 0, topup: diff > 0 ? diff : 0 };
  };

  /* Where the escrowed money goes when a request settles normally. */
  Core.settleLegs = function (snap, actual) {
    var act = (actual === null || actual === undefined) ? snap.reimbursement : r2(actual);
    var adj = Core.adjust(snap, act);
    return {
      reimbursement: act, holderFee: snap.holderFee, platform: snap.platform,
      refund: adj.refund, held: r2(snap.total + adj.topup)
    };
  };

  /* ---------- dates ---------- */
  Core.quarterOf = function (iso) {
    var d = new Date(iso);
    return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
  };
  Core.eventTime = function (req) {
    var d = req.details || {};
    return d.dateTime || d.showTime || null;
  };
  var H = 3600 * 1000;
  var iso = function (ms) { return new Date(ms).toISOString(); };

  /* Last moment a cardholder can pick the request up. */
  Core.acceptBy = function (req, paidAtMs) {
    var by = paidAtMs + req.feeSnapshot.acceptHours * H, ev = Core.eventTime(req);
    if (ev) by = Math.min(by, new Date(ev).getTime() - 1 * H);
    return iso(by);
  };
  /* Last moment the cardholder can upload proof. */
  Core.fulfilBy = function (req, acceptedAtMs) {
    var ev = Core.eventTime(req);
    return iso(ev ? new Date(ev).getTime() - 0.5 * H : acceptedAtMs + 48 * H);
  };
  Core.autoConfirmAt = function (req, fulfilledAtMs) {
    var ev = Core.eventTime(req), base = fulfilledAtMs;
    if (ev) base = Math.max(base, new Date(ev).getTime());
    return iso(base + req.feeSnapshot.confirmHours * H);
  };
  /* Movie money is released after the show even if the buyer confirms early. */
  Core.settleAt = function (req, confirmedAtMs) {
    if (req.module === 'MOVIE') {
      return iso(Math.max(confirmedAtMs, new Date(Core.eventTime(req)).getTime() + 0.5 * H));
    }
    return iso(confirmedAtMs);
  };

  /* ---------- privacy ---------- */
  var SENSITIVE = ['address', 'guestName', 'cartUrl'];
  Core.publicDetails = function (details) {
    var out = {};
    Object.keys(details || {}).forEach(function (k) { if (SENSITIVE.indexOf(k) < 0) out[k] = details[k]; });
    return out;
  };
  /* Hide phone numbers, emails and "whatsapp me" style hand-offs in chat. */
  Core.maskContact = function (text) {
    return String(text || '')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email hidden]')
      .replace(/(\+?\d[\d\s().-]{6,}\d)/g, function (m) { return m.replace(/\D/g, '').length >= 8 ? '[number hidden]' : m; });
  };

  /* ---------- airports ---------- */
  Core.AIRPORTS = [
    { code: 'DEL', name: 'Delhi (Indira Gandhi)', terminals: { T1: ['DOMESTIC'], T2: ['DOMESTIC'], T3: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'BOM', name: 'Mumbai (Chhatrapati Shivaji)', terminals: { T1: ['DOMESTIC'], T2: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'BLR', name: 'Bengaluru (Kempegowda)', terminals: { T1: ['DOMESTIC'], T2: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'HYD', name: 'Hyderabad (Rajiv Gandhi)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'MAA', name: 'Chennai', terminals: { T1: ['DOMESTIC'], T2: ['INTERNATIONAL'], T4: ['DOMESTIC'] } },
    { code: 'CCU', name: 'Kolkata (Netaji Subhas)', terminals: { T2: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'AMD', name: 'Ahmedabad (Sardar Vallabhbhai Patel)', terminals: { T1: ['DOMESTIC'], T2: ['INTERNATIONAL'] } },
    { code: 'PNQ', name: 'Pune', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'COK', name: 'Kochi', terminals: { T3: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'GOI', name: 'Goa (Dabolim)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'GOX', name: 'Goa (Mopa, Manohar International)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'JAI', name: 'Jaipur', terminals: { T2: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'LKO', name: 'Lucknow (Chaudhary Charan Singh)', terminals: { T3: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'TRV', name: 'Thiruvananthapuram', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'CCJ', name: 'Kozhikode (Calicut)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'CJB', name: 'Coimbatore', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'IXE', name: 'Mangaluru', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'TRZ', name: 'Tiruchirappalli', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'VTZ', name: 'Visakhapatnam', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'ATQ', name: 'Amritsar (Sri Guru Ram Dass Jee)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'IXC', name: 'Chandigarh', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'SXR', name: 'Srinagar', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'GAU', name: 'Guwahati (Lokpriya Gopinath Bordoloi)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'VNS', name: 'Varanasi (Lal Bahadur Shastri)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'NAG', name: 'Nagpur (Dr. Babasaheb Ambedkar)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'IDR', name: 'Indore (Devi Ahilyabai Holkar)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'BBI', name: 'Bhubaneswar (Biju Patnaik)', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'IXB', name: 'Bagdogra', terminals: { Main: ['DOMESTIC', 'INTERNATIONAL'] } },
    { code: 'PAT', name: 'Patna', terminals: { Main: ['DOMESTIC'] } },
    { code: 'IXR', name: 'Ranchi', terminals: { Main: ['DOMESTIC'] } },
    { code: 'BHO', name: 'Bhopal', terminals: { Main: ['DOMESTIC'] } },
    { code: 'RPR', name: 'Raipur', terminals: { Main: ['DOMESTIC'] } },
    { code: 'UDR', name: 'Udaipur', terminals: { Main: ['DOMESTIC'] } },
    { code: 'DED', name: 'Dehradun', terminals: { Main: ['DOMESTIC'] } },
    { code: 'JDH', name: 'Jodhpur', terminals: { Main: ['DOMESTIC'] } },
    { code: 'IXJ', name: 'Jammu', terminals: { Main: ['DOMESTIC'] } },
    { code: 'VGA', name: 'Vijayawada', terminals: { Main: ['DOMESTIC'] } }
  ];
  Core.AIRPORTS.forEach(function (a) { a.country = 'India'; });

  /* Airports outside India, for international lounges: 'Country|CODE Name; CODE Name; ...' */
  var INTL_RAW = [
    'United Arab Emirates|DXB Dubai International; DWC Dubai Al Maktoum; AUH Abu Dhabi Zayed International; SHJ Sharjah International; RKT Ras Al Khaimah International',
    'Qatar|DOH Doha Hamad International',
    'Saudi Arabia|RUH Riyadh King Khalid International; JED Jeddah King Abdulaziz International; DMM Dammam King Fahd International; MED Madinah Prince Mohammad bin Abdulaziz',
    'Oman|MCT Muscat International; SLL Salalah',
    'Kuwait|KWI Kuwait International',
    'Bahrain|BAH Bahrain International',
    'Israel|TLV Tel Aviv Ben Gurion',
    'Jordan|AMM Amman Queen Alia International',
    'Lebanon|BEY Beirut Rafic Hariri International',
    'Turkey|IST Istanbul Airport; SAW Istanbul Sabiha Gokcen; AYT Antalya; ESB Ankara Esenboga; ADB Izmir Adnan Menderes; DLM Dalaman; BJV Bodrum Milas',
    'Egypt|CAI Cairo International; HRG Hurghada; SSH Sharm El Sheikh',
    'Georgia|TBS Tbilisi International',
    'Armenia|EVN Yerevan Zvartnots',
    'Azerbaijan|GYD Baku Heydar Aliyev',
    'Uzbekistan|TAS Tashkent International',
    'Kazakhstan|ALA Almaty International; NQZ Astana Nursultan Nazarbayev',
    'Singapore|SIN Singapore Changi',
    'Malaysia|KUL Kuala Lumpur International; PEN Penang International; LGK Langkawi; BKI Kota Kinabalu',
    'Thailand|BKK Bangkok Suvarnabhumi; DMK Bangkok Don Mueang; HKT Phuket International; CNX Chiang Mai International; USM Koh Samui; KBV Krabi',
    'Indonesia|CGK Jakarta Soekarno-Hatta; DPS Bali Ngurah Rai; SUB Surabaya Juanda; JOG Yogyakarta International',
    'Vietnam|SGN Ho Chi Minh City Tan Son Nhat; HAN Hanoi Noi Bai; DAD Da Nang International; CXR Nha Trang Cam Ranh',
    'Philippines|MNL Manila Ninoy Aquino; CEB Cebu Mactan; CRK Clark International',
    'Cambodia|PNH Phnom Penh International; REP Siem Reap Angkor International',
    'Myanmar|RGN Yangon International',
    'Laos|VTE Vientiane Wattay',
    'Brunei|BWN Brunei International',
    'Hong Kong|HKG Hong Kong International',
    'Macau|MFM Macau International',
    'China|PEK Beijing Capital; PKX Beijing Daxing; PVG Shanghai Pudong; SHA Shanghai Hongqiao; CAN Guangzhou Baiyun; SZX Shenzhen Bao an; CTU Chengdu Shuangliu; TFU Chengdu Tianfu; KMG Kunming Changshui; XIY Xian Xianyang; HGH Hangzhou Xiaoshan; CKG Chongqing Jiangbei; NKG Nanjing Lukou; WUH Wuhan Tianhe; XMN Xiamen Gaoqi; TAO Qingdao Jiaodong',
    'Taiwan|TPE Taipei Taoyuan; TSA Taipei Songshan; KHH Kaohsiung International',
    'Japan|NRT Tokyo Narita; HND Tokyo Haneda; KIX Osaka Kansai; ITM Osaka Itami; NGO Nagoya Chubu Centrair; FUK Fukuoka; CTS Sapporo New Chitose; OKA Okinawa Naha',
    'South Korea|ICN Seoul Incheon; GMP Seoul Gimpo; PUS Busan Gimhae; CJU Jeju International',
    'Mongolia|ULN Ulaanbaatar Chinggis Khaan',
    'Sri Lanka|CMB Colombo Bandaranaike; HRI Hambantota Mattala',
    'Maldives|MLE Male Velana International',
    'Nepal|KTM Kathmandu Tribhuvan; PKR Pokhara International',
    'Bangladesh|DAC Dhaka Hazrat Shahjalal; CGP Chattogram Shah Amanat',
    'Bhutan|PBH Paro International',
    'Pakistan|ISB Islamabad International; KHI Karachi Jinnah; LHE Lahore Allama Iqbal',
    'Afghanistan|KBL Kabul Hamid Karzai',
    'United Kingdom|LHR London Heathrow; LGW London Gatwick; STN London Stansted; LTN London Luton; LCY London City; MAN Manchester; BHX Birmingham; EDI Edinburgh; GLA Glasgow; BRS Bristol; NCL Newcastle; LBA Leeds Bradford',
    'Ireland|DUB Dublin; SNN Shannon; ORK Cork',
    'France|CDG Paris Charles de Gaulle; ORY Paris Orly; NCE Nice Cote d Azur; LYS Lyon Saint-Exupery; MRS Marseille Provence; TLS Toulouse Blagnac',
    'Netherlands|AMS Amsterdam Schiphol',
    'Germany|FRA Frankfurt; MUC Munich; BER Berlin Brandenburg; DUS Dusseldorf; HAM Hamburg; CGN Cologne Bonn; STR Stuttgart',
    'Switzerland|ZRH Zurich; GVA Geneva; BSL Basel Mulhouse',
    'Austria|VIE Vienna International',
    'Belgium|BRU Brussels',
    'Luxembourg|LUX Luxembourg Findel',
    'Denmark|CPH Copenhagen Kastrup',
    'Sweden|ARN Stockholm Arlanda; GOT Gothenburg Landvetter',
    'Norway|OSL Oslo Gardermoen; BGO Bergen Flesland',
    'Finland|HEL Helsinki Vantaa',
    'Iceland|KEF Reykjavik Keflavik',
    'Spain|MAD Madrid Barajas; BCN Barcelona El Prat; AGP Malaga Costa del Sol; PMI Palma de Mallorca; VLC Valencia; ALC Alicante; TFS Tenerife South',
    'Portugal|LIS Lisbon Humberto Delgado; OPO Porto Francisco Sa Carneiro; FAO Faro',
    'Italy|FCO Rome Fiumicino; MXP Milan Malpensa; LIN Milan Linate; VCE Venice Marco Polo; NAP Naples; BLQ Bologna; FLR Florence; CTA Catania',
    'Greece|ATH Athens Eleftherios Venizelos; SKG Thessaloniki; HER Heraklion; JMK Mykonos',
    'Malta|MLA Malta International',
    'Cyprus|LCA Larnaca',
    'Czech Republic|PRG Prague Vaclav Havel',
    'Poland|WAW Warsaw Chopin; KRK Krakow John Paul II',
    'Hungary|BUD Budapest Ferenc Liszt',
    'Romania|OTP Bucharest Henri Coanda',
    'Bulgaria|SOF Sofia',
    'Serbia|BEG Belgrade Nikola Tesla',
    'Croatia|ZAG Zagreb Franjo Tudman; SPU Split',
    'Russia|SVO Moscow Sheremetyevo; DME Moscow Domodedovo; VKO Moscow Vnukovo; LED Saint Petersburg Pulkovo',
    'South Africa|JNB Johannesburg O R Tambo; CPT Cape Town International; DUR Durban King Shaka',
    'Kenya|NBO Nairobi Jomo Kenyatta; MBA Mombasa Moi',
    'Ethiopia|ADD Addis Ababa Bole',
    'Nigeria|LOS Lagos Murtala Muhammed; ABV Abuja Nnamdi Azikiwe',
    'Ghana|ACC Accra Kotoka',
    'Morocco|CMN Casablanca Mohammed V; RAK Marrakesh Menara',
    'Algeria|ALG Algiers Houari Boumediene',
    'Tunisia|TUN Tunis Carthage',
    'Tanzania|DAR Dar es Salaam Julius Nyerere; ZNZ Zanzibar Abeid Amani Karume; JRO Kilimanjaro',
    'Uganda|EBB Entebbe International',
    'Rwanda|KGL Kigali International',
    'Zambia|LUN Lusaka Kenneth Kaunda',
    'Zimbabwe|HRE Harare Robert Gabriel Mugabe',
    'Mauritius|MRU Mauritius Sir Seewoosagur Ramgoolam',
    'Seychelles|SEZ Mahe Seychelles International',
    'United States|JFK New York John F Kennedy; EWR Newark Liberty; LGA New York LaGuardia; BOS Boston Logan; IAD Washington Dulles; DCA Washington Reagan; ORD Chicago O Hare; MDW Chicago Midway; ATL Atlanta Hartsfield-Jackson; MIA Miami International; MCO Orlando International; FLL Fort Lauderdale; DFW Dallas Fort Worth; IAH Houston George Bush; DEN Denver International; LAX Los Angeles International; SFO San Francisco International; SJC San Jose Mineta; SEA Seattle-Tacoma; LAS Las Vegas Harry Reid; PHX Phoenix Sky Harbor; SAN San Diego International; MSP Minneapolis Saint Paul; DTW Detroit Metropolitan; PHL Philadelphia International; CLT Charlotte Douglas; BWI Baltimore Washington; HNL Honolulu Daniel K Inouye; ANC Anchorage Ted Stevens',
    'Canada|YYZ Toronto Pearson; YVR Vancouver International; YUL Montreal Trudeau; YYC Calgary International; YOW Ottawa Macdonald-Cartier; YEG Edmonton International',
    'Mexico|MEX Mexico City Benito Juarez; CUN Cancun International; GDL Guadalajara; SJD Los Cabos International',
    'Panama|PTY Panama City Tocumen',
    'Costa Rica|SJO San Jose Juan Santamaria',
    'Cuba|HAV Havana Jose Marti',
    'Bahamas|NAS Nassau Lynden Pindling',
    'Jamaica|MBJ Montego Bay Sangster',
    'Dominican Republic|PUJ Punta Cana International',
    'Brazil|GRU Sao Paulo Guarulhos; GIG Rio de Janeiro Galeao; BSB Brasilia',
    'Argentina|EZE Buenos Aires Ezeiza',
    'Chile|SCL Santiago Arturo Merino Benitez',
    'Colombia|BOG Bogota El Dorado',
    'Peru|LIM Lima Jorge Chavez',
    'Ecuador|UIO Quito Mariscal Sucre',
    'Uruguay|MVD Montevideo Carrasco',
    'Australia|SYD Sydney Kingsford Smith; MEL Melbourne Tullamarine; BNE Brisbane; PER Perth; ADL Adelaide; CBR Canberra; OOL Gold Coast; CNS Cairns',
    'New Zealand|AKL Auckland; CHC Christchurch; WLG Wellington; ZQN Queenstown',
    'Fiji|NAN Nadi International',
    'French Polynesia|PPT Tahiti Faaa'
  ];
  Core.INTL_AIRPORTS = [];
  INTL_RAW.forEach(function (line) {
    var p = line.split('|');
    p[1].split(';').forEach(function (s) {
      s = s.trim();
      Core.INTL_AIRPORTS.push({ code: s.slice(0, 3), name: s.slice(4), country: p[0], terminals: {} });
    });
  });

  Core.airport = function (code) {
    return Core.AIRPORTS.concat(Core.INTL_AIRPORTS).filter(function (a) { return a.code === code; })[0] || null;
  };
  /* Domestic lounges are at Indian airports. International lounges are at every airport outside India. */
  Core.airportsFor = function (type) {
    return type === 'INTERNATIONAL' ? Core.INTL_AIRPORTS : Core.AIRPORTS.filter(function (a) {
      return Object.keys(a.terminals).some(function (t) { return a.terminals[t].indexOf('DOMESTIC') > -1; });
    });
  };
  /* Terminals to pick from. Abroad the buyer types the terminal, so the list is empty. */
  Core.terminalsFor = function (code, type) {
    var a = Core.airport(code);
    if (!a || type === 'INTERNATIONAL') return [];
    return Object.keys(a.terminals).filter(function (t) { return a.terminals[t].indexOf('DOMESTIC') > -1; });
  };

  /* ---------- benefit kinds on a cardholder's card ---------- */
  Core.BENEFITS = {
    LOUNGE_DOM:       { label: 'Domestic lounge access', quota: true },
    LOUNGE_INTL:      { label: 'International lounge access', quota: true },
    MOVIE_BOGO:       { label: 'Movie: buy one get one', quota: false },
    MOVIE_FLAT500_2:  { label: 'Movie: ₹500 off on 2 seats', quota: false },
    SHOPPING:         { label: 'Shopping offer', quota: false }
  };
  Core.PROGRAMS = ['Bank', 'Visa', 'Mastercard', 'RuPay', 'Priority Pass', 'DreamFolks'];

  /* Which benefit does a request need? */
  Core.needs = function (req) {
    var d = req.details || {};
    if (req.module === 'LOUNGE') return d.type === 'INTERNATIONAL' ? 'LOUNGE_INTL' : 'LOUNGE_DOM';
    if (req.module === 'MOVIE') return d.offer === 'BOGO' ? 'MOVIE_BOGO' : 'MOVIE_FLAT500_2';
    return 'SHOPPING';
  };

  /* Does one of a cardholder's cards fit this request? `used` is a function(cardId, kind, quarter) -> number. */
  Core.cardFits = function (card, req, used) {
    if (card.active === false) return { ok: false, why: 'Card is switched off' };
    var kind = Core.needs(req), d = req.details || {};
    var ben = (card.benefits || []).filter(function (b) { return b.kind === kind; })[0];
    if (!ben) return { ok: false, why: 'No ' + Core.BENEFITS[kind].label.toLowerCase() + ' on this card' };
    if (req.module === 'LOUNGE') {
      var ap = ben.airports || ['ANY'];
      if (ap.indexOf('ANY') < 0 && ap.indexOf(d.airport) < 0) return { ok: false, why: 'Not valid at ' + d.airport };
      var left = Core.quotaLeft(card, ben, Core.quarterOf(d.dateTime), used);
      if (left <= 0) return { ok: false, why: 'No lounge visits left this quarter' };
    }
    if (req.module !== 'LOUNGE' && d.bank && d.bank !== 'any' && card.bank !== d.bank) {
      return { ok: false, why: 'Buyer needs a different bank card' };
    }
    return { ok: true, benefit: ben };
  };
  Core.quotaLeft = function (card, ben, quarter, used) {
    var total = Number(ben.quota);
    if (!isFinite(total) || total <= 0) return 0;
    return Math.max(0, total - (used ? used(card.id, ben.kind, quarter) : 0));
  };

  /* ---------- validation ---------- */
  var V = Core.valid = {};
  V.pan = function (s) { return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(s || '').toUpperCase()); };
  V.ifsc = function (s) { return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(s || '').toUpperCase()); };
  V.upi = function (s) { return /^[a-z0-9._-]{2,}@[a-z]{2,}$/i.test(String(s || '')); };
  V.account = function (s) { return /^\d{9,18}$/.test(String(s || '')); };
  V.flight = function (s) { return /^[A-Z0-9]{2}\s?\d{1,4}$/i.test(String(s || '').trim()); };
  V.url = function (s) { try { var u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; } };
  V.pin = function (s) { return /^\d{6}$/.test(String(s || '')); };

  /* Check a new request and return a clean `details` object, or an error message. */
  Core.cleanRequest = function (module, d, nowMs) {
    nowMs = nowMs || Date.now();
    var s = function (v) { return String(v == null ? '' : v).trim(); };
    var out = {}, t;
    if (module === 'LOUNGE') {
      var ap = Core.airport(s(d.airport)), ltype = s(d.type), term = s(d.terminal);
      if (['DOMESTIC', 'INTERNATIONAL'].indexOf(ltype) < 0) return { error: 'Choose domestic or international.' };
      if (!ap) return { error: 'Choose an airport.' };
      if (ltype === 'DOMESTIC') {
        if (ap.country !== 'India') return { error: 'Domestic lounges are at airports in India.' };
        if (!ap.terminals[term]) return { error: 'Choose a terminal.' };
        if (ap.terminals[term].indexOf('DOMESTIC') < 0) return { error: 'That terminal has no domestic lounge.' };
      } else {
        if (ap.country === 'India') return { error: 'International lounges are at airports outside India.' };
        if (term.length < 1 || term.length > 20) return { error: 'Enter the terminal, for example T3.' };
      }
      t = new Date(d.dateTime).getTime();
      if (isNaN(t)) return { error: 'Choose the flight date and time.' };
      if (t < nowMs + 2 * H) return { error: 'Lounge visits must be booked at least 2 hours ahead.' };
      if (!V.flight(d.flight)) return { error: 'Enter a flight number like AI 101.' };
      if (s(d.guestName).length < 3) return { error: 'Enter your name as it appears on your ID.' };
      out = { type: ltype, airport: ap.code, terminal: term, dateTime: new Date(t).toISOString(),
              flight: s(d.flight).toUpperCase(), guestName: s(d.guestName) };
    } else if (module === 'MOVIE') {
      t = new Date(d.showTime).getTime();
      if (isNaN(t)) return { error: 'Choose the showtime.' };
      if (t < nowMs + 3 * H) return { error: 'Shows must be booked at least 3 hours ahead.' };
      if (s(d.movie).length < 2 || s(d.theatre).length < 2) return { error: 'Enter the movie and the theatre.' };
      if (s(d.seats).length < 2) return { error: 'Enter the seats you want, for example G7, G8.' };
      if (['BOGO', 'FLAT_500_OFF_2_SEATS'].indexOf(s(d.offer)) < 0) return { error: 'Choose an offer.' };
      out = { offer: s(d.offer), movie: s(d.movie), theatre: s(d.theatre), city: s(d.city), showTime: new Date(t).toISOString(),
              seats: s(d.seats), seatCount: Number(d.seatCount), ticketTotal: Number(d.ticketTotal),
              platform: s(d.platform) || 'BookMyShow', bank: s(d.bank) || 'any' };
    } else if (module === 'ORDER' || module === 'PAY') {
      if (!V.url(s(d.url))) return { error: 'Paste the full product link (starting with https://).' };
      if (s(d.platform).length < 2) return { error: 'Choose the shopping site.' };
      if (s(d.offerWanted).length < 3) return { error: 'Describe the card offer you want.' };
      out = { url: s(d.url), platform: s(d.platform), listPrice: Number(d.listPrice), expectedPrice: Number(d.expectedPrice),
              offerWanted: s(d.offerWanted), bank: s(d.bank) || 'any' };
      if (module === 'ORDER') {
        var a = d.address || {};
        if (s(a.name).length < 3 || s(a.line).length < 8 || s(a.city).length < 2) return { error: 'Enter the full delivery address.' };
        if (!V.pin(a.pin)) return { error: 'Enter a 6-digit PIN code.' };
        out.address = { name: s(a.name), line: s(a.line), city: s(a.city), pin: s(a.pin) };
      } else {
        out.cartUrl = s(d.cartUrl);
        if (out.cartUrl && !V.url(out.cartUrl)) return { error: 'The cart link must start with https://.' };
      }
    } else return { error: 'Unknown request type.' };
    return { details: out };
  };

  /* What does fulfilment need to include? returns an error string or ''. */
  Core.cleanProof = function (module, f) {
    var s = function (v) { return String(v == null ? '' : v).trim(); };
    if (!f.proofs || !f.proofs.length) return 'Upload at least one proof image.';
    if (module === 'LOUNGE') return s(f.ref).length < 4 ? 'Enter the pass or booking reference.' : '';
    if (!(Number(f.actual) > 0)) return 'Enter the amount you actually paid.';
    if (module === 'MOVIE') return s(f.ref).length < 4 ? 'Enter the booking ID.' : '';
    return s(f.ref).length < 4 ? 'Enter the order or payment ID.' : '';
  };

  w.CC = w.CC || {};
  w.CC.MarketCore = Core;
})(window);
