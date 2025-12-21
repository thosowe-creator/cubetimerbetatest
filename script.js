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

const APP_VERSION = '1.3.1'; 
const UPDATE_LOGS = [
    "V1.3.1 스크램블 생성 오류 수정 (Fallback 복구)",
    "평면도 시각화 모듈 연동 안정화",
    "Square-1 무한 루프 방지 로직 개선"
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

// Configuration for Manual Fallback (Restored)
const manualConfigs = {
    '333': { moves: ["U","D","L","R","F","B"], len: 21 },
    '333oh': { moves: ["U","D","L","R","F","B"], len: 21 },
    '222': { moves: ["U","R","F"], len: 11 },
    '444': { moves: ["U","D","L","R","F","B","Uw","Rw","Fw"], len: 44 },
    '555': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw"], len: 60 },
    '666': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw","3Uw","3Rw","3Fw"], len: 80 },
    '777': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw","3Uw","3Dw","3Lw","3Rw","3Fw","3Bw"], len: 100 },
    'pyra': { moves: ["U","L","R","B"], len: 10, tips: ["u","l","r","b"] },
    'skewb': { moves: ["U","L","R","B"], len: 10 }
};
const suffixes = ["", "'", "2"];
const orientations = ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"];
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

// ... (Mobile Logic, Update Log, Inspection, Dark Mode, Wake Lock, BT Logic preserved) ...
// (Function implementations identical to previous versions unless noted)

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

// --- Scramble & Visualization Logic (FIXED) ---
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
    updateTwistyPlayer(); // Even if manual, try to show if possible
}

function generateScramble() {
    if (currentEvent === '333mbf') return;
    
    const config = eventMap[currentEvent];
    // Try using Scrambo Library first
    if (typeof Scrambo !== 'undefined' && config) {
        try {
            const s = new Scrambo();
            // Use config.type to map 'pyra' -> 'pyraminx', etc.
            currentScramble = s.type(config.type).get()[0];
            scrambleEl.innerText = currentScramble;
            updateTwistyPlayer();
            resetPenalty();
            if (activeTool === 'graph') renderHistoryGraph();
            return;
        } catch(e) {
            console.warn("Scrambo error, using fallback", e);
        }
    }
    // Fallback if library fails or not loaded
    generateFallbackScramble();
}

function updateTwistyPlayer() {
    const player = document.getElementById('mainPlayer');
    const noMsg = document.getElementById('noVisualizerMsg');
    const config = eventMap[currentEvent];
    
    // Check if element is upgraded (has .puzzle property) or at least exists
    if (config && player && activeTool === 'scramble') {
        player.style.display = 'block';
        noMsg.classList.add('hidden');
        // Setting properties on custom element
        try {
            player.puzzle = config.puzzle;
            player.alg = currentScramble;
            player.classList.add('ready');
        } catch(e) {
            console.log("TwistyPlayer not ready yet");
        }
    } else {
        if(player) player.style.display = 'none';
        if(noMsg) noMsg.classList.remove('hidden');
    }
}

// ... (MBF logic, formatTime, updateUI, event listeners, etc. - largely same) ...

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

// ... (Other event listeners and utility functions maintained) ...
// (Restored generate3bldScrambleText for fallback use)
function generate3bldScrambleText() {
    const s=["","'","2"], m=["U","D","L","R","F","B"]; let r=[], l="";
    for(let i=0;i<21;i++){let x; do{x=m[Math.floor(Math.random()*6)]}while(x[0]===l[0]); r.push(x+s[Math.floor(Math.random()*3)]); l=x;}
    const wm=["Uw","Dw","Lw","Rw","Fw","Bw"]; for(let i=0;i<Math.floor(Math.random()*2)+1;i++) r.push(wm[Math.floor(Math.random()*6)]+s[Math.floor(Math.random()*3)]);
    return r.join(" ");
}

// Global Event Listeners (Fixing Spacebar & Touch)
window.addEventListener('keydown', e => { 
    const ae = document.activeElement;
    const isVisibleInput = ae.tagName === 'INPUT' && ae.offsetParent !== null;
    if(editingSessionId || isVisibleInput) { if(e.code === 'Enter' && ae === manualInput) {} else { return; } } 
    if(e.code==='Space' && !e.repeat) { 
        if (ae.tagName === 'BUTTON' || ae.tagName === 'A') ae.blur();
        e.preventDefault(); handleStart(); 
    } 
    if(isManualMode && e.code==='Enter') { 
        let v = parseFloat(manualInput.value); 
        if(v>0) { solves.unshift({ id:Date.now(), time:v*1000, scramble:currentScramble, event:currentEvent, sessionId: getCurrentSessionId(), penalty:null, date: new Date().toLocaleDateString('ko-KR').replace(/\.$/,"") }); manualInput.value=""; updateUI(); generateScramble(); saveData(); } 
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
document.getElementById('clearHistoryBtn').onclick = () => { const sid = getCurrentSessionId(); const msg = `Clear history?`; const d = document.createElement('div'); d.id='cM'; d.innerHTML = `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl"><p class="text-sm font-bold text-slate-700 dark:text-white mb-6 text-center">${msg}</p><div class="flex gap-2"><button id="cC" class="flex-1 py-3 text-slate-400 font-bold text-sm">Cancel</button><button id="cO" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm">Clear</button></div></div></div>`; document.body.appendChild(d); document.getElementById('cC').onclick = () => { document.body.removeChild(d); }; document.getElementById('cO').onclick = () => { solves = solves.filter(s => !(s.event === currentEvent && s.sessionId === sid)); updateUI(); saveData(); document.body.removeChild(d); timerEl.innerText = (0).toFixed(precision); resetPenalty(); }; };

function changeEvent(e) {
    if(isRunning) return; currentEvent = e;
    const conf = eventMap[e]; // Use eventMap for config
    initSessionIfNeeded(e); displayedSolvesCount = SOLVES_BATCH_SIZE; if(historyList) historyList.scrollTop = 0;
    document.querySelectorAll('.event-tab').forEach(t => { t.classList.remove('active', 'text-white', 'bg-blue-600'); t.classList.add('text-slate-500', 'dark:text-slate-400'); });
    const activeTab = document.getElementById(`tab-${e}`); if (activeTab) { activeTab.classList.add('active', 'text-white', 'bg-blue-600'); activeTab.classList.remove('text-slate-500', 'dark:text-slate-400'); }
    
    if (configs[e]?.cat === 'blind') { activeTool = 'graph'; selectTool('graph'); }
    else { if (activeTool === 'graph') selectTool('graph'); else selectTool('scramble'); }

    if (['666', '777', '333bf', '444bf', '555bf', '333mbf'].includes(e)) { isAo5Mode = false; avgModeToggle.checked = false; } else { isAo5Mode = true; avgModeToggle.checked = true; }

    if (currentEvent === '333mbf') { scrambleEl.classList.add('hidden'); mbfInputArea.classList.remove('hidden'); }
    else { scrambleEl.classList.remove('hidden'); mbfInputArea.classList.add('hidden'); generateScramble(); }
    updateUI(); timerEl.innerText = (0).toFixed(precision); saveData();
}

function switchCategory(cat, autoSelectFirst = true) {
    if(isRunning) return;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active', 'text-white'));
    const catBtn = document.getElementById(`cat-${cat}`); if (catBtn) { catBtn.classList.add('active', 'text-white'); catBtn.classList.remove('text-slate-500', 'dark:text-slate-400'); }
    const groups = ['standard', 'nonstandard', 'blind'];
    groups.forEach(g => { const el = document.getElementById(`group-${g}`); if (g === cat) { el.classList.remove('hidden'); el.classList.add('flex'); } else { el.classList.add('hidden'); el.classList.remove('flex'); } });
    if (autoSelectFirst) { const targetGroup = document.getElementById(`group-${cat}`); const firstButton = targetGroup.querySelector('button'); if (firstButton) changeEvent(firstButton.id.replace('tab-', '')); }
}

// Initial Load
loadData(); 
// Ensure libraries load before generating scramble if possible, or fallback
window.onload = () => { changeEvent(currentEvent); };
// Safety: if onload fired already or fails, ensure we have something
if (!currentScramble) generateScramble();
checkUpdateLog();
