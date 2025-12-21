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
let holdDuration = 300; // ms
let wakeLock = null;
let isWakeLockEnabled = false;

let isInspectionMode = false;
let inspectionState = 'none'; 
let inspectionStartTime = 0;
let inspectionInterval = null;
let inspectionPenalty = null; 
let hasSpoken8 = false;
let hasSpoken12 = false;
let lastStopTimestamp = 0;

const APP_VERSION = '1.4.0'; 
const UPDATE_LOGS = [
    "V1.4.0 기본 기능(세션, 스크램블) 복구 및 안정화",
    "라이브러리 로딩 실패 시 자동 복구(Fallback) 시스템 탑재",
    "모든 종목 시각화 지원 및 오류 수정"
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

// Configuration for Manual Fallback
const manualConfigs = {
    '333': { moves: ["U","D","L","R","F","B"], len: 21 },
    '333oh': { moves: ["U","D","L","R","F","B"], len: 21 },
    '222': { moves: ["U","R","F"], len: 11 },
    '444': { moves: ["U","D","L","R","F","B","Uw","Rw","Fw"], len: 44 },
    '555': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw"], len: 60 },
    '666': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw","3Uw","3Rw","3Fw"], len: 80 },
    '777': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw","3Uw","3Dw","3Lw","3Rw","3Fw","3Bw"], len: 100 },
    'pyra': { moves: ["U","L","R","B"], len: 10, tips: ["u","l","r","b"] },
    'skewb': { moves: ["U","L","R","B"], len: 10 },
    '333bf': { moves: ["U","D","L","R","F","B"], len: 21 },
    '444bf': { moves: ["U","D","L","R","F","B","Uw","Rw","Fw"], len: 44 },
    '555bf': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw"], len: 60 }
};
const suffixes = ["", "'", "2"];
const wideMoves = ["Uw", "Dw", "Lw", "Rw", "Fw", "Bw"];

const eventMap = {
    '333': { puzzle: '3x3x3', type: '333', cat: 'standard' },
    '333oh': { puzzle: '3x3x3', type: '333', cat: 'standard' },
    '222': { puzzle: '2x2x2', type: '222', cat: 'standard' },
    '444': { puzzle: '4x4x4', type: '444', cat: 'standard' },
    '555': { puzzle: '5x5x5', type: '555', cat: 'standard' },
    '666': { puzzle: '6x6x6', type: '666', cat: 'standard' },
    '777': { puzzle: '7x7x7', type: '777', cat: 'standard' },
    'minx': { puzzle: 'megaminx', type: 'minx', cat: 'nonstandard' },
    'pyra': { puzzle: 'pyraminx', type: 'pyraminx', cat: 'nonstandard' },
    'skewb': { puzzle: 'skewb', type: 'skewb', cat: 'nonstandard' },
    'sq1': { puzzle: 'square1', type: 'sq1', cat: 'nonstandard' },
    'clock': { puzzle: 'clock', type: 'clock', cat: 'nonstandard' },
    '333bf': { puzzle: '3x3x3', type: '333', cat: 'blind' },
    '444bf': { puzzle: '4x4x4', type: '444', cat: 'blind' },
    '555bf': { puzzle: '5x5x5', type: '555', cat: 'blind' },
    '333mbf': { puzzle: '3x3x3', type: '333', cat: 'blind' }
};

// --- Mobile Tab Logic ---
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

// --- Scramble Logic (Robust Fallback) ---
function generateFallbackScramble() {
    const conf = manualConfigs[currentEvent];
    let res = [];
    
    if (currentEvent === 'minx') {
        for (let i = 0; i < 7; i++) {
            let line = [];
            for (let j = 0; j < 10; j++) line.push((j%2===0?"R":"D") + (Math.random()<0.5?"++":"--"));
            line.push(Math.random()<0.5?"U":"U'"); res.push(line.join(" "));
        }
        currentScramble = res.join("\n");
    } else if (currentEvent === 'clock') {
        const dials = ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"];
        dials.forEach(d => res.push(`${d}${Math.floor(Math.random()*12)-5}`));
        res.push("y2");
        ["U", "R", "D", "L", "ALL"].forEach(d => res.push(`${d}${Math.floor(Math.random()*12)-5}`));
        let pins=[]; ["UR", "DR", "DL", "UL"].forEach(p => {if(Math.random()<0.5) pins.push(p)});
        if(pins.length) res.push(pins.join(" "));
        currentScramble = res.join(" ");
    } else if (currentEvent === 'sq1') {
        let top=[1,0,1,1,0,1,1,0,1,1,0,1], bot=[1,0,1,1,0,1,1,0,1,1,0,1];
        let cnt=0, attempts=0;
        const rotate=(arr,n)=>{ let v=n%12; if(v<0)v+=12; arr.unshift(...arr.splice(12-v,v)); }
        while(cnt<12 && attempts<500) {
            attempts++;
            let u=Math.floor(Math.random()*12)-5, d=Math.floor(Math.random()*12)-5;
            if(u===0&&d===0) continue;
            let nt=[...top], nb=[...bot]; rotate(nt,u); rotate(nb,d);
            if(nt[0]&&nt[6]&&nb[0]&&nb[6]) {
                res.push(`(${u},${d})`); res.push("/");
                let tr=nt.slice(6), br=nb.slice(6);
                top=[...nt.slice(0,6),...br]; bot=[...nb.slice(0,6),...tr];
                cnt++;
            }
        }
        currentScramble = res.join(" ");
    } else if (conf) {
        let last="", lastAx=-1, slastAx=-1;
        const getAx=m=>"UD".includes(m[0])?0:"LR".includes(m[0])?1:2;
        for(let i=0; i<conf.len; i++) {
            let m, ax;
            do { m=conf.moves[Math.floor(Math.random()*conf.moves.length)]; ax=getAx(m); }
            while(m===last || (ax===lastAx && ax===slastAx));
            res.push(m + (currentEvent.includes('pyra')||currentEvent.includes('skewb') ? (Math.random()<0.5?"'":"") : suffixes[Math.floor(Math.random()*3)]));
            slastAx=lastAx; lastAx=ax; last=m;
        }
        if(currentEvent==='pyra') conf.tips.forEach(t=>{const r=Math.floor(Math.random()*3); if(r===1) res.push(t); else if(r===2) res.push(t+"'");});
        currentScramble = res.join(" ");
    } else {
        currentScramble = "Scramble not supported";
    }
    
    scrambleEl.innerText = currentScramble;
    updateTwistyPlayer();
}

function generateScramble() {
    if (currentEvent === '333mbf') return;
    const config = eventMap[currentEvent];
    // Check if Scrambo is loaded
    if (typeof Scrambo !== 'undefined' && config) {
        try {
            const s = new Scrambo();
            currentScramble = s.type(config.type).get()[0];
            scrambleEl.innerText = currentScramble;
            updateTwistyPlayer();
            resetPenalty();
            if (activeTool === 'graph') renderHistoryGraph();
            return;
        } catch(e) { console.warn("Scrambo failed", e); }
    }
    generateFallbackScramble();
}

async function updateTwistyPlayer() {
    const player = document.getElementById('mainPlayer');
    const noMsg = document.getElementById('noVisualizerMsg');
    const config = eventMap[currentEvent];
    
    if (config && player && activeTool === 'scramble') {
        player.style.display = 'block';
        noMsg.classList.add('hidden');
        
        await customElements.whenDefined('twisty-player');
        
        try {
            player.puzzle = config.puzzle;
            player.alg = ""; 
            player.experimentalSetupAlg = currentScramble; 
            player.visualization = "2D"; 
        } catch(e) {
            console.error("TwistyPlayer error", e);
        }
    } else {
        if(player) player.style.display = 'none';
        if(noMsg) noMsg.classList.remove('hidden');
    }
}

// ... (Other functions preserved, ensuring they are global) ...
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
window.toggleToolsMenu = (e) => { e.stopPropagation(); document.getElementById('toolsDropdown').classList.toggle('show'); };
window.selectTool = (tool) => {
    activeTool = tool;
    const isBlind = eventMap[currentEvent]?.cat === 'blind';
    document.getElementById('toolLabel').innerText = isBlind ? 'N/A (Blind)' : (tool === 'scramble' ? 'Scramble Image' : 'Graph (Trends)');
    document.getElementById('visualizerWrapper').classList.toggle('hidden', tool !== 'scramble');
    document.getElementById('graphWrapper').classList.toggle('hidden', tool !== 'graph');
    document.querySelectorAll('.tool-option').forEach(opt => opt.classList.remove('active'));
    document.getElementById(`tool-opt-${tool}`).classList.add('active');
    document.getElementById('toolsDropdown').classList.remove('show');
    if (tool === 'graph') renderHistoryGraph(); else if (tool === 'scramble') updateTwistyPlayer();
};
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
window.copyMbfText = () => { /* ... same ... */ const t=document.createElement("textarea"); t.value=`[CubeTimer] MBF (${document.getElementById('mbfCubeCountDisplay').innerText})\n\n`+Array.from(document.querySelectorAll('.scramble-text')).map((e,i)=>`${i+1}. ${e.innerText}`).join('\n\n'); document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); };

function formatTime(ms) { 
    const min = Math.floor(ms/60000); const rem = ms%60000;
    let sec = (precision===3?(rem/1000).toFixed(3):(Math.floor(rem/10)/100).toFixed(2));
    if(min>0) { if(parseFloat(sec)<10) sec="0"+sec; return `${min}:${sec}`; } return sec;
} 

function updateUI() {
    const sid = getCurrentSessionId();
    let filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid);
    const activeSession = (sessions[currentEvent] || []).find(s => s.isActive);
    if (activeSession) document.getElementById('currentSessionNameDisplay').innerText = activeSession.name;
    const subset = filtered.slice(0, displayedSolvesCount);
    historyList.innerHTML = subset.map(s => `<div class="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl flex justify-between items-center group cursor-pointer hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all" onclick="showSolveDetails(${s.id})"><span class="font-bold text-slate-700 dark:text-slate-200 text-sm">${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><button onclick="event.stopPropagation(); deleteSolve(${s.id})" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`).join('') || '<div class="text-center py-10 text-slate-300 text-[11px] italic">No solves yet</div>';
    solveCountEl.innerText = filtered.length;
    if (isAo5Mode) { labelPrimaryAvg.innerText = "Ao5"; displayPrimaryAvg.innerText = calculateAvg(filtered, 5); } else { labelPrimaryAvg.innerText = "Mo3"; displayPrimaryAvg.innerText = calculateAvg(filtered, 3, true); }
    displayAo12.innerText = calculateAvg(filtered, 12);
    let valid = filtered.filter(s=>s.penalty!=='DNF').map(s=>s.penalty==='+2'?s.time+2000:s.time);
    sessionAvgEl.innerText = valid.length ? formatTime(valid.reduce((a,b)=>a+b,0)/valid.length) : "-";
    bestSolveEl.innerText = valid.length ? formatTime(Math.min(...valid)) : "-";
    if (activeTool === 'graph') renderHistoryGraph();
}

historyList.addEventListener('scroll', () => {
    if (historyList.scrollTop + historyList.clientHeight >= historyList.scrollHeight - 50) {
        const sid = getCurrentSessionId();
        const total = solves.filter(s => s.event === currentEvent && s.sessionId === sid).length;
        if (displayedSolvesCount < total) { displayedSolvesCount += SOLVES_BATCH_SIZE; updateUI(); }
    }
});

window.showExtendedStats = () => {
    const sid = getCurrentSessionId();
    const filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid);
    const ao25 = calculateAvg(filtered, 25); const ao50 = calculateAvg(filtered, 50); const ao100 = calculateAvg(filtered, 100);
    const content = document.getElementById('statsContent');
    content.innerHTML = `
        <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><span class="text-xs font-bold text-slate-500 dark:text-slate-400">Current Ao25</span><span class="text-lg font-bold text-slate-700 dark:text-white">${ao25}</span></div>
        <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><span class="text-xs font-bold text-slate-500 dark:text-slate-400">Current Ao50</span><span class="text-lg font-bold text-slate-700 dark:text-white">${ao50}</span></div>
        <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><span class="text-xs font-bold text-slate-500 dark:text-slate-400">Current Ao100</span><span class="text-lg font-bold text-slate-700 dark:text-white">${ao100}</span></div>
    `;
    document.getElementById('statsOverlay').classList.add('active');
}
window.closeStatsModal = () => document.getElementById('statsOverlay').classList.remove('active');

function calculateAvg(list, count, mean=false) {
    if(list.length < count) return "-";
    let slice = list.slice(0, count); let dnfC = slice.filter(s=>s.penalty==='DNF').length;
    let removeCount = Math.ceil(count * 0.05); if (count <= 12) removeCount = 1; 
    if(dnfC >= removeCount + (mean?0:1)) return "DNF"; 
    let nums = slice.map(s => s.penalty==='DNF'?Infinity:(s.penalty==='+2'?s.time+2000:s.time));
    if(mean) return (nums.reduce((a,b)=>a+b,0)/count/1000).toFixed(precision);
    nums.sort((a,b)=>a-b); 
    for(let i=0; i<removeCount; i++) { nums.pop(); nums.shift(); }
    return (nums.reduce((a,b)=>a+b,0)/nums.length/1000).toFixed(precision);
}

function handleStart(e) {
    if (e && (e.target.closest('.avg-badge') || e.target.closest('button') || e.target.closest('.tools-dropdown'))) return;
    if (isBtConnected && !isInspectionMode) return; 
    if(e && e.cancelable) e.preventDefault();
    if(isManualMode || isRunning) { if(isRunning) stopTimer(); return; }
    if (isInspectionMode && inspectionState === 'none') return;
    if (isInspectionMode && inspectionState === 'inspecting') {
        if (isBtConnected) return;
        timerEl.style.color = '#ef4444'; timerEl.classList.add('holding-status');
        holdTimer = setTimeout(()=> { isReady=true; timerEl.style.color = '#10b981'; timerEl.classList.replace('holding-status','ready-to-start'); statusHint.innerText="Ready!"; }, holdDuration); 
        return;
    }
    timerEl.style.color = '#ef4444'; timerEl.classList.add('holding-status');
    holdTimer = setTimeout(()=> { isReady=true; timerEl.style.color = '#10b981'; timerEl.classList.replace('holding-status','ready-to-start'); statusHint.innerText="Ready!"; }, holdDuration); 
}

function handleEnd(e) {
    if (Date.now() - lastStopTimestamp < 500) return;
    if (isBtConnected) { if (isInspectionMode && inspectionState === 'none') startInspection(); return; }
    if(e && e.cancelable) e.preventDefault();
    clearTimeout(holdTimer);
    if (isManualMode) return;
    if (isInspectionMode && !isRunning && inspectionState === 'none') { startInspection(); return; }
    if(!isRunning && isReady) startTimer();
    else { timerEl.style.color = ''; timerEl.classList.remove('holding-status','ready-to-start'); isReady=false; if (!isInspectionMode || inspectionState === 'none') statusHint.innerText= isInspectionMode ? "Start Inspection" : "Hold to Ready"; else timerEl.style.color = '#ef4444'; }
}

window.openSessionModal = () => { document.getElementById('sessionOverlay').classList.add('active'); renderSessionList(); };
window.closeSessionModal = () => { document.getElementById('sessionOverlay').classList.remove('active'); document.getElementById('newSessionName').value = ""; editingSessionId = null; };
function renderSessionList() {
    const listContainer = document.getElementById('sessionList');
    const eventSessions = sessions[currentEvent] || [];
    document.getElementById('sessionCountLabel').innerText = `${eventSessions.length}/10`;
    listContainer.innerHTML = eventSessions.map(s => {
        if (editingSessionId === s.id) return `<div class="flex items-center gap-2"><input type="text" id="editSessionInput" value="${s.name}" class="flex-1 bg-white dark:bg-slate-800 border border-blue-400 rounded-xl px-3 py-2.5 text-xs font-bold outline-none dark:text-white" autofocus onkeydown="if(event.key==='Enter') saveSessionName(${s.id})" onblur="saveSessionName(${s.id})"><button onclick="saveSessionName(${s.id})" class="p-2 text-blue-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button></div>`;
        return `<div class="flex items-center gap-2 group"><div class="flex-1 flex items-center gap-2 p-1 rounded-xl border ${s.isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><button onclick="switchSession(${s.id})" class="flex-1 text-left p-2.5 text-xs font-bold truncate">${s.name}</button><button onclick="editSessionName(${s.id})" class="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></div>${eventSessions.length > 1 ? `<button onclick="deleteSession(${s.id})" class="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ''}</div>`;
    }).join('');
    if (editingSessionId) document.getElementById('editSessionInput').focus();
    document.getElementById('sessionCreateForm').classList.toggle('hidden', eventSessions.length >= 10);
}
window.editSessionName = (id) => { editingSessionId = id; renderSessionList(); };
window.saveSessionName = (id) => { const input = document.getElementById('editSessionInput'); if (!input) return; const newName = input.value.trim(); if (newName) { const s = sessions[currentEvent].find(x => x.id === id); if (s) s.name = newName; } editingSessionId = null; renderSessionList(); updateUI(); saveData(); };
window.createNewSession = () => { const nameInput = document.getElementById('newSessionName'); const name = nameInput.value.trim() || `Session ${sessions[currentEvent].length + 1}`; if (sessions[currentEvent].length >= 10) return; sessions[currentEvent].forEach(s => s.isActive = false); sessions[currentEvent].push({ id: Date.now(), name: name, isActive: true }); nameInput.value = ""; renderSessionList(); updateUI(); saveData(); timerEl.innerText = (0).toFixed(precision); resetPenalty(); };
window.switchSession = (id) => { sessions[currentEvent].forEach(s => s.isActive = (s.id === id)); renderSessionList(); updateUI(); saveData(); timerEl.innerText = (0).toFixed(precision); resetPenalty(); closeSessionModal(); };
window.deleteSession = (id) => { const eventSessions = sessions[currentEvent]; if (!eventSessions || eventSessions.length <= 1) return; const targetIdx = eventSessions.findIndex(s => s.id === id); if (targetIdx === -1) return; const wasActive = eventSessions[targetIdx].isActive; sessions[currentEvent] = eventSessions.filter(s => s.id !== id); solves = solves.filter(s => !(s.event === currentEvent && s.sessionId === id)); if (wasActive && sessions[currentEvent].length > 0) sessions[currentEvent][0].isActive = true; renderSessionList(); updateUI(); saveData(); };
window.openAvgShare = (type) => { const sid = getCurrentSessionId(); const count = (type === 'primary') ? (isAo5Mode ? 5 : 3) : 12; const filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid); if (filtered.length < count) return; const list = filtered.slice(0, count); const avgValue = calculateAvg(filtered, count, (type === 'primary' && !isAo5Mode)); const dateStr = list[0].date || new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, ""); document.getElementById('shareDate').innerText = `Date : ${dateStr}.`; document.getElementById('shareLabel').innerText = (type === 'primary' && !isAo5Mode) ? `Mean of 3 :` : `Average of ${count} :`; document.getElementById('shareAvg').innerText = avgValue; const listContainer = document.getElementById('shareList'); listContainer.innerHTML = list.map((s, idx) => `<div class="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><div class="flex items-center gap-3"><span class="text-[10px] font-bold text-slate-400 w-4">${count - idx}.</span><span class="font-bold text-slate-800 dark:text-slate-200 text-sm min-w-[50px]">${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><span class="text-[10px] text-slate-400 font-medium italic truncate flex-grow">${s.scramble}</span></div></div>`).reverse().join(''); document.getElementById('avgShareOverlay').classList.add('active'); };
window.openSingleShare = () => { const s = solves.find(x => x.id === selectedSolveId); if (!s) return; closeModal(); const dateStr = s.date || new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, ""); document.getElementById('shareDate').innerText = `Date : ${dateStr}.`; document.getElementById('shareLabel').innerText = `Single :`; document.getElementById('shareAvg').innerText = s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time) + (s.penalty==='+2'?'+':''); const listContainer = document.getElementById('shareList'); listContainer.innerHTML = `<div class="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><div class="flex items-center gap-3"><span class="text-[10px] font-bold text-slate-400 w-4">1.</span><span class="font-bold text-slate-800 dark:text-slate-200 text-sm min-w-[50px]">${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><span class="text-[10px] text-slate-400 font-medium italic truncate flex-grow">${s.scramble}</span></div></div>`; document.getElementById('avgShareOverlay').classList.add('active'); };
window.closeAvgShare = () => document.getElementById('avgShareOverlay').classList.remove('active');
window.copyShareText = () => { const date = document.getElementById('shareDate').innerText; const avgLabel = document.getElementById('shareLabel').innerText; const avgVal = document.getElementById('shareAvg').innerText; const isSingle = avgLabel.includes('Single'); let text = `[CubeTimer]\n\n${date}\n\n${avgLabel} ${avgVal}\n\n`; if (isSingle) { const s = solves.find(x => x.id === selectedSolveId); if (s) text += `1. ${avgVal}   ${s.scramble}\n`; } else { const count = avgLabel.includes('5') ? 5 : (avgLabel.includes('3') ? 3 : 12); const sid = getCurrentSessionId(); const filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid).slice(0, count); filtered.reverse().forEach((s, i) => { text += `${i+1}. ${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}   ${s.scramble}\n`; }); } const textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select(); try { document.execCommand('copy'); const btn = document.querySelector('[onclick="copyShareText()"]'); const original = btn.innerHTML; btn.innerHTML = "Copied!"; btn.classList.add('bg-green-600'); setTimeout(() => { btn.innerHTML = original; btn.classList.remove('bg-green-600'); }, 2000); } catch (err) { console.error('Copy failed', err); } document.body.removeChild(textArea); };

window.addEventListener('keydown', e => { 
    const activeEl = document.activeElement;
    const isVisibleInput = activeEl.tagName === 'INPUT' && activeEl.offsetParent !== null;
    if(editingSessionId || isVisibleInput) { if(e.code === 'Enter' && activeEl === manualInput) {} else { return; } } 
    if(e.code==='Space' && !e.repeat) { 
        if (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'A') activeEl.blur();
        e.preventDefault(); handleStart(); 
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

window.openSettings = () => { 
    const overlay = document.getElementById('settingsOverlay');
    if (overlay.classList.contains('active')) closeSettings();
    else { overlay.classList.add('active'); setTimeout(()=>document.getElementById('settingsModal').classList.remove('scale-95','opacity-0'), 10); }
};
window.closeSettings = () => { document.getElementById('settingsModal').classList.add('scale-95','opacity-0'); setTimeout(()=>document.getElementById('settingsOverlay').classList.remove('active'), 200); saveData(); };
window.handleOutsideSettingsClick = (e) => { if(e.target === document.getElementById('settingsOverlay')) closeSettings(); };
window.showSolveDetails = (id) => { let s = solves.find(x=>x.id===id); if(!s) return; selectedSolveId = id; document.getElementById('modalTime').innerText = s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time); document.getElementById('modalEvent').innerText = s.event; document.getElementById('modalScramble').innerText = s.scramble; document.getElementById('modalOverlay').classList.add('active'); };
window.closeModal = () => document.getElementById('modalOverlay').classList.remove('active');
window.useThisScramble = () => { let s=solves.find(x=>x.id===selectedSolveId); if(s){currentScramble=s.scramble; scrambleEl.innerText=currentScramble; closeModal();} };
precisionToggle.onchange = e => { precision = e.target.checked?3:2; updateUI(); timerEl.innerText=(0).toFixed(precision); saveData(); };
avgModeToggle.onchange = e => { isAo5Mode = e.target.checked; updateUI(); saveData(); };
manualEntryToggle.onchange = e => { isManualMode = e.target.checked; timerEl.classList.toggle('hidden', isManualMode); manualInput.classList.toggle('hidden', !isManualMode); statusHint.innerText = isManualMode ? "TYPE TIME & ENTER" : "HOLD TO READY"; };
document.getElementById('clearHistoryBtn').onclick = () => { const sid = getCurrentSessionId(); const msg = `Clear all history for this session?`; const customConfirm = document.createElement('div'); customConfirm.id = 'clearConfirmModal'; customConfirm.innerHTML = `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl"><p class="text-sm font-bold text-slate-700 dark:text-white mb-6 text-center">${msg}</p><div class="flex gap-2"><button id="cancelClear" class="flex-1 py-3 text-slate-400 font-bold text-sm">Cancel</button><button id="confirmClear" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm">Clear All</button></div></div></div>`; document.body.appendChild(customConfirm); document.getElementById('cancelClear').onclick = () => { document.body.removeChild(document.getElementById('clearConfirmModal')); }; document.getElementById('confirmClear').onclick = () => { solves = solves.filter(s => !(s.event === currentEvent && s.sessionId === sid)); updateUI(); saveData(); document.body.removeChild(document.getElementById('clearConfirmModal')); timerEl.innerText = (0).toFixed(precision); resetPenalty(); }; };

// Use DOMContentLoaded to ensure elements are ready
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    // Force scramble generation on load even if library is slow
    setTimeout(() => { if(!currentScramble) generateScramble(); }, 500);
    checkUpdateLog();
});
