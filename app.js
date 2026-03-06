// ========================================================
// STATE
// ========================================================
// ========================================================
// LOCAL STORAGE
// ========================================================
let knownWordsGlobal = new Set(JSON.parse(localStorage.getItem('flightWords_known') || '[]'));
function saveProgress() {
  localStorage.setItem('flightWords_known', JSON.stringify([...knownWordsGlobal]));
}

let srsData = JSON.parse(localStorage.getItem('flightWords_srs') || '{}');
function saveSRS() {
  localStorage.setItem('flightWords_srs', JSON.stringify(srsData));
}

let userScore = parseInt(localStorage.getItem('flightWords_score') || '0');
function saveScore() {
  localStorage.setItem('flightWords_score', userScore.toString());
}

const RANKS = [
  { name: 'Student Pilot', min: 0, icon: '👨‍🎓' },
  { name: 'Private Pilot', min: 200, icon: '🛩️' },
  { name: 'Commercial Pilot', min: 500, icon: '✈️' },
  { name: 'Captain', min: 1000, icon: '👨‍✈️' },
  { name: 'Fleet Manager', min: 2500, icon: '🌍' },
  { name: 'Aviation Legend', min: 5000, icon: '👑' }
];

function getRank() {
  return [...RANKS].reverse().find(r => userScore >= r.min) || RANKS[0];
}

const BADGES = [
  { id: 'first_flight', name: 'First Flight', icon: '🛫', desc: 'أول امتحان ناجح' },
  { id: 'frequent_flyer', name: 'Frequent Flyer', icon: '🎫', desc: 'أسبوع من الدراسة المتواصلة' },
  { id: 'lexicon_master', name: 'Lexicon Master', icon: '📖', desc: 'حفظ 100 كلمة' },
  { id: 'sharp_eye', name: 'Sharp Eye', icon: '🎯', desc: 'دقة 100% في امتحان' },
  { id: 'speed_demon', name: 'Speed Demon', icon: '⚡', desc: 'إنهاء التطابق في أقل من 15 ثانية' }
];

let myBadges = JSON.parse(localStorage.getItem('flightWords_badges') || '[]');
function saveBadges() {
  localStorage.setItem('flightWords_badges', JSON.stringify(myBadges));
}

function checkBadges() {
  let changed = false;
  // First Flight
  if (!myBadges.includes('first_flight') && totalQuizQuestions > 0) { myBadges.push('first_flight'); changed = true; }
  // Frequent Flyer
  if (!myBadges.includes('frequent_flyer') && streakData.streak >= 7) { myBadges.push('frequent_flyer'); changed = true; }
  // Lexicon Master
  if (!myBadges.includes('lexicon_master') && knownWordsGlobal.size >= 100) { myBadges.push('lexicon_master'); changed = true; }

  if (changed) {
    saveBadges();
    renderBadges();
  }
}

function addScore(pts) {
  userScore += pts;
  saveScore();
  checkBadges();
  updateDashboardRanks();
}

function renderBadges() {
  const container = document.getElementById('badge-gallery');
  if (!container) return;
  container.innerHTML = '';
  BADGES.forEach(b => {
    const earned = myBadges.includes(b.id);
    const div = document.createElement('div');
    div.style.cssText = `
      width: 60px; height: 60px; border-radius: 12px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: ${earned ? 'var(--deep)' : '#1a1a25'};
      border: 1px solid ${earned ? 'var(--t2)' : 'var(--border)'};
      opacity: ${earned ? '1' : '0.3'};
      transition: all 0.3s ease;
      position: relative;
    `;
    div.title = earned ? `${b.name}: ${b.desc}` : 'Locked';
    div.innerHTML = `<span style="font-size: 1.5rem">${b.icon}</span>`;
    container.appendChild(div);
  });
}

function updateDashboardRanks() {
  const r = getRank();
  const rb = document.getElementById('rank-badge');
  if (rb) rb.textContent = `${r.icon} ${r.name}`;
  const dri = document.getElementById('dash-rank-icon');
  if (dri) dri.textContent = r.icon;
  const drn = document.getElementById('dash-rank-name');
  if (drn) drn.textContent = r.name;
  const ds = document.getElementById('dash-score');
  if (ds) ds.textContent = `${userScore} XP`;
}

let streakData = JSON.parse(localStorage.getItem('flightWords_streak') || '{"streak": 0, "lastDate": ""}');
let totalStudyTime = parseInt(localStorage.getItem('flightWords_time') || '0');
let totalQuizQuestions = parseInt(localStorage.getItem('flightWords_qTotal') || '0');
let totalQuizCorrect = parseInt(localStorage.getItem('flightWords_qCorrect') || '0');

function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  if (streakData.lastDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (streakData.lastDate === yesterdayStr) streakData.streak++;
  else streakData.streak = 1;
  streakData.lastDate = today;
  localStorage.setItem('flightWords_streak', JSON.stringify(streakData));
}
updateStreak();
const badge = document.getElementById('streak-badge');
if (badge) badge.innerHTML = `🔥 ${streakData.streak}`;

setInterval(() => {
  totalStudyTime++;
  if (totalStudyTime % 60 === 0) localStorage.setItem('flightWords_time', totalStudyTime.toString());
}, 1000);

let typingInterval = null, typingStartTime = null;
let matchInterval = null, matchStartTime = null;

let currentUnit = 7;
let currentPart = 1;
let currentFeat = 'flashcard';
let currentSec = 'all';
let filteredWords = [];
let fcOrder = [], fcIndex = 0, knownSet = new Set();
let qOrder = [], qIndex = 0, qCorrect = 0, qWrong = 0, qAnswered = false;
let tOrder = [], tIndex = 0, tCorrect = 0;
let matchPairs = [], matchSelected = null, matchMatched = 0;

// Autopilot State
let autopilotActive = false;
let autopilotPaused = false;
let autopilotIndex = 0;
let autopilotTimer = null;
let autopilotPool = [];

function shuffle(array) {
  let cur = array.length, rand;
  while (cur !== 0) {
    rand = Math.floor(Math.random() * cur);
    cur--;
    [array[cur], array[rand]] = [array[rand], array[cur]];
  }
  return array;
}

function showFeat(featId) {
  currentFeat = featId;
  const unitScreen = document.getElementById('screen-unit');
  const homeScreen = document.getElementById('screen-home');

  // If we are on home screen and launching a global feature
  if (homeScreen.classList.contains('active')) {
    homeScreen.classList.remove('active');
    unitScreen.classList.add('active');
    document.querySelector('.unit-header-title').textContent = 'Global Challenge';
  }

  // Hide all features
  ['flashcard', 'quiz', 'typing', 'match', 'list', 'exam', 'story', 'summary', 'speed-challenge', 'roleplay', 'crossword'].forEach(f => {
    const el = document.getElementById('feat-' + f);
    if (el) el.classList.add('hidden');
  });

  // Show target feature
  const target = document.getElementById('feat-' + featId);
  if (target) {
    target.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Handle tab active states
  document.querySelectorAll('.feat-tab').forEach((t, i) => {
    const tabs = ['flashcard', 'quiz', 'typing', 'match', 'list', 'exam', 'story', 'summary'];
    if (tabs.includes(featId)) {
      t.classList.toggle('active', tabs[i] === featId);
    } else {
      t.classList.remove('active');
    }
  });

  if (featId === 'speed-challenge') startSpeedChallenge();
  if (featId === 'crossword') initCrossword();
  if (featId === 'roleplay') initRoleplay();
  if (featId === 'autopilot') initAutopilot();
}

let cwSolution = [];

function initCrossword() {
  const pool = shuffle(Object.values(UNITS_DATA).flatMap(u => Object.values(u.parts).flatMap(p => p.words))).filter(w => w.en.length <= 8).slice(0, 3);
  const grid = document.getElementById('cw-grid');
  const clues = document.getElementById('cw-clues');
  grid.innerHTML = ''; clues.innerHTML = '';
  cwSolution = [];

  pool.forEach((w, i) => {
    cwSolution.push(w.en.toLowerCase());
    clues.innerHTML += `<div>${i + 1}. ${w.ar} (${w.en.length} حروف)</div>`;
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.gap = '4px'; row.style.marginBottom = '4px';
    for (let j = 0; j < w.en.length; j++) {
      const input = document.createElement('input');
      input.type = 'text'; input.maxLength = 1;
      input.dataset.row = i; input.dataset.col = j;
      input.style.cssText = 'width:30px; height:30px; text-align:center; background:var(--deep); border:1px solid var(--border); color:white; border-radius:4px; text-transform:uppercase; outline:none;';
      row.appendChild(input);
    }
    grid.appendChild(row);
  });
}

function checkCrossword() {
  const inputs = document.querySelectorAll('#cw-grid input');
  let correct = true;
  inputs.forEach(input => {
    const row = parseInt(input.dataset.row);
    const col = parseInt(input.dataset.col);
    if (input.value.toLowerCase() !== cwSolution[row][col]) {
      input.style.borderColor = 'red';
      correct = false;
    } else {
      input.style.borderColor = 'var(--green)';
    }
  });
  if (correct) { playSfx('success'); addScore(40); alert('أحسنت! حل صحيح 👏'); }
  else playSfx('wrong');
}

function requestPushPermission() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      new Notification('FlightWords ✈️', { body: 'تم تفعيل التنبيهات بنجاح! سنقوم بتذكيرك بموعد رحلتك القادمة.', icon: 'icon.png' });
    }
  });
}

const RP_SCENARIO = [
  { agent: "Welcome to the terminal. May I see your passport?", user: ["here is my passport", "here it is"], avatar: "🛂" },
  { agent: "Where are you flying to today?", user: ["london", "to london"], avatar: "✈️" },
  { agent: "How many bags are you checking in?", user: ["one bag", "just one"], avatar: "🧳" },
  { agent: "Here is your boarding pass. Have a nice flight!", user: ["thank you", "thanks"], avatar: "🎫" }
];
let rpStep = 0;

function initRoleplay() {
  rpStep = 0;
  document.getElementById('rp-results').classList.add('hidden');
  renderRoleplayStep();
}

function renderRoleplayStep() {
  const step = RP_SCENARIO[rpStep];
  document.getElementById('rp-avatar').textContent = step.avatar;
  document.getElementById('rp-bubble').textContent = `"${step.agent}"`;
  document.getElementById('rp-hint').innerHTML = `قل: <strong>"${step.user[0]}"</strong>`;
  document.getElementById('rp-status').textContent = "انقر على الميكروفون وتحدث...";
  playTTS(step.agent);
}

function startRoleplaySpeech() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  const btn = document.getElementById('rp-mic-btn');
  btn.style.boxShadow = '0 0 25px red';

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.toLowerCase();
    document.getElementById('rp-status').textContent = `قلت: "${text}"`;
    const step = RP_SCENARIO[rpStep];
    const match = step.user.some(u => text.includes(u));

    if (match) {
      playSfx('correct');
      rpStep++;
      if (rpStep >= RP_SCENARIO.length) {
        document.getElementById('rp-results').classList.remove('hidden');
        addScore(50);
      } else {
        setTimeout(renderRoleplayStep, 1500);
      }
    } else {
      playSfx('wrong');
      btn.style.boxShadow = '0 0 25px orange';
    }
  };
  recognition.onend = () => { btn.style.boxShadow = 'var(--glow)'; };
  recognition.start();
}

let searchTimeout = null;
function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = document.getElementById('global-search').value.trim().toLowerCase();
    const heroUnits = document.getElementById('hero-units');
    const searchResults = document.getElementById('search-results');
    if (query.length < 2) {
      heroUnits.classList.remove('hidden');
      searchResults.classList.add('hidden');
      return;
    }
    heroUnits.classList.add('hidden');
    searchResults.classList.remove('hidden');
    searchResults.innerHTML = `<h3 style="color:var(--t2); margin-bottom:15px">نتائج البحث عن: "${query}"</h3>`;
    const results = [];

    // Search in Custom Words
    customWords.forEach(w => {
      if (w.en.toLowerCase().includes(query) || (w.ar && w.ar.includes(query))) results.push({ ...w, unit: 0 });
    });

    // Search in Units
    Object.keys(UNITS_DATA).forEach(uIdx => {
      const u = UNITS_DATA[uIdx];
      if (!u.parts) return;
      Object.keys(u.parts).forEach(pIdx => {
        const p = u.parts[pIdx];
        if (!p.words) return;
        p.words.forEach(w => {
          if (w.en.toLowerCase().includes(query) || (w.ar && w.ar.includes(query))) results.push({ ...w, unit: uIdx, part: pIdx });
        });
      });
    });

    if (!results.length) {
      searchResults.innerHTML += `<div style="text-align:center; padding:40px; color:var(--muted)">لا توجد نتائج 🔍</div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'terms-grid';
    // Limit to 20 results for performance
    results.slice(0, 20).forEach(w => {
      const card = document.createElement('div');
      card.className = 'unit-card';
      card.style.padding = '15px';
      card.onclick = () => {
        if (w.unit !== 0) openUnit(parseInt(w.unit));
        else { /* Show custom word? */ }
      };
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center">
          <span style="font-weight:900; color:var(--t1)">${w.icon || ''} ${w.en}</span>
          <span style="font-size:0.7rem; background:var(--panel); padding:2px 6px; border-radius:4px">${w.unit === 0 ? 'خاص' : 'وحدة ' + w.unit}</span>
        </div>
        <div style="color:var(--t2); margin-top:8px">${w.ar || ''}</div>
      `;
      grid.appendChild(card);
    });
    searchResults.appendChild(grid);
  }, 300); // 300ms debounce
}

// ========================================================
// NAV
// ========================================================
let customWords = JSON.parse(localStorage.getItem('flightWords_custom') || '[]');
if (typeof UNITS_DATA !== 'undefined') {
  UNITS_DATA[0] = {
    term: 0,
    title: "My Words",
    desc: "كلماتي الخاصة",
    parts: {
      1: {
        label: "قائمتي",
        sections: { "all": { label: "الكل", color: "#20c070" } },
        words: customWords
      }
    }
  };
}

function showAddWordModal() {
  document.getElementById('cw-en').value = '';
  document.getElementById('cw-ar').value = '';
  document.getElementById('cw-type').value = '';
  document.getElementById('add-word-modal').style.display = 'flex';
}

function saveCustomWord() {
  const en = document.getElementById('cw-en').value.trim();
  const ar = document.getElementById('cw-ar').value.trim();
  const type = document.getElementById('cw-type').value.trim();
  if (!en || !ar) { alert('الرجاء إدخال الكلمة ومعناها'); return; }

  customWords.push({ en, ar, type: type || 'n.', s: 'all', def: 'Custom word' });
  localStorage.setItem('flightWords_custom', JSON.stringify(customWords));
  document.getElementById('add-word-modal').style.display = 'none';

  UNITS_DATA[0].parts[1].words = customWords;
  alert('تم إضافة الكلمة بنجاح! 🎉');
  if (currentUnit === 0) applyFilter();
}

function goHome() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-home').classList.add('active');
  const search = document.getElementById('global-search');
  if (search) search.value = '';
}

function openDashboard() {
  updateDashboardRanks();
  renderBadges();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-dashboard').classList.add('active');
  document.getElementById('dash-streak').textContent = streakData.streak;
  document.getElementById('dash-time').textContent = Math.floor(totalStudyTime / 60) + 'm';
  const acc = totalQuizQuestions > 0 ? Math.round((totalQuizCorrect / totalQuizQuestions) * 100) : 0;
  document.getElementById('dash-accuracy').textContent = acc + '%';
  document.getElementById('dash-words').textContent = knownWordsGlobal.size;
}

function openTermOrUnit(term, unit) {
  if (term === 1) { alert('الترم الأول قريبًا! 🔒\nهنضيف الوحدات وحدة وحدة 🚀'); return; }
}

function openUnit(unitNum) {
  currentUnit = unitNum;
  const unit = UNITS_DATA[unitNum];
  if (!unit) { showComingSoon(unitNum); return; }
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-unit').classList.add('active');
  document.getElementById('unit-header-title').textContent = unitNum === 0 ? "My Words" : `Unit ${unitNum} – ${unit.title}`;
  document.getElementById('unit-term-badge').textContent = unitNum === 0 ? "خاص" : `ترم ${unit.term}`;
  document.getElementById('unit-term-badge').className = 'unit-header-badge ' + (unitNum === 0 ? 't1-badge' : (unit.term === 1 ? 't1-badge' : 't2-badge'));
  currentPart = 1;
  currentFeat = 'flashcard';
  document.querySelectorAll('.feat-tab').forEach((t, i) => { t.classList.toggle('active', i === 0); });
  buildPartTabs();
  switchPart(1);
}

function showComingSoon(unitNum) {
  alert(`Unit ${unitNum} قريبًا! 🔒\nهنضيف الكلمات لما تبعتها 📸`);
}

function buildPartTabs() {
  const unit = UNITS_DATA[currentUnit];
  const bar = document.getElementById('part-tabs-bar');
  bar.innerHTML = '';
  Object.keys(unit.parts).forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'part-tab' + (i === 0 ? ' ap1' : '');
    btn.id = `ptab${p}`;
    btn.textContent = unit.parts[p].label;
    btn.onclick = () => switchPart(Number(p));
    bar.appendChild(btn);
  });
}

function switchPart(p) {
  currentPart = p;
  currentSec = 'all';
  document.querySelectorAll('.part-tab').forEach((b, i) => {
    b.className = 'part-tab' + (i === p - 1 ? (p === 1 ? ' ap1' : ' ap2') : '');
  });
  buildSecSelector();
  applyFilter();
}

function buildSecSelector() {
  const unit = UNITS_DATA[currentUnit];
  const partData = unit.parts[currentPart];
  const secs = Object.keys(partData.sections);
  const div = document.getElementById('sec-selector');
  div.innerHTML = '<button class="sec-btn active" onclick="setSec(\'all\',this)">الكل</button>';
  secs.forEach(s => {
    const info = partData.sections[s];
    const btn = document.createElement('button');
    btn.className = 'sec-btn';
    btn.textContent = info.label;
    btn.onclick = function () { setSec(s, this); };
    div.appendChild(btn);
  });
}

function setSec(sec, btn) {
  currentSec = sec;
  document.querySelectorAll('.sec-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

function applyFilter() {
  const unit = UNITS_DATA[currentUnit];
  const words = unit.parts[currentPart].words;
  filteredWords = currentSec === 'all' ? [...words] : words.filter(w => w.s === currentSec);
  knownSet.clear();

  const now = Date.now();
  const unk = [], kn = [];

  filteredWords.forEach((w, i) => {
    if (knownWordsGlobal.has(w.en)) { knownSet.add(i); kn.push(i); }
    else { unk.push(i); }
  });

  unk.sort((a, b) => {
    const srsA = srsData[filteredWords[a].en];
    const srsB = srsData[filteredWords[b].en];
    const priA = !srsA ? 1 : (srsA.nextReview <= now ? 0 : 2);
    const priB = !srsB ? 1 : (srsB.nextReview <= now ? 0 : 2);
    if (priA !== priB) return priA - priB;
    if (srsA && srsB) return srsA.nextReview - srsB.nextReview;
    return 0;
  });

  fcOrder = [...unk, ...shuffle(kn)];
  fcIndex = 0;
  qOrder = shuffle([...Array(filteredWords.length).keys()]);
  qIndex = 0; qCorrect = 0; qWrong = 0;
  tOrder = shuffle([...Array(filteredWords.length).keys()]);
  tIndex = 0; tCorrect = 0;
  clearInterval(typingInterval); clearInterval(matchInterval);
  if (document.getElementById('t-live-time')) document.getElementById('t-live-time').textContent = '0.0s';
  if (document.getElementById('match-live-time')) document.getElementById('match-live-time').textContent = '0.0s';
  if (currentFeat === 'flashcard') renderCard();
  else if (currentFeat === 'quiz') { document.getElementById('q-results').classList.add('hidden'); document.getElementById('quiz-body').classList.remove('hidden'); renderQuestion(); }
  else if (currentFeat === 'typing') renderTyping();
  else if (currentFeat === 'match') newMatchRound();
  else if (currentFeat === 'list') renderList();
  else if (currentFeat === 'exam') renderExam();
  else if (currentFeat === 'story') renderStory();
  else if (currentFeat === 'summary') renderSummary();
}


// ========================================================
// TEXT TO SPEECH & SPEECH RECOGNITION
// ========================================================
function playTTS(text) {
  if (!('speechSynthesis' in window)) {
    alert('متصفحك لا يدعم النطق الصوتي.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}

function startSpeechRecognition(targetWord) {
  if (!recognition) {
    alert("متصفحك لا يدعم التعرف على الصوت.");
    return;
  }
  const feedbackEl = document.getElementById('speech-feedback');
  if (feedbackEl) feedbackEl.textContent = '👂...';

  recognition.onresult = function (event) {
    const spoken = event.results[0][0].transcript.toLowerCase().replace(/[.,!?]/g, '').trim();
    const target = targetWord.toLowerCase().replace(/[.,!?]/g, '').trim();

    if (spoken === target) {
      if (feedbackEl) feedbackEl.textContent = '🟢';
      playSfx('success');
    } else if (target.includes(spoken) || spoken.includes(target)) {
      if (feedbackEl) feedbackEl.textContent = '🟡';
    } else {
      if (feedbackEl) feedbackEl.textContent = '🔴';
      playSfx('wrong');
      console.log(`Expected: ${target}, Heard: ${spoken}`);
    }
  };

  recognition.onerror = function (event) {
    if (feedbackEl) feedbackEl.textContent = '❌';
    console.error('Speech recognition error', event.error);
  };

  recognition.start();
}

// ========================================================
// SOUND EFFECTS (AudioContext)
// ========================================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSfx(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  if (type === 'correct') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  } else if (type === 'wrong') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  } else if (type === 'success') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
  }
}

// ========================================================
// FLASHCARD
// ========================================================
function getSectionInfo(s) {
  const unit = UNITS_DATA[currentUnit];
  return unit.parts[currentPart].sections[s] || { label: s, color: '#555' };
}

function renderCard() {
  if (!filteredWords.length) return;
  const w = filteredWords[fcOrder[fcIndex]];
  document.getElementById('fc-word').innerHTML = (w.icon || '') + ' ' + w.en;
  document.getElementById('fc-type').textContent = w.type || '';
  const sl = getSectionInfo(w.s).label;
  document.getElementById('fc-sec-tag').textContent = sl;
  document.getElementById('fc-back-sec').textContent = sl;
  document.getElementById('fc-ar').textContent = w.ar;
  document.getElementById('fc-def').textContent = w.def || '';
  const exEl = document.getElementById('fc-ex');
  if (exEl) exEl.innerHTML = w.ex ? `"${w.ex}"` : (w.en === 'conveyor belt' ? '"Put your luggage on the conveyor belt."' : '');

  document.getElementById('fc-card').classList.remove('flipped');
  const feed = document.getElementById('speech-feedback');
  if (feed) feed.textContent = '';
  const pct = ((fcIndex + 1) / filteredWords.length * 100).toFixed(0);
  document.getElementById('fc-bar').style.width = pct + '%';
  document.getElementById('fc-label').textContent = `${fcIndex + 1} / ${filteredWords.length}`;
  document.getElementById('fc-known-count').textContent = `✅ ${knownSet.size} محفوظ`;
  document.getElementById('know-stats').textContent = `${knownSet.size} من ${filteredWords.length} محفوظين`;
}
function flipCard() { document.getElementById('fc-card').classList.toggle('flipped'); }
function markCard(k) {
  const i = fcOrder[fcIndex];
  const w = filteredWords[i];

  let item = srsData[w.en] || { interval: 0, repetition: 0, efactor: 2.5 };
  const q = k ? 4 : 1;
  if (q >= 3) {
    if (item.repetition === 0) item.interval = 1;
    else if (item.repetition === 1) item.interval = 6;
    else item.interval = Math.round(item.interval * item.efactor);
    item.repetition++;
    item.efactor = item.efactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  } else {
    item.repetition = 0;
    item.interval = 1;
    item.efactor = Math.max(1.3, item.efactor - 0.2);
  }
  item.efactor = Math.max(1.3, item.efactor);
  item.nextReview = Date.now() + item.interval * 24 * 60 * 60 * 1000;
  srsData[w.en] = item;
  saveSRS();

  if (k) {
    knownSet.add(i);
    knownWordsGlobal.add(w.en);
  } else {
    knownSet.delete(i);
    knownWordsGlobal.delete(w.en);
  }
  saveProgress();
  nextCard();
}
function nextCard() { fcIndex = (fcIndex + 1) % filteredWords.length; renderCard(); }
function prevCard() { fcIndex = (fcIndex - 1 + filteredWords.length) % filteredWords.length; renderCard(); }
function shuffleCards() {
  const unk = [], kn = [];
  filteredWords.forEach((w, i) => { if (knownSet.has(i)) kn.push(i); else unk.push(i); });
  fcOrder = [...shuffle(unk), ...shuffle(kn)];
  fcIndex = 0;
  renderCard();
}
function reviewUnknown() { const u = fcOrder.filter(i => !knownSet.has(i)); if (!u.length) { alert('🎉 حافظت كل الكلمات!'); return; } fcOrder = shuffle(u); fcIndex = 0; renderCard(); }

// ========================================================
// QUIZ
// ========================================================
function renderQuestion() {
  if (!filteredWords.length) return;
  document.getElementById('q-results').classList.add('hidden');
  document.getElementById('quiz-body').classList.remove('hidden');
  document.getElementById('q-feedback').textContent = '';
  document.getElementById('q-next-btn').classList.add('hidden');
  qAnswered = false;
  const w = filteredWords[qOrder[qIndex]];
  document.getElementById('q-word').textContent = w.en;
  document.getElementById('q-type').textContent = w.type || '';
  document.getElementById('q-sec').textContent = getSectionInfo(w.s).label;
  const wrong = shuffle(filteredWords.filter((_, i) => i !== qOrder[qIndex])).slice(0, 3);
  const opts = shuffle([w, ...wrong]);
  const grid = document.getElementById('opts-grid');
  grid.innerHTML = '';
  opts.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn'; btn.textContent = o.ar;
    btn.onclick = () => selectOpt(btn, o.en === w.en, w.ar);
    grid.appendChild(btn);
  });
  const pct = ((qIndex + 1) / filteredWords.length * 100).toFixed(0);
  document.getElementById('q-bar').style.width = pct + '%';
  document.getElementById('q-label').textContent = `${qIndex + 1} / ${filteredWords.length}`;
  document.getElementById('q-score').innerHTML = `✅ ${qCorrect} | ❌ ${qWrong}`;
}
function selectOpt(btn, correct, correctAr) {
  if (qAnswered) return; qAnswered = true;
  const fb = document.getElementById('q-feedback');
  if (correct) { playSfx('correct'); btn.classList.add('correct'); fb.textContent = '✅ صح!'; fb.className = 'fb-msg ok'; qCorrect++; }
  else {
    playSfx('wrong');
    btn.classList.add('wrong'); fb.textContent = `❌ غلط — الصح: ${correctAr}`; fb.className = 'fb-msg no'; qWrong++;
    document.querySelectorAll('.opt-btn').forEach(b => { if (b.textContent === correctAr) b.classList.add('correct'); });
  }
  document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
  document.getElementById('q-next-btn').classList.remove('hidden');
  document.getElementById('q-score').innerHTML = `✅ ${qCorrect} | ❌ ${qWrong}`;
}
function nextQuestion() { qIndex++; if (qIndex >= filteredWords.length) { showQResults(); return; } renderQuestion(); }
function showQResults() {
  document.getElementById('quiz-body').classList.add('hidden');
  document.getElementById('q-results').classList.remove('hidden');
  const pct = Math.round(qCorrect / filteredWords.length * 100);
  if (pct >= 90) playSfx('success');
  document.getElementById('q-final').textContent = `${qCorrect} / ${filteredWords.length}`;
  document.getElementById('q-result-msg').textContent = pct >= 90 ? '🔥 ممتاز!' : pct >= 70 ? '👍 كويس، راجع الغلط' : '💪 تحتاج مراجعة أكتر';

  addScore(qCorrect * 5);
  if (pct === 100 && filteredWords.length >= 5 && !myBadges.includes('sharp_eye')) { myBadges.push('sharp_eye'); saveBadges(); }

  totalQuizQuestions += filteredWords.length;
  totalQuizCorrect += qCorrect;
  localStorage.setItem('flightWords_qTotal', totalQuizQuestions.toString());
  localStorage.setItem('flightWords_qCorrect', totalQuizCorrect.toString());
}
function restartQuiz() { qIndex = 0; qCorrect = 0; qWrong = 0; qOrder = shuffle([...Array(filteredWords.length).keys()]); renderQuestion(); }

// ========================================================
// TYPING
// ========================================================
function renderTyping() {
  document.getElementById('t-results').classList.add('hidden');
  if (tIndex >= filteredWords.length) { showTypingResults(); return; }
  const w = filteredWords[tOrder[tIndex]];
  document.getElementById('t-ar').textContent = w.ar;
  document.getElementById('t-hint-sec').textContent = getSectionInfo(w.s).label;
  const inp = document.getElementById('t-input');
  inp.value = ''; inp.className = 'typing-input'; inp.disabled = false; inp.focus();
  document.getElementById('t-feedback').textContent = '';
  document.getElementById('t-feedback').className = 't-fb';
  const pct = ((tIndex + 1) / filteredWords.length * 100).toFixed(0);
  document.getElementById('t-bar').style.width = pct + '%';
  document.getElementById('t-label').textContent = `${tIndex + 1} / ${filteredWords.length}`;
  document.getElementById('t-score').textContent = `✅ ${tCorrect}`;
  if (tIndex === 0) {
    typingStartTime = Date.now();
    clearInterval(typingInterval);
    typingInterval = setInterval(() => { document.getElementById('t-live-time').textContent = ((Date.now() - typingStartTime) / 1000).toFixed(1) + 's'; }, 100);
  }
}
function checkTyping() {
  const w = filteredWords[tOrder[tIndex]];
  if (document.getElementById('t-input').value.trim().toLowerCase() === w.en.toLowerCase()) {
    playSfx('correct');
    document.getElementById('t-input').className = 'typing-input ci';
    document.getElementById('t-feedback').textContent = '✅ صح!';
    document.getElementById('t-feedback').className = 't-fb ok';
    document.getElementById('t-input').disabled = true;
    tCorrect++; setTimeout(() => { tIndex++; renderTyping(); }, 700);
  }
}
function typingKeydown(e) {
  if (e.key === 'Enter') {
    const w = filteredWords[tOrder[tIndex]];
    if (document.getElementById('t-input').value.trim().toLowerCase() !== w.en.toLowerCase()) {
      playSfx('wrong');
      document.getElementById('t-input').className = 'typing-input wi';
      document.getElementById('t-feedback').textContent = `❌ الصح: ${w.en}`;
      document.getElementById('t-feedback').className = 't-fb no';
      document.getElementById('t-input').disabled = true;
      setTimeout(() => { tIndex++; renderTyping(); }, 1100);
    }
  }
}
function skipTyping() { tIndex++; renderTyping(); }
function showTypingHint() {
  const w = filteredWords[tOrder[tIndex]];
  document.getElementById('t-feedback').textContent = `💡 ${w.en.split('').map((c, i) => i === 0 || c === ' ' ? c : '_').join('')}`;
}
function showTypingResults() {
  clearInterval(typingInterval);
  document.getElementById('t-results').classList.remove('hidden');
  const pct = Math.round(tCorrect / filteredWords.length * 100);
  if (pct >= 90) playSfx('success');
  document.getElementById('t-final').textContent = `${tCorrect} / ${filteredWords.length}`;
  document.getElementById('t-result-msg').textContent = pct >= 90 ? '🔥 إملاء ممتاز!' : pct >= 70 ? '👍 كويس جداً' : '💪 تمرّن أكتر';
}
function restartTyping() { tIndex = 0; tCorrect = 0; tOrder = shuffle([...Array(filteredWords.length).keys()]); renderTyping(); }

// ========================================================
// MATCH & MULTIPLAYER
// ========================================================
function generateMatchLink() {
  const url = new URL(window.location.href);
  url.searchParams.set('match', `u${currentUnit}p${currentPart}`);
  navigator.clipboard.writeText(url.toString()).then(() => {
    alert('تم نسخ رابط التحدي! شاركه مع أصدقائك 🚀\n\n' + url.toString());
  }).catch(err => {
    console.error('Failed to copy', err);
    alert('الرابط:\n' + url.toString());
  });
}

function newMatchRound() {
  document.getElementById('match-results').classList.add('hidden');
  const pool = shuffle(filteredWords).slice(0, Math.min(6, filteredWords.length));
  matchPairs = pool; matchSelected = null; matchMatched = 0;
  matchStartTime = Date.now();
  clearInterval(matchInterval);
  matchInterval = setInterval(() => { document.getElementById('match-live-time').textContent = ((Date.now() - matchStartTime) / 1000).toFixed(1) + 's'; }, 100);
  const en = shuffle(pool.map((w, i) => ({ ...w, idx: i, side: 'en' })));
  const ar = shuffle(pool.map((w, i) => ({ ...w, idx: i, side: 'ar' })));
  const combined = []; for (let i = 0; i < pool.length; i++) { combined.push(en[i]); combined.push(ar[i]); }
  const grid = document.getElementById('match-grid'); grid.innerHTML = '';
  combined.forEach(item => {
    const div = document.createElement('div');
    div.className = `match-item ${item.side}-item`;
    div.textContent = item.side === 'en' ? item.en : item.ar;
    div.dataset.idx = item.idx; div.dataset.side = item.side;
    div.onclick = () => matchClick(div, item);
    grid.appendChild(div);
  });
  document.getElementById('match-score').textContent = `0 / ${pool.length} متطابق`;
}
function matchClick(div, item) {
  if (div.classList.contains('matched')) return;
  if (!matchSelected) { matchSelected = { div, item }; div.classList.add('selected'); }
  else {
    if (matchSelected.div === div) { div.classList.remove('selected'); matchSelected = null; return; }
    const a = matchSelected, b = { div, item };
    if (a.item.idx === b.item.idx && a.item.side !== b.item.side) {
      playSfx('correct');
      a.div.classList.remove('selected'); a.div.classList.add('matched');
      b.div.classList.remove('selected'); b.div.classList.add('matched');
      matchMatched++;
      document.getElementById('match-score').textContent = `${matchMatched} / ${matchPairs.length} متطابق`;
      matchSelected = null;
      if (matchMatched === matchPairs.length) {
        clearInterval(matchInterval);
        playSfx('success');
        const el = ((Date.now() - matchStartTime) / 1000);
        document.getElementById('match-time').textContent = el.toFixed(1);
        addScore(25);
        if (el < 15 && !myBadges.includes('speed_demon')) { myBadges.push('speed_demon'); saveBadges(); }

        setTimeout(() => document.getElementById('match-results').classList.remove('hidden'), 400);
      }
    } else {
      playSfx('wrong');
      a.div.classList.remove('selected'); a.div.classList.add('wrong-shake'); b.div.classList.add('wrong-shake');
      setTimeout(() => { a.div.classList.remove('wrong-shake'); b.div.classList.remove('wrong-shake'); }, 400);
      matchSelected = null;
    }
  }
}

// ========================================================
// LIST
// ========================================================
function exportWordsToPDF() {
  const content = document.getElementById('list-container').innerHTML;
  const win = window.open('', '', 'height=700,width=900');
  win.document.write('<html><head><title>FlightWords - Export</title>');
  win.document.write('<style>body{font-family:sans-serif; padding:40px; color:#111;} .unit-header-title{font-size:24px; font-weight:bold; margin-bottom:20px;} .word-table{width:100%; border-collapse:collapse;} .word-table th, .word-table td{border:1px solid #ddd; padding:10px; text-align:left;} .word-table th{background:#f4f4f4;} .ar-cell{direction:rtl; text-align:right;} .en-cell{font-weight:bold;}</style>');
  win.document.write('</head><body>');
  win.document.write(content);
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(() => win.print(), 500);
}

function renderList() {
  const unit = UNITS_DATA[currentUnit];
  const partData = unit.parts[currentPart];
  const container = document.getElementById('list-container'); container.innerHTML = '';

  const hdrRow = document.createElement('div');
  hdrRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;';
  hdrRow.innerHTML = `<div class="unit-header-title" style="margin:0">${unit.title}</div>
    <button class="btn sm" onclick="exportWordsToPDF()" style="background:#20c070; color:white; border:none; padding:8px 16px;">📄 PDF</button>`;
  container.appendChild(hdrRow);

  const secs = [...new Set(filteredWords.map(w => w.s))];
  secs.forEach(sec => {
    const words = filteredWords.filter(w => w.s === sec); if (!words.length) return;
    const info = partData.sections[sec];
    const hdr = document.createElement('div'); hdr.className = 'cat-header';
    hdr.innerHTML = `<div class="cat-badge" style="background:${info?.color || '#555'}">${info?.label || sec}</div><div class="cat-line"></div>`;
    container.appendChild(hdr);
    const wrap = document.createElement('div'); wrap.style.overflowX = 'auto';
    const tbl = document.createElement('table'); tbl.className = 'word-table';
    tbl.innerHTML = `<thead><tr><th>الكلمة</th><th>المعنى</th><th>التعريف</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    words.forEach(w => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="en-cell">${w.icon || ''} ${w.en}</span> <span class="type-pill">${w.type || ''}</span></td><td class="ar-cell">${w.ar}</td><td class="def-cell">${w.def || ''}</td>`;
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody); wrap.appendChild(tbl); container.appendChild(wrap);
  });
}

// ========================================================
// EXAM
// ========================================================
function renderExam() {
  const container = document.getElementById('exam-container'); container.innerHTML = '';
  const pool = filteredWords.filter(w => !w.s.includes('G') && !w.s.includes('F'));
  if (pool.length < 4) { container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">⚠️ اختر قسمًا أكبر أو الكل</div>'; return; }
  const picked = shuffle(pool);

  function makeSection(title) { const d = document.createElement('div'); d.className = 'exam-section'; d.innerHTML = `<h3>${title}</h3>`; return d; }

  // Section A: Choose
  const sA = makeSection('📝 A – Choose the correct answer');
  picked.slice(0, 6).forEach((w, i) => {
    const wrong = shuffle(pool.filter(x => x.en !== w.en)).slice(0, 3);
    const opts = shuffle([w, ...wrong]);
    const qd = document.createElement('div'); qd.className = 'exam-q';
    qd.innerHTML = `<div class="eq-num">Q${i + 1}</div>
    <div class="eq-text">"<strong>${w.en}</strong>" means ……… in Arabic.</div>
    <div class="eq-choices">${opts.map(o => `<span class="choice" data-a="${o.en === w.en}" onclick="chooseExam(this,'${w.en}')">${o.ar}</span>`).join('')}</div>`;
    sA.appendChild(qd);
  });
  container.appendChild(sA);

  // Section B: Fill blanks
  const sB = makeSection('✍️ B – Fill in the blanks');
  const fillW = shuffle(pool).slice(0, 5);
  const bankSpan = shuffle([...fillW, ...shuffle(pool).slice(0, 3)]).slice(0, 8).map(w => w.en);
  const bankD = document.createElement('div');
  bankD.style.cssText = 'background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:11px 14px;margin-bottom:12px;direction:ltr;';
  bankD.innerHTML = `<span style="font-size:.78rem;color:var(--muted)">Word Bank: </span><span style="font-family:'JetBrains Mono',monospace;font-size:.78rem;color:var(--t2)">${shuffle(bankSpan).join(' – ')}</span>`;
  sB.appendChild(bankD);
  const templates = [
    w => `After a long flight, travellers usually find the <span class="blank" data-word="${w.en}" onclick="revealBlank(this)">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> crowded with passengers.`,
    w => `You need a valid <span class="blank" data-word="${w.en}" onclick="revealBlank(this)">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> to enter a foreign country.`,
    w => `The officer was trained to <span class="blank" data-word="${w.en}" onclick="revealBlank(this)">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> any difficult situation calmly.`,
    w => `She always feels <span class="blank" data-word="${w.en}" onclick="revealBlank(this)">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> before an international flight.`,
    w => `A <span class="blank" data-word="${w.en}" onclick="revealBlank(this)">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> allows you to board the plane.`,
  ];
  fillW.slice(0, 5).forEach((w, i) => {
    const qd = document.createElement('div'); qd.className = 'exam-q';
    qd.innerHTML = `<div class="eq-num">Q${i + 1} <span style="color:var(--muted);font-size:.7rem">(اضغط على الفراغ للإجابة)</span></div>
    <div class="eq-text">${templates[i % templates.length](w)}</div>
    <div class="eq-note">المعنى: ${w.ar}</div>`;
    sB.appendChild(qd);
  });
  container.appendChild(sB);

  // Section C: Odd one out
  const sC = makeSection('🔍 C – Find the odd word out');
  const oddSets = [
    { words: ['boarding pass', 'passport', 'visa', 'souvenir'], odd: 'souvenir', reason: 'The others are travel documents.' },
    { words: ['stressed', 'frustrated', 'flexible', 'overwhelmed'], odd: 'flexible', reason: 'The others express negative feelings.' },
    { words: ['terminal', 'gate', 'departure lounge', 'checklist'], odd: 'checklist', reason: 'The others are airport locations.' },
    { words: ['handle', 'navigate', 'reassure', 'error'], odd: 'error', reason: 'The others are verbs (actions).' },
    { words: ['luggage', 'boarding pass', 'souvenir', 'passport'], odd: 'souvenir', reason: 'The others are necessary travel items.' },
  ];
  shuffle(oddSets).slice(0, 3).forEach((set, i) => {
    const qd = document.createElement('div'); qd.className = 'exam-q';
    qd.innerHTML = `<div class="eq-num">Q${i + 1}</div>
    <div class="eq-text">Find the odd one out:</div>
    <div class="eq-choices">${set.words.map(w => `<span class="choice" data-correct="${w === set.odd}" data-reason="${set.reason}" onclick="oddExam(this,\`${set.reason}\`)">${w}</span>`).join('')}</div>`;
    sC.appendChild(qd);
  });
  container.appendChild(sC);

  // Section D: Match column
  const sD = makeSection('🔗 D – Match Column A with Column B');
  const matchW = shuffle(pool).slice(0, 5);
  const shuffledAr = shuffle([...matchW]);
  const colA = matchW.map((w, i) => `<div style="margin-bottom:8px;direction:ltr;font-family:'JetBrains Mono',monospace;font-size:.82rem;color:var(--t2)">${i + 1}. ${w.en}</div>`).join('');
  const colB = shuffledAr.map((w, i) => `<div style="margin-bottom:8px">${String.fromCharCode(65 + i)}. ${w.ar}</div>`).join('');
  const ansKey = matchW.map((w, i) => `${i + 1}→${String.fromCharCode(65 + shuffledAr.findIndex(x => x.en === w.en))}`).join('  ');
  const qd = document.createElement('div'); qd.className = 'exam-q';
  qd.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
    <div><div style="font-size:.75rem;color:var(--muted);margin-bottom:7px;font-family:'JetBrains Mono',monospace">COLUMN A</div>${colA}</div>
    <div><div style="font-size:.75rem;color:var(--muted);margin-bottom:7px;font-family:'JetBrains Mono',monospace">COLUMN B</div>${colB}</div>
  </div>
  <button class="btn sm" style="margin-top:10px" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">👁 إظهار الإجابات</button>
  <div style="display:none;margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:.8rem;color:var(--green)">${ansKey}</div>`;
  sD.appendChild(qd);
  container.appendChild(sD);
}
function chooseExam(el, correctEn) {
  const parent = el.closest('.exam-q');
  if (parent.querySelector('.sc,.sw')) return;
  const ok = el.dataset.a === 'true';
  el.classList.add(ok ? 'sc' : 'sw');
  if (!ok) parent.querySelectorAll('.choice').forEach(c => { if (c.dataset.a === 'true') c.classList.add('sa'); });
}
function revealBlank(el) { el.classList.toggle('revealed'); if (el.classList.contains('revealed')) el.textContent = el.dataset.word; else el.innerHTML = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'; }
function oddExam(el, reason) {
  const parent = el.closest('.exam-q');
  if (parent.querySelector('.sc,.sw')) return;
  const ok = el.dataset.correct === 'true';
  el.classList.add(ok ? 'sc' : 'sw');
  if (ok) { const n = document.createElement('div'); n.className = 'eq-note'; n.style.marginTop = '8px'; n.textContent = '✅ ' + reason; parent.appendChild(n); }
  else parent.querySelectorAll('.choice').forEach(c => { if (c.dataset.correct === 'true') c.classList.add('sa'); });
}

// ========================================================
// STORY
// ========================================================
function renderStory() {
  const container = document.getElementById('story-container');
  const s1 = `<div class="story-card">
  <h3>✈️ Part 1: The Lost Boarding Pass</h3>
  <div class="story-text">
    It was Karim's first <span class="hl" data-meaning="رحلة دولية">international flight</span>. He had been 
    <span class="hl" data-meaning="متحمس بشأن">excited about</span> the trip for months, but standing in the 
    <span class="hl" data-meaning="صالة المغادرة">departure lounge</span>, he felt 
    <span class="hl" data-meaning="متوتر">stressed</span>.<br><br>
    He searched his bag. His <span class="hl" data-meaning="جواز سفر">passport</span> was there. His 
    <span class="hl" data-meaning="فيزا">visa</span> was there. But his 
    <span class="hl" data-meaning="بطاقة الصعود">boarding pass</span> had disappeared!<br><br>
    <span class="hl" data-meaning="لحسن الحظ">Fortunately</span>, a 
    <span class="hl" data-meaning="ضابط الأمن">security officer</span> noticed Karim struggling and walked over. 
    He told him to <span class="hl" data-meaning="يبقى هادئًا">stay calm</span>. They headed to the 
    <span class="hl" data-meaning="مكتب المفقودات والموجودات">lost and found desk</span>. 
    There it was — left at the <span class="hl" data-meaning="نقطة تفتيش أمنية">security checkpoint</span>! 
    Karim grabbed his <span class="hl" data-meaning="أمتعة / حقائب">luggage</span> and ran to his 
    <span class="hl" data-meaning="بوابة">gate</span>, making it just in time.
  </div>
  <div class="story-qs"><h4>📚 Comprehension Questions</h4>
    <div class="story-q"><div class="sq-text">1. How did Karim feel in the departure lounge?</div>
    <div class="sq-opts"><span class="sq-opt" onclick="storyAns(this,true)">a) Stressed</span><span class="sq-opt" onclick="storyAns(this,false)">b) Relaxed</span><span class="sq-opt" onclick="storyAns(this,false)">c) Happy</span></div></div>
    <div class="story-q"><div class="sq-text">2. What document did Karim lose?</div>
    <div class="sq-opts"><span class="sq-opt" onclick="storyAns(this,false)">a) His passport</span><span class="sq-opt" onclick="storyAns(this,true)">b) His boarding pass</span><span class="sq-opt" onclick="storyAns(this,false)">c) His visa</span></div></div>
    <div class="story-q"><div class="sq-text">3. Where was the document found?</div>
    <div class="sq-opts"><span class="sq-opt" onclick="storyAns(this,false)">a) At the gate</span><span class="sq-opt" onclick="storyAns(this,true)">b) At the security checkpoint</span><span class="sq-opt" onclick="storyAns(this,false)">c) In his bag</span></div></div>
  </div></div>`;

  const s2 = `<div class="story-card">
  <h3>🛬 Part 2: Ahmed Navigates Tokyo</h3>
  <div class="story-text">
    <span class="hl" data-meaning="في النهاية">Finally</span>, 
    <span class="hl" data-meaning="حانت اللحظة">the moment came</span>. Ahmed arrived at the airport 
    <span class="hl" data-meaning="مقدما">in advance</span>, carrying a small 
    <span class="hl" data-meaning="لائحة / قائمة">checklist</span> to 
    <span class="hl" data-meaning="يتأكد">make sure</span> he had everything.<br><br>
    The airport was <span class="hl" data-meaning="غامر / طاغ">overwhelming</span> — signs everywhere, crowds 
    rushing. Ahmed felt <span class="hl" data-meaning="مرتبك">confused</span>. He needed to 
    <span class="hl" data-meaning="يصل إلى مبنى الركاب">navigate the terminal</span>.<br><br>
    A kind <span class="hl" data-meaning="موظف">attendant</span> at the 
    <span class="hl" data-meaning="مكتب تسجيل وصول">check-in desk</span> 
    <span class="hl" data-meaning="يسلم شيئًا لشخص">handed over</span> a map and 
    <span class="hl" data-meaning="يطمئن">reassured</span> him with a smile. There had been an 
    <span class="hl" data-meaning="خطأ">error</span> — his seat was 
    <span class="hl" data-meaning="يعيد توجيه">rerouted</span>. But Ahmed smiled and decided to 
    <span class="hl" data-meaning="يمشي مع التيار">go with the flow</span>.
  </div>
  <div class="story-qs"><h4>📚 Comprehension Questions</h4>
    <div class="story-q"><div class="sq-text">1. Why did Ahmed feel confused?</div>
    <div class="sq-opts"><span class="sq-opt" onclick="storyAns(this,true)">a) Too many signs and crowds</span><span class="sq-opt" onclick="storyAns(this,false)">b) Lost his passport</span><span class="sq-opt" onclick="storyAns(this,false)">c) Flight cancelled</span></div></div>
    <div class="story-q"><div class="sq-text">2. What did the attendant give Ahmed?</div>
    <div class="sq-opts"><span class="sq-opt" onclick="storyAns(this,false)">a) A boarding pass</span><span class="sq-opt" onclick="storyAns(this,true)">b) A map of the terminal</span><span class="sq-opt" onclick="storyAns(this,false)">c) A new ticket</span></div></div>
    <div class="story-q"><div class="sq-text">3. What does "go with the flow" mean?</div>
    <div class="sq-opts"><span class="sq-opt" onclick="storyAns(this,false)">a) يسافر بالطائرة</span><span class="sq-opt" onclick="storyAns(this,true)">b) يمشي مع التيار</span><span class="sq-opt" onclick="storyAns(this,false)">c) يجري بسرعة</span></div></div>
  </div></div>`;

  container.innerHTML = currentPart === 1 ? s1 : s2;
}
function storyAns(el, correct) {
  const p = el.closest('.story-q');
  if (p.querySelector('.correct,.wrong')) return;
  el.classList.add(correct ? 'correct' : 'wrong');
  if (!correct) p.querySelectorAll('.sq-opt').forEach(o => { if (o !== el) o.classList.add('correct'); setTimeout(() => o.classList.remove('correct'), 2200); });
}

// ========================================================
// SUMMARY — Unit overview with key points & exam tips
// ========================================================
function renderSummary() {
  const unit = UNITS_DATA[currentUnit];
  const partData = unit.parts[currentPart];
  const words = partData.words;
  const con = document.getElementById('summary-container');

  // Build section stats
  const secCounts = {};
  words.forEach(w => { secCounts[w.s] = (secCounts[w.s] || 0) + 1; });

  // Pull specific categories
  const defs = words.filter(w => w.s.startsWith('A'));
  const vocab = words.filter(w => w.s.startsWith('B'));
  const exprs = words.filter(w => w.s.startsWith('C'));
  const syns = words.filter(w => w.s.startsWith('D'));
  const derivs = words.filter(w => w.s.startsWith('E'));
  const gram = words.filter(w => w.s.startsWith('F'));

  // Exam-critical tips per unit
  const examTips = {
    1: [
      '⚠️ فرق بين <b>Kick off</b> (يبدأ) و <b>End/Finish</b> — الامتحان بيسأل المضاد',
      '⚠️ <b>Quietly</b> ← quiet (هادئ) | quite (إلى حد ما) | quit (يترك) — لا تخلطهم!',
      '⚠️ <b>Teamwork makes the dream work</b> — اعرف الـ Idioms كاملة',
      '⚠️ فرق <b>Award</b> (رسمي/منحة) و <b>Reward</b> (مكافأة ودية) و <b>Ward</b> (عنبر)',
      '⚠️ <b>Consciousness</b> (وعي/إدراك) | <b>Conscious</b> (واعٍ) | <b>Consciously</b> (بوعي/قصد)',
      '⚠️ فرق <b>Job</b> (وظيفة اسم يعد) | <b>Career</b> (مهنة الحياة العملية) | <b>Profession</b> (مهنة تحتاج مؤهلات)',
      '⚠️ <b>Rise/arose/arisen</b> — لا يأتي بعده مفعول | <b>Raise/raised/raised</b> — يأتي بعده مفعول',
    ],
    7: [
      '⚠️ فرق <b>Gate/Gateway/Portal</b> كلهم مدخل لكن بسياقات مختلفة',
      '⚠️ <b>Check in / Check out / Check up</b> — حفظ حروف الجر ضروري',
      '⚠️ <b>Boarding pass</b> vs <b>Ticket</b> — سؤال تمييز شائع في الامتحان',
    ],
    8: [
      '⚠️ فرق <b>Found/founded</b> (يؤسس) و <b>Find/found</b> (يجد/يكتشف)',
      '⚠️ <b>Historic</b> (قديم يمكن زيارته) vs <b>Historical</b> (متعلق بدراسة التاريخ)',
      '⚠️ <b>Rise/rose/risen</b> (لازم) vs <b>Raise/raised</b> (متعدي) — فرق جوهري',
      '⚠️ <b>Lie/lay/lain</b> (يستلقي) vs <b>Lay/laid</b> (يضع) vs <b>Lie/lied</b> (يكذب)',
    ],
    9: [
      '⚠️ <b>Another</b> + مفرد | <b>Other</b> + جمع | <b>Others</b> بدون اسم بعده',
      '⚠️ <b>Quite</b> (إلى حد ما) vs <b>Quiet</b> (هادئ) vs <b>Quit</b> (يترك)',
      '⚠️ <b>Expert at + V.ing</b> | <b>Expert on + noun</b> — حروف الجر مهمة',
      '⚠️ <b>Consist of</b> vs <b>Contain/Include</b> — لا يستخدم Consist of في المجهول',
    ],
    10: [
      '⚠️ فرق <b>Hospitality</b> (كرم الضيافة) و <b>Generosity</b> (الكرم) — التعريفات في Section A',
      '⚠️ <b>Wish + ماضٍ بسيط</b> (تمني الحاضر) | <b>Wish + had + P.P</b> (تمني الماضي) | <b>Wish + would</b> (تمني المستقبل)',
      '⚠️ فرق <b>Hope</b> (أمل واقعي + will) vs <b>Wish</b> (تمني + ماضٍ)',
      '⚠️ <b>Thoughtful</b> (مراعٍ للمشاعر) vs <b>Thoughtfully</b> (بتأمل) — الامتحان بيخلط بينهم',
      '⚠️ <b>Individualistic</b> vs <b>Collectivist</b> — التعريفات كاملة مهمة',
      '⚠️ <b>Cause of</b> vs <b>Reason for</b> — حروف الجر المختلفة',
      '⚠️ <b>Spontaneous</b> (عفوي — غير مخطط) — لا تخلطه بـ automatic',
    ],
    11: [
      '⚠️ فرق <b>Fiction</b> (خيالي) و <b>Non-fiction</b> (واقعي) — التعريفات الأساسية',
      '⚠️ <b>Prose</b> (نثر) vs <b>Poetry</b> (شعر) vs <b>Drama</b> (مسرحية) — أنواع الأدب',
      '⚠️ <b>Biography</b> (مكتوبة عنه) vs <b>Autobiography</b> (كتبها هو) — فرق جوهري',
      '⚠️ <b>Alone</b> (بمفرده — دون مساعدة) vs <b>Lonely</b> (وحيد — شاعر بالوحدة)',
      '⚠️ <b>Tone</b> (نبرة) vs <b>Tune</b> (أغنية / لحن) — لا تخلطهم',
      '⚠️ <b>Gold</b> (مصنوع من الذهب) vs <b>Golden</b> (يشبه الذهب / لون ذهبي)',
      '⚠️ <b>Imagery</b> في الشعر = اللغة التي تصنع صور ذهنية — اعرف تعريفه كامل',
    ],
  };

  const tips = examTips[currentUnit] || [
    '⚠️ ركز على أسئلة الـ Definitions — غالبًا 6 أسئلة في الامتحان',
    '⚠️ الـ Synonyms والـ Antonyms — احفظ كلا الجانبين',
    '⚠️ الـ Expressions — الامتحان بيسأل عن المعنى كامل',
  ];

  // Random "likely exam" words
  const likelyExam = shuffle([...defs]).slice(0, 5);

  con.innerHTML = `
<div style="font-family:'Tajawal',sans-serif;color:#e8eaf2;padding:8px 0">

  <!-- UNIT OVERVIEW -->
  <div style="background:linear-gradient(135deg,#1a2540,#0d1525);border:1px solid #252a3a;border-radius:16px;padding:20px;margin-bottom:18px">
    <div style="font-size:22px;font-weight:900;color:#20a8e8;margin-bottom:6px">📚 ملخص الوحدة</div>
    <div style="font-size:16px;color:#aab0c8;margin-bottom:14px">${unit.title} — ${partData.label}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">
      <div style="background:#12151f;border-radius:10px;padding:12px">
        <div style="font-size:28px;font-weight:900;color:#20c070">${words.length}</div>
        <div style="font-size:12px;color:#606880">كلمة</div>
      </div>
      <div style="background:#12151f;border-radius:10px;padding:12px">
        <div style="font-size:28px;font-weight:900;color:#e8a020">${defs.length}</div>
        <div style="font-size:12px;color:#606880">تعريف</div>
      </div>
      <div style="background:#12151f;border-radius:10px;padding:12px">
        <div style="font-size:28px;font-weight:900;color:#a050e8">${exprs.length}</div>
        <div style="font-size:12px;color:#606880">تعبير</div>
      </div>
    </div>
  </div>

  <!-- EXAM WARNINGS -->
  <div style="background:#1a1020;border:1px solid #5a1a3a;border-radius:14px;padding:18px;margin-bottom:18px">
    <div style="font-size:17px;font-weight:700;color:#e83060;margin-bottom:12px">🎯 نقاط هتيجي منها أسئلة — احفظها!</div>
    ${tips.map(t => `<div style="background:#200a18;border-right:3px solid #e83060;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:14px;line-height:1.7">${t}</div>`).join('')}
  </div>

  <!-- KEY DEFINITIONS -->
  ${defs.length ? `
  <div style="background:#0f1a10;border:1px solid #1a5a20;border-radius:14px;padding:18px;margin-bottom:18px">
    <div style="font-size:17px;font-weight:700;color:#20c070;margin-bottom:12px">📖 التعريفات الأساسية (${defs.length})</div>
    ${defs.map(w => `
      <div style="border-bottom:1px solid #1a3a20;padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <span style="color:#20c070;font-weight:700;font-size:15px">${w.en}</span>
          <span style="color:#606880;font-size:12px;margin-right:6px">${w.type}</span>
          <div style="color:#aab0c8;font-size:13px;margin-top:3px">${w.def || w.ar}</div>
        </div>
        <div style="color:#e8eaf2;font-size:14px;white-space:nowrap;text-align:left">${w.ar}</div>
      </div>`).join('')}
  </div>` : ''}

  <!-- SYNONYMS & ANTONYMS TABLE -->
  ${syns.length ? `
  <div style="background:#10101a;border:1px solid #2a2a5a;border-radius:14px;padding:18px;margin-bottom:18px">
    <div style="font-size:17px;font-weight:700;color:#8080e8;margin-bottom:12px">🔄 المترادفات والمضادات (${syns.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="color:#606880;border-bottom:1px solid #2a2a5a">
        <td style="padding:6px;font-weight:700">الكلمة</td>
        <td style="padding:6px;font-weight:700;color:#20c070">مترادف</td>
        <td style="padding:6px;font-weight:700;color:#e03040">مضاد</td>
      </tr>
      ${syns.map(w => {
    const parts = w.def ? w.def.split('|') : [];
    const syn = parts[0] ? parts[0].replace(/Syn:/i, '').trim() : '—';
    const ant = parts[1] ? parts[1].replace(/Ant:/i, '').trim() : '—';
    return `<tr style="border-bottom:1px solid #1a1a30">
          <td style="padding:8px;color:#e8a020;font-weight:700">${w.en}<br><span style="color:#606880;font-size:11px">${w.ar}</span></td>
          <td style="padding:8px;color:#20c070">${syn}</td>
          <td style="padding:8px;color:#e03040">${ant}</td>
        </tr>`;
  }).join('')}
    </table>
  </div>` : ''}

  <!-- EXPRESSIONS -->
  ${exprs.length ? `
  <div style="background:#100f18;border:1px solid #3a2a5a;border-radius:14px;padding:18px;margin-bottom:18px">
    <div style="font-size:17px;font-weight:700;color:#c080e8;margin-bottom:12px">💬 التعبيرات والتلازمات (${exprs.length})</div>
    ${exprs.map(w => `
      <div style="background:#0c0b18;border-radius:8px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="color:#c080e8;font-weight:700;font-size:14px">${w.en}</div>
        <div style="color:#aab0c8;font-size:13px;text-align:left">${w.ar}</div>
      </div>`).join('')}
  </div>` : ''}

  <!-- GRAMMAR NOTES -->
  ${gram.length ? `
  <div style="background:#0f1520;border:1px solid #1a3a5a;border-radius:14px;padding:18px;margin-bottom:18px">
    <div style="font-size:17px;font-weight:700;color:#20a8e8;margin-bottom:12px">📐 الملاحظات اللغوية (${gram.length})</div>
    ${gram.map(w => `
      <div style="border-bottom:1px solid #1a2a3a;padding:9px 0;display:flex;justify-content:space-between;gap:8px">
        <div style="color:#20a8e8;font-weight:700;font-size:14px">${w.en}</div>
        <div style="color:#aab0c8;font-size:13px;text-align:left">${w.ar}</div>
      </div>`).join('')}
  </div>` : ''}

  <!-- DERIVATIVES -->
  ${derivs.length ? `
  <div style="background:#101510;border:1px solid #2a4a1a;border-radius:14px;padding:18px;margin-bottom:18px">
    <div style="font-size:17px;font-weight:700;color:#80c840;margin-bottom:12px">🧬 المشتقات والمعاني الجديدة (${derivs.length})</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
    ${derivs.map(w => `
      <div style="background:#0a1008;border-radius:8px;padding:10px;border:1px solid #1a3a10">
        <div style="color:#80c840;font-weight:700;font-size:14px">${w.en}</div>
        <div style="color:#aab0c8;font-size:12px;margin-top:3px">${w.ar}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- QUICK TEST -->
  <div style="background:#1a1510;border:1px solid #5a3a10;border-radius:14px;padding:18px">
    <div style="font-size:17px;font-weight:700;color:#e8a020;margin-bottom:12px">⚡ اختبر نفسك سريع — هل تعرف معنى هذه؟</div>
    ${likelyExam.map(w => `
      <details style="background:#0f0c08;border-radius:8px;margin-bottom:8px;overflow:hidden">
        <summary style="padding:12px;cursor:pointer;color:#e8a020;font-weight:700;font-size:15px;list-style:none">
          🔹 ${w.en} <span style="color:#606880;font-size:12px">(${w.type})</span>
        </summary>
        <div style="padding:12px;border-top:1px solid #2a1a08">
          <div style="color:#20c070;font-size:16px;font-weight:700;margin-bottom:4px">${w.ar}</div>
          <div style="color:#aab0c8;font-size:13px">${w.def || ''}</div>
        </div>
      </details>`).join('')}
  </div>

</div>`;
}


function initStats() {
  let total = 0;
  Object.values(UNITS_DATA).forEach(u => Object.values(u.parts).forEach(p => total += p.words.length));
  document.getElementById('stat-words').textContent = total;
}
initStats();

// ========================================================
// 60-SECOND SPEED CHALLENGE
// ========================================================
let speedTimer = 60;
let speedInterval = null;
let speedScore = 0;
let currentSpeedWord = null;

function startSpeedChallenge() {
  speedScore = 0;
  speedTimer = 60;
  document.getElementById('speed-results').classList.add('hidden');
  const optsContainer = document.getElementById('speed-opts');
  optsContainer.innerHTML = '';
  document.getElementById('speed-word').textContent = 'Ready?';

  if (speedInterval) clearInterval(speedInterval);

  let lastTime = Date.now();
  speedInterval = setInterval(() => {
    const now = Date.now();
    if (now - lastTime >= 1000) {
      speedTimer--;
      document.getElementById('speed-timer').textContent = speedTimer;
      lastTime = now;
      if (speedTimer <= 0) {
        clearInterval(speedInterval);
        showSpeedResults();
      }
    }
  }, 100); // Check every 100ms for more accurate countdown display

  renderSpeedNext();
}

function renderSpeedNext() {
  const pool = shuffle(Object.values(UNITS_DATA).flatMap(u => Object.values(u.parts).flatMap(p => p.words))).slice(0, 10);
  currentSpeedWord = pool[0];
  const opts = shuffle(pool.slice(0, 4));

  document.getElementById('speed-word').textContent = currentSpeedWord.en;
  const grid = document.getElementById('speed-opts');
  grid.innerHTML = '';
  opts.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.padding = '15px';
    btn.textContent = o.ar;
    btn.onclick = () => {
      if (o.en === currentSpeedWord.en) {
        playSfx('correct');
        speedScore++;
        renderSpeedNext();
      } else {
        playSfx('wrong');
        btn.style.borderColor = 'red';
        setTimeout(() => renderSpeedNext(), 200);
      }
    };
    grid.appendChild(btn);
  });
}

function showSpeedResults() {
  document.getElementById('speed-results').classList.remove('hidden');
  document.getElementById('speed-score').textContent = speedScore;
  addScore(speedScore * 10);
}
const themeToggle = document.getElementById('theme-toggle');
let isLight = localStorage.getItem('flightWords_theme') === 'light';
if (isLight) document.documentElement.setAttribute('data-theme', 'light');
if (themeToggle) themeToggle.textContent = isLight ? '🌙' : '🌞';

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    isLight = !isLight;
    if (isLight) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('flightWords_theme', 'light');
      themeToggle.textContent = '🌙';
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('flightWords_theme', 'dark');
      themeToggle.textContent = '🌞';
    }
  });
}

// ========================================================
// INITIAL RENDER & URL PARSING
// ========================================================
function initApp() {
  const params = new URLSearchParams(window.location.search);
  const matchParam = params.get('match');
  if (matchParam) {
    const matchData = matchParam.match(/u(\d+)p(\d+)/);
    if (matchData) {
      const u = parseInt(matchData[1]);
      const p = parseInt(matchData[2]);
      if (UNITS_DATA[u] && UNITS_DATA[u].parts[p]) {
        openUnit(u);
        switchPart(p);
        showFeat('match');
        return;
      }
    }
  }

  // Default: Go to Home Screen
  document.getElementById('screen-home').classList.add('active');
  updateDashboardRanks();
}
initApp();
function changeBgTheme(theme) {
  document.body.classList.remove('theme-cockpit', 'theme-clouds', 'theme-lounge');
  if (theme !== 'default') document.body.classList.add('theme-' + theme);
  localStorage.setItem('flightWords_bg', theme);
}

const savedBg = localStorage.getItem('flightWords_bg');
if (savedBg) {
  changeBgTheme(savedBg);
  setTimeout(() => {
    const sel = document.getElementById('bg-selector');
    if (sel) sel.value = savedBg;
  }, 500);
}
// ========================================================
// AUTOPILOT MODE
// ========================================================
function initAutopilot() {
  autopilotActive = true;
  autopilotPaused = false;
  autopilotIndex = 0;
  autopilotPool = shuffle(Object.values(UNITS_DATA).flatMap(u => Object.values(u.parts).flatMap(p => p.words)));
  document.getElementById('ap-play-pause').textContent = '⏸';
  runAutopilotStep();
}

function stopAutopilot() {
  autopilotActive = false;
  clearTimeout(autopilotTimer);
}

function toggleAutopilot() {
  autopilotPaused = !autopilotPaused;
  document.getElementById('ap-play-pause').textContent = autopilotPaused ? '▶' : '⏸';
  if (!autopilotPaused) runAutopilotStep();
}

async function runAutopilotStep() {
  if (!autopilotActive || autopilotPaused) return;

  const w = autopilotPool[autopilotIndex];
  const enEl = document.getElementById('ap-en');
  const arEl = document.getElementById('ap-ar');
  const orb = document.getElementById('ap-timer-orb');

  // Show English
  enEl.textContent = w.en;
  arEl.style.opacity = '0';
  orb.style.transition = 'none';
  orb.style.width = '0%';

  playTTS(w.en);

  // Wait 2.5s -> Show Arabic
  autopilotTimer = setTimeout(() => {
    if (!autopilotActive || autopilotPaused) return;
    arEl.textContent = w.ar;
    arEl.style.opacity = '1';

    // Animation progress
    orb.style.transition = 'width 3s linear';
    orb.style.width = '100%';

    // Wait 3s -> Next word
    autopilotTimer = setTimeout(() => {
      if (!autopilotActive || autopilotPaused) return;
      autopilotIndex = (autopilotIndex + 1) % autopilotPool.length;
      runAutopilotStep();
    }, 3000);
  }, 2500);
}

// Ensure autopilot stops when leaving screen
const originalGoHome = goHome;
goHome = function () {
  stopAutopilot();
  originalGoHome();
};
