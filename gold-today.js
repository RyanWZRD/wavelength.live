(()=>{
  const status=document.getElementById('goldTodayStatus');
  if(!status)return;
  const price=document.getElementById('goldTodayPrice');
  const detail=document.getElementById('goldTodayDetail');
  const updated=document.getElementById('goldTodayUpdated');
  const esc=s=>String(s??'—').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const fmt=(v,d=2)=>(v==null||Number.isNaN(Number(v)))?'—':Number(v).toFixed(d);
  const when=s=>{if(!s)return'—';const d=new Date(s);return Number.isNaN(d.getTime())?esc(s):d.toLocaleString([],{dateStyle:'medium',timeStyle:'short'});};
  async function load(){
    try{
      const [tr,qr]=await Promise.all([
        fetch(`ig-mt4-manual-demo-ticket.json?ts=${Date.now()}`,{cache:'no-store'}),
        fetch(`ig-gold-quote.json?ts=${Date.now()}`,{cache:'no-store'})
      ]);
      if(!tr.ok)throw new Error(`ticket HTTP ${tr.status}`);
      const p=await tr.json(),q=qr.ok?await qr.json():{},t=p.ticket||{};
      const direction=String(t.direction||'').toUpperCase();
      const quality=String(t.entry_quality||'—').toUpperCase();
      const hasSignal=direction==='LONG'||direction==='SHORT';
      const noSignal=!hasSignal||quality==='NO_ENTRY';
      const ready=p.status==='PASS_MANUAL_DEMO_READY';
      status.textContent=ready?'READY · MANUAL DEMO':noSignal?'FLAT · MONITORING':'SIGNAL · CHECK TICKET';
      status.className='badge '+(ready?'good':noSignal?'':'warn');
      price.textContent=q.mid==null?'—':fmt(q.mid,2);
      detail.textContent=hasSignal?`${direction} · ${quality}`:'No qualifying Gold setup';
      updated.textContent=`Updated ${when(p.generated_at)}`;
    }catch(err){
      status.textContent='UNAVAILABLE';
      status.className='badge warn';
      price.textContent='—';
      detail.textContent='Gold feed unavailable';
      updated.textContent=err.message;
    }
  }
  load();
  setInterval(load,30000);
})();
