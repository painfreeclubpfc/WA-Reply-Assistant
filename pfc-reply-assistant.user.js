// ==UserScript==
// @name         PFC Reply Assistant
// @namespace    pfc.painfreeclub
// @version      0.4.0
// @description  Bruno on WhatsApp Web — command-first reply drafts (approved + AI) plus a searchable Library of PFC polls, challenges and messages. Drafts only; you review & press send.
// @match        https://web.whatsapp.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      __PROXY_HOST__
// @updateURL    __PROXY_BASE__/pfc-reply-assistant.user.js
// @downloadURL  __PROXY_BASE__/pfc-reply-assistant.user.js
// ==/UserScript==
(function () {
  "use strict";
  if (window.__pfcAssistantLoaded) return;
  window.__pfcAssistantLoaded = true;

  let PROXY_BASE = "__PROXY_BASE__";
  const FAQ = __FAQ_JSON__;
  const LIBRARY = __LIBRARY_JSON__;

  const SETTINGS = {
    minScore: 1,
    sharedSecret: GM_getValue("pfc_secret", ""),
  };

  // ---- menu ---------------------------------------------------------------
  GM_registerMenuCommand("PFC: set AI proxy URL", () => {
    const v = prompt("AI proxy URL (Cloudflare Worker). Blank = no AI:", PROXY_BASE || "");
    if (v !== null) { PROXY_BASE = v.trim().replace(/\/+$/, ""); GM_setValue("pfc_proxy_url", PROXY_BASE); alert("Saved. Reload WhatsApp Web."); }
  });
  GM_registerMenuCommand("PFC: set shared secret (optional)", () => {
    const v = prompt("Shared secret (blank if none):", SETTINGS.sharedSecret || "");
    if (v !== null) { SETTINGS.sharedSecret = v.trim(); GM_setValue("pfc_secret", SETTINGS.sharedSecret); alert("Saved."); }
  });
  PROXY_BASE = GM_getValue("pfc_proxy_url", PROXY_BASE);

  // ---- helpers ------------------------------------------------------------
  function el(tag, cls, txt){ const e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }
  function normalize(s){ return (s||"").toLowerCase().replace(/[‘’ʼ]/g,"'").replace(/[^a-z0-9'\s]/g," ").replace(/\s+/g," ").trim(); }

  // ---- matcher (approved answers) ----------------------------------------
  function match(text){
    const p=" "+normalize(text)+" "; const m=[];
    for(const it of FAQ.intents||[]){ let sc=0; for(const t of it.triggers||[]){ const n=normalize(t); if(n&&p.indexOf(" "+n+" ")!==-1)sc+=n.split(" ").filter(Boolean).length; } if(sc>=(SETTINGS.minScore||1))m.push({intent:it,score:sc}); }
    if(!m.length)return null;
    const pr=m.filter(x=>(x.intent.priority||0)>=90).sort((a,b)=>(b.intent.priority||0)-(a.intent.priority||0)||b.score-a.score);
    if(pr.length)return pr[0];
    m.sort((a,b)=>b.score-a.score||(b.intent.priority||0)-(a.intent.priority||0)); return m[0];
  }

  // ---- read chat ----------------------------------------------------------
  function chatTitle(){ const h=document.querySelector('#main header [title]')||document.querySelector('#main header span[dir="auto"]'); return h?(h.getAttribute("title")||h.textContent||"").trim():""; }
  function cleanTime(t){ return (t||"").replace(/\s*\b\d{1,2}:\d{2}\s?(?:am|pm)?\.?$/i,"").trim(); }
  function textOf(node){
    if(!node)return "";
    const span=node.querySelector&&(node.querySelector("span.selectable-text")||node.querySelector('span[dir="ltr"]')||node.querySelector('span[dir="auto"]'));
    return cleanTime((span?span.innerText||span.textContent:node.innerText||node.textContent)||"");
  }
  function getLatestIncoming(){
    const scope=document.querySelector("#main")||document;
    const tries=["div.message-in",'[data-pre-plain-text]',"span.selectable-text",'[role="row"]'];
    let nodes=[];
    for(const sel of tries){ const n=scope.querySelectorAll(sel); if(n.length){nodes=n;break;} }
    if(nodes.length){
      for(let i=nodes.length-1;i>=0;i--){ const n=nodes[i]; if(n.closest&&n.closest(".message-out"))continue; const t=textOf(n); if(t)return t; }
      const t=textOf(nodes[nodes.length-1]); if(t)return t;
    }
    return "";
  }

  // ---- insert into compose ------------------------------------------------
  function composeBox(){ return document.querySelector('#main footer div[contenteditable="true"]')||document.querySelector('div[contenteditable="true"][data-tab="10"]')||document.querySelector('#main div[contenteditable="true"]'); }
  function insertText(text){
    const box=composeBox(); if(!box)return false; box.focus();
    try{ const dt=new DataTransfer(); dt.setData("text/plain",text); box.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true})); if(box.textContent&&box.textContent.length)return true; }catch(_){}
    try{ document.execCommand("insertText",false,text); return true; }catch(_){ return false; }
  }

  // ---- AI -----------------------------------------------------------------
  function composeWithAI(message){
    return new Promise((resolve,reject)=>{
      const headers={"Content-Type":"application/json"}; if(SETTINGS.sharedSecret)headers["x-pfc-key"]=SETTINGS.sharedSecret;
      GM_xmlhttpRequest({method:"POST",url:PROXY_BASE+"/compose",headers,data:JSON.stringify({message}),timeout:25000,
        onload:r=>{try{resolve(JSON.parse(r.responseText));}catch(e){reject(e);}},onerror:()=>reject(new Error("network")),ontimeout:()=>reject(new Error("timeout"))});
    });
  }

  // ---- styles -------------------------------------------------------------
  const NAVY="#0F3D56", ORANGE="#F59E0B";
  const st=document.createElement("style");
  st.textContent = `
    #pfc-panel{position:fixed;right:20px;bottom:20px;width:380px;max-width:calc(100vw - 24px);
      background:#fff;color:#1f2d3a;border:1px solid #d7e0e6;border-radius:12px;
      box-shadow:0 10px 30px rgba(0,0,0,.22);font:13px -apple-system,"Segoe UI",Roboto,Arial;
      z-index:2147483000;overflow:hidden}
    #pfc-panel.collapsed .p-body{display:none}
    #pfc-panel .p-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:${NAVY};color:#fff;cursor:grab;user-select:none;touch-action:none}
    #pfc-panel .p-head:active{cursor:grabbing}
    #pfc-panel .p-title{font-weight:700;letter-spacing:.2px}
    #pfc-panel .p-spacer{flex:1}
    #pfc-panel .p-icon{background:rgba(255,255,255,.16);border:0;color:#fff;width:24px;height:24px;border-radius:6px;font-size:15px;line-height:1;cursor:pointer}
    #pfc-panel .p-icon:hover{background:rgba(255,255,255,.28)}
    #pfc-panel .p-tabs{display:flex;gap:0;border-bottom:1px solid #e6edf1}
    #pfc-panel .p-tab{flex:1;background:#f6f8fa;border:0;border-bottom:2px solid transparent;padding:9px;font:inherit;font-weight:600;color:#5b6b78;cursor:pointer}
    #pfc-panel .p-tab.on{background:#fff;color:${NAVY};border-bottom-color:${ORANGE}}
    #pfc-panel .p-pane{padding:10px 12px}
    #pfc-panel .p-detected{color:#6b7a87;font-size:11px;margin-bottom:4px}
    #pfc-panel .p-status{color:${NAVY};font-size:11.5px;min-height:15px;margin-bottom:6px}
    #pfc-panel textarea.p-ta{width:100%;box-sizing:border-box;min-height:96px;border:1px solid #d7e0e6;border-radius:8px;padding:8px;font:inherit;color:#1f2d3a;resize:vertical}
    #pfc-panel .p-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    #pfc-panel .p-btn{border:1px solid #cdd8df;background:#f2f5f7;color:#1f2d3a;border-radius:8px;padding:7px 10px;font:inherit;cursor:pointer}
    #pfc-panel .p-btn:hover{background:#e9eef1}
    #pfc-panel .p-btn.primary{background:${NAVY};border-color:${NAVY};color:#fff;font-weight:600}
    #pfc-panel .p-search{width:100%;box-sizing:border-box;border:1px solid #d7e0e6;border-radius:8px;padding:8px 10px;font:inherit;margin-bottom:8px}
    #pfc-panel .p-list{max-height:52vh;overflow:auto}
    #pfc-panel .p-group{position:sticky;top:0;background:#eef3f6;color:${NAVY};font-weight:700;font-size:11px;padding:5px 8px;border-radius:6px;margin:8px 0 4px}
    #pfc-panel .p-item{display:flex;align-items:center;gap:8px;padding:7px 6px;border-bottom:1px solid #f0f4f6;cursor:pointer}
    #pfc-panel .p-item:hover{background:#f7fafb}
    #pfc-panel .p-badge{flex:none;font-size:9.5px;font-weight:700;text-transform:uppercase;color:#fff;background:#8aa0ad;border-radius:999px;padding:2px 7px;min-width:44px;text-align:center}
    #pfc-panel .p-badge.poll{background:${ORANGE}}
    #pfc-panel .p-badge.reply{background:#2e7d5b}
    #pfc-panel .p-item-t{flex:1;font-size:12px;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    #pfc-panel .p-mini{flex:none;border:1px solid #cdd8df;background:#fff;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer}
    #pfc-panel .p-mini:hover{background:#eef3f6}
    #pfc-panel .p-empty{color:#9aa7b1;padding:14px 4px;text-align:center}
    #pfc-panel .p-foot{padding:0 12px 10px;color:#9aa7b1;font-size:10.5px}
    #pfc-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:${NAVY};color:#fff;
      padding:9px 14px;border-radius:999px;font:13px -apple-system,Arial;z-index:2147483001;box-shadow:0 6px 18px rgba(0,0,0,.3);opacity:0;transition:opacity .2s}
    #pfc-toast.show{opacity:1}`;
  document.documentElement.appendChild(st);

  // ---- build panel --------------------------------------------------------
  const panel=el("div"); panel.id="pfc-panel";
  const head=el("div","p-head");
  const title=el("div","p-title","💬 Bruno");
  const spacer=el("div","p-spacer");
  const minBtn=el("button","p-icon","–"); minBtn.title="Collapse / expand";
  const hideBtn=el("button","p-icon","✕"); hideBtn.title="Hide (bring back: Tampermonkey menu → PFC: show assistant)";
  head.append(title,spacer,minBtn,hideBtn);

  const body=el("div","p-body");
  const tabs=el("div","p-tabs");
  const tabReply=el("button","p-tab on","Reply");
  const tabLib=el("button","p-tab","📋 Library");
  tabs.append(tabReply,tabLib);

  // Reply pane
  const rPane=el("div","p-pane");
  const detected=el("div","p-detected","Open a chat, then click “Read chat”.");
  const status=el("div","p-status","");
  const ta=el("textarea","p-ta"); ta.placeholder="Your draft appears here — edit freely, then Insert.";
  const rAct=el("div","p-actions");
  const bRead=el("button","p-btn","↻ Read chat");
  const bAI=el("button","p-btn","✍️ Write with AI");
  const bIns=el("button","p-btn primary","Insert");
  const bCopy=el("button","p-btn","Copy");
  rAct.append(bRead,bAI,bIns,bCopy);
  rPane.append(detected,status,ta,rAct);

  // Library pane
  const lPane=el("div","p-pane"); lPane.style.display="none";
  const search=el("input","p-search"); search.type="search"; search.placeholder="Search polls, challenges, messages…";
  const list=el("div","p-list");
  lPane.append(search,list);

  body.append(tabs,rPane,lPane);
  const foot=el("div","p-foot","Drafts only — you review & press send. Nothing sends by itself.");
  panel.append(head,body,foot);
  document.body.appendChild(panel);

  // ---- toast --------------------------------------------------------------
  let toastEl=null,toastT=null;
  function toast(msg){
    if(!toastEl){toastEl=el("div");toastEl.id="pfc-toast";document.body.appendChild(toastEl);}
    toastEl.textContent=msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove("show"),1800);
  }

  // ---- state persistence --------------------------------------------------
  const pos=GM_getValue("pfc_pos",null);
  if(pos&&typeof pos.left==="number"){ panel.style.left=pos.left+"px"; panel.style.top=pos.top+"px"; panel.style.right="auto"; panel.style.bottom="auto"; }
  if(GM_getValue("pfc_collapsed",false)) panel.classList.add("collapsed");
  if(GM_getValue("pfc_hidden",false)) panel.style.display="none";

  minBtn.onclick=(e)=>{ e.stopPropagation(); panel.classList.toggle("collapsed"); GM_setValue("pfc_collapsed",panel.classList.contains("collapsed")); };
  hideBtn.onclick=(e)=>{ e.stopPropagation(); panel.style.display="none"; GM_setValue("pfc_hidden",true); };
  GM_registerMenuCommand("PFC: show assistant", ()=>{ panel.style.display=""; GM_setValue("pfc_hidden",false); });

  // ---- tabs ---------------------------------------------------------------
  function setTab(which){
    const lib=which==="library";
    tabReply.classList.toggle("on",!lib); tabLib.classList.toggle("on",lib);
    rPane.style.display=lib?"none":""; lPane.style.display=lib?"":"none";
    if(lib&&!list.childElementCount) buildList();
  }
  tabReply.onclick=()=>setTab("reply");
  tabLib.onclick=()=>setTab("library");

  // ---- reply actions ------------------------------------------------------
  let lastIncoming="";
  function readChat(){
    const incoming=getLatestIncoming();
    lastIncoming=incoming;
    detected.textContent = "Detected: " + (incoming ? (incoming.length>110?incoming.slice(0,109)+"…":incoming) : "(couldn't read a message — open a chat)");
    if(!incoming){ status.textContent=""; return; }
    const m=match(incoming);
    if(m&&m.intent.answer){ ta.value=m.intent.answer; status.textContent = m.intent.needs_answer ? "⚠ Approved answer — check the [TEAM] note before sending." : "Approved answer ready."; }
    else { ta.value=""; status.textContent = PROXY_BASE ? "No saved answer — click “Write with AI”." : "No saved answer. Turn on AI (menu → PFC: set AI proxy URL) or type a reply."; }
  }
  bRead.onclick=readChat;
  bAI.onclick=async()=>{
    const incoming=lastIncoming||getLatestIncoming();
    if(!incoming){ readChat(); return; }
    if(!PROXY_BASE){ status.textContent="AI is off — set the proxy URL in the Tampermonkey menu."; return; }
    status.textContent="✍️ Writing a reply…";
    try{
      const out=await composeWithAI(incoming);
      if(out&&out.reply) ta.value=out.reply;
      else if(out&&out.escalate) ta.value="Thank you for reaching out 🙏 Let me get the right person from our team to help you. Could you share your name and the best time to reach you?";
      status.textContent = out&&out.needs_review ? "⚠ AI draft — review carefully before sending." : "AI draft ready.";
    }catch(e){ status.textContent="AI failed — check the proxy URL (menu). "+(e&&e.message||""); }
  };
  bIns.onclick=()=>{ if(!ta.value.trim()){toast("Nothing to insert");return;} if(!composeBox()){toast("Open a chat first");return;} if(insertText(ta.value)){toast("Inserted ✓ — review & press send");} else toast("Couldn't insert — use Copy"); };
  bCopy.onclick=async()=>{ try{ await navigator.clipboard.writeText(ta.value); toast("Copied ✓"); }catch(_){ toast("Copy failed"); } };

  // ---- library ------------------------------------------------------------
  function itemFullText(it){ return it.link ? it.text+"\n"+it.link : it.text; }
  function badgeClass(t){ t=(t||"").toLowerCase(); if(t.indexOf("poll")===0)return "p-badge poll"; if(t.indexOf("reply")===0)return "p-badge reply"; return "p-badge"; }
  function insertItem(it){
    if(!composeBox()){ toast("Open a chat first"); return; }
    if(insertText(itemFullText(it))) toast(/^poll/i.test(it.type)?"Poll text inserted — or build a native poll via 📎 → Poll":"Inserted ✓ — review & press send");
    else toast("Couldn't insert — use Copy");
  }
  function toReplyEditor(it){ ta.value=itemFullText(it); setTab("reply"); status.textContent="From Library — edit if needed, then Insert."; detected.textContent="Library item: "+(it.title||it.type); }
  function buildList(){
    list.innerHTML="";
    const q=normalize(search.value);
    let shown=0;
    for(const g of LIBRARY.groups||[]){
      const matches=(g.items||[]).filter(it=> !q || normalize(g.name+" "+(it.title||"")+" "+it.text+" "+(it.type||"")+" "+(it.section||"")).indexOf(q)!==-1);
      if(!matches.length) continue;
      list.appendChild(el("div","p-group",g.name+" ("+matches.length+")"));
      for(const it of matches){
        shown++;
        const row=el("div","p-item"); row.title=it.text;
        row.appendChild(el("span",badgeClass(it.type),(it.type||"Text").split(" ")[0]));
        row.appendChild(el("div","p-item-t",it.title||it.text.slice(0,70)));
        const ins=el("button","p-mini","Insert"); ins.onclick=(e)=>{e.stopPropagation();insertItem(it);};
        const cp=el("button","p-mini","Copy"); cp.onclick=async(e)=>{e.stopPropagation();try{await navigator.clipboard.writeText(itemFullText(it));cp.textContent="✓";setTimeout(()=>cp.textContent="Copy",900);}catch(_){}};
        row.append(ins,cp);
        row.onclick=()=>toReplyEditor(it);
        list.appendChild(row);
      }
    }
    if(!shown) list.appendChild(el("div","p-empty","No matches."));
  }
  let searchT=null;
  search.addEventListener("input",()=>{ clearTimeout(searchT); searchT=setTimeout(buildList,150); });

  // ---- drag the panel by its header (document-level; reliable) ------------
  let dragging=false,moved=false,sx=0,sy=0,ox=0,oy=0;
  function pt(e){ return e.touches&&e.touches[0]?e.touches[0]:e; }
  function onDown(e){
    if(e.target===minBtn||e.target===hideBtn) return;
    const p=pt(e); dragging=true; moved=false; sx=p.clientX; sy=p.clientY;
    const r=panel.getBoundingClientRect(); ox=r.left; oy=r.top; e.preventDefault();
  }
  function onMove(e){
    if(!dragging)return;
    const p=pt(e),dx=p.clientX-sx,dy=p.clientY-sy;
    if(Math.abs(dx)+Math.abs(dy)>4)moved=true;
    if(moved){
      const nx=Math.max(4,Math.min(window.innerWidth-panel.offsetWidth-4,ox+dx));
      const ny=Math.max(4,Math.min(window.innerHeight-40,oy+dy));
      panel.style.left=nx+"px"; panel.style.top=ny+"px"; panel.style.right="auto"; panel.style.bottom="auto"; e.preventDefault();
    }
  }
  function onUp(){ if(!dragging)return; dragging=false; if(moved){ const r=panel.getBoundingClientRect(); GM_setValue("pfc_pos",{left:r.left,top:r.top}); } }
  head.addEventListener("mousedown",onDown);
  head.addEventListener("touchstart",onDown,{passive:false});
  document.addEventListener("mousemove",onMove);
  document.addEventListener("touchmove",onMove,{passive:false});
  document.addEventListener("mouseup",onUp);
  document.addEventListener("touchend",onUp);

  // first read when a chat is already open
  setTimeout(()=>{ if(composeBox()) readChat(); }, 800);
})();
