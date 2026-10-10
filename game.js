(() => {
  "use strict";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = id => document.getElementById(id);
  const ENTRY_FEE = 5;
  const STORAGE_KEY = "carrotTrialsSaveV1";
  // When embedded in another game/site, the parent can be the source of truth for carrots.
  const EMBEDDED = (() => { try { return window.parent !== window || new URLSearchParams(location.search).has("embed"); } catch { return false; } })();
  let externalWallet = false;
  let parentOrigin = "*"; // Integrators should validate event.origin on the parent side.
  function sendToHost(type, payload = {}) {
    if (!EMBEDDED) return;
    try { window.parent.postMessage({ channel: "CARROT_TRIALS", type, ...payload }, parentOrigin); } catch (_) {}
  }
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { saved = {}; }
  let carrots = Number.isFinite(saved.carrots) ? saved.carrots : 25;
  let best = Number.isFinite(saved.best) ? saved.best : 0;
  let topStage = Number.isFinite(saved.topStage) ? saved.topStage : 0;
  let state = "menu", score = 0, stage = 1, speed = 6.3, frame = 0, spawnIn = 60;
  let obstacles = [], particles = [], carrotsInRun = [], runFrames = 0, stageProgress = 0;
  const groundY = 390;
  const rabbit = { x: 130, y: groundY - 58, w: 48, h: 58, vy: 0, grounded: true, ducking: false };
  const GRAVITY = .72, JUMP = -13.7;
  let lastTime = 0, accumulator = 0;
  const STEP = 1000 / 60;

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ carrots, best, topStage }));
    $("balance").textContent = carrots;
    $("best").textContent = best;
    $("record-line").textContent = topStage ? `Stage ${String(topStage).padStart(2,"0")} reached · Best score ${best}` : "No run completed yet.";
  }
  function updateHUD() {
    $("stage").textContent = String(stage).padStart(2,"0");
    $("score").textContent = Math.floor(score);
    $("difficulty").textContent = stage < 3 ? "HARD" : stage < 7 ? "BRUTAL" : "WILD";
    persist();
  }
  function showOverlay(kicker, title, copy, button, note) {
    $("overlay-kicker").textContent = kicker;
    $("overlay-title").textContent = title;
    $("overlay-copy").textContent = copy;
    $("play-btn").innerHTML = `${button} <span>→</span>`;
    $("overlay-note").textContent = note;
    $("entry-cost").textContent = ENTRY_FEE;
    $("overlay").classList.remove("hidden");
  }
  function startRun() {
    if (carrots < ENTRY_FEE) {
      showOverlay("EMPTY POCKETS", "You need more carrots.", `A run costs ${ENTRY_FEE} carrots. Clear a stage to earn a bonus, or practice your timing before your next attempt.`, "TRY AGAIN", "Your carrot balance is saved on this device.");
      $("play-btn").onclick = startRun;
      return;
    }
    carrots -= ENTRY_FEE;
    state = "playing"; score = 0; stage = 1; speed = 6.3; frame = 0; spawnIn = 55;
    obstacles = []; particles = []; carrotsInRun = []; runFrames = 0; stageProgress = 0;
    rabbit.y = groundY - rabbit.h; rabbit.vy = 0; rabbit.grounded = true; rabbit.ducking = false;
    $("overlay").classList.add("hidden");
    $("play-btn").onclick = startRun;
    updateHUD();
  }
  function endRun() {
    if (state !== "playing") return;
    state = "over";
    best = Math.max(best, Math.floor(score));
    topStage = Math.max(topStage, stage);
    // Early losses only return the entry fee: no net carrot gain.
    if (stage === 1 && score < 120) {
      carrots += ENTRY_FEE;
      sendToHost("CARROT_BALANCE", { balance: carrots, delta: ENTRY_FEE, reason: "early_loss_refund" });
    }
    persist();
    const early = stage === 1 && score < 120;
    showOverlay(early ? "THE BURROW RESET" : "RUN OVER", early ? "A narrow escape." : "The forest got you.", early
      ? `You fell before proving yourself. Your ${ENTRY_FEE}-carrot entry fee was returned — no profit this time. Learn the pattern and try again.`
      : `You reached Stage ${String(stage).padStart(2,"0")} and scored ${Math.floor(score)}. Clear a stage to earn carrots; survival alone does not pay.`, "RUN IT BACK", "Tip: jump late, not early. Watch the shape of each obstacle.");
    $("play-btn").onclick = startRun;
  }
  function jump() {
    if (state !== "playing") return;
    if (rabbit.grounded) {
      rabbit.vy = JUMP; rabbit.grounded = false; rabbit.ducking = false;
      burst(rabbit.x + 20, rabbit.y + rabbit.h, "#b7f397", 5);
    }
  }
  function duck() {
    if (state === "playing" && rabbit.grounded) rabbit.ducking = true;
  }
  function burst(x,y,color,n) {
    for(let i=0;i<n;i++) particles.push({x,y,vx:(Math.random()-.5)*4,vy:-Math.random()*3-1,life:24,color});
  }
  function spawnObstacle() {
    // Every stage mixes hazards, with more enemy types and tighter spacing over time.
    const roll = Math.random();
    let type;
    if (stage >= 5 && roll < .16) type = "fox";
    else if (stage >= 3 && roll < .34) type = "wasp";
    else if (roll < .49) type = "stump";
    else if (roll < .73) type = "spikes";
    else if (roll < .88) type = "bird";
    else type = "slime";

    if (type === "bird" || type === "wasp") {
      obstacles.push({type, x:canvas.width+30, y:groundY-(type==="wasp" ? (Math.random()<.5?75:115) : (Math.random()<.5?82:125)), w:type==="wasp"?34:46, h:type==="wasp"?30:25, passed:false, phase:Math.random()*6});
    } else if (type === "fox") {
      obstacles.push({type,x:canvas.width+30,y:groundY-48,w:53,h:48,passed:false,phase:Math.random()*6});
    } else if (type === "slime") {
      obstacles.push({type,x:canvas.width+30,y:groundY-29,w:34,h:29,passed:false,phase:Math.random()*6});
    } else if (type === "spikes") {
      obstacles.push({type,x:canvas.width+30,y:groundY-26,w:50+Math.random()*22,h:26,passed:false});
    } else {
      obstacles.push({type,x:canvas.width+30,y:groundY-40,w:32+Math.random()*12,h:40,passed:false});
    }
    // Carrot pickups are deliberately placed near danger, so they require a real risk/reward choice.
    if (Math.random() < .19) carrotsInRun.push({x:canvas.width+125,y:groundY-85-Math.random()*70,r:11});
  }
  function collides(a,b) {
    const pad = 7;
    return a.x+pad < b.x+b.w-pad && a.x+a.w-pad > b.x+pad && a.y+pad < b.y+b.h-pad && a.y+a.h-pad > b.y+pad;
  }
  function update() {
    if (state !== "playing") { frame++; updateParticles(); return; }
    frame++; runFrames++;
    const ramp = Math.floor(score / 220);
    speed = Math.min(12.8, 6.3 + ramp * .38 + (stage-1)*.18);
    rabbit.vy += GRAVITY;
    rabbit.y += rabbit.vy;
    if (rabbit.y + rabbit.h >= groundY) { rabbit.y = groundY-rabbit.h; rabbit.vy = 0; rabbit.grounded = true; }
    const spawnMin = Math.max(33, 59 - stage*2 - ramp);
    spawnIn--;
    if (spawnIn <= 0) { spawnObstacle(); spawnIn = spawnMin + Math.random()*26; }
    for (const o of obstacles) {
      o.x -= speed;
      if (o.type === "bird" || o.type === "wasp") o.y += Math.sin((frame+o.x)*.055 + (o.phase||0))*(o.type==="wasp" ? 1.15 : .55);
      if (o.type === "fox") o.y = groundY - 48 + Math.sin((frame+o.x)*.08+(o.phase||0))*2;
      if (!o.passed && o.x+o.w < rabbit.x) {
        o.passed = true; score += 12; stageProgress += 12;
      }
      const rh = rabbit.ducking && rabbit.grounded ? 31 : rabbit.h;
      const ry = rabbit.ducking && rabbit.grounded ? groundY-rh : rabbit.y;
      if (collides({x:rabbit.x,y:ry,w:rabbit.w,h:rh},o)) { endRun(); return; }
    }
    obstacles = obstacles.filter(o=>o.x+o.w>-10);
    for (const c of carrotsInRun) {
      c.x -= speed;
      if (!c.got && collides({x:rabbit.x,y:rabbit.y,w:rabbit.w,h:rabbit.h},{x:c.x-c.r,y:c.y-c.r,w:c.r*2,h:c.r*2})) {
        c.got=true; score += 18; burst(c.x,c.y,"#ff9c54",8);
      }
    }
    carrotsInRun = carrotsInRun.filter(c=>c.x>-30&&!c.got);
    score += .075;
    if (stageProgress >= 160) {
      stage++; stageProgress = 0; carrots += 2 + Math.min(3,Math.floor(stage/4));
      burst(480,120,"#b7f397",18); updateHUD();
    }
    if (Math.floor(score)>best) best=Math.floor(score);
    updateParticles();
    if (frame % 6 === 0) updateHUD();
  }
  function updateParticles() {
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.life--;});
    particles=particles.filter(p=>p.life>0);
  }
  function drawBackground() {
    const biome = (stage - 1) % 5;
    const palettes = [
      ["#1c3a2c","#10221b","#254b37","#1b3829","#385d3d","#8fbd69"], // Clover Woods
      ["#443322","#201b19","#705034","#493a2b","#67513b","#d0a66c"], // Amber Caves
      ["#172e45","#101c31","#254f6a","#1b3a50","#315a66","#7fc6c0"], // Moonlit Marsh
      ["#482b3b","#241928","#6b3b50","#48283e","#60344a","#db8e9b"], // Berry Thicket
      ["#35304f","#17182c","#50466f","#302b4c","#4a4265","#b5a1f2"]  // Dreaming Burrow
    ];
    const p = palettes[biome];
    const g=ctx.createLinearGradient(0,0,0,480);g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);ctx.fillStyle=g;ctx.fillRect(0,0,960,480);
    ctx.fillStyle=biome===2?"#d5f2ff":"#d6efb8";ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(800,75,24,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=p[2];ctx.beginPath();ctx.moveTo(0,300);for(let x=0;x<=960;x+=80)ctx.lineTo(x,260+Math.sin(x*.012+frame*.003)*28);ctx.lineTo(960,400);ctx.lineTo(0,400);ctx.fill();
    ctx.fillStyle=p[3];ctx.beginPath();ctx.moveTo(0,345);for(let x=0;x<=960;x+=60)ctx.lineTo(x,320+Math.sin(x*.018+1+frame*.004)*22);ctx.lineTo(960,420);ctx.lineTo(0,420);ctx.fill();
    for(let i=0;i<16;i++){const x=(i*73-frame*(.25+i%3*.08)+1100)%960;const y=65+(i*47)%220;ctx.fillStyle=i%3===0?"#ffb76b":"#b7f397";ctx.globalAlpha=.25+.25*Math.sin(frame*.06+i);ctx.fillRect(x,y,3,3);ctx.globalAlpha=1;}
    ctx.fillStyle=p[4];ctx.fillRect(0,groundY,960,90);ctx.fillStyle=p[5];ctx.fillRect(0,groundY,960,5);
    ctx.strokeStyle=p[5];ctx.lineWidth=2;for(let x=-(frame*speed*.7%48);x<960;x+=48){ctx.beginPath();ctx.moveTo(x,groundY+23);ctx.lineTo(x+17,groundY+32);ctx.lineTo(x+27,groundY+24);ctx.stroke();}
    const names=["CLOVER WOODS","AMBER CAVES","MOONLIT MARSH","BERRY THICKET","DREAMING BURROW"];
    ctx.fillStyle="#ffffff88";ctx.font="11px monospace";ctx.fillText(names[biome],790,28);
  }
  function drawRabbit() {
    const duck = rabbit.ducking && rabbit.grounded;
    const x=rabbit.x,y=duck?groundY-34:rabbit.y;
    // shadow
    ctx.fillStyle="#09150f88";ctx.beginPath();ctx.ellipse(x+25,groundY+2,duck?30:25,6,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle="#f4f0df";
    if(duck){ctx.beginPath();ctx.ellipse(24,22,26,14,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(42,13,13,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e5a6a4";ctx.beginPath();ctx.ellipse(39,1,5,12,-.2,0,Math.PI*2);ctx.fill();}
    else {
      ctx.beginPath();ctx.ellipse(24,38,19,20,-.15,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(31,20,16,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#f4f0df";ctx.beginPath();ctx.ellipse(24,4,6,19,-.18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e5a6a4";ctx.beginPath();ctx.ellipse(24,4,2.5,13,-.18,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#f4f0df";ctx.beginPath();ctx.ellipse(39,5,5,15,.28,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e5a6a4";ctx.beginPath();ctx.ellipse(39,5,2,10,.28,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#19271e";ctx.beginPath();ctx.arc(37,18,2.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(38,17,1,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#f4f0df";ctx.beginPath();ctx.ellipse(13,48,9,5,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(31,50,9,5,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function drawObstacles() {
    for(const o of obstacles){
      if(o.type==="stump"){ctx.fillStyle="#7e593b";ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle="#b68b5b";ctx.fillRect(o.x+4,o.y+5,o.w-8,5);ctx.strokeStyle="#533c2c";ctx.strokeRect(o.x+5,o.y+15,o.w-10,10);}
      else if(o.type==="spikes"){ctx.fillStyle="#ff9c54";ctx.beginPath();const n=Math.floor(o.w/15);for(let i=0;i<n;i++){ctx.moveTo(o.x+i*15,o.y+o.h);ctx.lineTo(o.x+i*15+7.5,o.y);ctx.lineTo(o.x+i*15+15,o.y+o.h);}ctx.fill();ctx.fillStyle="#f6d39a";ctx.fillRect(o.x,o.y+o.h-3,o.w,3);}
      else if(o.type==="bird"){ctx.fillStyle="#b8c6a5";ctx.beginPath();ctx.ellipse(o.x+23,o.y+13,22,11,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#26392b";ctx.beginPath();ctx.arc(o.x+31,o.y+11,2,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#8b9b7c";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(o.x+12,o.y+8);ctx.lineTo(o.x+3,o.y-2);ctx.moveTo(o.x+29,o.y+8);ctx.lineTo(o.x+39,o.y-2);ctx.stroke();}
      else if(o.type==="wasp"){ctx.fillStyle="#f5d45f";ctx.beginPath();ctx.ellipse(o.x+17,o.y+17,13,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#26392b";ctx.fillRect(o.x+10,o.y+9,4,16);ctx.fillRect(o.x+20,o.y+9,4,16);ctx.fillStyle="#d8f4f0aa";ctx.beginPath();ctx.ellipse(o.x+12,o.y+5,8,4,-.5,0,Math.PI*2);ctx.ellipse(o.x+25,o.y+5,8,4,.5,0,Math.PI*2);ctx.fill();}
      else if(o.type==="slime"){ctx.fillStyle="#9fe38c";ctx.beginPath();ctx.ellipse(o.x+17,o.y+17,17,13+Math.sin(frame*.2+(o.phase||0))*2,0,Math.PI,0);ctx.lineTo(o.x+34,o.y+28);ctx.lineTo(o.x,o.y+28);ctx.closePath();ctx.fill();ctx.fillStyle="#203327";ctx.fillRect(o.x+9,o.y+13,3,4);ctx.fillRect(o.x+23,o.y+13,3,4);}
      else if(o.type==="fox"){ctx.fillStyle="#df8750";ctx.beginPath();ctx.ellipse(o.x+26,o.y+30,24,14,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(o.x+38,o.y+17,13,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f6e8c9";ctx.beginPath();ctx.moveTo(o.x+38,o.y+22);ctx.lineTo(o.x+51,o.y+27);ctx.lineTo(o.x+39,o.y+30);ctx.fill();ctx.fillStyle="#2b211d";ctx.beginPath();ctx.arc(o.x+42,o.y+15,2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#df8750";ctx.beginPath();ctx.moveTo(o.x+30,o.y+7);ctx.lineTo(o.x+32,o.y-5);ctx.lineTo(o.x+39,o.y+7);ctx.fill();}
    }
    for(const c of carrotsInRun){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(.35);ctx.fillStyle="#ff9c54";ctx.beginPath();ctx.moveTo(-7,-10);ctx.lineTo(7,-10);ctx.lineTo(0,13);ctx.closePath();ctx.fill();ctx.fillStyle="#b7f397";ctx.beginPath();ctx.ellipse(-3,-13,4,7,-.5,0,Math.PI*2);ctx.ellipse(4,-14,4,7,.5,0,Math.PI*2);ctx.fill();ctx.restore();}
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/24);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);ctx.globalAlpha=1;}
  }
  function draw() {
    drawBackground();drawObstacles();drawRabbit();
    if(state==="playing" && stageProgress>0){
      ctx.fillStyle="#0a1a12aa";ctx.fillRect(20,20,155,32);ctx.fillStyle="#b7f397";ctx.fillRect(25,39,Math.min(140,stageProgress/160*140),4);
      ctx.fillStyle="#eaf4e2";ctx.font="12px monospace";ctx.fillText(`STAGE ${String(stage).padStart(2,"0")} · CLEAR THE GAUNTLET`,28,33);
    }
  }
  function loop(now) {
    const delta=Math.min(100,now-lastTime||STEP);lastTime=now;accumulator+=delta;
    while(accumulator>=STEP){update();accumulator-=STEP;}
    draw();requestAnimationFrame(loop);
  }
  function handleKey(e) {
    if(["Space","ArrowUp","ArrowDown"].includes(e.code)) e.preventDefault();
    if(e.code==="Space"||e.code==="ArrowUp") { if(state==="playing") jump(); }
    if(e.code==="ArrowDown") duck();
  }
  document.addEventListener("keydown",handleKey);
  document.addEventListener("keyup",e=>{if(e.code==="ArrowDown")rabbit.ducking=false;});
  canvas.addEventListener("pointerdown",()=>{if(state==="playing")jump();});
  $("play-btn").addEventListener("click",startRun);
  $("reset-btn").addEventListener("click",()=>{
    if(confirm("Reset your local carrot balance and records?")){carrots=25;best=0;topStage=0;persist();state="menu";showOverlay("THE BURROW IS CALLING","Ready for the Carrot Trials?","Your progress has been reset. Enter the trials when you're ready.","ENTER THE TRIALS","Keyboard: Space / ↑ to jump · Tap the game to jump");$("play-btn").onclick=startRun;}
  });
  persist();
  showOverlay("THE BURROW IS CALLING","Ready for the Carrot Trials?","Jump over traps, survive each stage, and earn carrots. This run starts hard — there are no easy opening levels.","ENTER THE TRIALS","Keyboard: Space / ↑ to jump · Tap the game to jump");
  requestAnimationFrame(loop);
})();