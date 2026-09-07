// ==UserScript==
// @name         PFC Reply Assistant
// @namespace    pfc.painfreeclub
// @version      0.3.1
// @description  Writes Pain Free Club replies on WhatsApp Web — approved answers + an AI brain for anything else. Drafts only; you review & press send. Draggable, hideable button.
// @match        https://web.whatsapp.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      *
// @updateURL    REPLACE_WITH_YOUR_GIST_RAW_URL
// @downloadURL  REPLACE_WITH_YOUR_GIST_RAW_URL
// ==/UserScript==
(function () {
  "use strict";
  if (window.__pfcAssistantLoaded) return;
  window.__pfcAssistantLoaded = true;

  let PROXY_BASE = "";
  const FAQ = {
  "_comment": "PFC Reply Assistant knowledge base. Generated from the 'Regular Messages' tab of the Community Nurturing Master SOP. Edit the 'answer' fields here to change what the extension suggests. 'triggers' are lowercase phrases/words that map a member's message to this answer. Set needs_answer=true for entries the team must still approve.",
  "intents": [
    {
      "id": "safety_medical",
      "category": "Safety",
      "priority": 100,
      "triggers": [
        "swelling", "swollen", "severe pain", "unbearable", "locking", "locked",
        "gives way", "give way", "can't walk", "cannot walk", "surgery",
        "replacement", "operation", "mri", "x-ray", "xray", "x ray", "injection",
        "medicine", "medication", "tablet", "dose", "prescription", "prescribe",
        "which exercise should i", "is it safe for me to", "diagnose", "my report says"
      ],
      "answer": "Thank you for sharing this with us 🙏 For anything related to your specific symptoms, reports, or treatment, we wouldn't want to advise over chat — it's important this is looked at properly. Our team will connect you with the right person from Dr. Manan's side. Could you share your name and the best time to reach you?",
      "needs_answer": true,
      "note": "SAFETY: never let the assistant give medical advice. This suggests a safe hand-off. TEAM: approve/adjust the wording."
    },
    {
      "id": "appointment",
      "category": "Appointment / clinical",
      "priority": 90,
      "triggers": [
        "appointment", "consultation", "consult", "book a call", "book a slot",
        "meet dr manan", "meet dr. manan", "one on one", "1 on 1", "1:1",
        "personal consultation", "talk to dr manan", "speak to dr manan", "opd", "clinic visit"
      ],
      "answer": "Thank you for your interest in getting Dr. Manan's guidance 🙏\n\nThe best way to get his advice directly is our weekly Inner Circle Call, where Dr. Manan personally answers members' questions. For anything specific, our support team will help you with the right next step.\n\nPlease share:\n• Your full name\n• City\n• What you'd like guidance on\n\nOur team will get back to you shortly. 💙",
      "needs_answer": false,
      "note": "Reflects PFC policy: private 1:1 medical consultations are not offered — route to the weekly Inner Circle Call + support team. TEAM: if a paid consultation or clinic option DOES exist, add its process/link here."
    },
    {
      "id": "location",
      "category": "Logistics",
      "priority": 80,
      "triggers": [
        "where is the clinic", "clinic located", "clinic location", "clinic address",
        "where is dr manan", "training located", "training location", "address",
        "where do you sit", "which city", "where is the centre", "where is the center"
      ],
      "answer": "Thank you for asking 🙏\n\nMost of Dr. Manan's guidance for members happens online — your live Yoga/Physio sessions, the PFC Community App, and the Inner Circle Call where he answers questions personally.\n\nIf you're looking for an in-person option, please share your city and our team will guide you on what's available. 💙\n\n[TEAM: if you want to share a specific clinic address, map link and timings, paste them here.]",
      "needs_answer": true,
      "note": "The real clinic/training address isn't in our records, so I can't fill it — this safe routing reply is a placeholder. TEAM: paste the actual address + map link + timings and set needs_answer to false."
    },
    {
      "id": "recordings",
      "category": "Access",
      "priority": 50,
      "triggers": [
        "recording", "recordings", "recorded", "recorded session", "missed the session",
        "missed the class", "missed today", "watch again", "replay", "where can i watch",
        "how to watch", "past session", "previous session", "yesterday's session"
      ],
      "answer": "Hello 😊\nTo watch the recorded sessions, please refer to this short video 👇\n🎥 https://youtube.com/shorts/Y4BwuYZ_pIc\n\nOnce you've downloaded the app:\n➡️ Go to Feed ➡️ Click Courses ➡️ Select Yoga / Physio / Inner Circle Call ➡️ Choose the date\n\nIf you face difficulty, feel free to reach out — we're here to help 😊\nPain Free Club Support Team",
      "needs_answer": false
    },
    {
      "id": "app_login",
      "category": "Access",
      "priority": 50,
      "triggers": [
        "download the app", "download app", "how to login", "how to log in", "cant login",
        "can't login", "unable to login", "app link", "install the app", "play store",
        "app store", "which app", "login problem"
      ],
      "answer": "📱 Apple App Store: https://apps.apple.com/in/app/pfc-community/id6758769658\n📱 Android Play Store: https://play.google.com/store/apps/details?id=com.tagmango.painfreeclub\n\nLog in using your registered mobile number.",
      "needs_answer": false
    },
    {
      "id": "post_photos",
      "category": "Access",
      "priority": 50,
      "triggers": [
        "post my photo", "post photo", "upload photo", "share my plate", "today's plate",
        "how to post", "upload my update", "share update on app", "post on channel"
      ],
      "answer": "Hello everyone! 😊\nWe've made a short video explaining how to post your photos on the app. 📸\n🎥 Video: https://youtu.be/fKnmpPAu7Ls\nPlease watch and follow the steps. If you still face issues, let us know. Thank you! 💚",
      "needs_answer": false
    },
    {
      "id": "session_time",
      "category": "Schedule",
      "priority": 40,
      "triggers": [
        "what time is the session", "session time", "is the session today", "class today",
        "session today", "timing of session", "when is the session", "what time today"
      ],
      "answer": "Hello [name] ji, the session is today at [time]. 😊",
      "needs_answer": false,
      "note": "Human must fill [time] before sending."
    },
    {
      "id": "join_session",
      "category": "Schedule",
      "priority": 40,
      "triggers": [
        "how do i join", "join the session", "join link", "zoom link", "session link",
        "how to join yoga", "how to join physio", "link for today"
      ],
      "answer": "Reminder: Live [Yoga/Physio] Session at 7:00 AM (Zoom). Please keep a chair and mat handy and set your camera so standing + seated exercises are visible.\n🔗 [paste today's session Zoom link]\nYou can also join through the PFC Community App. Stay strong 💪",
      "needs_answer": false,
      "note": "Human must paste today's Zoom link before sending."
    },
    {
      "id": "no_session",
      "category": "Schedule",
      "priority": 30,
      "triggers": [
        "is there no session", "no session today", "no class today", "session cancelled",
        "class cancelled", "any session tomorrow", "session tomorrow"
      ],
      "answer": "Dear Members, there will be no live session tomorrow. Our Inner Circle Call is scheduled for [day] at [time]. In the meantime, you may access the recorded Yoga or Physiotherapy sessions on your dashboard. Thank you for your understanding. 💙",
      "needs_answer": false
    },
    {
      "id": "reports_policy",
      "category": "Clinical / policy",
      "priority": 100,
      "triggers": [
        "can i share my report", "share my x-ray", "share my mri", "posting my report",
        "sending my report", "attach my report", "share my scan"
      ],
      "answer": "Hello! 😊\nAll the information about how to read your X-rays and identify the stage of your knee arthritis or condition will be covered during the webinar.\nTill then, we request you not to share your MRI reports, X-ray reports, or any other medical reports in the WhatsApp group.\nThank you for your understanding! 🙏",
      "needs_answer": false
    },
    {
      "id": "pricing",
      "category": "Pricing",
      "priority": 50,
      "triggers": [
        "how much", "cost", "price", "fees", "fee", "charges", "what's included",
        "what is included", "program cost", "how to join", "enrolment", "enrollment"
      ],
      "answer": "What you get?\n✔️ Lifetime Inner Circle calls with Dr. Manan Vora\n✔️ 2 Yoga + 2 Physio Sessions/week (1 full year)\n✔️ Food guidance\n✔️ 21-day Knee Reset Challenge\n✔️ Full access to all recordings & courses\n👉 Join: https://member.painfreeclub.in/l/0581743fc4",
      "needs_answer": false,
      "note": "Verify the current price/link in knowledge/business/offers.md before relying on this."
    }
  ]
};
  const CARD_ID = "pfc-assistant-card";
  const BTN_ID = "pfc-launch-btn";

  const SETTINGS = {
    minScore: 1,
    aiEnabled: GM_getValue("pfc_ai_enabled", true),
    sharedSecret: GM_getValue("pfc_secret", ""),
  };
  let lastSig = "";
  let card = null; // { root, ta, status }

  // ---- menu ---------------------------------------------------------------
  GM_registerMenuCommand("PFC: set AI proxy URL", () => {
    const v = prompt("AI proxy URL (Cloudflare Worker / Railway). Blank = no AI:", PROXY_BASE || "");
    if (v !== null) { PROXY_BASE = v.trim().replace(/\/+$/, ""); GM_setValue("pfc_proxy_url", PROXY_BASE); alert("Saved. Reload WhatsApp Web."); }
  });
  GM_registerMenuCommand("PFC: set shared secret (optional)", () => {
    const v = prompt("Shared secret (blank if none):", SETTINGS.sharedSecret || "");
    if (v !== null) { SETTINGS.sharedSecret = v.trim(); GM_setValue("pfc_secret", SETTINGS.sharedSecret); alert("Saved."); }
  });
  GM_registerMenuCommand("PFC: toggle auto-suggest", () => {
    SETTINGS.aiEnabled = !SETTINGS.aiEnabled; GM_setValue("pfc_ai_enabled", SETTINGS.aiEnabled);
    alert("Auto-suggest is now " + (SETTINGS.aiEnabled ? "ON" : "OFF"));
  });
  // if a proxy URL was saved via menu, prefer it (standalone build starts blank)
  PROXY_BASE = GM_getValue("pfc_proxy_url", PROXY_BASE);

  // ---- styles -------------------------------------------------------------
  const st = document.createElement("style");
  st.textContent = `
    #pfc-launch-wrap{position:fixed;right:20px;bottom:20px;z-index:2147483000}
    #${BTN_ID}{background:#1f3b57;color:#fff;
      border:0;border-radius:999px;padding:10px 14px;font:600 13px -apple-system,"Segoe UI",Roboto,Arial;
      box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:grab;touch-action:none;user-select:none}
    #${BTN_ID}:hover{background:#17324b}
    #${BTN_ID}:active{cursor:grabbing}
    #pfc-launch-hide{position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;
      border:0;background:#c0392b;color:#fff;font:600 11px -apple-system,"Segoe UI",Roboto,Arial;
      line-height:1;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
    #${CARD_ID}{position:fixed;right:20px;bottom:70px;width:370px;max-width:calc(100vw - 40px);background:#fff;color:#1f2d3a;
      border:1px solid #d7e0e6;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.18);
      font:13px -apple-system,"Segoe UI",Roboto,Arial;z-index:2147483000;overflow:hidden}
    #${CARD_ID} .h{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1f3b57;color:#fff}
    #${CARD_ID} .h b{font-weight:600}
    #${CARD_ID} .cat{margin-left:auto;font-size:11px;opacity:.85;background:rgba(255,255,255,.15);padding:2px 8px;border-radius:999px}
    #${CARD_ID} .x{background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer}
    #${CARD_ID} .meta{padding:8px 12px 0;color:#6b7a87;font-size:11px}
    #${CARD_ID} .status{padding:6px 12px 0;color:#1f3b57;font-size:11.5px}
    #${CARD_ID} .warn{margin:8px 12px 0;padding:6px 8px;background:#fff6cc;border:1px solid #e6cf6b;border-radius:8px;color:#6b5600;font-size:11.5px}
    #${CARD_ID} textarea{width:calc(100% - 24px);margin:8px 12px;border:1px solid #d7e0e6;border-radius:8px;padding:8px;font:inherit;color:#1f2d3a;resize:vertical;box-sizing:border-box}
    #${CARD_ID} .a{display:flex;gap:8px;padding:0 12px 10px;flex-wrap:wrap}
    #${CARD_ID} .btn{border:1px solid #cdd8df;background:#f2f5f7;color:#1f2d3a;border-radius:8px;padding:7px 10px;font:inherit;cursor:pointer}
    #${CARD_ID} .btn:hover{background:#e9eef1}
    #${CARD_ID} .primary{background:#1f3b57;border-color:#1f3b57;color:#fff;font-weight:600}
    #${CARD_ID} .foot{padding:0 12px 10px;color:#9aa7b1;font-size:10.5px}`;
  document.documentElement.appendChild(st);

  // ---- matcher ------------------------------------------------------------
  function normalize(s){return (s||"").toLowerCase().replace(/[‘’ʼ]/g,"'").replace(/[^a-z0-9'\s]/g," ").replace(/\s+/g," ").trim();}
  function match(text){
    const p=" "+normalize(text)+" ";const m=[];
    for(const it of FAQ.intents||[]){let sc=0;for(const t of it.triggers||[]){const n=normalize(t);if(n&&p.indexOf(" "+n+" ")!==-1)sc+=n.split(" ").filter(Boolean).length;}if(sc>=(SETTINGS.minScore||1))m.push({intent:it,score:sc});}
    if(!m.length)return null;
    const pr=m.filter(x=>(x.intent.priority||0)>=90).sort((a,b)=>(b.intent.priority||0)-(a.intent.priority||0)||b.score-a.score);
    if(pr.length)return pr[0];
    m.sort((a,b)=>b.score-a.score||(b.intent.priority||0)-(a.intent.priority||0));return m[0];
  }

  // ---- read chat ----------------------------------------------------------
  function chatTitle(){const h=document.querySelector('#main header [title]')||document.querySelector('#main header span[dir="auto"]');return h?(h.getAttribute("title")||h.textContent||"").trim():"";}
  function cleanTime(t){return (t||"").replace(/\s*\b\d{1,2}:\d{2}\s?(?:am|pm)?\.?$/i,"").trim();}
  function textOf(node){
    if(!node)return "";
    const span=node.querySelector&&(node.querySelector("span.selectable-text")||node.querySelector('span[dir="ltr"]')||node.querySelector('span[dir="auto"]'));
    return cleanTime((span?span.innerText||span.textContent:node.innerText||node.textContent)||"");
  }
  // Robust across WhatsApp Web redesigns: try several ways it marks messages,
  // prefer the last INCOMING one, skip our own (message-out).
  function getLatestIncoming(){
    const scope=document.querySelector("#main")||document;
    const tries=[
      "div.message-in",
      '[data-pre-plain-text]',
      "span.selectable-text",
      '[role="row"]',
    ];
    let nodes=[];
    for(const sel of tries){const n=scope.querySelectorAll(sel);if(n.length){nodes=n;break;}}
    if(nodes.length){
      for(let i=nodes.length-1;i>=0;i--){
        const n=nodes[i];
        if(n.closest&&n.closest(".message-out"))continue; // skip messages we sent
        const t=textOf(n);
        if(t)return t;
      }
      const t=textOf(nodes[nodes.length-1]); // fallback: whatever the last one is
      if(t)return t;
    }
    try{console.warn("[PFC] could not read message. counts:",{
      main:!!document.querySelector("#main"),
      messageIn:scope.querySelectorAll("div.message-in").length,
      prePlain:scope.querySelectorAll("[data-pre-plain-text]").length,
      selectable:scope.querySelectorAll("span.selectable-text").length,
      rows:scope.querySelectorAll('[role="row"]').length,
    });}catch(_){}
    return "";
  }

  // ---- insert -------------------------------------------------------------
  function composeBox(){return document.querySelector('#main footer div[contenteditable="true"]')||document.querySelector('div[contenteditable="true"][data-tab="10"]')||document.querySelector('#main div[contenteditable="true"]');}
  function insertText(text){
    const box=composeBox();if(!box)return false;box.focus();
    try{const dt=new DataTransfer();dt.setData("text/plain",text);box.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true}));if(box.textContent&&box.textContent.length)return true;}catch(_){}
    try{document.execCommand("insertText",false,text);return true;}catch(_){return false;}
  }

  // ---- AI -----------------------------------------------------------------
  function composeWithAI(message){
    return new Promise((resolve,reject)=>{
      const headers={"Content-Type":"application/json"};if(SETTINGS.sharedSecret)headers["x-pfc-key"]=SETTINGS.sharedSecret;
      GM_xmlhttpRequest({method:"POST",url:PROXY_BASE+"/compose",headers,data:JSON.stringify({message}),timeout:25000,
        onload:r=>{try{resolve(JSON.parse(r.responseText));}catch(e){reject(e);}},onerror:()=>reject(new Error("network")),ontimeout:()=>reject(new Error("timeout"))});
    });
  }

  // ---- UI -----------------------------------------------------------------
  function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function removeCard(){const e=document.getElementById(CARD_ID);if(e)e.remove();card=null;}

  function buildCard(incoming, opts){
    removeCard();
    opts=opts||{};
    const root=el("div");root.id=CARD_ID;
    const h=el("div","h");h.appendChild(el("b",null,"PFC Reply Assistant"));
    const cat=el("span","cat",opts.cat||"");h.appendChild(cat);
    const x=el("button","x","×");x.title="Close";x.onclick=removeCard;h.appendChild(x);
    root.appendChild(h);
    root.appendChild(el("div","meta","Detected: "+(incoming?(incoming.length>90?incoming.slice(0,89)+"…":incoming):"(couldn't read a message)")));
    const status=el("div","status","");root.appendChild(status);
    if(opts.warn){const w=el("div","warn",opts.warn);root.appendChild(w);}
    const ta=el("textarea");ta.value=opts.text||"";ta.rows=Math.min(12,(opts.text||"").split("\n").length+2);root.appendChild(ta);
    const a=el("div","a");
    const ins=el("button","btn primary","Insert into chat");ins.onclick=()=>{if(insertText(ta.value)){ins.textContent="Inserted ✓";setTimeout(removeCard,700);}else ins.textContent="Couldn't insert — Copy";};
    const cp=el("button","btn","Copy");cp.onclick=async()=>{try{await navigator.clipboard.writeText(ta.value);cp.textContent="Copied ✓";setTimeout(()=>cp.textContent="Copy",1200);}catch(_){cp.textContent="Copy failed";}};
    a.appendChild(ins);a.appendChild(cp);
    if(PROXY_BASE){const rg=el("button","btn",opts.text?"Regenerate":"Write with AI");rg.onclick=()=>runAI(incoming);a.appendChild(rg);}
    root.appendChild(a);
    root.appendChild(el("div","foot","Drafts only — you review & press send."));
    document.body.appendChild(root);
    card={root,ta,status,cat};
    return card;
  }

  function setStatus(t){if(card)card.status.textContent=t||"";}

  async function runAI(incoming){
    if(!PROXY_BASE||!incoming)return;
    setStatus("✍️ Writing a reply…");
    try{
      const out=await composeWithAI(incoming);
      if(out&&out.reply){card.ta.value=out.reply;card.ta.rows=Math.min(14,out.reply.split("\n").length+2);}
      else if(out&&out.escalate){card.ta.value="Thank you for reaching out 🙏 Let me get the right person from our team to help you with this. Could you share your name and the best time to reach you?";}
      setStatus(out&&out.needs_review?"⚠ AI draft — review carefully before sending.":"AI draft ready.");
    }catch(e){setStatus("AI failed — check the proxy URL (Tampermonkey menu). "+(e&&e.message||""));}
  }

  // ---- core ---------------------------------------------------------------
  function generate(force){
    const incoming=getLatestIncoming();
    if(!incoming){if(force)buildCard("", {warn:"Couldn't read the last message. Open a chat, then click the PFC button again."});return;}
    const sig=chatTitle()+"||"+incoming;
    if(!force&&sig===lastSig)return;
    lastSig=sig;
    const local=match(incoming);
    const opts={cat:local?local.intent.category:"", text:local?local.intent.answer:"",
                warn:(local&&local.intent.needs_answer)?(local.intent.category==="Safety"?"⚠ Medical/clinical — do not advise. Review the hand-off before sending.":"⚠ No approved answer yet — review before sending."):""};
    buildCard(incoming, opts);
    if(PROXY_BASE&&SETTINGS.aiEnabled){ runAI(incoming); }
    else if(!local){ setStatus("No saved answer. Turn on AI (menu → PFC: set AI proxy URL) to auto-write a reply, or type one."); }
  }

  // launcher button — draggable (drag to move, position remembered), click for a
  // reply, ✕ to hide (bring back from the Tampermonkey menu).
  const wrap=el("div");wrap.id="pfc-launch-wrap";
  const btn=el("button",null,"💬 PFC");btn.id=BTN_ID;btn.title="Drag to move · click for a reply";
  const hideBtn=el("button",null,"✕");hideBtn.id="pfc-launch-hide";hideBtn.title="Hide (bring back: Tampermonkey menu → PFC: show button)";
  wrap.appendChild(btn);wrap.appendChild(hideBtn);
  document.body.appendChild(wrap);

  function showLauncher(){wrap.style.display="";GM_setValue("pfc_btn_hidden",false);}
  function hideLauncher(){wrap.style.display="none";GM_setValue("pfc_btn_hidden",true);}
  hideBtn.onclick=(e)=>{e.stopPropagation();hideLauncher();};
  GM_registerMenuCommand("PFC: show button", showLauncher);

  // restore saved position + hidden state
  const savedPos=GM_getValue("pfc_btn_pos",null);
  if(savedPos&&typeof savedPos.left==="number"){
    wrap.style.left=savedPos.left+"px";wrap.style.top=savedPos.top+"px";wrap.style.right="auto";wrap.style.bottom="auto";
  }
  if(GM_getValue("pfc_btn_hidden",false))wrap.style.display="none";

  // drag vs click — tracked on document so movement never stops when the cursor
  // leaves the small button (pointer-capture can fail silently inside WhatsApp).
  let dragging=false,moved=false,sx=0,sy=0,ox=0,oy=0;
  function pt(e){return e.touches&&e.touches[0]?e.touches[0]:e;}
  function onDown(e){
    if(e.target===hideBtn)return;      // ✕ handles its own click
    const p=pt(e);dragging=true;moved=false;sx=p.clientX;sy=p.clientY;
    const r=wrap.getBoundingClientRect();ox=r.left;oy=r.top;
    e.preventDefault();
  }
  function onMove(e){
    if(!dragging)return;
    const p=pt(e),dx=p.clientX-sx,dy=p.clientY-sy;
    if(Math.abs(dx)+Math.abs(dy)>5)moved=true;
    if(moved){
      const nx=Math.max(4,Math.min(window.innerWidth-wrap.offsetWidth-4,ox+dx));
      const ny=Math.max(4,Math.min(window.innerHeight-wrap.offsetHeight-4,oy+dy));
      wrap.style.left=nx+"px";wrap.style.top=ny+"px";wrap.style.right="auto";wrap.style.bottom="auto";
      e.preventDefault();
    }
  }
  function onUp(){
    if(!dragging)return;dragging=false;
    if(moved){const r=wrap.getBoundingClientRect();GM_setValue("pfc_btn_pos",{left:r.left,top:r.top});}
    else{generate(true);}
  }
  btn.addEventListener("mousedown",onDown);
  btn.addEventListener("touchstart",onDown,{passive:false});
  document.addEventListener("mousemove",onMove);
  document.addEventListener("touchmove",onMove,{passive:false});
  document.addEventListener("mouseup",onUp);
  document.addEventListener("touchend",onUp);

  // best-effort auto-suggest when a new incoming message arrives
  let timer=null;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{if(SETTINGS.aiEnabled)generate(false);},600);})
    .observe(document.body,{childList:true,subtree:true});
})();
