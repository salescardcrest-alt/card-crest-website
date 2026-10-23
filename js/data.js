/* ============================================================
   Card Crest — data.js
   The demo dataset. This is the ONLY file that knows what the
   seed data looks like. Swap it for a real API response of the
   same shape and nothing else in the app needs to change.
   ============================================================ */
(function (w) {
  'use strict';

  /* ---------------- banks ---------------- */
  var BANKS = [
    { id: 'hdfc',    name: 'HDFC Bank',          short: 'HDFC', color: '#00437a' },
    { id: 'sbi',     name: 'SBI Card',           short: 'SBI',  color: '#00539f' },
    { id: 'icici',   name: 'ICICI Bank',         short: 'ICICI',color: '#ae2929' },
    { id: 'axis',    name: 'Axis Bank',          short: 'Axis', color: '#97144d' },
    { id: 'idfc',    name: 'IDFC FIRST Bank',    short: 'IDFC', color: '#9c1f2e' },
    { id: 'kotak',   name: 'Kotak Mahindra Bank',short: 'Kotak',color: '#ed1c24' },
    { id: 'indusind',name: 'IndusInd Bank',      short: 'IndusInd', color: '#8b1a3b' },
    { id: 'hsbc',    name: 'HSBC India',         short: 'HSBC', color: '#db0011' },
    { id: 'amex',    name: 'American Express',   short: 'Amex', color: '#016fd0' },
    { id: 'rbl',     name: 'RBL Bank',           short: 'RBL',  color: '#c8102e' },
    { id: 'yes',     name: 'YES Bank',           short: 'YES',  color: '#00518f' },
    { id: 'au',      name: 'AU Small Finance Bank', short: 'AU', color: '#5c2d91' },
    { id: 'federal', name: 'Federal Bank',       short: 'Federal', color: '#f9a01b' },
    { id: 'bob',     name: 'Bank of Baroda',     short: 'BoB',  color: '#f26522' },
    { id: 'kiwi',    name: 'Kiwi',               short: 'Kiwi', color: '#6c3cf0' },
    { id: 'sbm',     name: 'SBM Bank India',     short: 'SBM',  color: '#e30613' }
  ];

  /* ---------------- credit cards ----------------
     rewardRate  : % effective return on general spend
     accel       : category multipliers used by the calculator
     valuePerks  : rupee value of non-spend benefits per year
  ------------------------------------------------ */
  function C(o) {
    return Object.assign({
      rating: 4.2, popular: false, lifetimeFree: false,
      accel: {}, valuePerks: 0, insurance: 'Not included',
      milestone: 'No milestone benefit', redemption: '1 point = ₹0.25',
      minAge: 21, maxAge: 60, minIncome: 300000, minCibil: 720,
      documents: ['PAN card', 'Aadhaar or address proof', 'Latest 3 salary slips or 2 years ITR', 'Bank statement for 3 months'],
      pros: [], cons: [], perks: []
    }, o);
  }

  var CARDS = [
    C({ id:'hdfc-millennia', bank:'hdfc', name:'HDFC Millennia', type:['cashback','shopping'], art:'cashback',
      annualFee:1000, joiningFee:1000, feeWaiver:'Spend ₹1,00,000 in a year', rewardRate:1, cashback:5,
      welcome:'1,000 CashPoints on paying the joining fee', welcomeValue:1000,
      lounge:'8 domestic lounge visits a year (1 per quarter, on ₹1L quarterly spend)',
      fuel:'1% fuel surcharge waiver, ₹250 a month', travel:'Nil forex markup not offered',
      dining:'Up to 20% off via Swiggy Dineout', shopping:'5% cashback on Amazon, Flipkart, Swiggy, Zomato, Uber, Cult.fit',
      insurance:'Not included', milestone:'₹1,000 gift voucher on ₹1L spend per quarter',
      redemption:'1 CashPoint = ₹1 as statement credit', minIncome:420000, rating:4.5, popular:true,
      accel:{ online:5, dining:2.5, fuel:0, travel:1, offline:1 }, valuePerks:5400,
      perks:['5% on top brands','Quarterly lounge','Milestone vouchers'],
      pros:['One of the strongest 5% online cashback rates in its fee bracket','Quarterly lounge access is rare below ₹1,500 fee','Statement-credit redemption means no points to burn'],
      cons:['5% cashback is capped at ₹1,000 per month','Lounge needs ₹1L quarterly spend','No forex benefit for travellers'] }),

    C({ id:'hdfc-infinia', bank:'hdfc', name:'HDFC Infinia Metal', type:['premium','travel','rewards'], art:'premium',
      annualFee:12500, joiningFee:12500, feeWaiver:'Spend ₹10,00,000 in a year', rewardRate:3.3, cashback:0,
      welcome:'12,500 reward points on paying the joining fee', welcomeValue:12500,
      lounge:'Unlimited domestic and international lounge access for you and a guest via Priority Pass',
      fuel:'1% fuel surcharge waiver', travel:'2% forex markup, Club Marriott membership, 5x on SmartBuy travel',
      dining:'Complimentary ITC hotel stays, 1+1 on Swiggy Dineout', shopping:'Up to 10x points via SmartBuy',
      insurance:'₹3 crore air accident cover, ₹50 lakh emergency medical cover',
      milestone:'No milestone benefit — the base rate carries the card',
      redemption:'1 point = ₹1 on flights and hotels via SmartBuy', minIncome:3600000, minCibil:780, rating:4.8, popular:true,
      accel:{ online:3.3, dining:3.3, fuel:0, travel:16.5, offline:3.3 }, valuePerks:48000,
      perks:['Unlimited lounge','Golf','3.3% base return'],
      pros:['Best-in-class 3.3% unlimited base return with no category caps','Unlimited Priority Pass for cardholder and guest','Point value holds at ₹1 on travel redemptions'],
      cons:['₹12,500 fee and a ₹36L income bar put it out of reach for most','Invite-driven — applications are frequently declined','Full value needs disciplined SmartBuy routing'] }),

    C({ id:'sbi-cashback', bank:'sbi', name:'SBI Cashback Card', type:['cashback'], art:'cashback',
      annualFee:999, joiningFee:999, feeWaiver:'Spend ₹2,00,000 in a year', rewardRate:1, cashback:5,
      welcome:'No welcome bonus', welcomeValue:0,
      lounge:'Not included', fuel:'1% fuel surcharge waiver up to ₹100 a month',
      travel:'3.5% forex markup', dining:'5% online, 1% offline', shopping:'5% cashback on all online spends, no merchant list',
      insurance:'Not included', milestone:'No milestone benefit',
      redemption:'Auto-credited to the statement within 2 days of the bill', minIncome:300000, rating:4.6, popular:true,
      accel:{ online:5, dining:5, fuel:0, travel:5, offline:1 }, valuePerks:1200,
      perks:['5% on any online spend','Auto statement credit','No merchant restrictions'],
      pros:['5% applies to any online merchant, not a fixed list','Cashback credits automatically — nothing to claim','Simple to understand, hard to leave value on the table'],
      cons:['Cashback capped at ₹5,000 per statement cycle','No lounge access at all','Offline spend earns only 1%'] }),

    C({ id:'sbi-elite', bank:'sbi', name:'SBI Card ELITE', type:['premium','travel','rewards'], art:'premium',
      annualFee:4999, joiningFee:4999, feeWaiver:'Spend ₹10,00,000 in a year', rewardRate:1.25, cashback:0,
      welcome:'₹5,000 worth of e-gift voucher', welcomeValue:5000,
      lounge:'6 international visits a year via Priority Pass, 8 domestic visits',
      fuel:'1% fuel surcharge waiver up to ₹250 a month', travel:'1.99% forex markup',
      dining:'Up to 20% off at partner restaurants', shopping:'5x points on dining, groceries, department stores',
      insurance:'₹1 crore air accident cover', milestone:'₹7,000 worth of e-vouchers on ₹8L annual spend',
      redemption:'4 points = ₹1', minIncome:1200000, rating:4.3,
      accel:{ online:1.25, dining:6.25, fuel:0, travel:1.25, offline:1.25 }, valuePerks:22000,
      perks:['Priority Pass','Movie tickets','Milestone vouchers'],
      pros:['International lounge access at a mid-tier fee','Free movie tickets worth ₹6,000 a year','Strong milestone vouchers for high spenders'],
      cons:['Base reward rate of 1.25% is weak for a ₹4,999 fee','Point value drops sharply outside vouchers','Needs ₹8L spend to unlock the best milestones'] }),

    C({ id:'icici-amazon', bank:'icici', name:'Amazon Pay ICICI Card', type:['cashback','shopping','lifetime-free'], art:'shopping',
      annualFee:0, joiningFee:0, feeWaiver:'Lifetime free', rewardRate:1, cashback:5, lifetimeFree:true,
      welcome:'₹300 Amazon Pay balance on activation', welcomeValue:300,
      lounge:'Not included', fuel:'1% fuel surcharge waiver',
      travel:'3.5% forex markup', dining:'2% on Amazon Pay partner merchants',
      shopping:'5% back on Amazon for Prime members, 3% for non-Prime',
      insurance:'Not included', milestone:'No milestone benefit',
      redemption:'Cashback lands as Amazon Pay balance, usable at 1:1', minIncome:250000, rating:4.7, popular:true,
      accel:{ online:3, dining:2, fuel:0, travel:1, offline:1 }, valuePerks:300,
      perks:['Lifetime free','5% on Amazon','No reward caps'],
      pros:['Genuinely lifetime free with no hidden spend condition','No cap on the 5% Amazon cashback','Easiest premium-ish card to get approved for'],
      cons:['Value collapses if you do not shop on Amazon','Cashback is locked into Amazon Pay balance','No lounge, no travel benefits'] }),

    C({ id:'icici-sapphiro', bank:'icici', name:'ICICI Sapphiro', type:['premium','travel'], art:'travel',
      annualFee:6500, joiningFee:6500, feeWaiver:'Spend ₹6,00,000 in a year', rewardRate:1.5, cashback:0,
      welcome:'Vouchers worth ₹9,000 across brands', welcomeValue:9000,
      lounge:'4 international and 16 domestic lounge visits a year',
      fuel:'1% fuel surcharge waiver up to ₹1,000 a year', travel:'1.5% forex markup, complimentary golf',
      dining:'Up to 25% off via ICICI Culinary Treats', shopping:'2 reward points per ₹100',
      insurance:'₹3 crore air accident cover, ₹1 crore credit shield',
      milestone:'₹3,000 voucher on ₹4L spend, another on ₹8L', redemption:'1 point = ₹0.25',
      minIncome:1500000, rating:4.2,
      accel:{ online:1.5, dining:1.5, fuel:0, travel:3, offline:1.5 }, valuePerks:26000,
      perks:['16 domestic lounge visits','Golf','Airport transfers'],
      pros:['Very generous domestic lounge quota','Low 1.5% forex markup for a mid-premium card','Two milestone tiers reward heavy spenders twice'],
      cons:['Reward rate is unremarkable for the fee','Voucher redemption ties you to specific brands','Fee waiver threshold is high at ₹6L'] }),

    C({ id:'axis-magnus', bank:'axis', name:'Axis Magnus', type:['premium','travel','rewards'], art:'premium',
      annualFee:12500, joiningFee:12500, feeWaiver:'Spend ₹25,00,000 in a year', rewardRate:2.4, cashback:0,
      welcome:'Travel voucher worth ₹12,500', welcomeValue:12500,
      lounge:'Unlimited domestic lounge access, 8 international visits with a guest',
      fuel:'1% fuel surcharge waiver', travel:'2% forex markup, 1:5 airline transfer partners',
      dining:'Buy one get one on BookMyShow, 20% off at partner restaurants',
      shopping:'12 points per ₹200 on spends above ₹1.5L a month',
      insurance:'₹4.5 crore air accident cover', milestone:'25,000 bonus points on ₹15L annual spend',
      redemption:'1 point = ₹0.20 cash, up to ₹1 via airline transfers', minIncome:1800000, rating:4.4, popular:true,
      accel:{ online:2.4, dining:2.4, fuel:0, travel:12, offline:2.4 }, valuePerks:40000,
      perks:['Unlimited domestic lounge','Airline transfers','BOGO movies'],
      pros:['Airline point transfers can push effective value past 5%','Unlimited domestic lounge with guest access','Strong for anyone spending over ₹1.5L a month'],
      cons:['Transfer ratios have been revised downward before','₹25L waiver threshold is unrealistic for most','Full value requires actively booking award travel'] }),

    C({ id:'axis-ace', bank:'axis', name:'Axis ACE', type:['cashback'], art:'cashback',
      annualFee:499, joiningFee:499, feeWaiver:'Spend ₹2,00,000 in a year', rewardRate:1.5, cashback:5,
      welcome:'No welcome bonus', welcomeValue:0,
      lounge:'4 domestic lounge visits a year on ₹50,000 quarterly spend',
      fuel:'1% fuel surcharge waiver up to ₹400 a month', travel:'3.5% forex markup',
      dining:'4% cashback on Swiggy and Zomato', shopping:'2% on all other spends',
      insurance:'Not included', milestone:'No milestone benefit',
      redemption:'Cashback auto-credited to the statement', minIncome:300000, rating:4.4, popular:true,
      accel:{ online:2, dining:4, fuel:0, travel:2, offline:2 }, valuePerks:3600,
      perks:['5% on bill payments','4% on food delivery','Low fee'],
      pros:['5% back on utility and bill payments via Google Pay','Flat 2% on everything else with no category hunting','Very low ₹499 fee for the return it delivers'],
      cons:['5% and 4% rates are capped at ₹500 a month combined','Lounge access needs quarterly spend targets','No travel or forex advantages'] }),

    C({ id:'idfc-first-wealth', bank:'idfc', name:'IDFC FIRST Wealth', type:['rewards','lifetime-free','travel'], art:'rewards',
      annualFee:0, joiningFee:0, feeWaiver:'Lifetime free', rewardRate:1.25, cashback:0, lifetimeFree:true,
      welcome:'₹500 voucher on ₹5,000 spend in 30 days', welcomeValue:500,
      lounge:'4 domestic lounge visits per quarter on ₹20,000 quarterly spend',
      fuel:'1% fuel surcharge waiver up to ₹400 a month', travel:'1.5% forex markup',
      dining:'Buy one get one movie ticket up to ₹500, twice a month',
      shopping:'10x points on spends above ₹20,000 a month',
      insurance:'₹1 crore air accident cover, ₹25 lakh personal accident cover',
      milestone:'No milestone benefit', redemption:'1 point = ₹0.25, never expires',
      minIncome:600000, rating:4.5, popular:true,
      accel:{ online:1.25, dining:1.25, fuel:0, travel:1.25, offline:1.25 }, valuePerks:18000,
      perks:['Lifetime free','Quarterly lounge','1.5% forex'],
      pros:['Lounge access, low forex and insurance on a card with no fee at all','Reward points never expire','Movie BOGO alone can cover what other cards charge'],
      cons:['Base 1.25% is modest until you cross ₹20,000 a month','Lounge needs a quarterly spend trigger','Requires a higher income than most zero-fee cards'] }),

    C({ id:'idfc-select', bank:'idfc', name:'IDFC FIRST Select', type:['rewards','lifetime-free'], art:'rewards',
      annualFee:0, joiningFee:0, feeWaiver:'Lifetime free', rewardRate:1.25, cashback:0, lifetimeFree:true,
      welcome:'₹500 voucher on ₹5,000 spend in 30 days', welcomeValue:500,
      lounge:'2 domestic lounge visits per quarter on ₹20,000 quarterly spend',
      fuel:'1% fuel surcharge waiver', travel:'1.99% forex markup',
      dining:'25% off on movie tickets up to ₹100, twice a month',
      shopping:'10x points above ₹20,000 monthly spend', insurance:'₹1 crore air accident cover',
      milestone:'No milestone benefit', redemption:'1 point = ₹0.25, never expires',
      minIncome:360000, rating:4.3,
      accel:{ online:1.25, dining:1.25, fuel:0, travel:1.25, offline:1.25 }, valuePerks:9000,
      perks:['Lifetime free','Lounge access','Never-expiring points'],
      pros:['Zero fee with real lounge access','Accessible income requirement','Points hold value indefinitely'],
      cons:['Half the lounge quota of the Wealth variant','Reward rate only shines above ₹20,000 a month','Limited premium benefits'] }),

    C({ id:'kotak-811', bank:'kotak', name:'Kotak 811 #DreamDifferent', type:['lifetime-free','rewards'], art:'rewards',
      annualFee:0, joiningFee:0, feeWaiver:'Lifetime free', rewardRate:0.5, cashback:0, lifetimeFree:true,
      welcome:'No welcome bonus', welcomeValue:0,
      lounge:'1 domestic lounge visit per quarter', fuel:'1% fuel surcharge waiver up to ₹3,500 a year',
      travel:'3.5% forex markup', dining:'No specific dining benefit',
      shopping:'2x points on online spends', insurance:'Not included',
      milestone:'No milestone benefit', redemption:'1 point = ₹0.25',
      minIncome:180000, minCibil:700, rating:3.8,
      accel:{ online:1, dining:0.5, fuel:0, travel:0.5, offline:0.5 }, valuePerks:3000,
      perks:['Lifetime free','Low income bar','Quarterly lounge'],
      pros:['One of the easiest cards to qualify for','No fee, ever','Useful first card for building a credit history'],
      cons:['0.5% base return is low','Very few premium benefits','Modest credit limits at issue'] }),

    C({ id:'indusind-legend', bank:'indusind', name:'IndusInd Legend', type:['premium','travel','lifetime-free'], art:'premium',
      annualFee:0, joiningFee:9999, feeWaiver:'Joining fee often waived on invite', rewardRate:1.4, cashback:0,
      welcome:'₹3,000 worth of gift voucher', welcomeValue:3000,
      lounge:'2 international and 8 domestic lounge visits a year',
      fuel:'1% fuel surcharge waiver', travel:'1.8% forex markup, complimentary golf',
      dining:'15% off at partner restaurants', shopping:'2x points on weekend spends',
      insurance:'₹25 lakh air accident cover', milestone:'₹1,000 voucher on ₹1.5L quarterly spend',
      redemption:'1 point = ₹0.50', minIncome:600000, rating:4.1,
      accel:{ online:1.4, dining:1.4, fuel:0, travel:1.4, offline:1.4 }, valuePerks:16000,
      perks:['Weekend 2x','Golf','No annual fee'],
      pros:['No recurring annual fee once issued','Weekend accelerator suits leisure spenders','Decent point value at ₹0.50'],
      cons:['High one-time joining fee unless waived','Lounge quota is modest for a premium card','Benefit list has thinned over time'] }),

    C({ id:'hsbc-live-plus', bank:'hsbc', name:'HSBC Live+ Card', type:['cashback','dining'], art:'dining',
      annualFee:999, joiningFee:0, feeWaiver:'Spend ₹2,00,000 in a year', rewardRate:1.5, cashback:10,
      welcome:'₹1,000 Amazon voucher on ₹20,000 spend in 30 days', welcomeValue:1000,
      lounge:'4 domestic lounge visits a year', fuel:'1% fuel surcharge waiver',
      travel:'3.5% forex markup', dining:'10% cashback on dining, food delivery and groceries',
      shopping:'1.5% on everything else', insurance:'Not included',
      milestone:'No milestone benefit', redemption:'Cashback auto-credited monthly',
      minIncome:400000, rating:4.4,
      accel:{ online:1.5, dining:10, fuel:0, travel:1.5, offline:1.5 }, valuePerks:4800,
      perks:['10% on dining','Groceries included','Free first year'],
      pros:['10% is the highest dining cashback rate available in India','Groceries and food delivery both count','First year free'],
      cons:['10% cashback is capped at ₹1,000 a month','Only 4 lounge visits a year','Weak for travel spend'] }),

    C({ id:'amex-plat-travel', bank:'amex', name:'Amex Platinum Travel', type:['travel','rewards'], art:'travel',
      annualFee:5000, joiningFee:3500, feeWaiver:'No fee waiver offered', rewardRate:1.5, cashback:0,
      welcome:'10,000 Membership Rewards points on ₹15,000 spend in 90 days', welcomeValue:5000,
      lounge:'8 domestic lounge visits a year',
      fuel:'Fuel spends do not earn points', travel:'3.5% forex markup, Taj and Marriott vouchers',
      dining:'Amex dining offers at partner restaurants', shopping:'1 point per ₹50 spent',
      insurance:'₹1 crore air accident cover',
      milestone:'₹9,000 travel vouchers on ₹1.9L spend, ₹20,000 on ₹4L spend',
      redemption:'1 point = ₹0.45 on travel vouchers', minIncome:600000, rating:4.5, popular:true,
      accel:{ online:1.5, dining:1.5, fuel:0, travel:1.5, offline:1.5 }, valuePerks:29000,
      perks:['Milestone travel vouchers','Taj vouchers','8 lounge visits'],
      pros:['Milestone vouchers alone can return 3x the annual fee','Excellent customer service and dispute handling','Taj stay voucher is genuinely valuable'],
      cons:['Amex acceptance is still limited at smaller merchants','No fee waiver regardless of spend','Fuel and utility spends earn nothing'] }),

    C({ id:'rbl-shoprite', bank:'rbl', name:'RBL ShopRite', type:['shopping','fuel'], art:'shopping',
      annualFee:500, joiningFee:500, feeWaiver:'Spend ₹1,00,000 in a year', rewardRate:1, cashback:5,
      welcome:'2,000 bonus points on first spend', welcomeValue:500,
      lounge:'Not included', fuel:'1% fuel surcharge waiver up to ₹100 a month',
      travel:'3.5% forex markup', dining:'No specific dining benefit',
      shopping:'20 points per ₹100 on grocery spends', insurance:'Not included',
      milestone:'No milestone benefit', redemption:'1 point = ₹0.25',
      minIncome:240000, rating:3.9,
      accel:{ online:1, dining:1, fuel:0, travel:1, offline:5 }, valuePerks:1200,
      perks:['5% on groceries','Low fee','Fuel waiver'],
      pros:['Strong grocery accelerator for offline supermarket spend','Low annual fee and easy waiver','Good secondary card for household spend'],
      cons:['Grocery points are capped monthly','No lounge or travel benefits','Redemption value is only ₹0.25 per point'] }),

    C({ id:'au-lit', bank:'au', name:'AU LIT Card', type:['rewards','lifetime-free'], art:'rewards',
      annualFee:0, joiningFee:0, feeWaiver:'Lifetime free, features billed separately', rewardRate:1, cashback:5,
      welcome:'No welcome bonus', welcomeValue:0, lifetimeFree:true,
      lounge:'Customisable — activate lounge access as a paid feature',
      fuel:'1% fuel surcharge waiver', travel:'0.99% forex markup when activated',
      dining:'Activate 5% dining cashback for a quarter', shopping:'Activate 5% online cashback for a quarter',
      insurance:'Not included', milestone:'No milestone benefit',
      redemption:'Cashback credited to the statement', minIncome:300000, rating:4.0,
      accel:{ online:5, dining:5, fuel:0, travel:1, offline:1 }, valuePerks:2400,
      perks:['Switch features on and off','Lifetime free','0.99% forex'],
      pros:['You only pay for the benefits you actually switch on','Lowest forex markup in its class when activated','No fixed annual fee'],
      cons:['Features must be re-activated each quarter','Cost adds up if you enable several features','Confusing for anyone who wants a set-and-forget card'] }),

    C({ id:'yes-marquee', bank:'yes', name:'YES Bank Marquee', type:['premium','travel'], art:'travel',
      annualFee:9999, joiningFee:9999, feeWaiver:'Spend ₹12,00,000 in a year', rewardRate:2, cashback:0,
      welcome:'20,000 reward points', welcomeValue:5000,
      lounge:'Unlimited domestic and 6 international lounge visits',
      fuel:'1% fuel surcharge waiver', travel:'1% forex markup, airport concierge',
      dining:'Up to 25% off at partner restaurants', shopping:'12 points per ₹200 on all spends',
      insurance:'₹5 crore air accident cover', milestone:'10,000 points on ₹6L annual spend',
      redemption:'1 point = ₹0.25 cash, higher on travel', minIncome:2400000, rating:4.0,
      accel:{ online:2, dining:2, fuel:0, travel:2, offline:2 }, valuePerks:34000,
      perks:['1% forex','Unlimited domestic lounge','Concierge'],
      pros:['Lowest forex markup among Indian premium cards','Unlimited domestic lounge access','High air accident cover'],
      cons:['Steep ₹9,999 fee and ₹24L income requirement','Smaller partner network than HDFC or Axis','Point value is average outside travel'] }),

    C({ id:'hdfc-swiggy', bank:'hdfc', name:'Swiggy HDFC Card', type:['dining','cashback'], art:'dining',
      annualFee:500, joiningFee:500, feeWaiver:'Spend ₹2,00,000 in a year', rewardRate:1, cashback:10,
      welcome:'3 months of Swiggy One membership', welcomeValue:1200,
      lounge:'Not included', fuel:'1% fuel surcharge waiver',
      travel:'3.5% forex markup', dining:'10% cashback on Swiggy food, Instamart and Dineout',
      shopping:'5% cashback on online spends across categories', insurance:'Not included',
      milestone:'No milestone benefit', redemption:'Cashback lands as Swiggy Money',
      minIncome:300000, rating:4.3, popular:true,
      accel:{ online:5, dining:10, fuel:0, travel:1, offline:1 }, valuePerks:1200,
      perks:['10% on Swiggy','5% on online spends','Swiggy One included'],
      pros:['10% back across the whole Swiggy ecosystem including groceries','5% on general online spend is generous for a ₹500 card','Swiggy One membership offsets most of the fee'],
      cons:['Cashback is paid as Swiggy Money, not cash','Monthly caps apply to both rates','Useless if you do not order from Swiggy'] }),

    C({ id:'icici-hpcl', bank:'icici', name:'ICICI HPCL Super Saver', type:['fuel','cashback'], art:'fuel',
      annualFee:500, joiningFee:500, feeWaiver:'Spend ₹1,50,000 in a year', rewardRate:1, cashback:5,
      welcome:'2,000 reward points on first spend', welcomeValue:500,
      lounge:'1 domestic lounge visit per quarter on ₹5,000 quarterly spend',
      fuel:'5% back at HPCL pumps plus 1% surcharge waiver — 6.5% effective',
      travel:'3.5% forex markup', dining:'No specific dining benefit',
      shopping:'5% back on utility and grocery spends', insurance:'Not included',
      milestone:'No milestone benefit', redemption:'1 point = ₹0.25',
      minIncome:300000, rating:4.1,
      accel:{ online:1, dining:1, fuel:6.5, travel:1, offline:1 }, valuePerks:2400,
      perks:['6.5% at HPCL','Utility cashback','Quarterly lounge'],
      pros:['Highest effective fuel return available if you use HPCL','Utility bill cashback is a genuine everyday saver','Lounge access at a ₹500 fee'],
      cons:['Fuel benefit only works at HPCL outlets','Fuel cashback capped at ₹100 a month','Base rate on other spends is only 1%'] }),

    C({ id:'axis-flipkart', bank:'axis', name:'Flipkart Axis Card', type:['shopping','cashback'], art:'shopping',
      annualFee:500, joiningFee:500, feeWaiver:'Spend ₹3,50,000 in a year', rewardRate:1, cashback:5,
      welcome:'₹600 worth of Flipkart vouchers', welcomeValue:600,
      lounge:'4 domestic lounge visits a year',
      fuel:'1% fuel surcharge waiver up to ₹400 a month', travel:'3.5% forex markup',
      dining:'4% on Swiggy, Uber and PVR', shopping:'5% unlimited cashback on Flipkart, 4% on partner merchants',
      insurance:'Not included', milestone:'No milestone benefit',
      redemption:'Cashback credited to the statement', minIncome:300000, rating:4.4, popular:true,
      accel:{ online:4, dining:4, fuel:0, travel:1.5, offline:1.5 }, valuePerks:3600,
      perks:['5% unlimited on Flipkart','4% on partners','Lounge access'],
      pros:['5% Flipkart cashback has no monthly cap','Partner list covers everyday spend like Swiggy and Uber','Lounge access at a ₹500 fee'],
      cons:['1.5% base rate on non-partner spend','Fee waiver needs a high ₹3.5L spend','Value depends on being a Flipkart shopper'] }),

    C({ id:'sbi-simplyclick', bank:'sbi', name:'SBI SimplyCLICK', type:['shopping','rewards'], art:'shopping',
      annualFee:499, joiningFee:499, feeWaiver:'Spend ₹1,00,000 in a year', rewardRate:0.6, cashback:2.5,
      welcome:'₹500 Amazon gift voucher', welcomeValue:500,
      lounge:'Not included', fuel:'1% fuel surcharge waiver up to ₹100 a month',
      travel:'3.5% forex markup', dining:'5x points on partner spends',
      shopping:'10x points on Amazon, BookMyShow, Cleartrip and other partners',
      insurance:'Not included', milestone:'₹2,000 e-voucher on ₹1L and again on ₹2L annual spend',
      redemption:'4 points = ₹1', minIncome:240000, rating:4.0,
      accel:{ online:2.5, dining:1.25, fuel:0, travel:2.5, offline:0.6 }, valuePerks:2000,
      perks:['10x on partners','Milestone vouchers','Low fee'],
      pros:['Easy approval and a low fee','Milestone vouchers are achievable at ₹1L spend','Good entry card for online shoppers'],
      cons:['Base return of 0.6% is very low','10x only applies to a fixed partner list','No lounge access'] }),

    C({ id:'kotak-zen', bank:'kotak', name:'Kotak Zen Signature', type:['rewards','travel'], art:'rewards',
      annualFee:1500, joiningFee:1500, feeWaiver:'Spend ₹1,25,000 in a year', rewardRate:1.25, cashback:0,
      welcome:'5,000 Zen points on ₹5,000 spend in 45 days', welcomeValue:1250,
      lounge:'8 domestic and 4 international lounge visits a year',
      fuel:'1% fuel surcharge waiver up to ₹3,500 a year', travel:'2% forex markup',
      dining:'15% off at partner restaurants', shopping:'5x points on your highest spend category each month',
      insurance:'₹50 lakh air accident cover', milestone:'₹750 voucher every quarter on ₹75,000 spend',
      redemption:'1 point = ₹0.25', minIncome:600000, rating:4.0,
      accel:{ online:1.25, dining:1.25, fuel:0, travel:1.25, offline:1.25 }, valuePerks:14000,
      perks:['International lounge','Auto category boost','Quarterly vouchers'],
      pros:['International lounge access at a ₹1,500 fee is unusual','The 5x auto-applies to whichever category you spend most on','Achievable ₹1.25L fee waiver'],
      cons:['Base rate is average','Point value is only ₹0.25','Partner dining network is smaller than peers'] })
  ];

  /* ---------------- stores ---------------- */
  function S(id, name, cat, cb, color, popular) {
    return { id:id, name:name, category:cat, cashback:cb, color:color, popular:!!popular,
      url:'', terms:[
        'Cashback is tracked only when you start your session from Card Crest.',
        'Ad-blockers and coupon extensions can stop tracking from working.',
        'Cashback is confirmed after the retailer’s return window closes.',
        'Cancelled or returned orders do not earn cashback.'
      ] };
  }
  var STORES = [
    S('amazon','Amazon','Shopping',4.5,'#ff9900',true),
    S('flipkart','Flipkart','Shopping',5.5,'#2874f0',true),
    S('myntra','Myntra','Fashion',7,'#ff3f6c',true),
    S('ajio','AJIO','Fashion',8,'#2d4a3e',true),
    S('nykaa','Nykaa','Beauty',9,'#fc2779',true),
    S('tatacliq','Tata CLiQ','Shopping',6.5,'#b91e40'),
    S('croma','Croma','Electronics',3.5,'#12b0ba'),
    S('reliancedigital','Reliance Digital','Electronics',3,'#0d3f8f'),
    S('makemytrip','MakeMyTrip','Travel',5,'#eb2026',true),
    S('goibibo','Goibibo','Travel',4.5,'#f6821f'),
    S('cleartrip','Cleartrip','Travel',4,'#f47b20'),
    S('yatra','Yatra','Travel',5.5,'#e4002b'),
    S('swiggy','Swiggy','Food',6,'#fc8019',true),
    S('zomato','Zomato','Food',5,'#e23744'),
    S('bigbasket','BigBasket','Grocery',4,'#84c225'),
    S('blinkit','Blinkit','Grocery',3.5,'#f8cb46'),
    S('bookmyshow','BookMyShow','Entertainment',4,'#c4242b'),
    S('firstcry','FirstCry','Shopping',7.5,'#e91e63'),
    S('pharmeasy','PharmEasy','Health',8,'#10847e'),
    S('lenskart','Lenskart','Fashion',10,'#00b7c2'),
    S('boat','boAt','Electronics',9,'#1a1a1a'),
    S('policybazaar','PolicyBazaar','Finance',12,'#0056d2'),
    S('urbancompany','Urban Company','Services',7,'#4a2c82'),
    S('decathlon','Decathlon','Sports',5,'#0082c3')
  ];

  /* ---------------- brand domains ----------------
     Logos are fetched from each brand's own site icon (see UI.logoUrl),
     so nothing is stored in the repo. A missing/blocked logo falls back to a letter. */
  var BANK_DOMAIN = {
    hdfc:'hdfcbank.com', sbi:'sbicard.com', icici:'icicibank.com', axis:'axisbank.com', idfc:'idfcfirstbank.com',
    kotak:'kotak.com', indusind:'indusind.com', hsbc:'hsbc.co.in', amex:'americanexpress.com',
    rbl:'rblbank.com', yes:'yesbank.in', au:'aubank.in', federal:'federalbank.co.in', bob:'bobcard.co.in', kiwi:'gokiwi.in', sbm:'sbm.bank.in'
  };
  var STORE_DOMAIN = {
    amazon:'amazon.in', flipkart:'flipkart.com', myntra:'myntra.com', ajio:'ajio.com', nykaa:'nykaa.com',
    tatacliq:'tatacliq.com', croma:'croma.com', reliancedigital:'reliancedigital.in', makemytrip:'makemytrip.com',
    goibibo:'goibibo.com', cleartrip:'cleartrip.com', yatra:'yatra.com', swiggy:'swiggy.com', zomato:'zomato.com',
    bigbasket:'bigbasket.com', blinkit:'blinkit.com', bookmyshow:'bookmyshow.com', firstcry:'firstcry.com',
    pharmeasy:'pharmeasy.in', lenskart:'lenskart.com', boat:'boat-lifestyle.com', policybazaar:'policybazaar.com',
    urbancompany:'urbancompany.com', decathlon:'decathlon.in'
  };
  /* Where each bank lists its credit cards and takes applications. A single card can override this with card.applyUrl. */
  var BANK_APPLY = {
    hdfc:'https://www.hdfc.bank.in/credit-cards', sbi:'https://www.sbicard.com/en/personal/credit-cards.html',
    icici:'https://www.icici.bank.in/personal-banking/cards/credit-card', axis:'https://www.axis.bank.in/cards/credit-card',
    idfc:'https://www.idfcfirst.bank.in/credit-card', kotak:'https://www.kotak.bank.in/en/personal-banking/cards/credit-cards.html',
    indusind:'https://www.indusind.bank.in/in/en/personal/cards/credit-card.html', hsbc:'https://www.hsbc.bank.in/credit-cards/',
    amex:'https://www.americanexpress.com/in/credit-cards/', rbl:'https://www.rblbank.com/credit-cards',
    yes:'https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards', au:'https://www.aubank.in/personal-banking/credit-cards',
    federal:'https://www.federalbank.co.in/credit-card', bob:'https://www.bobcard.co.in/', kiwi:'https://gokiwi.in/', sbm:'https://www.sbm.bank.in/'
  };
  BANKS.forEach(function (b) { b.domain = BANK_DOMAIN[b.id]; b.applyUrl = BANK_APPLY[b.id]; });

  /* ---------------- partner cards: apply through Card Crest and earn a reward ----------------
     `reward` is what the applicant receives in rupees once the bank approves the application: 60% of the payout, rounded to the nearest ₹50
     Card Crest receives in the 0-20 cards-a-month segment. Only the reward is kept here (this file is public), not
     Card Crest's own payout. Change the amounts when your payout sheet changes. */
  var PARTNER_CARDS = [
    ['axis-bank', 'Axis Bank Credit Card', 'axis', 1290], ['axis-lic', 'Axis LIC Credit Card', 'axis', 600],
    ['sbi-credit', 'SBI Credit Card', 'sbi', 1290], ['indusind-bajaj-tiger', 'IndusInd Bajaj Tiger Credit Card', 'indusind', 420],
    ['indusind-credit', 'IndusInd Bank Credit Card', 'indusind', 780], ['hdfc-bank', 'HDFC Bank Credit Card', 'hdfc', 1290],
    ['hsbc-credit', 'HSBC Credit Card', 'hsbc', 2280], ['au-bank', 'AU Bank Credit Card', 'au', 990],
    ['idfc-bank', 'IDFC FIRST Bank Credit Card', 'idfc', 780], ['icici-platinum', 'ICICI Bank Platinum Card', 'icici', 240],
    ['icici-coral', 'ICICI Bank Coral Card', 'icici', 780], ['rbl-bank', 'RBL Bank Credit Card', 'rbl', 720],
    ['federal-bank', 'Federal Bank Credit Card', 'federal', 420], ['rio-yes', 'RIO YES Bank Credit Card', 'yes', 840],
    ['yes-pop-plus', 'YES POP Plus Credit Card', 'yes', 1020], ['kiwi-credit', 'Kiwi Credit Card', 'kiwi', 960],
    ['bob-credit', 'Bank of Baroda Credit Card', 'bob', 240], ['au-nomo-fd', 'AU NOMO FD Card', 'au', 300],
    ['idfc-first-earn-fd', 'IDFC FIRST EARN (FD Card)', 'idfc', 210], ['sbm-magnet', 'SBM Magnet Credit Card', 'sbm', 420]
  ].map(function (p) {
    return { id: p[0], name: p[1], bank: p[2], reward: Math.round(p[3] / 50) * 50, partner: true, art: 'shopping', type: ['partner'] };
  });
  STORES.forEach(function (s) { s.domain = STORE_DOMAIN[s.id]; });

  /* ---------------- offers ---------------- */
  var OFFER_SEED = [
    ['amazon','Up to 4.5% cashback on everything','deal','',4.5,'Applies across Amazon India. Gift cards and grocery are excluded.',1,1],
    ['amazon','Extra 10% off with select bank cards','coupon','BANK10',4.5,'Minimum order ₹3,000. Card-linked discount applied at checkout.',0,1],
    ['flipkart','Flat 5.5% cashback sitewide','deal','',5.5,'Excludes mobiles bought under exchange offers.',1,1],
    ['flipkart','Big Saving Days — up to 80% off electronics','deal','',5.5,'Sale pricing applies for the sale window only.',1,0],
    ['myntra','7% cashback plus up to 70% off fashion','deal','',7,'Cashback applies on the final paid amount after discounts.',1,1],
    ['myntra','Extra ₹300 off on orders above ₹1,999','coupon','MYN300',7,'One use per user per month.',0,0],
    ['ajio','8% cashback on all fashion','deal','',8,'Not valid on Luxe collection.',1,1],
    ['ajio','Buy 2 get extra 25% off','coupon','AJIO25',8,'Applies to items marked eligible on the product page.',0,0],
    ['nykaa','9% cashback on beauty and wellness',	'deal','',9,'Excludes appliances and combo boxes.',1,1],
    ['nykaa','Free 3-piece gift over ₹1,499','coupon','NYKGIFT',9,'While stocks last.',0,0],
    ['tatacliq','6.5% cashback on all categories','deal','',6.5,'Luxury category earns a reduced rate.',1,0],
    ['croma','3.5% cashback on electronics','deal','',3.5,'Apple products earn a reduced rate.',1,0],
    ['croma','Extra ₹2,000 off on large appliances','coupon','CROMA2K',3.5,'Minimum cart value ₹25,000.',0,0],
    ['reliancedigital','3% cashback plus no-cost EMI','deal','',3,'EMI tenure varies by product.',0,0],
    ['makemytrip','5% cashback on flights and hotels','deal','',5,'Not valid on bus and cab bookings.',1,1],
    ['makemytrip','₹1,500 off domestic flights','coupon','MMTDOM',5,'Minimum booking value ₹6,000.',0,1],
    ['goibibo','4.5% cashback on hotel bookings','deal','',4.5,'Applies to prepaid bookings only.',1,0],
    ['cleartrip','4% cashback on all bookings','deal','',4,'Excludes Cleartrip for Business.',0,0],
    ['yatra','5.5% cashback on holiday packages','deal','',5.5,'Applies to packages above ₹15,000.',1,0],
    ['swiggy','6% cashback on food delivery','deal','',6,'Excludes Swiggy One membership purchases.',1,1],
    ['swiggy','60% off your first three orders','coupon','SWIGGY60',6,'New users only. Maximum discount ₹120 per order.',0,1],
    ['zomato','5% cashback plus free delivery','deal','',5,'Free delivery on orders above ₹199.',1,1],
    ['zomato','Flat ₹125 off above ₹399','coupon','ZOM125',5,'Valid once per day.',0,0],
    ['bigbasket','4% cashback on groceries','deal','',4,'Excludes bulk and wholesale orders.',1,0],
    ['blinkit','3.5% cashback on instant delivery','deal','',3.5,'Cashback tracked within 24 hours.',0,0],
    ['bookmyshow','4% cashback on movie tickets','deal','',4,'Excludes convenience fees.',0,1],
    ['bookmyshow','Buy one get one on weekday shows','coupon','BMSBOGO',4,'Valid Monday to Thursday.',0,0],
    ['firstcry','7.5% cashback on kids and baby','deal','',7.5,'Diapers earn a reduced rate.',1,0],
    ['firstcry','Extra 20% off above ₹1,500','coupon','FC20',7.5,'Not valid on premium brands.',0,0],
    ['pharmeasy','8% cashback on medicines','deal','',8,'Prescription required for applicable items.',1,0],
    ['pharmeasy','Flat 25% off first order','coupon','PEFIRST',8,'New users only.',0,0],
    ['lenskart','10% cashback on eyewear','deal','',10,'Excludes contact lens subscriptions.',1,1],
    ['lenskart','Buy one get one free frames','coupon','LKBOGO',10,'Applies to selected collections.',0,0],
    ['boat','9% cashback on audio and wearables','deal','',9,'Excludes clearance stock.',1,0],
    ['boat','Extra 15% off above ₹1,999','coupon','BOAT15',9,'One use per account.',0,0],
    ['policybazaar','₹1,200 cashback on term insurance','deal','',12,'Cashback confirmed after the free-look period ends.',1,1],
    ['policybazaar','Compare and save up to 60% on car insurance','deal','',12,'Savings vary by vehicle and location.',0,0],
    ['urbancompany','7% cashback on home services','deal','',7,'Excludes AMC plans.',1,0],
    ['urbancompany','₹200 off your first booking','coupon','UCFIRST',7,'New users only.',0,0],
    ['decathlon','5% cashback on sports gear','deal','',5,'Excludes bicycles above ₹30,000.',0,0],
    ['amazon','Amazon Fresh — 4.5% back on groceries','deal','',4.5,'Available in serviceable pincodes only.',0,0],
    ['flipkart','₹1,000 off on mobiles above ₹15,000','coupon','FKMOB1K',5.5,'One use per user.',0,1],
    ['myntra','End of Reason Sale — up to 80% off','deal','',7,'Sale pricing for the sale window only.',1,1],
    ['bigbasket','₹150 off above ₹1,000','coupon','BB150',4,'Valid on the first order of the month.',0,0],
    ['croma','Flash deal — 5% back for 48 hours','deal','',5,'Higher rate applies for the flash window only.',1,1]
  ];

  var OFFERS = OFFER_SEED.map(function (o, i) {
    var days = [3, 5, 7, 9, 12, 14, 18, 21, 26, 30][i % 10];
    return {
      id: 'off-' + String(i + 1).padStart(3, '0'),
      storeId: o[0], title: o[1], kind: o[2], code: o[3],
      cashback: o[4], terms: o[5],
      trending: !!o[6], featured: !!o[7],
      flash: /flash|48 hours/i.test(o[1]),
      expiresInDays: days,
      url: ''
    };
  });

  /* ---------------- users ---------------- */
  var USERS = [
    { id:'u-001', name:'Ayush Kumar',      email:'demo@cardcrest.in',    password:'demo1234',  mobile:'9876543210', role:'user',
      city:'Bengaluru', employment:'Salaried', income:1200000, credit:770, joined:'2026-02-11', active:true },
    { id:'u-000', name:'Card Crest Ops',   email:'admin@cardcrest.in',   password:'admin1234', mobile:'9876500000', role:'admin',
      city:'Bengaluru', employment:'Salaried', income:0, credit:0, joined:'2026-01-02', active:true },
    { id:'u-002', name:'Neha Kumari',      email:'neha@example.com',     password:'demo1234',  mobile:'9812345670', role:'user', city:'Patna',     employment:'Salaried',      income:850000,  credit:742, joined:'2026-03-04', active:true },
    { id:'u-003', name:'Subham Singhania', email:'subham@example.com',   password:'demo1234',  mobile:'9823456701', role:'user', city:'Kolkata',   employment:'Self-employed', income:1800000, credit:801, joined:'2026-03-19', active:true },
    { id:'u-004', name:'Rhea Menon',       email:'rhea@example.com',     password:'demo1234',  mobile:'9834567012', role:'user', city:'Kochi',     employment:'Salaried',      income:640000,  credit:715, joined:'2026-04-02', active:true },
    { id:'u-005', name:'Imran Sheikh',     email:'imran@example.com',    password:'demo1234',  mobile:'9845670123', role:'user', city:'Hyderabad', employment:'Salaried',      income:1450000, credit:788, joined:'2026-04-21', active:true },
    { id:'u-006', name:'Divya Rao',        email:'divya@example.com',    password:'demo1234',  mobile:'9856701234', role:'user', city:'Pune',      employment:'Salaried',      income:980000,  credit:760, joined:'2026-05-08', active:true },
    { id:'u-007', name:'Karan Bedi',       email:'karan@example.com',    password:'demo1234',  mobile:'9867012345', role:'user', city:'Delhi',     employment:'Self-employed', income:2200000, credit:812, joined:'2026-05-26', active:false },
    { id:'u-008', name:'Sneha Patel',      email:'sneha@example.com',    password:'demo1234',  mobile:'9878123456', role:'user', city:'Ahmedabad', employment:'Salaried',      income:720000,  credit:698, joined:'2026-06-14', active:true },
    { id:'u-009', name:'Arjun Nair',       email:'arjun@example.com',    password:'demo1234',  mobile:'9889234567', role:'user', city:'Chennai',   employment:'Salaried',      income:1100000, credit:754, joined:'2026-07-01', active:true },
    { id:'u-010', name:'Meera Joshi',      email:'meera@example.com',    password:'demo1234',  mobile:'9890345678', role:'user', city:'Jaipur',    employment:'Student',       income:0,       credit:0,   joined:'2026-08-03', active:true }
  ];

  /* ---------------- seed transactions ---------------- */
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
  var TXN_SEED = [
    ['u-001','amazon','off-001',  4999, 225,'confirmed', 42],
    ['u-001','myntra','off-005',  3200, 224,'confirmed', 36],
    ['u-001','swiggy','off-020',   780,  47,'confirmed', 30],
    ['u-001','makemytrip','off-015',18400,920,'pending', 12],
    ['u-001','lenskart','off-032', 2600, 260,'pending',   8],
    ['u-001','flipkart','off-003',12999, 715,'tracked',   3],
    ['u-001','nykaa','off-009',   1850, 167,'confirmed', 58],
    ['u-001','bigbasket','off-024',2240,  90,'cancelled',21],
    ['u-001','zomato','off-022',   640,  32,'confirmed', 15],
    ['u-001','policybazaar','off-036',14000,1200,'pending',5],
    ['u-002','ajio','off-007',    2990, 239,'confirmed', 25],
    ['u-002','amazon','off-001',  1299,  58,'confirmed', 19],
    ['u-003','croma','off-012',  54990,1925,'pending',   9],
    ['u-003','makemytrip','off-015',32000,1600,'confirmed',48],
    ['u-004','firstcry','off-028', 1899, 142,'confirmed', 33],
    ['u-005','boat','off-034',    3499, 315,'rejected',  27],
    ['u-005','flipkart','off-003', 8990, 494,'confirmed', 16],
    ['u-006','urbancompany','off-038',1200,84,'confirmed',11],
    ['u-007','pharmeasy','off-030',  890,  71,'pending',   6],
    ['u-008','decathlon','off-040',4500, 225,'tracked',   2],
    ['u-009','bookmyshow','off-026',960,  38,'confirmed', 44],
    ['u-010','swiggy','off-020',   420,  25,'pending',    4]
  ];

  /* ---------------- seed applications ---------------- */
  var APP_SEED = [
    ['u-001','hdfc-millennia','approved',      21],
    ['u-001','axis-ace','under-review',         6],
    ['u-001','icici-amazon','completed',       74],
    ['u-002','sbi-cashback','documents',        9],
    ['u-003','hdfc-infinia','under-review',     4],
    ['u-004','idfc-first-wealth','approved',   17],
    ['u-005','axis-magnus','rejected',         31],
    ['u-006','hsbc-live-plus','applied',        2],
    ['u-007','amex-plat-travel','approved',    28],
    ['u-009','icici-hpcl','under-review',       7]
  ];

  /* ---------------- seed referrals ---------------- */
  var REF_SEED = [
    ['u-001','Neha K.','successful', 100, 40],
    ['u-001','Imran S.','successful', 100, 33],
    ['u-001','Divya R.','successful', 100, 22],
    ['u-001','Karan B.','pending',       0, 11],
    ['u-001','Sneha P.','pending',       0,  5],
    ['u-002','Arjun N.','successful', 100, 18],
    ['u-003','Meera J.','successful', 100, 26],
    ['u-005','Rhea M.','pending',        0,  9],
    ['u-006','Anon',    'successful', 100, 14],
    ['u-009','Anon',    'pending',       0,  3]
  ];

  /* ---------------- seed notifications ---------------- */
  var NOTIF_SEED = [
    ['u-001','cashback','Cashback confirmed','₹225 from Amazon has been added to your rewards balance.', 2],
    ['u-001','cashback','Cashback pending','₹920 from MakeMyTrip is being verified by the merchant.', 12],
    ['u-001','reward','Rewards balance updated','Your available balance is now ₹2,943.', 3],
    ['u-001','application','Application approved','Your HDFC Millennia application has been approved.', 21],
    ['u-001','application','Documents needed','Axis Bank has asked for an updated address proof.', 6],
    ['u-001','offer','New offer at Lenskart','10% cashback on all eyewear, ending in 12 days.', 1],
    ['u-001','offer','Flash deal live','Croma is at 5% back for the next 48 hours.', 0],
    ['u-001','referral','Referral reward credited','Divya joined using your code. ₹100 added.', 22],
    ['u-001','system','Verify your mobile number','Confirm your number to enable reward withdrawals.', 4],
    ['u-001','cashback','Cashback cancelled','Your BigBasket order was returned, so the cashback was reversed.', 20],
    ['u-001','reward','Redemption processed','₹1,500 was sent to your UPI in demo mode.', 9],
    ['u-001','offer','Your saved card has a new benefit','HDFC Millennia added Swiggy Dineout discounts.', 15],
    ['u-001','system','New login detected','A new sign-in from Bengaluru on Chrome.', 7],
    ['u-001','offer','Myntra sale starts today','Up to 80% off plus 7% cashback.', 1],
    ['u-001','referral','Referral pending','Karan signed up. Reward credits after their first approved card.', 11]
  ];

  /* ---------------- FAQs and static copy ---------------- */
  var FAQS = [
    ['Does Card Crest charge me anything?','No. Card Crest is free for users. We earn a commission from banks and merchants when an application is approved or a purchase is tracked, and we pass part of that back to you as rewards.'],
    ['What is the card value score?','It is our estimate, from 0 to 100, of how much value a card returns relative to what it costs. It weighs the reward rate, fees, welcome benefits, lounge and travel perks and how easily points convert to rupees. It is an estimate, not a guarantee.'],
    ['Will checking my eligibility affect my credit score?','The eligibility check on Card Crest is an estimate based on the details you enter. It is not a credit bureau enquiry and does not affect your score. A hard enquiry only happens when a bank processes an actual application.'],
    ['How long does cashback take to confirm?','Most merchants confirm within 30 to 90 days, after their return window closes. Travel bookings usually confirm after the travel date. You can watch the status change in your transactions.'],
    ['Why did my cashback not track?','The most common causes are ad-blockers, coupon browser extensions, or opening the retailer in a different browser after activating. Always start the session from Card Crest and complete the purchase in the same session.'],
    ['When can I withdraw my rewards?','Once your confirmed balance reaches ₹250 you can request a withdrawal to UPI or a bank account, or take it as a gift card.'],
    ['Is Card Crest a bank or a lender?','No. We are a discovery and comparison platform. Every card is issued by the bank named on it, and approval, limits and pricing are entirely the bank’s decision.'],
    ['How does Refer and Earn work?','Share your code. When a friend signs up with it, the reward is added to your balance straight away and shows in the Refer and earn page.']
  ];

  w.CC = w.CC || {};
  w.CC.DATA = {
    bankDomains: BANK_DOMAIN, bankApply: BANK_APPLY, partnerCards: PARTNER_CARDS, storeDomains: STORE_DOMAIN,
    banks: BANKS, cards: CARDS, stores: STORES, offers: OFFERS, users: USERS,
    txnSeed: TXN_SEED, appSeed: APP_SEED, refSeed: REF_SEED, notifSeed: NOTIF_SEED,
    faqs: FAQS, daysAgo: daysAgo,
    categories: ['Shopping','Fashion','Electronics','Travel','Food','Grocery','Beauty','Entertainment','Finance','Health','Services','Sports'],
    cardTypes: [
      { id:'cashback', label:'Cashback' }, { id:'rewards', label:'Rewards' },
      { id:'travel', label:'Travel' }, { id:'fuel', label:'Fuel' },
      { id:'shopping', label:'Shopping' }, { id:'dining', label:'Dining' },
      { id:'premium', label:'Premium' }, { id:'lifetime-free', label:'Lifetime free' }
    ],
    benefitFilters: [
      { id:'lounge', label:'Lounge access' }, { id:'travel', label:'Travel benefits' },
      { id:'fuel', label:'Fuel savings' }, { id:'dining', label:'Dining offers' },
      { id:'shopping', label:'Shopping rewards' }, { id:'insurance', label:'Insurance cover' },
      { id:'milestone', label:'Milestone rewards' }
    ]
  };
})(window);
