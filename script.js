/**
 * Cube Timer Application
 * Refactored for maintainability and modularity with Defensive Code.
 */

const CubeTimerApp = {
    state: {
        solves: [],
        sessions: {},
        currentEvent: '333',
        isRunning: false,
        isReady: false,
        startTime: 0,
        currentScramble: "",
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
    },

    config: {
        appVersion: '1.1',
        updateLogs: [
            "모바일 UI 개편",
            "Gan Halo Timer 사용 시 소숫점이 반올림되던 현상 수정",
            "인스펙션 기능 추가",
        ],
        events: {
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
        },
        suffixes: ["", "'", "2"],
        orientations: ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"],
        wideMoves: ["Uw", "Dw", "Lw", "Rw", "Fw", "Bw"],
        cubeColors: { U: '#FFFFFF', D: '#FFD500', L: '#FF8C00', R: '#DC2626', F: '#16A34A', B: '#2563EB' }
    },

    dom: {},

    timer: {
        interval: null,
        holdTimer: null,
        inspectionInterval: null,

        start() {
            if(this.inspectionInterval) clearInterval(this.inspectionInterval); 
            CubeTimerApp.state.inspectionState = 'none';
            CubeTimerApp.state.startTime = Date.now(); 
            CubeTimerApp.state.isRunning = true;
            this.interval = setInterval(() => {
                CubeTimerApp.ui.updateTimerDisplay(Date.now() - CubeTimerApp.state.startTime);
            }, 10);
            CubeTimerApp.ui.setTimerStatus('running');
        },

        stop(forcedTime = null) {
            clearInterval(this.interval);
            let elapsed = forcedTime !== null ? forcedTime : (Date.now() - CubeTimerApp.state.startTime);
            CubeTimerApp.state.lastStopTimestamp = Date.now(); 
            
            let finalPenalty = CubeTimerApp.state.inspectionPenalty; 

            if (elapsed > 10 || finalPenalty === 'DNF') {
                const newSolve = {
                    id: Date.now(), 
                    time: elapsed, 
                    scramble: CubeTimerApp.state.currentScramble, 
                    event: CubeTimerApp.state.currentEvent, 
                    sessionId: CubeTimerApp.storage.getCurrentSessionId(), 
                    penalty: finalPenalty,
                    date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, "")
                };
                CubeTimerApp.state.solves.unshift(newSolve);
                CubeTimerApp.ui.displayFinalTime(elapsed, finalPenalty);
            }
            
            CubeTimerApp.state.isRunning = false;
            CubeTimerApp.state.isReady = false;
            CubeTimerApp.state.inspectionState = 'none'; 
            CubeTimerApp.state.inspectionPenalty = null; 
            
            CubeTimerApp.ui.updateHistory(); 
            CubeTimerApp.scrambler.generate();
            CubeTimerApp.ui.setTimerStatus('idle');
            CubeTimerApp.storage.save();
        },

        startInspection() {
            const S = CubeTimerApp.state;
            S.inspectionState = 'inspecting';
            S.inspectionStartTime = Date.now();
            S.inspectionPenalty = null;
            S.hasSpoken8 = false;
            S.hasSpoken12 = false;
            
            CubeTimerApp.ui.setTimerStatus('inspection');

            if(this.inspectionInterval) clearInterval(this.inspectionInterval);
            this.inspectionInterval = setInterval(() => {
                const elapsed = (Date.now() - S.inspectionStartTime) / 1000;
                const remaining = 15 - elapsed;
                
                CubeTimerApp.ui.updateInspectionDisplay(remaining);

                if (elapsed >= 8 && !S.hasSpoken8) {
                    CubeTimerApp.utils.speak("Eight seconds");
                    S.hasSpoken8 = true;
                }
                if (elapsed >= 12 && !S.hasSpoken12) {
                    CubeTimerApp.utils.speak("Twelve seconds");
                    S.hasSpoken12 = true;
                }
            }, 100);
        },

        stopInspection() {
            if(this.inspectionInterval) clearInterval(this.inspectionInterval);
            CubeTimerApp.state.inspectionState = 'none';
            const timerEl = document.getElementById('timer');
            if(timerEl) timerEl.style.color = '';
            
            if (CubeTimerApp.state.isInspectionMode && CubeTimerApp.state.inspectionStartTime > 0) {
                const elapsed = (Date.now() - CubeTimerApp.state.inspectionStartTime) / 1000;
                if (elapsed > 17) CubeTimerApp.state.inspectionPenalty = 'DNF';
                else if (elapsed > 15) CubeTimerApp.state.inspectionPenalty = '+2';
                else CubeTimerApp.state.inspectionPenalty = null;
            }
        }
    },

    scrambler: {
        generate() {
            const event = CubeTimerApp.state.currentEvent;
            const conf = CubeTimerApp.config.events[event];
            if (!conf || event === '333mbf') return;

            let res = [];
            
            if (event === 'minx') this.generateMinx(res);
            else if (event === 'clock') this.generateClock(res);
            else if (event === 'sq1') this.generateSq1(res);
            else if (['pyra', 'skewb'].includes(event)) this.generatePyraSkewb(res, conf);
            else this.generateNxN(res, conf, event);

            CubeTimerApp.state.currentScramble = res.join(event === 'minx' ? "\n" : " ");
            const scrambleEl = document.getElementById('scramble');
            if(scrambleEl) scrambleEl.innerText = CubeTimerApp.state.currentScramble;
            
            if (conf.n) { 
                CubeTimerApp.visualizer.init(conf.n);
                const moves = CubeTimerApp.state.currentScramble.split(/\s+/).filter(s => s && !CubeTimerApp.config.orientations.includes(s) && s!=='y2');
                moves.forEach(m => CubeTimerApp.visualizer.applyMove(m));
                CubeTimerApp.visualizer.draw();
            } else {
                CubeTimerApp.visualizer.clear();
            }

            CubeTimerApp.ui.resetPenaltyButtons();
            if (CubeTimerApp.state.activeTool === 'graph') CubeTimerApp.ui.renderGraph();
        },

        generateMinx(res) {
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
        },
        generateClock(res) {
            res.length = 0;
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
            if (CubeTimerApp.state.currentEvent === 'pyra') {
                conf.tips.forEach(t => {
                    const r = Math.floor(Math.random() * 3);
                    if (r === 1) res.push(t); else if (r === 2) res.push(t + "'");
                });
            }
        },
        generateNxN(res, conf, event) {
            let lastAxis = -1, secondLastAxis = -1, lastMoveBase = "";
            const getAxis = (m) => { const c = m[0]; return "UD".includes(c)?0:"LR".includes(c)?1:2; };
            const suffixes = CubeTimerApp.config.suffixes;
            
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
                const wideMoves = CubeTimerApp.config.wideMoves;
                for (let i = 0; i < Math.floor(Math.random() * 2) + 1; i++) {
                    res.push(wideMoves[Math.floor(Math.random() * wideMoves.length)] + suffixes[Math.floor(Math.random() * 3)]);
                }
            } else if (conf.cat === 'blind') {
                const orients = CubeTimerApp.config.orientations;
                res.push(orients[Math.floor(Math.random() * orients.length)]);
                if (Math.random() > 0.5) res.push(orients[Math.floor(Math.random() * orients.length)]);
            }
        },
        generate3bldText() {
            const conf = CubeTimerApp.config.events['333bf'];
            let res = [], last = "", suffixes = CubeTimerApp.config.suffixes;
            for (let i = 0; i < conf.len; i++) {
                let m; do { m = conf.moves[Math.floor(Math.random() * conf.moves.length)]; } while (m[0] === last[0]);
                res.push(m + suffixes[Math.floor(Math.random() * 3)]); last = m;
            }
            const wideMoves = CubeTimerApp.config.wideMoves;
            for (let i = 0; i < Math.floor(Math.random() * 2) + 1; i++) {
                res.push(wideMoves[Math.floor(Math.random() * wideMoves.length)] + suffixes[Math.floor(Math.random() * 3)]);
            }
            return res.join(" ");
        }
    },

    storage: {
        save() {
            const data = {
                solves: CubeTimerApp.state.solves,
                sessions: CubeTimerApp.state.sessions,
                settings: { 
                    precision: CubeTimerApp.state.precision, 
                    isAo5Mode: CubeTimerApp.state.isAo5Mode, 
                    currentEvent: CubeTimerApp.state.currentEvent, 
                    holdDuration: CubeTimerApp.state.holdDuration,
                    isDarkMode: document.documentElement.classList.contains('dark'),
                    isWakeLockEnabled: CubeTimerApp.state.isWakeLockEnabled,
                    isInspectionMode: CubeTimerApp.state.isInspectionMode
                }
            };
            localStorage.setItem('cubeTimerData_v5', JSON.stringify(data));
        },
        load() {
            const saved = localStorage.getItem('cubeTimerData_v5') || localStorage.getItem('cubeTimerData_v4');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    const S = CubeTimerApp.state;
                    S.solves = data.solves || [];
                    S.sessions = data.sessions || {};
                    if (data.settings) {
                        S.precision = data.settings.precision || 2;
                        S.isAo5Mode = data.settings.isAo5Mode !== undefined ? data.settings.isAo5Mode : true;
                        S.currentEvent = data.settings.currentEvent || '333';
                        S.holdDuration = data.settings.holdDuration || 300;
                        S.isWakeLockEnabled = data.settings.isWakeLockEnabled || false;
                        S.isInspectionMode = data.settings.isInspectionMode || false;
                        
                        CubeTimerApp.ui.syncSettings(data.settings);
                    }
                } catch (e) { console.error("Load failed", e); }
            }
            this.initSessionIfNeeded(CubeTimerApp.state.currentEvent);
        },
        initSessionIfNeeded(eventId) {
            if (!CubeTimerApp.state.sessions[eventId] || CubeTimerApp.state.sessions[eventId].length === 0) {
                CubeTimerApp.state.sessions[eventId] = [{ id: Date.now(), name: "Session 1", isActive: true }];
            } else if (!CubeTimerApp.state.sessions[eventId].find(s => s.isActive)) {
                CubeTimerApp.state.sessions[eventId][0].isActive = true;
            }
        },
        getCurrentSessionId() {
            const active = (CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent] || []).find(s => s.isActive);
            if (active) return active.id;
            this.initSessionIfNeeded(CubeTimerApp.state.currentEvent);
            return CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent][0].id;
        },
        export() {
            const data = { solves: CubeTimerApp.state.solves, sessions: CubeTimerApp.state.sessions, settings: { ...CubeTimerApp.state } }; 
            delete data.settings.isRunning; delete data.settings.currentScramble;
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `cubetimer_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        },
        import(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.solves && data.sessions) {
                        CubeTimerApp.state.solves = data.solves;
                        CubeTimerApp.state.sessions = data.sessions;
                        if(data.settings) CubeTimerApp.ui.syncSettings(data.settings); 
                        this.save();
                        location.reload();
                    } else throw new Error("Invalid format");
                } catch(err) { alert("Failed to restore data. Invalid JSON."); }
            };
            reader.readAsText(file);
        }
    },

    bluetooth: {
        device: null,
        characteristic: null,
        
        async connect() {
            const statusText = document.getElementById('btStatusText');
            if (!navigator.bluetooth) {
                if(statusText) {
                    statusText.innerText = "Web Bluetooth is not supported.";
                    statusText.classList.add('text-red-400');
                }
                return;
            }
            try {
                const btn = document.getElementById('btConnectBtn');
                if(btn) { btn.disabled = true; btn.innerText = "Searching..."; }
                if(statusText) statusText.innerText = "Select your GAN Timer in the popup";
                const icon = document.getElementById('btModalIcon');
                if(icon) icon.classList.add('bt-pulse');

                this.device = await navigator.bluetooth.requestDevice({
                    filters: [{ namePrefix: 'GAN' }],
                    optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb']
                });

                const server = await this.device.gatt.connect();
                const service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
                this.characteristic = await service.getCharacteristic('0000fff5-0000-1000-8000-00805f9b34fb');

                await this.characteristic.startNotifications();
                this.characteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));

                CubeTimerApp.state.isBtConnected = true;
                CubeTimerApp.ui.updateBTUI(true);
                this.device.addEventListener('gattserverdisconnected', this.disconnect.bind(this));

            } catch (error) {
                console.error("BT Error:", error);
                if(statusText) statusText.innerText = "Connection failed";
                const btn = document.getElementById('btConnectBtn');
                if(btn) { btn.disabled = false; btn.innerText = "Connect Timer"; }
                const icon = document.getElementById('btModalIcon');
                if(icon) icon.classList.remove('bt-pulse');
            }
        },
        handleData(event) {
            const data = event.target.value;
            if (data.byteLength < 4) return;
            const stateCode = data.getUint8(3);
            const S = CubeTimerApp.state;

            if (stateCode !== 3 && !S.isRunning && data.byteLength >= 8) {
                const min = data.getUint8(4), sec = data.getUint8(5), msec = data.getUint16(6, true);
                const timerEl = document.getElementById('timer');
                if(timerEl) timerEl.innerText = CubeTimerApp.utils.formatTime((min*60000)+(sec*1000)+msec);
            }

            if (stateCode !== S.lastBtState) {
                const T = CubeTimerApp.timer;
                if (stateCode === 6) { 
                    if (!S.isInspectionMode) {
                        S.isReady = false;
                        CubeTimerApp.ui.setTimerStatus('ready');
                    }
                } else if (stateCode === 2) { 
                    if (!S.isInspectionMode) CubeTimerApp.ui.setTimerStatus('idle');
                } else if (stateCode === 3) { 
                    if (!S.isRunning) {
                        if (S.isInspectionMode && S.inspectionState === 'inspecting') T.stopInspection();
                        T.start();
                    }
                } else if (stateCode === 4) { 
                    if (S.isRunning) {
                        clearInterval(T.interval);
                        S.isRunning = false;
                        if (data.byteLength >= 8) {
                            const min = data.getUint8(4), sec = data.getUint8(5), msec = data.getUint16(6, true);
                            const finalMs = (min*60000)+(sec*1000)+msec;
                            const timerEl = document.getElementById('timer');
                            if(timerEl) timerEl.innerText = CubeTimerApp.utils.formatTime(finalMs);
                            T.stop(finalMs);
                        }
                    }
                }
                S.lastBtState = stateCode;
            }
        },
        disconnect() {
            if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
            if (CubeTimerApp.state.isRunning) CubeTimerApp.timer.stop();
            CubeTimerApp.state.isBtConnected = false;
            CubeTimerApp.state.lastBtState = null;
            CubeTimerApp.ui.updateBTUI(false);
        }
    },

    visualizer: {
        cubeState: {},
        ctx: null,
        
        init(n) {
            this.cubeState = { n };
            const C = CubeTimerApp.config.cubeColors;
            ['U','D','L','R','F','B'].forEach(f => this.cubeState[f] = Array(n*n).fill(C[f]));
            const canvas = document.getElementById('cubeVisualizer');
            if(canvas) this.ctx = canvas.getContext('2d');
        },
        clear() {
            const canvas = document.getElementById('cubeVisualizer');
            const msg = document.getElementById('noVisualizerMsg');
            if(!canvas) return;
            canvas.style.display = 'none';
            if(msg) {
                msg.classList.remove('hidden');
                if(CubeTimerApp.config.events[CubeTimerApp.state.currentEvent]?.cat === 'blind') {
                    msg.innerText = "Scramble images disabled for Blind";
                } else {
                    msg.innerText = "Visualizer for standard cubes only";
                }
            }
        },
        rotateFace(fName) {
            const n = this.cubeState.n, f = this.cubeState[fName], next = Array(n*n);
            for(let r=0;r<n;r++) for(let c=0;c<n;c++) next[c*n+(n-1-r)] = f[r*n+c];
            this.cubeState[fName] = next;
        },
        applyMove(move) {
            const n = this.cubeState.n; if(!n) return;
            let base = move[0], layer = 1;
            if(move.includes('w')) { if(/^\d/.test(move)) { layer = parseInt(move[0]); base = move[1]; } else { layer = 2; base = move[0]; } }
            const reps = move.includes("'") ? 3 : (move.includes("2") ? 2 : 1);
            
            for(let r=0; r<reps; r++) {
                for(let l=1; l<=layer; l++) {
                    if(l===1) this.rotateFace(base);
                    const d = l-1, last = n-1-d, S = this.cubeState;
                    if(base==='U') for(let i=0;i<n;i++) { let t=S.F[d*n+i]; S.F[d*n+i]=S.R[d*n+i]; S.R[d*n+i]=S.B[d*n+i]; S.B[d*n+i]=S.L[d*n+i]; S.L[d*n+i]=t; }
                    else if(base==='D') for(let i=0;i<n;i++) { let t=S.F[last*n+i]; S.F[last*n+i]=S.L[last*n+i]; S.L[last*n+i]=S.B[last*n+i]; S.B[last*n+i]=S.R[last*n+i]; S.R[last*n+i]=t; }
                    else if(base==='L') for(let i=0;i<n;i++) { let t=S.F[i*n+d]; S.F[i*n+d]=S.U[i*n+d]; S.U[i*n+d]=S.B[(n-1-i)*n+(n-1-d)]; S.B[(n-1-i)*n+(n-1-d)]=S.D[i*n+d]; S.D[i*n+d]=t; }
                    else if(base==='R') for(let i=0;i<n;i++) { let t=S.F[i*n+last]; S.F[i*n+last]=S.D[i*n+last]; S.D[i*n+last]=S.B[(n-1-i)*n+d]; S.B[(n-1-i)*n+d]=S.U[i*n+last]; S.U[i*n+last]=t; }
                    else if(base==='F') for(let i=0;i<n;i++) { let t=S.U[last*n+i]; S.U[last*n+i]=S.L[(n-1-i)*n+last]; S.L[(n-1-i)*n+last]=S.D[d*n+(n-1-i)]; S.D[d*n+(n-1-i)]=S.R[i*n+d]; S.R[i*n+d]=t; }
                    else if(base==='B') for(let i=0;i<n;i++) { let t=S.U[d*n+i]; S.U[d*n+i]=S.R[i*n+last]; S.R[i*n+last]=S.D[last*n+(n-1-i)]; S.D[last*n+(n-1-i)]=S.L[(n-1-i)*n+d]; S.L[(n-1-i)*n+d]=t; }
                }
            }
        },
        draw() {
            if(!this.ctx) return;
            const n = this.cubeState.n;
            const canvas = document.getElementById('cubeVisualizer');
            const msg = document.getElementById('noVisualizerMsg');
            if(canvas) canvas.style.display = 'block';
            if(msg) msg.classList.add('hidden');
            const ctx = this.ctx, faceS = 55, tileS = faceS/n, gap = 4;
            ctx.clearRect(0,0,260,190);
            const offX = (260-(4*faceS+3*gap))/2, offY = (190-(3*faceS+2*gap))/2;
            const drawF = (f,x,y) => this.cubeState[f].forEach((c,i) => {
                ctx.fillStyle=c; ctx.fillRect(x+(i%n)*tileS, y+Math.floor(i/n)*tileS, tileS, tileS);
                ctx.strokeStyle='#1e293b'; ctx.lineWidth=n>5?0.2:0.5; ctx.strokeRect(x+(i%n)*tileS, y+Math.floor(i/n)*tileS, tileS, tileS);
            });
            drawF('U', offX+faceS+gap, offY); drawF('L', offX, offY+faceS+gap); drawF('F', offX+faceS+gap, offY+faceS+gap);
            drawF('R', offX+2*(faceS+gap), offY+faceS+gap); drawF('B', offX+3*(faceS+gap), offY+faceS+gap); drawF('D', offX+faceS+gap, offY+2*(faceS+gap));
        }
    },

    ui: {
        init() {
            this.setupEventListeners();
            this.handleResize();
        },

        setupEventListeners() {
            const U = CubeTimerApp.utils;
            // Safer element lookup helper
            const add = (id, evt, handler) => {
                const el = document.getElementById(id);
                if(el) el.addEventListener(evt, handler);
            };

            window.addEventListener('keydown', this.handleKeydown.bind(this));
            window.addEventListener('keyup', this.handleKeyup.bind(this));
            const interactiveArea = document.getElementById('timerInteractiveArea');
            if(interactiveArea) {
                interactiveArea.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
                interactiveArea.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
            }
            window.addEventListener('resize', this.handleResize.bind(this));

            this.bindModal('btOverlay', 'btCloseBtn');
            this.bindModal('sessionOverlay', 'closeSessionBtn');
            this.bindModal('mbfScrambleOverlay', 'closeMbfBtn');
            this.bindModal('statsOverlay', 'closeStatsBtn');
            this.bindModal('settingsOverlay', 'closeSettingsBtn');
            this.bindModal('avgShareOverlay', 'closeShareBtn');
            this.bindModal('modalOverlay', 'closeDetailBtn');
            this.bindModal('updateLogOverlay', 'closeUpdateLogBtn');

            // Open Modals
            add('btToggleBtn', 'click', () => U.openModal('btOverlay'));
            add('settingsBtn', 'click', () => U.openModal('settingsOverlay'));
            add('mobSettingsBtn', 'click', () => U.openModal('settingsOverlay'));
            add('sessionSelectBtn', 'click', () => { U.openModal('sessionOverlay'); this.renderSessionList(); });
            add('moreStatsBtn', 'click', () => U.showExtendedStats());
            add('clearHistoryBtn', 'click', () => U.clearHistory());

            // Backup/Restore
            add('backupBtn', 'click', CubeTimerApp.storage.export);
            add('restoreBtn', 'click', () => { const el = document.getElementById('importInput'); if(el) el.click(); });
            add('mobBackupBtn', 'click', CubeTimerApp.storage.export);
            add('mobRestoreBtn', 'click', () => { const el = document.getElementById('importInput'); if(el) el.click(); });
            add('importInput', 'change', (e) => CubeTimerApp.storage.import(e.target.files[0]));

            // Actions
            add('btConnectBtn', 'click', () => CubeTimerApp.bluetooth.connect());
            add('btDisconnectBtn', 'click', () => CubeTimerApp.bluetooth.disconnect());
            add('addSessionBtn', 'click', () => this.createNewSession());
            add('genMbfBtn', 'click', () => U.generateMbfScrambles());
            add('copyMbfBtn', 'click', () => U.copyMbfText());
            add('copyShareBtn', 'click', () => U.copyShareText());
            add('shareSingleBtn', 'click', () => U.openSingleShare());
            add('useScrambleBtn', 'click', () => U.useThisScramble());
            add('plus2Btn', 'click', () => U.togglePenalty('+2'));
            add('dnfBtn', 'click', () => U.togglePenalty('DNF'));

            // Settings Inputs
            add('darkModeToggle', 'change', (e) => U.toggleDarkMode(e.target));
            add('wakeLockToggle', 'change', (e) => U.toggleWakeLock(e.target));
            add('inspectionToggle', 'change', (e) => U.toggleInspection(e.target));
            add('holdDurationSlider', 'input', (e) => U.updateHoldDuration(e.target.value));
            add('avgModeToggle', 'change', (e) => { CubeTimerApp.state.isAo5Mode = e.target.checked; this.updateHistory(); CubeTimerApp.storage.save(); });
            add('precisionToggle', 'change', (e) => { 
                CubeTimerApp.state.precision = e.target.checked?3:2; 
                this.updateHistory(); 
                const tEl = document.getElementById('timer');
                if(tEl) tEl.innerText = (0).toFixed(CubeTimerApp.state.precision); 
                CubeTimerApp.storage.save(); 
            });
            add('manualEntryToggle', 'change', (e) => { 
                CubeTimerApp.state.isManualMode = e.target.checked; 
                const tEl = document.getElementById('timer');
                const mEl = document.getElementById('manualInput');
                const sEl = document.getElementById('statusHint');
                if(tEl) tEl.classList.toggle('hidden', CubeTimerApp.state.isManualMode);
                if(mEl) mEl.classList.toggle('hidden', !CubeTimerApp.state.isManualMode);
                if(sEl) sEl.innerText = CubeTimerApp.state.isManualMode ? "TYPE TIME & ENTER" : "HOLD TO READY";
            });

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
            const sessList = document.getElementById('sessionList');
            if(sessList) sessList.addEventListener('click', this.handleSessionListClick.bind(this));
            
            const histList = document.getElementById('historyList');
            if(histList) {
                histList.addEventListener('click', this.handleHistoryListClick.bind(this));
                histList.addEventListener('scroll', this.handleHistoryScroll.bind(this));
            }
            
            add('toolsMenuBtn', 'click', (e) => { 
                e.stopPropagation(); 
                const dd = document.getElementById('toolsDropdown');
                if(dd) dd.classList.toggle('show'); 
            });
            const toolsDD = document.getElementById('toolsDropdown');
            if(toolsDD) {
                toolsDD.addEventListener('click', (e) => {
                    const opt = e.target.closest('.tool-option');
                    if(opt) this.selectTool(opt.dataset.tool);
                });
            }
            window.addEventListener('click', () => { 
                if(toolsDD) toolsDD.classList.remove('show'); 
            });

            add('mob-tab-timer', 'click', () => this.switchMobileTab('timer'));
            add('mob-tab-history', 'click', () => this.switchMobileTab('history'));
            add('primaryAvgBadge', 'click', () => U.openAvgShare('primary'));
            add('ao12Badge', 'click', () => U.openAvgShare('ao12'));
        },

        bindModal(overlayId, closeBtnId) {
            const overlay = document.getElementById(overlayId);
            const closeBtn = document.getElementById(closeBtnId);
            if(closeBtn) closeBtn.addEventListener('click', () => CubeTimerApp.utils.closeModal(overlayId));
            if(overlay) overlay.addEventListener('click', (e) => { if(e.target === overlay) CubeTimerApp.utils.closeModal(overlayId); });
        },

        handleStart(e) {
            if (e && e.target && (e.target.closest('.avg-badge') || e.target.closest('button') || e.target.closest('.tools-dropdown'))) return;
            const S = CubeTimerApp.state;
            if (S.isBtConnected && !S.isInspectionMode) return;
            if (e && e.cancelable) e.preventDefault();
            if (S.isManualMode || S.isRunning) { if(S.isRunning) CubeTimerApp.timer.stop(); return; }
            if (S.isInspectionMode && S.inspectionState === 'none') return;
            
            const timerEl = document.getElementById('timer');
            const statusEl = document.getElementById('statusHint');
            
            if (S.isInspectionMode && S.inspectionState === 'inspecting') {
                if (S.isBtConnected) return;
                if(timerEl) { timerEl.style.color = '#ef4444'; timerEl.classList.add('holding-status'); }
                CubeTimerApp.timer.holdTimer = setTimeout(()=> { 
                    S.isReady=true; 
                    if(timerEl) { timerEl.style.color = '#10b981'; timerEl.classList.replace('holding-status','ready-to-start'); }
                    if(statusEl) statusEl.innerText="Ready!"; 
                }, S.holdDuration); 
                return;
            }
            if(timerEl) { timerEl.style.color = '#ef4444'; timerEl.classList.add('holding-status'); }
            CubeTimerApp.timer.holdTimer = setTimeout(()=> { 
                S.isReady=true; 
                if(timerEl) { timerEl.style.color = '#10b981'; timerEl.classList.replace('holding-status','ready-to-start'); }
                if(statusEl) statusEl.innerText="Ready!"; 
            }, S.holdDuration);
        },

        handleEnd(e) {
            const S = CubeTimerApp.state;
            if (Date.now() - S.lastStopTimestamp < 500) return;
            if (S.isBtConnected) {
                if (S.isInspectionMode && S.inspectionState === 'none') CubeTimerApp.timer.startInspection();
                return;
            }
            if (e && e.cancelable) e.preventDefault();
            clearTimeout(CubeTimerApp.timer.holdTimer);
            if (S.isManualMode) return;

            if (S.isInspectionMode && !S.isRunning && S.inspectionState === 'none') {
                CubeTimerApp.timer.startInspection(); return;
            }

            if (!S.isRunning && S.isReady) {
                CubeTimerApp.timer.start();
            } else {
                const timerEl = document.getElementById('timer');
                const statusEl = document.getElementById('statusHint');
                if(timerEl) { timerEl.style.color = ''; timerEl.classList.remove('holding-status','ready-to-start'); }
                S.isReady = false;
                if(statusEl) {
                    if (!S.isInspectionMode || S.inspectionState === 'none') statusEl.innerText = S.isInspectionMode ? "Start Inspection" : "Hold to Ready";
                }
                else if(timerEl) timerEl.style.color = '#ef4444';
            }
        },

        handleKeydown(e) {
            const S = CubeTimerApp.state;
            const manualInput = document.getElementById('manualInput');
            if (S.editingSessionId || (document.activeElement && document.activeElement.tagName === 'INPUT')) {
                if (e.code === 'Enter' && document.activeElement === manualInput) { /* allowed */ } else { return; }
            }
            if (e.code === 'Space' && !e.repeat) { e.preventDefault(); this.handleStart(); }
            if (S.isManualMode && e.code === 'Enter' && manualInput) {
                let v = parseFloat(manualInput.value);
                if (v > 0) CubeTimerApp.timer.stop(v * 1000);
                manualInput.value = "";
            }
        },

        handleKeyup(e) { if(e.code==='Space' && !CubeTimerApp.state.editingSessionId) this.handleEnd(); },

        handleSessionListClick(e) {
            const id = parseInt(e.target.closest('[data-session-id]')?.dataset.sessionId);
            if (!id) return;
            if (e.target.closest('.delete-session')) this.deleteSession(id);
            else if (e.target.closest('.edit-session')) { CubeTimerApp.state.editingSessionId = id; this.renderSessionList(); }
            else if (e.target.closest('.save-session')) { this.saveSessionName(id); }
            else { // Switch
                const eventSessions = CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent];
                eventSessions.forEach(s => s.isActive = (s.id === id));
                this.renderSessionList(); this.updateHistory(); CubeTimerApp.storage.save();
                const timerEl = document.getElementById('timer');
                if(timerEl) timerEl.innerText = (0).toFixed(CubeTimerApp.state.precision);
                CubeTimerApp.ui.resetPenaltyButtons();
                CubeTimerApp.utils.closeModal('sessionOverlay');
            }
        },

        handleHistoryListClick(e) {
            const id = parseInt(e.target.closest('[data-solve-id]')?.dataset.solveId);
            if (!id) return;
            if (e.target.closest('.delete-solve')) {
                CubeTimerApp.state.solves = CubeTimerApp.state.solves.filter(s => s.id !== id);
                this.updateHistory(); CubeTimerApp.storage.save();
            } else {
                CubeTimerApp.utils.showSolveDetails(id);
            }
        },

        handleHistoryScroll() {
            const list = document.getElementById('historyList');
            if (list.scrollTop + list.clientHeight >= list.scrollHeight - 50) {
                const S = CubeTimerApp.state;
                const sid = CubeTimerApp.storage.getCurrentSessionId();
                const total = S.solves.filter(s => s.event === S.currentEvent && s.sessionId === sid).length;
                if (S.displayedSolvesCount < total) {
                    S.displayedSolvesCount += S.solvesBatchSize;
                    this.updateHistory();
                }
            }
        },

        updateTimerDisplay(ms) { 
            const el = document.getElementById('timer');
            if(el) el.innerText = CubeTimerApp.utils.formatTime(ms); 
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
                let display = CubeTimerApp.utils.formatTime(ms + (penalty === '+2' ? 2000 : 0));
                if (penalty === '+2') display += "+";
                el.innerText = display;
            }
        },
        setTimerStatus(status) {
            const statusEl = document.getElementById('statusHint');
            const timerEl = document.getElementById('timer');
            const hints = {
                'running': "Timing...",
                'idle': CubeTimerApp.state.isInspectionMode ? "Start Inspection" : "Hold to Ready",
                'inspection': "Inspection",
                'ready': "Ready!"
            };
            if(statusEl) statusEl.innerText = hints[status] || hints['idle'];
            if(timerEl) {
                if(status === 'running') { timerEl.classList.add('text-running'); timerEl.classList.remove('text-ready'); }
                else timerEl.classList.remove('text-running', 'text-ready');
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
            const panel = document.getElementById('btInfoPanel');
            if(panel) panel.classList.toggle('hidden', !connected);
            const disBtn = document.getElementById('btDisconnectBtn');
            if(disBtn) disBtn.classList.toggle('hidden', !connected);
            const conBtn = document.getElementById('btConnectBtn');
            if(conBtn) conBtn.classList.toggle('hidden', connected);
            
            if(connected) {
                const nameEl = document.getElementById('btDeviceName');
                const statusEl = document.getElementById('btStatusText');
                const modalIcon = document.getElementById('btModalIcon');
                const hint = document.getElementById('statusHint');
                
                if(nameEl && CubeTimerApp.bluetooth.device) nameEl.innerText = CubeTimerApp.bluetooth.device.name;
                if(statusEl) statusEl.innerText = "Timer Connected & Ready";
                if(modalIcon) modalIcon.classList.remove('bt-pulse');
                if(hint) hint.innerText = "Timer Ready (BT)";
            } else {
                const statusEl = document.getElementById('btStatusText');
                const hint = document.getElementById('statusHint');
                if(statusEl) statusEl.innerText = "Timer Disconnected";
                if(hint) hint.innerText = "Hold to Ready";
            }
        },
        syncSettings(settings) {
            const get = (id) => document.getElementById(id);
            const pT = get('precisionToggle'); if(pT) pT.checked = (settings.precision === 3);
            const aT = get('avgModeToggle'); if(aT) aT.checked = settings.isAo5Mode;
            const dT = get('darkModeToggle'); if(dT) dT.checked = settings.isDarkMode;
            const wT = get('wakeLockToggle'); if(wT) wT.checked = settings.isWakeLockEnabled;
            const iT = get('inspectionToggle'); if(iT) iT.checked = settings.isInspectionMode;
            
            if (settings.isInspectionMode) CubeTimerApp.utils.toggleInspection(iT);
            else {
                const sl = get('holdDurationSlider');
                const sv = get('holdDurationValue');
                if(sl) {
                    sl.value = settings.holdDuration / 1000;
                    if(sv) sv.innerText = sl.value + "s";
                }
            }
            CubeTimerApp.utils.toggleDarkMode(dT);
        },
        switchCategory(cat) {
            if(CubeTimerApp.state.isRunning) return;
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
            if(CubeTimerApp.state.isRunning) return;
            const S = CubeTimerApp.state;
            S.currentEvent = event;
            CubeTimerApp.storage.initSessionIfNeeded(event);
            S.displayedSolvesCount = S.solvesBatchSize;
            const hist = document.getElementById('historyList');
            if(hist) hist.scrollTop = 0;

            document.querySelectorAll('.event-tab').forEach(t => {
                t.classList.remove('active', 'text-white', 'bg-blue-600');
                t.classList.add('text-slate-500', 'dark:text-slate-400');
            });
            const tab = document.getElementById(`tab-${event}`);
            if(tab) { tab.classList.add('active', 'text-white', 'bg-blue-600'); tab.classList.remove('text-slate-500', 'dark:text-slate-400'); }

            const conf = CubeTimerApp.config.events[event];
            if(conf && conf.cat === 'blind') this.selectTool('graph');
            else this.selectTool(S.activeTool === 'graph' ? 'graph' : 'scramble');

            const isBig = ['666','777','333bf','444bf','555bf','333mbf'].includes(event);
            S.isAo5Mode = !isBig; 
            const avgToggle = document.getElementById('avgModeToggle');
            if(avgToggle) avgToggle.checked = !isBig;

            const scrEl = document.getElementById('scramble');
            const mbfEl = document.getElementById('mbfInputArea');

            if(event === '333mbf') {
                if(scrEl) scrEl.classList.add('hidden');
                if(mbfEl) mbfEl.classList.remove('hidden');
            } else {
                if(scrEl) scrEl.classList.remove('hidden');
                if(mbfEl) mbfEl.classList.add('hidden');
                CubeTimerApp.scrambler.generate();
            }
            this.updateHistory(); 
            const tEl = document.getElementById('timer');
            if(tEl) tEl.innerText = (0).toFixed(S.precision); 
            CubeTimerApp.storage.save();
        },
        updateHistory() {
            const S = CubeTimerApp.state;
            const sid = CubeTimerApp.storage.getCurrentSessionId();
            let filtered = S.solves.filter(s => s.event === S.currentEvent && s.sessionId === sid);
            
            const activeSession = (S.sessions[S.currentEvent] || []).find(s => s.isActive);
            const sessNameEl = document.getElementById('currentSessionNameDisplay');
            if (activeSession && sessNameEl) sessNameEl.innerText = activeSession.name;

            const subset = filtered.slice(0, S.displayedSolvesCount);
            const listEl = document.getElementById('historyList');
            if(listEl) {
                listEl.innerHTML = subset.map(s => `
                    <div class="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl flex justify-between items-center group cursor-pointer hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all" data-solve-id="${s.id}">
                        <span class="font-bold text-slate-700 dark:text-slate-200 text-sm">${s.penalty==='DNF'?'DNF':CubeTimerApp.utils.formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span>
                        <button class="delete-solve opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                `).join('') || '<div class="text-center py-10 text-slate-300 text-[11px] italic">No solves yet</div>';
            }

            const countEl = document.getElementById('solveCount');
            if(countEl) countEl.innerText = filtered.length;
            
            const U = CubeTimerApp.utils;
            const lp = document.getElementById('labelPrimaryAvg');
            const dp = document.getElementById('displayPrimaryAvg');
            const da = document.getElementById('displayAo12');
            
            if(lp) lp.innerText = S.isAo5Mode ? "Ao5" : "Mo3";
            if(dp) dp.innerText = U.calculateAvg(filtered, S.isAo5Mode ? 5 : 3, !S.isAo5Mode);
            if(da) da.innerText = U.calculateAvg(filtered, 12);
            
            let valid = filtered.filter(s=>s.penalty!=='DNF').map(s=>s.penalty==='+2'?s.time+2000:s.time);
            const sa = document.getElementById('sessionAvg');
            const bs = document.getElementById('bestSolve');
            
            if(sa) sa.innerText = valid.length ? U.formatTime(valid.reduce((a,b)=>a+b,0)/valid.length) : "-";
            if(bs) bs.innerText = valid.length ? U.formatTime(Math.min(...valid)) : "-";

            if (S.activeTool === 'graph') this.renderGraph();
        },
        renderSessionList() {
            const list = document.getElementById('sessionList');
            if(!list) return;
            const sessions = CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent] || [];
            const countEl = document.getElementById('sessionCountLabel');
            if(countEl) countEl.innerText = `${sessions.length}/10`;
            
            list.innerHTML = sessions.map(s => {
                if (CubeTimerApp.state.editingSessionId === s.id) {
                    return `<div class="flex items-center gap-2"><input type="text" id="editSessionInput" value="${s.name}" class="flex-1 bg-white dark:bg-slate-800 border border-blue-400 rounded-xl px-3 py-2.5 text-xs font-bold outline-none dark:text-white" autofocus><button class="save-session p-2 text-blue-600" data-session-id="${s.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button></div>`;
                }
                return `<div class="flex items-center gap-2 group" data-session-id="${s.id}"><div class="flex-1 flex items-center gap-2 p-1 rounded-xl border ${s.isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"><button class="flex-1 text-left p-2.5 text-xs font-bold truncate">${s.name}</button><button class="edit-session p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></div>${sessions.length > 1 ? `<button class="delete-session p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ''}</div>`;
            }).join('');
            
            if (CubeTimerApp.state.editingSessionId) {
                const input = document.getElementById('editSessionInput');
                if(input) {
                    input.focus();
                    input.addEventListener('blur', () => this.saveSessionName(CubeTimerApp.state.editingSessionId));
                    input.addEventListener('keydown', (e) => { if(e.key === 'Enter') this.saveSessionName(CubeTimerApp.state.editingSessionId); });
                }
            }
            const form = document.getElementById('sessionCreateForm');
            if(form) form.classList.toggle('hidden', sessions.length >= 10);
        },
        createNewSession() {
            const input = document.getElementById('newSessionName');
            if(!input) return;
            const name = input.value.trim() || `Session ${CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent].length + 1}`;
            if (CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent].length >= 10) return;
            CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent].forEach(s => s.isActive = false);
            CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent].push({ id: Date.now(), name: name, isActive: true });
            input.value = "";
            this.renderSessionList(); this.updateHistory(); CubeTimerApp.storage.save();
            const tEl = document.getElementById('timer');
            if(tEl) tEl.innerText = (0).toFixed(CubeTimerApp.state.precision); 
            this.resetPenaltyButtons();
        },
        deleteSession(id) {
            const eventSessions = CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent];
            if (!eventSessions || eventSessions.length <= 1) return;
            const targetIdx = eventSessions.findIndex(s => s.id === id);
            if (targetIdx === -1) return;
            const wasActive = eventSessions[targetIdx].isActive;
            CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent] = eventSessions.filter(s => s.id !== id);
            CubeTimerApp.state.solves = CubeTimerApp.state.solves.filter(s => !(s.event === CubeTimerApp.state.currentEvent && s.sessionId === id));
            if (wasActive && CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent].length > 0) CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent][0].isActive = true;
            this.renderSessionList(); this.updateHistory(); CubeTimerApp.storage.save();
        },
        saveSessionName(id) {
            const input = document.getElementById('editSessionInput');
            if (!input) return;
            const newName = input.value.trim();
            if (newName) { const s = CubeTimerApp.state.sessions[CubeTimerApp.state.currentEvent].find(x => x.id === id); if (s) s.name = newName; }
            CubeTimerApp.state.editingSessionId = null;
            this.renderSessionList(); this.updateHistory(); CubeTimerApp.storage.save();
        },
        selectTool(tool) {
            CubeTimerApp.state.activeTool = tool;
            const isBlind = CubeTimerApp.config.events[CubeTimerApp.state.currentEvent]?.cat === 'blind';
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
            
            if (tool === 'graph') this.renderGraph(); else if (tool === 'scramble') CubeTimerApp.visualizer.draw();
        },
        renderGraph() {
            const S = CubeTimerApp.state;
            const sid = CubeTimerApp.storage.getCurrentSessionId();
            const filtered = [...S.solves].filter(s => s.event === S.currentEvent && s.sessionId === sid).reverse();
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
                if(CubeTimerApp.state.activeTool === 'graph') this.renderGraph();
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
        }
    },

    utils: {
        formatTime(ms) {
            const minutes = Math.floor(ms / 60000), remainingMs = ms % 60000;
            let seconds = (CubeTimerApp.state.precision === 3) ? (remainingMs / 1000).toFixed(3) : (Math.floor(remainingMs / 10) / 100).toFixed(2);
            if (minutes > 0) { if (parseFloat(seconds) < 10) seconds = "0" + seconds; return `${minutes}:${seconds}`; }
            return seconds;
        },
        calculateAvg(list, count, mean=false) {
            if(list.length < count) return "-";
            let slice = list.slice(0, count), dnfC = slice.filter(s=>s.penalty==='DNF').length;
            let removeCount = Math.ceil(count * 0.05); if (count <= 12) removeCount = 1;
            if(dnfC >= removeCount + (mean?0:1)) return "DNF";
            let nums = slice.map(s => s.penalty==='DNF'?Infinity:(s.penalty==='+2'?s.time+2000:s.time));
            if(mean) return (nums.reduce((a,b)=>a+b,0)/count/1000).toFixed(CubeTimerApp.state.precision);
            nums.sort((a,b)=>a-b);
            for(let i=0; i<removeCount; i++) { nums.pop(); nums.shift(); }
            return (nums.reduce((a,b)=>a+b,0)/nums.length/1000).toFixed(CubeTimerApp.state.precision);
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
            if(el) { el.classList.add('active'); if(id === 'sessionOverlay') CubeTimerApp.ui.renderSessionList(); }
        },
        closeModal(id) { 
            const el = document.getElementById(id);
            if(el) el.classList.remove('active'); 
        },
        checkUpdateLog() {
            const saved = localStorage.getItem('appVersion');
            if (saved !== CubeTimerApp.config.appVersion) {
                const vEl = document.getElementById('updateVersion');
                const lEl = document.getElementById('updateList');
                if(vEl) vEl.innerText = `v${CubeTimerApp.config.appVersion}`;
                if(lEl) lEl.innerHTML = CubeTimerApp.config.updateLogs.map(l => `<li>${l}</li>`).join('');
                this.openModal('updateLogOverlay');
                localStorage.setItem('appVersion', CubeTimerApp.config.appVersion);
            }
        },
        toggleDarkMode(el) {
            document.documentElement.classList.toggle('dark', el && el.checked);
            if(CubeTimerApp.state.activeTool === 'graph') CubeTimerApp.ui.renderGraph();
            CubeTimerApp.storage.save();
        },
        async toggleWakeLock(el) {
            CubeTimerApp.state.isWakeLockEnabled = el && el.checked;
            if (el && el.checked) {
                try { if ('wakeLock' in navigator) CubeTimerApp.state.wakeLock = await navigator.wakeLock.request('screen'); } catch(e){}
            } else if (CubeTimerApp.state.wakeLock) { await CubeTimerApp.state.wakeLock.release(); CubeTimerApp.state.wakeLock = null; }
            CubeTimerApp.storage.save();
        },
        toggleInspection(el) {
            CubeTimerApp.state.isInspectionMode = el && el.checked;
            const slider = document.getElementById('holdDurationSlider');
            const container = document.getElementById('holdDurationContainer');
            if (el && el.checked) { 
                this.updateHoldDuration(0.01); 
                if(slider) { slider.value = 0.01; slider.disabled = true; }
                if(container) container.classList.add('opacity-50', 'pointer-events-none'); 
            } else { 
                this.updateHoldDuration(0.3); 
                if(slider) { slider.value = 0.3; slider.disabled = false; }
                if(container) container.classList.remove('opacity-50', 'pointer-events-none'); 
            }
            CubeTimerApp.storage.save();
        },
        updateHoldDuration(val) {
            CubeTimerApp.state.holdDuration = parseFloat(val) * 1000;
            const valEl = document.getElementById('holdDurationValue');
            if(valEl) valEl.innerText = val < 0.1 ? "Instant" : val + "s";
            CubeTimerApp.storage.save();
        },
        togglePenalty(p) {
            const S = CubeTimerApp.state;
            if(!S.solves.length || S.isRunning) return;
            const sid = CubeTimerApp.storage.getCurrentSessionId();
            const list = S.solves.filter(s => s.event === S.currentEvent && s.sessionId === sid);
            if (!list.length) return;
            const target = list[0];
            target.penalty = (target.penalty===p)?null:p;
            
            const timerEl = document.getElementById('timer');
            if(timerEl) {
                if (target.penalty === 'DNF') timerEl.innerText = 'DNF';
                else {
                    const t = target.time + (target.penalty === '+2' ? 2000 : 0);
                    timerEl.innerText = this.formatTime(t) + (target.penalty === '+2' ? '+' : '');
                }
            }
            const p2 = document.getElementById('plus2Btn');
            const dnf = document.getElementById('dnfBtn');
            if (p2) p2.className = `penalty-btn ${target.penalty==='+2'?'active-plus2':'inactive'}`;
            if (dnf) dnf.className = `penalty-btn ${target.penalty==='DNF'?'active-dnf':'inactive'}`;
            CubeTimerApp.ui.updateHistory(); CubeTimerApp.storage.save();
        },
        openAvgShare(type) {
            const S = CubeTimerApp.state;
            const sid = CubeTimerApp.storage.getCurrentSessionId();
            const count = (type === 'primary') ? (S.isAo5Mode ? 5 : 3) : 12;
            const filtered = S.solves.filter(s => s.event === S.currentEvent && s.sessionId === sid);
            if (filtered.length < count) return;
            const list = filtered.slice(0, count);
            const avg = this.calculateAvg(filtered, count, (type === 'primary' && !S.isAo5Mode));
            
            const sd = document.getElementById('shareDate');
            const sl = document.getElementById('shareLabel');
            const sa = document.getElementById('shareAvg');
            const sli = document.getElementById('shareList');

            if(sd) sd.innerText = `Date : ${list[0].date}`;
            if(sl) sl.innerText = (type === 'primary' && !S.isAo5Mode) ? `Mean of 3 :` : `Average of ${count} :`;
            if(sa) sa.innerText = avg;
            if(sli) sli.innerHTML = list.map((s, idx) => `<div class="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><div class="flex items-center gap-3"><span class="text-[10px] font-bold text-slate-400 w-4">${count - idx}.</span><span class="font-bold text-slate-800 dark:text-slate-200 text-sm min-w-[50px]">${s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><span class="text-[10px] text-slate-400 font-medium italic truncate flex-grow">${s.scramble}</span></div></div>`).reverse().join('');
            this.openModal('avgShareOverlay');
        },
        openSingleShare() {
            const s = CubeTimerApp.state.solves.find(x => x.id === CubeTimerApp.state.selectedSolveId);
            if (!s) return;
            this.closeModal('modalOverlay');
            
            const sd = document.getElementById('shareDate');
            const sl = document.getElementById('shareLabel');
            const sa = document.getElementById('shareAvg');
            const sli = document.getElementById('shareList');

            if(sd) sd.innerText = `Date : ${s.date}`;
            if(sl) sl.innerText = `Single :`;
            if(sa) sa.innerText = s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time) + (s.penalty==='+2'?'+':'');
            if(sli) sli.innerHTML = `<div class="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><div class="flex items-center gap-3"><span class="text-[10px] font-bold text-slate-400 w-4">1.</span><span class="font-bold text-slate-800 dark:text-slate-200 text-sm min-w-[50px]">${s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><span class="text-[10px] text-slate-400 font-medium italic truncate flex-grow">${s.scramble}</span></div></div>`;
            this.openModal('avgShareOverlay');
        },
        copyShareText() {
            const sd = document.getElementById('shareDate');
            const sl = document.getElementById('shareLabel');
            const sa = document.getElementById('shareAvg');
            
            const date = sd ? sd.innerText : '';
            const label = sl ? sl.innerText : '';
            const val = sa ? sa.innerText : '';
            let text = `[CubeTimer]\n\n${date}\n\n${label} ${val}\n\n`;
            if (label.includes('Single')) {
                const s = CubeTimerApp.state.solves.find(x => x.id === CubeTimerApp.state.selectedSolveId);
                if (s) text += `1. ${val}   ${s.scramble}\n`;
            } else {
                const count = label.includes('5') ? 5 : (label.includes('3') ? 3 : 12);
                const sid = CubeTimerApp.storage.getCurrentSessionId();
                CubeTimerApp.state.solves.filter(s => s.event === CubeTimerApp.state.currentEvent && s.sessionId === sid).slice(0, count).reverse().forEach((s, i) => {
                    text += `${i+1}. ${s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}   ${s.scramble}\n`;
                });
            }
            this.copyToClipboard(text, document.getElementById('copyShareBtn'));
        },
        copyMbfText() {
            const texts = Array.from(document.querySelectorAll('.scramble-text')).map((el, i) => `${i+1}. ${el.innerText}`).join('\n\n');
            const countText = document.getElementById('mbfCubeCountDisplay') ? document.getElementById('mbfCubeCountDisplay').innerText : '';
            this.copyToClipboard(`[CubeTimer] Multi-Blind Scrambles (${countText})\n\n${texts}`, document.getElementById('copyMbfBtn'));
        },
        copyToClipboard(text, btnElement) {
            const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); if(btnElement) { const original = btnElement.innerText; btnElement.innerText = "Copied!"; setTimeout(() => btnElement.innerText = original, 2000); } } catch(e){}
            document.body.removeChild(ta);
        },
        showSolveDetails(id) {
            const s = CubeTimerApp.state.solves.find(x => x.id === id); if(!s) return;
            CubeTimerApp.state.selectedSolveId = id;
            if(document.getElementById('modalTime')) document.getElementById('modalTime').innerText = s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time);
            if(document.getElementById('modalEvent')) document.getElementById('modalEvent').innerText = s.event;
            if(document.getElementById('modalScramble')) document.getElementById('modalScramble').innerText = s.scramble;
            this.openModal('modalOverlay');
        },
        useThisScramble() {
            const s = CubeTimerApp.state.solves.find(x => x.id === CubeTimerApp.state.selectedSolveId);
            if(s) { 
                CubeTimerApp.state.currentScramble = s.scramble; 
                const scrEl = document.getElementById('scramble');
                if(scrEl) scrEl.innerText = s.scramble; 
                this.closeModal('modalOverlay'); 
            }
        },
        showExtendedStats() {
            const sid = CubeTimerApp.storage.getCurrentSessionId();
            const list = CubeTimerApp.state.solves.filter(s => s.event === CubeTimerApp.state.currentEvent && s.sessionId === sid);
            const content = document.getElementById('statsContent');
            if(content) {
                content.innerHTML = [25, 50, 100].map(n => `
                    <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Current Ao${n}</span>
                        <span class="text-lg font-bold text-slate-700 dark:text-white">${this.calculateAvg(list, n)}</span>
                    </div>
                `).join('');
                this.openModal('statsOverlay');
            }
        },
        clearHistory() {
            const sid = CubeTimerApp.storage.getCurrentSessionId();
            const msg = `Clear all history for this session?`;
            const div = document.createElement('div');
            div.innerHTML = `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl"><p class="text-sm font-bold text-slate-700 dark:text-white mb-6 text-center">${msg}</p><div class="flex gap-2"><button id="cancelClear" class="flex-1 py-3 text-slate-400 font-bold text-sm">Cancel</button><button id="confirmClear" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm">Clear All</button></div></div></div>`;
            document.body.appendChild(div);
            const cancel = div.querySelector('#cancelClear');
            const confirm = div.querySelector('#confirmClear');
            if(cancel) cancel.onclick = () => document.body.removeChild(div);
            if(confirm) confirm.onclick = () => {
                CubeTimerApp.state.solves = CubeTimerApp.state.solves.filter(s => !(s.event === CubeTimerApp.state.currentEvent && s.sessionId === sid));
                CubeTimerApp.ui.updateHistory(); CubeTimerApp.storage.save();
                const timerEl = document.getElementById('timer');
                if(timerEl) timerEl.innerText = (0).toFixed(CubeTimerApp.state.precision); 
                CubeTimerApp.ui.resetPenaltyButtons();
                document.body.removeChild(div);
            };
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
                            <p class="font-bold text-slate-600 dark:text-slate-300 leading-relaxed scramble-text">${CubeTimerApp.scrambler.generate3bldText()}</p>
                        </div>`;
                }
            }
            this.openModal('mbfScrambleOverlay');
            CubeTimerApp.state.currentScramble = `Multi-Blind (${count} Cubes Attempt)`;
        }
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    CubeTimerApp.ui.init();
    CubeTimerApp.storage.load();
    // DOM 렌더링이 확실히 끝난 후 실행되도록 지연
    setTimeout(() => {
        CubeTimerApp.ui.changeEvent(CubeTimerApp.state.currentEvent || '333');
        CubeTimerApp.utils.checkUpdateLog();
    }, 0);
});
