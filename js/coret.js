(function(){
  var host = location.hostname;
  var dev = location.protocol === 'file:' || host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || /\.local$/.test(host);
  if(!dev) return;

  var NS = 'http://www.w3.org/2000/svg';
  var on = false;
  var strokes = [];          // tiap stroke = array [x,y] (CSS px)
  var cur = null;            // stroke lagi digambar
  var drawing = false;

  // ---- DOM ----
  var btn = document.createElement('button');
  btn.id = 'crFab';
  btn.textContent = '✏ CORET';
  btn.title = 'Aktifkan mode coret (lingkari layout yang mau diubah)';

  var layer = document.createElement('div');
  layer.id = 'crLayer';
  layer.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:none;cursor:crosshair;background:rgba(0,0,0,.02);';

  var svg = document.createElementNS(NS, 'svg');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;';
  svg.setAttribute('id','crSvg');

  var bar = document.createElement('div');
  bar.id = 'crBar';
  bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483001;display:none;'+
    'gap:8px;align-items:center;font-family:"Barlow Condensed",system-ui,sans-serif;background:rgba(12,14,18,.92);'+
    'border:1px solid #3a4350;border-radius:12px;padding:8px 12px;color:#EAF4FF;box-shadow:0 8px 30px rgba(0,0,0,.5);';

  function mkBtn(txt, color){
    var b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = 'cursor:pointer;font:inherit;font-weight:700;letter-spacing:.04em;padding:6px 12px;border-radius:9px;border:1px solid '+
      (color||'#3a4350')+';background:rgba(255,255,255,.06);color:'+(color||'#EAF4FF')+';';
    return b;
  }
  var undoBtn = mkBtn('↶ UNDO');
  var clrBtn  = mkBtn('✕ BERSIHKAN','#FF4D5E');
  var cpyBtn  = mkBtn('⧉ SALIN LOKASI','#7DF9FF');
  var doneBtn = mkBtn('SELESAI','#6EAC4C');
  var hint = document.createElement('span');
  hint.textContent = 'Lingkari bagian yang mau diubah';
  hint.style.cssText = 'font-size:13px;opacity:.7;margin-right:4px;white-space:nowrap;';
  bar.appendChild(hint); bar.appendChild(undoBtn); bar.appendChild(clrBtn); bar.appendChild(cpyBtn); bar.appendChild(doneBtn);

  document.body.appendChild(btn);
  document.body.appendChild(layer);
  layer.appendChild(svg);
  document.body.appendChild(bar);

  btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483002;cursor:pointer;font-family:"Barlow Condensed",system-ui;'+
    'font-weight:700;font-size:14px;letter-spacing:.06em;padding:6px 12px;border-radius:10px;border:1px solid #7DF9FF;'+
    'background:rgba(12,14,18,.9);color:#7DF9FF;box-shadow:0 4px 16px rgba(0,0,0,.5);';

  // ---- render ulang semua stroke ----
  function redraw(){
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    for(var i=0;i<strokes.length;i++){
      var s = strokes[i];
      if(s.length < 2) continue;
      var pl = document.createElementNS(NS,'polyline');
      pl.setAttribute('points', s.map(function(p){return p[0]+','+p[1];}).join(' '));
      pl.setAttribute('fill','none');
      pl.setAttribute('stroke', s.length < 5 ? 'rgba(255,59,92,.35)' : '#FF3B5C'); // <5 titik = tap, pudar
      pl.setAttribute('stroke-width','3');
      pl.setAttribute('stroke-linecap','round');
      pl.setAttribute('stroke-linejoin','round');
      svg.appendChild(pl);
    }
  }
  function addSeg(a,b){
    var pl = document.createElementNS(NS,'line');
    pl.setAttribute('x1',a[0]); pl.setAttribute('y1',a[1]);
    pl.setAttribute('x2',b[0]); pl.setAttribute('y2',b[1]);
    pl.setAttribute('stroke','#FF3B5C'); pl.setAttribute('stroke-width','3');
    pl.setAttribute('stroke-linecap','round');
    svg.appendChild(pl);
  }

  // ---- pointer (drawing) ----
  function pt(e){ return [Math.round(e.clientX), Math.round(e.clientY)]; }
  layer.addEventListener('pointerdown', function(e){
    if(!on) return;
    drawing = true;
    cur = [pt(e)];
    strokes.push(cur);
    layer.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  layer.addEventListener('pointermove', function(e){
    if(!drawing || !cur) return;
    var p = pt(e);
    var last = cur[cur.length-1];
    if(last && (Math.abs(p[0]-last[0])>1 || Math.abs(p[1]-last[1])>1)){
      cur.push(p);
      addSeg(last, p);
    }
  });
  function endStroke(){
    drawing = false;
    cur = null;
    redraw(); // rapikan (terapkan aturan tap <5)
  }
  layer.addEventListener('pointerup', endStroke);
  layer.addEventListener('pointercancel', endStroke);

  window.addEventListener('resize', redraw);

  // ---- toggle ----
  function setOn(v){
    on = !!v;
    layer.style.display = on ? 'block' : 'none';
    bar.style.display = on ? 'flex' : 'none';
    btn.textContent = on ? '✏ CORET ON' : '✏ CORET';
    btn.style.borderColor = on ? '#FF3B5C' : '#7DF9FF';
    btn.style.color = on ? '#FF3B5C' : '#7DF9FF';
  }
  btn.addEventListener('click', function(){ setOn(!on); });
  undoBtn.addEventListener('click', function(){ strokes.pop(); redraw(); });
  clrBtn.addEventListener('click', function(){ strokes = []; redraw(); });
  doneBtn.addEventListener('click', function(){ setOn(false); });

  // ---- identifikasi elemen DOM di bawah tiap korekan ----
  var IGNORE = [btn, layer, svg, bar];
  function describe(el){
    if(!el || el.nodeType !== 1) return null;
    if(el.namespaceURI === 'http://www.w3.org/2000/svg') return null; // jangan coretan svg sendiri (polyline/line/…)
    var tag = el.tagName.toLowerCase();
    if(tag === 'html' || tag === 'body') return null;
    var out = tag;
    if(el.id) out += '#'+el.id;
    if(el.classList && el.classList.length){
      var cls = [];
      for(var i=0;i<el.classList.length && cls.length<3;i++){
        var c = el.classList[i];
        if(c.indexOf('cr') === 0) continue;      // jangan kelas coret sendiri
        cls.push(c);
      }
      if(cls.length) out += '.'+cls.join('.');
    }
    var t = (el.getAttribute && (el.getAttribute('title')||el.textContent||'')) || '';
    t = (typeof t === 'string' ? t : '').trim().slice(0,24);
    return t ? out+' (“'+t+'”)' : out;
  }
  function targetsAt(x,y){
    var els = document.elementsFromPoint(x,y) || [];
    var res = [];
    for(var i=0;i<els.length;i++){
      if(IGNORE.indexOf(els[i]) >= 0) continue;
      var d = describe(els[i]);
      if(d && res.indexOf(d) < 0) res.push(d);
      if(res.length >= 4) break;
    }
    return res;
  }
  function coretReport(){
    var real = strokes.filter(function(s){ return s.length >= 5; });
    var marks = real.map(function(s){
      var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9, tx=0,ty=0,n=0;
      for(var i=0;i<s.length;i++){
        var p=s[i];
        if(p[0]<minX)minX=p[0]; if(p[0]>maxX)maxX=p[0];
        if(p[1]<minY)minY=p[1]; if(p[1]>maxY)maxY=p[1];
        tx+=p[0]; ty+=p[1]; n++;
      }
      var cxs=Math.round(tx/n), cys=Math.round(ty/n);
      var uniq={}, hits=[];
      // sampling titik stroke + centroid
      for(var j=0;j<s.length;j+=Math.max(1,Math.floor(s.length/12))){
        targetsAt(s[j][0],s[j][1]).forEach(function(t){ if(!uniq[t]){uniq[t]=1;hits.push(t);} });
      }
      targetsAt(cxs,cys).forEach(function(t){ if(!uniq[t]){uniq[t]=1;hits.push(t);} });
      return {
        centroid:[cxs,cys],
        bbox:{x:minX,y:minY,w:maxX-minX,h:maxY-minY},
        points:s.length,
        elements:hits
      };
    });
    var rep = { url:location.href.replace(/[?&]cb=[^&]*/,''), viewport:{w:innerWidth,h:innerHeight}, dpr:Math.round(devicePixelRatio*100)/100, count:marks.length, marks:marks };
    return rep;
  }
  function textify(rep){
    if(!rep.count) return 'Tidak ada korekan valid (< 5 titik diabaikan).';
    return rep.marks.map(function(m,i){
      return '#'+(i+1)+' di ('+m.centroid[0]+','+m.centroid[1]+') box '+m.bbox.w+'×'+m.bbox.h+'px → '+m.elements.join(' | ');
    }).join('\n');
  }
  window.coretReport = function(){ return coretReport(); };
  window.coretText = function(){ return textify(coretReport()); };
  window.coretOn = function(v){ setOn(v===undefined?true:!!v); };

  cpyBtn.addEventListener('click', function(){
    var txt = textify(coretReport());
    var full = JSON.stringify(coretReport(), null, 2);
    window.__coretLast = full;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(full).then(function(){ cpyBtn.textContent='✓ TERSALIN'; },
        function(){ cpyBtn.textContent='⚠ lihat console'; console.log(full); });
    } else {
      cpyBtn.textContent='⚠ console saja'; console.log(full);
    }
    setTimeout(function(){ cpyBtn.textContent='⧉ SALIN LOKASI'; }, 1600);
  });
})();
