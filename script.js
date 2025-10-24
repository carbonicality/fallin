const canvas = document.getElementById('gcanvas');
const ctx = canvas.getContext('2d');
canvas.width = 400;
canvas.height = 700;

const scoreEl = document.getElementById('score');
const depthEl = document.getElementById('depth');
const pwrUpEl = document.getElementById('pwrUp');
const comboEl = document.getElementById('combo');
const savedACH = localStorage.getItem('achievements');

let gameState = 'menu';
let score = 0;
let hScore = localStorage.getItem('hscore') || 0;
let depth = 0;
let combo = 0;
let cameraY = 0;
let difficulty = 1;
let sCollected = 0;
let startTime = 0;
let screenShake = 0;
const savedCoins = localStorage.getItem('coins');
const savedUpgrades = localStorage.getItem('upgrades');
let coins = savedCoins ? parseInt(savedCoins):0;
let coinsTR = 0;
let sDifficulty = localStorage.getItem('difficulty') || 'normal';

const player = {
    x: 200,
    y: 200,
    width: 24,
    height: 24,
    vx: 0,
    vy: 0,
    gravity: 0.4,
    maxVY: 12,
    moveSpeed: 6,
    trail: []
};

let platforms = [];
const platformW = 80;
const platformH = 12;
const minGap = 100;
const maxGap = 200;

let gaps = [];

let pwrups = [];
let activePwr = null;
let pwrT = 0;

const pwrTypes = {
    shield: {color:'#fff', duration:300, name:'shield', rarity:0.3},
    slow: {color:'#888', duration:250, name:'slow-mo', rarity:0.25},
    shrink: {color:'#fff', duration:200, name:'shrink', rarity:0.2},
    magnet: {color:'#888', duration:250, name:'magnet', rarity:0.15},
    ghost: {color:'#fff', duration:180, name:'ghost', rarity:0.1}
}

const achievements = {
    first100: {name:'100 falls!', desc:'reach 100m', unlocked:'false', depth:100},
    combo10: {name:'10x combo!!!!!!', desc:'reach a 10x combo', unlocked:'false', combo:10},
    shield5: {name:'unbeatable', desc:'get 5 shields in one run', unlocked:false},
    speedrun: {name:'speedrunner (or hakor?!?!?)', desc:'reach 200m in under 60s', unlocked:false} // misspelled hacker for satrical purposes
}

const upgrades = {
    coinMagnet:{level:0,maxLevel:5,cost:50,multiplier:1.5,name:'coin magnet',desc:'you become a magnet for coins (shocking)'},
    scoreBoost:{level:0,maxLevel:5,cost:100,multiplier:1.3,name:'score boost', desc:'20% extra score per level'},
    pwDuration:{level:0,maxLevel:3,cost:200,multiplier:1.5,name:'power duration',desc:'+50% extra powerup time'},
    sShield: {level:0,maxLevel:1,cost:500,multiplier:1,name:'starting shield',desc:'have a shield active when you start'},
    luckyDrops:{level:0,maxLevel:5,cost:150,multiplier:1.2,name:'lucky drops',desc:'+20% powerup spawn rate'}
}

const diffSettings = {
    easy: {
        name: 'easy',
        gravityMult: 0.7,
        coinMult: 1,
        scoreMult: 0.75,
        powerupChance: 0.20,
    },
    normal: {
        name: 'normal',
        gravityMult: 1,
        coinMult: 1.5,
        scoreMult: 1,
        powerupChance: 0.15,
    },
    hard: {
        name: 'hard',
        gravityMult: 1.3,
        coinMult: 2,
        scoreMult: 2,
        powerupChance: 0.10
    }
};

let coinPickups = [];

let particles = [];
const keys = {};

document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape' && gameState === 'playing') {
        gameState = 'paused';
    } else if (e.key === 'Escape' && gameState === 'paused') {
        gameState = 'playing';
    }
});

if (savedUpgrades) {
    try {
        const parsed = JSON.parse(savedUpgrades);
        Object.keys(parsed).forEach(key => {
            if (upgrades[key]) {
                upgrades[key].level = parsed[key].level;
            }
        });
    } catch(e) {
        console.error('failed to load upgrades!');
        showNotification('failed to load upgrades :skul:');
    }
}

document.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

document.getElementById('startBtn').addEventListener('click', showDiffSelect);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('exportBtn').addEventListener('click', exportSave);

document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', importSave);
document.getElementById('copyBtn').addEventListener('click', copySave);

document.getElementById('pasteBtn').addEventListener('click', () => {
    const code = prompt('paste your save code:');
    if (code) {
        importCode(code);
    }
});

function showDiffSelect() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('diffSelect').classList.remove('hidden');
}

function startDiff(diff) {
    sDifficulty = diff;
    localStorage.setItem('difficulty', diff);
    document.getElementById('diffSelect').classList.add('hidden');
    startGame();
}

function backToTheFuture() { //lol
    document.getElementById('diffSelect').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
}

window.backToTheFuture = backToTheFuture;
window.startDiff = startDiff;

function openShop() {
    gameState = 'shop';
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('shop').classList.remove('hidden');
    updShopUI();
}

function closeShop() {
    gameState = 'menu';
    document.getElementById('shop').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
}

function updShopUI() {
    document.getElementById('coinCount').textContent = coins;
    const container = document.getElementById('upgradeList');
    container.innerHTML = '';
    Object.keys(upgrades).forEach(key => {
        const upg = upgrades[key];
        const cost = Math.floor(upg.cost * Math.pow(upg.multiplier,upg.level));
        const maxed =upg.level >= upg.maxLevel;
        const div = document.createElement('div');
        div.className = 'upgrade-item';
        if (maxed) div.classList.add('maxed');
        div.innerHTML = `
        <div class="upgrade-info">
            <div class="upgrade-name">${upg.name} <span class="upgrade-level">lv ${upg.level}/${upg.maxLevel}</span><div>
            <div class="upgrade-desc">${upg.desc}</div>
        </div>
        <button class="btn-upgrade ${coins < cost || maxed ? 'disabled' : ''}" onclick="buyUpgrade('${key}')" ${coins < cost || maxed ? 'disabled' : ''}>${maxed ? 'MAXED' : `${cost}`}</button>`;
        container.appendChild(div);
    });
}

function buyUpgrade(key) {
    const upg = upgrades[key];
    const cost = Math.floor(upg.cost * Math.pow(upg.multiplier, upg.level));
    if (coins >= cost && upg.level < upg.maxLevel) {
        coins -= cost;
        upg.level++;
        localStorage.setItem('coins', coins);
        localStorage.setItem('upgrades', JSON.stringify(upgrades));
        updShopUI();
        showNotification(`upgraded ${upg.name}`);
    }
}

window.buyUpgrade = buyUpgrade;

document.getElementById('shopBtn').addEventListener('click', openShop);
document.getElementById('closeShop').addEventListener('click', closeShop);

function setDifficulty(diff) {
    sDifficulty = diff;
    localStorage.setItem('difficulty', diff);
    updDiffUI();
    showNotification(`difficulty set to ${diffSettings[diff].name}`);
}

function updDiffUI() {
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.difficulty === sDifficulty) {
            btn.classList.add('active');
        }
    });
}

window.setDifficulty = setDifficulty;

function exportSave() {
    const saveData = {
        version: '1.0',
        timestamp: Date.now(),
        hscore: hScore,
        achievements: achievements
    };
    const dataStr=JSON.stringify(saveData,null,2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fallin_save${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('save exported!');
}

function importSave(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const saveData = JSON.parse(event.target.result);
            applySD(saveData);
        } catch (err) {
            showNotification('invalid save file :skul:');
            console.error(err);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function copySave() {
    const saveData = {
        version: '1.0',
        timestamp: Date.now(),
        hscore: hScore,
        achievements: achievements
    };
    const encoded = btoa(JSON.stringify(saveData));
    navigator.clipboard.writeText(encoded).then(() => {
        showNotification('save code copied!')
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = encoded;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('save code copied!');
    });
}

function importCode(code) {
    try {
        const encoded = atob(code.trim());
        const saveData = JSON.parse(encoded);
        applySD(saveData);
    } catch (err) {
        showNotification('invalid save code :skul:');
        console.error(err);
    }
}

function applySD(saveData) {
    if (!saveData.version || !saveData.hScore) {
        showNotification('invalid save data :skul:');
        return;
    }
    hScore = saveData.hscore;
    localStorage.setItem('hscore', hScore);
    if (saveData.achievements) {
        Object.keys(saveData.achievements).forEach(key => {
            if (achievements[key]) {
                achievements[key].unlocked = saveData.achievements[key].unlocked;
            }
        });
        localStorage.setItem('achievements', JSON.stringify(achievements));
    }
    document.getElementById('hscore').textContent = `best: ${hScore}`;
    document.getElementById('fBest').textContent = hScore;
    showNotification('save imported!');
}

function startGame() {
    gameState = 'playing';
    score = 0;
    depth = 0;
    combo = 0;
    cameraY = 0;
    player.x = 200;
    player.y = 200;
    player.vx = 0;
    player.vy = 0;
    player.trail = [];
    platforms = [];
    gaps = [];
    pwrups = [];
    particles = [];
    activePwr = null;
    pwrT = 0;
    startTime = Date.now();
    sCollected = 0;
    screenShake = 0;
    coinsTR= 0;
    coinPickups = [];

    if (upgrades.sShield.level > 0) {
        activePwr = {...pwrTypes.shield,type:'shield'};
        pwrT = pwrTypes.shield.duration;
        pwrUpEl.textContent = activePwr.name;
        pwrUpEl.classList.add('active');
    }
    
    for (let i = 0; i < 20; i++) {
        genPlat();
    }

    document.getElementById('menu').classList.add('hidden');
    document.getElementById('gameover').classList.remove('visible');
    document.getElementById('hscore').textContent = `best: ${hScore}`;
}

function genPlat() {
    const lastY = platforms.length > 0 ? platforms[platforms.length - 1].y : player.y;
    const gap = minGap + Math.random() * (maxGap - minGap);
    const newY = lastY + gap;

    const gapWidth = 120 + Math.random() * 80;
    const gapX = 50 + Math.random() * (canvas.width - 100 - gapWidth);

    gaps.push({
        x:gapX,
        y:newY,
        width:gapWidth,
        height:platformH,
    });

    if (gapX > 20) {
        const p = {
            x:0,
            y:newY,
            width:gapX,
            height:platformH,
            opacity:0,
            spawning:true,
            lifetime:180 + Math.random() * 120,
            age: 0
        };
        platforms.push(p);
    }

    if (gapX + gapWidth < canvas.width - 20) {
        const p = {
            x: gapX + gapWidth,
            y: newY,
            width: canvas.width - (gapX + gapWidth),
            height: platformH,
            opacity: 0,
            spawning: true,
            lifetime: 180 + Math.random() * 120,
            age: 0
        };
        platforms.push(p);
    }

    const currentDiff = diffSettings[sDifficulty];
    if (Math.random() < currentDiff.powerupChance) {
        pwrups.push(createPwr(gapX + gapWidth / 2 - 8, newY - 60));
    }

    const coinChance = 0.3 + (upgrades.luckyDrops.level * 0.06);
    if (Math.random() < coinChance) {
        const numCoins = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numCoins; i++) {
            coinPickups.push({
                x:gapX + Math.random() * gapWidth - 8,
                y:newY - 40 - Math.random() * 60,
                width: 12,
                height:12,
                collected: false,
                pulse: Math.random() * Math.PI * 2,
                value: 1
            });
        }
    }
}

function createPwr(x,y) {
    const types=Object.keys(pwrTypes);
    let totalWeight = types.reduce((sum,t) => sum + pwrTypes[t].rarity,0);
    let random =Math.random()*totalWeight; // /dev/urandom ahh
    let type = types[0];
    for (let t of types) {
        random -= pwrTypes[t].rarity;
        if (random <= 0) {
            type =t;
            break;
        }
    }
    return {x,y,width:16,height:16,type,collected:false,pulse:0};
}

function update() {
    if (screenShake > 0) {
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }
    if (gameState !== 'playing') return;
    if (keys['arrowleft'] || keys['a']) {
        player.vx = -player.moveSpeed;
    } else if (keys['arrowright'] || keys['d']) {
        player.vx = player.moveSpeed;
    } else {
        player.vx *= 0.85;
    }

    difficulty = 1+(depth/500);
    const currentDiff = diffSettings[sDifficulty];
    player.gravity = 0.4*difficulty*currentDiff.gravityMult;
    const minGap = 100 - (difficulty*5);
    const maxGap = 200 - (difficulty*10);

    player.x += player.vx;

    const gravMod = activePwr?.type === 'slow' ? 0.5 : 1;
    player.vy += player.gravity * gravMod;
    player.vy = Math.min(player.vy, player.maxVY);
    player.y += player.vy;

    if (player.x < -player.width) player.x = canvas.width;
    if (player.x > canvas.width) player.x = -player.width;

    player.trail.push({ x: player.x + player.width / 2, y: player.y + player.height / 2 });
    if (player.trail.length > 5) player.trail.shift();

    const targetCameraY = player.y - canvas.height / 3;
    cameraY += (targetCameraY - cameraY) * 0.1;

    const newDepth = Math.max(depth, Math.floor((player.y - 200)/10));
    if (newDepth > depth) {
        const depgain = newDepth- depth;
        const scoreMultiplier = 1 + (upgrades.scoreBoost.level * 0.2);
        const currentDiff = diffSettings[sDifficulty];
        score += depgain * 2 * scoreMultiplier * currentDiff.scoreMult;
        depth = newDepth;
    }

    if (depth >= 100) unlockACH('first100');
    if (depth >= 200 && (Date.now() - startTime) < 60000) unlockACH('speedrun');
    if (combo >= 10) unlockACH('combo10');

    platforms.forEach(p => {
        p.age++;
        if (p.spawning) {
            p.opacity = Math.min(p.opacity + 0.05, 1);
            if (p.opacity >= 1) {
                p.spawning = false;
            }
        }
        if (!p.spawning && p.age > p.lifetime) {
            p.opacity = Math.max(p.opacity - 0.03, 0);
        }
    });

    if (!activePwr || activePwr.type !== 'shield') {
        const playerSize = activePwr?.type === 'shrink' ? 0.6 : 1;
        const pw = player.width * playerSize;
        const ph = player.height * playerSize;
        const px = player.x + (player.width - pw) / 2;
        const py = player.y + (player.height - ph) / 2;

        platforms.forEach(p => {
            if (p.opacity > 0.3 &&
                px + pw > p.x &&
                px < p.x + p.width &&
                py + ph > p.y &&
                py < p.y + p.height) {
                    endGame();
                }
        });
    }

    gaps.forEach(g => {
        if (player.y > g.y && player.y < g.y + 100) {
            const wasAbove = player.y - player.vy <= g.y;
            if (wasAbove && player.x + player.width > g.x && player.x < g.x + g.width) {
                combo++;
                score += 50 + combo * 10;
                if (combo > 1 && combo % 5 === 0) {
                    showCombo(combo);
                }

                if (particles.length < 150) {
                    for (let i = 0; i < 8; i++) {
                        particles.push({
                            x:player.x + player.width/2,
                            y:player.y + player.height/2,
                            vx:(Math.random() - 0.5) * 10,
                            vy: (Math.random() - 0.5) * 10,
                            life: 40,
                            maxLife: 40
                        });
                    }
                }
                g.y = -9999;
            }
        }
    });
    platforms = platforms.filter(p => p.y < cameraY + canvas.height + 200 && p.opacity > 0);
    gaps = gaps.filter(g => g.y < cameraY + canvas.height + 200 && g.y > -1000);

    // ive been having a memory leak for so long and this code fixes it so NOTE TO SELF DONT DELETE THIS
    let lastPlayY = player.y;
    if (platforms.length > 0) {
        lastPlayY = platforms[platforms.length -1].y;
    }
    let genLimit = 0;
    while (lastPlayY < cameraY + canvas.height + 800 && genLimit < 50) {
        genPlat();
        if (platforms.length > 0) {
            lastPlayY = platforms[platforms.length -1].y;
        }
        genLimit++;
    }

    pwrups.forEach(p => {
        p.pulse += 0.1;
        const dist = Math.hypot(player.x + player.width /2 - (p.x+p.width/2),
        player.y + player.height /2 - (p.y + p.height/2));
        if (!p.collected && dist < 30) {
            p.collected = true;

            if (p.type === 'shield') {
                sCollected++;
                if (sCollected >= 5) unlockACH('shield5');
            }

            activePwr = pwrTypes[p.type];
            activePwr.type = p.type;
            const durationBoost = 1+(upgrades.pwDuration.level * 0.5);
            pwrT = Math.floor(activePwr.duration * durationBoost);
            pwrUpEl.textContent = activePwr.name;
            pwrUpEl.classList.add('active');
            if (particles.length < 150) {
                for (let i=0; i<10; i++) {
                    particles.push({
                        x:p.x + p.width /2,
                        y:p.y + p.height/2,
                        vx:(Math.random() - 0.5) * 10,
                        vy:(Math.random() - 0.5) * 10,
                        life: 40,
                        maxLife: 40
                    });
                }
            }
        }
    });

    const magnetRadius = 30 + (upgrades.coinMagnet.level * 15);
    coinPickups.forEach(c => {
        c.pulse += 0.15;
        const dist = Math.hypot(player.x + player.width/2 - (c.x + c.width/2), player.y + player.height/2 - (c.y + c.height/2));
        if (!c.collected && dist < magnetRadius) {
            c.collected = true;
            const currentDiff = diffSettings[sDifficulty];
            const coinValue = Math.floor(c.value * currentDiff.coinMult);
            coins += coinValue;
            coinsTR += coinValue;
            localStorage.setItem('coins', coins);
            if (particles.length < 150) {
                for (let i = 0; i < 5; i++) {
                    particles.push({
                        x:c.x + c.width/2,
                        y:c.y + c.height/2,
                        vx: (Math.random() - 0.5) * 8,
                        vy: (Math.random() - 0.5) * 8,
                        life: 30,
                        maxLife: 30
                    });
                }
            }
        }
    });
    coinPickups = coinPickups.filter(c => c.y < cameraY + canvas.height + 200 && !c.collected);
    pwrups = pwrups.filter(p => p.y < cameraY + canvas.height + 200 && !p.collected);
    if (pwrT > 0) {
        pwrT--;
        if (pwrT === 0) {
            activePwr = null;
            pwrUpEl.classList.remove('active');
            pwrUpEl.textContent = '';
        }
    }

    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);
    if (player.y < cameraY - 50) {
        endGame();
    }
    scoreEl.textContent = Math.floor(score);
    depthEl.textContent = `${depth}m`;
    document.getElementById('coins').textContent = `coins: ${coins}`;
}

function showCombo(c) {
    comboEl.textContent = `${c}x combo!`;
    comboEl.classList.remove('show');
    void comboEl.offsetWidth;
    comboEl.classList.add('show');
    setTimeout(() => {
        comboEl.classList.remove('show');
    },800);
}

if (savedACH) {
    try {
        const parsed = JSON.parse(savedACH);
        Object.keys(parsed).forEach(key => {
            if (achievements[key]) {
                achievements[key].unlocked = parsed[key].unlocked;
            }
        });
    } catch(e) {
        console.error('failed to load achievements :(');
        showNotification('failed to load achievements :(');
    }
}

function showNotification(text) {
    const container = document.getElementById('notifications');
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.textContent = `${text}`;
    container.appendChild(notif);
    setTimeout(() => notif.classList.add('show'),10);
    setTimeout(() => {
        notif.classList.add('hide');
        setTimeout(() => notif.remove(), 300);
    },3000);
}

function unlockACH(key) {
    if (!achievements[key].unlocked) {
        achievements[key].unlocked =true;
        localStorage.setItem('achievements', JSON.stringify(achievements));
        showNotification(achievements[key].name);
    }
}

function draw() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();
    const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
    ctx.translate(shakeX,shakeY-cameraY);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    const gridStart = Math.floor(cameraY / 80) * 80;
    for (let i=0; i < canvas.height / 80+2; i++) {
        const y=gridStart + i * 80;
        ctx.beginPath();
        ctx.moveTo(0,y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    coinPickups.forEach(c => {
        const pulse = Math.sin(c.pulse) * 0.2 + 1;
        ctx.save();
        ctx.translate(c.x + c.width/2, c.y+c.height/2);
        ctx.scale(pulse,pulse);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0,0,c.width/2,0,Math.PI*2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    });

    particles.forEach(p => {
        ctx.fillStyle = `rgba(255,255,255,${p.life / p.maxLife * 0.8})`;
        ctx.fillRect(p.x - 2, p.y - 2, 4,4);
    });

    platforms.forEach(p => {
        ctx.globalAlpha = p.opacity;
        const despawnWarning = p.age>p.lifetime -60;
        if (despawnWarning && !p.spawning) {
            const pulse = Math.sin(p.age * 0.2) * 0.3 + 0.7;
            ctx.globalAlpha = p.opacity * pulse;
        }

        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(p.x, p.y + p.height, p.width, 2);
        ctx.globalAlpha =1;
    });

    pwrups.forEach(p => {
        const pulse = Math.sin(p.pulse)*0.3 + 1;
        ctx.save();
        ctx.translate(p.x + p.width /2, p.y + p.height/2);
        ctx.scale(pulse, pulse);
        ctx.rotate(p.pulse * 0.5);
        ctx.fillStyle = pwrTypes[p.type].color;
        ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth=2;
        ctx.strokeRect(-p.width/2 - 2, -p.height/2-2,p.width+4,p.height +4);
        ctx.restore();
    });

    ctx.globalAlpha=0.3;
    player.trail.forEach((t,i) => {
        const alpha = i / player.trail.length;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
        const size= 20 * alpha;
        ctx.fillRect(t.x - size/2, t.y-size/2, size,size);
    });
    ctx.globalAlpha = 1;

    const playerSize = activePwr?.type === 'shrink'?0.6:1;
    const pw = player.width * playerSize;
    const ph = player.height * playerSize;
    const px = player.x + (player.width -pw)/2;
    const py = player.y + (player.height -ph)/2;

    if (activePwr?.type === 'shield') {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        const pad = 6;
        ctx.strokeRect(px-pad, py-pad, pw+pad*2, ph+pad*2);
    }

    ctx.fillStyle = '#fff';
    ctx.fillRect(px, py, pw, ph);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(px,py+ph,pw,3);
    ctx.restore();
    if (gameState === 'paused') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle= '#fff';
        ctx.font = '600 36px Geist';
        ctx.textAlign = 'center';
        ctx.fillText('paused', canvas.width/2, canvas.height/2);
        ctx.font = '500 14px Geist';
        ctx.fillStyle = '#888';
        ctx.fillText('Press ESC to continue', canvas.width/2,canvas.height/2+40);
    }
}

function endGame() {
    screenShake=15;
    gameState = 'gameover';
    if (score > hScore) {
        hScore = Math.floor(score);
        localStorage.setItem('hscore', hScore);
    }
    document.getElementById('fDepth').textContent = `${depth}m`;
    document.getElementById('fScore').textContent = Math.floor(score);
    document.getElementById('fBest').textContent = hScore;
    document.getElementById('gameover').classList.add('visible');
    document.getElementById('fCoins').textContent = coinsTR;
    document.getElementById('fDifficulty').textContent = diffSettings[sDifficulty].name;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

document.getElementById('hscore').textContent = `best: ${hScore}`;
gameLoop();