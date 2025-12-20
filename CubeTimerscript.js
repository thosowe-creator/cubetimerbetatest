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
        // Silently fail if blocked by permissions policy to avoid user annoyance
        console.log(`Wake Lock not available: ${err.message}`);
        // Optional: visual feedback that wake lock failed could go here, but kept silent as requested.
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

// Re-request wake lock when visibility changes
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && isWakeLockEnabled) {
        await requestWakeLock();
    }
});

// --- Hold Duration ---
function updateHoldDuration(val) {
    holdDuration = parseFloat(val) * 1000;
    holdDurationValue.innerText = val + "s";
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
            isReady = false;
            timerEl.classList.add('text-ready'); 
            statusHint.innerText = "Ready!";
        } else if (state === 1) { // GET_SET
        } else if (state === 2) { // HANDS_OFF
             timerEl.classList.remove('text-ready', 'text-running');
             statusHint.innerText = "Timer Ready (BT)";
        } else if (state === 3) { // RUNNING
            if (!isRunning) {
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
    startTime = Date.now(); 
    isRunning = true;
    timerInterval = setInterval(()=> {
        timerEl.innerText = formatTime(Date.now()-startTime);
    }, 10);
    statusHint.innerText = "Timing..."; 
    // Use the CSS class for running state to support dark mode automatically
    timerEl.classList.add('text-running');
    timerEl.classList.remove('text-ready');
}

function stopTimer(forcedTime = null) {
    clearInterval(timerInterval);
    let elapsed = forcedTime !== null ? forcedTime : (Date.now() - startTime);
    
    if (elapsed > 10) {
        solves.unshift({
            id: Date.now(), 
            time: elapsed, 
            scramble: currentScramble, 
            event: currentEvent, 
            sessionId: getCurrentSessionId(), 
            penalty: null,
            date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, "")
        });
        timerEl.innerText = formatTime(elapsed);
    }
    
    isRunning = isReady = false; 
    updateUI(); 
    generateScramble();
    statusHint.innerText = isBtConnected ? "Ready (Bluetooth)" : "Hold to Ready"; 
    timerEl.classList.remove('text-running', 'text-ready'); 
    saveData();
}

// --- Penalty Functions (Restored) ---
function updatePenaltyBtns(s) {
    // Safe check for elements existence
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
    timerEl.innerText = targetSolve.penalty==='DNF'?'DNF':formatTime(targetSolve.penalty==='+2'?targetSolve.time+2000:targetSolve.time) + (targetSolve.penalty==='+2'?'+':'');
    updateUI(); updatePenaltyBtns(targetSolve); saveData();
}

// --- Data Persistence ---
function exportData() {
    const data = {
        solves: solves,
        sessions: sessions,
        settings: { precision, isAo5Mode, currentEvent, holdDuration, isDarkMode: document.documentElement.classList.contains('dark'), isWakeLockEnabled }
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
                    
                    precisionToggle.checked = (precision === 3);
                    avgModeToggle.checked = isAo5Mode;
                    darkModeToggle.checked = isDark;
                    wakeLockToggle.checked = isWakeLockEnabled;
                    holdDurationSlider.value = holdDuration / 1000;
                    updateHoldDuration(holdDurationSlider.value);
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
            isWakeLockEnabled
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

                precisionToggle.checked = (precision === 3);
                avgModeToggle.checked = isAo5Mode;
                darkModeToggle.checked = isDark;
                wakeLockToggle.checked = isWakeLockEnabled;
                holdDurationSlider.value = holdDuration / 1000;
                holdDurationValue.innerText = holdDurationSlider.value + "s";
                document.documentElement.classList.toggle('dark', isDark);
                if(isWakeLockEnabled) requestWakeLock();

                const conf = configs[currentEvent];
                if (conf) switchCategory(conf.cat, false);
            }
        } catch (e) { console.error("Load failed", e); }
    }
    initSessionIfNeeded(currentEvent);
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

// --- Cube Logic (Same as before) ---
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
        // WCA Clock Notation: 
        // UR, DR, DL, UL (dials 0-6)
        // U, R, D, L (dials 0-6)
        // ALL (dial 0-6)
        // y2
        // U, R, D, L, ALL (dials 0-6)
        // UR, DR, DL, UL (Pins UP/DOWN) - Usually handled as binary state at end
        
        // Current simplified: Randomize all dial turns
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
        // Square-1 Simulation Logic
        // Represent layer cut positions as boolean array of length 12 (1 unit = 30 deg)
        // True = Cut allowed at this index (Piece boundary)
        // Initial State: 
        // Top: Corner(2), Edge(1), Corner(2), Edge(1)...
        // Positions: 0(C), 2(E), 3(C), 5(E), 6(C), 8(E), 9(C), 11(E)
        // Cuts allowed at: 0, 2, 3, 5, 6, 8, 9, 11
        let topCuts = [true, false, true, true, false, true, true, false, true, true, false, true];
        let botCuts = [true, false, true, true, false, true, true, false, true, true, false, true]; // Symmetric
        
        // Standard notation is (u, d) / ...
        // u, d are integers -5 to 6.
        // Move action: rotate the cuts array indices.
        // Slash action: swap right half (indices 6 to 11) of Top and Bot.
        // Validity check: topCuts[0], topCuts[6], botCuts[0], botCuts[6] must all be TRUE.
        // Actually, slash axis is at 0 and 6. 
        // Relative to layer: 
        // If we perform (u, d), the layer rotates. The static slash axis stays.
        // So we check if the layer's NEW position has cuts at 0 and 6.
        
        let movesCount = 0;
        let scrambleOps = [];
        let topOffset = 0; // Cumulative offset
        let botOffset = 0;
        
        // Helper to check slash ability
        const canSlash = () => {
            // Indices in standard array 0..11
            // Current piece boundary at index `i` in the array corresponds to physical position `(i + offset) % 12`?
            // No, let's rotate the array itself to simulate the move.
            return topCuts[0] && topCuts[6] && botCuts[0] && botCuts[6];
        };
        
        const rotateArray = (arr, amt) => {
            // Rotate right by amt (positive = clockwise?) 
            // SQ1 notation: positive = clockwise top, positive = clockwise bottom (looking from bottom? No, relative to cut).
            // Let's just standard shift.
            // (1,0) means top rotates 30deg.
            // Array index 0 moves to 1?
            // Let's implement logical rotation: shift array elements.
            // Javascript: unshift/pop or splice.
            
            const n = 12;
            let amount = amt % n;
            if (amount < 0) amount += n;
            
            // Rotate right by amount
            const spliced = arr.splice(n - amount, amount);
            arr.unshift(...spliced);
        };

        while (movesCount < 12) { // 12 shape-shifting moves is decent
            // Try random u, d
            let u = Math.floor(Math.random() * 12) - 5; // -5 to 6
            let d = Math.floor(Math.random() * 12) - 5;
            
            if (u === 0 && d === 0) continue;
            
            // Tentatively rotate copies
            let nextTop = [...topCuts];
            let nextBot = [...botCuts];
            
            // Apply rotation to arrays (simulating the move)
            // Note: In SQ1 notation, (3,0) moves Top layer 90 degrees.
            // The 'seam' is fixed. The pieces move.
            // So we shift the piece-boundary-map.
            // Warning: SQ1 notation direction vs Array shift direction.
            // Let's assume standard: (1,0) shifts pieces "left" relative to seam? 
            // Actually, if we rotate top layer Clockwise, the piece at index 0 moves to index 1.
            // So we shift array right.
            rotateArray(nextTop, u);
            rotateArray(nextBot, d);
            
            // Check if slash is valid in this new orientation
            if (nextTop[0] && nextTop[6] && nextBot[0] && nextBot[6]) {
                // Valid move sequence
                scrambleOps.push(`(${u},${d})`);
                
                // Apply Slash: Swap right halves (indices 6..11)
                let topRight = nextTop.slice(6, 12);
                let botRight = nextBot.slice(6, 12);
                
                // Construct new arrays
                // Top becomes: TopLeft + BotRight
                // Bot becomes: BotLeft + TopRight
                let newTop = [...nextTop.slice(0, 6), ...botRight];
                let newBot = [...nextBot.slice(0, 6), ...topRight];
                
                topCuts = newTop;
                botCuts = newBot;
                
                scrambleOps.push("/");
                movesCount++;
            }
            // Else: loop and try different random numbers
        }
        currentScramble = scrambleOps.join(" ");

    } else if (['pyra', 'skewb'].includes(currentEvent)) {
        // Simple random moves
        let last = "";
        for (let i = 0; i < conf.len; i++) {
            let m;
            do {
                m = conf.moves[Math.floor(Math.random() * conf.moves.length)];
            } while (m === last);
            res.push(m + (Math.random() < 0.5 ? "'" : ""));
            last = m;
        }
        if (currentEvent === 'pyra') {
            conf.tips.forEach(t => {
                const r = Math.floor(Math.random() * 3);
                if (r === 1) res.push(t);
                else if (r === 2) res.push(t + "'");
            });
        }
        currentScramble = res.join(" ");
        
    } else {
        // NxN (3x3, 2x2, 4x4...) Optimized Random Move
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

                // 1. Same base check (e.g. R followed by R)
                if (base === lastMoveBase) {
                    valid = false; continue;
                }

                // 2. Axis check (Avoid 3 moves on same axis like F B F)
                // If current axis is same as last axis (e.g. F followed by B), 
                // check if the one before last was ALSO same axis.
                if (axis !== -1 && axis === lastAxis && axis === secondLastAxis) {
                    valid = false; continue;
                }
                
                valid = true;
            }
            
            res.push(move + suffixes[Math.floor(Math.random() * 3)]);
            
            secondLastAxis = lastAxis;
            lastAxis = axis;
            lastMoveBase = base;
        }

        // Add WCA-like orientation for blind/large cubes if needed? 
        // Usually only for 3BLD or if specifically requested.
        // Code handles 'blind' category check
        if (currentEvent === '333bf') {
            const wideMoveCount = Math.floor(Math.random() * 2) + 1;
            for (let i = 0; i < wideMoveCount; i++) {
                const wm = wideMoves[Math.floor(Math.random() * wideMoves.length)];
                const suf = suffixes[Math.floor(Math.random() * 3)];
                res.push(wm + suf);
            }
        } else if (conf.cat === 'blind') {
            // Random orientation for Blind
            res.push(orientations[Math.floor(Math.random() * orientations.length)]);
            if (Math.random() > 0.5) res.push(orientations[Math.floor(Math.random() * orientations.length)]);
        }
        currentScramble = res.join(" ");
    }
    
    scrambleEl.innerText = currentScramble;
    if (conf.n) { 
        initCube(conf.n); 
        currentScramble.split(/\s+/).filter(s => s && !orientations.includes(s) && s!=='y2').forEach(applyMove); 
        drawCube(); 
    } else { 
        cubeState={}; drawCube(); 
    }
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

function formatTime(ms) { return (ms/1000).toFixed(precision); } // Simplified for brevity in logic update

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
    
    // Best Avgs (Simple sliding window calculation could be added here for perfection, keeping simple current avg for now)
    // Ideally we iterate to find best. Let's do simple Current Avg for now to keep code light.
    
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
    
    // Trim logic: Best 5% and Worst 5% removal for large averages (standard WCA is usually just 1 best 1 worst for Ao5, Ao12)
    // For Ao5: remove 1 best, 1 worst.
    // For Ao12: remove 1 best, 1 worst.
    // For Ao100: remove 5 best, 5 worst.
    let removeCount = Math.ceil(count * 0.05); // 5%
    if (count <= 12) removeCount = 1; 

    if(dnfC >= removeCount + (mean?0:1)) return "DNF"; // Rough DNF logic

    let nums = slice.map(s => s.penalty==='DNF'?Infinity:(s.penalty==='+2'?s.time+2000:s.time));
    if(mean) return (nums.reduce((a,b)=>a+b,0)/count/1000).toFixed(precision);
    
    nums.sort((a,b)=>a-b); 
    // Remove outliers
    for(let i=0; i<removeCount; i++) { nums.pop(); nums.shift(); }
    
    return (nums.reduce((a,b)=>a+b,0)/nums.length/1000).toFixed(precision);
}

// --- Interaction Logic with configurable Hold Time ---
function handleStart(e) {
    if (isBtConnected) return; 
    if(e && e.cancelable) e.preventDefault();
    if(isManualMode || isRunning) { if(isRunning) stopTimer(); return; }
    
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
    if (isBtConnected) return; 
    if(e && e.cancelable) e.preventDefault();
    clearTimeout(holdTimer);
    if(!isRunning && isReady) startTimer();
    else { 
        // Reset color logic for dark mode
        const isDark = document.documentElement.classList.contains('dark');
        timerEl.style.color = ''; 
        // We rely on CSS class handling or remove inline style to revert to class-based color
        // Removing inline style allows CSS to take over (text-slate-800 or dark:text-slate-100)
        
        timerEl.classList.remove('holding-status','ready-to-start'); 
        isReady=false; 
        statusHint.innerText="Hold to Ready"; 
    }
}

window.openSessionModal = () => { document.getElementById('sessionOverlay').classList.add('active'); renderSessionList(); };
window.closeSessionModal = () => { document.getElementById('sessionOverlay').classList.remove('active'); document.getElementById('newSessionName').value = ""; editingSessionId = null; };

// ... (Session Management Functions: renderSessionList, editSessionName, saveSessionName, createNewSession, switchSession, deleteSession - kept same logic, just HTML template updated implicitly by not changing logic, but renderSessionList needs template update for Dark Mode) ...

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

// ... (Remaining window functions: editSessionName, saveSessionName, createNewSession, switchSession, deleteSession, openAvgShare, openSingleShare, closeAvgShare, copyShareText, eventListeners, showSolveDetails, closeModal, useThisScramble, document.getElementById('clearHistoryBtn').onclick - All logic preserved) ...
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