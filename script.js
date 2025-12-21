let solves = [];
let sessions = {}; 
let currentEvent = '333';
let isRunning = false;
let isReady = false;
let startTime;
let timerInterval;
let currentScramble = "";
let precision = 2;
let isManualMode = false;
let holdTimer = null;
let selectedSolveId = null;
let isAo5Mode = true;
let editingSessionId = null; 
let activeTool = 'scramble';
let holdDuration = 300; 
let wakeLock = null;
let isWakeLockEnabled = false;

// Inspection Logic Vars
let isInspectionMode = false;
let inspectionState = 'none'; 
let inspectionStartTime = 0;
let inspectionInterval = null;
let inspectionPenalty = null; 
let hasSpoken8 = false;
let hasSpoken12 = false;
let lastStopTimestamp = 0;

const APP_VERSION = '1.5.0'; 
const UPDATE_LOGS = [
    "V1.5.0 스크램블 이미지 오류 완전 해결 (Scramble Display 도입)",
    "스페이스바 및 모바일 터치 잠금 현상 수정",
    "스크램블 랜덤성 강화 (고정 현상 해결)"
];

let displayedSolvesCount = 50;
const SOLVES_BATCH_SIZE = 50;

let btDevice = null;
let btCharacteristic = null;
let isBtConnected = false;
let lastBtState = null;

// DOM Elements
const timerEl = document.getElementById('timer');
const scrambleEl = document.getElementById('scramble');
const mbfInputArea = document.getElementById('mbfInputArea');
const mbfCubeInput = document.getElementById('mbfCubeInput');
const manualInput = document.getElementById('manualInput');
const historyList = document.getElementById('historyList');
const solveCountEl = document.getElementById('solveCount');
const sessionAvgEl = document.getElementById('sessionAvg');
const bestSolveEl = document.getElementById('bestSolve');
const labelPrimaryAvg = document.getElementById('labelPrimaryAvg');
const displayPrimaryAvg = document.getElementById('displayPrimaryAvg');
const displayAo12 = document.getElementById('displayAo12');
const statusHint = document.getElementById('statusHint');
const plus2Btn = document.getElementById('plus2Btn');
const dnfBtn = document.getElementById('dnfBtn');
const noVisualizerMsg = document.getElementById('noVisualizerMsg');
const avgModeToggle = document.getElementById('avgModeToggle');
const precisionToggle = document.getElementById('precisionToggle');
const manualEntryToggle = document.getElementById('manualEntryToggle');
const darkModeToggle = document.getElementById('darkModeToggle');
const wakeLockToggle = document.getElementById('wakeLockToggle');
const holdDurationSlider = document.getElementById('holdDurationSlider');
const holdDurationValue = document.getElementById('holdDurationValue');
const inspectionToggle = document.getElementById('inspectionToggle');

const timerSection = document.getElementById('timerSection');
const historySection = document.getElementById('historySection');
const mobTabTimer = document.getElementById('mob-tab-timer');
const mobTabHistory = document.getElementById('mob-tab-history');

// Mapping for Scrambo and Scramble Display
// scramble-display uses specific event codes (e.g. '333', 'minx', 'pyram')
const eventMap = {
    '333': { type: '333', display: '333', cat: 'standard' },
    '333oh': { type: '333', display: '333', cat: 'standard' },
    '222': { type: '222', display: '222', cat: 'standard' },
    '444': { type: '444', display: '444', cat: 'standard' },
    '555': { type: '555', display: '555', cat: 'standard' },
    '666': { type: '666', display: '666', cat: 'standard' },
    '777': { type: '777', display: '777', cat: 'standard' },
    'minx': { type: 'minx', display: 'minx', cat: 'nonstandard' },
    'pyra': { type: 'pyraminx', display: 'pyram', cat: 'nonstandard' }, // display uses 'pyram'
    'skewb': { type: 'skewb', display: 'skewb', cat: 'nonstandard' },
    'sq1': { type: 'sq1', display: 'sq1', cat: 'nonstandard' },
    'clock': { type: 'clock', display: 'clock', cat: 'nonstandard' },
    '333bf': { type: '333', display: '333', cat: 'blind' },
    '444bf': { type: '444', display: '444', cat: 'blind' },
    '555bf': { type: '555', display: '555', cat: 'blind' },
    '333mbf': { type: '333', display: '333', cat: 'blind' }
};

// ... (Mobile Logic, Update Log, Inspection, Dark Mode, Wake Lock, BT Logic are preserved) ...
// (Omitting repetitive code for brevity, assumes standard implementation from previous steps)

window.switchMobileTab = (tab) => {
    if (tab === 'timer') {
        timerSection.classList.remove('hidden'); historySection.classList.add('hidden');
        mobTabTimer.className = "flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400";
        mobTabHistory.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors";
    } else {
        timerSection.classList.add('hidden'); historySection.classList.remove('hidden'); historySection.classList.add('flex');
        mobTabHistory.className = "flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400";
        mobTabTimer.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors";
        if(activeTool === 'graph') renderHistoryGraph();
    }
};
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) { timerSection.classList.remove('hidden'); historySection.classList.remove('hidden'); historySection.classList.add('flex'); }
    else { if (mobTabTimer.classList.contains('text-blue-600') || mobTabTimer.classList.contains('text-blue-400')) switchMobileTab('timer'); else switchMobileTab('history'); }
});
function checkUpdateLog() {
    const savedVersion = localStorage.getItem('appVersion');
    if (savedVersion !== APP_VERSION) {
        document.getElementById('updateVersion').innerText = `v${APP_VERSION}`;
        document.getElementById('updateList').innerHTML = UPDATE_LOGS.map(log => `<li>${log}</li>`).join('');
        document.getElementById('updateLogOverlay').classList.add('active');
    }
}
window.closeUpdateLog = () => { document.getElementById('updateLogOverlay').classList.remove('active'); localStorage.setItem('appVersion', APP_VERSION); };
function toggleInspection(checkbox) {
    isInspectionMode = checkbox.checked;
    if (isInspectionMode) { updateHoldDuration(0.01); holdDurationSlider.value = 0.01; holdDurationSlider.disabled = true; document.getElementById('holdDurationContainer').classList.add('opacity-50', 'pointer-events-none'); } 
    else { updateHoldDuration(0.3); holdDurationSlider.value = 0.3; holdDurationSlider.disabled = false; document.getElementById('holdDurationContainer').classList.remove('opacity-50', 'pointer-events-none'); }
    saveData();
}
function startInspection() {
    inspectionState = 'inspecting'; inspectionStartTime = Date.now(); inspectionPenalty = null; hasSpoken8 = false; hasSpoken12 = false;
    timerEl.classList.remove('text-ready'); timerEl.style.color = '#ef4444'; statusHint.innerText = "Inspection";
    if(inspectionInterval) clearInterval(inspectionInterval);
    inspectionInterval = setInterval(() => {
        const elapsed = (Date.now() - inspectionStartTime) / 1000; const remaining = 15 - elapsed;
        if (remaining > 0) timerEl.innerText = Math.ceil(remaining); else if (remaining > -2) { timerEl.innerText = "+2"; inspectionPenalty = '+2'; } else { timerEl.innerText = "DNF"; inspectionPenalty = 'DNF'; }
        if (elapsed >= 8 && !hasSpoken8) { speak("Eight seconds"); hasSpoken8 = true; } if (elapsed >= 12 && !hasSpoken12) { speak("Twelve seconds"); hasSpoken12 = true; }
    }, 100);
}
function stopInspection() {
    if(inspectionInterval) clearInterval(inspectionInterval); inspectionState = 'none'; timerEl.style.color = '';
    if (isInspectionMode && inspectionStartTime > 0) { const elapsed = (Date.now() - inspectionStartTime) / 1000; if (elapsed > 17) inspectionPenalty = 'DNF'; else if (elapsed > 15) inspectionPenalty = '+2'; else inspectionPenalty = null; }
}
function speak(text) { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 1.2; window.speechSynthesis.speak(u); } }
function toggleDarkMode(checkbox) { document.documentElement.classList.toggle('dark', checkbox.checked); saveData(); if(activeTool === 'graph') renderHistoryGraph(); }
async function requestWakeLock() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => {}); } } catch (err) {} }
async function toggleWakeLock(checkbox) { isWakeLockEnabled = checkbox.checked; if (isWakeLockEnabled) await requestWakeLock(); else if (wakeLock) { await wakeLock.release(); wakeLock = null; } saveData(); }
document.addEventListener('visibilitychange', async () => { if (wakeLock !== null && document.visibilityState === 'visible' && isWakeLockEnabled) await requestWakeLock(); });
function updateHoldDuration(val) { holdDuration = parseFloat(val) * 1000; holdDurationValue.innerText = val < 0.1 ? "Instant" : val + "s"; saveData(); }
window.openBTModal = () => document.getElementById('btOverlay').classList.add('active');
window.closeBTModal = () => document.getElementById('btOverlay').classList.remove('active');
async function connectGanTimer() {
    const btBtn = document.getElementById('btConnectBtn'); const btStatusText = document.getElementById('btStatusText'); const btIcon = document.getElementById('btModalIcon');
    if (!navigator.bluetooth) { btStatusText.innerText = "No Bluetooth Support"; return; }
    try {
        btBtn.disabled = true; btBtn.innerText = "Searching..."; btStatusText.innerText = "Select GAN Timer"; btIcon.classList.add('bt-pulse');
        btDevice = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'GAN' }], optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb'] });
        const server = await btDevice.gatt.connect(); const service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
        btCharacteristic = await service.getCharacteristic('0000fff5-0000-1000-8000-00805f9b34fb'); await btCharacteristic.startNotifications();
        btCharacteristic.addEventListener('characteristicvaluechanged', handleGanBTData);
        isBtConnected = true; document.getElementById('btStatusIcon').classList.replace('disconnected', 'connected'); document.getElementById('btInfoPanel').classList.remove('hidden'); document.getElementById('btDeviceName').innerText = btDevice.name; document.getElementById('btDisconnectBtn').classList.remove('hidden'); btBtn.classList.add('hidden'); btStatusText.innerText = "Timer Connected"; btIcon.classList.remove('bt-pulse'); statusHint.innerText = "Timer Ready (BT)"; btDevice.addEventListener('gattserverdisconnected', onBTDisconnected);
    } catch (error) { btStatusText.innerText = "Connection failed"; btBtn.disabled = false; btBtn.innerText = "Connect Timer"; btIcon.classList.remove('bt-pulse'); }
}
function handleGanBTData(event) {
    const data = event.target.value; if (data.byteLength < 4) return; const state = data.getUint8(3);
    if (state !== 3 && !isRunning && data.byteLength >= 8) { const min = data.getUint8(4); const sec = data.getUint8(5); const msec = data.getUint16(6, true); timerEl.innerText = formatTime((min * 60000) + (sec * 1000) + msec); }
    if (state !== lastBtState) {
        if (state === 6 && !isInspectionMode) { isReady = false; timerEl.classList.add('text-ready'); statusHint.innerText = "Ready!"; }
        else if (state === 2 && !isInspectionMode) { timerEl.classList.remove('text-ready', 'text-running'); statusHint.innerText = "Timer Ready (BT)"; }
        else if (state === 3 && !isRunning) { if (isInspectionMode && inspectionState === 'inspecting') stopInspection(); startTime = Date.now(); isRunning = true; if(timerInterval) clearInterval(timerInterval); timerInterval = setInterval(() => { timerEl.innerText = formatTime(Date.now() - startTime); }, 16); timerEl.classList.remove('text-ready'); timerEl.classList.add('text-running'); statusHint.innerText = "Timing..."; }
        else if (state === 4 && isRunning) { clearInterval(timerInterval); isRunning = false; if (data.byteLength >= 8) { const min = data.getUint8(4); const sec = data.getUint8(5); const msec = data.getUint16(6, true); const finalMs = (min * 60000) + (sec * 1000) + msec; timerEl.innerText = formatTime(finalMs); stopTimer(finalMs); } timerEl.classList.remove('text-running'); statusHint.innerText = "Finished"; }
        lastBtState = state;
    }
}
function disconnectBT() { if (btDevice && btDevice.gatt.connected) btDevice.gatt.disconnect(); }
function onBTDisconnected() { isBtConnected = false; lastBtState = null; document.getElementById('btStatusIcon').classList.replace('connected', 'disconnected'); document.getElementById('btInfoPanel').classList.add('hidden'); document.getElementById('btDisconnectBtn').classList.add('hidden'); const btBtn = document.getElementById('btConnectBtn'); btBtn.classList.remove('hidden'); btBtn.disabled = false; btBtn.innerText = "Connect Timer"; document.getElementById('btStatusText').innerText = "Disconnected"; statusHint.innerText = "Hold to Ready"; }

// --- Timer Control ---
function startTimer() { if(inspectionInterval) clearInterval(inspectionInterval); inspectionState = 'none'; startTime = Date.now(); isRunning = true; timerInterval = setInterval(()=> { timerEl.innerText = formatTime(Date.now()-startTime); }, 10); timerEl.style.color = ''; statusHint.innerText = "Timing..."; timerEl.classList.add('text-running'); timerEl.classList.remove('text-ready'); }
function stopTimer(forcedTime = null) {
    clearInterval(timerInterval); let elapsed = forcedTime !== null ? forcedTime : (Date.now() - startTime); lastStopTimestamp = Date.now(); let finalPenalty = inspectionPenalty;
    if (elapsed > 10 || finalPenalty === 'DNF') { solves.unshift({ id: Date.now(), time: elapsed, scramble: currentScramble, event: currentEvent, sessionId: getCurrentSessionId(), penalty: finalPenalty, date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, "") }); if (finalPenalty === 'DNF') timerEl.innerText = "DNF"; else { let displayTime = formatTime(elapsed); if (finalPenalty === '+2') displayTime = formatTime(elapsed + 2000) + "+"; timerEl.innerText = displayTime; } }
    isRunning = isReady = false; inspectionState = 'none'; inspectionPenalty = null; updateUI(); generateScramble(); statusHint.innerText = isBtConnected ? "Ready (Bluetooth)" : (isInspectionMode ? "Start Inspection" : "Hold to Ready"); timerEl.classList.remove('text-running', 'text-ready'); timerEl.style.color = ''; saveData();
}

function updatePenaltyBtns(s) { if (plus2Btn && dnfBtn) { plus2Btn.className = `penalty-btn ${s?.penalty==='+2'?'active-plus2':'inactive'}`; dnfBtn.className = `penalty-btn ${s?.penalty==='DNF'?'active-dnf':'inactive'}`; } }
function resetPenalty() { updatePenaltyBtns(null); }
function deleteSolve(id) { solves = solves.filter(s => s.id !== id); updateUI(); saveData(); }
function togglePenalty(p) { if(!solves.length || isRunning) return; const sid = getCurrentSessionId(); const currentList = solves.filter(s => s.event === currentEvent && s.sessionId === sid); if (!currentList.length) return; const targetSolve = currentList[0]; targetSolve.penalty = (targetSolve.penalty===p)?null:p; if (targetSolve.penalty === 'DNF') timerEl.innerText = 'DNF'; else { const t = targetSolve.time + (targetSolve.penalty === '+2' ? 2000 : 0); timerEl.innerText = formatTime(t) + (targetSolve.penalty === '+2' ? '+' : ''); } updateUI(); updatePenaltyBtns(targetSolve); saveData(); }

function exportData() {
    const data = { solves, sessions, settings: { precision, isAo5Mode, currentEvent, holdDuration, isDarkMode: document.documentElement.classList.contains('dark'), isWakeLockEnabled, isInspectionMode } };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `cubetimer_backup_${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function triggerImport() { document.getElementById('importInput').click(); }
function importData(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.solves && data.sessions) {
                solves = data.solves; sessions = data.sessions;
                if (data.settings) {
                    precision = data.settings.precision || 2; isAo5Mode = data.settings.isAo5Mode !== undefined ? data.settings.isAo5Mode : true; currentEvent = data.settings.currentEvent || '333'; holdDuration = data.settings.holdDuration || 300; isWakeLockEnabled = data.settings.isWakeLockEnabled || false; const isDark = data.settings.isDarkMode || false; isInspectionMode = data.settings.isInspectionMode || false;
                    precisionToggle.checked = (precision === 3); avgModeToggle.checked = isAo5Mode; darkModeToggle.checked = isDark; wakeLockToggle.checked = isWakeLockEnabled; inspectionToggle.checked = isInspectionMode;
                    toggleInspection(inspectionToggle); if (!isInspectionMode) { holdDurationSlider.value = holdDuration / 1000; updateHoldDuration(holdDurationSlider.value); }
                    document.documentElement.classList.toggle('dark', isDark); if(isWakeLockEnabled) requestWakeLock();
                }
                saveData(); location.reload();
            } else { throw new Error("Invalid format"); }
        } catch (err) { alert("Failed to restore data."); }
    };
    reader.readAsText(file);
}
function saveData() { localStorage.setItem('cubeTimerData_v5', JSON.stringify({ solves, sessions, settings: { precision, isAo5Mode, currentEvent, holdDuration, isDarkMode: document.documentElement.classList.contains('dark'), isWakeLockEnabled, isInspectionMode } })); }
function loadData() {
    const saved = localStorage.getItem('cubeTimerData_v5') || localStorage.getItem('cubeTimerData_v4');
    if (saved) {
        try {
            const data = JSON.parse(saved); solves = data.solves || []; sessions = data.sessions || {};
            if (data.settings) {
                precision = data.settings.precision || 2; isAo5Mode = data.settings.isAo5Mode !== undefined ? data.settings.isAo5Mode : true; currentEvent = data.settings.currentEvent || '333'; holdDuration = data.settings.holdDuration || 300; const isDark = data.settings.isDarkMode || false; isWakeLockEnabled = data.settings.isWakeLockEnabled || false; isInspectionMode = data.settings.isInspectionMode || false;
                precisionToggle.checked = (precision === 3); avgModeToggle.checked = isAo5Mode; darkModeToggle.checked = isDark; wakeLockToggle.checked = isWakeLockEnabled; inspectionToggle.checked = isInspectionMode;
                if (isInspectionMode) toggleInspection(inspectionToggle); else { holdDurationSlider.value = holdDuration / 1000; holdDurationValue.innerText = holdDurationSlider.value + "s"; }
                document.documentElement.classList.toggle('dark', isDark); if(isWakeLockEnabled) requestWakeLock();
                const conf = eventMap[currentEvent]; 
                if (conf) switchCategory(conf.cat, false);
            }
        } catch (e) { 
            console.error("Load failed, resetting", e); 
            localStorage.removeItem('cubeTimerData_v5'); // Reset corrupted data
        }
    }
    initSessionIfNeeded(currentEvent);
    if (!isBtConnected) statusHint.innerText = isInspectionMode ? "Start Inspection" : "Hold to Ready";
}
function initSessionIfNeeded(eventId) { if (!sessions[eventId] || sessions[eventId].length === 0) sessions[eventId] = [{ id: Date.now(), name: "Session 1", isActive: true }]; else if (!sessions[eventId].find(s => s.isActive)) sessions[eventId][0].isActive = true; }
function getCurrentSessionId() { const eventSessions = sessions[currentEvent] || []; const active = eventSessions.find(s => s.isActive); if (active) return active.id; initSessionIfNeeded(currentEvent); return sessions[currentEvent][0].id; }

// --- Tools & UI ---
function toggleToolsMenu(e) { e.stopPropagation(); document.getElementById('toolsDropdown').classList.toggle('show'); }
function selectTool(tool) {
    activeTool = tool;
    const isBlind = eventMap[currentEvent]?.cat === 'blind';
    document.getElementById('toolLabel').innerText = isBlind ? 'N/A (Blind)' : (tool === 'scramble' ? 'Scramble Image' : 'Graph (Trends)');
    document.getElementById('visualizerWrapper').classList.toggle('hidden', tool !== 'scramble');
    document.getElementById('graphWrapper').classList.toggle('hidden', tool !== 'graph');
    document.querySelectorAll('.tool-option').forEach(opt => opt.classList.remove('active'));
    document.getElementById(`tool-opt-${tool}`).classList.add('active');
    document.getElementById('toolsDropdown').classList.remove('show');
    if (tool === 'graph') renderHistoryGraph(); else if (tool === 'scramble') updateVisualizer();
}
window.addEventListener('click', () => { document.getElementById('toolsDropdown').classList.remove('show'); });

function renderHistoryGraph() {
    if (activeTool !== 'graph') return;
    const sid = getCurrentSessionId(); const filtered = [...solves].filter(s => s.event === currentEvent && s.sessionId === sid).reverse();
    const polyline = document.getElementById('graphLine'); if (filtered.length < 2) { polyline.setAttribute('points', ""); return; }
    const validTimes = filtered.map(s => s.penalty === 'DNF' ? null : (s.penalty === '+2' ? s.time + 2000 : s.time));
    const maxTime = Math.max(...validTimes.filter(t => t !== null)); const minTime = Math.min(...validTimes.filter(t => t !== null)); const range = maxTime - minTime || 1;
    const points = filtered.map((s, i) => { const t = s.penalty === 'DNF' ? maxTime : (s.penalty === '+2' ? s.time + 2000 : s.time); const x = (i / (filtered.length - 1)) * 100; const y = 90 - ((t - minTime) / range) * 80; return `${x},${y}`; }).join(' ');
    polyline.setAttribute('points', points);
}

function switchCategory(cat, autoSelectFirst = true) {
    if(isRunning) return;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active', 'text-white'));
    const catBtn = document.getElementById(`cat-${cat}`); if (catBtn) { catBtn.classList.add('active', 'text-white'); catBtn.classList.remove('text-slate-500', 'dark:text-slate-400'); }
    const groups = ['standard', 'nonstandard', 'blind'];
    groups.forEach(g => { const el = document.getElementById(`group-${g}`); if (g === cat) { el.classList.remove('hidden'); el.classList.add('flex'); } else { el.classList.add('hidden'); el.classList.remove('flex'); } });
    if (autoSelectFirst) { const targetGroup = document.getElementById(`group-${cat}`); const firstButton = targetGroup.querySelector('button'); if (firstButton) changeEvent(firstButton.id.replace('tab-', '')); }
}

function changeEvent(e) {
    if(isRunning) return; currentEvent = e;
    const conf = eventMap[e]; 
    initSessionIfNeeded(e); displayedSolvesCount = SOLVES_BATCH_SIZE; if(historyList) historyList.scrollTop = 0;
    document.querySelectorAll('.event-tab').forEach(t => { t.classList.remove('active', 'text-white', 'bg-blue-600'); t.classList.add('text-slate-500', 'dark:text-slate-400'); });
    const activeTab = document.getElementById(`tab-${e}`); if (activeTab) { activeTab.classList.add('active', 'text-white', 'bg-blue-600'); activeTab.classList.remove('text-slate-500', 'dark:text-slate-400'); }
    
    if (conf?.cat === 'blind') { activeTool = 'graph'; selectTool('graph'); }
    else { if (activeTool === 'graph') selectTool('graph'); else selectTool('scramble'); }

    if (['666', '777', '333bf', '444bf', '555bf', '333mbf'].includes(e)) { isAo5Mode = false; avgModeToggle.checked = false; } else { isAo5Mode = true; avgModeToggle.checked = true; }

    if (currentEvent === '333mbf') { scrambleEl.classList.add('hidden'); mbfInputArea.classList.remove('hidden'); }
    else { scrambleEl.classList.remove('hidden'); mbfInputArea.classList.add('hidden'); generateScramble(); }
    updateUI(); timerEl.innerText = (0).toFixed(precision); saveData();
}

function generate3bldScrambleText() {
    const s=["","'","2"], m=["U","D","L","R","F","B"]; let r=[], l="";
    for(let i=0;i<21;i++){let x; do{x=m[Math.floor(Math.random()*6)]}while(x[0]===l[0]); r.push(x+s[Math.floor(Math.random()*3)]); l=x;}
    const wm=["Uw","Dw","Lw","Rw","Fw","Bw"]; for(let i=0;i<Math.floor(Math.random()*2)+1;i++) r.push(wm[Math.floor(Math.random()*6)]+s[Math.floor(Math.random()*3)]);
    return r.join(" ");
}

function generateScramble() {
    if (currentEvent === '333mbf') return;
    const config = eventMap[currentEvent];
    // Use Scrambo for Text Generation (Standard for all events)
    if (typeof Scrambo !== 'undefined' && config) {
        try {
            // [FIX] Always create new instance to ensure randomness
            const s = new Scrambo(); 
            currentScramble = s.type(config.type).get()[0];
            scrambleEl.innerText = currentScramble;
            updateVisualizer();
            resetPenalty();
            if (activeTool === 'graph') renderHistoryGraph();
            return;
        } catch(e) { console.warn("Scrambo failed", e); }
    }
    // Fallback if Scrambo fails (rare)
    scrambleEl.innerText = "Error Generating Scramble";
}

function updateVisualizer() {
    const player = document.getElementById('visualizer');
    const noMsg = document.getElementById('noVisualizerMsg');
    const config = eventMap[currentEvent];
    
    if (config && player && activeTool === 'scramble') {
        player.style.display = 'block';
        noMsg.classList.add('hidden');
        // Set attributes for Scramble Display Component
        player.setAttribute('event', config.display);
        player.setAttribute('scramble', currentScramble);
        player.setAttribute('visualization', "2D");
    } else {
        if(player) player.style.display = 'none';
        if(noMsg) noMsg.classList.remove('hidden');
    }
}

window.generateMbfScrambles = () => {
    const count = parseInt(mbfCubeInput.value); if (!count) return;
    const list = document.getElementById('mbfScrambleList'); document.getElementById('mbfCubeCountDisplay').innerText = `${count} Cubes`; list.innerHTML = "";
    let scrambles = [];
    if (typeof Scrambo !== 'undefined') { try { scrambles = new Scrambo().type('333').get(count); } catch(e){} }
    for (let i=1; i<=count; i++) {
        const scr = (scrambles.length>=count)?scrambles[i-1]:generate3bldScrambleText();
        list.innerHTML+=`<div class="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl"><div class="flex items-center gap-2 mb-2"><span class="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-[10px] font-bold">#${i}</span><span class="text-[10px] font-black uppercase text-slate-400">Scramble</span></div><p class="font-bold text-slate-600 dark:text-slate-300 leading-relaxed scramble-text">${scr}</p></div>`;
    }
    document.getElementById('mbfScrambleOverlay').classList.add('active'); currentScramble = `Multi-Blind (${count} Cubes)`;
};
window.closeMbfScrambleModal = () => document.getElementById('mbfScrambleOverlay').classList.remove('active');
window.copyMbfText = () => { const t=document.createElement("textarea"); t.value=`[CubeTimer] MBF (${document.getElementById('mbfCubeCountDisplay').innerText})\n\n`+Array.from(document.querySelectorAll('.scramble-text')).map((e,i)=>`${i+1}. ${e.innerText}`).join('\n\n'); document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); };

window.addEventListener('keydown', e => { 
    // [CRITICAL FIX] Focus stealing prevention
    if (document.activeElement.tagName === 'INPUT' && document.activeElement.offsetParent !== null) {
        if(e.code === 'Enter' && document.activeElement === manualInput) { /* Allow Enter in manual input */ }
        else { return; } // Block other inputs
    }
    
    if(e.code==='Space' && !e.repeat) { 
        // Blur any active element that might capture spacebar (like buttons)
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        e.preventDefault(); 
        handleStart(); 
    } 
    
    if(isManualMode && e.code==='Enter') { 
        let v = parseFloat(manualInput.value); 
        if(v>0) { solves.unshift({ id:Date.now(), time:v*1000, scramble:currentScramble, event:currentEvent, sessionId: getCurrentSessionId(), penalty:null, date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, "") }); manualInput.value=""; updateUI(); generateScramble(); saveData(); } 
    } 
});
window.addEventListener('keyup', e => { if(e.code==='Space' && !editingSessionId) handleEnd(); });
const interactiveArea = document.getElementById('timerInteractiveArea');
interactiveArea.addEventListener('touchstart', handleStart, { passive: false });
interactiveArea.addEventListener('touchend', handleEnd, { passive: false });

window.openSettings = () => { const o = document.getElementById('settingsOverlay'); if (o.classList.contains('active')) closeSettings(); else { o.classList.add('active'); setTimeout(()=>document.getElementById('settingsModal').classList.remove('scale-95','opacity-0'), 10); } };
window.closeSettings = () => { document.getElementById('settingsModal').classList.add('scale-95','opacity-0'); setTimeout(()=>document.getElementById('settingsOverlay').classList.remove('active'), 200); saveData(); };
window.handleOutsideSettingsClick = (e) => { if(e.target === document.getElementById('settingsOverlay')) closeSettings(); };
window.showSolveDetails = (id) => { let s = solves.find(x=>x.id===id); if(!s) return; selectedSolveId = id; document.getElementById('modalTime').innerText = s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time); document.getElementById('modalEvent').innerText = s.event; document.getElementById('modalScramble').innerText = s.scramble; document.getElementById('modalOverlay').classList.add('active'); };
window.closeModal = () => document.getElementById('modalOverlay').classList.remove('active');
window.useThisScramble = () => { let s=solves.find(x=>x.id===selectedSolveId); if(s){currentScramble=s.scramble; scrambleEl.innerText=currentScramble; closeModal();} };
precisionToggle.onchange = e => { precision = e.target.checked?3:2; updateUI(); timerEl.innerText=(0).toFixed(precision); saveData(); };
avgModeToggle.onchange = e => { isAo5Mode = e.target.checked; updateUI(); saveData(); };
manualEntryToggle.onchange = e => { isManualMode = e.target.checked; timerEl.classList.toggle('hidden', isManualMode); manualInput.classList.toggle('hidden', !isManualMode); statusHint.innerText = isManualMode ? "TYPE TIME & ENTER" : "HOLD TO READY"; };
document.getElementById('clearHistoryBtn').onclick = () => { const sid = getCurrentSessionId(); const msg = `Clear all history?`; const d = document.createElement('div'); d.id='cM'; d.innerHTML = `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl"><p class="text-sm font-bold text-slate-700 dark:text-white mb-6 text-center">${msg}</p><div class="flex gap-2"><button id="cC" class="flex-1 py-3 text-slate-400 font-bold text-sm">Cancel</button><button id="cO" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm">Clear</button></div></div></div>`; document.body.appendChild(d); document.getElementById('cC').onclick = () => { document.body.removeChild(d); }; document.getElementById('cO').onclick = () => { solves = solves.filter(s => !(s.event === currentEvent && s.sessionId === sid)); updateUI(); saveData(); document.body.removeChild(d); timerEl.innerText = (0).toFixed(precision); resetPenalty(); }; };

// Boot Sequence
// Force focus blur to ensure spacebar works immediately
if (document.activeElement) document.activeElement.blur();
loadData();
// Ensure scramble is generated after DOM load
setTimeout(() => { if(!currentScramble) generateScramble(); }, 300);
checkUpdateLog();
