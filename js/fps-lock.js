/* ---- GLOBAL FRAME-RATE LOCK ----
   Semua loop JS-driven (partikel lobby, FX battle canvas, camLoop, shared attack
   tick, dll) pakai performance.now() buat ngitung progres, bukan hitung-frame.
   Jadi kalau kita jadwalkan ulang callback-nya pada <= TARGET fps, kecepatan gerak
   tetap akurat — kita cuma ngurangin jumlah gambar per detik (hemat CPU/GPU).
   Callback yang di-schedule bareng di satu native-frame dibangung bersama supaya
   gak ada loop yang "kelaparan" (bukan balapan rebutan slot waktu).
   Toggle: window.__fpsLock.set(0) = lepas (native 60fps), window.__fpsLock.set(30) = kunci.
   CSS animation/transition (shake, sweep, glow) jalan di compositor, TIDAK kena. */
(function(){
  if(window.__fpsLock) return;
  var TARGET=30, MIN=1000/TARGET, enabled=true;
  var _raf=window.requestAnimationFrame.bind(window);
  var _caf=window.cancelAnimationFrame.bind(window);
  var waiting=new Map(), uid=0, running=false, last=0;
  function loop(now){
    if(!enabled || now-last>=MIN || now<last){
      last=now;
      var list=[]; waiting.forEach(function(e){ list.push(e); });
      waiting.clear();
      for(var i=0;i<list.length;i++){ try{ list[i].cb(now); }catch(err){} }
    }
    if(waiting.size){ _raf(loop); } else { running=false; }
  }
  window.requestAnimationFrame=function(cb){
    if(!enabled || typeof cb!=='function') return _raf(cb);
    var h=++uid; waiting.set(h,{cb:cb});
    if(!running){ running=true; _raf(loop); }
    return h;
  };
  window.cancelAnimationFrame=function(h){
    if(waiting.has(h)){ waiting.delete(h); if(!waiting.size) running=false; }
    else _caf(h);
  };
  function applyClass(){
    /* nyalakan throttle CSS (gradien/holo ~30fps) hanya kalau di-lock ke angka rendah */
    var lockCss = enabled && TARGET<=35;
    try{ document.documentElement.classList.toggle('fps-locked', !!lockCss); }catch(e){}
  }
  window.__fpsLock={
    set:function(n){
      if(!n || n<=0 || n>=240){ enabled=false; }
      else { enabled=true; TARGET=n; MIN=1000/n;
        /* flush job yang lagi nunggu biar langsung konsisten sama target baru */
        if(running){ last=0; } }
      applyClass();
      try{ localStorage.setItem('fpsTarget', String(enabled?TARGET:0)); }catch(e){}
    },
    get target(){ return enabled?TARGET:0; }
  };
  /* hormati preferensi tersimpan (0 = lepas) */
  try{ var s=localStorage.getItem('fpsTarget'); if(s!=null){ window.__fpsLock.set(parseInt(s,10)||0); } }catch(e){}
  applyClass();
})();
