/**
 * Cube Timer Application
 * Fixed: Completely Refactored with Module Separation to Fix "undefined" Errors
 */

// 1. App State
const State = {
    solves: [],
    sessions: {},
    currentEvent: '333',
    isRunning: false,
    isReady: false,
    startTime: 0,
    currentScramble: "Generating...",
    precision: 2,
    isManualMode: false,
    isAo5Mode: true,
    editingSessionId: null,
    activeTool: 'scramble',
    holdDuration: 300,
    wakeLock: null,
    isWakeLockEnabled: false,
    selectedSolveId: null,
    
    isInspectionMode: false,
    inspectionState: 'none',
    inspectionStartTime: 0,
    inspectionPenalty: null,
    hasSpoken8: false,
    hasSpoken12: false,
    lastStopTimestamp: 0,

    displayedSolvesCount: 50,
    solvesBatchSize: 50,
    lastBtState: null,
    isBtConnected: false
};

// 2. Configuration
const Config = {
    appVersion: '1.4',
    updateLogs: [
        "구조 전면 개편: 참조 오류 해결",
        "스크램블 이미지 엔진 안정화",
        "설정 팝업 로직 단순화"
    ],
    events: {
        '333': { moves: ["U","D","L","R","F","B"], len: 21, cat: 'standard', puzzle: '3x3x3' },
        '333oh': { moves: ["U","D","L","R","F","B"], len: 21, cat: 'standard', puzzle: '3x3x3' },
        '222': { moves: ["U","R","F"], len: 11, cat: 'standard', puzzle: '2x2x2' },
        '444': { moves: ["U","D","L","R","F","B","Uw","Rw","Fw"], len: 44, cat: 'standard', puzzle: '4x4x4' },
        '555': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw"], len: 60, cat: 'standard', puzzle: '5x5x5' },
        '666': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw","3Uw","3Rw","3Fw"], len: 80, cat: 'standard', puzzle: '6x6x6' },
        '777': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw","3Uw","3Dw","3Lw","3Rw","3Fw","3Bw"], len: 100, cat: 'standard', puzzle: '7x7x7' },
        'minx': { moves: ["R++","R--","D++","D--"], len: 77, cat: 'nonstandard', puzzle: 'megaminx' },
        'pyra': { moves: ["U","L","R","B"], len: 10, tips: ["u","l","r","b"], cat: 'nonstandard', puzzle: 'pyraminx' },
        'clock': { len: 18, cat: 'nonstandard', puzzle: 'clock' },
        'skewb': { moves: ["U","L","R","B"], len: 10, cat: 'nonstandard', puzzle: 'skewb' },
        'sq1': { len: 12, cat: 'nonstandard', puzzle: 'square1' },
        '333bf': { moves: ["U","D","L","R","F","B"], len: 21, cat: 'blind', puzzle: '3x3x3' },
        '444bf': { moves: ["U","D","L","R","F","B","Uw","Rw","Fw"], len: 44, cat: 'blind', puzzle: '4x4x4' },
        '555bf': { moves: ["U","D","L","R","F","B","Uw","Dw","Lw","Rw","Fw","Bw"], len: 60, cat: 'blind', puzzle: '5x5x5' },
        '333mbf': { moves: ["U","D","L","R","F","B"], len: 21, cat: 'blind', puzzle: '3x3x3' }
    },
    suffixes: ["", "'", "2"],
    orientations: ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"],
    wideMoves: ["Uw", "Dw", "Lw", "Rw", "Fw", "Bw"]
};

// 3. Utils Module
const Utils = {
    formatTime(ms) {
        const minutes = Math.floor(ms / 60000), remainingMs = ms % 60000;
        let seconds = (State.precision === 3) ? (remainingMs / 1000).toFixed(3) : (Math.floor(remainingMs / 10) / 100).toFixed(2);
        if (minutes > 0) { if (parseFloat(seconds) < 10) seconds = "0" + seconds; return `${minutes}:${seconds}`; }
        return seconds;
    },
    calculateAvg(list, count, mean=false) {
        if(list.length < count) return "-";
        let slice = list.slice(0, count), dnfC = slice.filter(s=>s.penalty==='DNF').length;
        let removeCount = Math.ceil(count * 0.05); if (count <= 12) removeCount = 1;
        if(dnfC >= removeCount + (mean?0:1)) return "DNF";
        let nums = slice.map(s => s.penalty==='DNF'?Infinity:(s.penalty==='+2'?s.time+2000:s.time));
        if(mean) return (nums.reduce((a,b)=>a+b,0)/count/1000).toFixed(State.precision);
        nums.sort((a,b)=>a-b);
        for(let i=0; i<removeCount; i++) { nums.pop(); nums.shift(); }
        return (nums.reduce((a,b)=>a+b,0)/nums.length/1000).toFixed(State.precision);
    },
    speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US'; utterance.rate = 1.2;
            window.speechSynthesis.speak(utterance);
        }
    },
    openModal(id) { 
        const el = document.getElementById(id); 
        if(el) { 
            el.classList.add('active'); 
            el.classList.add('force-show');
            if(id === 'sessionOverlay') UI.renderSessionList(); 
        }
    },
    closeModal(id) { 
        const el = document.getElementById(id);
        if(el) {
            el.classList.remove('active'); 
            el.classList.remove('force-show');
        }
    },
    checkUpdateLog() {
        const saved = localStorage.getItem('appVersion');
        if (saved !== Config.appVersion) {
            const vEl = document.getElementById('updateVersion');
            const lEl = document.getElementById('updateList');
            if(vEl) vEl.innerText = `v${Config.appVersion}`;
            if(lEl) lEl.innerHTML = Config.updateLogs.map(l => `<li>${l}</li>`).join('');
            Utils.openModal('updateLogOverlay');
            localStorage.setItem('appVersion', Config.appVersion);
        }
    },
    toggleDarkMode(el) {
        document.documentElement.classList.toggle('dark', el && el.checked);
        if(State.activeTool === 'graph') UI.renderGraph();
        Storage.save();
    },
    async toggleWakeLock(el) {
        State.isWakeLockEnabled = el && el.checked;
        if (el && el.checked) {
            try { if ('wakeLock' in navigator) State.wakeLock = await navigator.wakeLock.request('screen'); } catch(e){}
        } else if (State.wakeLock) { await State.wakeLock.release(); State.wakeLock = null; }
        Storage.save();
    },
    toggleInspection(el) {
        State.isInspectionMode = el && el.checked;
        const slider = document.getElementById('holdDurationSlider');
        const container = document.getElementById('holdDurationContainer');
        if (el && el.checked) { 
            Utils.updateHoldDuration(0.01); 
            if(slider) { slider.value = 0.01; slider.disabled = true; }
            if(container) container.classList.add('opacity-50', 'pointer-events-none'); 
        } else { 
            Utils.updateHoldDuration(0.3); 
            if(slider) { slider.value = 0.3; slider.disabled = false; }
            if(container) container.classList.remove('opacity-50', 'pointer-events-none'); 
        }
        Storage.save();
    },
    updateHoldDuration(val) {
        State.holdDuration = parseFloat(val) * 1000;
        const valEl = document.getElementById('holdDurationValue');
        if(valEl) valEl.innerText = val < 0.1 ? "Instant" : val + "s";
        Storage.save();
    },
    togglePenalty(p) {
        if(!State.solves.length || State.isRunning) return;
        const sid = Storage.getCurrentSessionId();
        const list = State.solves.filter(s => s.event === State.currentEvent && s.sessionId === sid);
        if (!list.length) return;
        const target = list[0];
        target.penalty = (target.penalty===p)?null:p;
        
        const timerEl = document.getElementById('timer');
        if(timerEl) {
            if (target.penalty === 'DNF') timerEl.innerText = 'DNF';
            else {
                const t = target.time + (target.penalty === '+2' ? 2000 : 0);
                timerEl.innerText = Utils.formatTime(t) + (target.penalty === '+2' ? '+' : '');
            }
        }
        const p2 = document.getElementById('plus2Btn');
        const dnf = document.getElementById('dnfBtn');
        if (p2) p2.className = `penalty-btn ${target.penalty==='+2'?'active-plus2':'inactive'}`;
        if (dnf) dnf.className = `penalty-btn ${target.penalty==='DNF'?'active-dnf':'inactive'}`;
        UI.updateHistory(); Storage.save();
    },
    copyToClipboard(text, btnElement) {
        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); if(btnElement) { const original = btnElement.innerText; btnElement.innerText = "Copied!"; setTimeout(() => btnElement.innerText = original, 2000); } } catch(e){}
        document.body.removeChild(ta);
    }
};

// 4. Storage Module
const Storage = {
    save() {
        const data = {
            solves: State.solves,
            sessions: State.sessions,
            settings: { 
                precision: State.precision, 
                isAo5Mode: State.isAo5Mode, 
                currentEvent: State.currentEvent, 
                holdDuration: State.holdDuration,
                isDarkMode: document.documentElement.classList.contains('dark'),
                isWakeLockEnabled: State.isWakeLockEnabled,
                isInspectionMode: State.isInspectionMode
            }
        };
        localStorage.setItem('cubeTimerData_v5', JSON.stringify(data));
    },
    load() {
        const saved = localStorage.getItem('cubeTimerData_v5') || localStorage.getItem('cubeTimerData_v4');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                State.solves = data.solves || [];
                State.sessions = data.sessions || {};
                if (data.settings) {
                    State.precision = data.settings.precision || 2;
                    State.isAo5Mode = data.settings.isAo5Mode !== undefined ? data.settings.isAo5Mode : true;
                    State.currentEvent = data.settings.currentEvent || '333';
                    State.holdDuration = data.settings.holdDuration || 300;
                    State.isWakeLockEnabled = data.settings.isWakeLockEnabled || false;
                    State.isInspectionMode = data.settings.isInspectionMode || false;
                    
                    UI.syncSettings(data.settings);
                }
            } catch (e) { console.error("Load failed", e); }
        }
        this.initSessionIfNeeded(State.currentEvent);
    },
    initSessionIfNeeded(eventId) {
        if (!State.sessions[eventId] || State.sessions[eventId].length === 0) {
            State.sessions[eventId] = [{ id: Date.now(), name: "Session 1", isActive: true }];
        } else if (!State.sessions[eventId].find(s => s.isActive)) {
            State.sessions[eventId][0].isActive = true;
        }
    },
    getCurrentSessionId() {
        const active = (State.sessions[State.currentEvent] || []).find(s => s.isActive);
        if (active) return active.id;
        this.initSessionIfNeeded(State.currentEvent);
        return State.sessions[State.currentEvent][0].id;
    },
    exportData() {
        const data = { solves: State.solves, sessions: State.sessions, settings: { ...State } }; 
        delete data.settings.isRunning; delete data.settings.currentScramble;
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `cubetimer_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    },
    importData(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.solves && data.sessions) {
                    State.solves = data.solves;
                    State.sessions = data.sessions;
                    if(data.settings) UI.syncSettings(data.settings); 
                    this.save();
                    location.reload();
                } else throw new Error("Invalid format");
            } catch(err) { alert("Failed to restore data. Invalid JSON."); }
        };
        reader.readAsText(file);
    }
};

// 5. Visualizer Module
const Visualizer = {
    update(puzzleId, scramble) {
        const container = document.getElementById('cubeVisualizer');
        if(!container) return;
        
        const msg = document.getElementById('noVisualizerMsg');
        if(msg) msg.classList.add('hidden');
        container.style.display = 'flex';

        if(Config.events[State.currentEvent]?.cat === 'blind') {
           if(msg) { msg.classList.remove('hidden'); msg.innerText = "Scramble images disabled for Blind"; }
           container.style.display = 'none';
           const p = container.querySelector('twisty-player');
           if(p) p.style.display = 'none';
           return;
        }

        // [FIX] Wait for custom element if not defined
        if (!customElements.get('twisty-player')) {
            setTimeout(() => this.update(puzzleId, scramble), 500);
            return;
        }

        let player = container.querySelector('twisty-player');
        if (!player) {
            player = document.createElement('twisty-player');
            player.setAttribute('visualization', '2D');
            player.setAttribute('background', 'none');
            player.setAttribute('control-panel', 'none');
            player.style.pointerEvents = "none"; 
            container.appendChild(player);
        }
        
        player.style.display = 'block';
        player.setAttribute('puzzle', puzzleId);
        player.setAttribute('alg', scramble);
    },
    draw() {
        const event = State.currentEvent;
        const conf = Config.events[event];
        const scramble = State.currentScramble;
        if (conf && scramble) {
            this.update(conf.puzzle, scramble);
        }
    }
};

// 6. Scrambler Module
const Scrambler = {
    generate() {
        try {
            const event = State.currentEvent;
            const conf = Config.events[event];
            if (!conf || event === '333mbf') return;

            let res = [];
            
            if (event === 'minx') this.generateMinx(res);
            else if (event === 'clock') this.generateClock(res);
            else if (event === 'sq1') this.generateSq1(res);
            else if (['pyra', 'skewb'].includes(event)) this.generatePyraSkewb(res, conf);
            else this.generateNxN(res, conf, event);

            if (res.length === 0) res.push("R U R' U'");

            const scrambleStr = res.join(event === 'minx' ? "\n" : " ");
            State.currentScramble = scrambleStr;

            const scrEl = document.getElementById('scramble');
            if(scrEl) scrEl.innerText = scrambleStr;
            
            UI.resetPenaltyButtons();
            if (State.activeTool === 'graph') {
                UI.renderGraph();
            } 
            
            try {
                Visualizer.update(conf.puzzle, scrambleStr);
            } catch(err) {
                console.warn("Visualizer update pending:", err);
            }
        } catch (e) {
            console.error("Scramble Generation Failed:", e);
            const scrEl = document.getElementById('scramble');
            if(scrEl) scrEl.innerText = "Error generating scramble";
        }
    },
    // ... Generators ...
    generateMinx(res) {
        for (let i = 0; i < 7; i++) {
            let line = [];
            for (let j = 0; j < 10; j++) {
                line.push((j%2===0?"R":"D") + (Math.random()<0.5?"++":"--"));
            }
            line.push(Math.random()<0.5?"U":"U'"); res.push(line.join(" "));
        }
    },
    generateClock(res) {
        ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"].forEach(d => {
            const v = Math.floor(Math.random() * 12) - 5;
            res.push(`${d}${v >= 0 ? '+' : ''}${v}`);
        });
        res.push("y2");
        ["U", "R", "D", "L", "ALL"].forEach(d => {
            const v = Math.floor(Math.random() * 12) - 5;
            res.push(`${d}${v >= 0 ? '+' : ''}${v}`);
        });
        let pins = [];
        ["UR", "DR", "DL", "UL"].forEach(p => { if (Math.random() < 0.5) pins.push(p); });
        if (pins.length) res.push(pins.join(" "));
    },
    generateSq1(res) {
        let top = [true, false, true, true, false, true, true, false, true, true, false, true];
        let bot = [true, false, true, true, false, true, true, false, true, true, false, true];
        let moves = 0, scrambleOps = [];
        const rotate = (arr, amt) => {
            let n=12, amount = amt%n; if(amount<0) amount+=n;
            arr.unshift(...arr.splice(n-amount, amount));
        };
        while (moves < 12) {
            let u = Math.floor(Math.random()*12)-5, d = Math.floor(Math.random()*12)-5;
            if(u===0 && d===0) continue;
            let nt = [...top], nb = [...bot];
            rotate(nt, u); rotate(nb, d);
            if (nt[0] && nt[6] && nb[0] && nb[6]) {
                scrambleOps.push(`(${u},${d})`);
                let tr = nt.slice(6,12), br = nb.slice(6,12);
                top = [...nt.slice(0,6), ...br]; bot = [...nb.slice(0,6), ...tr];
                scrambleOps.push("/"); moves++;
            }
        }
        res.push(scrambleOps.join(" "));
    },
    generatePyraSkewb(res, conf) {
        let last = "";
        for (let i = 0; i < conf.len; i++) {
            let m; do { m = conf.moves[Math.floor(Math.random() * conf.moves.length)]; } while (m === last);
            res.push(m + (Math.random() < 0.5 ? "'" : "")); last = m;
        }
        if (State.currentEvent === 'pyra') {
            conf.tips.forEach(t => {
                const r = Math.floor(Math.random() * 3);
                if (r === 1) res.push(t); else if (r === 2) res.push(t + "'");
            });
        }
    },
    generateNxN(res, conf, event) {
        let lastAxis = -1, secondLastAxis = -1, lastMoveBase = "";
        const getAxis = (m) => { const c = m[0]; return "UD".includes(c)?0:"LR".includes(c)?1:2; };
        const suffixes = Config.suffixes;
        for (let i = 0; i < conf.len; i++) {
            let move, axis, base, valid = false;
            while (!valid) {
                move = conf.moves[Math.floor(Math.random() * conf.moves.length)];
                axis = getAxis(move); base = move[0];
                if (base === lastMoveBase) { valid = false; continue; }
                if (axis !== -1 && axis === lastAxis && axis === secondLastAxis) { valid = false; continue; }
                valid = true;
            }
            res.push(move + suffixes[Math.floor(Math.random() * 3)]);
            secondLastAxis = lastAxis; lastAxis = axis; lastMoveBase = base;
        }
        if (event === '333bf') {
            const wideMoves = Config.wideMoves;
            for (let i = 0; i < Math.floor(Math.random() * 2) + 1; i++) {
                res.push(wideMoves[Math.floor(Math.random() * wideMoves.length)] + suffixes[Math.floor(Math.random() * 3)]);
            }
        } else if (conf.cat === 'blind') {
            const orients = Config.orientations;
            res.push(orients[Math.floor(Math.random() * orients.length)]);
            if (Math.random() > 0.5) res.push(orients[Math.floor(Math.random() * orients.length)]);
        }
    },
    generate3bldText() {
        const conf = Config.events['333bf'];
        let res = [], last = "", suffixes = Config.suffixes;
        for (let i = 0; i < conf.len; i++) {
            let m; do { m = conf.moves[Math.floor(Math.random() * conf.moves.length)]; } while (m[0] === last[0]);
            res.push(m + suffixes[Math.floor(Math.random() * 3)]); last = m;
        }
        const wideMoves = Config.wideMoves;
        for (let i = 0; i < Math.floor(Math.random() * 2) + 1; i++) {
            res.push(wideMoves[Math.floor(Math.random() * wideMoves.length)] + suffixes[Math.floor(Math.random() * 3)]);
        }
        return res.join(" ");
    }
};

// 7. Timer Module
const Timer = {
    interval: null,
    holdTimer: null,
    inspectionInterval: null,

    start() {
        if(this.inspectionInterval) clearInterval(this.inspectionInterval); 
        State.inspectionState = 'none';
        const tEl = document.getElementById('timer');
        if(tEl) tEl.style.color = '';

        State.startTime = Date.now(); 
        State.isRunning = true;
        this.interval = setInterval(() => {
            UI.updateTimerDisplay(Date.now() - State.startTime);
        }, 10);
        UI.setTimerStatus('running');
    },

    stop(forcedTime = null) {
        clearInterval(this.interval);
        let elapsed = forcedTime !== null ? forcedTime : (Date.now() - State.startTime);
        State.lastStopTimestamp = Date.now(); 
        
        const tEl = document.getElementById('timer');
        if(tEl) tEl.style.color = '';
        
        let finalPenalty = State.inspectionPenalty; 

        if (elapsed > 10 || finalPenalty === 'DNF') {
            const newSolve = {
                id: Date.now(), 
                time: elapsed, 
                scramble: State.currentScramble, 
                event: State.currentEvent, 
                sessionId: Storage.getCurrentSessionId(), 
                penalty: finalPenalty,
                date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, "")
            };
            State.solves.unshift(newSolve);
            UI.displayFinalTime(elapsed, finalPenalty);
        }
        
        State.isRunning = false;
        State.isReady = false;
        State.inspectionState = 'none'; 
        State.inspectionPenalty = null; 
        
        UI.updateHistory(); 
        Scrambler.generate();
        UI.setTimerStatus('idle');
        Storage.save();
    },

    startInspection() {
        State.inspectionState = 'inspecting';
        State.inspectionStartTime = Date.now();
        State.inspectionPenalty = null;
        State.hasSpoken8 = false;
        State.hasSpoken12 = false;
        
        UI.setTimerStatus('inspection');

        if(this.inspectionInterval) clearInterval(this.inspectionInterval);
        this.inspectionInterval = setInterval(() => {
            const elapsed = (Date.now() - State.inspectionStartTime) / 1000;
            const remaining = 15 - elapsed;
            
            UI.updateInspectionDisplay(remaining);

            if (elapsed >= 8 && !State.hasSpoken8) {
                Utils.speak("Eight seconds");
                State.hasSpoken8 = true;
            }
            if (elapsed >= 12 && !State.hasSpoken12) {
                Utils.speak("Twelve seconds");
                State.hasSpoken12 = true;
            }
        }, 100);
    },

    stopInspection() {
        if(this.inspectionInterval) clearInterval(this.inspectionInterval);
        State.inspectionState = 'none';
        const tEl = document.getElementById('timer');
        if(tEl) tEl.style.color = '';
        
        if (State.isInspectionMode && State.inspectionStartTime > 0) {
            const elapsed = (Date.now() - State.inspectionStartTime) / 1000;
            if (elapsed > 17) State.inspectionPenalty = 'DNF';
            else if (elapsed > 15) State.inspectionPenalty = '+2';
            else State.inspectionPenalty = null;
        }
    }
};

// 8. UI Module
const UI = {
    init() {
        this.setupEventListeners();
        this.handleResize();
    },

    setupEventListeners() {
        const safeAdd = (id, evt, handler) => {
            const el = document.getElementById(id);
            if(el) el.addEventListener(evt, handler);
        };

        window.addEventListener('keydown', this.handleKeydown.bind(this));
        window.addEventListener('keyup', this.handleKeyup.bind(this));
        
        const iArea = document.getElementById('timerInteractiveArea');
        if(iArea) {
            iArea.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
            iArea.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
        }
        window.addEventListener('resize', this.handleResize.bind(this));

        // Modals
        Utils.openModal = (id) => { 
            const el = document.getElementById(id); 
            if(el) { 
                el.classList.add('active'); 
                el.classList.add('force-show');
                if(id === 'sessionOverlay') this.renderSessionList(); 
            }
        };
        Utils.closeModal = (id) => { 
            const el = document.getElementById(id);
            if(el) {
                el.classList.remove('active'); 
                el.classList.remove('force-show');
            }
        };

        const bindModal = (id, closeBtnId) => {
            safeAdd(closeBtnId, 'click', () => Utils.closeModal(id));
            const el = document.getElementById(id);
            if(el) el.addEventListener('click', (e) => { if(e.target === el) Utils.closeModal(id); });
        };

        bindModal('btOverlay', 'btCloseBtn');
        bindModal('sessionOverlay', 'closeSessionBtn');
        bindModal('mbfScrambleOverlay', 'closeMbfBtn');
        bindModal('statsOverlay', 'closeStatsBtn');
        bindModal('settingsOverlay', 'closeSettingsBtn');
        bindModal('avgShareOverlay', 'closeShareBtn');
        bindModal('modalOverlay', 'closeDetailBtn');
        bindModal('updateLogOverlay', 'closeUpdateLogBtn');

        safeAdd('btToggleBtn', 'click', () => Utils.openModal('btOverlay'));
        safeAdd('backupBtn', 'click', Storage.exportData); // Correct ref
        safeAdd('restoreBtn', 'click', () => { const el = document.getElementById('importInput'); if(el) el.click(); });
        const imp = document.getElementById('importInput');
        if(imp) imp.addEventListener('change', (e) => Storage.importData(e.target.files[0]));
        
        safeAdd('settingsBtn', 'click', () => Utils.openModal('settingsOverlay'));
        safeAdd('mobSettingsBtn', 'click', () => Utils.openModal('settingsOverlay'));

        // Actions
        safeAdd('addSessionBtn', 'click', () => this.createNewSession());
        safeAdd('genMbfBtn', 'click', () => this.generateMbfScrambles());
        safeAdd('copyMbfBtn', 'click', () => Utils.copyMbfText());
        safeAdd('copyShareBtn', 'click', () => Utils.copyShareText());
        safeAdd('shareSingleBtn', 'click', () => Utils.openSingleShare());
        safeAdd('useScrambleBtn', 'click', () => Utils.useThisScramble());
        safeAdd('moreStatsBtn', 'click', () => Utils.showExtendedStats());
        safeAdd('clearHistoryBtn', 'click', () => Utils.clearHistory());
        safeAdd('sessionSelectBtn', 'click', () => { Utils.openModal('sessionOverlay'); this.renderSessionList(); });

        // Settings Inputs
        safeAdd('darkModeToggle', 'change', (e) => Utils.toggleDarkMode(e.target));
        safeAdd('wakeLockToggle', 'change', (e) => Utils.toggleWakeLock(e.target));
        safeAdd('inspectionToggle', 'change', (e) => Utils.toggleInspection(e.target));
        safeAdd('holdDurationSlider', 'input', (e) => Utils.updateHoldDuration(e.target.value));
        safeAdd('avgModeToggle', 'change', (e) => { State.isAo5Mode = e.target.checked; this.updateHistory(); Storage.save(); });
        safeAdd('precisionToggle', 'change', (e) => { 
            State.precision = e.target.checked?3:2; 
            this.updateHistory(); 
            const t = document.getElementById('timer');
            if(t) t.innerText = (0).toFixed(State.precision); 
            Storage.save(); 
        });
        safeAdd('manualEntryToggle', 'change', (e) => { 
            State.isManualMode = e.target.checked; 
            const t = document.getElementById('timer');
            const m = document.getElementById('manualInput');
            const s = document.getElementById('statusHint');
            if(t) t.classList.toggle('hidden', State.isManualMode);
            if(m) m.classList.toggle('hidden', !State.isManualMode);
            if(s) s.innerText = State.isManualMode ? "TYPE TIME & ENTER" : "HOLD TO READY";
        });
        safeAdd('mobBackupBtn', 'click', Storage.exportData);
        safeAdd('mobRestoreBtn', 'click', () => { const el = document.getElementById('importInput'); if(el) el.click(); });

        // Delegated Events
        const catTabs = document.getElementById('categoryTabs');
        if(catTabs) catTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn');
            if(btn) this.switchCategory(btn.dataset.cat);
        });
        document.querySelectorAll('.event-group').forEach(grp => {
            grp.addEventListener('click', (e) => {
                const tab = e.target.closest('.event-tab');
                if(tab) this.changeEvent(tab.dataset.event);
            });
        });
        const sList = document.getElementById('sessionList');
        if(sList) sList.addEventListener('click', this.handleSessionListClick.bind(this));
        
        const hList = document.getElementById('historyList');
        if(hList) {
            hList.addEventListener('click', this.handleHistoryListClick.bind(this));
            hList.addEventListener('scroll', this.handleHistoryScroll.bind(this));
        }
        
        safeAdd('plus2Btn', 'click', () => Utils.togglePenalty('+2'));
        safeAdd('dnfBtn', 'click', () => Utils.togglePenalty('DNF'));
        
        safeAdd('toolsMenuBtn', 'click', (e) => { 
            e.stopPropagation(); 
            const dd = document.getElementById('toolsDropdown');
            if(dd) dd.classList.toggle('show'); 
        });
        const tDD = document.getElementById('toolsDropdown');
        if(tDD) {
            tDD.addEventListener('click', (e) => {
                const opt = e.target.closest('.tool-option');
                if(opt) this.selectTool(opt.dataset.tool);
            });
        }
        window.addEventListener('click', () => { if(tDD) tDD.classList.remove('show'); });

        safeAdd('mob-tab-timer', 'click', () => this.switchMobileTab('timer'));
        safeAdd('mob-tab-history', 'click', () => this.switchMobileTab('history'));
        safeAdd('primaryAvgBadge', 'click', () => Utils.openAvgShare('primary'));
        safeAdd('ao12Badge', 'click', () => Utils.openAvgShare('ao12'));
    },

    handleStart(e) {
        if (e && e.target && (e.target.closest('.avg-badge') || e.target.closest('button') || e.target.closest('.tools-dropdown'))) return;
        if (State.isBtConnected && !State.isInspectionMode) return;
        if (e && e.cancelable) e.preventDefault();
        if (State.isManualMode || State.isRunning) { if(State.isRunning) Timer.stop(); return; }
        if (State.isInspectionMode && State.inspectionState === 'none') return;
        
        const tEl = document.getElementById('timer');
        const sEl = document.getElementById('statusHint');
        
        if (State.isInspectionMode && State.inspectionState === 'inspecting') {
            if (State.isBtConnected) return;
            if(tEl) { tEl.style.color = '#ef4444'; tEl.classList.add('holding-status'); }
            Timer.holdTimer = setTimeout(()=> { 
                State.isReady=true; 
                if(tEl) { tEl.style.color = '#10b981'; tEl.classList.replace('holding-status','ready-to-start'); }
                if(sEl) sEl.innerText="Ready!"; 
            }, State.holdDuration); 
            return;
        }
        if(tEl) { tEl.style.color = '#ef4444'; tEl.classList.add('holding-status'); }
        Timer.holdTimer = setTimeout(()=> { 
            State.isReady=true; 
            if(tEl) { tEl.style.color = '#10b981'; tEl.classList.replace('holding-status','ready-to-start'); }
            if(sEl) sEl.innerText="Ready!"; 
        }, State.holdDuration);
    },

    handleEnd(e) {
        if (Date.now() - State.lastStopTimestamp < 500) return;
        if (State.isBtConnected) {
            if (State.isInspectionMode && State.inspectionState === 'none') Timer.startInspection();
            return;
        }
        if (e && e.cancelable) e.preventDefault();
        clearTimeout(Timer.holdTimer);
        if (State.isManualMode) return;

        if (State.isInspectionMode && !State.isRunning && State.inspectionState === 'none') {
            Timer.startInspection(); return;
        }

        if (!State.isRunning && State.isReady) {
            Timer.start();
        } else {
            const tEl = document.getElementById('timer');
            const sEl = document.getElementById('statusHint');
            if(tEl) { tEl.style.color = ''; tEl.classList.remove('holding-status','ready-to-start'); }
            State.isReady = false;
            if(sEl) {
                if (!State.isInspectionMode || State.inspectionState === 'none') sEl.innerText = State.isInspectionMode ? "Start Inspection" : "Hold to Ready";
            }
            else if(tEl) tEl.style.color = '#ef4444';
        }
    },

    handleKeydown(e) {
        const mEl = document.getElementById('manualInput');
        if (State.editingSessionId || (document.activeElement && document.activeElement.tagName === 'INPUT')) {
            if (e.code === 'Enter' && document.activeElement === mEl) { /* allowed */ } else { return; }
        }
        if (e.code === 'Space' && !e.repeat) { e.preventDefault(); this.handleStart(); }
        if (State.isManualMode && e.code === 'Enter' && mEl) {
            let v = parseFloat(mEl.value);
            if (v > 0) Timer.stop(v * 1000);
            mEl.value = "";
        }
    },

    handleKeyup(e) { if(e.code==='Space' && !State.editingSessionId) this.handleEnd(); },

    handleSessionListClick(e) {
        const id = parseInt(e.target.closest('[data-session-id]')?.dataset.sessionId);
        if (!id) return;
        if (e.target.closest('.delete-session')) this.deleteSession(id);
        else if (e.target.closest('.edit-session')) { State.editingSessionId = id; this.renderSessionList(); }
        else if (e.target.closest('.save-session')) { this.saveSessionName(id); }
        else { // Switch
            const eventSessions = State.sessions[State.currentEvent];
            eventSessions.forEach(s => s.isActive = (s.id === id));
            this.renderSessionList(); this.updateHistory(); Storage.save();
            const tEl = document.getElementById('timer');
            if(tEl) tEl.innerText = (0).toFixed(State.precision);
            this.resetPenaltyButtons();
            Utils.closeModal('sessionOverlay');
        }
    },

    handleHistoryListClick(e) {
        const id = parseInt(e.target.closest('[data-solve-id]')?.dataset.solveId);
        if (!id) return;
        if (e.target.closest('.delete-solve')) {
            State.solves = State.solves.filter(s => s.id !== id);
            this.updateHistory(); Storage.save();
        } else {
            Utils.showSolveDetails(id);
        }
    },

    handleHistoryScroll() {
        const list = document.getElementById('historyList');
        if (list.scrollTop + list.clientHeight >= list.scrollHeight - 50) {
            const sid = Storage.getCurrentSessionId();
            const total = State.solves.filter(s => s.event === State.currentEvent && s.sessionId === sid).length;
            if (State.displayedSolvesCount < total) {
                State.displayedSolvesCount += State.solvesBatchSize;
                this.updateHistory();
            }
        }
    },

    updateTimerDisplay(ms) { 
        const el = document.getElementById('timer');
        if(el) el.innerText = Utils.formatTime(ms); 
    },
    updateInspectionDisplay(sec) {
        const el = document.getElementById('timer');
        if(!el) return;
        if (sec > 0) el.innerText = Math.ceil(sec);
        else if (sec > -2) el.innerText = "+2";
        else el.innerText = "DNF";
    },
    displayFinalTime(ms, penalty) {
        const el = document.getElementById('timer');
        if(!el) return;
        if (penalty === 'DNF') el.innerText = "DNF";
        else {
            let display = Utils.formatTime(ms + (penalty === '+2' ? 2000 : 0));
            if (penalty === '+2') display += "+";
            el.innerText = display;
        }
    },
    setTimerStatus(status) {
        const sEl = document.getElementById('statusHint');
        const tEl = document.getElementById('timer');
        const hints = {
            'running': "Timing...",
            'idle': State.isInspectionMode ? "Start Inspection" : "Hold to Ready",
            'inspection': "Inspection",
            'ready': "Ready!"
        };
        if(sEl) sEl.innerText = hints[status] || hints['idle'];
        if(tEl) {
            if(status === 'running') { tEl.classList.add('text-running'); tEl.classList.remove('text-ready'); }
            else tEl.classList.remove('text-running', 'text-ready');
        }
    },
    resetPenaltyButtons() {
        const p2 = document.getElementById('plus2Btn');
        const dnf = document.getElementById('dnfBtn');
        if (p2) p2.className = 'penalty-btn inactive';
        if (dnf) dnf.className = 'penalty-btn inactive';
    },
    updateBTUI(connected) {
        const icon = document.getElementById('btStatusIcon');
        if(icon) icon.classList.replace(connected ? 'disconnected' : 'connected', connected ? 'connected' : 'disconnected');
        const pnl = document.getElementById('btInfoPanel');
        if(pnl) pnl.classList.toggle('hidden', !connected);
        const dis = document.getElementById('btDisconnectBtn');
        if(dis) dis.classList.toggle('hidden', !connected);
        const con = document.getElementById('btConnectBtn');
        if(con) con.classList.toggle('hidden', connected);
        
        if(connected) {
            const nm = document.getElementById('btDeviceName');
            const st = document.getElementById('btStatusText');
            const ic = document.getElementById('btModalIcon');
            const ht = document.getElementById('statusHint');
            
            if(nm && Bluetooth.device) nm.innerText = Bluetooth.device.name;
            if(st) st.innerText = "Timer Connected & Ready";
            if(ic) ic.classList.remove('bt-pulse');
            if(ht) ht.innerText = "Timer Ready (BT)";
        } else {
            const st = document.getElementById('btStatusText');
            const ht = document.getElementById('statusHint');
            if(st) st.innerText = "Timer Disconnected";
            if(ht) ht.innerText = "Hold to Ready";
        }
    },
    syncSettings(settings) {
        const get = (id) => document.getElementById(id);
        const pT = get('precisionToggle'); if(pT) pT.checked = (settings.precision === 3);
        const aT = get('avgModeToggle'); if(aT) aT.checked = settings.isAo5Mode;
        const dT = get('darkModeToggle'); if(dT) dT.checked = settings.isDarkMode;
        const wT = get('wakeLockToggle'); if(wT) wT.checked = settings.isWakeLockEnabled;
        const iT = get('inspectionToggle'); if(iT) iT.checked = settings.isInspectionMode;
        
        if (settings.isInspectionMode) Utils.toggleInspection(iT);
        else {
            const sl = get('holdDurationSlider');
            const sv = get('holdDurationValue');
            if(sl) {
                sl.value = settings.holdDuration / 1000;
                if(sv) sv.innerText = sl.value + "s";
            }
        }
        Utils.toggleDarkMode(dT);
    },
    switchCategory(cat) {
        if(State.isRunning) return;
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active', 'text-white'));
        const btn = document.getElementById(`cat-${cat}`);
        if(btn) { btn.classList.add('active', 'text-white'); btn.classList.remove('text-slate-500', 'dark:text-slate-400'); }
        
        document.querySelectorAll('.event-group').forEach(g => g.classList.add('hidden'));
        const grp = document.getElementById(`group-${cat}`);
        if(grp) {
            grp.classList.remove('hidden');
            grp.classList.add('flex');
            // Auto select first
            const first = grp.querySelector('button');
            if(first) this.changeEvent(first.dataset.event);
        }
    },
    changeEvent(event) {
        if(State.isRunning) return;
        State.currentEvent = event;
        Storage.initSessionIfNeeded(event);
        State.displayedSolvesCount = State.solvesBatchSize;
        const hist = document.getElementById('historyList');
        if(hist) hist.scrollTop = 0;

        document.querySelectorAll('.event-tab').forEach(t => {
            t.classList.remove('active', 'text-white', 'bg-blue-600');
            t.classList.add('text-slate-500', 'dark:text-slate-400');
        });
        const tab = document.getElementById(`tab-${event}`);
        if(tab) { tab.classList.add('active', 'text-white', 'bg-blue-600'); tab.classList.remove('text-slate-500', 'dark:text-slate-400'); }

        const conf = Config.events[event];
        if(conf && conf.cat === 'blind') this.selectTool('graph');
        else this.selectTool(State.activeTool === 'graph' ? 'graph' : 'scramble');

        const isBig = ['666','777','333bf','444bf','555bf','333mbf'].includes(event);
        State.isAo5Mode = !isBig; 
        const avgToggle = document.getElementById('avgModeToggle');
        if(avgToggle) avgToggle.checked = !isBig;

        const scrEl = document.getElementById('scramble');
        const mbfEl = document.getElementById('mbfInputArea');

        if(event === '333mbf') {
            if(scrEl) scrEl.classList.add('hidden');
            if(mbfEl) mbfEl.classList.remove('hidden');
        } else {
            if(scrEl) {
                scrEl.classList.remove('hidden');
                Scrambler.generate();
            }
            if(mbfEl) mbfEl.classList.add('hidden');
        }
        this.updateHistory(); 
        const tEl = document.getElementById('timer');
        if(tEl) tEl.innerText = (0).toFixed(State.precision); 
        Storage.save();
    },
    updateHistory() {
        const sid = Storage.getCurrentSessionId();
        let filtered = State.solves.filter(s => s.event === State.currentEvent && s.sessionId === sid);
        
        const activeSession = (State.sessions[State.currentEvent] || []).find(s => s.isActive);
        const sessNameEl = document.getElementById('currentSessionNameDisplay');
        if (activeSession && sessNameEl) sessNameEl.innerText = activeSession.name;

        const subset = filtered.slice(0, State.displayedSolvesCount);
        const listEl = document.getElementById('historyList');
        if(listEl) {
            listEl.innerHTML = subset.map(s => `
                <div class="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl flex justify-between items-center group cursor-pointer hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all" data-solve-id="${s.id}">
                    <span class="font-bold text-slate-700 dark:text-slate-200 text-sm">${s.penalty==='DNF'?'DNF':Utils.formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span>
                    <button class="delete-solve opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            `).join('') || '<div class="text-center py-10 text-slate-300 text-[11px] italic">No solves yet</div>';
        }

        const countEl = document.getElementById('solveCount');
        if(countEl) countEl.innerText = filtered.length;
        
        const lp = document.getElementById('labelPrimaryAvg');
        const dp = document.getElementById('displayPrimaryAvg');
        const da = document.getElementById('displayAo12');
        
        if(lp) lp.innerText = State.isAo5Mode ? "Ao5" : "Mo3";
        if(dp) dp.innerText = Utils.calculateAvg(filtered, State.isAo5Mode ? 5 : 3, !State.isAo5Mode);
        if(da) da.innerText = Utils.calculateAvg(filtered, 12);
        
        let valid = filtered.filter(s=>s.penalty!=='DNF').map(s=>s.penalty==='+2'?s.time+2000:s.time);
        const sa = document.getElementById('sessionAvg');
        const bs = document.getElementById('bestSolve');
        
        if(sa) sa.innerText = valid.length ? Utils.formatTime(valid.reduce((a,b)=>a+b,0)/valid.length) : "-";
        if(bs) bs.innerText = valid.length ? Utils.formatTime(Math.min(...valid)) : "-";

        if (State.activeTool === 'graph') this.renderGraph();
    },
    renderSessionList() {
        const list = document.getElementById('sessionList');
        if(!list) return;
        const sessions = State.sessions[State.currentEvent] || [];
        const countEl = document.getElementById('sessionCountLabel');
        if(countEl) countEl.innerText = `${sessions.length}/10`;
        
        list.innerHTML = sessions.map(s => {
            if (State.editingSessionId === s.id) {
                return `<div class="flex items-center gap-2"><input type="text" id="editSessionInput" value="${s.name}" class="flex-1 bg-white dark:bg-slate-800 border border-blue-400 rounded-xl px-3 py-2.5 text-xs font-bold outline-none dark:text-white" autofocus><button class="save-session p-2 text-blue-600" data-session-id="${s.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button></div>`;
            }
            return `<div class="flex items-center gap-2 group" data-session-id="${s.id}"><div class="flex-1 flex items-center gap-2 p-1 rounded-xl border ${s.isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"><button class="flex-1 text-left p-2.5 text-xs font-bold truncate">${s.name}</button><button class="edit-session p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></div>${sessions.length > 1 ? `<button class="delete-session p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ''}</div>`;
        }).join('');
        
        if (State.editingSessionId) {
            const input = document.getElementById('editSessionInput');
            if(input) {
                input.focus();
                input.addEventListener('blur', () => this.saveSessionName(State.editingSessionId));
                input.addEventListener('keydown', (e) => { if(e.key === 'Enter') this.saveSessionName(State.editingSessionId); });
            }
        }
        const form = document.getElementById('sessionCreateForm');
        if(form) form.classList.toggle('hidden', sessions.length >= 10);
    },
    createNewSession() {
        const input = document.getElementById('newSessionName');
        if(!input) return;
        const name = input.value.trim() || `Session ${State.sessions[State.currentEvent].length + 1}`;
        if (State.sessions[State.currentEvent].length >= 10) return;
        State.sessions[State.currentEvent].forEach(s => s.isActive = false);
        State.sessions[State.currentEvent].push({ id: Date.now(), name: name, isActive: true });
        input.value = "";
        this.renderSessionList(); this.updateHistory(); Storage.save();
        const tEl = document.getElementById('timer');
        if(tEl) tEl.innerText = (0).toFixed(State.precision); 
        this.resetPenaltyButtons();
    },
    deleteSession(id) {
        const eventSessions = State.sessions[State.currentEvent];
        if (!eventSessions || eventSessions.length <= 1) return;
        const targetIdx = eventSessions.findIndex(s => s.id === id);
        if (targetIdx === -1) return;
        const wasActive = eventSessions[targetIdx].isActive;
        State.sessions[State.currentEvent] = eventSessions.filter(s => s.id !== id);
        State.solves = State.solves.filter(s => !(s.event === State.currentEvent && s.sessionId === id));
        if (wasActive && State.sessions[State.currentEvent].length > 0) State.sessions[State.currentEvent][0].isActive = true;
        this.renderSessionList(); this.updateHistory(); Storage.save();
    },
    saveSessionName(id) {
        const input = document.getElementById('editSessionInput');
        if (!input) return;
        const newName = input.value.trim();
        if (newName) { const s = State.sessions[State.currentEvent].find(x => x.id === id); if (s) s.name = newName; }
        State.editingSessionId = null;
        this.renderSessionList(); this.updateHistory(); Storage.save();
    },
    selectTool(tool) {
        State.activeTool = tool;
        const isBlind = Config.events[State.currentEvent]?.cat === 'blind';
        const label = document.getElementById('toolLabel');
        if(label) label.innerText = isBlind ? 'N/A (Blind)' : (tool === 'scramble' ? 'Scramble Image' : 'Graph (Trends)');
        
        const vWrap = document.getElementById('visualizerWrapper');
        const gWrap = document.getElementById('graphWrapper');
        if(vWrap) vWrap.classList.toggle('hidden', tool !== 'scramble');
        if(gWrap) gWrap.classList.toggle('hidden', tool !== 'graph');
        
        document.querySelectorAll('.tool-option').forEach(opt => opt.classList.remove('active'));
        const activeOpt = document.getElementById(`tool-opt-${tool}`);
        if(activeOpt) activeOpt.classList.add('active');
        
        const dd = document.getElementById('toolsDropdown');
        if(dd) dd.classList.remove('show');
        
        if (tool === 'graph') this.renderGraph(); else if (tool === 'scramble') Visualizer.draw();
    },
    renderGraph() {
        const sid = Storage.getCurrentSessionId();
        const filtered = [...State.solves].filter(s => s.event === State.currentEvent && s.sessionId === sid).reverse();
        const polyline = document.getElementById('graphLine');
        if(!polyline) return;
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
    },
    switchMobileTab(tab) {
        const tSec = document.getElementById('timerSection');
        const hSec = document.getElementById('historySection');
        const tBtn = document.getElementById('mob-tab-timer');
        const hBtn = document.getElementById('mob-tab-history');

        if (tab === 'timer') {
            if(tSec) tSec.classList.remove('hidden'); 
            if(hSec) hSec.classList.add('hidden');
            if(tBtn) tBtn.className = "flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400";
            if(hBtn) hBtn.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors";
        } else {
            if(tSec) tSec.classList.add('hidden'); 
            if(hSec) { hSec.classList.remove('hidden'); hSec.classList.add('flex'); }
            if(hBtn) hBtn.className = "flex flex-col items-center justify-center w-full h-full text-blue-600 dark:text-blue-400";
            if(tBtn) tBtn.className = "flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors";
            if(State.activeTool === 'graph') this.renderGraph();
        }
    },
    handleResize() {
        const tSec = document.getElementById('timerSection');
        const hSec = document.getElementById('historySection');
        
        if (window.innerWidth >= 768) {
            if(tSec) tSec.classList.remove('hidden');
            if(hSec) { hSec.classList.remove('hidden'); hSec.classList.add('flex'); }
        } else {
            const tBtn = document.getElementById('mob-tab-timer');
            if (tBtn && tBtn.classList.contains('text-blue-600')) this.switchMobileTab('timer');
            else this.switchMobileTab('history');
        }
    },
    generateMbfScrambles() {
        const input = document.getElementById('mbfCubeInput');
        if(!input) return;
        const count = parseInt(input.value);
        if (!count || count < 2 || count > 100) return;
        const list = document.getElementById('mbfScrambleList');
        if(document.getElementById('mbfCubeCountDisplay')) document.getElementById('mbfCubeCountDisplay').innerText = `${count} Cubes`;
        if(list) {
            list.innerHTML = "";
            for (let i = 1; i <= count; i++) {
                list.innerHTML += `
                    <div class="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-[10px] font-bold">#${i}</span>
                            <span class="text-[10px] font-black uppercase text-slate-400">Scramble</span>
                        </div>
                        <p class="font-bold text-slate-600 dark:text-slate-300 leading-relaxed scramble-text">${Scrambler.generate3bldText()}</p>
                    </div>`;
            }
        }
        Utils.openModal('mbfScrambleOverlay');
        State.currentScramble = `Multi-Blind (${count} Cubes Attempt)`;
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    Storage.load();
    // [FIX] Force update on init with a tiny delay to ensure DOM is ready
    setTimeout(() => {
        UI.changeEvent(State.currentEvent || '333');
        Utils.checkUpdateLog();
    }, 50);
});
