-- Card Crest — step 5: benefit-sharing marketplace (Lounge, Movie, Order & Earn, Pay & Earn).
-- Run in Supabase → SQL Editor, AFTER schema.sql and 02_data_tables.sql. Safe to re-run.
--
-- Design rules
--   * The browser can only READ these tables (row level security). Every write goes through
--     a security-definer function (mk_*), so money, locking and the state machine live in
--     the database and cannot be bypassed from the console.
--   * Card numbers, CVV, OTPs and bank passwords are never collected or stored.
--   * The payment gateway is in TEST mode (mk_settings.gateway_mode). In test mode the
--     site's "test checkout" calls mk_test_payment, which feeds the same idempotent
--     mk_apply_payment() that the live webhook (supabase/functions/gateway-webhook) uses.

------------------------------------------------------------
-- settings
------------------------------------------------------------
create table if not exists public.mk_settings (
  key   text primary key,
  value text not null
);
insert into public.mk_settings (key, value) values ('gateway_mode', 'test')
on conflict (key) do nothing;

------------------------------------------------------------
-- public face of a member: first name + trust score (nothing private)
------------------------------------------------------------
create table if not exists public.mk_member (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member',
  trust        numeric not null default 50,
  jobs_done    integer not null default 0
);

insert into public.mk_member (user_id, display_name)
select id, coalesce(nullif(split_part(name, ' ', 1), ''), 'Member') from public.profiles
on conflict (user_id) do nothing;

alter table public.mk_member add column if not exists email_alerts boolean not null default false;   -- opt in: email me new requests

create or replace function public.mk_member_from_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.mk_member (user_id, display_name)
  values (new.id, coalesce(nullif(split_part(new.name, ' ', 1), ''), 'Member'))
  on conflict (user_id) do update set display_name = excluded.display_name;
  return new;
end $$;
drop trigger if exists mk_member_sync on public.profiles;
create trigger mk_member_sync after insert or update of name on public.profiles
  for each row execute function public.mk_member_from_profile();

------------------------------------------------------------
-- reference data
------------------------------------------------------------
create table if not exists public.mk_airports (
  code      text primary key,
  name      text not null,
  terminals jsonb not null,         -- {"T1":["DOMESTIC"],"T3":["DOMESTIC","INTERNATIONAL"]}; empty for airports outside India
  country   text not null default 'India'
);
alter table public.mk_airports add column if not exists country text not null default 'India';
insert into public.mk_airports (code, name, terminals) values
 ('DEL','Delhi (Indira Gandhi)','{"T1":["DOMESTIC"],"T2":["DOMESTIC"],"T3":["DOMESTIC","INTERNATIONAL"]}'),
 ('BOM','Mumbai (Chhatrapati Shivaji)','{"T1":["DOMESTIC"],"T2":["DOMESTIC","INTERNATIONAL"]}'),
 ('BLR','Bengaluru (Kempegowda)','{"T1":["DOMESTIC"],"T2":["DOMESTIC","INTERNATIONAL"]}'),
 ('HYD','Hyderabad (Rajiv Gandhi)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('MAA','Chennai','{"T1":["DOMESTIC"],"T2":["INTERNATIONAL"],"T4":["DOMESTIC"]}'),
 ('CCU','Kolkata (Netaji Subhas)','{"T2":["DOMESTIC","INTERNATIONAL"]}'),
 ('AMD','Ahmedabad (Sardar Vallabhbhai Patel)','{"T1":["DOMESTIC"],"T2":["INTERNATIONAL"]}'),
 ('PNQ','Pune','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('COK','Kochi','{"T3":["DOMESTIC","INTERNATIONAL"]}'),
 ('GOI','Goa (Dabolim)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('GOX','Goa (Mopa, Manohar International)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('JAI','Jaipur','{"T2":["DOMESTIC","INTERNATIONAL"]}'),
 ('LKO','Lucknow (Chaudhary Charan Singh)','{"T3":["DOMESTIC","INTERNATIONAL"]}'),
 ('TRV','Thiruvananthapuram','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('CCJ','Kozhikode (Calicut)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('CJB','Coimbatore','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('IXE','Mangaluru','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('TRZ','Tiruchirappalli','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('VTZ','Visakhapatnam','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('ATQ','Amritsar (Sri Guru Ram Dass Jee)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('IXC','Chandigarh','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('SXR','Srinagar','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('GAU','Guwahati (Lokpriya Gopinath Bordoloi)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('VNS','Varanasi (Lal Bahadur Shastri)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('NAG','Nagpur (Dr. Babasaheb Ambedkar)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('IDR','Indore (Devi Ahilyabai Holkar)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('BBI','Bhubaneswar (Biju Patnaik)','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('IXB','Bagdogra','{"Main":["DOMESTIC","INTERNATIONAL"]}'),
 ('PAT','Patna','{"Main":["DOMESTIC"]}'),
 ('IXR','Ranchi','{"Main":["DOMESTIC"]}'),
 ('BHO','Bhopal','{"Main":["DOMESTIC"]}'),
 ('RPR','Raipur','{"Main":["DOMESTIC"]}'),
 ('UDR','Udaipur','{"Main":["DOMESTIC"]}'),
 ('DED','Dehradun','{"Main":["DOMESTIC"]}'),
 ('JDH','Jodhpur','{"Main":["DOMESTIC"]}'),
 ('IXJ','Jammu','{"Main":["DOMESTIC"]}'),
 ('VGA','Vijayawada','{"Main":["DOMESTIC"]}')
on conflict (code) do update set name = excluded.name, terminals = excluded.terminals;

-- International lounges are at airports outside India. Terminals are typed by the buyer, so the terminal list is empty.
insert into public.mk_airports (code, name, terminals, country) values
 ('DXB','Dubai International','{}','United Arab Emirates'),
 ('DWC','Dubai Al Maktoum','{}','United Arab Emirates'),
 ('AUH','Abu Dhabi Zayed International','{}','United Arab Emirates'),
 ('SHJ','Sharjah International','{}','United Arab Emirates'),
 ('RKT','Ras Al Khaimah International','{}','United Arab Emirates'),
 ('DOH','Doha Hamad International','{}','Qatar'),
 ('RUH','Riyadh King Khalid International','{}','Saudi Arabia'),
 ('JED','Jeddah King Abdulaziz International','{}','Saudi Arabia'),
 ('DMM','Dammam King Fahd International','{}','Saudi Arabia'),
 ('MED','Madinah Prince Mohammad bin Abdulaziz','{}','Saudi Arabia'),
 ('MCT','Muscat International','{}','Oman'),
 ('SLL','Salalah','{}','Oman'),
 ('KWI','Kuwait International','{}','Kuwait'),
 ('BAH','Bahrain International','{}','Bahrain'),
 ('TLV','Tel Aviv Ben Gurion','{}','Israel'),
 ('AMM','Amman Queen Alia International','{}','Jordan'),
 ('BEY','Beirut Rafic Hariri International','{}','Lebanon'),
 ('IST','Istanbul Airport','{}','Turkey'),
 ('SAW','Istanbul Sabiha Gokcen','{}','Turkey'),
 ('AYT','Antalya','{}','Turkey'),
 ('ESB','Ankara Esenboga','{}','Turkey'),
 ('ADB','Izmir Adnan Menderes','{}','Turkey'),
 ('DLM','Dalaman','{}','Turkey'),
 ('BJV','Bodrum Milas','{}','Turkey'),
 ('CAI','Cairo International','{}','Egypt'),
 ('HRG','Hurghada','{}','Egypt'),
 ('SSH','Sharm El Sheikh','{}','Egypt'),
 ('TBS','Tbilisi International','{}','Georgia'),
 ('EVN','Yerevan Zvartnots','{}','Armenia'),
 ('GYD','Baku Heydar Aliyev','{}','Azerbaijan'),
 ('TAS','Tashkent International','{}','Uzbekistan'),
 ('ALA','Almaty International','{}','Kazakhstan'),
 ('NQZ','Astana Nursultan Nazarbayev','{}','Kazakhstan'),
 ('SIN','Singapore Changi','{}','Singapore'),
 ('KUL','Kuala Lumpur International','{}','Malaysia'),
 ('PEN','Penang International','{}','Malaysia'),
 ('LGK','Langkawi','{}','Malaysia'),
 ('BKI','Kota Kinabalu','{}','Malaysia'),
 ('BKK','Bangkok Suvarnabhumi','{}','Thailand'),
 ('DMK','Bangkok Don Mueang','{}','Thailand'),
 ('HKT','Phuket International','{}','Thailand'),
 ('CNX','Chiang Mai International','{}','Thailand'),
 ('USM','Koh Samui','{}','Thailand'),
 ('KBV','Krabi','{}','Thailand'),
 ('CGK','Jakarta Soekarno-Hatta','{}','Indonesia'),
 ('DPS','Bali Ngurah Rai','{}','Indonesia'),
 ('SUB','Surabaya Juanda','{}','Indonesia'),
 ('JOG','Yogyakarta International','{}','Indonesia'),
 ('SGN','Ho Chi Minh City Tan Son Nhat','{}','Vietnam'),
 ('HAN','Hanoi Noi Bai','{}','Vietnam'),
 ('DAD','Da Nang International','{}','Vietnam'),
 ('CXR','Nha Trang Cam Ranh','{}','Vietnam'),
 ('MNL','Manila Ninoy Aquino','{}','Philippines'),
 ('CEB','Cebu Mactan','{}','Philippines'),
 ('CRK','Clark International','{}','Philippines'),
 ('PNH','Phnom Penh International','{}','Cambodia'),
 ('REP','Siem Reap Angkor International','{}','Cambodia'),
 ('RGN','Yangon International','{}','Myanmar'),
 ('VTE','Vientiane Wattay','{}','Laos'),
 ('BWN','Brunei International','{}','Brunei'),
 ('HKG','Hong Kong International','{}','Hong Kong'),
 ('MFM','Macau International','{}','Macau'),
 ('PEK','Beijing Capital','{}','China'),
 ('PKX','Beijing Daxing','{}','China'),
 ('PVG','Shanghai Pudong','{}','China'),
 ('SHA','Shanghai Hongqiao','{}','China'),
 ('CAN','Guangzhou Baiyun','{}','China'),
 ('SZX','Shenzhen Bao an','{}','China'),
 ('CTU','Chengdu Shuangliu','{}','China'),
 ('TFU','Chengdu Tianfu','{}','China'),
 ('KMG','Kunming Changshui','{}','China'),
 ('XIY','Xian Xianyang','{}','China'),
 ('HGH','Hangzhou Xiaoshan','{}','China'),
 ('CKG','Chongqing Jiangbei','{}','China'),
 ('NKG','Nanjing Lukou','{}','China'),
 ('WUH','Wuhan Tianhe','{}','China'),
 ('XMN','Xiamen Gaoqi','{}','China'),
 ('TAO','Qingdao Jiaodong','{}','China'),
 ('TPE','Taipei Taoyuan','{}','Taiwan'),
 ('TSA','Taipei Songshan','{}','Taiwan'),
 ('KHH','Kaohsiung International','{}','Taiwan'),
 ('NRT','Tokyo Narita','{}','Japan'),
 ('HND','Tokyo Haneda','{}','Japan'),
 ('KIX','Osaka Kansai','{}','Japan'),
 ('ITM','Osaka Itami','{}','Japan'),
 ('NGO','Nagoya Chubu Centrair','{}','Japan'),
 ('FUK','Fukuoka','{}','Japan'),
 ('CTS','Sapporo New Chitose','{}','Japan'),
 ('OKA','Okinawa Naha','{}','Japan'),
 ('ICN','Seoul Incheon','{}','South Korea'),
 ('GMP','Seoul Gimpo','{}','South Korea'),
 ('PUS','Busan Gimhae','{}','South Korea'),
 ('CJU','Jeju International','{}','South Korea'),
 ('ULN','Ulaanbaatar Chinggis Khaan','{}','Mongolia'),
 ('CMB','Colombo Bandaranaike','{}','Sri Lanka'),
 ('HRI','Hambantota Mattala','{}','Sri Lanka'),
 ('MLE','Male Velana International','{}','Maldives'),
 ('KTM','Kathmandu Tribhuvan','{}','Nepal'),
 ('PKR','Pokhara International','{}','Nepal'),
 ('DAC','Dhaka Hazrat Shahjalal','{}','Bangladesh'),
 ('CGP','Chattogram Shah Amanat','{}','Bangladesh'),
 ('PBH','Paro International','{}','Bhutan'),
 ('ISB','Islamabad International','{}','Pakistan'),
 ('KHI','Karachi Jinnah','{}','Pakistan'),
 ('LHE','Lahore Allama Iqbal','{}','Pakistan'),
 ('KBL','Kabul Hamid Karzai','{}','Afghanistan'),
 ('LHR','London Heathrow','{}','United Kingdom'),
 ('LGW','London Gatwick','{}','United Kingdom'),
 ('STN','London Stansted','{}','United Kingdom'),
 ('LTN','London Luton','{}','United Kingdom'),
 ('LCY','London City','{}','United Kingdom'),
 ('MAN','Manchester','{}','United Kingdom'),
 ('BHX','Birmingham','{}','United Kingdom'),
 ('EDI','Edinburgh','{}','United Kingdom'),
 ('GLA','Glasgow','{}','United Kingdom'),
 ('BRS','Bristol','{}','United Kingdom'),
 ('NCL','Newcastle','{}','United Kingdom'),
 ('LBA','Leeds Bradford','{}','United Kingdom'),
 ('DUB','Dublin','{}','Ireland'),
 ('SNN','Shannon','{}','Ireland'),
 ('ORK','Cork','{}','Ireland'),
 ('CDG','Paris Charles de Gaulle','{}','France'),
 ('ORY','Paris Orly','{}','France'),
 ('NCE','Nice Cote d Azur','{}','France'),
 ('LYS','Lyon Saint-Exupery','{}','France'),
 ('MRS','Marseille Provence','{}','France'),
 ('TLS','Toulouse Blagnac','{}','France'),
 ('AMS','Amsterdam Schiphol','{}','Netherlands'),
 ('FRA','Frankfurt','{}','Germany'),
 ('MUC','Munich','{}','Germany'),
 ('BER','Berlin Brandenburg','{}','Germany'),
 ('DUS','Dusseldorf','{}','Germany'),
 ('HAM','Hamburg','{}','Germany'),
 ('CGN','Cologne Bonn','{}','Germany'),
 ('STR','Stuttgart','{}','Germany'),
 ('ZRH','Zurich','{}','Switzerland'),
 ('GVA','Geneva','{}','Switzerland'),
 ('BSL','Basel Mulhouse','{}','Switzerland'),
 ('VIE','Vienna International','{}','Austria'),
 ('BRU','Brussels','{}','Belgium'),
 ('LUX','Luxembourg Findel','{}','Luxembourg'),
 ('CPH','Copenhagen Kastrup','{}','Denmark'),
 ('ARN','Stockholm Arlanda','{}','Sweden'),
 ('GOT','Gothenburg Landvetter','{}','Sweden'),
 ('OSL','Oslo Gardermoen','{}','Norway'),
 ('BGO','Bergen Flesland','{}','Norway'),
 ('HEL','Helsinki Vantaa','{}','Finland'),
 ('KEF','Reykjavik Keflavik','{}','Iceland'),
 ('MAD','Madrid Barajas','{}','Spain'),
 ('BCN','Barcelona El Prat','{}','Spain'),
 ('AGP','Malaga Costa del Sol','{}','Spain'),
 ('PMI','Palma de Mallorca','{}','Spain'),
 ('VLC','Valencia','{}','Spain'),
 ('ALC','Alicante','{}','Spain'),
 ('TFS','Tenerife South','{}','Spain'),
 ('LIS','Lisbon Humberto Delgado','{}','Portugal'),
 ('OPO','Porto Francisco Sa Carneiro','{}','Portugal'),
 ('FAO','Faro','{}','Portugal'),
 ('FCO','Rome Fiumicino','{}','Italy'),
 ('MXP','Milan Malpensa','{}','Italy'),
 ('LIN','Milan Linate','{}','Italy'),
 ('VCE','Venice Marco Polo','{}','Italy'),
 ('NAP','Naples','{}','Italy'),
 ('BLQ','Bologna','{}','Italy'),
 ('FLR','Florence','{}','Italy'),
 ('CTA','Catania','{}','Italy'),
 ('ATH','Athens Eleftherios Venizelos','{}','Greece'),
 ('SKG','Thessaloniki','{}','Greece'),
 ('HER','Heraklion','{}','Greece'),
 ('JMK','Mykonos','{}','Greece'),
 ('MLA','Malta International','{}','Malta'),
 ('LCA','Larnaca','{}','Cyprus'),
 ('PRG','Prague Vaclav Havel','{}','Czech Republic'),
 ('WAW','Warsaw Chopin','{}','Poland'),
 ('KRK','Krakow John Paul II','{}','Poland'),
 ('BUD','Budapest Ferenc Liszt','{}','Hungary'),
 ('OTP','Bucharest Henri Coanda','{}','Romania'),
 ('SOF','Sofia','{}','Bulgaria'),
 ('BEG','Belgrade Nikola Tesla','{}','Serbia'),
 ('ZAG','Zagreb Franjo Tudman','{}','Croatia'),
 ('SPU','Split','{}','Croatia'),
 ('SVO','Moscow Sheremetyevo','{}','Russia'),
 ('DME','Moscow Domodedovo','{}','Russia'),
 ('VKO','Moscow Vnukovo','{}','Russia'),
 ('LED','Saint Petersburg Pulkovo','{}','Russia'),
 ('JNB','Johannesburg O R Tambo','{}','South Africa'),
 ('CPT','Cape Town International','{}','South Africa'),
 ('DUR','Durban King Shaka','{}','South Africa'),
 ('NBO','Nairobi Jomo Kenyatta','{}','Kenya'),
 ('MBA','Mombasa Moi','{}','Kenya'),
 ('ADD','Addis Ababa Bole','{}','Ethiopia'),
 ('LOS','Lagos Murtala Muhammed','{}','Nigeria'),
 ('ABV','Abuja Nnamdi Azikiwe','{}','Nigeria'),
 ('ACC','Accra Kotoka','{}','Ghana'),
 ('CMN','Casablanca Mohammed V','{}','Morocco'),
 ('RAK','Marrakesh Menara','{}','Morocco'),
 ('ALG','Algiers Houari Boumediene','{}','Algeria'),
 ('TUN','Tunis Carthage','{}','Tunisia'),
 ('DAR','Dar es Salaam Julius Nyerere','{}','Tanzania'),
 ('ZNZ','Zanzibar Abeid Amani Karume','{}','Tanzania'),
 ('JRO','Kilimanjaro','{}','Tanzania'),
 ('EBB','Entebbe International','{}','Uganda'),
 ('KGL','Kigali International','{}','Rwanda'),
 ('LUN','Lusaka Kenneth Kaunda','{}','Zambia'),
 ('HRE','Harare Robert Gabriel Mugabe','{}','Zimbabwe'),
 ('MRU','Mauritius Sir Seewoosagur Ramgoolam','{}','Mauritius'),
 ('SEZ','Mahe Seychelles International','{}','Seychelles'),
 ('JFK','New York John F Kennedy','{}','United States'),
 ('EWR','Newark Liberty','{}','United States'),
 ('LGA','New York LaGuardia','{}','United States'),
 ('BOS','Boston Logan','{}','United States'),
 ('IAD','Washington Dulles','{}','United States'),
 ('DCA','Washington Reagan','{}','United States'),
 ('ORD','Chicago O Hare','{}','United States'),
 ('MDW','Chicago Midway','{}','United States'),
 ('ATL','Atlanta Hartsfield-Jackson','{}','United States'),
 ('MIA','Miami International','{}','United States'),
 ('MCO','Orlando International','{}','United States'),
 ('FLL','Fort Lauderdale','{}','United States'),
 ('DFW','Dallas Fort Worth','{}','United States'),
 ('IAH','Houston George Bush','{}','United States'),
 ('DEN','Denver International','{}','United States'),
 ('LAX','Los Angeles International','{}','United States'),
 ('SFO','San Francisco International','{}','United States'),
 ('SJC','San Jose Mineta','{}','United States'),
 ('SEA','Seattle-Tacoma','{}','United States'),
 ('LAS','Las Vegas Harry Reid','{}','United States'),
 ('PHX','Phoenix Sky Harbor','{}','United States'),
 ('SAN','San Diego International','{}','United States'),
 ('MSP','Minneapolis Saint Paul','{}','United States'),
 ('DTW','Detroit Metropolitan','{}','United States'),
 ('PHL','Philadelphia International','{}','United States'),
 ('CLT','Charlotte Douglas','{}','United States'),
 ('BWI','Baltimore Washington','{}','United States'),
 ('HNL','Honolulu Daniel K Inouye','{}','United States'),
 ('ANC','Anchorage Ted Stevens','{}','United States'),
 ('YYZ','Toronto Pearson','{}','Canada'),
 ('YVR','Vancouver International','{}','Canada'),
 ('YUL','Montreal Trudeau','{}','Canada'),
 ('YYC','Calgary International','{}','Canada'),
 ('YOW','Ottawa Macdonald-Cartier','{}','Canada'),
 ('YEG','Edmonton International','{}','Canada'),
 ('MEX','Mexico City Benito Juarez','{}','Mexico'),
 ('CUN','Cancun International','{}','Mexico'),
 ('GDL','Guadalajara','{}','Mexico'),
 ('SJD','Los Cabos International','{}','Mexico'),
 ('PTY','Panama City Tocumen','{}','Panama'),
 ('SJO','San Jose Juan Santamaria','{}','Costa Rica'),
 ('HAV','Havana Jose Marti','{}','Cuba'),
 ('NAS','Nassau Lynden Pindling','{}','Bahamas'),
 ('MBJ','Montego Bay Sangster','{}','Jamaica'),
 ('PUJ','Punta Cana International','{}','Dominican Republic'),
 ('GRU','Sao Paulo Guarulhos','{}','Brazil'),
 ('GIG','Rio de Janeiro Galeao','{}','Brazil'),
 ('BSB','Brasilia','{}','Brazil'),
 ('EZE','Buenos Aires Ezeiza','{}','Argentina'),
 ('SCL','Santiago Arturo Merino Benitez','{}','Chile'),
 ('BOG','Bogota El Dorado','{}','Colombia'),
 ('LIM','Lima Jorge Chavez','{}','Peru'),
 ('UIO','Quito Mariscal Sucre','{}','Ecuador'),
 ('MVD','Montevideo Carrasco','{}','Uruguay'),
 ('SYD','Sydney Kingsford Smith','{}','Australia'),
 ('MEL','Melbourne Tullamarine','{}','Australia'),
 ('BNE','Brisbane','{}','Australia'),
 ('PER','Perth','{}','Australia'),
 ('ADL','Adelaide','{}','Australia'),
 ('CBR','Canberra','{}','Australia'),
 ('OOL','Gold Coast','{}','Australia'),
 ('CNS','Cairns','{}','Australia'),
 ('AKL','Auckland','{}','New Zealand'),
 ('CHC','Christchurch','{}','New Zealand'),
 ('WLG','Wellington','{}','New Zealand'),
 ('ZQN','Queenstown','{}','New Zealand'),
 ('NAN','Nadi International','{}','Fiji'),
 ('PPT','Tahiti Faaa','{}','French Polynesia')
on conflict (code) do update set name = excluded.name, country = excluded.country;

-- Admin-editable pricing. FIXED rows use fee + platform_amt (rupees).
-- PERCENT rows use fee_pct of the price after the offer (at least min_fee) + platform_pct (share of the fee).
create table if not exists public.mk_fee_config (
  id            text primary key,
  module        text not null check (module in ('LOUNGE','MOVIE','ORDER','PAY')),
  subtype       text not null,
  label         text not null,
  mode          text not null check (mode in ('FIXED','PERCENT')),
  fee           numeric, fee_pct numeric, min_fee numeric,
  platform_amt  numeric, platform_pct numeric,
  discount      numeric, cap numeric,
  accept_hours  numeric not null default 12,
  confirm_hours numeric not null default 6,
  penalty       numeric not null default 0,
  active        boolean not null default true,
  unique (module, subtype)
);

insert into public.mk_fee_config (id, module, subtype, label, mode, fee, fee_pct, min_fee, platform_amt, platform_pct, discount, cap, accept_hours, confirm_hours, penalty) values
 ('fee-lounge-dom',  'LOUNGE','DOMESTIC',             'Domestic lounge',        'FIXED',   500,  null, null, 200,  null, null, null, 12,  6,   100),
 ('fee-lounge-intl', 'LOUNGE','INTERNATIONAL',        'International lounge',   'FIXED',   1000, null, null, 500,  null, null, null, 12,  6,   200),
 ('fee-movie-flat',  'MOVIE', 'FLAT_500_OFF_2_SEATS', '₹500 off on 2 seats',    'FIXED',   300,  null, null, 100,  null, 500,  null, 12,  3,   100),
 ('fee-movie-bogo',  'MOVIE', 'BOGO',                 'Buy one get one',        'FIXED',   300,  null, null, 100,  null, null, 0,    12,  3,   100),
 ('fee-order',       'ORDER', 'DEFAULT',              'Order & Earn',           'PERCENT', null, 6,    49,   null, 40,   null, null, 24,  168, 150),
 ('fee-pay',         'PAY',   'DEFAULT',              'Pay & Earn',             'PERCENT', null, 4,    39,   null, 40,   null, null, 12,  24,  100)
on conflict (id) do nothing;

-- SPLIT pricing for Lounge, Order & Earn and Pay & Earn: the discount (for lounges, the usual entry price
-- that the card benefit waives) is shared buyer_pct / holder_pct / platform_pct (default 40 / 30 / 30).
-- The buyer pays the full price minus their own share. Movie offers keep their fixed fees.
alter table public.mk_fee_config add column if not exists buyer_pct  numeric;
alter table public.mk_fee_config add column if not exists holder_pct numeric;
alter table public.mk_fee_config add column if not exists list_value numeric;
alter table public.mk_fee_config drop constraint if exists mk_fee_config_mode_check;
alter table public.mk_fee_config add constraint mk_fee_config_mode_check check (mode in ('FIXED','PERCENT','SPLIT'));

-- Lounges: a fixed price (domestic 500, international 1000) split 50/50 with the platform. list_value is the usual
-- entry price shown as the buyer's saving. Runs once per row (while list_value is empty or the row is still on
-- SPLIT), so later admin edits are never overwritten.
update public.mk_fee_config set mode = 'FIXED', fee = 500, platform_amt = 250, list_value = 1500,
  buyer_pct = null, holder_pct = null, platform_pct = null where id = 'fee-lounge-dom'  and (list_value is null or mode = 'SPLIT');
update public.mk_fee_config set mode = 'FIXED', fee = 1000, platform_amt = 500, list_value = 2500,
  buyer_pct = null, holder_pct = null, platform_pct = null where id = 'fee-lounge-intl' and (list_value is null or mode = 'SPLIT');
-- Order & Earn and Pay & Earn: the discount is shared 40% buyer / 30% cardholder / 30% platform.
update public.mk_fee_config set mode = 'SPLIT', buyer_pct = 40, holder_pct = 30, platform_pct = 30,
  fee = null, fee_pct = null, min_fee = null, platform_amt = null where id in ('fee-order', 'fee-pay') and mode <> 'SPLIT';

------------------------------------------------------------
-- cardholder side: cards (bank + variant + benefits only), KYC
------------------------------------------------------------
create table if not exists public.mk_cards (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  bank       text not null,
  variant    text not null,
  network    text not null default '',
  benefits   jsonb not null default '[]'::jsonb,   -- [{kind, program, quota, airports[], note}]
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mk_kyc (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  status      text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  legal_name  text not null,
  pan         text not null,        -- recommended: move to Supabase Vault / pgsodium for encryption at rest
  upi         text not null default '',
  account     text not null default '',
  ifsc        text not null default '',
  review_note text not null default '',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);

------------------------------------------------------------
-- requests
------------------------------------------------------------
create table if not exists public.mk_requests (
  id                 uuid primary key default gen_random_uuid(),
  module             text not null check (module in ('LOUNGE','MOVIE','ORDER','PAY')),
  subtype            text not null,
  buyer_id           uuid not null references auth.users(id),
  cardholder_id      uuid references auth.users(id),
  card_id            uuid references public.mk_cards(id) on delete set null,
  status             text not null default 'CREATED' check (status in
                     ('CREATED','PAID','ACCEPTED','FULFILLED','CONFIRMED','SETTLED','EXPIRED','CANCELLED','DISPUTED','REFUNDED')),
  details            jsonb not null,
  fee_snapshot       jsonb not null,        -- frozen price and split, later fee changes never touch it
  gateway_order_id   text,
  topup_order_id     text,
  gateway_payment_id text,
  ref                text,
  actual             numeric,
  topup_due          numeric not null default 0,
  topup_paid         numeric not null default 0,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz,
  accept_by          timestamptz,
  accepted_at        timestamptz,
  fulfil_by          timestamptz,
  fulfilled_at       timestamptz,
  auto_confirm_at    timestamptz,
  confirmed_at       timestamptz,
  settle_at          timestamptz,
  settled_at         timestamptz,
  refunded_at        timestamptz,
  penalty_applied    numeric not null default 0,
  closed_reason      text,
  version            integer not null default 0
);
create index if not exists mk_requests_buyer_idx  on public.mk_requests(buyer_id);
create index if not exists mk_requests_holder_idx on public.mk_requests(cardholder_id);
create index if not exists mk_requests_status_idx on public.mk_requests(status);
create unique index if not exists mk_requests_order_idx on public.mk_requests(gateway_order_id) where gateway_order_id is not null;
create unique index if not exists mk_requests_topup_idx on public.mk_requests(topup_order_id)   where topup_order_id is not null;

create table if not exists public.mk_quota_use (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.mk_cards(id) on delete cascade,
  kind       text not null,
  quarter    text not null,                -- e.g. 2027-Q1, from the lounge visit date
  request_id uuid not null references public.mk_requests(id) on delete cascade
);
create index if not exists mk_quota_card_idx on public.mk_quota_use(card_id, kind, quarter);

create table if not exists public.mk_proofs (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.mk_requests(id) on delete cascade,
  uploader_id uuid not null references auth.users(id),
  kind        text not null default 'PROOF' check (kind in ('PROOF','EVIDENCE')),
  name        text not null default '',
  path        text,                         -- storage path in the private mk-proofs bucket
  created_at  timestamptz not null default now()
);

create table if not exists public.mk_messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mk_requests(id) on delete cascade,
  sender_id  uuid not null references auth.users(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists mk_messages_req_idx on public.mk_messages(request_id, created_at);

create table if not exists public.mk_disputes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.mk_requests(id) on delete cascade,
  raised_by   uuid not null references auth.users(id),
  reason      text not null,
  note        text not null default '',
  status      text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  resolution  text,
  prev_status text,
  resolved_by uuid references auth.users(id),
  admin_note  text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.mk_ratings (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mk_requests(id) on delete cascade,
  rater_id   uuid not null references auth.users(id),
  ratee_id   uuid not null references auth.users(id),
  stars      integer not null check (stars between 1 and 5),
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (request_id, rater_id)
);

create table if not exists public.mk_trust_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  delta      numeric not null,
  reason     text not null,
  request_id uuid,
  at         timestamptz not null default now()
);

-- double-entry ledger: append-only, every txn_id must balance (enforced in mk_post)
create table if not exists public.mk_ledger (
  id         uuid primary key default gen_random_uuid(),
  txn_id     uuid not null,
  request_id uuid references public.mk_requests(id),
  kind       text not null check (kind in ('ESCROW_IN','REIMBURSEMENT','PLATFORM_FEE','CARDHOLDER_EARNING','REFUND','PENALTY','PAYOUT','SETTLEMENT')),
  account    text not null,            -- escrow | platform | holder:<uid> | external:buyer:<uid> | external:payout:<uid>
  debit      numeric not null default 0 check (debit >= 0),
  credit     numeric not null default 0 check (credit >= 0),
  note       text not null default '',
  at         timestamptz not null default now()
);
create index if not exists mk_ledger_req_idx on public.mk_ledger(request_id);
create index if not exists mk_ledger_acct_idx on public.mk_ledger(account);

create table if not exists public.mk_payouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id),
  amount       numeric not null check (amount > 0),
  method       text not null,
  destination  text not null,
  status       text not null default 'REQUESTED' check (status in ('REQUESTED','PAID','REJECTED')),
  ref          text,
  note         text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.mk_webhook_events (
  event_id     text primary key,        -- idempotency key
  type         text not null,
  payload      jsonb not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.mk_audit_log (
  id        uuid primary key default gen_random_uuid(),
  actor     text,
  action    text not null,
  entity    text not null,
  entity_id text,
  diff      jsonb not null default '{}'::jsonb,
  at        timestamptz not null default now()
);

-- email / WhatsApp / SMS queue. A sender (Edge Function, n8n, etc.) reads QUEUED rows.
create table if not exists public.mk_outbox (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  channel    text not null check (channel in ('email','whatsapp','sms')),
  title      text not null,
  body       text not null,
  request_id uuid,
  status     text not null default 'QUEUED' check (status in ('QUEUED','SENT','FAILED')),
  created_at timestamptz not null default now()
);

------------------------------------------------------------
-- row level security: read only for the browser
------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['mk_settings','mk_member','mk_airports','mk_fee_config','mk_cards','mk_kyc','mk_requests','mk_quota_use',
    'mk_proofs','mk_messages','mk_disputes','mk_ratings','mk_trust_events','mk_ledger','mk_payouts','mk_webhook_events','mk_audit_log','mk_outbox']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create or replace function public.mk_in_request(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mk_requests r
                 where r.id = rid and (r.buyer_id = auth.uid() or r.cardholder_id = auth.uid()))
         or public.is_admin();
$$;

grant select on public.mk_member, public.mk_airports, public.mk_fee_config to authenticated;
grant select on public.mk_cards, public.mk_kyc, public.mk_requests, public.mk_quota_use, public.mk_proofs, public.mk_messages,
                public.mk_disputes, public.mk_ratings, public.mk_trust_events, public.mk_ledger, public.mk_payouts,
                public.mk_audit_log, public.mk_outbox to authenticated;

drop policy if exists "mk_member read" on public.mk_member;
create policy "mk_member read" on public.mk_member for select to authenticated using (true);
drop policy if exists "mk_airports read" on public.mk_airports;
create policy "mk_airports read" on public.mk_airports for select to authenticated using (true);
drop policy if exists "mk_fee read" on public.mk_fee_config;
create policy "mk_fee read" on public.mk_fee_config for select to authenticated using (true);

drop policy if exists "mk_cards read" on public.mk_cards;
create policy "mk_cards read" on public.mk_cards for select to authenticated using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "mk_kyc read" on public.mk_kyc;
create policy "mk_kyc read" on public.mk_kyc for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "mk_requests read" on public.mk_requests;
create policy "mk_requests read" on public.mk_requests for select to authenticated
  using (buyer_id = auth.uid() or cardholder_id = auth.uid() or public.is_admin());
drop policy if exists "mk_quota read" on public.mk_quota_use;
create policy "mk_quota read" on public.mk_quota_use for select to authenticated
  using (public.is_admin() or exists (select 1 from public.mk_cards c where c.id = card_id and c.owner_id = auth.uid()));
drop policy if exists "mk_proofs read" on public.mk_proofs;
create policy "mk_proofs read" on public.mk_proofs for select to authenticated using (public.mk_in_request(request_id));
drop policy if exists "mk_messages read" on public.mk_messages;
create policy "mk_messages read" on public.mk_messages for select to authenticated using (public.mk_in_request(request_id));
drop policy if exists "mk_disputes read" on public.mk_disputes;
create policy "mk_disputes read" on public.mk_disputes for select to authenticated using (public.mk_in_request(request_id));
drop policy if exists "mk_ratings read" on public.mk_ratings;
create policy "mk_ratings read" on public.mk_ratings for select to authenticated using (public.mk_in_request(request_id));
drop policy if exists "mk_trust read" on public.mk_trust_events;
create policy "mk_trust read" on public.mk_trust_events for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "mk_ledger read" on public.mk_ledger;
create policy "mk_ledger read" on public.mk_ledger for select to authenticated
  using (public.is_admin() or account = 'holder:' || auth.uid()::text or (request_id is not null and public.mk_in_request(request_id)));
drop policy if exists "mk_payouts read" on public.mk_payouts;
create policy "mk_payouts read" on public.mk_payouts for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "mk_audit read" on public.mk_audit_log;
create policy "mk_audit read" on public.mk_audit_log for select to authenticated using (public.is_admin());
drop policy if exists "mk_outbox read" on public.mk_outbox;
create policy "mk_outbox read" on public.mk_outbox for select to authenticated using (public.is_admin());

------------------------------------------------------------
-- private bucket for proofs and tickets
------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mk-proofs', 'mk-proofs', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "mk-proofs: owner upload" on storage.objects;
create policy "mk-proofs: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'mk-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "mk-proofs: participants read" on storage.objects;
create policy "mk-proofs: participants read" on storage.objects for select to authenticated
  using (bucket_id = 'mk-proofs' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.mk_requests r
               where r.id::text = (storage.foldername(name))[2] and (r.buyer_id = auth.uid() or r.cardholder_id = auth.uid()))
  ));

------------------------------------------------------------
-- internal helpers (not callable from the browser)
------------------------------------------------------------
create or replace function public.mk_me()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign in to continue.'; end if;
  if exists (select 1 from public.profiles where id = u and active = false) then
    raise exception 'This account is switched off. Contact support.';
  end if;
  return u;
end $$;

create or replace function public.mk_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only staff can do that.'; end if;
  return auth.uid();
end $$;

create or replace function public.mk_audit(actor text, action text, entity text, eid text, diff jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.mk_audit_log (actor, action, entity, entity_id, diff) values (actor, action, entity, eid, coalesce(diff, '{}'));
$$;

create or replace function public.mk_money(n numeric) returns text language sql immutable as $$
  select '₹' || trim(to_char(round(n), 'FM99,99,99,999'));
$$;

-- in-app notification + queued email and WhatsApp
-- Email goes only for the buyer's payment confirmation here, and for new-request alerts (mk_notify_open below).
create or replace function public.mk_notify(uid uuid, title text, body text, rid uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if uid is null then return; end if;
  insert into public.notifications (id, user_id, type, title, body)
  values ('ntf-' || replace(gen_random_uuid()::text, '-', ''), uid, 'market', title, body);
  insert into public.mk_outbox (user_id, channel, title, body, request_id)
  values (uid, 'whatsapp', title, body, rid);
  if title = 'Payment held safely' then
    insert into public.mk_outbox (user_id, channel, title, body, request_id)
    select uid, 'email', title, body, rid where exists (select 1 from public.mk_member m where m.user_id = uid and m.email_alerts);
  end if;
end $$;

create or replace function public.mk_recalc_member(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare score numeric;
begin
  score := 50
    + coalesce((select sum((stars - 3) * 5) from public.mk_ratings where ratee_id = uid), 0)
    + coalesce((select sum(delta) from public.mk_trust_events where user_id = uid), 0);
  insert into public.mk_member (user_id, trust, jobs_done)
  values (uid, greatest(0, least(100, score)),
          (select count(*) from public.mk_requests where status = 'SETTLED' and (buyer_id = uid or cardholder_id = uid)))
  on conflict (user_id) do update set trust = excluded.trust, jobs_done = excluded.jobs_done;
end $$;

create or replace function public.mk_trust(uid uuid, delta numeric, reason text, rid uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if uid is null then return; end if;
  insert into public.mk_trust_events (user_id, delta, reason, request_id) values (uid, delta, reason, rid);
  perform public.mk_recalc_member(uid);
end $$;

-- allowed status moves, same table as js/services/marketCore.js
create or replace function public.mk_can(a text, b text)
returns boolean language sql immutable as $$
  select case a
    when 'CREATED'   then b in ('PAID','CANCELLED')
    when 'PAID'      then b in ('ACCEPTED','EXPIRED','CANCELLED')
    when 'ACCEPTED'  then b in ('FULFILLED','PAID','DISPUTED','REFUNDED')
    when 'FULFILLED' then b in ('CONFIRMED','DISPUTED','REFUNDED')
    when 'CONFIRMED' then b in ('SETTLED')
    when 'DISPUTED'  then b in ('SETTLED','REFUNDED')
    when 'EXPIRED'   then b in ('REFUNDED')
    when 'CANCELLED' then b in ('REFUNDED')
    else false end;
$$;

-- the only place status changes
create or replace function public.mk_go(rid uuid, to_status text, actor text, note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  select status into cur from public.mk_requests where id = rid for update;
  if not public.mk_can(cur, to_status) then
    raise exception 'This request cannot move from % to %.', cur, to_status;
  end if;
  update public.mk_requests set status = to_status, version = version + 1 where id = rid;
  perform public.mk_audit(actor, 'status', 'request', rid::text, jsonb_build_object('from', cur, 'to', to_status, 'note', note));
end $$;

-- double-entry posting. lines: [{account, debit, credit, kind}]
create or replace function public.mk_post(rid uuid, kind text, lines jsonb, note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare dr numeric := 0; cr numeric := 0; l jsonb; tx uuid := gen_random_uuid();
begin
  for l in select * from jsonb_array_elements(lines) loop
    dr := dr + coalesce((l->>'debit')::numeric, 0);
    cr := cr + coalesce((l->>'credit')::numeric, 0);
  end loop;
  if abs(dr - cr) > 0.005 then raise exception 'Ledger entry does not balance.'; end if;
  for l in select * from jsonb_array_elements(lines) loop
    if coalesce((l->>'debit')::numeric, 0) > 0 or coalesce((l->>'credit')::numeric, 0) > 0 then
      insert into public.mk_ledger (txn_id, request_id, kind, account, debit, credit, note)
      values (tx, rid, coalesce(l->>'kind', kind), l->>'account',
              round(coalesce((l->>'debit')::numeric, 0), 2), round(coalesce((l->>'credit')::numeric, 0), 2), note);
    end if;
  end loop;
end $$;

create or replace function public.mk_escrow(rid uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(credit - debit), 0) from public.mk_ledger where request_id = rid and account = 'escrow';
$$;

create or replace function public.mk_event_time(d jsonb)
returns timestamptz language sql immutable as $$
  select coalesce(d->>'dateTime', d->>'showTime')::timestamptz;
$$;

create or replace function public.mk_quarter(ts timestamptz)
returns text language sql immutable as $$
  select to_char(ts at time zone 'Asia/Kolkata', 'YYYY') || '-Q' || to_char(ts at time zone 'Asia/Kolkata', 'Q');
$$;

------------------------------------------------------------
-- pricing (mirror of Core.quote)
------------------------------------------------------------
create or replace function public.mk_quote(c public.mk_fee_config, d jsonb)
returns jsonb language plpgsql immutable as $$
declare
  orig numeric := 0; disc numeric := 0; reimb numeric := 0; fee numeric := 0; plat numeric := 0;
  tot numeric := 0; saved numeric := null; tkt numeric; seats numeric; lst numeric; ex numeric;
  dd numeric; buyer_sh numeric; holder_sh numeric;
begin
  if coalesce((d->>'ticketTotal')::numeric, 0) > 1000000 or coalesce((d->>'listPrice')::numeric, 0) > 1000000
     or coalesce((d->>'expectedPrice')::numeric, 0) > 1000000 then
    raise exception 'Amounts above ₹10,00,000 are not supported. Check the numbers you entered.';
  end if;
  if c.mode = 'SPLIT' then
    if c.module = 'LOUNGE' then
      lst := round(c.list_value, 2); dd := lst; reimb := 0;
    else
      lst := (d->>'listPrice')::numeric; ex := (d->>'expectedPrice')::numeric;
      if lst is null or ex is null or lst <= 0 or ex <= 0 then raise exception 'Enter both prices.'; end if;
      if lst > 200000 or ex > 200000 then raise exception 'Amounts above ₹2,00,000 are not supported here. Check the numbers you entered.'; end if;
      if ex >= lst then raise exception 'The price after the card offer must be less than the listed price.'; end if;
      lst := round(lst, 2); dd := round(lst - ex, 2); reimb := round(ex, 2);
    end if;
    buyer_sh := round(dd * c.buyer_pct / 100, 2); holder_sh := round(dd * c.holder_pct / 100, 2);
    plat := round(dd - buyer_sh - holder_sh, 2); fee := round(dd - buyer_sh, 2);
    if buyer_sh <= 0 then raise exception 'The saving is too small to share. Pick a bigger discount.'; end if;
    return jsonb_build_object('original', lst, 'discount', dd, 'reimbursement', reimb, 'fee', fee, 'platform', plat,
      'holderFee', holder_sh, 'total', round(reimb + fee, 2), 'saved', buyer_sh, 'holderReceives', round(reimb + holder_sh, 2),
      'split', jsonb_build_object('buyerPct', c.buyer_pct, 'holderPct', c.holder_pct, 'platformPct', c.platform_pct, 'buyerShare', buyer_sh));
  end if;
  if c.module = 'LOUNGE' then
    fee := round(c.fee, 2); plat := round(c.platform_amt, 2); tot := fee;
    orig := case when coalesce(c.list_value, 0) > fee then round(c.list_value, 2) else fee end;   -- usual entry price
    disc := round(orig - fee, 2); saved := case when disc > 0 then disc else null end;
  elsif c.module = 'MOVIE' then
    tkt := (d->>'ticketTotal')::numeric; seats := (d->>'seatCount')::numeric;
    if tkt is null or tkt <= 0 then raise exception 'Enter the ticket total for all seats.'; end if;
    if c.subtype = 'FLAT_500_OFF_2_SEATS' then
      if seats is distinct from 2 then raise exception 'This offer works for exactly 2 seats.'; end if;
      if tkt <= c.discount then raise exception 'The ticket total must be more than ₹% for this offer.', c.discount; end if;
      disc := round(c.discount, 2);
    else
      if seats is distinct from 2 then raise exception 'Buy-one-get-one needs exactly 2 seats.'; end if;
      disc := round(tkt / 2, 2);
      if coalesce(c.cap, 0) > 0 then disc := least(disc, round(c.cap, 2)); end if;
    end if;
    orig := round(tkt, 2); reimb := round(tkt - disc, 2);
    fee := round(c.fee, 2); plat := round(c.platform_amt, 2);
    tot := round(reimb + fee, 2); saved := round(disc - fee, 2);
  else
    lst := (d->>'listPrice')::numeric; ex := (d->>'expectedPrice')::numeric;
    if lst is null or ex is null or lst <= 0 or ex <= 0 then raise exception 'Enter both prices.'; end if;
    if lst > 200000 or ex > 200000 then raise exception 'Amounts above ₹2,00,000 are not supported here. Check the numbers you entered.'; end if;
    if ex >= lst then raise exception 'The price after the card offer must be less than the listed price.'; end if;
    orig := round(lst, 2); disc := round(lst - ex, 2); reimb := round(ex, 2);
    fee := round(greatest(coalesce(c.min_fee, 0), ex * c.fee_pct / 100), 2);
    plat := round(fee * c.platform_pct / 100, 2);
    tot := round(reimb + fee, 2); saved := round(lst - tot, 2);
  end if;
  if saved is not null and saved <= 0 then
    raise exception 'After the service fee this deal would not save you anything, so it cannot be booked.';
  end if;
  return jsonb_build_object('original', orig, 'discount', disc, 'reimbursement', reimb, 'fee', fee, 'platform', plat,
    'holderFee', round(fee - plat, 2), 'total', tot, 'saved', saved, 'holderReceives', round(reimb + fee - plat, 2));
end $$;

-- validate and tidy a new request (mirror of Core.cleanRequest). Returns the clean details.
create or replace function public.mk_clean_request(m text, d jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ap record; t timestamptz; out jsonb; a jsonb;
  typ text := trim(coalesce(d->>'type', '')); term text := trim(coalesce(d->>'terminal', ''));
begin
  if m = 'LOUNGE' then
    select * into ap from public.mk_airports where code = trim(coalesce(d->>'airport', ''));
    if typ not in ('DOMESTIC', 'INTERNATIONAL') then raise exception 'Choose domestic or international.'; end if;
    if not found then raise exception 'Choose an airport.'; end if;
    if typ = 'DOMESTIC' then
      if ap.country <> 'India' then raise exception 'Domestic lounges are at airports in India.'; end if;
      if not jsonb_exists(ap.terminals, term) then raise exception 'Choose a terminal.'; end if;
      if not jsonb_exists(ap.terminals->term, 'DOMESTIC') then raise exception 'That terminal has no domestic lounge.'; end if;
    else
      if ap.country = 'India' then raise exception 'International lounges are at airports outside India.'; end if;
      if length(term) < 1 or length(term) > 20 then raise exception 'Enter the terminal, for example T3.'; end if;
    end if;
    begin t := (d->>'dateTime')::timestamptz; exception when others then t := null; end;
    if t is null then raise exception 'Choose the flight date and time.'; end if;
    if t < now() + interval '2 hours' then raise exception 'Lounge visits must be booked at least 2 hours ahead.'; end if;
    if coalesce(d->>'flight', '') !~* '^[A-Z0-9]{2}\s?\d{1,4}$' then raise exception 'Enter a flight number like AI 101.'; end if;
    if length(trim(coalesce(d->>'guestName', ''))) < 3 then raise exception 'Enter your name as it appears on your ID.'; end if;
    out := jsonb_build_object('type', typ, 'airport', ap.code, 'terminal', term, 'dateTime', t,
      'flight', upper(trim(d->>'flight')), 'guestName', trim(d->>'guestName'));
  elsif m = 'MOVIE' then
    begin t := (d->>'showTime')::timestamptz; exception when others then t := null; end;
    if t is null then raise exception 'Choose the showtime.'; end if;
    if t < now() + interval '3 hours' then raise exception 'Shows must be booked at least 3 hours ahead.'; end if;
    if length(trim(coalesce(d->>'movie', ''))) < 2 or length(trim(coalesce(d->>'theatre', ''))) < 2 then
      raise exception 'Enter the movie and the theatre.'; end if;
    if length(trim(coalesce(d->>'seats', ''))) < 2 then raise exception 'Enter the seats you want, for example G7, G8.'; end if;
    if coalesce(d->>'offer', '') not in ('BOGO', 'FLAT_500_OFF_2_SEATS') then raise exception 'Choose an offer.'; end if;
    out := jsonb_build_object('offer', d->>'offer', 'movie', trim(d->>'movie'), 'theatre', trim(d->>'theatre'),
      'city', trim(coalesce(d->>'city', '')), 'showTime', t, 'seats', trim(d->>'seats'),
      'seatCount', (d->>'seatCount')::numeric, 'ticketTotal', (d->>'ticketTotal')::numeric,
      'platform', coalesce(nullif(trim(d->>'platform'), ''), 'BookMyShow'), 'bank', coalesce(nullif(trim(d->>'bank'), ''), 'any'));
  elsif m in ('ORDER', 'PAY') then
    if m = 'ORDER' and coalesce(d->>'url', '') !~* '^https?://[^ ]+\.[^ ]+' then raise exception 'Paste the full product link (starting with https://).'; end if;
    if m = 'PAY' and coalesce(d->>'payUrl', '') !~* '^https?://[^ ]+\.[^ ]+' then raise exception 'Paste the link of the final payment page (starting with https://).'; end if;
    if length(trim(coalesce(d->>'platform', ''))) < 2 then raise exception 'Choose the shopping site.'; end if;
    if length(trim(coalesce(d->>'offerWanted', ''))) < 3 then raise exception 'Describe the card offer you want.'; end if;
    out := jsonb_build_object('url', case when m = 'ORDER' then trim(d->>'url') else '' end, 'platform', trim(d->>'platform'),
      'listPrice', (d->>'listPrice')::numeric, 'expectedPrice', (d->>'expectedPrice')::numeric,
      'offerWanted', trim(d->>'offerWanted'), 'bank', coalesce(nullif(trim(d->>'bank'), ''), 'any'));
    if m = 'PAY' then
      out := out || jsonb_build_object('payUrl', trim(d->>'payUrl'));
    else
      a := coalesce(d->'address', '{}');
      if length(trim(coalesce(a->>'name', ''))) < 3 or length(trim(coalesce(a->>'line', ''))) < 8 or length(trim(coalesce(a->>'city', ''))) < 2 then
        raise exception 'Enter the full delivery address.'; end if;
      if coalesce(a->>'pin', '') !~ '^\d{6}$' then raise exception 'Enter a 6-digit PIN code.'; end if;
      out := out || jsonb_build_object('address', jsonb_build_object('name', trim(a->>'name'), 'line', trim(a->>'line'),
        'city', trim(a->>'city'), 'pin', a->>'pin'));
    end if;
  else
    raise exception 'Unknown request type.';
  end if;
  return out;
end $$;

-- does a card fit a request? returns '' when it does, otherwise the reason (mirror of Core.cardFits)
create or replace function public.mk_card_fit(cid uuid, r public.mk_requests)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  c public.mk_cards; need text; b jsonb; used integer; total numeric;
  d jsonb := r.details;
begin
  select * into c from public.mk_cards where id = cid;
  if not found or not c.active then return 'Card is switched off'; end if;
  need := case
    when r.module = 'LOUNGE' then case when d->>'type' = 'INTERNATIONAL' then 'LOUNGE_INTL' else 'LOUNGE_DOM' end
    when r.module = 'MOVIE'  then case when d->>'offer' = 'BOGO' then 'MOVIE_BOGO' else 'MOVIE_FLAT500_2' end
    else 'SHOPPING' end;
  select e into b from jsonb_array_elements(c.benefits) e where e->>'kind' = need limit 1;
  if b is null then return 'No matching benefit on this card'; end if;
  if r.module = 'LOUNGE' then
    if not (jsonb_exists(coalesce(b->'airports', '["ANY"]'::jsonb), 'ANY') or jsonb_exists(b->'airports', d->>'airport')) then
      return 'Not valid at ' || (d->>'airport');
    end if;
    total := coalesce((b->>'quota')::numeric, 0);
    select count(*) into used from public.mk_quota_use
      where card_id = cid and kind = need and quarter = public.mk_quarter((d->>'dateTime')::timestamptz);
    if total - used <= 0 then return 'No lounge visits left this quarter'; end if;
  elsif coalesce(d->>'bank', 'any') <> 'any' and c.bank <> d->>'bank' then
    return 'Buyer needs a different bank card';
  end if;
  return '';
end $$;

-- Live alert to cardholders: a notifications row per eligible person. Supabase Realtime pushes it to their open
-- browser at once (see the publication below), and mk_notify_open also queues an email and a WhatsApp message.
create or replace function public.mk_notify_open(uid uuid, title text, body text, rid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (id, user_id, type, title, body)
  values ('ntf-' || replace(gen_random_uuid()::text, '-', ''), uid, 'market:open:' || rid, title, body);
  insert into public.mk_outbox (user_id, channel, title, body, request_id)
  values (uid, 'whatsapp', title, body, rid);
  insert into public.mk_outbox (user_id, channel, title, body, request_id)
  select uid, 'email', title, body, rid where exists (select 1 from public.mk_member m where m.user_id = uid and m.email_alerts);
end $$;

-- Everyone whose card fits this request (right benefit, airport, quota, bank) except the buyer and `skip`.
create or replace function public.mk_notify_eligible(rid uuid, skip uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.mk_requests; h record; what text; earn text;
begin
  select * into r from public.mk_requests where id = rid;
  if not found then return; end if;
  what := case r.module
    when 'LOUNGE' then lower(r.details->>'type') || ' lounge at ' || (r.details->>'airport')
    when 'MOVIE'  then (r.details->>'movie') || case when r.details->>'offer' = 'BOGO' then ' (buy one get one)' else ' (₹500 off on 2 seats)' end
    when 'ORDER'  then 'an order on ' || (r.details->>'platform')
    else 'a payment on ' || (r.details->>'platform') end;
  earn := public.mk_money((r.fee_snapshot->>'holderFee')::numeric)
          || case when (r.fee_snapshot->>'reimbursement')::numeric > 0
                  then ' plus ' || public.mk_money((r.fee_snapshot->>'reimbursement')::numeric) || ' reimbursed' else '' end;
  for h in
    select distinct c.owner_id from public.mk_cards c
    where c.active and c.owner_id <> r.buyer_id and c.owner_id is distinct from skip
      and public.mk_card_fit(c.id, r) = ''
    limit 200
  loop
    perform public.mk_notify_open(h.owner_id, 'New request you can fulfil',
      'Someone needs ' || what || '. You would earn ' || earn || '. First to accept gets it.', rid);
  end loop;
end $$;

-- A card added after requests were already paid: tell its owner about every open request it can fulfil, right away.
create or replace function public.mk_notify_new_card(cid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.mk_cards; r public.mk_requests; n integer := 0; first_id uuid; best numeric := 0;
begin
  select * into c from public.mk_cards where id = cid;
  if not found then return; end if;
  for r in select * from public.mk_requests
           where status = 'PAID' and buyer_id <> c.owner_id and accept_by > now() order by created_at desc loop
    if public.mk_card_fit(c.id, r) = '' then
      n := n + 1;
      if first_id is null then first_id := r.id; end if;
      best := greatest(best, coalesce((r.fee_snapshot->>'holderFee')::numeric, 0));
    end if;
  end loop;
  if n > 0 then
    perform public.mk_notify_open(c.owner_id,
      n || case when n = 1 then ' request is' else ' requests are' end || ' waiting for your card',
      'You can fulfil ' || case when n = 1 then 'it' else 'them' end || ' with the card you just added. Earn up to ' || public.mk_money(best) || '. First to accept gets it.',
      first_id);
  end if;
end $$;

-- push notifications to the browser as they are created
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

------------------------------------------------------------
-- RPC: requests
------------------------------------------------------------
create or replace function public.mk_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.mk_me(); m text := p->>'module'; clean jsonb; sub text; c public.mk_fee_config; q jsonb; rid uuid;
begin
  if (select count(*) from public.mk_requests where buyer_id = u and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many requests in the last hour. Please wait a little.';
  end if;
  clean := public.mk_clean_request(m, coalesce(p->'details', '{}'));
  sub := case m when 'LOUNGE' then clean->>'type' when 'MOVIE' then clean->>'offer' else 'DEFAULT' end;
  select * into c from public.mk_fee_config where module = m and subtype = sub and active;
  if not found then raise exception 'This option is not available right now.'; end if;
  q := public.mk_quote(c, clean);
  insert into public.mk_requests (module, subtype, buyer_id, details, fee_snapshot)
  values (m, sub, u, clean, jsonb_build_object(
    'cfgId', c.id, 'subtype', c.subtype, 'label', c.label, 'mode', c.mode,
    'reimbursement', q->'reimbursement', 'fee', q->'fee', 'platform', q->'platform', 'holderFee', q->'holderFee',
    'total', q->'total', 'original', q->'original', 'discount', q->'discount', 'saved', q->'saved', 'split', q->'split',
    'acceptHours', c.accept_hours, 'confirmHours', c.confirm_hours, 'penalty', c.penalty))
  returning id into rid;
  perform public.mk_audit(u::text, 'create', 'request', rid::text, jsonb_build_object('module', m, 'total', q->'total'));
  return jsonb_build_object('ok', true, 'request', jsonb_build_object('id', rid));
end $$;

-- money back to the buyer, with an optional penalty on the cardholder
create or replace function public.mk_refund(rid uuid, penalty numeric, reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.mk_requests; held numeric;
begin
  select * into r from public.mk_requests where id = rid;
  held := public.mk_escrow(rid);
  if held > 0 then
    perform public.mk_post(rid, 'REFUND', jsonb_build_array(
      jsonb_build_object('account', 'escrow', 'debit', held),
      jsonb_build_object('account', 'external:buyer:' || r.buyer_id, 'credit', held)), reason);
  end if;
  if coalesce(penalty, 0) > 0 and r.cardholder_id is not null then
    perform public.mk_post(rid, 'PENALTY', jsonb_build_array(
      jsonb_build_object('account', 'holder:' || r.cardholder_id, 'debit', penalty),
      jsonb_build_object('account', 'platform', 'credit', penalty)), reason);
    perform public.mk_notify(r.cardholder_id, 'Penalty applied', public.mk_money(penalty) || ' was deducted from your wallet: ' || reason, rid);
  end if;
  perform public.mk_go(rid, 'REFUNDED', 'system', reason);
  update public.mk_requests set refunded_at = now(), penalty_applied = coalesce(penalty, 0), closed_reason = reason where id = rid;
end $$;

create or replace function public.mk_settle(rid uuid, note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.mk_requests; s jsonb; held numeric; est numeric; act numeric; diff numeric; refund numeric := 0; lines jsonb; holder text;
  hf numeric; pf numeric;
begin
  select * into r from public.mk_requests where id = rid for update;
  s := r.fee_snapshot; held := public.mk_escrow(rid); est := (s->>'reimbursement')::numeric;
  hf := (s->>'holderFee')::numeric; pf := (s->>'platform')::numeric;
  act := case when r.topup_due > 0 or r.actual is null then est else r.actual end;
  diff := act - est;
  if diff < 0 then refund := -diff; end if;
  if abs(held - ((s->>'total')::numeric + greatest(diff, 0))) > 0.005 then
    act := est; refund := 0;                      -- top-up never paid: pay out on the estimate
  end if;
  holder := 'holder:' || r.cardholder_id;
  lines := jsonb_build_array(jsonb_build_object('account', 'escrow', 'debit', held));
  if act > 0 then lines := lines || jsonb_build_object('account', holder, 'credit', act, 'kind', 'REIMBURSEMENT'); end if;
  if hf > 0  then lines := lines || jsonb_build_object('account', holder, 'credit', hf,  'kind', 'CARDHOLDER_EARNING'); end if;
  if pf > 0  then lines := lines || jsonb_build_object('account', 'platform', 'credit', pf, 'kind', 'PLATFORM_FEE'); end if;
  if refund > 0 then lines := lines || jsonb_build_object('account', 'external:buyer:' || r.buyer_id, 'credit', refund, 'kind', 'REFUND'); end if;
  perform public.mk_post(rid, 'SETTLEMENT', lines, coalesce(note, 'Settled'));
  perform public.mk_go(rid, 'SETTLED', 'system', note);
  update public.mk_requests set settled_at = now() where id = rid;
  perform public.mk_trust(r.cardholder_id, 2, 'Completed request', rid);
  perform public.mk_trust(r.buyer_id, 1, 'Completed request', rid);
  perform public.mk_notify(r.cardholder_id, 'You earned ' || public.mk_money(act + hf),
    public.mk_money(act) || ' reimbursement plus ' || public.mk_money(hf) || ' earning is in your wallet.', rid);
  perform public.mk_notify(r.buyer_id, 'Request completed', 'Your request is complete.' ||
    case when refund > 0 then ' ' || public.mk_money(refund) || ' was refunded to you.' else '' end, rid);
end $$;

create or replace function public.mk_cancel(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests;
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid for update;
  if not found or r.buyer_id <> u then raise exception 'Only the buyer can do that.'; end if;
  if r.status = 'CREATED' then
    perform public.mk_go(r.id, 'CANCELLED', u::text, 'before payment');
  elsif r.status = 'PAID' then
    perform public.mk_go(r.id, 'CANCELLED', u::text, 'buyer cancelled');
    perform public.mk_refund(r.id, 0, 'Buyer cancelled before acceptance');
    perform public.mk_notify(u, 'Request cancelled', 'Your payment of ' || public.mk_money((r.fee_snapshot->>'total')::numeric) || ' is being refunded in full.', r.id);
  else
    raise exception 'A request can only be cancelled before a cardholder accepts it.';
  end if;
  return jsonb_build_object('ok', true);
end $$;

------------------------------------------------------------
-- RPC: payments (test mode)
------------------------------------------------------------
create or replace function public.mk_start_payment(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.mk_me(); r public.mk_requests; purpose text := case when p->>'purpose' = 'TOPUP' then 'TOPUP' else 'ORDER' end;
  amt numeric; oid text;
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid for update;
  if not found or r.buyer_id <> u then raise exception 'Only the buyer can do that.'; end if;
  if purpose = 'ORDER' and r.status <> 'CREATED' then raise exception 'This request is already paid.'; end if;
  if purpose = 'TOPUP' and not (r.topup_due > 0) then raise exception 'There is nothing to top up.'; end if;
  amt := case when purpose = 'ORDER' then (r.fee_snapshot->>'total')::numeric else r.topup_due end;
  oid := 'order_test_' || substr(md5(random()::text || clock_timestamp()::text), 1, 14);
  -- Live mode: create the order with the gateway here (or in an Edge Function) and store ITS order id instead.
  if purpose = 'ORDER' then update public.mk_requests set gateway_order_id = oid where id = r.id;
  else update public.mk_requests set topup_order_id = oid where id = r.id; end if;
  return jsonb_build_object('ok', true, 'order', jsonb_build_object('orderId', oid, 'amount', amt, 'currency', 'INR', 'purpose', purpose, 'requestId', r.id));
end $$;

create or replace function public.mk_topup(p jsonb)
returns jsonb language sql security definer set search_path = public as $$
  select public.mk_start_payment(p || '{"purpose":"TOPUP"}'::jsonb);
$$;

-- The one place payment money enters escrow. Idempotent on event_id. Called by the webhook
-- (service role only) and, in test mode, by mk_test_payment.
create or replace function public.mk_apply_payment(ev_id text, ev_type text, order_id text, amount numeric, payment_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.mk_requests; is_topup boolean; due numeric; n integer; t timestamptz := now(); rr public.mk_requests;
begin
  insert into public.mk_webhook_events (event_id, type, payload)
  values (ev_id, ev_type, jsonb_build_object('orderId', order_id, 'amount', amount, 'paymentId', payment_id))
  on conflict (event_id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  if ev_type <> 'payment.captured' then return jsonb_build_object('ok', true, 'ignored', true); end if;

  select * into r from public.mk_requests where gateway_order_id = order_id or topup_order_id = order_id for update;
  if not found then raise exception 'No request matches that payment.'; end if;
  is_topup := r.topup_order_id = order_id;
  if not is_topup and r.status <> 'CREATED' then raise exception 'This request is already paid.'; end if;
  due := case when is_topup then r.topup_due else (r.fee_snapshot->>'total')::numeric end;
  if abs(due - amount) > 0.005 then raise exception 'Paid amount does not match the amount due.'; end if;

  perform public.mk_post(r.id, 'ESCROW_IN', jsonb_build_array(
    jsonb_build_object('account', 'external:buyer:' || r.buyer_id, 'debit', amount),
    jsonb_build_object('account', 'escrow', 'credit', amount)), case when is_topup then 'Top-up' else 'Payment ' || payment_id end);
  if is_topup then
    update public.mk_requests set topup_due = 0, topup_paid = topup_paid + amount where id = r.id;
    perform public.mk_notify(r.cardholder_id, 'Buyer topped up', public.mk_money(amount) || ' was added to escrow for this request.', r.id);
  else
    perform public.mk_go(r.id, 'PAID', 'gateway', payment_id);
    update public.mk_requests set gateway_payment_id = payment_id, paid_at = t,
      accept_by = least(t + ((r.fee_snapshot->>'acceptHours')::numeric * interval '1 hour'),
                        coalesce(public.mk_event_time(r.details) - interval '1 hour', 'infinity'::timestamptz))
    where id = r.id;
    perform public.mk_notify(r.buyer_id, 'Payment held safely', public.mk_money(amount) || ' is in escrow. A cardholder can pick up your request now.', r.id);
    perform public.mk_notify_eligible(r.id, null);
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.mk_apply_payment(text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.mk_apply_payment(text, text, text, numeric, text) to service_role;

create or replace function public.mk_test_payment(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests; oid text := p->>'order_id'; amt numeric;
begin
  if coalesce((select value from public.mk_settings where key = 'gateway_mode'), 'test') <> 'test' then
    raise exception 'Test payments are switched off.';
  end if;
  select * into r from public.mk_requests where (gateway_order_id = oid or topup_order_id = oid) and buyer_id = u;
  if not found then raise exception 'No request matches that payment.'; end if;
  amt := case when r.topup_order_id = oid then r.topup_due else (r.fee_snapshot->>'total')::numeric end;
  return public.mk_apply_payment('evt_test_' || gen_random_uuid()::text,
    case when p->>'outcome' = 'fail' then 'payment.failed' else 'payment.captured' end,
    oid, amt, 'pay_test_' || substr(md5(random()::text), 1, 12));
end $$;

------------------------------------------------------------
-- RPC: cardholder
------------------------------------------------------------
create or replace function public.mk_open_requests()
returns table (id uuid, module text, subtype text, buyer_id uuid, status text, details jsonb, fee_snapshot jsonb,
               accept_by timestamptz, created_at timestamptz, paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.module, r.subtype, r.buyer_id, r.status, r.details - 'address' - 'guestName' - 'cartUrl' - 'payUrl', r.fee_snapshot,
         r.accept_by, r.created_at, r.paid_at
  from public.mk_requests r
  where auth.uid() is not null and r.status = 'PAID' and r.buyer_id <> auth.uid() and r.accept_by > now()
    and exists (select 1 from public.mk_cards c where c.owner_id = auth.uid() and c.active)
  order by r.created_at desc;
$$;

create or replace function public.mk_accept(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests; c public.mk_cards; why text; t timestamptz := now(); qkind text; ev timestamptz;
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid for update;      -- row lock: first accept wins
  if not found then raise exception 'Request not found.'; end if;
  if r.buyer_id = u then raise exception 'You cannot accept your own request.'; end if;
  if r.status <> 'PAID' then raise exception 'Someone else already picked this up, or it is no longer open.'; end if;
  if r.accept_by <= t then raise exception 'This request has expired.'; end if;
  if (select count(*) from public.mk_requests where cardholder_id = u and status in ('ACCEPTED','FULFILLED','DISPUTED')) >= 5 then
    raise exception 'Finish a few of your open tasks before taking more.';
  end if;
  select * into c from public.mk_cards where id = (p->>'cardId')::uuid and owner_id = u;
  if not found then raise exception 'Choose one of your own cards.'; end if;
  why := public.mk_card_fit(c.id, r);
  if why <> '' then raise exception '%.', why; end if;
  qkind := case when r.module = 'LOUNGE' then (case when r.details->>'type' = 'INTERNATIONAL' then 'LOUNGE_INTL' else 'LOUNGE_DOM' end) end;
  perform public.mk_go(r.id, 'ACCEPTED', u::text, c.bank);
  ev := public.mk_event_time(r.details);
  update public.mk_requests set cardholder_id = u, card_id = c.id, accepted_at = t,
    fulfil_by = coalesce(ev - interval '30 minutes', t + interval '48 hours') where id = r.id;
  if qkind is not null then
    insert into public.mk_quota_use (card_id, kind, quarter, request_id)
    values (c.id, qkind, public.mk_quarter((r.details->>'dateTime')::timestamptz), r.id);
  end if;
  perform public.mk_notify(r.buyer_id, 'A cardholder accepted',
    (select display_name from public.mk_member where user_id = u) || ' will take care of your request. You can chat with them on the request page.', r.id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_release(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests;
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid for update;
  if not found or r.cardholder_id is distinct from u then raise exception 'Only the cardholder on this request can do that.'; end if;
  if r.status <> 'ACCEPTED' then raise exception 'You can only step back before you upload proof.'; end if;
  delete from public.mk_quota_use where request_id = r.id;
  perform public.mk_go(r.id, 'PAID', u::text, 'cardholder stepped back');
  update public.mk_requests set cardholder_id = null, card_id = null, accepted_at = null, fulfil_by = null where id = r.id;
  perform public.mk_trust(u, -2, 'Stepped back from a request', r.id);
  perform public.mk_notify(r.buyer_id, 'Cardholder stepped back', 'Your request is open again for another cardholder.', r.id);
  perform public.mk_notify_eligible(r.id, u);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_fulfil(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := public.mk_me(); r public.mk_requests; s jsonb; act numeric := null; topup numeric := 0; est numeric;
  f jsonb; t timestamptz := now(); ev timestamptz; base timestamptz; v_ref text := trim(coalesce(p->>'ref', ''));
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid for update;
  if not found or r.cardholder_id is distinct from u then raise exception 'Only the cardholder on this request can do that.'; end if;
  if r.status <> 'ACCEPTED' then raise exception 'This request is not waiting for proof.'; end if;
  if jsonb_array_length(coalesce(p->'proofs', '[]')) = 0 then raise exception 'Upload at least one proof image.'; end if;
  if r.module = 'LOUNGE' then
    if length(v_ref) < 4 then raise exception 'Enter the pass or booking reference.'; end if;
  else
    if coalesce((p->>'actual')::numeric, 0) <= 0 then raise exception 'Enter the amount you actually paid.'; end if;
    if length(v_ref) < 4 then raise exception 'Enter the booking, order or payment ID.'; end if;
    s := r.fee_snapshot; est := (s->>'reimbursement')::numeric; act := round((p->>'actual')::numeric, 2);
    if act > est * 2 then raise exception 'That amount is far above the estimate. Message the buyer or contact support first.'; end if;
    if act > est then topup := act - est; end if;
  end if;
  for f in select * from jsonb_array_elements(p->'proofs') loop
    if (f->>'path') is null or (f->>'path') not like u::text || '/' || r.id::text || '/%' then
      raise exception 'Proof files must be uploaded to your own folder for this request.';
    end if;
    insert into public.mk_proofs (request_id, uploader_id, kind, name, path) values (r.id, u, 'PROOF', coalesce(f->>'name', ''), f->>'path');
  end loop;
  perform public.mk_go(r.id, 'FULFILLED', u::text, v_ref);
  ev := public.mk_event_time(r.details);
  base := case when ev is not null then greatest(t, ev) else t end;
  update public.mk_requests set ref = v_ref, actual = act, topup_due = topup, fulfilled_at = t,
    auto_confirm_at = base + ((r.fee_snapshot->>'confirmHours')::numeric * interval '1 hour') where id = r.id;
  perform public.mk_notify(r.buyer_id, 'Proof uploaded',
    case when topup > 0 then 'The final price is ' || public.mk_money(topup) || ' higher than estimated. Top up to release funds, or raise a dispute.'
         when act is not null and act < est then 'The final price was ' || public.mk_money(est - act) || ' lower, you will get that back when this completes.'
         else 'Check the proof and confirm to release payment.' end, r.id);
  return jsonb_build_object('ok', true);
end $$;

------------------------------------------------------------
-- RPC: buyer after fulfilment
------------------------------------------------------------
create or replace function public.mk_confirm_now(rid uuid, actor text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.mk_requests; t timestamptz := now(); sa timestamptz;
begin
  select * into r from public.mk_requests where id = rid for update;
  if r.status <> 'FULFILLED' then raise exception 'There is nothing to confirm yet.'; end if;
  if r.topup_due > 0 then raise exception 'Pay the top-up first. The cardholder paid more than the estimate.'; end if;
  sa := case when r.module = 'MOVIE' then greatest(t, public.mk_event_time(r.details) + interval '30 minutes') else t end;
  perform public.mk_go(rid, 'CONFIRMED', actor, '');
  update public.mk_requests set confirmed_at = t, settle_at = sa where id = rid;
  if sa <= now() then perform public.mk_settle(rid, 'Confirmed'); return jsonb_build_object('ok', true, 'settled', true); end if;
  return jsonb_build_object('ok', true, 'settled', false, 'settleAt', sa);
end $$;

create or replace function public.mk_confirm(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests;
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid;
  if not found or r.buyer_id <> u then raise exception 'Only the buyer can do that.'; end if;
  return public.mk_confirm_now(r.id, u::text);
end $$;

create or replace function public.mk_denied(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests; pen numeric;
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid for update;
  if not found or r.buyer_id <> u then raise exception 'Only the buyer can do that.'; end if;
  if r.module <> 'LOUNGE' then raise exception 'Entry reports are for lounge access.'; end if;
  if r.status <> 'FULFILLED' then raise exception 'You can report a denial once the cardholder has uploaded the pass.'; end if;
  pen := (r.fee_snapshot->>'penalty')::numeric;
  insert into public.mk_disputes (request_id, raised_by, reason, note, status, resolution, prev_status, resolved_at)
  values (r.id, u, 'ENTRY_DENIED', coalesce(p->>'note', ''), 'RESOLVED', 'REFUND', r.status, now());
  perform public.mk_trust(r.cardholder_id, -15, 'Lounge entry denied', r.id);
  perform public.mk_refund(r.id, pen, 'Lounge entry denied');
  perform public.mk_notify(u, 'Refunded in full', 'We are sorry the entry was denied. ' || public.mk_money((r.fee_snapshot->>'total')::numeric) || ' is going back to you.', r.id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_dispute(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests; did uuid; f jsonb; reason text := trim(coalesce(p->>'reason', '')); note text := trim(coalesce(p->>'note', ''));
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid for update;
  if not found or r.buyer_id <> u then raise exception 'Only the buyer can do that.'; end if;
  if r.status not in ('ACCEPTED', 'FULFILLED') then raise exception 'A dispute can be raised while the request is with the cardholder.'; end if;
  if reason = '' then raise exception 'Choose a reason.'; end if;
  if length(note) < 10 then raise exception 'Tell us what happened in a few words.'; end if;
  insert into public.mk_disputes (request_id, raised_by, reason, note, prev_status) values (r.id, u, reason, note, r.status) returning id into did;
  for f in select * from jsonb_array_elements(coalesce(p->'evidence', '[]')) loop
    if (f->>'path') is null or (f->>'path') not like u::text || '/' || r.id::text || '/%' then
      raise exception 'Evidence files must be uploaded to your own folder for this request.';
    end if;
    insert into public.mk_proofs (request_id, uploader_id, kind, name, path) values (r.id, u, 'EVIDENCE', coalesce(f->>'name', ''), f->>'path');
  end loop;
  perform public.mk_go(r.id, 'DISPUTED', u::text, reason);
  perform public.mk_notify(r.cardholder_id, 'The buyer raised a dispute', 'Support will review the proofs and decide. Reply in the request chat if you can help.', r.id);
  return jsonb_build_object('ok', true, 'dispute', jsonb_build_object('id', did));
end $$;

------------------------------------------------------------
-- RPC: staff
------------------------------------------------------------
create or replace function public.mk_resolve_dispute(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a uuid := public.mk_admin(); d public.mk_disputes; r public.mk_requests; outcome text := p->>'outcome';
  pen numeric := 0; held numeric; x numeric; plat numeric; rest numeric; lines jsonb;
begin
  select * into d from public.mk_disputes where id = (p->>'id')::uuid for update;
  if not found or d.status <> 'OPEN' then raise exception 'This dispute is already closed.'; end if;
  select * into r from public.mk_requests where id = d.request_id for update;
  if coalesce((p->>'penalise')::boolean, false) then pen := (r.fee_snapshot->>'penalty')::numeric; end if;
  if outcome = 'REFUND' then
    if pen > 0 then perform public.mk_trust(r.cardholder_id, -25, 'Dispute lost', r.id); end if;
    perform public.mk_refund(r.id, pen, 'Dispute resolved: refund');
  elsif outcome = 'RELEASE' then
    perform public.mk_settle(r.id, 'Dispute resolved: released to cardholder');
  elsif outcome = 'PARTIAL' then
    held := public.mk_escrow(r.id); x := round((p->>'buyerAmount')::numeric, 2);
    if not (x > 0 and x < held) then raise exception 'Enter an amount between 0 and %.', held; end if;
    plat := least((r.fee_snapshot->>'platform')::numeric, held - x); rest := held - x - plat;
    lines := jsonb_build_array(jsonb_build_object('account', 'escrow', 'debit', held),
      jsonb_build_object('account', 'external:buyer:' || r.buyer_id, 'credit', x, 'kind', 'REFUND'));
    if plat > 0 then lines := lines || jsonb_build_object('account', 'platform', 'credit', plat, 'kind', 'PLATFORM_FEE'); end if;
    if rest > 0 then lines := lines || jsonb_build_object('account', 'holder:' || r.cardholder_id, 'credit', rest, 'kind', 'CARDHOLDER_EARNING'); end if;
    perform public.mk_post(r.id, 'SETTLEMENT', lines, 'Dispute resolved: partial refund');
    perform public.mk_go(r.id, 'SETTLED', a::text, 'partial');
    update public.mk_requests set settled_at = now(), closed_reason = 'Partial refund of ' || public.mk_money(x) where id = r.id;
    perform public.mk_notify(r.buyer_id, 'Dispute decided', public.mk_money(x) || ' is going back to you.', r.id);
    perform public.mk_notify(r.cardholder_id, 'Dispute decided', public.mk_money(rest) || ' was released to your wallet.', r.id);
  else
    raise exception 'Choose an outcome.';
  end if;
  update public.mk_disputes set status = 'RESOLVED', resolution = outcome, resolved_by = a, resolved_at = now(), admin_note = coalesce(p->>'note', '') where id = d.id;
  perform public.mk_audit(a::text, 'resolve-dispute', 'dispute', d.id::text, jsonb_build_object('outcome', outcome));
  return jsonb_build_object('ok', true);
end $$;

-- timers: expiry, no-shows, auto-confirm, delayed release. Safe for anyone to call, it only applies deadlines.
create or replace function public.mk_sweep()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.mk_requests; n integer := 0;
begin
  for r in select * from public.mk_requests where status in ('PAID','ACCEPTED','FULFILLED','CONFIRMED') for update skip locked loop
    begin
      if r.status = 'PAID' and r.accept_by <= now() then
        perform public.mk_go(r.id, 'EXPIRED', 'system', 'No cardholder accepted in time');
        perform public.mk_refund(r.id, 0, 'Nobody accepted in time');
        perform public.mk_notify(r.buyer_id, 'Request expired', 'No cardholder picked it up in time. ' || public.mk_money((r.fee_snapshot->>'total')::numeric) || ' has been refunded in full.', r.id);
        n := n + 1;
      elsif r.status = 'ACCEPTED' and r.fulfil_by <= now() then
        delete from public.mk_quota_use where request_id = r.id;
        perform public.mk_trust(r.cardholder_id, -10, 'No-show', r.id);
        perform public.mk_refund(r.id, (r.fee_snapshot->>'penalty')::numeric, 'Cardholder did not deliver in time');
        perform public.mk_notify(r.buyer_id, 'Refunded in full', 'The cardholder did not deliver in time, so you were refunded.', r.id);
        n := n + 1;
      elsif r.status = 'FULFILLED' and r.auto_confirm_at <= now() and r.topup_due <= 0 then
        perform public.mk_confirm_now(r.id, 'system'); n := n + 1;
      elsif r.status = 'CONFIRMED' and r.settle_at <= now() then
        perform public.mk_settle(r.id, 'Confirmed'); n := n + 1;
      end if;
    exception when others then
      perform public.mk_audit('system', 'sweep-error', 'request', r.id::text, jsonb_build_object('error', sqlerrm));
    end;
  end loop;
  return jsonb_build_object('ok', true, 'changed', n);
end $$;

create or replace function public.mk_review_kyc(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public.mk_admin(); k public.mk_kyc; st text := p->>'status';
begin
  if st not in ('APPROVED', 'REJECTED') then raise exception 'Choose approve or reject.'; end if;
  select * into k from public.mk_kyc where id = (p->>'id')::uuid for update;
  if not found then raise exception 'KYC record not found.'; end if;
  update public.mk_kyc set status = st, review_note = coalesce(p->>'note', ''), reviewed_at = now() where id = k.id;
  perform public.mk_notify(k.user_id, case when st = 'APPROVED' then 'KYC approved' else 'KYC needs changes' end,
    case when st = 'APPROVED' then 'You can now request payouts.' else coalesce(nullif(p->>'note', ''), 'Please re-submit your details.') end);
  perform public.mk_audit(a::text, 'kyc-' || lower(st), 'kyc', k.id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_process_payout(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public.mk_admin(); x public.mk_payouts; bal numeric;
begin
  select * into x from public.mk_payouts where id = (p->>'id')::uuid for update;
  if not found or x.status <> 'REQUESTED' then raise exception 'This payout is already handled.'; end if;
  if coalesce((p->>'reject')::boolean, false) then
    update public.mk_payouts set status = 'REJECTED', note = coalesce(p->>'note', ''), processed_at = now() where id = x.id;
    perform public.mk_notify(x.user_id, 'Payout not processed', coalesce(nullif(p->>'note', ''), 'Please contact support.'));
    return jsonb_build_object('ok', true);
  end if;
  select coalesce(sum(credit - debit), 0) into bal from public.mk_ledger where account = 'holder:' || x.user_id;
  if x.amount > bal then raise exception 'The wallet no longer covers this payout.'; end if;
  -- Live mode: call the gateway payout API here (or from an Edge Function) before marking PAID.
  perform public.mk_post(null, 'PAYOUT', jsonb_build_array(
    jsonb_build_object('account', 'holder:' || x.user_id, 'debit', x.amount),
    jsonb_build_object('account', 'external:payout:' || x.user_id, 'credit', x.amount)), 'Payout ' || x.id);
  update public.mk_payouts set status = 'PAID', ref = 'TESTPAY-' || upper(substr(md5(random()::text), 1, 8)), processed_at = now() where id = x.id;
  perform public.mk_notify(x.user_id, 'Payout sent', public.mk_money(x.amount) || ' was sent to ' || x.destination || ' (test mode, no real money moves).');
  perform public.mk_audit(a::text, 'payout', 'payout', x.id::text, jsonb_build_object('amount', x.amount));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_save_fee(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public.mk_admin(); f public.mk_fee_config; pt jsonb := coalesce(p->'patch', '{}');
begin
  select * into f from public.mk_fee_config where id = p->>'id' for update;
  if not found then raise exception 'Fee not found.'; end if;
  if jsonb_exists(pt, 'fee') then f.fee := nullif(pt->>'fee', '')::numeric; end if;
  if jsonb_exists(pt, 'feePct') then f.fee_pct := nullif(pt->>'feePct', '')::numeric; end if;
  if jsonb_exists(pt, 'minFee') then f.min_fee := nullif(pt->>'minFee', '')::numeric; end if;
  if jsonb_exists(pt, 'platformAmt') then f.platform_amt := nullif(pt->>'platformAmt', '')::numeric; end if;
  if jsonb_exists(pt, 'platformPct') then f.platform_pct := nullif(pt->>'platformPct', '')::numeric; end if;
  if jsonb_exists(pt, 'discount') then f.discount := nullif(pt->>'discount', '')::numeric; end if;
  if jsonb_exists(pt, 'cap') then f.cap := nullif(pt->>'cap', '')::numeric; end if;
  if jsonb_exists(pt, 'acceptHours') then f.accept_hours := (pt->>'acceptHours')::numeric; end if;
  if jsonb_exists(pt, 'confirmHours') then f.confirm_hours := (pt->>'confirmHours')::numeric; end if;
  if jsonb_exists(pt, 'penalty') then f.penalty := (pt->>'penalty')::numeric; end if;
  if jsonb_exists(pt, 'active') then f.active := (pt->>'active')::boolean; end if;
  if jsonb_exists(pt, 'listValue') then f.list_value := nullif(pt->>'listValue', '')::numeric; end if;
  if jsonb_exists(pt, 'buyerPct') then f.buyer_pct := nullif(pt->>'buyerPct', '')::numeric; end if;
  if jsonb_exists(pt, 'holderPct') then f.holder_pct := nullif(pt->>'holderPct', '')::numeric; end if;
  if f.accept_hours <= 0 or f.confirm_hours < 0 then raise exception 'Time windows must be positive.'; end if;
  if f.penalty < 0 then raise exception 'Penalty cannot be negative.'; end if;
  if f.mode = 'SPLIT' then
    if coalesce(f.buyer_pct, -1) < 0 or coalesce(f.holder_pct, -1) < 0 or coalesce(f.platform_pct, -1) < 0
       or f.buyer_pct > 100 or f.holder_pct > 100 or f.platform_pct > 100 then raise exception 'Each share must be between 0 and 100 percent.'; end if;
    if abs(f.buyer_pct + f.holder_pct + f.platform_pct - 100) > 0.001 then raise exception 'Buyer, cardholder and platform shares must add up to 100%%.'; end if;
    if f.module = 'LOUNGE' and coalesce(f.list_value, 0) <= 0 then raise exception 'Enter the usual lounge entry price.'; end if;
  elsif f.mode = 'PERCENT' then
    if coalesce(f.fee_pct, 0) <= 0 or f.fee_pct > 50 then raise exception 'Fee percent must be between 0 and 50.'; end if;
    if coalesce(f.min_fee, 0) < 0 then raise exception 'Minimum fee cannot be negative.'; end if;
    if coalesce(f.platform_pct, 0) < 0 or coalesce(f.platform_pct, 0) > 100 then raise exception 'Platform share must be 0 to 100 percent of the fee.'; end if;
  else
    if coalesce(f.fee, 0) <= 0 then raise exception 'Fee must be more than zero.'; end if;
    if coalesce(f.platform_amt, 0) < 0 or coalesce(f.platform_amt, 0) > f.fee then raise exception 'Platform share cannot be more than the fee.'; end if;
    if f.list_value is not null and f.list_value < f.fee then raise exception 'The usual price cannot be less than what the buyer pays.'; end if;
  end if;
  update public.mk_fee_config set fee = f.fee, fee_pct = f.fee_pct, min_fee = f.min_fee, platform_amt = f.platform_amt,
    platform_pct = f.platform_pct, discount = f.discount, cap = f.cap, accept_hours = f.accept_hours,
    buyer_pct = f.buyer_pct, holder_pct = f.holder_pct, list_value = f.list_value,
    confirm_hours = f.confirm_hours, penalty = f.penalty, active = f.active where id = f.id;
  perform public.mk_audit(a::text, 'fee', 'fee', f.id, pt);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_ban_user(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public.mk_admin();
begin
  update public.profiles set active = not coalesce((p->>'ban')::boolean, true) where id = (p->>'userId')::uuid;
  perform public.mk_audit(a::text, case when coalesce((p->>'ban')::boolean, true) then 'ban' else 'unban' end, 'user', p->>'userId');
  return jsonb_build_object('ok', true);
end $$;

------------------------------------------------------------
-- RPC: cards, KYC, payouts, chat, ratings
------------------------------------------------------------
create or replace function public.mk_save_card(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); v_bank text := trim(coalesce(p->>'bank', '')); v_variant text := trim(coalesce(p->>'variant', ''));
  b jsonb; bens jsonb := '[]'::jsonb; o jsonb; q numeric; cid uuid;
begin
  if v_bank = '' then raise exception 'Choose the bank.'; end if;
  if length(v_variant) < 2 then raise exception 'Enter the card variant, for example Regalia or Millennia.'; end if;
  for b in select * from jsonb_array_elements(coalesce(p->'benefits', '[]')) loop
    if b->>'kind' not in ('LOUNGE_DOM','LOUNGE_INTL','MOVIE_BOGO','MOVIE_FLAT500_2','SHOPPING') then continue; end if;
    o := jsonb_build_object('kind', b->>'kind', 'program', coalesce(nullif(b->>'program', ''), 'Bank'));
    if b->>'kind' in ('LOUNGE_DOM', 'LOUNGE_INTL') then
      q := (b->>'quota')::numeric;
      if q is null or q < 1 or q > 99 then raise exception 'Enter how many lounge visits you get per quarter (1 to 99).'; end if;
      o := o || jsonb_build_object('quota', q, 'airports', case when jsonb_array_length(coalesce(b->'airports', '[]')) > 0 then b->'airports' else '["ANY"]'::jsonb end);
    end if;
    if coalesce(b->>'note', '') <> '' then o := o || jsonb_build_object('note', left(b->>'note', 120)); end if;
    bens := bens || o;
  end loop;
  if jsonb_array_length(bens) = 0 then raise exception 'Add at least one benefit this card offers.'; end if;
  if p->>'id' is not null then
    update public.mk_cards set bank = v_bank, variant = v_variant, network = coalesce(p->>'network', ''), benefits = bens
    where id = (p->>'id')::uuid and owner_id = u returning id into cid;
    if cid is null then raise exception 'Card not found.'; end if;
  else
    insert into public.mk_cards (owner_id, bank, variant, network, benefits) values (u, v_bank, v_variant, coalesce(p->>'network', ''), bens) returning id into cid;
    perform public.mk_notify_new_card(cid);
  end if;
  return jsonb_build_object('ok', true, 'id', cid);
end $$;

create or replace function public.mk_remove_card(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); c public.mk_cards;
begin
  select * into c from public.mk_cards where id = (p->>'id')::uuid and owner_id = u;
  if not found then raise exception 'Card not found.'; end if;
  if exists (select 1 from public.mk_requests where card_id = c.id and status in ('ACCEPTED','FULFILLED','DISPUTED')) then
    raise exception 'This card is being used on an open request.';
  end if;
  delete from public.mk_cards where id = c.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_submit_kyc(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); v_pan text := upper(trim(coalesce(p->>'pan', '')));
  v_upi text := trim(coalesce(p->>'upi', '')); v_acct text := trim(coalesce(p->>'account', '')); v_ifsc text := upper(trim(coalesce(p->>'ifsc', '')));
begin
  if length(trim(coalesce(p->>'legalName', ''))) < 3 then raise exception 'Enter your name as on your PAN card.'; end if;
  if v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'Enter a valid PAN, like ABCDE1234F.'; end if;
  if v_upi <> '' then
    if v_upi !~* '^[a-z0-9._-]{2,}@[a-z]{2,}$' then raise exception 'That UPI ID does not look right.'; end if;
  elsif not (v_acct ~ '^\d{9,18}$' and v_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$') then
    raise exception 'Give a UPI ID, or a bank account number with its IFSC.';
  end if;
  insert into public.mk_kyc (user_id, legal_name, pan, upi, account, ifsc, status)
  values (u, trim(p->>'legalName'), v_pan, v_upi, v_acct, v_ifsc, 'PENDING')
  on conflict (user_id) do update set legal_name = excluded.legal_name, pan = excluded.pan, upi = excluded.upi,
    account = excluded.account, ifsc = excluded.ifsc, status = 'PENDING', review_note = '', created_at = now(), reviewed_at = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_request_payout(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); k public.mk_kyc; amt numeric := round((p->>'amount')::numeric, 2); bal numeric; asked numeric; pid uuid;
begin
  select * into k from public.mk_kyc where user_id = u;
  if not found or k.status <> 'APPROVED' then raise exception 'Complete KYC and wait for approval before your first payout.'; end if;
  if amt is null or amt < 100 then raise exception 'The minimum payout is ₹100.'; end if;
  select coalesce(sum(credit - debit), 0) into bal from public.mk_ledger where account = 'holder:' || u;
  select coalesce(sum(amount), 0) into asked from public.mk_payouts where user_id = u and status = 'REQUESTED';
  if amt > bal - asked then raise exception 'That is more than your available balance.'; end if;
  insert into public.mk_payouts (user_id, amount, method, destination)
  values (u, amt, case when k.upi <> '' then 'UPI' else 'BANK' end,
          case when k.upi <> '' then k.upi else 'A/c ending ' || right(k.account, 4) end) returning id into pid;
  return jsonb_build_object('ok', true, 'payout', jsonb_build_object('id', pid));
end $$;

-- phone numbers and emails are hidden so people stay on the platform
create or replace function public.mk_mask(t text)
returns text language plpgsql immutable as $$
declare out text := t; m text[];
begin
  out := regexp_replace(out, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email hidden]', 'g');
  for m in select regexp_matches(out, '(\+?\d[\d\s().-]{6,}\d)', 'g') loop
    if length(regexp_replace(m[1], '\D', '', 'g')) >= 8 then out := replace(out, m[1], '[number hidden]'); end if;
  end loop;
  return out;
end $$;

create or replace function public.mk_send_message(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests; body text := trim(coalesce(p->>'body', '')); other uuid;
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid;
  if not found or not (r.buyer_id = u or r.cardholder_id = u or public.is_admin()) then raise exception 'You are not part of this request.'; end if;
  if r.cardholder_id is null then raise exception 'Chat opens once a cardholder accepts.'; end if;
  if r.status in ('REFUNDED', 'CANCELLED', 'EXPIRED') then raise exception 'This request is closed.'; end if;
  if body = '' then raise exception 'Type a message first.'; end if;
  if length(body) > 500 then raise exception 'Keep messages under 500 characters.'; end if;
  if not public.is_admin() then
    if length(regexp_replace(body, '\D', '', 'g')) > 4 then
      raise exception 'A message can have at most 4 digits. Never share phone, card, account or OTP numbers.';
    end if;
    if (select count(*) from public.mk_messages where request_id = r.id and sender_id = u) >= 2 then
      raise exception 'You can send 2 messages on a request, and you have used them. Use the request page or contact support.';
    end if;
  end if;
  if (select count(*) from public.mk_messages where sender_id = u and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too quickly.';
  end if;
  insert into public.mk_messages (request_id, sender_id, body) values (r.id, u, public.mk_mask(body));
  other := case when u = r.buyer_id then r.cardholder_id else r.buyer_id end;
  if other <> u and not public.is_admin() then
    perform public.mk_notify(other, 'New message', (select display_name from public.mk_member where user_id = u) || ': ' || left(public.mk_mask(body), 80), r.id);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.mk_rate(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me(); r public.mk_requests; st integer := (p->>'stars')::integer; ratee uuid;
begin
  select * into r from public.mk_requests where id = (p->>'id')::uuid;
  if not found or not (r.buyer_id = u or r.cardholder_id = u) then raise exception 'You are not part of this request.'; end if;
  if r.status <> 'SETTLED' then raise exception 'You can rate once the request is complete.'; end if;
  if st is null or st < 1 or st > 5 then raise exception 'Choose 1 to 5 stars.'; end if;
  if exists (select 1 from public.mk_ratings where request_id = r.id and rater_id = u) then raise exception 'You already rated this one.'; end if;
  ratee := case when u = r.buyer_id then r.cardholder_id else r.buyer_id end;
  insert into public.mk_ratings (request_id, rater_id, ratee_id, stars, note) values (r.id, u, ratee, st, left(coalesce(p->>'note', ''), 300));
  perform public.mk_recalc_member(ratee);
  return jsonb_build_object('ok', true);
end $$;

------------------------------------------------------------
-- who can call what
------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array[
    'mk_create(jsonb)','mk_cancel(jsonb)','mk_start_payment(jsonb)','mk_topup(jsonb)','mk_test_payment(jsonb)','mk_open_requests()',
    'mk_accept(jsonb)','mk_release(jsonb)','mk_fulfil(jsonb)','mk_confirm(jsonb)','mk_denied(jsonb)','mk_dispute(jsonb)',
    'mk_resolve_dispute(jsonb)','mk_sweep()','mk_review_kyc(jsonb)','mk_process_payout(jsonb)','mk_save_fee(jsonb)','mk_ban_user(jsonb)',
    'mk_save_card(jsonb)','mk_remove_card(jsonb)','mk_submit_kyc(jsonb)','mk_request_payout(jsonb)','mk_send_message(jsonb)','mk_rate(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- internal helpers must not be callable from the browser
do $$ declare f text; begin
  foreach f in array array[
    'mk_audit(text,text,text,text,jsonb)','mk_notify(uuid,text,text,uuid)','mk_notify_open(uuid,text,text,uuid)','mk_notify_eligible(uuid,uuid)','mk_notify_new_card(uuid)','mk_trust(uuid,numeric,text,uuid)','mk_recalc_member(uuid)',
    'mk_go(uuid,text,text,text)','mk_post(uuid,text,jsonb,text)','mk_refund(uuid,numeric,text)','mk_settle(uuid,text)',
    'mk_confirm_now(uuid,text)','mk_clean_request(text,jsonb)','mk_card_fit(uuid,public.mk_requests)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Optional: run the timers every 5 minutes without anyone visiting the site.
--   create extension if not exists pg_cron;
--   select cron.schedule('mk-sweep', '*/5 * * * *', 'select public.mk_sweep()');

-- A person turns "email me new requests" on or off. Emails go to their account address, and only for people who opted in.
create or replace function public.mk_set_email_alerts(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := public.mk_me();
begin
  update public.mk_member set email_alerts = coalesce((p->>'on')::boolean, false) where user_id = u;
  return jsonb_build_object('ok', true, 'on', coalesce((p->>'on')::boolean, false));
end $$;
revoke all on function public.mk_set_email_alerts(jsonb) from public, anon;
grant execute on function public.mk_set_email_alerts(jsonb) to authenticated;
