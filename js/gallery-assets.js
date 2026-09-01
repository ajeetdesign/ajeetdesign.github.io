/* ── gallery assets ─────────────────────────────────────────────────────────
   Lifted verbatim from curved-gallery.html: the texture size, the four canvas
   helpers, the eight procedural artworks and the PROJECTS array. Nothing here
   is edited — only the trailing export is added, so the module can be imported
   rather than relying on globals in one big script tag. */

const TW = 1152, TH = 712;

function grad(ctx, stops, x0,y0,x1,y1){
  const g = ctx.createLinearGradient(x0,y0,x1,y1);
  stops.forEach(([o,c]) => g.addColorStop(o,c));
  return g;
}
function rgrad(ctx, x,y,r, stops){
  const g = ctx.createRadialGradient(x,y,0,x,y,r);
  stops.forEach(([o,c]) => g.addColorStop(o,c));
  return g;
}
function rr(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function grain(ctx,w,h,n,alpha){
  ctx.save(); ctx.globalAlpha = alpha;
  for(let i=0;i<n;i++){
    ctx.fillStyle = Math.random()>.5 ? '#fff' : '#000';
    ctx.fillRect(Math.random()*w, Math.random()*h, 1.2, 1.2);
  }
  ctx.restore();
}

function drawSolstice(ctx,w,h){
  ctx.fillStyle = grad(ctx, [[0,'#caa87e'],[0.55,'#a97f52'],[1,'#6e4a2c']], 0,0,0,h);
  ctx.fillRect(0,0,w,h);
  for(let i=0;i<7;i++){
    ctx.fillStyle = `rgba(60,38,22,${0.05+i*0.015})`;
    ctx.fillRect(0, h*0.18 + i*26, w, 12);
  }
  ctx.fillStyle = grad(ctx, [[0,'#e8d3b4'],[1,'#8c6a45']], 0,0,120,0);
  ctx.fillRect(w*0.09, h*0.1, 84, h*0.75);
  ctx.fillRect(w*0.82, h*0.1, 84, h*0.75);
  ctx.fillStyle = '#e9dcc4';
  ctx.beginPath(); ctx.ellipse(w/2, h*0.86, w*0.33, h*0.10, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#b69871';
  ctx.beginPath(); ctx.ellipse(w/2, h*0.845, w*0.28, h*0.075, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = rgrad(ctx, w/2, h*0.72, 190, [[0,'#fff3c0'],[0.45,'#ffd45e'],[1,'rgba(255,180,60,0)']]);
  ctx.beginPath(); ctx.arc(w/2, h*0.72, 190, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = rgrad(ctx, w/2-30, h*0.70, 110, [[0,'#fffbe8'],[1,'#ffca55']]);
  ctx.beginPath(); ctx.arc(w/2, h*0.72, 108, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#f6efe2';
  ctx.font = 'italic 300 218px Fraunces, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Solstice', w/2, h*0.5);
  ctx.font = '600 15px Archivo'; ctx.fillStyle='rgba(255,250,240,.85)'; ctx.textAlign='left';
  ctx.fillText('INTRO   WEIGHTS   TEXT   STORY', 40, 44);
  ctx.textAlign='center'; ctx.font='italic 20px Fraunces, serif';
  ctx.fillText('CASA di SOLSTICE', w/2, 46);
  grain(ctx,w,h,2600,.05);
}

function drawFieldStudies(ctx,w,h){
  ctx.fillStyle = '#efece6'; ctx.fillRect(0,0,w,h);
  const cols = 6, rows = 4, gx = 10;
  const cw = (w - gx*(cols+1))/cols, ch = (h - gx*(rows+1))/rows;
  const pals = [
    ['#8fc0a9','#4a7c59'], ['#f3c5c5','#c17f9c'], ['#a9c7e8','#4a6fa5'],
    ['#e8d5a9','#b08d55'], ['#c5e8d5','#5aa77f'], ['#e8a9c7','#a5527f'],
    ['#9fb8ad','#475841'], ['#f0e0c0','#d09a5b'], ['#b0c8f0','#5b7ad0'],
  ];
  let k=0;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const x = gx + c*(cw+gx), y = gx + r*(ch+gx);
    if(c>=3 && c<=4 && r>=1 && r<=2) continue;
    const p = pals[(k++)%pals.length];
    ctx.fillStyle = grad(ctx,[[0,p[0]],[1,p[1]]], x,y,x+cw,y+ch);
    rr(ctx,x,y,cw,ch,6); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.arc(x+cw*0.5, y+ch*0.42, Math.min(cw,ch)*0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.18)';
    ctx.fillRect(x+cw*0.15, y+ch*0.72, cw*0.7, ch*0.14);
  }
  const nx = gx + 3*(cw+gx), ny = gx + 1*(ch+gx);
  const nw = cw*2+gx, nh = ch*2+gx;
  ctx.fillStyle = '#f2c7cf'; rr(ctx,nx,ny,nw,nh,6); ctx.fill();
  ctx.fillStyle = '#3a2430'; ctx.textAlign='center';
  ctx.font = 'italic 500 58px Fraunces, serif';
  ctx.fillText('Field', nx+nw/2, ny+nh*0.40);
  ctx.fillText('Studies', nx+nw/2, ny+nh*0.62);
  ctx.font = '600 12px Archivo';
  ctx.fillText('IMAGE · MOTION · SPATIAL DESIGN', nx+nw/2, ny+nh*0.82);
  grain(ctx,w,h,1500,.04);
}

function drawArchive(ctx,w,h){
  ctx.fillStyle = grad(ctx,[[0,'#f4f4f2'],[1,'#d9d9d5']],0,0,0,h);
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#0d0d0d'; ctx.textAlign='center';
  ctx.font = '600 118px Archivo';
  ctx.fillText('(ARC®V)', w/2, 150);
  ctx.fillText('IDX/2026', w/2, 262);
  const n = 12;
  for(let i=n-1;i>=0;i--){
    const t = i/(n-1);
    const x = w*0.16 + t*w*0.62;
    const y = h*0.72 - t*40;
    const tw = 78 + t*110, th = 110 + t*140;
    ctx.save();
    ctx.translate(x,y); ctx.rotate((t-0.5)*0.14);
    const hue = (i*47)%360;
    ctx.fillStyle = i%3===0 ? '#111' : `hsl(${hue},45%,${30+i*3}%)`;
    ctx.shadowColor='rgba(0,0,0,.35)'; ctx.shadowBlur=18; ctx.shadowOffsetY=8;
    ctx.fillRect(-tw/2,-th/2,tw,th);
    ctx.shadowColor='transparent';
    ctx.fillStyle='rgba(255,255,255,.75)';
    ctx.fillRect(-tw/2+8,-th/2+8,tw-16,10);
    ctx.restore();
  }
  ctx.font='600 13px Archivo'; ctx.fillStyle='#333'; ctx.textAlign='left';
  ctx.fillText('TIMELINE,  SURF,  INDEX,  ABOUT', 34, 40);
  ctx.fillStyle='#c22'; ctx.fillRect(w-190, 26, 18, 12);
  ctx.fillStyle='#333'; ctx.fillText('UP / ALL C', w-160, 37);
}

function drawPlaybook(ctx,w,h){
  ctx.fillStyle = grad(ctx,[[0,'#9fd4e8'],[1,'#c8e8f2']],0,0,0,h);
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(255,255,255,.9)';
  [[150,90,46],[210,80,60],[270,95,42],[880,140,52],[940,128,66],[1005,145,44]].forEach(([x,y,r])=>{
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  });
  ctx.save(); ctx.translate(w*0.72, h*0.30); ctx.rotate(-.03);
  ctx.fillStyle='#e14b3b'; rr(ctx,-190,-70,380,140,8); ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='700 26px Archivo';
  ctx.fillText('SHIP THE DEMO BEFORE', 0, -8);
  ctx.fillText('THE GRID SHUTS DOWN', 0, 26);
  ctx.restore();
  ctx.strokeStyle='#2b3a45'; ctx.lineWidth=3; ctx.fillStyle='#ffffff';
  rr(ctx, w*0.06, h*0.42, 300, 260, 10); ctx.fill(); ctx.stroke();
  ctx.font='700 34px Archivo'; ctx.fillStyle='#c0392b'; ctx.textAlign='left';
  ctx.fillText('HOSPITAL', w*0.06+26, h*0.42+70);
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){
    ctx.strokeRect(w*0.06+30+c*64, h*0.42+100+r*48, 44, 32);
  }
  ctx.save(); ctx.translate(w*0.62, h*0.68); ctx.rotate(.015);
  ctx.fillStyle='#fdfdfb'; ctx.shadowColor='rgba(0,0,0,.25)'; ctx.shadowBlur=22; ctx.shadowOffsetY=10;
  rr(ctx,-250,-120,500,240,10); ctx.fill(); ctx.shadowColor='transparent';
  ctx.fillStyle='#16232b'; ctx.textAlign='left';
  ctx.font='700 20px Archivo'; ctx.fillText('CH.', -215, -60);
  ctx.font='800 84px Archivo'; ctx.fillText('FOUR', -215, 18);
  ctx.font='600 20px Archivo';
  ctx.fillText('Know when to stand up for your', -215, 62);
  ctx.fillText('team — and when to step back', -215, 90);
  ctx.restore();
}

function drawKindWords(ctx,w,h){
  ctx.fillStyle = '#241014'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#e9e2c8'; ctx.textAlign='left';
  ctx.font='300 74px Fraunces, serif'; ctx.fillText('Kind', 60, 120);
  ctx.font='italic 300 74px Fraunces, serif'; ctx.fillText('Words', 60, 200);
  ctx.fillStyle='#c0392b'; rr(ctx, w-250, 44, 190, 52, 4); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='600 17px Archivo'; ctx.textAlign='center';
  ctx.fillText("Let's Connect", w-155, 76);
  const cards = [
    [90, 300, -0.06, '#f2ecd8'], [360, 260, 0.04, '#f6e8b8'],
    [660, 330, -0.03, '#efe0d0'], [420, 470, 0.05, '#c0392b'],
    [830, 480, -0.05, '#f2ecd8'],
  ];
  cards.forEach(([x,y,a,col])=>{
    ctx.save(); ctx.translate(x,y); ctx.rotate(a);
    ctx.fillStyle=col; ctx.shadowColor='rgba(0,0,0,.4)'; ctx.shadowBlur=16; ctx.shadowOffsetY=6;
    rr(ctx,0,0,260,170,4); ctx.fill(); ctx.shadowColor='transparent';
    const dark = col==='#c0392b';
    ctx.fillStyle = dark ? '#fff' : '#5a1f24';
    ctx.font='700 30px Fraunces, serif'; ctx.fillText('“', 16, 40);
    ctx.fillStyle = dark ? 'rgba(255,255,255,.85)' : 'rgba(60,30,30,.8)';
    for(let l=0;l<5;l++) ctx.fillRect(18, 56+l*18, 220 - (l===4?90:l*14), 6);
    ctx.fillRect(18, 148, 90, 5);
    ctx.restore();
  });
  grain(ctx,w,h,2000,.05);
}

function drawNightSwim(ctx,w,h){
  ctx.fillStyle = grad(ctx,[[0,'#060b1e'],[0.6,'#0d1f45'],[1,'#173a6e']],0,0,0,h);
  ctx.fillRect(0,0,w,h);
  for(let i=0;i<160;i++){
    ctx.fillStyle=`rgba(255,255,255,${Math.random()*.7})`;
    ctx.fillRect(Math.random()*w, Math.random()*h*.6, 1.4,1.4);
  }
  ctx.fillStyle = rgrad(ctx, w*0.74, h*0.30, 150, [[0,'#fdf6e0'],[0.5,'#f4e6b8'],[1,'rgba(244,230,184,0)']]);
  ctx.beginPath(); ctx.arc(w*0.74, h*0.30, 150, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#faf2d8'; ctx.beginPath(); ctx.arc(w*0.74, h*0.30, 74, 0, Math.PI*2); ctx.fill();
  for(let i=0;i<26;i++){
    const y = h*0.66 + i*7;
    ctx.fillStyle=`rgba(240,230,190,${0.16 - i*0.005})`;
    const lw = 40 + Math.random()*160;
    ctx.fillRect(w*0.74 - lw/2 + (Math.random()-.5)*80, y, lw, 2);
  }
  ctx.fillStyle='#e8ecf6'; ctx.textAlign='left';
  ctx.font='300 108px Fraunces, serif';
  ctx.fillText('Night', 64, h*0.50);
  ctx.font='italic 300 108px Fraunces, serif';
  ctx.fillText('Swim', 64, h*0.66);
  ctx.font='600 13px Archivo'; ctx.fillStyle='rgba(232,236,246,.7)';
  ctx.fillText('A MIDNIGHT BATHING CLUB — EST. 2026', 66, h*0.74);
}

function drawMonolith(ctx,w,h){
  ctx.fillStyle = '#141414'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(232,230,225,.5)';
  for(let i=0;i<14;i++){
    ctx.lineWidth = 1 + (i%4===0 ? 1.4 : 0);
    ctx.globalAlpha = 0.16 + (i/14)*0.5;
    ctx.beginPath(); ctx.arc(w/2, h*1.25, 140 + i*46, Math.PI*1.12, Math.PI*1.88); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad(ctx,[[0,'#2e2e2e'],[1,'#0a0a0a']], w/2-70,0,w/2+70,0);
  ctx.fillRect(w/2-70, h*0.24, 140, h*0.62);
  ctx.fillStyle='rgba(255,255,255,.08)'; ctx.fillRect(w/2-70, h*0.24, 8, h*0.62);
  ctx.fillStyle='#e8e6e1'; ctx.textAlign='center';
  ctx.font='600 20px Archivo';
  ctx.fillText('M O N O L I T H', w/2, h*0.16);
  ctx.font='italic 300 26px Fraunces, serif'; ctx.fillStyle='rgba(232,230,225,.6)';
  ctx.fillText('an audio-reactive installation', w/2, h*0.94);
}

function drawTerra(ctx,w,h){
  ctx.fillStyle = grad(ctx,[[0,'#dfe8d0'],[1,'#87a06a']],0,0,0,h);
  ctx.fillRect(0,0,w,h);
  for(let i=0;i<6;i++){
    const y = h*0.36 + i*62;
    ctx.fillStyle = `hsl(${96 - i*4}, ${34+i*4}%, ${58 - i*6}%)`;
    ctx.beginPath();
    ctx.moveTo(0, y+40);
    for(let x=0;x<=w;x+=40) ctx.lineTo(x, y + Math.sin(x*0.004 + i)*26);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle='#20301a'; ctx.textAlign='center';
  ctx.font='300 128px Fraunces, serif';
  ctx.fillText('Terra', w/2, h*0.28);
  ctx.font='600 13px Archivo';
  ctx.fillText('REGENERATIVE FARMING COLLECTIVE — VOL. II', w/2, h*0.35);
  grain(ctx,w,h,1600,.04);
}

const PROJECTS = [
  { title:'Casa di Solstice', year:'2026', tags:['Type Specimen','WebGL'], draw:drawSolstice,
    desc:'A typeface microsite built as a warm architectural sanctuary — a glowing orb, editorial serif at monumental scale, and scroll-driven light.' },
  { title:'Field Studies', year:'2025', tags:['Portfolio','Moodboard'], draw:drawFieldStudies,
    desc:'A living moodboard for a spatial designer: a dense grid of studies that reflows and breathes as you browse.' },
  { title:'Archive Index', year:'2026', tags:['Editorial','Archive'], draw:drawArchive,
    desc:'A stark annual index. Oversized grotesk headlines with a fan of artefacts receding into perspective.' },
  { title:'The Playbook', year:'2025', tags:['Illustrated','Storytelling'], draw:drawPlaybook,
    desc:'An illustrated field guide for team leads — hand-drawn chapters, panoramic scenes and playful copy.' },
  { title:'Kind Words', year:'2024', tags:['Microsite','Brand'], draw:drawKindWords,
    desc:'A wall of client notes pinned in a dark room. Cards shuffle, tilt and settle with spring physics.' },
  { title:'Night Swim', year:'2025', tags:['Campaign','3D'], draw:drawNightSwim,
    desc:'A midnight bathing club. Moonlit water shaders, thin serif titling, and a slow, tidal scroll rhythm.' },
  { title:'Monolith', year:'2024', tags:['Installation','Audio'], draw:drawMonolith,
    desc:'An audio-reactive installation piece; concentric arcs pulse against a standing slab of light.' },
  { title:'Terra Vol. II', year:'2026', tags:['Editorial','Print + Web'], draw:drawTerra,
    desc:'The second volume for a regenerative farming collective — terraced landscapes rendered as flowing layers.' },
];

export { PROJECTS, TW, TH };
