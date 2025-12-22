/**
 * Cube Timer Application
 * Visualizer Updated: Single Instance Pattern enforced to prevent rendering crashes.
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
    savedHoldDuration: 300,
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
    appVersion: '1.4.5',
    updateLogs: [
        "TwistyPlayer 단일 인스턴스 구조 적용",
        "종목 전환 시 렌더링 충돌(Bad position) 해결",
        "Blind 모드 시각화 숨김 처리 개선"
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

// 3. DOM Helper
const Dom = {
    get: (id) => document.getElementById(id),
};

// 4. Utils Module
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
        const el = Dom.get(id); 
        if(el) { 
            el.classList.add('active'); 
            el.classList.add('force-show');
            if(id === 'sessionOverlay') UI.renderSessionList(); 
        }
    },
    closeModal(id) { 
        const el = Dom.get(id);
        if(el) {
            el.classList.remove('active'); 
            el.classList.remove('force-show');
        }
    },
    openSettingsModal() { 
        const content = Dom.get('settingsModal');
        if(content) content.classList.remove('scale-95', 'opacity-0');
        this.openModal('settingsOverlay'); 
    },
    closeSettingsModal() { 
        this.closeModal('settingsOverlay'); 
        Storage.save(); 
    },
    checkUpdateLog() {
        const saved = localStorage.getItem('appVersion');
        if (saved !== Config.appVersion) {
            const vEl = Dom.get('updateVersion');
            const lEl = Dom.get('updateList');
            if(vEl) vEl.innerText = `v${Config.appVersion}`;
            if(lEl) lEl.innerHTML = Config.updateLogs.map(l => `<li>${l}</li>`).join('');
            this.openModal('updateLogOverlay');
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
        const slider = Dom.get('holdDurationSlider');
        const container = Dom.get('holdDurationContainer');
        if (el && el.checked) { 
            State.savedHoldDuration = State.holdDuration;
            this.updateHoldDuration(0.01); 
            if(slider) { slider.value = 0.01; slider.disabled = true; }
            if(container) container.classList.add('opacity-50', 'pointer-events-none'); 
        } else { 
            const restored = State.savedHoldDuration ? State.savedHoldDuration / 1000 : 0.3;
            this.updateHoldDuration(restored); 
            if(slider) { slider.value = restored; slider.disabled = false; }
            if(container) container.classList.remove('opacity-50', 'pointer-events-none'); 
        }
        Storage.save();
    },
    updateHoldDuration(val) {
        State.holdDuration = parseFloat(val) * 1000;
        const valEl = Dom.get('holdDurationValue');
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
        
        const timerEl = Dom.get('timer');
        if(timerEl) {
            if (target.penalty === 'DNF') timerEl.innerText = 'DNF';
            else {
                const t = target.time + (target.penalty === '+2' ? 2000 : 0);
                timerEl.innerText = this.formatTime(t) + (target.penalty === '+2' ? '+' : '');
            }
        }
        const p2 = Dom.get('plus2Btn');
        const dnf = Dom.get('dnfBtn');
        if (p2) p2.className = `penalty-btn ${target.penalty==='+2'?'active-plus2':'inactive'}`;
        if (dnf) dnf.className = `penalty-btn ${target.penalty==='DNF'?'active-dnf':'inactive'}`;
        UI.updateHistory(); Storage.save();
    },
    copyToClipboard(text, btnElement) {
        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); if(btnElement) { const original = btnElement.innerText; btnElement.innerText = "Copied!"; setTimeout(() => btnElement.innerText = original, 2000); } } catch(e){}
        document.body.removeChild(ta);
    },
    openAvgShare(type) {
        const sid = Storage.getCurrentSessionId();
        const count = (type === 'primary') ? (State.isAo5Mode ? 5 : 3) : 12;
        const filtered = State.solves.filter(s => s.event === State.currentEvent && s.sessionId === sid);
        if (filtered.length < count) return;
        const list = filtered.slice(0, count);
        const avg = this.calculateAvg(filtered, count, (type === 'primary' && !State.isAo5Mode));
        
        const sd = Dom.get('shareDate');
        const sl = Dom.get('shareLabel');
        const sa = Dom.get('shareAvg');
        const sli = Dom.get('shareList');

        if(sd) sd.innerText = `Date : ${list[0].date}`;
        if(sl) sl.innerText = (type === 'primary' && !State.isAo5Mode) ? `Mean of 3 :` : `Average of ${count} :`;
        if(sa) sa.innerText = avg;
        if(sli) sli.innerHTML = list.map((s, idx) => `<div class="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><div class="flex items-center gap-3"><span class="text-[10px] font-bold text-slate-400 w-4">${count - idx}.</span><span class="font-bold text-slate-800 dark:text-slate-200 text-sm min-w-[50px]">${s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><span class="text-[10px] text-slate-400 font-medium italic truncate flex-grow">${s.scramble}</span></div></div>`).reverse().join('');
        this.openModal('avgShareOverlay');
    },
    openSingleShare() {
        const s = State.solves.find(x => x.id === State.selectedSolveId);
        if (!s) return;
        this.closeModal('modalOverlay');
        const sd = Dom.get('shareDate');
        const sl = Dom.get('shareLabel');
        const sa = Dom.get('shareAvg');
        const sli = Dom.get('shareList');
        if(sd) sd.innerText = `Date : ${s.date}`;
        if(sl) sl.innerText = `Single :`;
        if(sa) sa.innerText = s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time) + (s.penalty==='+2'?'+':'');
        if(sli) sli.innerHTML = `<div class="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><div class="flex items-center gap-3"><span class="text-[10px] font-bold text-slate-400 w-4">1.</span><span class="font-bold text-slate-800 dark:text-slate-200 text-sm min-w-[50px]">${s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}</span><span class="text-[10px] text-slate-400 font-medium italic truncate flex-grow">${s.scramble}</span></div></div>`;
        this.openModal('avgShareOverlay');
    },
    copyShareText() {
        const sd = Dom.get('shareDate');
        const sl = Dom.get('shareLabel');
        const sa = Dom.get('shareAvg');
        const date = sd ? sd.innerText : '';
        const label = sl ? sl.innerText : '';
        const val = sa ? sa.innerText : '';
        let text = `[CubeTimer]\n\n${date}\n\n${label} ${val}\n\n`;
        if (label.includes('Single')) {
            const s = State.solves.find(x => x.id === State.selectedSolveId);
            if (s) text += `1. ${val}   ${s.scramble}\n`;
        } else {
            const count = label.includes('5') ? 5 : (label.includes('3') ? 3 : 12);
            const sid = Storage.getCurrentSessionId();
            State.solves.filter(s => s.event === State.currentEvent && s.sessionId === sid).slice(0, count).reverse().forEach((s, i) => {
                text += `${i+1}. ${s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time)}${s.penalty==='+2'?'+':''}   ${s.scramble}\n`;
            });
        }
        this.copyToClipboard(text, Dom.get('copyShareBtn'));
    },
    copyMbfText() {
        const texts = Array.from(document.querySelectorAll('.scramble-text')).map((el, i) => `${i+1}. ${el.innerText}`).join('\n\n');
        const countText = Dom.get('mbfCubeCountDisplay') ? Dom.get('mbfCubeCountDisplay').innerText : '';
        this.copyToClipboard(`[CubeTimer] Multi-Blind Scrambles (${countText})\n\n${texts}`, Dom.get('copyMbfBtn'));
    },
    showSolveDetails(id) {
        const s = State.solves.find(x => x.id === id); if(!s) return;
        State.selectedSolveId = id;
        if(Dom.get('modalTime')) Dom.get('modalTime').innerText = s.penalty==='DNF'?'DNF':this.formatTime(s.penalty==='+2'?s.time+2000:s.time);
        if(Dom.get('modalEvent')) Dom.get('modalEvent').innerText = s.event;
        if(Dom.get('modalScramble')) Dom.get('modalScramble').innerText = s.scramble;
        this.openModal('modalOverlay');
    },
    useThisScramble() {
        const s = State.solves.find(x => x.id === State.selectedSolveId);
        if(s) { 
            State.currentScramble = s.scramble; 
            const scrEl = Dom.get('scramble');
            if(scrEl) scrEl.innerText = s.scramble; 
            this.closeModal('modalOverlay'); 
        }
    },
    showExtendedStats() {
        const sid = Storage.getCurrentSessionId();
        const list = State.solves.filter(s => s.event === State.currentEvent && s.sessionId === sid);
        const content = Dom.get('statsContent');
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
        const sid = Storage.getCurrentSessionId();
        const msg = `Clear all history for this session?`;
        const div = document.createElement('div');
        div.innerHTML = `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div class="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl"><p class="text-sm font-bold text-slate-700 dark:text-white mb-6 text-center">${msg}</p><div class="flex gap-2"><button id="cancelClearBtn" class="flex-1 py-3 text-slate-400 font-bold text-sm">Cancel</button><button id="confirmClearBtn" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm">Clear All</button></div></div></div>`;
        document.body.appendChild(div);
        
        const cancel = div.querySelector('#cancelClearBtn');
        const confirm = div.querySelector('#confirmClearBtn');
        
        if(cancel) cancel.onclick = () => document.body.removeChild(div);
        if(confirm) confirm.onclick = () => {
            State.solves = State.solves.filter(s => !(s.event === State.currentEvent && s.sessionId === sid));
            UI.updateHistory(); Storage.save();
            const timerEl = Dom.get('timer');
            if(timerEl) timerEl.innerText = (0).toFixed(State.precision); 
            this.resetPenaltyButtons();
            document.body.removeChild(div);
        };
    },
    resetPenaltyButtons() {
        const p2 = Dom.get('plus2Btn');
        const dnf = Dom.get('dnfBtn');
        if (p2) p2.className = 'penalty-btn inactive';
        if (dnf) dnf.className = 'penalty-btn inactive';
    }
};

// 5. Timer Module
const Timer = {
    interval: null,
    holdTimer: null,
    inspectionInterval: null,

    start() {
        if(this.inspectionInterval) clearInterval(this.inspectionInterval); 
        State.inspectionState = 'none';
        const tEl = Dom.get('timer');
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
        
        const tEl = Dom.get('timer');
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
        const tEl = Dom.get('timer');
        if(tEl) tEl.style.color = '';
        
        if (State.isInspectionMode && State.inspectionStartTime > 0) {
            const elapsed = (Date.now() - State.inspectionStartTime) / 1000;
            if (elapsed > 17) State.inspectionPenalty = 'DNF';
            else if (elapsed > 15) State.inspectionPenalty = '+2';
            else State.inspectionPenalty = null;
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

            const scrEl = Dom.get('scramble');
            if(scrEl) scrEl.innerText = scrambleStr;
            
            Utils.resetPenaltyButtons();
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
            const scrEl = Dom.get('scramble');
            if(scrEl) scrEl.innerText = "Error generating scramble";
        }
    },
    // Generators
    generateMinx(res) { for(let i=0;i<7;i++){let l=[];for(let j=0;j<10;j++)l.push((j%2===0?"R":"D")+(Math.random()<0.5?"++":"--"));l.push(Math.random()<0.5?"U":"U'");res.push(l.join(" "));} },
    generateClock(res) {
        ["UR","DR","DL","UL","U","R","D","L","ALL"].forEach(d=>res.push(`${d}${Math.floor(Math.random()*12)-5}${Math.floor(Math.random()*12)-5>=0?'+':''}`));
        res.length=0; 
        ["UR","DR","DL","UL","U","R","D","L","ALL"].forEach(d=>res.push(`${d}${Math.floor(Math.random()*12)-5}${Math.floor(Math.random()*12)-5>=0?'+':''}`));
        res.push("y2"); 
        ["U","R","D","L","ALL"].forEach(d=>res.push(`${d}${Math.floor(Math.random()*12)-5}${Math.floor(Math.random()*12)-5>=0?'+':''}`));
        let p=[]; ["UR","DR","DL","UL"].forEach(x=>{if(Math.random()<0.5)p.push(x)}); if(p.length)res.push(p.join(" "));
    },
    generateSq1(res) {
        let t=[1,0,1,1,0,1,1,0,1,1,0,1], b=[1,0,1,1,0,1,1,0,1,1,0,1], m=0, ops=[];
        const rot=(a,n)=>{let x=n%12;if(x<0)x+=12;a.unshift(...a.splice(12-x,x))};
        while(m<12){
            let u=Math.floor(Math.random()*12)-5, d=Math.floor(Math.random()*12)-5;
            if(u===0&&d===0)continue;
            let nt=[...t], nb=[...b]; rot(nt,u); rot(nb,d);
            if(nt[0]&&nt[6]&&nb[0]&&nb[6]){ops.push(`(${u},${d})`); let tr=nt.slice(6), br=nb.slice(6); t=[...nt.slice(0,6),...br]; b=[...nb.slice(0,6),...tr]; ops.push("/"); m++;}
        }
        res.push(ops.join(" "));
    },
    generatePyraSkewb(res, conf) {
        let last=""; for(let i=0;i<conf.len;i++){let m;do{m=conf.moves[Math.floor(Math.random()*conf.moves.length)]}while(m===last); res.push(m+(Math.random()<0.5?"'":"")); last=m;}
        if(State.currentEvent==='pyra') conf.tips.forEach(t=>{const r=Math.floor(Math.random()*3); if(r===1)res.push(t); else if(r===2)res.push(t+"'");});
    },
    generateNxN(res, conf, event) {
        let la=-1, sla=-1, lmb=""; const getAxis=m=>"UD".includes(m[0])?0:"LR".includes(m[0])?1:2;
        for(let i=0;i<conf.len;i++){
            let m,ax,bs,v=false; while(!v){m=conf.moves[Math.floor(Math.random()*conf.moves.length)]; ax=getAxis(m); bs=m[0]; if(bs===lmb)continue; if(ax!==-1&&ax===la&&ax===sla)continue; v=true;}
            res.push(m+Config.suffixes[Math.floor(Math.random()*3)]); sla=la; la=ax; lmb=bs;
        }
        if(event==='333bf'){ const w=Config.wideMoves; for(let i=0;i<Math.floor(Math.random()*2)+1;i++) res.push(w[Math.floor(Math.random()*w.length)]+Config.suffixes[Math.floor(Math.random()*3)]); }
        else if(conf.cat==='blind'){ const o=Config.orientations; res.push(o[Math.floor(Math.random()*o.length)]); if(Math.random()>0.5)res.push(o[Math.floor(Math.random()*o.length)]); }
    },
    generate3bldText() {
        const conf=Config.events['333bf']; let res=[],last="";
        for(let i=0;i<conf.len;i++){let m;do{m=conf.moves[Math.floor(Math.random()*conf.moves.length)]}while(m[0]===last[0]); res.push(m+Config.suffixes[Math.floor(Math.random()*3)]); last=m;}
        const w=Config.wideMoves; for(let i=0;i<Math.floor(Math.random()*2)+1;i++) res.push(w[Math.floor(Math.random()*w.length)]+Config.suffixes[Math.floor(Math.random()*3)]);
        return res.join(" ");
    }
};

// 7. Storage Module
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

// 8. Visualizer Module (FIXED: STRICT SINGLE INSTANCE PATTERN)
const Visualizer = {
    player: null, // Holds the single instance

    init() {
        const container = Dom.get('cubeVisualizer');
        if (!container) return;

        // Try to create the player if library is ready
        if (window.TwistyPlayer && !this.player) {
            try {
                this.player = new window.TwistyPlayer({
                    visualization: '2D',
                    background: 'none',
                    controlPanel: 'none'
                });
                
                // Style settings
                this.player.style.width = "100%";
                this.player.style.height = "100%";
                this.player.style.pointerEvents = "none";
                
                container.appendChild(this.player);
                console.log("Visualizer Initialized");
            } catch (e) {
                console.error("Visualizer Init Failed:", e);
            }
        } else if (!window.TwistyPlayer) {
            // Retry init if library not loaded yet
            setTimeout(() => this.init(), 500);
        }
    },

    update(puzzleId, scramble) {
        const container = Dom.get('cubeVisualizer');
        const msg = Dom.get('noVisualizerMsg');
        
        // 1. Handle Blind Events (Hide only, do not remove)
        if (Config.events[State.currentEvent]?.cat === 'blind') {
            if (msg) {
                msg.classList.remove('hidden');
                msg.innerText = "Scramble images disabled for Blind";
            }
            if (container) container.style.display = 'none';
            return;
        }

        // 2. Show container
        if (msg) msg.classList.add('hidden');
        if (container) container.style.display = 'flex';

        // 3. Ensure Player Exists
        if (!this.player) {
            this.init();
            return; // Will retry in init()
        }

        // 4. Safe Update Logic
        // If changing puzzle type, we must clear alg first to avoid "Bad position" crashes
        // caused by applying an alg of Puzzle A to Geometry of Puzzle B.
        if (this.player.puzzle !== puzzleId) {
            this.player.alg = ''; // Clear alg first
            
            // Use timeout to let the internal engine clear the state
            setTimeout(() => {
                if (this.player) {
                    this.player.puzzle = puzzleId;
                    this.player.alg = scramble;
                }
            }, 50); 
        } else {
            // Same puzzle, just update alg
            this.player.alg = scramble;
        }
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

// 9. Bluetooth Module
const Bluetooth = {
    device: null,
    characteristic: null,
    
    async connect() {
        const els = { st: Dom.get('btStatusText'), btn: Dom.get('btConnectBtn'), icon: Dom.get('btModalIcon') };
        if (!navigator.bluetooth) {
            if(els.st) { els.st.innerText = "Web Bluetooth is not supported."; els.st.classList.add('text-red-400'); }
            return;
        }
        try {
            if(els.btn) { els.btn.disabled = true; els.btn.innerText = "Searching..."; }
            if(els.st) els.st.innerText = "Select your GAN Timer in the popup";
            if(els.icon) els.icon.classList.add('bt-pulse');

            this.device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'GAN' }], optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb'] });
            const server = await this.device.gatt.connect();
            const service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
            this.characteristic = await service.getCharacteristic('0000fff5-0000-1000-8000-00805f9b34fb');

            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));

            State.isBtConnected = true;
            UI.updateBTUI(true);
            this.device.addEventListener('gattserverdisconnected', this.disconnect.bind(this));

        } catch (error) {
            console.error("BT Error:", error);
            if(els.st) els.st.innerText = "Connection failed";
            if(els.btn) { els.btn.disabled = false; els.btn.innerText = "Connect Timer"; }
            if(els.icon) els.icon.classList.remove('bt-pulse');
        }
    },
    handleData(event) {
        const data = event.target.value;
        if (data.byteLength < 4) return;
        const stateCode = data.getUint8(3);

        if (stateCode !== 3 && !State.isRunning && data.byteLength >= 8) {
            const min = data.getUint8(4), sec = data.getUint8(5), msec = data.getUint16(6, true);
            const tEl = Dom.get('timer');
            if(tEl) tEl.innerText = Utils.formatTime((min*60000)+(sec*1000)+msec);
        }

        if (stateCode !== State.lastBtState) {
            if (stateCode === 6) { 
                if (!State.isInspectionMode) { State.isReady = false; UI.setTimerStatus('ready'); }
            } else if (stateCode === 2) { 
                if (!State.isInspectionMode) UI.setTimerStatus('idle');
            } else if (stateCode === 3) { 
                if (!State.isRunning) {
                    if (State.isInspectionMode && State.inspectionState === 'inspecting') Timer.stopInspection();
                    Timer.start();
                }
            } else if (stateCode === 4) { 
                if (State.isRunning) {
                    clearInterval(Timer.interval);
                    State.isRunning = false;
                    if (data.byteLength >= 8) {
                        const min = data.getUint8(4), sec = data.getUint8(5), msec = data.getUint16(6, true);
                        const finalMs = (min*60000)+(sec*1000)+msec;
                        const tEl = Dom.get('timer');
                        if(tEl) tEl.innerText = Utils.formatTime(finalMs);
                        Timer.stop(finalMs);
                    }
                }
            }
            State.lastBtState = stateCode;
        }
    },
    disconnect() {
        if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
        if (State.isRunning) Timer.stop();
        State.isBtConnected = false;
        State.lastBtState = null;
        UI.updateBTUI(false);
    }
};

// 10. UI Module
const UI = {
    init() { this.setupEventListeners(); this.handleResize(); },
    
    setupEventListeners() {
        const safeAdd = (id, evt, handler) => {
            const el = Dom.get(id);
            if(el) el.addEventListener(evt, handler);
        };

        window.addEventListener('keydown', this.handleKeydown.bind(this));
        window.addEventListener('keyup', this.handleKeyup.bind(this));
        const iArea = Dom.get('timerInteractiveArea');
        if(iArea) {
            iArea.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
            iArea.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
        }
        window.addEventListener('resize', this.handleResize.bind(this));

        // Modals
        safeAdd('btCloseBtn', 'click', () => Utils.closeModal('btOverlay'));
        safeAdd('closeSessionBtn', 'click', () => Utils.closeModal('sessionOverlay'));
        safeAdd('closeMbfBtn', 'click', () => Utils.closeModal('mbfScrambleOverlay'));
        safeAdd('closeStatsBtn', 'click', () => Utils.closeModal('statsOverlay'));
        safeAdd('closeSettingsBtn', 'click', () => Utils.closeSettingsModal());
        safeAdd('closeShareBtn', 'click', () => Utils.closeModal('avgShareOverlay'));
        safeAdd('closeDetailBtn', 'click', () => Utils.closeModal('modalOverlay'));
        safeAdd('closeUpdateLogBtn', 'click', () => Utils.closeModal('updateLogOverlay'));

        // Overlay clicks
        ['btOverlay', 'sessionOverlay', 'mbfScrambleOverlay', 'statsOverlay', 'avgShareOverlay', 'modalOverlay', 'updateLogOverlay'].forEach(id => {
            const el = Dom.get(id);
            if(el) el.addEventListener('click', (e) => { if(e.target === el) Utils.closeModal(id); });
        });
        const sOv = Dom.get('settingsOverlay');
        if(sOv) sOv.addEventListener('click', (e) => { if(e.target === sOv) Utils.closeSettingsModal(); });

        // Header
        safeAdd('btToggleBtn', 'click', () => Utils.openModal('btOverlay'));
        safeAdd('backupBtn', 'click', Storage.exportData);
        safeAdd('restoreBtn', 'click', () => { const el = Dom.get('importInput'); if(el) el.click(); });
        const imp = Dom.get('importInput');
        if(imp) imp.addEventListener('change', (e) => Storage.importData(e.target.files[0]));
        safeAdd('settingsBtn', 'click', () => Utils.openSettingsModal());
        safeAdd('mobSettingsBtn', 'click', () => Utils.openSettingsModal());

        // Actions
        safeAdd('btConnectBtn', 'click', () => Bluetooth.connect());
        safeAdd('btDisconnectBtn', 'click', () => Bluetooth.disconnect());
        safeAdd('addSessionBtn', 'click', () => this.createNewSession());
        safeAdd('genMbfBtn', 'click', () => this.generateMbfScrambles());
        safeAdd('copyMbfBtn', 'click', () => Utils.copyMbfText());
        safeAdd('copyShareBtn', 'click', () => Utils.copyShareText());
        safeAdd('shareSingleBtn', 'click', () => Utils.openSingleShare());
        safeAdd('useScrambleBtn', 'click', () => Utils.useThisScramble());
        safeAdd('moreStatsBtn', 'click', () => Utils.showExtendedStats());
        safeAdd('clearHistoryBtn', 'click', () => Utils.clearHistory());
        safeAdd('sessionSelectBtn', 'click', () => { Utils.openModal('sessionOverlay'); this.renderSessionList(); });
        safeAdd('plus2Btn', 'click', () => Utils.togglePenalty('+2'));
        safeAdd('dnfBtn', 'click', () => Utils.togglePenalty('DNF'));

        // Settings Inputs
        safeAdd('darkModeToggle', 'change', (e) => Utils.toggleDarkMode(e.target));
        safeAdd('wakeLockToggle', 'change', (e) => Utils.toggleWakeLock(e.target));
        safeAdd('inspectionToggle', 'change', (e) => Utils.toggleInspection(e.target));
        safeAdd('holdDurationSlider', 'input', (e) => Utils.updateHoldDuration(e.target.value));
        safeAdd('avgModeToggle', 'change', (e) => { State.isAo5Mode = e.target.checked; this.updateHistory(); Storage.save(); });
        safeAdd('precisionToggle', 'change', (e) => { 
            State.precision = e.target.checked?3:2; this.updateHistory(); 
            const t = Dom.get('timer'); if(t) t.innerText = (0).toFixed(State.precision); Storage.save(); 
        });
        safeAdd('manualEntryToggle', 'change', (e) => { 
            State.isManualMode = e.target.checked; 
            const t = Dom.get('timer'), m = Dom.get('manualInput'), s = Dom.get('statusHint');
            if(t) t.classList.toggle('hidden', State.isManualMode);
            if(m) m.classList.toggle('hidden', !State.isManualMode);
            if(s) s.innerText = State.isManualMode ? "TYPE TIME & ENTER" : "HOLD TO READY";
        });
        safeAdd('mobBackupBtn', 'click', Storage.exportData);
        safeAdd('mobRestoreBtn', 'click', () => { const el = Dom.get('importInput'); if(el) el.click(); });

        // Delegated
        const catTabs = Dom.get('categoryTabs');
        if(catTabs) catTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn'); if(btn) this.switchCategory(btn.dataset.cat);
        });
        document.querySelectorAll('.event-group').forEach(grp => {
            grp.addEventListener('click', (e) => {
                const tab = e.target.closest('.event-tab'); if(tab) this.changeEvent(tab.dataset.event);
            });
        });
        const sList = Dom.get('sessionList');
        if(sList) sList.addEventListener('click', this.handleSessionListClick.bind(this));
        const hList = Dom.get('historyList');
        if(hList) {
            hList.addEventListener('click', this.handleHistoryListClick.bind(this));
            hList.addEventListener('scroll', this.handleHistoryScroll.bind(this));
        }

        safeAdd('toolsMenuBtn', 'click', (e) => { 
            e.stopPropagation(); const dd = Dom.get('toolsDropdown'); if(dd) dd.classList.toggle('show'); 
        });
        const tDD = Dom.get('toolsDropdown');
        if(tDD) tDD.addEventListener('click', (e) => {
            const opt = e.target.closest('.tool-option'); if(opt) this.selectTool(opt.dataset.tool);
        });
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
        
        const tEl = Dom.get('timer');
        const sEl = Dom.get('statusHint');
        
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
            const tEl = Dom.get('timer');
            const sEl = Dom.get('statusHint');
            if(tEl) { tEl.style.color = ''; tEl.classList.remove('holding-status','ready-to-start'); }
            State.isReady = false;
            if(sEl) {
                if (!State.isInspectionMode || State.inspectionState === 'none') sEl.innerText = State.isInspectionMode ? "Start Inspection" : "Hold to Ready";
            }
            else if(tEl) tEl.style.color = '#ef4444';
        }
    },

    handleKeydown(e) {
        const mEl = Dom.get('manualInput');
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
        else { 
            const eventSessions = State.sessions[State.currentEvent];
            eventSessions.forEach(s => s.isActive = (s.id === id));
            this.renderSessionList(); this.updateHistory(); Storage.save();
            const tEl = Dom.get('timer');
            if(tEl) tEl.innerText = (0).toFixed(State.precision);
            Utils.resetPenaltyButtons();
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
        const list = Dom.get('historyList');
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
        const el = Dom.get('timer');
        if(el) el.innerText = Utils.formatTime(ms); 
    },
    updateInspectionDisplay(sec) {
        const el = Dom.get('timer');
        if(!el) return;
        if (sec > 0) el.innerText = Math.ceil(sec);
        else if (sec > -2) el.innerText = "+2";
        else el.innerText = "DNF";
    },
    displayFinalTime(ms, penalty) {
        const el = Dom.get('timer');
        if(!el) return;
        if (penalty === 'DNF') el.innerText = "DNF";
        else {
            let display = Utils.formatTime(ms + (penalty === '+2' ? 2000 : 0));
            if (penalty === '+2') display += "+";
            el.innerText = display;
        }
    },
    setTimerStatus(status) {
        const sEl = Dom.get('statusHint');
        const tEl = Dom.get('timer');
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
    updateBTUI(connected) {
        const icon = Dom.get('btStatusIcon');
        if(icon) icon.classList.replace(connected ? 'disconnected' : 'connected', connected ? 'connected' : 'disconnected');
        const pnl = Dom.get('btInfoPanel');
        if(pnl) pnl.classList.toggle('hidden', !connected);
        const dis = Dom.get('btDisconnectBtn');
        if(dis) dis.classList.toggle('hidden', !connected);
        const con = Dom.get('btConnectBtn');
        if(con) con.classList.toggle('hidden', connected);
        
        if(connected) {
            const nm = Dom.get('btDeviceName');
            const st = Dom.get('btStatusText');
            const ic = Dom.get('btModalIcon');
            const ht = Dom.get('statusHint');
            
            if(nm && Bluetooth.device) nm.innerText = Bluetooth.device.name;
            if(st) st.innerText = "Timer Connected & Ready";
            if(ic) ic.classList.remove('bt-pulse');
            if(ht) ht.innerText = "Timer Ready (BT)";
        } else {
            const st = Dom.get('btStatusText');
            const ht = Dom.get('statusHint');
            if(st) st.innerText = "Timer Disconnected";
            if(ht) ht.innerText = "Hold to Ready";
        }
    },
    syncSettings(settings) {
        const get = Dom.get;
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
        const btn = Dom.get(`cat-${cat}`);
        if(btn) { btn.classList.add('active', 'text-white'); btn.classList.remove('text-slate-500', 'dark:text-slate-400'); }
        
        document.querySelectorAll('.event-group').forEach(g => g.classList.add('hidden'));
        const grp = Dom.get(`group-${cat}`);
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
        const hist = Dom.get('historyList');
        if(hist) hist.scrollTop = 0;

        document.querySelectorAll('.event-tab').forEach(t => {
            t.classList.remove('active', 'text-white', 'bg-blue-600');
            t.classList.add('text-slate-500', 'dark:text-slate-400');
        });
        const tab = Dom.get(`tab-${event}`);
        if(tab) { tab.classList.add('active', 'text-white', 'bg-blue-600'); tab.classList.remove('text-slate-500', 'dark:text-slate-400'); }

        const conf = Config.events[event];
        if(conf && conf.cat === 'blind') this.selectTool('graph');
        else this.selectTool(State.activeTool === 'graph' ? 'graph' : 'scramble');

        const isBig = ['666','777','333bf','444bf','555bf','333mbf'].includes(event);
        State.isAo5Mode = !isBig; 
        const avgToggle = Dom.get('avgModeToggle');
        if(avgToggle) avgToggle.checked = !isBig;

        const scrEl = Dom.get('scramble');
        const mbfEl = Dom.get('mbfInputArea');

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
        const tEl = Dom.get('timer');
        if(tEl) tEl.innerText = (0).toFixed(State.precision); 
        Storage.save();
    },
    updateHistory() {
        const sid = Storage.getCurrentSessionId();
        let filtered = State.solves.filter(s => s.event === State.currentEvent && s.sessionId === sid);
        
        const activeSession = (State.sessions[State.currentEvent] || []).find(s => s.isActive);
        const sessNameEl = Dom.get('currentSessionNameDisplay');
        if (activeSession && sessNameEl) sessNameEl.innerText = activeSession.name;

        const subset = filtered.slice(0, State.displayedSolvesCount);
        const listEl = Dom.get('historyList');
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

        const countEl = Dom.get('solveCount');
        if(countEl) countEl.innerText = filtered.length;
        
        const lp = Dom.get('labelPrimaryAvg');
        const dp = Dom.get('displayPrimaryAvg');
        const da = Dom.get('displayAo12');
        
        if(lp) lp.innerText = State.isAo5Mode ? "Ao5" : "Mo3";
        if(dp) dp.innerText = Utils.calculateAvg(filtered, State.isAo5Mode ? 5 : 3, !State.isAo5Mode);
        if(da) da.innerText = Utils.calculateAvg(filtered, 12);
        
        let valid = filtered.filter(s=>s.penalty!=='DNF').map(s=>s.penalty==='+2'?s.time+2000:s.time);
        const sa = Dom.get('sessionAvg');
        const bs = Dom.get('bestSolve');
        
        if(sa) sa.innerText = valid.length ? Utils.formatTime(valid.reduce((a,b)=>a+b,0)/valid.length) : "-";
        if(bs) bs.innerText = valid.length ? Utils.formatTime(Math.min(...valid)) : "-";

        if (State.activeTool === 'graph') this.renderGraph();
    },
    renderSessionList() {
        const list = Dom.get('sessionList');
        if(!list) return;
        const sessions = State.sessions[State.currentEvent] || [];
        const countEl = Dom.get('sessionCountLabel');
        if(countEl) countEl.innerText = `${sessions.length}/10`;
        
        list.innerHTML = sessions.map(s => {
            if (State.editingSessionId === s.id) {
                return `<div class="flex items-center gap-2"><input type="text" id="editSessionInput" value="${s.name}" class="flex-1 bg-white dark:bg-slate-800 border border-blue-400 rounded-xl px-3 py-2.5 text-xs font-bold outline-none dark:text-white" autofocus><button class="save-session p-2 text-blue-600" data-session-id="${s.id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button></div>`;
            }
            return `<div class="flex items-center gap-2 group" data-session-id="${s.id}"><div class="flex-1 flex items-center gap-2 p-1 rounded-xl border ${s.isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"><button class="flex-1 text-left p-2.5 text-xs font-bold truncate">${s.name}</button><button class="edit-session p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 transition-all"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></div>${sessions.length > 1 ? `<button class="delete-session p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ''}</div>`;
        }).join('');
        
        if (State.editingSessionId) {
            const input = Dom.get('editSessionInput');
            if(input) {
                input.focus();
                input.addEventListener('blur', () => this.saveSessionName(State.editingSessionId));
                input.addEventListener('keydown', (e) => { if(e.key === 'Enter') this.saveSessionName(State.editingSessionId); });
            }
        }
        const form = Dom.get('sessionCreateForm');
        if(form) form.classList.toggle('hidden', sessions.length >= 10);
    },
    createNewSession() {
        const input = Dom.get('newSessionName');
        if(!input) return;
        const name = input.value.trim() || `Session ${State.sessions[State.currentEvent].length + 1}`;
        if (State.sessions[State.currentEvent].length >= 10) return;
        State.sessions[State.currentEvent].forEach(s => s.isActive = false);
        State.sessions[State.currentEvent].push({ id: Date.now(), name: name, isActive: true });
        input.value = "";
        this.renderSessionList(); this.updateHistory(); Storage.save();
        const tEl = Dom.get('timer');
        if(tEl) tEl.innerText = (0).toFixed(State.precision); 
        Utils.resetPenaltyButtons();
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
        const input = Dom.get('editSessionInput');
        if (!input) return;
        const newName = input.value.trim();
        if (newName) { const s = State.sessions[State.currentEvent].find(x => x.id === id); if (s) s.name = newName; }
        State.editingSessionId = null;
        this.renderSessionList(); this.updateHistory(); Storage.save();
    },
    selectTool(tool) {
        State.activeTool = tool;
        const isBlind = Config.events[State.currentEvent]?.cat === 'blind';
        const label = Dom.get('toolLabel');
        if(label) label.innerText = isBlind ? 'N/A (Blind)' : (tool === 'scramble' ? 'Scramble Image' : 'Graph (Trends)');
        
        const vWrap = Dom.get('visualizerWrapper');
        const gWrap = Dom.get('graphWrapper');
        if(vWrap) vWrap.classList.toggle('hidden', tool !== 'scramble');
        if(gWrap) gWrap.classList.toggle('hidden', tool !== 'graph');
        
        document.querySelectorAll('.tool-option').forEach(opt => opt.classList.remove('active'));
        const activeOpt = Dom.get(`tool-opt-${tool}`);
        if(activeOpt) activeOpt.classList.add('active');
        
        const dd = Dom.get('toolsDropdown');
        if(dd) dd.classList.remove('show');
        
        if (tool === 'graph') this.renderGraph(); else if (tool === 'scramble') Visualizer.draw();
    },
    renderGraph() {
        const sid = Storage.getCurrentSessionId();
        const filtered = [...State.solves].filter(s => s.event === State.currentEvent && s.sessionId === sid).reverse();
        const polyline = Dom.get('graphLine');
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
        const tSec = Dom.get('timerSection');
        const hSec = Dom.get('historySection');
        const tBtn = Dom.get('mob-tab-timer');
        const hBtn = Dom.get('mob-tab-history');

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
        const tSec = Dom.get('timerSection');
        const hSec = Dom.get('historySection');
        
        if (window.innerWidth >= 768) {
            if(tSec) tSec.classList.remove('hidden');
            if(hSec) { hSec.classList.remove('hidden'); hSec.classList.add('flex'); }
        } else {
            const tBtn = Dom.get('mob-tab-timer');
            if (tBtn && tBtn.classList.contains('text-blue-600')) this.switchMobileTab('timer');
            else this.switchMobileTab('history');
        }
    },
    generateMbfScrambles() {
        const input = Dom.get('mbfCubeInput');
        if(!input) return;
        const count = parseInt(input.value);
        if (!count || count < 2 || count > 100) return;
        const list = Dom.get('mbfScrambleList');
        if(Dom.get('mbfCubeCountDisplay')) Dom.get('mbfCubeCountDisplay').innerText = `${count} Cubes`;
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
    Visualizer.init(); // [FIXED] Explicit initialization call
    // [FIX] Force update on init with a tiny delay to ensure DOM is ready
    setTimeout(() => {
        UI.changeEvent(State.currentEvent || '333');
        Utils.checkUpdateLog();
    }, 50);
});
