/**
 * Cube Timer Logic
 * Version: 1.2.3 (Mobile Touch Fix & Format Preserved)
 */

// ==========================================
// 1. Global Variables & State Management
// ==========================================

// Timer State
let isRunning = false;
let isReady = false;
let startTime;
let timerFrameId; // Changed from timerInterval for requestAnimationFrame
let holdTimer = null;
let holdDuration = 300; // ms
let lastStopTimestamp = 0;

// Solve Data
let solves = [];
let sessions = {};
let currentEvent = '333';
let currentScramble = "";
let selectedSolveId = null;
let editingSessionId = null;

// Settings & Modes
let precision = 2;
let isManualMode = false;
let isAo5Mode = true;
let isDarkMode = false;
let isWakeLockEnabled = false;
let wakeLock = null;
let activeTool = 'scramble';

// Inspection Logic
let isInspectionMode = false;
let inspectionState = 'none'; // 'none', 'inspecting', 'holding'
let inspectionStartTime = 0;
let inspectionInterval = null;
let inspectionPenalty = null; // null, '+2', 'DNF'
let hasSpoken8 = false;
let hasSpoken12 = false;

// Bluetooth Logic
let btDevice = null;
let btCharacteristic = null;
let isBtConnected = false;
let lastBtState = null;

// Lazy Loading
let displayedSolvesCount = 50;
const SOLVES_BATCH_SIZE = 50;

// App Info
const APP_VERSION = '1.2.3';
const UPDATE_HISTORY = [
    {
        date: "2025.12.23",
        ver: "V1.2.3",
        content: ["모바일 스크롤 및 클릭 문제 수정", "타이머 폰트 복구"]
    },
    {
        date: "2025.12.23",
        ver: "V1.2.2",
        content: ["그래프 디자인 원복 (단순 선 형태)"]
    },
    {
        date: "2025.12.23",
        ver: "V1.2.0",
        content: [
            "데이터 저장 구조 최적화 (세션별 분할)",
            "타이머 렌더링 최적화 (rAF 적용)"
        ]
    },
    {
        date: "2025.12.23",
        ver: "V1.1.2",
        content: ["Square-1 스크램블 로직 구현"]
    },
    {
        date: "2025.12.22",
        ver: "V1.1.1",
        content: ["스페이스바를 통한 측정 불가 현상 수정"]
    },
    {
        date: "2025.12.21",
        ver: "V1.1",
        content: ["모바일 UI 개선", "인스펙션 기능 추가"]
    },
    {
        date: "2025.12.20",
        ver: "v1",
        content: ["최초공개"]
    }
];

// ==========================================
// 2. DOM Elements
// ==========================================

const UI = {
    timer: document.getElementById('timer'),
    scramble: document.getElementById('scramble'),
    mbfInputArea: document.getElementById('mbfInputArea'),
    mbfCubeInput: document.getElementById('mbfCubeInput'),
    manualInput: document.getElementById('manualInput'),
    historyList: document.getElementById('historyList'),
    solveCount: document.getElementById('solveCount'),
    sessionAvg: document.getElementById('sessionAvg'),
    bestSolve: document.getElementById('bestSolve'),
    labelPrimaryAvg: document.getElementById('labelPrimaryAvg'),
    displayPrimaryAvg: document.getElementById('displayPrimaryAvg'),
    displayAo12: document.getElementById('displayAo12'),
    statusHint: document.getElementById('statusHint'),
    plus2Btn: document.getElementById('plus2Btn'),
    dnfBtn: document.getElementById('dnfBtn'),
    visualizerCanvas: document.getElementById('cubeVisualizer'),
    noVisualizerMsg: document.getElementById('noVisualizerMsg'),

    // Toggles & Inputs
    avgModeToggle: document.getElementById('avgModeToggle'),
    precisionToggle: document.getElementById('precisionToggle'),
    manualEntryToggle: document.getElementById('manualEntryToggle'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    wakeLockToggle: document.getElementById('wakeLockToggle'),
    holdDurationSlider: document.getElementById('holdDurationSlider'),
    holdDurationValue: document.getElementById('holdDurationValue'),
    inspectionToggle: document.getElementById('inspectionToggle'),

    // Mobile UI
    timerSection: document.getElementById('timerSection'),
    historySection: document.getElementById('historySection'),
    mobTabTimer: document.getElementById('mob-tab-timer'),
    mobTabHistory: document.getElementById('mob-tab-history'),
};

// ==========================================
// 3. Configurations
// ==========================================

const configs = {
    '333': { moves: ["U", "D", "L", "R", "F", "B"], len: 21, n: 3, cat: 'standard' },
    '333oh': { moves: ["U", "D", "L", "R", "F", "B"], len: 21, n: 3, cat: 'standard' },
    '222': { moves: ["U", "R", "F"], len: 11, n: 2, cat: 'standard' },
    '444': { moves: ["U", "D", "L", "R", "F", "B", "Uw", "Rw", "Fw"], len: 44, n: 4, cat: 'standard' },
    '555': { moves: ["U", "D", "L", "R", "F", "B", "Uw", "Dw", "Lw", "Rw", "Fw", "Bw"], len: 60, n: 5, cat: 'standard' },
    '666': { moves: ["U", "D", "L", "R", "F", "B", "Uw", "Dw", "Lw", "Rw", "Fw", "Bw", "3Uw", "3Rw", "3Fw"], len: 80, n: 6, cat: 'standard' },
    '777': { moves: ["U", "D", "L", "R", "F", "B", "Uw", "Dw", "Lw", "Rw", "Fw", "Bw", "3Uw", "3Dw", "3Lw", "3Rw", "3Fw", "3Bw"], len: 100, n: 7, cat: 'standard' },
    'minx': { moves: ["R++", "R--", "D++", "D--"], len: 77, cat: 'nonstandard' },
    'pyra': { moves: ["U", "L", "R", "B"], len: 10, tips: ["u", "l", "r", "b"], cat: 'nonstandard' },
    'clock': { len: 18, cat: 'nonstandard' },
    'skewb': { moves: ["U", "L", "R", "B"], len: 10, cat: 'nonstandard' },
    'sq1': { len: 14, cat: 'nonstandard' },
    '333bf': { moves: ["U", "D", "L", "R", "F", "B"], len: 21, n: 3, cat: 'blind' },
    '444bf': { moves: ["U", "D", "L", "R", "F", "B", "Uw", "Rw", "Fw"], len: 44, n: 4, cat: 'blind' },
    '555bf': { moves: ["U", "D", "L", "R", "F", "B", "Uw", "Dw", "Lw", "Rw", "Fw", "Bw"], len: 60, n: 5, cat: 'blind' },
    '333mbf': { moves: ["U", "D", "L", "R", "F", "B"], len: 21, n: 3, cat: 'blind' }
};

const suffixes = ["", "'", "2"];
const orientations = ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"];
const wideMoves = ["Uw", "Dw", "Lw", "Rw", "Fw", "Bw"];
const COLORS = { U: '#FFFFFF', D: '#FFD500', L: '#FF8C00', R: '#DC2626', F: '#16A34A', B: '#2563EB' };
let cubeState = {};

// ==========================================
// 4. Initialization & Event Listeners
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    changeEvent(currentEvent);
    checkUpdateLog();
    initEventListeners();
});

function initEventListeners() {
    // Keyboard Interaction
    window.addEventListener('keydown', e => {
        if (editingSessionId || document.activeElement.tagName === 'INPUT') {
            if (e.code === 'Enter' && document.activeElement === UI.manualInput) { 
                // Allow enter for manual input 
            } else {
                return;
            }
        }
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            handleStart(e);
        }
        if (isManualMode && e.code === 'Enter') {
            submitManualTime();
        }
    });

    window.addEventListener('keyup', e => {
        if (e.code === 'Space' && !editingSessionId) {
            handleEnd(e);
        }
    });

    // Touch Interaction
    const interactiveArea = document.getElementById('timerInteractiveArea');
    interactiveArea.addEventListener('touchstart', handleStart, { passive: false });
    interactiveArea.addEventListener('touchend', handleEnd, { passive: false });

    // Settings Toggles
    UI.precisionToggle.onchange = e => {
        precision = e.target.checked ? 3 : 2;
        updateUI();
        UI.timer.innerText = (0).toFixed(precision);
        saveData();
    };
    UI.avgModeToggle.onchange = e => {
        isAo5Mode = e.target.checked;
        updateUI();
        saveData();
    };
    UI.manualEntryToggle.onchange = e => {
        isManualMode = e.target.checked;
        UI.timer.classList.toggle('hidden', isManualMode);
        UI.manualInput.classList.toggle('hidden', !isManualMode);
        UI.statusHint.innerText = isManualMode ? "TYPE TIME & ENTER" : "HOLD TO READY";
    };

    // Infinite Scroll
    UI.historyList.addEventListener('scroll', () => {
        if (UI.historyList.scrollTop + UI.historyList.clientHeight >= UI.historyList.scrollHeight - 50) {
            const sid = getCurrentSessionId();
            const total = solves.filter(s => s.event === currentEvent && s.sessionId === sid).length;
            if (displayedSolvesCount < total) {
                displayedSolvesCount += SOLVES_BATCH_SIZE;
                updateUI();
            }
        }
    });

    // Clear History Button
    document.getElementById('clearHistoryBtn').onclick = confirmClearHistory;

    // Tools Menu Close
    window.addEventListener('click', () => {
        document.getElementById('toolsDropdown').classList.remove('show');
    });

    // Wake Lock Visibility Change
    document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible' && isWakeLockEnabled) {
            await requestWakeLock();
        }
    });

    // Responsive Handling
    window.addEventListener('resize', handleResize);
}

// ==========================================
// 5. Timer Core Logic (Optimized Rendering)
// ==========================================

function handleStart(e) {
    if (e && e.type !== 'keydown' && e.target && (e.target.closest('.avg-badge') || e.target.closest('button') || e.target.closest('.tools-dropdown'))) {
        return;
    }
    if (isBtConnected && !isInspectionMode) {
        return;
    }

    if (e && e.cancelable) {
        // [FIXED] Only prevent default if it's NOT a touch event on interactive elements
        // Actually, preventing default on touchstart blocks clicking buttons inside it if logic is wrong.
        // We removed preventDefault() here to allow scrolling and clicking.
        // But we need to prevent default ONLY if we are actually starting the timer logic (holding).
        // e.preventDefault(); 
    }
    
    if (isManualMode || isRunning) {
        if (isRunning) stopTimer();
        if (e && e.cancelable) e.preventDefault(); // Prevent default only when stopping/manual
        return;
    }

    if (isInspectionMode) {
        if (inspectionState === 'none') return;
        if (inspectionState === 'inspecting') {
            if (isBtConnected) return;
            if (e && e.cancelable) e.preventDefault();
            prepareForStart();
            return;
        }
    }

    // Only prevent default and start holding if we are not scrolling (tough to distinguish)
    // For now, removing preventDefault allows scrolling. 
    // Holding for timer will still work as long as touch remains.
    prepareForStart();
}

function prepareForStart() {
    UI.timer.style.color = '#ef4444';
    UI.timer.classList.add('holding-status');
    holdTimer = setTimeout(() => {
        isReady = true;
        UI.timer.style.color = '#10b981';
        UI.timer.classList.replace('holding-status', 'ready-to-start');
        UI.statusHint.innerText = "Ready!";
    }, holdDuration);
}

function handleEnd(e) {
    if (Date.now() - lastStopTimestamp < 500) {
        return;
    }

    if (isBtConnected) {
        if (isInspectionMode && inspectionState === 'none') {
            startInspection();
        }
        return;
    }

    // [FIXED] Removed unconditional preventDefault to allow clicks/scrolls to finish
    // if (e && e.cancelable) { e.preventDefault(); }
    
    clearTimeout(holdTimer);

    if (isManualMode) {
        return;
    }

    if (isInspectionMode && !isRunning && inspectionState === 'none') {
        startInspection();
        return;
    }

    if (!isRunning && isReady) {
        startTimer();
    } else {
        resetTimerVisuals();
    }
}

function startTimer() {
    if (inspectionInterval) {
        clearInterval(inspectionInterval);
    }
    inspectionState = 'none';

    startTime = Date.now();
    isRunning = true;

    // [OPTIMIZATION] Use requestAnimationFrame instead of setInterval
    function updateTimerLoop() {
        if (isRunning) {
            UI.timer.innerText = formatTime(Date.now() - startTime);
            timerFrameId = requestAnimationFrame(updateTimerLoop);
        }
    }
    timerFrameId = requestAnimationFrame(updateTimerLoop);

    UI.timer.style.color = '';
    UI.statusHint.innerText = "Timing...";
    UI.timer.classList.add('text-running');
    UI.timer.classList.remove('text-ready');
}

function stopTimer(forcedTime = null) {
    // [OPTIMIZATION] Cancel requestAnimationFrame
    if (timerFrameId) {
        cancelAnimationFrame(timerFrameId);
    }

    let elapsed = forcedTime !== null ? forcedTime : (Date.now() - startTime);
    lastStopTimestamp = Date.now();

    let finalPenalty = inspectionPenalty;

    if (elapsed > 10 || finalPenalty === 'DNF') {
        addSolveToHistory(elapsed, finalPenalty);
        if (finalPenalty === 'DNF') {
            UI.timer.innerText = "DNF";
        } else {
            let displayTime = formatTime(elapsed);
            if (finalPenalty === '+2') {
                displayTime = formatTime(elapsed + 2000) + "+";
            }
            UI.timer.innerText = displayTime;
        }
    }

    isRunning = isReady = false;
    inspectionState = 'none';
    inspectionPenalty = null;

    updateUI();
    generateScramble();
    UI.statusHint.innerText = isBtConnected ? "Ready (Bluetooth)" : (isInspectionMode ? "Start Inspection" : "Hold to Ready");
    UI.timer.classList.remove('text-running', 'text-ready');
    UI.timer.style.color = '';
    saveData();
}

function resetTimerVisuals() {
    UI.timer.style.color = '';
    UI.timer.classList.remove('holding-status', 'ready-to-start');
    isReady = false;
    if (!isInspectionMode || inspectionState === 'none') {
        UI.statusHint.innerText = isInspectionMode ? "Start Inspection" : "Hold to Ready";
    } else {
        UI.timer.style.color = '#ef4444';
    }
}

function submitManualTime() {
    let v = parseFloat(UI.manualInput.value);
    if (v > 0) {
        addSolveToHistory(v * 1000, null);
        UI.manualInput.value = "";
        updateUI();
        generateScramble();
        saveData();
    }
}

function addSolveToHistory(timeMs, penalty) {
    solves.unshift({
        id: Date.now(),
        time: timeMs,
        scramble: currentScramble,
        event: currentEvent,
        sessionId: getCurrentSessionId(),
        penalty: penalty,
        date: new Date().toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\.$/, "")
    });
}

// ==========================================
// 6. Inspection Logic
// ==========================================

window.toggleInspection = (checkbox) => {
    isInspectionMode = checkbox.checked;
    if (isInspectionMode) {
        updateHoldDuration(0.01);
        UI.holdDurationSlider.value = 0.01;
        UI.holdDurationSlider.disabled = true;
        document.getElementById('holdDurationContainer').classList.add('opacity-50', 'pointer-events-none');
    } else {
        updateHoldDuration(0.3);
        UI.holdDurationSlider.value = 0.3;
        UI.holdDurationSlider.disabled = false;
        document.getElementById('holdDurationContainer').classList.remove('opacity-50', 'pointer-events-none');
    }
    saveData();
};

function startInspection() {
    inspectionState = 'inspecting';
    inspectionStartTime = Date.now();
    inspectionPenalty = null;
    hasSpoken8 = false;
    hasSpoken12 = false;

    UI.timer.classList.remove('text-ready');
    UI.timer.style.color = '#ef4444';
    UI.statusHint.innerText = "Inspection";

    if (inspectionInterval) {
        clearInterval(inspectionInterval);
    }
    inspectionInterval = setInterval(() => {
        const elapsed = (Date.now() - inspectionStartTime) / 1000;
        const remaining = 15 - elapsed;

        if (remaining > 0) {
            UI.timer.innerText = Math.ceil(remaining);
        } else if (remaining > -2) {
            UI.timer.innerText = "+2";
            inspectionPenalty = '+2';
        } else {
            UI.timer.innerText = "DNF";
            inspectionPenalty = 'DNF';
        }

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
    if (inspectionInterval) {
        clearInterval(inspectionInterval);
    }
    inspectionState = 'none';
    UI.timer.style.color = '';

    if (isInspectionMode && inspectionStartTime > 0) {
        const elapsed = (Date.now() - inspectionStartTime) / 1000;
        if (elapsed > 17) {
            inspectionPenalty = 'DNF';
        } else if (elapsed > 15) {
            inspectionPenalty = '+2';
        } else {
            inspectionPenalty = null;
        }
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

// ==========================================
// 7. Bluetooth (Gan Timer)
// ==========================================

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

        UI.statusHint.innerText = "Timer Ready (BT)";
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

    if (state !== 3 && !isRunning && data.byteLength >= 8) {
        const min = data.getUint8(4);
        const sec = data.getUint8(5);
        const msec = data.getUint16(6, true);
        UI.timer.innerText = formatTime((min * 60000) + (sec * 1000) + msec);
    }

    if (state !== lastBtState) {
        switch (state) {
            case 6: // HANDS_ON
                if (!isInspectionMode) {
                    isReady = false;
                    UI.timer.classList.add('text-ready');
                    UI.statusHint.innerText = "Ready!";
                }
                break;
            case 2: // HANDS_OFF
                if (!isInspectionMode) {
                    UI.timer.classList.remove('text-ready', 'text-running');
                    UI.statusHint.innerText = "Timer Ready (BT)";
                }
                break;
            case 3: // RUNNING
                if (!isRunning) {
                    if (isInspectionMode && inspectionState === 'inspecting') stopInspection();
                    startTime = Date.now();
                    isRunning = true;
                    // [OPTIMIZATION]
                    function btLoop() {
                        if (isRunning) {
                            UI.timer.innerText = formatTime(Date.now() - startTime);
                            timerFrameId = requestAnimationFrame(btLoop);
                        }
                    }
                    timerFrameId = requestAnimationFrame(btLoop);

                    UI.timer.classList.remove('text-ready');
                    UI.timer.classList.add('text-running');
                    UI.statusHint.innerText = "Timing...";
                }
                break;
            case 4: // STOPPED
                if (isRunning) {
                    if (timerFrameId) cancelAnimationFrame(timerFrameId);
                    isRunning = false;
                    if (data.byteLength >= 8) {
                        const min = data.getUint8(4);
                        const sec = data.getUint8(5);
                        const msec = data.getUint16(6, true);
                        const finalMs = (min * 60000) + (sec * 1000) + msec;
                        UI.timer.innerText = formatTime(finalMs);
                        stopTimer(finalMs);
                    }
                    UI.timer.classList.remove('text-running');
                    UI.statusHint.innerText = "Finished";
                }
                break;
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
    UI.statusHint.innerText = "Hold to Ready";
}

// ==========================================
// 8. Scramble Logic
// ==========================================

function generateScramble() {
    const conf = configs[currentEvent];
    if (!conf || currentEvent === '333mbf') return;

    let res = [];

    if (currentEvent === 'minx') {
        for (let i = 0; i < 7; i++) {
            let line = [];
            for (let j = 0; j < 10; j++) {
                const type = (j % 2 === 0) ? "R" : "D";
                const suffix = (Math.random() < 0.5) ? "++" : "--";
                line.push(type + suffix);
            }
            line.push(Math.random() < 0.5 ? "U" : "U'");
            res.push(line.join(" "));
        }
        currentScramble = res.join("\n");

    } else if (currentEvent === 'clock') {
        const dials = ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"];
        dials.forEach(d => {
            res.push(`${d}${Math.floor(Math.random() * 12) - 5 >= 0 ? '+' : ''}${Math.floor(Math.random() * 12) - 5}`);
        });
        res.push("y2");
        const dials2 = ["U", "R", "D", "L", "ALL"];
        dials2.forEach(d => {
            res.push(`${d}${Math.floor(Math.random() * 12) - 5 >= 0 ? '+' : ''}${Math.floor(Math.random() * 12) - 5}`);
        });
        let pins = [];
        ["UR", "DR", "DL", "UL"].forEach(p => {
            if (Math.random() < 0.5) pins.push(p);
        });
        if (pins.length) res.push(pins.join(" "));
        currentScramble = res.join(" ");

    } else if (currentEvent === 'sq1') {
        // Square-1 Scramble Logic (Corrected Right Slice)
        let topCuts = [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1];
        let botCuts = [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1];
        let movesCount = 0;
        let scrambleOps = [];

        const rotateArray = (arr, amt) => {
            const n = 12;
            let amount = amt % n;
            if (amount < 0) amount += n;
            const spliced = arr.splice(n - amount, amount);
            arr.unshift(...spliced);
        };

        while (movesCount < 14) {
            let u = Math.floor(Math.random() * 12) - 5;
            let d = Math.floor(Math.random() * 12) - 5;
            let nextTop = [...topCuts];
            let nextBot = [...botCuts];
            rotateArray(nextTop, u);
            rotateArray(nextBot, d);

            if (nextTop[0] === 1 && nextTop[6] === 1 && nextBot[0] === 1 && nextBot[6] === 1) {
                if (u === 0 && d === 0 && scrambleOps.length > 0) continue;
                scrambleOps.push(`(${u},${d})`);
                scrambleOps.push("/");
                let topRight = nextTop.slice(0, 6);
                let topLeft = nextTop.slice(6, 12);
                let botRight = nextBot.slice(0, 6);
                let botLeft = nextBot.slice(6, 12);
                topCuts = [...botRight, ...topLeft];
                botCuts = [...topRight, ...botLeft];
                movesCount++;
            }
        }
        currentScramble = scrambleOps.join(" ");

    } else if (['pyra', 'skewb'].includes(currentEvent)) {
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

    } else { // NxN and others
        let lastAxis = -1,
            secondLastAxis = -1,
            lastMoveBase = "";
        const getMoveAxis = (m) => {
            const c = m[0];
            if ("UD".includes(c)) return 0;
            if ("LR".includes(c)) return 1;
            if ("FB".includes(c)) return 2;
            return -1;
        };

        for (let i = 0; i < conf.len; i++) {
            let move, axis, base, valid = false;
            while (!valid) {
                move = conf.moves[Math.floor(Math.random() * conf.moves.length)];
                axis = getMoveAxis(move);
                base = move[0];
                if (base === lastMoveBase) {
                    valid = false;
                    continue;
                }
                if (axis !== -1 && axis === lastAxis && axis === secondLastAxis) {
                    valid = false;
                    continue;
                }
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
                res.push(wideMoves[Math.floor(Math.random() * wideMoves.length)] + suffixes[Math.floor(Math.random() * 3)]);
            }
        }
        currentScramble = res.join(" ");
    }

    UI.scramble.innerText = currentScramble;
    if (conf.n) {
        initCube(conf.n);
        currentScramble.split(/\s+/).filter(s => s && !orientations.includes(s) && s !== 'y2').forEach(applyMove);
        drawCube();
    } else {
        cubeState = {};
        drawCube();
    }
    resetPenalty();
    if (activeTool === 'graph') {
        renderHistoryGraph();
    }
}

window.generateMbfScrambles = () => {
    const count = parseInt(UI.mbfCubeInput.value);
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
                    <span class="text-xs font-bold text-slate-400">Scramble</span>
                </div>
                <p class="font-bold text-slate-600 dark:text-slate-300 leading-relaxed scramble-text">${scr}</p>
            </div>`;
    }
    document.getElementById('mbfScrambleOverlay').classList.add('active');
    currentScramble = `Multi-Blind (${count} Cubes Attempt)`;
};

function generate3bldScrambleText() {
    const conf = configs['333bf'];
    let res = [],
        last = "";
    for (let i = 0; i < conf.len; i++) {
        let m;
        do {
            m = conf.moves[Math.floor(Math.random() * conf.moves.length)];
        } while (m[0] === last[0]);
        res.push(m + suffixes[Math.floor(Math.random() * 3)]);
        last = m;
    }
    const wideMoveCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < wideMoveCount; i++) {
        res.push(wideMoves[Math.floor(Math.random() * wideMoves.length)] + suffixes[Math.floor(Math.random() * 3)]);
    }
    return res.join(" ");
}

window.closeMbfScrambleModal = () => document.getElementById('mbfScrambleOverlay').classList.remove('active');
window.copyMbfText = () => {
    const texts = Array.from(document.querySelectorAll('.scramble-text')).map((el, i) => `${i+1}. ${el.innerText}`).join('\n\n');
    const fullText = `[CubeTimer] Multi-Blind Scrambles\n\n${texts}`;
    copyToClipboard(fullText);
};

// ==========================================
// 9. UI Updates & Rendering
// ==========================================

function updateUI() {
    const sid = getCurrentSessionId();
    let filtered = solves.filter(s => s.event === currentEvent && s.sessionId === sid);
    const activeSession = (sessions[currentEvent] || []).find(s => s.isActive);
    if (activeSession) document.getElementById('currentSessionNameDisplay').innerText = activeSession.name;

    // Lazy Render
    const subset = filtered.slice(0, displayedSolvesCount);

    UI.historyList.innerHTML = subset.map(s => `
        <div class="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl flex justify-between items-center group cursor-pointer hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all" onclick="showSolveDetails(${s.id})">
            <span class="font-bold text-slate-700 dark:text-slate-200 text-sm">${s.penalty==='DNF'?'DNF':formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span>
            <button onclick="event.stopPropagation(); deleteSolve(${s.id})" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('') || '<div class="text-center py-10 text-slate-300 text-[11px] italic">No solves yet</div>';

    UI.solveCount.innerText = filtered.length;

    if (isAo5Mode) {
        UI.labelPrimaryAvg.innerText = "Ao5";
        UI.displayPrimaryAvg.innerText = calculateAvg(filtered, 5);
    } else {
        UI.labelPrimaryAvg.innerText = "Mo3";
        UI.displayPrimaryAvg.innerText = calculateAvg(filtered, 3, true);
    }
    UI.displayAo12.innerText = calculateAvg(filtered, 12);

    let valid = filtered.filter(s => s.penalty !== 'DNF').map(s => s.penalty === '+2' ? s.time + 2000 : s.time);
    UI.sessionAvg.innerText = valid.length ? formatTime(valid.reduce((a, b) => a + b, 0) / valid.length) : "-";
    UI.bestSolve.innerText = valid.length ? formatTime(Math.min(...valid)) : "-";

    if (activeTool === 'graph') renderHistoryGraph();
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const remainingMs = ms % 60000;
    let seconds;

    if (precision === 3) {
        seconds = (remainingMs / 1000).toFixed(3);
    } else {
        seconds = (Math.floor(remainingMs / 10) / 100).toFixed(2);
    }

    if (minutes > 0) {
        if (parseFloat(seconds) < 10) seconds = "0" + seconds;
        return `${minutes}:${seconds}`;
    }
    return seconds;
}

function calculateAvg(list, count, mean = false) {
    if (list.length < count) return "-";
    let slice = list.slice(0, count);
    let dnfC = slice.filter(s => s.penalty === 'DNF').length;

    let removeCount = Math.ceil(count * 0.05);
    if (count <= 12) removeCount = 1;

    if (dnfC >= removeCount + (mean ? 0 : 1)) return "DNF";

    let nums = slice.map(s => s.penalty === 'DNF' ? Infinity : (s.penalty === '+2' ? s.time + 2000 : s.time));
    if (mean) return (nums.reduce((a, b) => a + b, 0) / count / 1000).toFixed(precision);

    nums.sort((a, b) => a - b);
    for (let i = 0; i < removeCount; i++) {
        nums.pop();
        nums.shift();
    }

    return (nums.reduce((a, b) => a + b, 0) / nums.length / 1000).toFixed(precision);
}

// ==========================================
// 10. Modals & Popups
// ==========================================

window.openSettings = () => {
    const overlay = document.getElementById('settingsOverlay');
    overlay.classList.toggle('active');
    setTimeout(() => document.getElementById('settingsModal').classList.toggle('scale-95'), 10);
    setTimeout(() => document.getElementById('settingsModal').classList.toggle('opacity-0'), 10);
};
window.closeSettings = () => {
    document.getElementById('settingsModal').classList.add('scale-95', 'opacity-0');
    setTimeout(() => document.getElementById('settingsOverlay').classList.remove('active'), 200);
    saveData();
};
window.handleOutsideSettingsClick = (e) => {
    if (e.target === document.getElementById('settingsOverlay')) closeSettings();
};

function checkUpdateLog() {
    if (localStorage.getItem('appVersion') !== APP_VERSION) {
        renderUpdateLog();
        document.getElementById('updateLogOverlay').classList.add('active');
    }
}

function renderUpdateLog() {
    const list = document.getElementById('updateList');
    list.innerHTML = UPDATE_HISTORY.map(item => `
        <li class="list-none mt-4 first:mt-0">
            <p class="text-xs font-bold ${item.type === 'issue' ? 'text-slate-500' : 'text-blue-600'} mb-1">${item.date} - ${item.ver}</p>
            <ul class="list-disc pl-4 space-y-1">${item.content.map(c => `<li class="${item.type === 'issue' ? 'text-slate-400' : ''}">${c}</li>`).join('')}</ul>
        </li>`).join('');
    document.getElementById('updateVersion').innerText = `v${APP_VERSION}`;
}
window.openUpdateLog = () => {
    renderUpdateLog();
    document.getElementById('updateLogOverlay').classList.add('active');
};
window.closeUpdateLog = () => {
    document.getElementById('updateLogOverlay').classList.remove('active');
    localStorage.setItem('appVersion', APP_VERSION);
};

window.openSessionModal = () => {
    document.getElementById('sessionOverlay').classList.add('active');
    renderSessionList();
};
window.closeSessionModal = () => {
    document.getElementById('sessionOverlay').classList.remove('active');
    document.getElementById('newSessionName').value = "";
    editingSessionId = null;
};

window.showSolveDetails = (id) => {
    let s = solves.find(x => x.id === id);
    if (!s) return;
    selectedSolveId = id;
    document.getElementById('modalTime').innerText = s.penalty === 'DNF' ? 'DNF' : formatTime(s.penalty === '+2' ? s.time + 2000 : s.time);
    document.getElementById('modalEvent').innerText = s.event;
    document.getElementById('modalScramble').innerText = s.scramble;
    document.getElementById('modalOverlay').classList.add('active');
};
window.closeModal = () => document.getElementById('modalOverlay').classList.remove('active');
window.useThisScramble = () => {
    let s = solves.find(x => x.id === selectedSolveId);
    if (s) {
        currentScramble = s.scramble;
        UI.scramble.innerText = currentScramble;
        closeModal();
    }
};

// ==========================================
// 11. Utilities & Data Persistence
// ==========================================

function copyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert("Copied!");
    } catch (err) {
        console.error('Copy failed');
    }
    document.body.removeChild(textArea);
}

// [OPTIMIZED] Save Data - Split Storage
function saveData() {
    // 1. Save Meta (Settings & Sessions structure)
    const meta = {
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
    localStorage.setItem('cubeTimer_meta_v1', JSON.stringify(meta));

    // 2. Save Solves Splitted by Session
    // Find all valid session IDs
    const validSessionIds = new Set();
    Object.values(sessions).flat().forEach(s => validSessionIds.add(s.id));

    // Group solves
    const solvesBySession = {};
    solves.forEach(s => {
        if (!solvesBySession[s.sessionId]) solvesBySession[s.sessionId] = [];
        solvesBySession[s.sessionId].push(s);
    });

    // Write to storage
    validSessionIds.forEach(sid => {
        const sessionSolves = solvesBySession[sid] || [];
        localStorage.setItem(`cubeTimer_solves_${sid}`, JSON.stringify(sessionSolves));
    });

    // Also save legacy format as backup (optional, but good for safety during migration)
    // localStorage.setItem('cubeTimerData_v5', JSON.stringify({ ...meta, solves: solves }));
}

// [OPTIMIZED] Load Data - Split Storage with Migration
function loadData() {
    // 1. Try Load New Meta
    const metaStr = localStorage.getItem('cubeTimer_meta_v1');

    if (metaStr) {
        // Load New Format
        const meta = JSON.parse(metaStr);
        sessions = meta.sessions || {};
        if (meta.settings) applySettings(meta.settings);

        // Load Solves from chunks
        solves = [];
        Object.values(sessions).flat().forEach(s => {
            const sData = localStorage.getItem(`cubeTimer_solves_${s.id}`);
            if (sData) {
                solves = solves.concat(JSON.parse(sData));
            }
        });
        // Sort newest first
        solves.sort((a, b) => b.id - a.id);

    } else {
        // Fallback: Load Old Data & Migrate
        const saved = localStorage.getItem('cubeTimerData_v5') || localStorage.getItem('cubeTimerData_v4');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                solves = data.solves || [];
                sessions = data.sessions || {};
                if (data.settings) applySettings(data.settings);

                // Immediately save in new format
                saveData();
            } catch (e) {
                console.error("Load failed", e);
            }
        }
    }

    initSessionIfNeeded(currentEvent);
    if (!isBtConnected) UI.statusHint.innerText = isInspectionMode ? "Start Inspection" : "Hold to Ready";
}

function applySettings(settings) {
    precision = settings.precision || 2;
    isAo5Mode = settings.isAo5Mode !== undefined ? settings.isAo5Mode : true;
    currentEvent = settings.currentEvent || '333';
    holdDuration = settings.holdDuration || 300;
    isWakeLockEnabled = settings.isWakeLockEnabled || false;
    isInspectionMode = settings.isInspectionMode || false;
    const isDark = settings.isDarkMode || false;

    UI.precisionToggle.checked = (precision === 3);
    UI.avgModeToggle.checked = isAo5Mode;
    UI.darkModeToggle.checked = isDark;
    UI.wakeLockToggle.checked = isWakeLockEnabled;
    UI.inspectionToggle.checked = isInspectionMode;

    if (isInspectionMode) toggleInspection(UI.inspectionToggle);
    else {
        UI.holdDurationSlider.value = holdDuration / 1000;
        UI.holdDurationValue.innerText = UI.holdDurationSlider.value + "s";
    }

    document.documentElement.classList.toggle('dark', isDark);
    if (isWakeLockEnabled) requestWakeLock();

    const conf = configs[currentEvent];
    if (conf) switchCategory(conf.cat, false);
}

function deleteSolve(id) {
    solves = solves.filter(s => s.id !== id);
    updateUI();
    saveData();
}

function togglePenalty(p) {
    if (!solves.length || isRunning) return;
    const sid = getCurrentSessionId();
    const currentList = solves.filter(s => s.event === currentEvent && s.sessionId === sid);
    if (!currentList.length) return;
    const targetSolve = currentList[0];
    targetSolve.penalty = (targetSolve.penalty === p) ? null : p;

    if (targetSolve === solves[0]) {
        if (targetSolve.penalty === 'DNF') UI.timer.innerText = 'DNF';
        else UI.timer.innerText = formatTime(targetSolve.time + (targetSolve.penalty === '+2' ? 2000 : 0)) + (targetSolve.penalty === '+2' ? '+' : '');
    }
    updateUI();
    updatePenaltyBtns(targetSolve);
    saveData();
}

function updatePenaltyBtns(s) {
    if (UI.plus2Btn && UI.dnfBtn) {
        UI.plus2Btn.className = `penalty-btn ${s?.penalty==='+2'?'active-plus2':'inactive'}`;
        UI.dnfBtn.className = `penalty-btn ${s?.penalty==='DNF'?'active-dnf':'inactive'}`;
    }
}

function resetPenalty() {
    updatePenaltyBtns(null);
}

function initSessionIfNeeded(eventId) {
    if (!sessions[eventId] || sessions[eventId].length === 0) sessions[eventId] = [{
        id: Date.now(),
        name: "Session 1",
        isActive: true
    }];
    else if (!sessions[eventId].find(s => s.isActive)) sessions[eventId][0].isActive = true;
}

function getCurrentSessionId() {
    const eventSessions = sessions[currentEvent] || [];
    const active = eventSessions.find(s => s.isActive);
    if (active) return active.id;
    initSessionIfNeeded(currentEvent);
    return sessions[currentEvent][0].id;
}
window.createNewSession = () => {
    const name = document.getElementById('newSessionName').value.trim() || `Session ${sessions[currentEvent].length + 1}`;
    if (sessions[currentEvent].length >= 10) return;
    sessions[currentEvent].forEach(s => s.isActive = false);
    sessions[currentEvent].push({
        id: Date.now(),
        name: name,
        isActive: true
    });
    renderSessionList();
    updateUI();
    saveData();
    resetPenalty();
};
window.switchSession = (id) => {
    sessions[currentEvent].forEach(s => s.isActive = (s.id === id));
    renderSessionList();
    updateUI();
    saveData();
    resetPenalty();
    closeSessionModal();
};
window.deleteSession = (id) => {
    const eventSessions = sessions[currentEvent];
    if (!eventSessions || eventSessions.length <= 1) return;
    const targetIdx = eventSessions.findIndex(s => s.id === id);
    if (targetIdx === -1) return;
    const wasActive = eventSessions[targetIdx].isActive;
    sessions[currentEvent] = eventSessions.filter(s => s.id !== id);
    solves = solves.filter(s => !(s.event === currentEvent && s.sessionId === id));
    if (wasActive && sessions[currentEvent].length > 0) sessions[currentEvent][0].isActive = true;
    renderSessionList();
    updateUI();
    saveData();
};

function renderSessionList() {
    const listContainer = document.getElementById('sessionList');
    const eventSessions = sessions[currentEvent] || [];
    document.getElementById('sessionCountLabel').innerText = `${eventSessions.length}/10`;
    listContainer.innerHTML = eventSessions.map(s => `
        <div class="flex items-center gap-2 group">
            <div class="flex-1 flex items-center gap-2 p-1 rounded-xl border ${s.isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                <button onclick="switchSession(${s.id})" class="flex-1 text-left p-2.5 text-xs font-bold truncate">${s.name}</button>
                <button onclick="deleteSession(${s.id})" class="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">Del</button>
            </div>
        </div>
    `).join('');
}

function initCube(n = 3) {
    cubeState = {
        n
    };
    ['U', 'D', 'L', 'R', 'F', 'B'].forEach(f => cubeState[f] = Array(n * n).fill(COLORS[f]));
}

function rotateFaceMatrix(fName) {
    const n = cubeState.n;
    const f = cubeState[fName];
    const next = Array(n * n);
    for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) next[c * n + (n - 1 - r)] = f[r * n + c];
    cubeState[fName] = next;
}

function applyMove(move) {
    const n = cubeState.n;
    if (!n) return;
    let base = move[0],
        layer = 1;
    if (move.includes('w')) {
        if (/^\d/.test(move)) {
            layer = parseInt(move[0]);
            base = move[1];
        } else {
            layer = 2;
            base = move[0];
        }
    }
    const reps = move.includes("'") ? 3 : (move.includes("2") ? 2 : 1);
    for (let r = 0; r < reps; r++) {
        for (let l = 1; l <= layer; l++) {
            if (l === 1) rotateFaceMatrix(base); /* Face Rotation */
            const d = l - 1,
                last = n - 1 - d;
            if (base === 'U')
                for (let i = 0; i < n; i++) {
                    let t = cubeState.F[d * n + i];
                    cubeState.F[d * n + i] = cubeState.R[d * n + i];
                    cubeState.R[d * n + i] = cubeState.B[d * n + i];
                    cubeState.B[d * n + i] = cubeState.L[d * n + i];
                    cubeState.L[d * n + i] = t;
                }
            else if (base === 'D')
                for (let i = 0; i < n; i++) {
                    let t = cubeState.F[last * n + i];
                    cubeState.F[last * n + i] = cubeState.L[last * n + i];
                    cubeState.L[last * n + i] = cubeState.B[last * n + i];
                    cubeState.B[last * n + i] = cubeState.R[last * n + i];
                    cubeState.R[last * n + i] = t;
                }
            else if (base === 'L')
                for (let i = 0; i < n; i++) {
                    let t = cubeState.F[i * n + d];
                    cubeState.F[i * n + d] = cubeState.U[i * n + d];
                    cubeState.U[i * n + d] = cubeState.B[(n - 1 - i) * n + (n - 1 - d)];
                    cubeState.B[(n - 1 - i) * n + (n - 1 - d)] = cubeState.D[i * n + d];
                    cubeState.D[i * n + d] = t;
                }
            else if (base === 'R')
                for (let i = 0; i < n; i++) {
                    let t = cubeState.F[i * n + last];
                    cubeState.F[i * n + last] = cubeState.D[i * n + last];
                    cubeState.D[i * n + last] = cubeState.B[(n - 1 - i) * n + d];
                    cubeState.B[(n - 1 - i) * n + d] = cubeState.U[i * n + last];
                    cubeState.U[i * n + last] = t;
                }
            else if (base === 'F')
                for (let i = 0; i < n; i++) {
                    let t = cubeState.U[last * n + i];
                    cubeState.U[last * n + i] = cubeState.L[(n - 1 - i) * n + last];
                    cubeState.L[(n - 1 - i) * n + last] = cubeState.D[d * n + (n - 1 - i)];
                    cubeState.D[d * n + (n - 1 - i)] = cubeState.R[i * n + d];
                    cubeState.R[i * n + d] = t;
                }
            else if (base === 'B')
                for (let i = 0; i < n; i++) {
                    let t = cubeState.U[d * n + i];
                    cubeState.U[d * n + i] = cubeState.R[i * n + last];
                    cubeState.R[i * n + last] = cubeState.D[last * n + (n - 1 - i)];
                    cubeState.D[last * n + (n - 1 - i)] = cubeState.L[(n - 1 - i) * n + d];
                    cubeState.L[(n - 1 - i) * n + d] = t;
                }
        }
    }
}

function drawCube() {
    const n = cubeState.n;
    if (!n || configs[currentEvent]?.cat === 'blind') {
        UI.visualizerCanvas.style.display = 'none';
        UI.noVisualizerMsg.classList.remove('hidden');
        return;
    }
    UI.visualizerCanvas.style.display = 'block';
    UI.noVisualizerMsg.classList.add('hidden');
    const ctx = UI.visualizerCanvas.getContext('2d');
    const faceS = 55,
        tileS = faceS / n,
        gap = 4;
    ctx.clearRect(0, 0, 260, 190);
    const offX = (260 - (4 * faceS + 3 * gap)) / 2,
        offY = (190 - (3 * faceS + 2 * gap)) / 2;
    const drawF = (f, x, y) => cubeState[f].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(x + (i % n) * tileS, y + Math.floor(i / n) * tileS, tileS, tileS);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = n > 5 ? 0.2 : 0.5;
        ctx.strokeRect(x + (i % n) * tileS, y + Math.floor(i / n) * tileS, tileS, tileS);
    });
    drawF('U', offX + faceS + gap, offY);
    drawF('L', offX, offY + faceS + gap);
    drawF('F', offX + faceS + gap, offY + faceS + gap);
    drawF('R', offX + 2 * (faceS + gap), offY + faceS + gap);
    drawF('B', offX + 3 * (faceS + gap), offY + faceS + gap);
    drawF('D', offX + faceS + gap, offY + 2 * (faceS + gap));
}

window.switchMobileTab = (tab) => {
    if (tab === 'timer') {
        UI.timerSection.classList.remove('hidden');
        UI.historySection.classList.add('hidden');
        UI.mobTabTimer.className = "flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400";
        UI.mobTabHistory.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors";
    } else if (tab === 'history') {
        UI.timerSection.classList.add('hidden');
        UI.historySection.classList.remove('hidden');
        UI.historySection.classList.add('flex');
        UI.mobTabHistory.className = "flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400";
        UI.mobTabTimer.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors";
        if (activeTool === 'graph') renderHistoryGraph();
    }
};

function handleResize() {
    if (window.innerWidth >= 768) {
        UI.timerSection.classList.remove('hidden');
        UI.historySection.classList.remove('hidden');
        UI.historySection.classList.add('flex');
    } else {
        if (UI.mobTabTimer.classList.contains('text-blue-600')) switchMobileTab('timer');
        else switchMobileTab('history');
    }
}

window.switchCategory = (cat, autoSelectFirst = true) => {
    if (isRunning) return;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active', 'text-white'));
    document.getElementById(`cat-${cat}`)?.classList.add('active', 'text-white');
    ['standard', 'nonstandard', 'blind'].forEach(g => {
        const el = document.getElementById(`group-${g}`);
        if (g === cat) {
            el.classList.remove('hidden');
            el.classList.add('flex');
        } else {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }
    });
    if (autoSelectFirst) {
        const targetGroup = document.getElementById(`group-${cat}`);
        const firstButton = targetGroup.querySelector('button');
        if (firstButton) changeEvent(firstButton.id.replace('tab-', ''));
    }
};
window.changeEvent = (e) => {
    if (isRunning) return;
    currentEvent = e;
    const conf = configs[e];
    initSessionIfNeeded(e);
    displayedSolvesCount = SOLVES_BATCH_SIZE;
    if (UI.historyList) UI.historyList.scrollTop = 0;

    document.querySelectorAll('.event-tab').forEach(t => {
        t.classList.remove('active', 'text-white', 'bg-blue-600');
        t.classList.add('text-slate-500', 'dark:text-slate-400');
    });
    document.getElementById(`tab-${e}`)?.classList.add('active', 'text-white', 'bg-blue-600');

    if (conf.cat === 'blind') {
        activeTool = 'graph';
        selectTool('graph');
    } else {
        if (activeTool === 'graph') selectTool('graph');
        else selectTool('scramble');
    }

    if (['666', '777', '333bf', '444bf', '555bf', '333mbf'].includes(e)) {
        isAo5Mode = false;
        UI.avgModeToggle.checked = false;
    } else {
        isAo5Mode = true;
        UI.avgModeToggle.checked = true;
    }

    if (currentEvent === '333mbf') {
        UI.scramble.classList.add('hidden');
        UI.mbfInputArea.classList.remove('hidden');
    } else {
        UI.scramble.classList.remove('hidden');
        UI.mbfInputArea.classList.add('hidden');
        generateScramble();
    }

    updateUI();
    UI.timer.innerText = (0).toFixed(precision);
    saveData();
};

window.toggleToolsMenu = (e) => {
    e.stopPropagation();
    document.getElementById('toolsDropdown').classList.toggle('show');
};
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

// [REVERTED] Graph Rendering: Simple Polyline Only
function renderHistoryGraph() {
    if (activeTool !== 'graph') return;
    const sid = getCurrentSessionId();
    const filtered = [...solves].filter(s => s.event === currentEvent && s.sessionId === sid).reverse();
    const svg = document.getElementById('historyGraph');
    
    // Clear previous content to ensure clean slate (and remove labels/guidelines if any)
    svg.innerHTML = '<polyline id="graphLine" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points=""/>';
    const polyline = document.getElementById('graphLine');

    if (filtered.length < 2) { 
        return; 
    }

    const validTimes = filtered.map(s => s.penalty === 'DNF' ? null : (s.penalty === '+2' ? s.time + 2000 : s.time));
    // Filter out nulls for min/max calculation
    const timesOnly = validTimes.filter(t => t !== null);
    
    // If no valid times (all DNF), show flat line or nothing
    if (timesOnly.length === 0) return;

    const maxTime = Math.max(...timesOnly);
    const minTime = Math.min(...timesOnly);
    const range = maxTime - minTime || 1;

    // Draw Main Polyline
    const points = filtered.map((s, i) => {
        // Handle DNF: Map to maxTime (top of graph) or skip? Usually mapped to top visually.
        let t = s.penalty === 'DNF' ? maxTime : (s.penalty === '+2' ? s.time + 2000 : s.time);
        
        const x = (i / (filtered.length - 1)) * 100;
        // Invert Y axis: 0 is top (100% time), 100 is bottom (0% time) or similar mapping
        // Previous logic: 90 - ((t - minTime) / range) * 80; (Maps min to 90, max to 10)
        const y = 90 - ((t - minTime) / range) * 80;
        return `${x},${y}`;
    }).join(' ');

    polyline.setAttribute("points", points);
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
            });
        }
    } catch (err) {
        console.log(`Wake Lock error: ${err.message}`);
    }
}
async function toggleWakeLock(checkbox) {
    isWakeLockEnabled = checkbox.checked;
    if (isWakeLockEnabled) await requestWakeLock();
    else if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
    }
    saveData();
}

function updateHoldDuration(val) {
    holdDuration = parseFloat(val) * 1000;
    UI.holdDurationValue.innerText = val < 0.1 ? "Instant" : val + "s";
    saveData();
}

function confirmClearHistory() {
    if (confirm(`Clear all history for this session?`)) {
        const sid = getCurrentSessionId();
        solves = solves.filter(s => !(s.event === currentEvent && s.sessionId === sid));
        updateUI();
        saveData();
        resetPenalty();
        UI.timer.innerText = (0).toFixed(precision);
    }
}
