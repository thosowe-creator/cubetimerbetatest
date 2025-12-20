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

// Inspection Logic Vars
let isInspectionMode = false;
let inspectionState = 'none'; // 'none', 'inspecting', 'holding'
let inspectionStartTime = 0;
let inspectionInterval = null;
let inspectionPenalty = null; // null, '+2', 'DNF'
let hasSpoken8 = false;
let hasSpoken12 = false;
let lastStopTimestamp = 0;

// Update Log Configuration
const APP_VERSION = '1.1'; 
const UPDATE_LOGS = [
    "V1.1 모바일 UI 개편",
    "Gan Halo Timer 사용 시 소숫점이 반올림되던 현상 수정",
    "인스펙션 기능 추가",
];

// Lazy Loading Vars
let displayedSolvesCount = 50;
const SOLVES_BATCH_SIZE = 50;

let btDevice = null;
let btCharacteristic = null;
let isBtConnected = false;
let lastBtState = null;

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
const visualizerCanvas = document.getElementById('cubeVisualizer');
const noVisualizerMsg = document.getElementById('noVisualizerMsg');
const avgModeToggle = document.getElementById('avgModeToggle');
const precisionToggle = document.getElementById('precisionToggle');
const manualEntryToggle = document.getElementById('manualEntryToggle');
const darkModeToggle = document.getElementById('darkModeToggle');
const wakeLockToggle = document.getElementById('wakeLockToggle');
const holdDurationSlider = document.getElementById('holdDurationSlider');
const holdDurationValue = document.getElementById('holdDurationValue');
const inspectionToggle = document.getElementById('inspectionToggle');

// UI Sections for Mobile Tab Switching
const timerSection = document.getElementById('timerSection');
const historySection = document.getElementById('historySection');
const mobTabTimer = document.getElementById('mob-tab-timer');
const mobTabHistory = document.getElementById('mob-tab-history');

const configs = {
    '333': { moves: ["U","D","L","R","F","B"], len: 21, n: 3, cat: 'standard' },
    '333oh': { moves: ["U","D","L","R","F","B"], len: 21, n: 3, cat: 'standard' },
    '222': { moves: ["U","R","F"], len: 11, n: 2, cat: 'standard' },
    '444': { moves: ["U","D","L","R","F","B","Uw","Rw","Fw"], len: 44, n: 4, cat: 'standard' },
    '555': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw"], len: 60, n: 5, cat: 'standard' },
    '666': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw","3Uw","3Rw","3Fw"], len: 80, n: 6, cat: 'standard' },
    '777': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw","3Uw","3Dw","3Lw","3Rw","3Fw","3Bw"], len: 100, n: 7, cat: 'standard' },
    'minx': { moves: ["R++","R--","D++","D--"], len: 77, cat: 'nonstandard' },
    'pyra': { moves: ["U","L","R","B"], len: 10, tips: ["u","l","r","b"], cat: 'nonstandard' },
    'clock': { len: 18, cat: 'nonstandard' },
    'skewb': { moves: ["U","L","R","B"], len: 10, cat: 'nonstandard' },
    'sq1': { len: 12, cat: 'nonstandard' },
    '333bf': { moves: ["U","D","L","R","F","B"], len: 21, n: 3, cat: 'blind' },
    '444bf': { moves: ["U","D","L","R","F","B","Uw","Rw","Fw"], len: 44, n: 4, cat: 'blind' },
    '555bf': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw"], len: 60, n: 5, cat: 'blind' },
    '333mbf': { moves: ["U","D","L","R","F","B"], len: 21, n: 3, cat: 'blind' }
};

const suffixes = ["", "'", "2"];
const orientations = ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"];
const wideMoves = ["Uw", "Dw", "Lw", "Rw", "Fw", "Bw"]; 

let cubeState = {};
const COLORS = { U: '#FFFFFF', D: '#FFD500', L: '#FF8C00', R: '#DC2626', F: '#16A34A', B: '#2563EB' };

// --- Mobile Tab Logic ---
window.switchMobileTab = (tab) => {
    if (tab === 'timer') {
        // Show Timer, Hide History
        timerSection.classList.remove('hidden');
        historySection.classList.add('hidden');
        
        // Update Tab Colors
        mobTabTimer.className = "flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400";
        mobTabHistory.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors";
    } else if (tab === 'history') {
        // Hide Timer, Show History
        timerSection.classList.add('hidden');
        historySection.classList.remove('hidden');
        // Force flex for history section when active on mobile
        historySection.classList.add('flex');

        // Update Tab Colors
        mobTabHistory.className = "flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400";
        mobTabTimer.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors";
        
        // Refresh graph if tool is active
        if(activeTool === 'graph') renderHistoryGraph();
    }
};

// Ensure desktop layout on resize
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        // Desktop: Show both
        timerSection.classList.remove('hidden');
        historySection.classList.remove('hidden');
        historySection.classList.add('flex');
    } else {
        // Mobile: Revert to current tab state (defaulting to timer if mixed)
        if (mobTabTimer.classList.contains('text-blue-600') || mobTabTimer.classList.contains('text-blue-400')) {
            switchMobileTab('timer');
        } else {
            switchMobileTab('history');
        }
    }
});

// --- Update Log Logic ---
function checkUpdateLog() {
    const savedVersion = localStorage.getItem('appVersion');
    if (savedVersion !== APP_VERSION) {
        document.getElementById('updateVersion').innerText = `v${APP_VERSION}`;
        const list = document.getElementById('updateList');
        list.innerHTML = UPDATE_LOGS.map(log => `<li>${log}</li>`).join('');
        document.getElementById('updateLogOverlay').classList.add('active');
    }
}
window.closeUpdateLog = () => {
    document.getElementById('updateLogOverlay').classList.remove('active');
    localStorage.setItem('appVersion', APP_VERSION);
};

// --- Inspection Logic ---
function toggleInspection(checkbox) {
    isInspectionMode = checkbox.checked;
    
    // Force set hold duration to ~0 if inspection is ON
    if (isInspectionMode) {
        updateHoldDuration(0.01); // Basically instant
        holdDurationSlider.value = 0.01;
        holdDurationSlider.disabled = true;
        document.getElementById('holdDurationContainer').classList.add('opacity-50', 'pointer-events-none');
    } else {
        updateHoldDuration(0.3);
        holdDurationSlider.value = 0.3;
        holdDurationSlider.disabled = false;
        document.getElementById('holdDurationContainer').classList.remove('opacity-50', 'pointer-events-none');
    }
    
    saveData();
}

function startInspection() {
    inspectionState = 'inspecting';
    inspectionStartTime = Date.now();
    inspectionPenalty = null;
    hasSpoken8 = false;
    hasSpoken12 = false;
    
    timerEl.classList.remove('text-ready');
    timerEl.style.color = '#ef4444'; // Red color for inspection countdown
    statusHint.innerText = "Inspection";

    if(inspectionInterval) clearInterval(inspectionInterval);
    inspectionInterval = setInterval(() => {
        const elapsed = (Date.now() - inspectionStartTime) / 1000;
        const remaining = 15 - elapsed;
        
        if (remaining > 0) {
            timerEl.innerText = Math.ceil(remaining);
        } else if (remaining > -2) {
            timerEl.innerText = "+2";
            inspectionPenalty = '+2';
        } else {
            timerEl.innerText = "DNF";
            inspectionPenalty = 'DNF';
        }

        // TTS
        if (elapsed >= 8 && !hasSpoken8) {
            speak("Eight seconds");
            hasSpoken8 = true;
        }
        if (elapsed >= 12 && !hasSpoken12) {
            speak("Twelve seconds");
            hasSpoken12 = true;
        }
    }, 100);
}

function stopInspection() {
    if(inspectionInterval) clearInterval(inspectionInterval);
    inspectionState = 'none';
    timerEl.style.color = '';
    // Calculate penalty one last time to be precise
    if (isInspectionMode && inspectionStartTime > 0) {
        const elapsed = (Date.now() - inspectionStartTime) / 1000;
        if (elapsed > 17) inspectionPenalty = 'DNF';
        else if (elapsed > 15) inspectionPenalty = '+2';
        else inspectionPenalty = null;
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.2;
        window.speechSynthesis.speak(utterance);
    }
}

// --- Dark Mode ---
function toggleDarkMode(checkbox) {
    const isDark = checkbox.checked;
    document.documentElement.classList.toggle('dark', isDark);
    saveData();
    if(activeTool === 'graph') renderHistoryGraph();
}

// --- Wake Lock ---
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { console.log('Wake Lock released'); });
        }
    } catch (err) {
        console.log(`Wake Lock not available: ${err.message}`);
    }
}

async function toggleWakeLock(checkbox) {
    isWakeLockEnabled = checkbox.checked;
    if (isWakeLockEnabled) {
        await requestWakeLock();
    } else if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
    }
    saveData();
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && isWakeLockEnabled) {
        await requestWakeLock();
    }
});

function updateHoldDuration(val) {
    holdDuration = parseFloat(val) * 1000;
    holdDurationValue.innerText = val < 0.1 ? "Instant" : val + "s";
    saveData();
}

// --- Bluetooth & Timer Logic ---
window.openBTModal = () => document.getElementById('btOverlay').classList.add('active');
window.closeBTModal = () => document.getElementById('btOverlay').classList.remove('active');

async function connectGanTimer() {
    const btBtn = document.getElementById('btConnectBtn');
    const btStatusText = document.getElementById('btStatusText');
    const btIcon = document.getElementById('btModalIcon');

    if (!navigator.bluetooth) {
        btStatusText.innerText = "Web Bluetooth is not supported in this browser.";
        btStatusText.classList.add('text-red-400');
        return;
    }

    try {
        btBtn.disabled = true;
        btBtn.innerText = "Searching...";
        btStatusText.innerText = "Select your GAN Timer in the popup";
        btIcon.classList.add('bt-pulse');

        btDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'GAN' }],
            optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb']
        });

        const server = await btDevice.gatt.connect();
        const service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
        
        btCharacteristic = await service.getCharacteristic('0000fff5-0000-1000-8000-00805f9b34fb');

        await btCharacteristic.startNotifications();
        btCharacteristic.addEventListener('characteristicvaluechanged', handleGanBTData);

        isBtConnected = true;
        document.getElementById('btStatusIcon').classList.replace('disconnected', 'connected');
        document.getElementById('btInfoPanel').classList.remove('hidden');
        document.getElementById('btDeviceName').innerText = btDevice.name;
        document.getElementById('btDisconnectBtn').classList.remove('hidden');
        btBtn.classList.add('hidden');
        btStatusText.innerText = "Timer Connected & Ready";
        btIcon.classList.remove('bt-pulse');
        
        statusHint.innerText = "Timer Ready (BT)";
        btDevice.addEventListener('gattserverdisconnected', onBTDisconnected);

    } catch (error) {
        console.error("Bluetooth Connection Error:", error);
        btStatusText.innerText = "Connection failed";
        btBtn.disabled = false;
        btBtn.innerText = "Connect Timer";
        btIcon.classList.remove('bt-pulse');
    }
}

function handleGanBTData(event) {
    const data = event.target.value;
    if (data.byteLength < 4) return; 

    const state = data.getUint8(3);
    
    // Sync time when not running (1:GetSet, 2:HandsOff, 4:Stopped)
    if (state !== 3 && !isRunning && data.byteLength >= 8) {
        const min = data.getUint8(4);
        const sec = data.getUint8(5);
        const msec = data.getUint16(6, true);
        const currentMs = (min * 60000) + (sec * 1000) + msec;
        timerEl.innerText = formatTime(currentMs);
    }

    if (state !== lastBtState) {
        if (state === 6) { // HANDS_ON
            // If inspecting, do not reset ready state (user puts hands on timer during inspection)
            if (!isInspectionMode) {
                isReady = false;
                timerEl.classList.add('text-ready'); 
                statusHint.innerText = "Ready!";
            }
        } else if (state === 1) { // GET_SET
        } else if (state === 2) { // HANDS_OFF (Just released)
             // If inspecting, this is where we start the solve and end inspection
             if (!isInspectionMode) {
                 timerEl.classList.remove('text-ready', 'text-running');
                 statusHint.innerText = "Timer Ready (BT)";
             }
        } else if (state === 3) { // RUNNING
            if (!isRunning) {
                // If inspection mode was active, stop it and check penalty
                if (isInspectionMode && inspectionState === 'inspecting') {
                    stopInspection();
                }

                startTime = Date.now();
                isRunning = true;
                if(timerInterval) clearInterval(timerInterval);
                timerInterval = setInterval(() => {
                    timerEl.innerText = formatTime(Date.now() - startTime);
                }, 16);
                
                timerEl.classList.remove('text-ready');
                timerEl.classList.add('text-running');
                statusHint.innerText = "Timing...";
            }
        } else if (state === 4) { // STOPPED
            if (isRunning) {
                clearInterval(timerInterval);
                isRunning = false;
                if (data.byteLength >= 8) {
                    const min = data.getUint8(4);
                    const sec = data.getUint8(5);
                    const msec = data.getUint16(6, true); 
                    const finalMs = (min * 60000) + (sec * 1000) + msec;
                    
                    timerEl.innerText = formatTime(finalMs);
                    stopTimer(finalMs);
                }
                timerEl.classList.remove('text-running');
                statusHint.innerText = "Finished";
            }
        }
        lastBtState = state;
    }
}

function disconnectBT() {
    if (btDevice && btDevice.gatt.connected) {
        btDevice.gatt.disconnect();
    }
}

function onBTDisconnected() {
    isBtConnected = false;
    lastBtState = null;
    document.getElementById('btStatusIcon').classList.replace('connected', 'disconnected');
    document.getElementById('btInfoPanel').classList.add('hidden');
    document.getElementById('btDisconnectBtn').classList.add('hidden');
    const btBtn = document.getElementById('btConnectBtn');
    btBtn.classList.remove('hidden');
    btBtn.disabled = false;
    btBtn.innerText = "Connect Timer";
    document.getElementById('btStatusText').innerText = "Timer Disconnected";
    statusHint.innerText = "Hold to Ready";
}

function startTimer() {
    if(inspectionInterval) clearInterval(inspectionInterval); 
    inspectionState = 'none';
    
    startTime = Date.now(); 
    isRunning = true;
    timerInterval = setInterval(()=> {
        timerEl.innerText = formatTime(Date.now()-startTime);
    }, 10);
    
    timerEl.style.color = ''; 
    statusHint.innerText = "Timing..."; 
    timerEl.classList.add('text-running');
    timerEl.classList.remove('text-ready');
}

function stopTimer(forcedTime = null) {
    clearInterval(timerInterval);
    let elapsed = forcedTime !== null ? forcedTime : (Date.now() - startTime);
    lastStopTimestamp = Date.now(); 
    
    let finalPenalty = inspectionPenalty; 

    if (elapsed > 10 || finalPenalty === 'DNF') {
        solves.unshift({
            id: Date.now(), 
            time: elapsed, 
            scramble: currentScramble, 
            event: currentEvent, 
            sessionId: getCurrentSessionId(), 
            penalty: finalPenalty,
            date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, "")
        });
        
        if (finalPenalty === 'DNF') {
            timerEl.innerText = "DNF";
        } else {
            let displayTime = formatTime(elapsed);
            if (finalPenalty === '+2') {
                displayTime = formatTime(elapsed + 2000) + "+";
            }
            timerEl.innerText = displayTime;
        }
    }
    
    isRunning = isReady = false; 
    inspectionState = 'none'; 
    inspectionPenalty = null; 
    
    updateUI(); 
    generateScramble();
    statusHint.innerText = isBtConnected ? "Ready (Bluetooth)" : (isInspectionMode ? "Start Inspection" : "Hold to Ready"); 
    timerEl.classList.remove('text-running', 'text-ready'); 
    timerEl.style.color = ''; 
    saveData();
}

// --- Penalty Functions ---
function updatePenaltyBtns(s) {
    if (plus2Btn && dnfBtn) {
        plus2Btn.className = `penalty-btn ${s?.penalty==='+2'?'active-plus2':'inactive'}`;
        dnfBtn.className = `penalty-btn ${s?.penalty==='DNF'?'active-dnf':'inactive'}`;
    }
}

function resetPenalty() {
    updatePenaltyBtns(null);
}

function deleteSolve(id) {
    solves = solves.filter(s => s.id !== id);
    updateUI();
    saveData();
}

function togglePenalty(p) {
    if(!solves.length || isRunning) return;
    const sid = getCurrentSessionId();
    const currentList = solves.filter(s => s.event === currentEvent && s.sessionId === sid);
    if (!currentList.length) return;
    const targetSolve = currentList[0];
    targetSolve.penalty = (targetSolve.penalty===p)?null:p;
    
    if (targetSolve.penalty === 'DNF') {
        timerEl.innerText = 'DNF';
    } else {
        const t = targetSolve.time + (targetSolve.penalty === '+2' ? 2000 : 0);
        timerEl.innerText = formatTime(t) + (targetSolve.penalty === '+2' ? '+' : '');
    }
    
    updateUI(); updatePenaltyBtns(targetSolve); saveData();
}

// --- Data Persistence ---
function exportData() {
    const data = {
        solves: solves,
        sessions: sessions,
        settings: { 
            precision, 
            isAo5Mode, 
            currentEvent, 
            holdDuration, 
            isDarkMode: document.documentElement.classList.contains('dark'), 
            isWakeLockEnabled,
            isInspectionMode 
        }
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cubetimer_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function triggerImport() { document.getElementById('importInput').click(); }

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.solves && data.sessions) {
                solves = data.solves;
                sessions = data.sessions;
                if (data.settings) {
                    precision = data.settings.precision || 2;
                    isAo5Mode = data.settings.isAo5Mode !== undefined ? data.settings.isAo5Mode : true;
                    currentEvent = data.settings.currentEvent || '333';
                    holdDuration = data.settings.holdDuration || 300;
                    isWakeLockEnabled = data.settings.isWakeLockEnabled || false;
                    const isDark = data.settings.isDarkMode || false;
                    isInspectionMode = data.settings.isInspectionMode || false;
                    
                    precisionToggle.checked = (precision === 3);
                    avgModeToggle.checked = isAo5Mode;
                    darkModeToggle.checked = isDark;
                    wakeLockToggle.checked = isWakeLockEnabled;
                    inspectionToggle.checked = isInspectionMode;
                    
                    toggleInspection(inspectionToggle);
                    if (!isInspectionMode) {
                        holdDurationSlider.value = holdDuration / 1000;
                        updateHoldDuration(holdDurationSlider.value);
                    }

                    document.documentElement.classList.toggle('dark', isDark);
                    if(isWakeLockEnabled) requestWakeLock();
                }
                saveData();
                location.reload(); 
            } else { throw new Error("Invalid format"); }
        } catch (err) {
            alert("Failed to restore data. Invalid JSON.");
        }
    };
    reader.readAsText(file);
}

function saveData() {
    const data = {
        solves: solves,
        sessions: sessions,
        settings: { 
            precision, 
            isAo5Mode, 
            currentEvent, 
            holdDuration,
            isDarkMode: document.documentElement.classList.contains('dark'),
            isWakeLockEnabled,
            isInspectionMode
        }
    };
    localStorage.setItem('cubeTimerData_v5', JSON.stringify(data));
}

function loadData() {
    const saved = localStorage.getItem('cubeTimerData_v5') || localStorage.getItem('cubeTimerData_v4');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            solves = data.solves || [];
            sessions = data.sessions || {};
            if (data.settings) {
                precision = data.settings.precision || 2;
                isAo5Mode = data.settings.isAo5Mode !== undefined ? data.settings.isAo5Mode : true;
                currentEvent = data.settings.currentEvent || '333';
                holdDuration = data.settings.holdDuration || 300;
                const isDark = data.settings.isDarkMode || false;
                isWakeLockEnabled = data.settings.isWakeLockEnabled || false;
                isInspectionMode = data.settings.isInspectionMode || false;

                precisionToggle.checked = (precision === 3);
                avgModeToggle.checked = isAo5Mode;
                darkModeToggle.checked = isDark;
                wakeLockToggle.checked = isWakeLockEnabled;
                inspectionToggle.checked = isInspectionMode;
                
                if (isInspectionMode) {
                    toggleInspection(inspectionToggle);
                } else {
                    holdDurationSlider.value = holdDuration / 1000;
                    holdDurationValue.innerText = holdDurationSlider.value + "s";
                }

                document.documentElement.classList.toggle('dark', isDark);
                if(isWakeLockEnabled) requestWakeLock();

                const conf = configs[currentEvent];
                if (conf) switchCategory(conf.cat, false);
            }
        } catch (e) { console.error("Load failed", e); }
    }
    initSessionIfNeeded(currentEvent);
    
    if (!isBtConnected) {
        statusHint.innerText = isInspectionMode ? "Start Inspection" : "Hold to Ready";
    }
}

function initSessionIfNeeded(eventId) {
    if (!sessions[eventId] || sessions[eventId].length === 0) {
        sessions[eventId] = [{ id: Date.now(), name: "Session 1", isActive: true }];
    } else if (!sessions[eventId].find(s => s.isActive)) {
        sessions[eventId][0].isActive = true;
    }
}

function getCurrentSessionId() {
    const eventSessions = sessions[currentEvent] || [];
    const active = eventSessions.find(s => s.isActive);
    if (active) return active.id;
    initSessionIfNeeded(currentEvent);
    return sessions[currentEvent][0].id;
}

// --- Cube Logic ---
function initCube(n = 3) {
    cubeState = { n };
    ['U','D','L','R','F','B'].forEach(f => cubeState[f] = Array(n*n).fill(COLORS[f]));
}
function rotateFaceMatrix(fName) {
    const n = cubeState.n; const f = cubeState[fName]; const next = Array(n*n);
    for(let r=0; r<n; r++) for(let c=0; c<n; c++) next[c*n + (n-1-r)] = f[r*n + c];
    cubeState[fName] = next;
}
function applyMove(move) {
    const n = cubeState.n; if(!n) return;
    let base = move[0], layer = 1;
    if(move.includes('w')) {
        if(/^\d/.test(move)) { layer = parseInt(move[0]); base = move[1]; }
        else { layer = 2; base = move[0]; }
    }
    const reps = move.includes("'") ? 3 : (move.includes("2") ? 2 : 1);
    for(let r=0; r<reps; r++) {
        for(let l=1; l<=layer; l++) {
            if(l===1) rotateFaceMatrix(base);
            const d = l-1, last = n-1-d;
            if(base==='U') for(let i=0; i<n; i++) { let t=cubeState.F[d*n+i]; cubeState.F[d*n+i]=cubeState.R[d*n+i]; cubeState.R[d*n+i]=cubeState.B[d*n+i]; cubeState.B[d*n+i]=cubeState.L[d*n+i]; cubeState.L[d*n+i]=t; }
            else if(base==='D') for(let i=0; i<n; i++) { let t=cubeState.F[last*n+i]; cubeState.F[last*n+i]=cubeState.L[last*n+i]; cubeState.L[last*n+i]=cubeState.B[last*n+i]; cubeState.B[last*n+i]=cubeState.R[last*n+i]; cubeState.R[last*n+i]=t; }
            else if(base==='L') for(let i=0; i<n; i++) { let t=cubeState.F[i*n+d]; cubeState.F[i*n+d]=cubeState.U[i*n+d]; cubeState.U[i*n+d]=cubeState.B[(n-1-i)*n+(n-1-d)]; cubeState.B[(n-1-i)*n+(n-1-d)]=cubeState.D[i*n+d]; cubeState.D[i*n+d]=t; }
            else if(base==='R') for(let i=0; i<n; i++) { let t=cubeState.F[i*n+last]; cubeState.F[i*n+last]=cubeState.D[i*n+last]; cubeState.D[i*n+last]=cubeState.B[(n-1-i)*n+d]; cubeState.B[(n-1-i)*n+d]=cubeState.U[i*n+last]; cubeState.U[i*n+last]=t; }
            else if(base==='F') for(let i=0; i<n; i++) { let t=cubeState.U[last*n+i]; cubeState.U[last*n+i]=cubeState.L[(n-1-i)*n+last]; cubeState.L[(n-1-i)*n+last]=cubeState.D[d*n+(n-1-i)]; cubeState.D[d*n+(n-1-i)]=cubeState.R[i*n+d]; cubeState.R[i*n+d]=t; }
            else if(base==='B') for(let i=0; i<n; i++) { let t=cubeState.U[d*n+i]; cubeState.U[d*n+i]=cubeState.R[i*n+last]; cubeState.R[i*n+last]=cubeState.D[last*n+(n-1-i)]; cubeState.D[last*n+(n-1-i)]=cubeState.L[(n-1-i)*n+d]; cubeState.L[(n-1-i)*n+d]=t; }
        }
    }
}
function drawCube() {
    const n = cubeState.n;
    if(!n || configs[currentEvent]?.cat === 'blind') { 
        visualizerCanvas.style.display='none'; 
        noVisualizerMsg.innerText = configs[currentEvent]?.cat === 'blind' ? "Scramble images disabled for Blind" : "Visualizer for standard cubes only";
        noVisualizerMsg.classList.remove('hidden'); 
        return; 
    }
    visualizerCanvas.style.display='block'; 
    noVisualizerMsg.classList.add('hidden');
    const ctx = visualizerCanvas.getContext('2d');
    const faceS = 55, tileS = faceS/n, gap = 4;
    ctx.clearRect(0,0,260,190);
    const offX = (260-(4*faceS+3*gap))/2, offY = (190-(3*faceS+2*gap))/2;
    const drawF = (f,x,y) => cubeState[f].forEach((c,i) => {
        ctx.fillStyle=c; ctx.fillRect(x+(i%n)*tileS, y+Math.floor(i/n)*tileS, tileS, tileS);
        ctx.strokeStyle='#1e293b'; ctx.lineWidth=n>5?0.2:0.5; ctx.strokeRect(x+(i%n)*tileS, y+Math.floor(i/n)*tileS, tileS, tileS);
    });
    drawF('U', offX+faceS+gap, offY);
    drawF('L', offX, offY+faceS+gap);
    drawF('F', offX+faceS+gap, offY+faceS+gap);
    drawF('R', offX+2*(faceS+gap), offY+faceS+gap);
    drawF('B', offX+3*(faceS+gap), offY+faceS+gap);
    drawF('D', offX+faceS+gap, offY+2*(faceS+gap));
}

// --- Tools & UI ---
window.toggleToolsMenu = (e) => { e.stopPropagation(); document.getElementById('toolsDropdown').classList.toggle('show'); };
window.selectTool = (tool) => {
    activeTool = tool;
    const isBlind = configs[currentEvent]?.cat === 'blind';
    document.getElementById('toolLabel').innerText = isBlind ? 'N/A (Blind)' : (tool === 'scramble' ? 'Scramble Image' : 'Graph (Trends)');
    document.getElementById('visualizerWrapper').classList.toggle('hidden', tool !== 'scramble');
    document.getElementById('graphWrapper').classList.toggle('hidden', tool !== 'graph');
    document.querySelectorAll('.tool-option').forEach(opt => opt.classList.remove('active'));
    document.getElementById(`tool-opt-${tool}`).classList.add('active');
    document.getElementById('toolsDropdown').classList.remove('show');
    if (tool === 'graph') renderHistoryGraph();
    else if (tool === 'scramble') drawCube();
};
window.addEventListener('click', () => { document.getElementById('toolsDropdown').classList.remove('show'); });

function renderHistoryGraph() {
    if (activeTool !== 'graph') return;
    const sid = getCurrentSessionId();
    const filtered = [...solves].filter(s => s.event === currentEvent && s.sessionId === sid).reverse();
    const polyline = document.getElementById('graphLine');
    if (filtered.length < 2) { polyline.setAttribute('points', ""); return; }
    const validTimes = filtered.map(s => s.penalty === 'DNF' ? null : (s.penalty === '+2' ? s.time + 2000 : s.time));
    const maxTime = Math.max(...validTimes.filter(t => t !== null));
    const minTime = Math.min(...validTimes.filter(t => t !== null));
    const range = maxTime - minTime || 1;
    const points = filtered.map((s, i) => {
        const t = s.penalty === 'DNF' ? maxTime : (s.penalty === '+2' ? s.time + 2000 : s.time);
        const x = (i / (filtered.length - 1)) * 100;
        const y = 90 - ((t - minTime) / range) * 80;
        return `${x},${y}`;
    }).join(' ');
    polyline.setAttribute('points', points);
}

function switchCategory(cat, autoSelectFirst = true) {
    if(isRunning) return;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active', 'text-white'));
    const catBtn = document.getElementById(`cat-${cat}`); 
    if (catBtn) { 
        catBtn.classList.add('active', 'text-white'); 
        catBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
    }
    const groups = ['standard', 'nonstandard', 'blind'];
    groups.forEach(g => {
        const el = document.getElementById(`group-${g}`);
        if (g === cat) { el.classList.remove('hidden'); el.classList.add('flex'); }
        else { el.classList.add('hidden'); el.classList.remove('flex'); }
    });
    if (autoSelectFirst) {
        const targetGroup = document.getElementById(`group-${cat}`);
        const firstButton = targetGroup.querySelector('button');
        if (firstButton) changeEvent(firstButton.id.replace('tab-', ''));
    }
}

function changeEvent(e) {
    if(isRunning) return;
    currentEvent = e;
    const conf = configs[e];
    initSessionIfNeeded(e);
    
    // Reset lazy loading on event change
    displayedSolvesCount = SOLVES_BATCH_SIZE;
    if(historyList) historyList.scrollTop = 0;

    document.querySelectorAll('.event-tab').forEach(t => {
        t.classList.remove('active', 'text-white', 'bg-blue-600');
        t.classList.add('text-slate-500', 'dark:text-slate-400');
    });
    const activeTab = document.getElementById(`tab-${e}`); 
    if (activeTab) {
        activeTab.classList.add('active', 'text-white', 'bg-blue-600');
        activeTab.classList.remove('text-slate-500', 'dark:text-slate-400');
    }
    
    if (conf.cat === 'blind') {
        activeTool = 'graph'; 
        selectTool('graph');
    } else {
        if (activeTool === 'graph') selectTool('graph');
        else selectTool('scramble');
    }

    if (['666', '777', '333bf', '444bf', '555bf', '333mbf'].includes(e)) { 
        isAo5Mode = false; avgModeToggle.checked = false; 
    } else { 
        isAo5Mode = true; avgModeToggle.checked = true; 
    }

    if (currentEvent === '333mbf') {
        scrambleEl.classList.add('hidden');
        mbfInputArea.classList.remove('hidden');
    } else {
        scrambleEl.classList.remove('hidden');
        mbfInputArea.classList.add('hidden');
        generateScramble(); 
    }
    
    updateUI(); timerEl.innerText = (0).toFixed(precision); saveData();
}

function generate3bldScrambleText() {
    const conf = configs['333bf'];
    let res = [];
    let last = "";
    for (let i = 0; i < conf.len; i++) {
        let m; do { m = conf.moves[Math.floor(Math.random() * conf.moves.length)]; } while (m[0] === last[0]);
        res.push(m + suffixes[Math.floor(Math.random() * 3)]); last = m;
    }
    const wideMoveCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < wideMoveCount; i++) {
        const wm = wideMoves[Math.floor(Math.random() * wideMoves.length)];
        const suf = suffixes[Math.floor(Math.random() * 3)];
        res.push(wm + suf);
    }
    return res.join(" ");
}

function generateScramble() {
    const conf = configs[currentEvent]; if (!conf || currentEvent === '333mbf') return;
    let res = [];
    
    if (currentEvent === 'minx') {
        // Megaminx: Pochmann style, optimized
        // 7 lines of R++ D++ ...
        for (let i = 0; i < 7; i++) {
            let line = [];
            // 10 moves per line (5 pairs of R/D)
            for (let j = 0; j < 10; j++) {
                // WCA style: R++ or R--, D++ or D--
                // Usually alternating R and D
                const type = (j % 2 === 0) ? "R" : "D";
                const suffix = (Math.random() < 0.5) ? "++" : "--";
                line.push(type + suffix);
            }
            // End with U or U'
            line.push(Math.random() < 0.5 ? "U" : "U'");
            res.push(line.join(" "));
        }
        currentScramble = res.join("\n");
        
    } else if (currentEvent === 'clock') {
        // WCA Clock Notation
        const dials = ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"];
        dials.forEach(d => {
            const v = Math.floor(Math.random() * 12) - 5; // -5 to 6
            res.push(`${d}${v >= 0 ? '+' : ''}${v}`);
        });
        res.push("y2");
        const dials2 = ["U", "R", "D", "L", "ALL"];
        dials2.forEach(d => {
            const v = Math.floor(Math.random() * 12) - 5;
            res.push(`${d}${v >= 0 ? '+' : ''}${v}`);
        });
        // Pins: Randomly up or down
        let pins = [];
        ["UR", "DR", "DL", "UL"].forEach(p => {
            if (Math.random() < 0.5) pins.push(p);
        });
        if (pins.length) res.push(pins.join(" "));
        currentScramble = res.join(" ");
        
    } else if (currentEvent === 'sq1') {
        // Square-1 Simulation Logic (Truncated for brevity, same as before)
        // ... (Logic remains identical to previous version, ensuring standard randomness)
        let topCuts = [true, false, true, true, false, true, true, false, true, true, false, true];
        let botCuts = [true, false, true, true, false, true, true, false, true, true, false, true]; 
        
        let movesCount = 0;
        let scrambleOps = [];
        
        const rotateArray = (arr, amt) => {
            const n = 12;
            let amount = amt % n;
            if (amount < 0) amount += n;
            const spliced = arr.splice(n - amount, amount);
            arr.unshift(...spliced);
        };

        while (movesCount < 12) {
            let u = Math.floor(Math.random() * 12) - 5;
            let d = Math.floor(Math.random() * 12) - 5;
            if (u === 0 && d === 0) continue;
            let nextTop = [...topCuts];
            let nextBot = [...botCuts];
            rotateArray(nextTop, u);
            rotateArray(nextBot, d);
            
            if (nextTop[0] && nextTop[6] && nextBot[0] && nextBot[6]) {
                scrambleOps.push(`(${u},${d})`);
                let topRight = nextTop.slice(6, 12);
                let botRight = nextBot.slice(6, 12);
                let newTop = [...nextTop.slice(0, 6), ...botRight];
                let newBot = [...nextBot.slice(0, 6), ...topRight];
                topCuts = newTop;
                botCuts = newBot;
                scrambleOps.push("/");
                movesCount++;
            }
        }
        currentScramble = scrambleOps.join(" ");

    } else if (['pyra', 'skewb'].includes(currentEvent)) {
        let last = "";
        for (let i = 0; i < conf.len; i++) {
            let m;
            do { m = conf.moves[Math.floor(Math.random() * conf.moves.length)]; } while (m === last);
            res.push(m + (Math.random() < 0.5 ? "'" : "")); last = m;
        }
        if (currentEvent === 'pyra') {
            conf.tips.forEach(t => {
                const r = Math.floor(Math.random() * 3);
                if (r === 1) res.push(t); else if (r === 2) res.push(t + "'");
            });
        }
        currentScramble = res.join(" ");
        
    } else {
        // NxN Logic (Same as before)
        let lastAxis = -1;
        let secondLastAxis = -1;
        let lastMoveBase = "";
        const getMoveAxis = (m) => {
            const c = m[0]; 
            if ("UD".includes(c)) return 0;
            if ("LR".includes(c)) return 1;
            if ("FB".includes(c)) return 2;
            return -1;
        };

        for (let i = 0; i < conf.len; i++) {
            let move, axis, base;
            let valid = false;
            while (!valid) {
                move = conf.moves[Math.floor(Math.random() * conf.moves.length)];
                axis = getMoveAxis(move);
                base = move[0]; 
                if (base === lastMoveBase) { valid = false; continue; }
                if (axis !== -1 && axis === lastAxis && axis === secondLastAxis) { valid = false; continue; }
                valid = true;
            }
            res.push(move + suffixes[Math.floor(Math.random() * 3)]);
            secondLastAxis = lastAxis;
            lastAxis = axis;
            lastMoveBase = base;
        }
        if (currentEvent === '333bf') {
            const wideMoveCount = Math.floor(Math.random() * 2) + 1;
            for (let i = 0; i < wideMoveCount; i++) {
                const wm = wideMoves[Math.floor(Math.random() * wideMoves.length)];
                const suf = suffixes[Math.floor(Math.random() * 3)];
                res.push(wm + suf);
            }
        } else if (conf.cat === 'blind') {
            res.push(orientations[Math.floor(Math.random() * orientations.length)]);
            if (Math.random() > 0.5) res.push(orientations[Math.floor(Math.random() * orientations.length)]);
        }
        currentScramble = res.join(" ");
    }
    
    scrambleEl.innerText = currentScramble;
    if (conf.n) { initCube(conf.n); currentScramble.split(/\s+/).filter(s => s && !orientations.includes(s) && s!=='y2').forEach(applyMove); drawCube(); } else { cubeState={}; drawCube(); }
    resetPenalty();
    if (activeTool === 'graph') renderHistoryGraph();
}

window.generateMbfScrambles = () => {
    const count = parseInt(mbfCubeInput.value);
    if (!count || count < 2 || count > 100) return;
    const listContainer = document.getElementById('mbfScrambleList');
    document.getElementById('mbfCubeCountDisplay').innerText = `${count} Cubes`;
    listContainer.innerHTML = "";
    for (let i = 1; i <= count; i++) {
        const scr = generate3bldScrambleText();
        listContainer.innerHTML += `
            <div class="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl">
                <div class="flex items-center gap-2 mb-2">
                    <span class="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-[10px] font-bold">#${i}</span>
                    <span class="text-[10px] font-black uppercase text-slate-400">Scramble</span>
                </div>
                <p class="font-bold text-slate-600 dark:text-slate-300 leading-relaxed scramble-text">${scr}</p>
            </div>`;
    }
    document.getElementById('mbfScrambleOverlay').classList.add('active');
    currentScramble = `Multi-Blind (${count} Cubes Attempt)`;
};

window.closeMbfScrambleModal = () => document.getElementById('mbfScrambleOverlay').classList.remove('active');

window.copyMbfText = () => {
    const texts = Array.from(document.querySelectorAll('.scramble-text')).map((el, i) => `${i+1}. ${el.innerText}`).join('\n\n');
    const countText = document.getElementById('mbfCubeCountDisplay').innerText;
    const fullText = `[CubeTimer] Multi-Blind Scrambles (${countText})\n\n${texts}`;
    const textArea = document.createElement("textarea"); textArea.value = fullText; document.body.appendChild(textArea); textArea.select();
    document.execCommand('copy'); document.body.removeChild(textArea);
    const btn = document.querySelector('[onclick="copyMbfText()"]');
    const original = btn.innerText; btn.innerText = "Copied!"; setTimeout(() => btn.innerText = original, 2000);
};

// [UPDATED] Format Time to support Minutes:Seconds format
function formatTime(ms) { 
    const minutes = Math.floor(ms / 60000);
    const remainingMs = ms % 60000;
    let seconds;

    if (precision === 3) {
        seconds = (remainingMs / 1000).toFixed(3);
    } else {
        // For 2 decimals, we ignore the last digit (truncate)
        seconds = (Math.floor(remainingMs / 10) / 100).toFixed(2);
    }

    if (minutes > 0) {
        // Add leading zero if seconds is less than 10 (e.g. 1:05.43)
        if (parseFloat(seconds) < 10) {
            seconds = "0" + seconds;
        }
        return `${minutes}:${seconds}`;
    }
    return seconds;
} 

// Updated UpdateUI with Lazy Loading support
function updateUI() {
    const sid = getCurrentSessionId();
    let filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid);
    const activeSession = (sessions[currentEvent] || []).find(s => s.isActive);
    if (activeSession) document.getElementById('currentSessionNameDisplay').innerText = activeSession.name;
    
    // Lazy Render Logic
    const subset = filtered.slice(0, displayedSolvesCount);
    
    historyList.innerHTML = subset.map(s => `
        <div class="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl flex justify-between items-center group cursor-pointer hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all" onclick="showSolveDetails(${s.id})">
            <span class="font-bold text-slate-700 dark:text-slate-200 text-sm">${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span>
            <button onclick="event.stopPropagation(); deleteSolve(${s.id})" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('') || '<div class="text-center py-10 text-slate-300 text-[11px] italic">No solves yet</div>';

    solveCountEl.innerText = filtered.length;
    if (isAo5Mode) { labelPrimaryAvg.innerText = "Ao5"; displayPrimaryAvg.innerText = calculateAvg(filtered, 5); } 
    else { labelPrimaryAvg.innerText = "Mo3"; displayPrimaryAvg.innerText = calculateAvg(filtered, 3, true); }
    displayAo12.innerText = calculateAvg(filtered, 12);
    let valid = filtered.filter(s=>s.penalty!=='DNF').map(s=>s.penalty==='+2'?s.time+2000:s.time);
    sessionAvgEl.innerText = valid.length ? formatTime(valid.reduce((a,b)=>a+b,0)/valid.length) : "-";
    bestSolveEl.innerText = valid.length ? formatTime(Math.min(...valid)) : "-";
    if (activeTool === 'graph') renderHistoryGraph();
}

// Infinite Scroll Event Listener
historyList.addEventListener('scroll', () => {
    if (historyList.scrollTop + historyList.clientHeight >= historyList.scrollHeight - 50) {
        // Near bottom
        const sid = getCurrentSessionId();
        const total = solves.filter(s => s.event === currentEvent && s.sessionId === sid).length;
        if (displayedSolvesCount < total) {
            displayedSolvesCount += SOLVES_BATCH_SIZE;
            updateUI(); // Re-render with more items
        }
    }
});

// Extended Stats Modal Logic
window.showExtendedStats = () => {
    const sid = getCurrentSessionId();
    const filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid);
    
    const ao25 = calculateAvg(filtered, 25);
    const ao50 = calculateAvg(filtered, 50);
    const ao100 = calculateAvg(filtered, 100);
    
    const content = document.getElementById('statsContent');
    content.innerHTML = `
        <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Current Ao25</span>
            <span class="text-lg font-bold text-slate-700 dark:text-white">${ao25}</span>
        </div>
        <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Current Ao50</span>
            <span class="text-lg font-bold text-slate-700 dark:text-white">${ao50}</span>
        </div>
        <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Current Ao100</span>
            <span class="text-lg font-bold text-slate-700 dark:text-white">${ao100}</span>
        </div>
    `;
    document.getElementById('statsOverlay').classList.add('active');
}
window.closeStatsModal = () => document.getElementById('statsOverlay').classList.remove('active');

function calculateAvg(list, count, mean=false) {
    if(list.length < count) return "-";
    let slice = list.slice(0, count); let dnfC = slice.filter(s=>s.penalty==='DNF').length;
    
    // Trim logic: Best 5% and Worst 5% removal for large averages
    let removeCount = Math.ceil(count * 0.05); // 5%
    if (count <= 12) removeCount = 1; 

    if(dnfC >= removeCount + (mean?0:1)) return "DNF"; 

    let nums = slice.map(s => s.penalty==='DNF'?Infinity:(s.penalty==='+2'?s.time+2000:s.time));
    if(mean) return (nums.reduce((a,b)=>a+b,0)/count/1000).toFixed(precision);
    
    nums.sort((a,b)=>a-b); 
    // Remove outliers
    for(let i=0; i<removeCount; i++) { nums.pop(); nums.shift(); }
    
    return (nums.reduce((a,b)=>a+b,0)/nums.length/1000).toFixed(precision);
}

// --- Interaction Logic with configurable Hold Time ---
function handleStart(e) {
    // BT 모드일 때: 인스펙션 모드가 아니면 키보드 입력 무시 (기존 로직)
    // 수정: BT + 인스펙션 모드면 키보드 허용 (인스펙션 시작용)
    if (isBtConnected && !isInspectionMode) return; 
    
    if(e && e.cancelable) e.preventDefault();
    if(isManualMode || isRunning) { if(isRunning) stopTimer(); return; }
    
    // Inspection Logic Handling
    if (isInspectionMode && inspectionState === 'none') {
        // Space pressed in Idle with inspection ON: Do nothing (wait for release to start inspection)
        return;
    }

    if (isInspectionMode && inspectionState === 'inspecting') {
        // BT 연결 시에는 키보드로 'Ready' 상태 진입 불가 (오직 간 타이머 핸즈온으로만 가능)
        if (isBtConnected) return;

        // Pressed during inspection -> Ready to solve
        timerEl.style.color = '#ef4444'; 
        timerEl.classList.add('holding-status');
        holdTimer = setTimeout(()=> { 
            isReady=true; 
            timerEl.style.color = '#10b981'; 
            timerEl.classList.replace('holding-status','ready-to-start'); 
            statusHint.innerText="Ready!"; 
        }, holdDuration); 
        return;
    }

    // Standard Logic (BT 연결 시 여기 도달 안함)
    timerEl.style.color = '#ef4444'; 
    timerEl.classList.add('holding-status');
    
    holdTimer = setTimeout(()=> { 
        isReady=true; 
        timerEl.style.color = '#10b981'; 
        timerEl.classList.replace('holding-status','ready-to-start'); 
        statusHint.innerText="Ready!"; 
    }, holdDuration); 
}

function handleEnd(e) {
    // [CRITICAL FIX] Prevent immediate inspection restart after stopping timer
    if (Date.now() - lastStopTimestamp < 500) return;

    // BT 모드일 때
    if (isBtConnected) {
        if (isInspectionMode && inspectionState === 'none') {
             // BT 연결되어 있어도 인스펙션 모드라면 스페이스바 뗄 때 인스펙션 시작 허용
             startInspection(); 
        }
        // BT 모드에서는 키보드 뗄 때 절대 startTimer() 호출 금지
        return; 
    }

    if(e && e.cancelable) e.preventDefault();
    clearTimeout(holdTimer);

    if (isManualMode) return;

    // Inspection Mode: Start Countdown on Release if Idle
    if (isInspectionMode && !isRunning && inspectionState === 'none') {
        startInspection();
        return;
    }

    if(!isRunning && isReady) {
        startTimer();
    } else { 
        // Reset color logic for dark mode
        timerEl.style.color = ''; 
        
        timerEl.classList.remove('holding-status','ready-to-start'); 
        isReady=false; 
        // If inspecting, don't reset to "Hold to Ready"
        if (!isInspectionMode || inspectionState === 'none') {
            statusHint.innerText= isInspectionMode ? "Start Inspection" : "Hold to Ready";
        } else {
            // Returned to inspecting state without starting
            timerEl.style.color = '#ef4444'; 
        }
    }
}

window.openSessionModal = () => { document.getElementById('sessionOverlay').classList.add('active'); renderSessionList(); };
window.closeSessionModal = () => { document.getElementById('sessionOverlay').classList.remove('active'); document.getElementById('newSessionName').value = ""; editingSessionId = null; };

// ... (Session Management Functions - Logic Preserved) ...

function renderSessionList() {
    const listContainer = document.getElementById('sessionList');
    const eventSessions = sessions[currentEvent] || [];
    document.getElementById('sessionCountLabel').innerText = `${eventSessions.length}/10`;
    listContainer.innerHTML = eventSessions.map(s => {
        if (editingSessionId === s.id) {
            return `<div class="flex items-center gap-2"><input type="text" id="editSessionInput" value="${s.name}" class="flex-1 bg-white dark:bg-slate-800 border border-blue-400 rounded-xl px-3 py-2.5 text-xs font-bold outline-none dark:text-white" autofocus onkeydown="if(event.key==='Enter') saveSessionName(${s.id})" onblur="saveSessionName(${s.id})"><button onclick="saveSessionName(${s.id})" class="p-2 text-blue-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button></div>`;
        }
        return `<div class="flex items-center gap-2 group"><div class="flex-1 flex items-center gap-2 p-1 rounded-xl border ${s.isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><button onclick="switchSession(${s.id})" class="flex-1 text-left p-2.5 text-xs font-bold truncate">${s.name}</button><button onclick="editSessionName(${s.id})" class="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></div>${eventSessions.length > 1 ? `<button onclick="deleteSession(${s.id})" class="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ''}</div>`;
    }).join('');
    if (editingSessionId) document.getElementById('editSessionInput').focus();
    document.getElementById('sessionCreateForm').classList.toggle('hidden', eventSessions.length >= 10);
}

// ... (Remaining window functions - Logic Preserved) ...
window.editSessionName = (id) => { editingSessionId = id; renderSessionList(); };
window.saveSessionName = (id) => { const input = document.getElementById('editSessionInput'); if (!input) return; const newName = input.value.trim(); if (newName) { const s = sessions[currentEvent].find(x => x.id === id); if (s) s.name = newName; } editingSessionId = null; renderSessionList(); updateUI(); saveData(); };
window.createNewSession = () => { const nameInput = document.getElementById('newSessionName'); const name = nameInput.value.trim() || `Session ${sessions[currentEvent].length + 1}`; if (sessions[currentEvent].length >= 10) return; sessions[currentEvent].forEach(s => s.isActive = false); sessions[currentEvent].push({ id: Date.now(), name: name, isActive: true }); nameInput.value = ""; renderSessionList(); updateUI(); saveData(); timerEl.innerText = (0).toFixed(precision); resetPenalty(); };
window.switchSession = (id) => { sessions[currentEvent].forEach(s => s.isActive = (s.id === id)); renderSessionList(); updateUI(); saveData(); timerEl.innerText = (0).toFixed(precision); resetPenalty(); closeSessionModal(); };
window.deleteSession = (id) => { const eventSessions = sessions[currentEvent]; if (!eventSessions || eventSessions.length <= 1) return; const targetIdx = eventSessions.findIndex(s => s.id === id); if (targetIdx === -1) return; const wasActive = eventSessions[targetIdx].isActive; sessions[currentEvent] = eventSessions.filter(s => s.id !== id); solves = solves.filter(s => !(s.event === currentEvent && s.sessionId === id)); if (wasActive && sessions[currentEvent].length > 0) sessions[currentEvent][0].isActive = true; renderSessionList(); updateUI(); saveData(); };
window.openAvgShare = (type) => { const sid = getCurrentSessionId(); const count = (type === 'primary') ? (isAo5Mode ? 5 : 3) : 12; const filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid); if (filtered.length < count) return; const list = filtered.slice(0, count); const avgValue = calculateAvg(filtered, count, (type === 'primary' && !isAo5Mode)); const dateStr = list[0].date || new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, ""); document.getElementById('shareDate').innerText = `Date : ${dateStr}.`; document.getElementById('shareLabel').innerText = (type === 'primary' && !isAo5Mode) ? `Mean of 3 :` : `Average of ${count} :`; document.getElementById('shareAvg').innerText = avgValue; const listContainer = document.getElementById('shareList'); listContainer.innerHTML = list.map((s, idx) => `<div class="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><div class="flex items-center gap-3"><span class="text-[10px] font-bold text-slate-400 w-4">${count - idx}.</span><span class="font-bold text-slate-800 dark:text-slate-200 text-sm min-w-[50px]">${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><span class="text-[10px] text-slate-400 font-medium italic truncate flex-grow">${s.scramble}</span></div></div>`).reverse().join(''); document.getElementById('avgShareOverlay').classList.add('active'); };
window.openSingleShare = () => { const s = solves.find(x => x.id === selectedSolveId); if (!s) return; closeModal(); const dateStr = s.date || new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, ""); document.getElementById('shareDate').innerText = `Date : ${dateStr}.`; document.getElementById('shareLabel').innerText = `Single :`; document.getElementById('shareAvg').innerText = s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time) + (s.penalty==='+2'?'+':''); const listContainer = document.getElementById('shareList'); listContainer.innerHTML = `<div class="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><div class="flex items-center gap-3"><span class="text-[10px] font-bold text-slate-400 w-4">1.</span><span class="font-bold text-slate-800 dark:text-slate-200 text-sm min-w-[50px]">${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><span class="text-[10px] text-slate-400 font-medium italic truncate flex-grow">${s.scramble}</span></div></div>`; document.getElementById('avgShareOverlay').classList.add('active'); };
window.closeAvgShare = () => document.getElementById('avgShareOverlay').classList.remove('active');
window.copyShareText = () => { const date = document.getElementById('shareDate').innerText; const avgLabel = document.getElementById('shareLabel').innerText; const avgVal = document.getElementById('shareAvg').innerText; const isSingle = avgLabel.includes('Single'); let text = `[CubeTimer]\n\n${date}\n\n${avgLabel} ${avgVal}\n\n`; if (isSingle) { const s = solves.find(x => x.id === selectedSolveId); if (s) text += `1. ${avgVal}   ${s.scramble}\n`; } else { const count = avgLabel.includes('5') ? 5 : (avgLabel.includes('3') ? 3 : 12); const sid = getCurrentSessionId(); const filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid).slice(0, count); filtered.reverse().forEach((s, i) => { text += `${i+1}. ${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}   ${s.scramble}\n`; }); } const textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select(); try { document.execCommand('copy'); const btn = document.querySelector('[onclick="copyShareText()"]'); const original = btn.innerHTML; btn.innerHTML = "Copied!"; btn.classList.add('bg-green-600'); setTimeout(() => { btn.innerHTML = original; btn.classList.remove('bg-green-600'); }, 2000); } catch (err) { console.error('Copy failed', err); } document.body.removeChild(textArea); };
window.addEventListener('keydown', e => { if(editingSessionId || document.activeElement.tagName === 'INPUT') { if(e.code === 'Enter' && document.activeElement === manualInput) {} else { return; } } if(e.code==='Space' && !e.repeat) { e.preventDefault(); handleStart(); } if(isManualMode && e.code==='Enter') { let v = parseFloat(manualInput.value); if(v>0) { solves.unshift({ id:Date.now(), time:v*1000, scramble:currentScramble, event:currentEvent, sessionId: getCurrentSessionId(), penalty:null, date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, "") }); manualInput.value=""; updateUI(); generateScramble(); saveData(); } } });
window.addEventListener('keyup', e => { if(e.code==='Space' && !editingSessionId) handleEnd(); });
const interactiveArea = document.getElementById('timerInteractiveArea');
interactiveArea.addEventListener('touchstart', handleStart, { passive: false });
interactiveArea.addEventListener('touchend', handleEnd, { passive: false });
window.openSettings = () => { document.getElementById('settingsOverlay').classList.add('active'); setTimeout(()=>document.getElementById('settingsModal').classList.remove('scale-95','opacity-0'), 10); };
window.closeSettings = () => { document.getElementById('settingsModal').classList.add('scale-95','opacity-0'); setTimeout(()=>document.getElementById('settingsOverlay').classList.remove('active'), 200); saveData(); };
window.handleOutsideSettingsClick = (e) => { if(e.target === document.getElementById('settingsOverlay')) closeSettings(); };
window.showSolveDetails = (id) => { let s = solves.find(x=>x.id===id); if(!s) return; selectedSolveId = id; document.getElementById('modalTime').innerText = s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time); document.getElementById('modalEvent').innerText = s.event; document.getElementById('modalScramble').innerText = s.scramble; document.getElementById('modalOverlay').classList.add('active'); };
window.closeModal = () => document.getElementById('modalOverlay').classList.remove('active');
window.useThisScramble = () => { let s=solves.find(x=>x.id===selectedSolveId); if(s){currentScramble=s.scramble; scrambleEl.innerText=currentScramble; closeModal();} };
precisionToggle.onchange = e => { precision = e.target.checked?3:2; updateUI(); timerEl.innerText=(0).toFixed(precision); saveData(); };
avgModeToggle.onchange = e => { isAo5Mode = e.target.checked; updateUI(); saveData(); };
manualEntryToggle.onchange = e => { isManualMode = e.target.checked; timerEl.classList.toggle('hidden', isManualMode); manualInput.classList.toggle('hidden', !isManualMode); statusHint.innerText = isManualMode ? "TYPE TIME & ENTER" : "HOLD TO READY"; };
document.getElementById('clearHistoryBtn').onclick = () => { const sid = getCurrentSessionId(); const msg = `Clear all history for this session?`; const customConfirm = document.createElement('div'); customConfirm.id = 'clearConfirmModal'; customConfirm.innerHTML = `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl"><p class="text-sm font-bold text-slate-700 dark:text-white mb-6 text-center">${msg}</p><div class="flex gap-2"><button id="cancelClear" class="flex-1 py-3 text-slate-400 font-bold text-sm">Cancel</button><button id="confirmClear" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm">Clear All</button></div></div></div>`; document.body.appendChild(customConfirm); document.getElementById('cancelClear').onclick = () => { document.body.removeChild(document.getElementById('clearConfirmModal')); }; document.getElementById('confirmClear').onclick = () => { solves = solves.filter(s => !(s.event === currentEvent && s.sessionId === sid)); updateUI(); saveData(); document.body.removeChild(document.getElementById('clearConfirmModal')); timerEl.innerText = (0).toFixed(precision); resetPenalty(); }; };

loadData(); 
changeEvent(currentEvent);
// Check for updates on load
checkUpdateLog();
