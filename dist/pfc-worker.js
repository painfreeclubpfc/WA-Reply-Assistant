/* PFC Reply Assistant — AI "brain" on Cloudflare Workers (free tier).
 *
 * Holds the Anthropic key (as a Worker secret) and writes a reply to ANY member
 * message in Pain Free Club's voice — grounded in the approved answers, never
 * giving medical advice. The userscript calls POST /compose; a human still
 * reviews and sends.
 *
 * This file is a TEMPLATE: __FAQ_JSON__, __BRAIN__ and __LIBRARY_JSON__ are
 * replaced with faq.json, pfc-brain.md and library.json at build time (see
 * worker/build.mjs). This Worker is the single backend: it serves the AI brain
 * (POST /compose), the approved answers (GET /faq) and the content library
 * (GET /library). The userscript is a thin client that fetches all of this
 * live, so content changes only ever happen here.
 */
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
const PFC_BRAIN = "# PFC Brain — member-safe context for the WhatsApp reply assistant\n\nThis is the curated knowledge that gets baked into the Cloudflare Worker's\nsystem prompt so the assistant can answer *any* in-scope member question in\nPain Free Club's voice — not only the pre-written FAQ answers. It is a\ndeliberately trimmed, **member-safe** digest of `knowledge/business/`. Facts\nthat must never be stated over chat (prices, addresses, phone numbers, medical\nadvice) are marked as escalate-only here on purpose.\n\nWhen `knowledge/business/` changes in a way a member could ask about, update\nthis file and rebuild the Worker (`node worker/build.mjs`).\n\n---\n\n## Who we are\n\nPain Free Club (PFC) is an India-based online **knee-pain recovery community**\nfounded by **Dr. Manan Vora**. We help adults — mostly 35+ (a large share 50+)\n— reduce knee pain and regain mobility through structured exercise, pain\neducation, lifestyle change, and an ongoing supportive community. We position\nourselves as an alternative to unnecessary surgery, injections and painkiller\ndependence — always phrased responsibly (\"where medically appropriate\"), never\nas a cure or a guarantee.\n\nSignature line: **\"Pain should never become your identity.\"**\n\nCore beliefs (safe to reflect in replies):\n- Pain is influenced by movement habits, strength, sleep, stress and lifestyle\n  — not just \"wear and tear.\"\n- Movement is medicine when done appropriately.\n- We teach the *why*, so members can self-manage and stay independent.\n- Long-term recovery over quick fixes.\n\n## Dr. Manan Vora\n\n- **Orthopaedic Surgeon and Regenerative Medicine Specialist.**\n- **Never** describe him as a physiotherapist.\n- Health educator with 1M+ followers; 7+ years clinical experience; has helped\n  4,000+ people with knee and mobility issues.\n- He does **not** give personal medical advice over WhatsApp chat — clinical\n  questions are handed to the team (see Guardrails).\n\n## Community & how it runs\n\n- The paid community lives on **TagMango** — members log in at\n  **member.painfreeclub.in** (app + web). This is where recordings, live\n  sessions and the learning library live.\n- **Inner Circle** — weekly live sessions on mindset, habits and sustainable\n  recovery, plus group physio/yoga, Q&A and masterclasses.\n- Announcements come through the Community Hub; wins/success stories have their\n  own space.\n- Live class recordings are posted inside TagMango after each session.\n- WhatsApp is used for reminders, follow-ups and member support (this assistant).\n\n## The programs (names only — see pricing rule)\n\n- **Silver — Knee Reset Program** (entry level: group physio, yoga, weekly call\n  with Dr. Manan, general diet plan).\n- **Gold** — mid tier.\n- **Diamond Membership** — our premium, long-term \"health ecosystem\" for\n  healthy ageing: live mobility & strength coaching (Mon/Wed/Fri evenings), a\n  personal health blueprint with Dr. Manan, monthly movement-coach and nutrition\n  reviews, Dr. Manan AI, a learning library, a weekly leadership circle,\n  accountability teams and a private community. It is about protecting the next\n  20–30 years of independence, \"not just the knee.\"\n- **Webinars/masterclasses** run on a recurring schedule (e.g. the **FFKP —\n  \"Freedom From Knee Pain\"** masterclass) and are the usual entry point.\n\nTerminology rules (must follow in every reply):\n- Say **\"Diamond Membership\"**, never \"Life Rebuild System\" / \"LRS\" to members.\n- Say **\"movement coach\"**, never \"physiotherapy / physiotherapist,\" in\n  member-facing wording (e.g. \"monthly movement-coach review\").\n\n## Voice & tone (write every reply like this)\n\n- Warm, calm, respectful, reassuring — like a caring clinic. Never salesy,\n  never robotic.\n- Short, simple sentences; readers are often 50+ and read on a phone.\n- Hindi/English mix is natural and welcome — mirror the member's language. If\n  they write in Hindi or Hinglish, reply the same way.\n- A little emoji is fine (🙏 💙 😊). Address the person kindly.\n- Outcome-focused and hopeful, but realistic — never fear-monger, never promise\n  a cure or a fixed timeline.\n\n## Hard guardrails (never break these)\n\n1. **No medical advice, ever.** Do not diagnose, interpret an MRI/X-ray/report,\n   advise on symptoms, medicines, dosages, injections or surgery, or say\n   whether something is \"safe\" for their body. Any such message → a gentle\n   hand-off (\"we wouldn't want to advise over chat — our team will connect you\n   with the right person\") and set escalate=true.\n2. **Never quote a price over chat.** Prices change and depend on current\n   offers/coupons. If asked about cost/fees, say the team will share the current\n   details and pricing, and set needs_review=true. Do not state any rupee figure.\n3. **Never invent facts.** No links, phone numbers, addresses, clinic timings,\n   dates or policies unless they appear in the approved answers. If you don't\n   know a specific detail, say the team will confirm it — don't guess.\n4. Keep any placeholder from an approved answer (e.g. [Zoom link], [time]) — a\n   human fills it in before sending.\n5. Every reply is a **draft** for a human to review and send — never the final,\n   authoritative word.\n";
const LIBRARY = {
 "_source": "PFC Community Nurturing Master SOP (LIVE)",
 "groups": [
  {
   "name": "FFKP Nurturing",
   "items": [
    {
     "n": "1",
     "when": "Webinar −4 days",
     "type": "Video",
     "title": "Opening nurture video — Dr. Manan's welcome / special message. Ask for a 👍 react",
     "text": "Good Afternoon Knee Warriors,\n\nDr. Manan Vora has a special message for all of you.\n\nReact to this video with a 👍🏻 after watching please! ✨",
     "link": "https://drive.google.com/file/d/1H4ZJqBwNlrnZJAaO56aoQ8Ac63H0bb9c/view?usp=drivesdk",
     "section": "PHASE A"
    },
    {
     "n": "2",
     "when": "Webinar −3 days",
     "type": "Google Form",
     "title": "Pre-session Google Form — collects real-life knee concerns for Dr. Manan. Re-sen",
     "text": "Hello,\nLooking forward to seeing you in the Freedom From Knee Pain session.\n\nPlease complete this brief form before the session. It helps Dr. Manan address real-life knee concerns more clearly during the talk.\n\n👉 Form link:\nhttps://docs.google.com/forms/d/e/1FAIpQLScfXGb0pW6FjtGegfl-0yG7qEQksNkksx1IbCGqrVtHOE_h_A/viewform\n\nIt takes less than 2 minutes.\n\nThank you,\nPain Free Club",
     "link": "https://docs.google.com/forms/d/e/1FAIpQLScfXGb0pW6FjtGegfl-0yG7qEQksNkksx1IbCGqrVtHOE_h_A/viewform",
     "section": "PHASE A"
    },
    {
     "n": "3",
     "when": "Webinar −1 day",
     "type": "Text",
     "title": "OPEN the group for questions (Dr. Manan voice). Post the copy-paste template rig",
     "text": "Hello everyone! It's Dr. Manan here! I am very excited for tomorrow's session, and I hope you are too!\n\nI want to hear from you now — What is the one thing you're hoping to get clarity on during the session? You can now drop your responses here in this chat for me to respond to.\n\nI'll give you an example.\n\nName - Anil Patil\nAge - 60\nLocation - Pune\nNeed clarity on - which stage of knee arthritis I have and right way forward?\n\nI'll drop the template below so you can copy paste and add your response.",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "4",
     "when": "Webinar −1 day",
     "type": "Text",
     "title": "The copy-paste question template.",
     "text": "Name -\nAge -\nLocation -\nNeed clarity on -",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "5",
     "when": "Webinar −1 day",
     "type": "Text",
     "title": "24-hours reminder + join instructions.",
     "text": "⏳ 24 HOURS TO GO\n\nHello everyone 👋\n\nThe Freedom From Knee Pain Webinar with Dr. Manan Vora is happening tomorrow!\n\nIf you haven't already, save the webinar link and block your time.\n\nFor the best learning experience:\n💻 Use a laptop or tablet\n🎧 Use earphones for better audio quality\n📝 Keep a notebook and pen handy to take notes\n\n🔗 Join here:\nhttps://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1\n\n– Team Dr. Manan Vora 💙",
     "link": "https://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1",
     "section": "PHASE B"
    },
    {
     "n": "6",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "CLOSE the group, then send the answer-video series. This intro precedes the ~18 ",
     "text": "Hello everyone, I've gone through your questions, and I'll now be answering them! Please watch every video I send 😌",
     "link": "https://drive.google.com/file/d/1LTFjkxwkE-LYJRsxXWAf0VAeHg53EqoW/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "7",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q01",
     "text": "Unable to walk/stand for long or squat due to pain, here's my answer for you!",
     "link": "https://drive.google.com/file/d/1feIXy-kSYTfTkF8mqG5FpyABjwGLK7e9/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "8",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q02",
     "text": "Meniscus tear? MRI done? Here's what you need to know!",
     "link": "https://drive.google.com/file/d/1AaHbd9QccLu52QuGaTu8KF1Lab-t1d3H/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "9",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q03",
     "text": "Swelling/inflammation/stiffness or tightness, we will solve this too!",
     "link": "https://drive.google.com/file/d/1UDsM1-M28ZM5dCarRfRdbirwVkEbWhXW/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "10",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q04",
     "text": "Painkillers/ supplements/ collagen? We will discuss this too in my unique way!",
     "link": "https://drive.google.com/file/d/1QaOaYzmIVyd-stpO795ggM077l4y8hL7/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "11",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q05",
     "text": "You have been told knee replacement is the next step but should you do it? Is there a way out? Here's my take!",
     "link": "https://drive.google.com/file/d/1enLJ8NyIxwkWnhKd4IM4UezRmdWnFUMI/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "12",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q06",
     "text": "Want to move freely, be independent in life? We will dive deeper into this!",
     "link": "https://drive.google.com/file/d/1E2r6Mz086ZfqGnHzG15R8CcySdnDj91C/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "13",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q07",
     "text": "Chondromalacia Patella/ front of knee pain, what to do? We will be covering this!",
     "link": "https://drive.google.com/file/d/19qiS6jFvyyb3GN8dU5VkQo4Dag5TxFWe/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "14",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q08",
     "text": "Clicking sound in your knee? Here's my answer!",
     "link": "https://drive.google.com/file/d/1He-oPykw_jYzQurUuQXbcyYp5vC43F3S/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "15",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q09",
     "text": "You have done X-ray or MRI but is that the final answer? How do I move forward?",
     "link": "https://drive.google.com/file/d/13OdqZiq3ju_zOJcrEcNBtK1PgSuan4sG/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "16",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q10",
     "text": "Which stage of knee arthritis do you have? How to find out?",
     "link": "https://drive.google.com/file/d/1a2C_GuniZAjV9WcLsZcRgHQnY32abh5L/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "17",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q11",
     "text": "Can you sit cross legged anymore? Or squat? How to do this as you age?",
     "link": "https://drive.google.com/file/d/1GYDAz8JfIcN2kaIYDBHOKvbOOvBCMrEf/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "18",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q12",
     "text": "Exercising, doing physio or yoga or gym. Is that enough? What more to do?",
     "link": "https://drive.google.com/file/d/1EoQNtTTAn7cyW1wLoqzCkAfUfuRHjbQZ/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "19",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q13",
     "text": "No knee pain now but want to avoid knee issues in the future, here's my response!",
     "link": "https://drive.google.com/file/d/1gQBX8IvRLi9k54F6ICvKpj7r6N1iv9_3/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "20",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q14",
     "text": "Cannot do physical activities like marathon/swimming/dance? Or struggling to travel or spend time with family?",
     "link": "https://drive.google.com/file/d/1sfhdBnx0s-hA9tjoQ7L2m32GjY4uRpjl/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "21",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q15",
     "text": "What about injections? PRP and stem cells? Here's my take",
     "link": "https://drive.google.com/file/d/1Bvucn7Nbl5Qc4uJ7fKhl1IUxEcSnd6ar/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "22",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q16",
     "text": "Will cartilage regenerate? Or can any treatment make that happen? What's the truth, here you go!",
     "link": "https://drive.google.com/file/d/1Bvucn7Nbl5Qc4uJ7fKhl1IUxEcSnd6ar/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "23",
     "when": "Webinar −1 day",
     "type": "Video",
     "title": "Answer video Q17 — final / instructions",
     "text": "That's the end! PLEASE MAKE SURE YOU WATCH THIS VIDEO for instructions about the session!",
     "link": "https://drive.google.com/file/d/1eCFaXyPpXfbwprgHmxiVNJDel2vfshf8/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "24",
     "when": "Webinar −1 day",
     "type": "Text",
     "title": "Webinar-tomorrow announcement (link shared next day).",
     "text": "📢 WEBINAR TOMORROW!\n\nThe Freedom From Knee Pain Webinar is happening tomorrow (Friday, 21st Aug) at 6:00 PM 🔥\n\nIf knee pain has been confusing, frustrating, or limiting your daily life, this session is going to give you real clarity on what's actually going wrong and what you should be doing instead 💥\n\n⚠️ The joining link will be shared tomorrow, so stay tuned!\n\n– Team Dr. Manan Vora",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "25",
     "when": "Webinar day",
     "type": "Text",
     "title": "Countdown reminder (repeat at 6h / 4h / 2h with same body).",
     "text": "⏳ 6 HOURS TO GO\n\nHello everyone 👋\n\nWe're just 6 hours away from the Freedom From Knee Pain Webinar.\n\nGet ready for an informative session with Dr. Manan Vora.\n\n💻 Laptop or tablet recommended\n🎧 Use earphones\n📝 Keep your notebook ready\n\n🔗 Join here:\nhttps://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1\n\n– Team Dr. Manan Vora 💙",
     "link": "https://drive.google.com/file/d/1PcOoKcLaxLIpw-WqMUt5ewZxaPNds3eQ/view?usp=drivesdk",
     "section": "PHASE C"
    },
    {
     "n": "26",
     "when": "Webinar day",
     "type": "Text",
     "title": "OPEN the group again (Dr. Manan voice) — collect one daily-life pain point live.",
     "text": "Hello everyone it's Dr. Manan here! We're about 90 mins away and I'm here to talk to you all for a few mins before we start!\n\nPlease tell me - what's the one activity of daily life that is being affected by your knee pain?\n\nEg - unable to play with my grandkid/ unable to climb stairs/ unable to travel the world - it could be anything!\n\nShare it with me now!",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "27",
     "when": "Webinar day",
     "type": "Text",
     "title": "1-hour countdown reminder.",
     "text": "⏳ 1 HOUR TO GO\n\nHello everyone 👋\n\nWe're just 1 hour away from the Freedom From Knee Pain Webinar.\n\nGet ready for an informative session with Dr. Manan Vora.\n\n💻 Laptop or tablet recommended\n🎧 Use earphones\n📝 Keep your notebook ready\n\n🔗 Join here:\nhttps://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1\n\n– Team Dr. Manan Vora 💙",
     "link": "https://drive.google.com/file/d/1J9f-I3YMEPm3fYF2LX8WdytJlNjtd4HN/view?usp=drivesdk",
     "section": "PHASE C"
    },
    {
     "n": "28",
     "when": "Webinar day",
     "type": "Video",
     "title": "CLOSE group, then 3 webinar-day answer videos. Answer video #1.",
     "text": "Unable to walk/stand for long/climb stairs or move confidently? Here's my take!",
     "link": "https://drive.google.com/file/d/1GYDAz8JfIcN2kaIYDBHOKvbOOvBCMrEf/view?usp=drivesdk",
     "section": "PHASE C"
    },
    {
     "n": "29",
     "when": "Webinar day",
     "type": "Video",
     "title": "Webinar-day answer video #2",
     "text": "Been told not to move/walk/squat after being diagnosed with knee arthritis? Is there another way?",
     "link": "https://drive.google.com/file/d/1fQKSdDz8TvvyDB74psjzXEMP70hmq2xj/view?usp=drivesdk",
     "section": "PHASE C"
    },
    {
     "n": "30",
     "when": "Webinar day",
     "type": "Video",
     "title": "Webinar-day answer video #3",
     "text": "Unable to do physical activities/sport/travel/spend time with loved ones? How to improve quality of life? Here's my response!",
     "link": "https://drive.google.com/file/d/1b9dNiDK67k7RNMCgrPlVDKUT9PMX_R5G/view?usp=drivesdk",
     "section": "PHASE C"
    },
    {
     "n": "31",
     "when": "Webinar day",
     "type": "Text",
     "title": "30-minute countdown.",
     "text": "⏳ 30 MINUTES TO GO\n\nHello everyone 👋\n\nWe're just 30 MINUTES away from the Freedom From Knee Pain Webinar.\n\nGet ready for an informative session with Dr. Manan Vora.\n\n💻 Laptop or tablet recommended\n🎧 Use earphones\n📝 Keep your notebook ready\n\n🔗 Join here:\nhttps://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1\n\n– Team Dr. Manan Vora 💙",
     "link": "https://drive.google.com/file/d/1cuL0RTw0O4hFE6xoaCxF_n9eBhzdd5Ib/view?usp=drivesdk",
     "section": "PHASE C"
    },
    {
     "n": "32",
     "when": "Webinar day",
     "type": "Text",
     "title": "20-minute countdown (shorter body).",
     "text": "⏳ 20 MINUTES TO GO!\n\nHello everyone 👋\n\nWe're just 20 minutes away from the Freedom From Knee Pain Webinar with Dr. Manan Vora! 💙\n\n📝 Keep your notebook ready\n🎧 Earphones recommended\n\n🔗 Join here:\nhttps://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1\n\n– Team Dr. Manan Vora 💙",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "33",
     "when": "Webinar day",
     "type": "Video",
     "title": "Meeting room open (with a short video).",
     "text": "Meeting room is now open JOIN NOW:\nhttps://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1",
     "link": "https://drive.google.com/file/d/1XreiOpqkVWnwVKT5ao4m8XFdwcpGP-e-/view?usp=drivesdk",
     "section": "PHASE C"
    },
    {
     "n": "34",
     "when": "Webinar day",
     "type": "Text",
     "title": "WE'RE LIVE blast #1.",
     "text": "🔴 WE'RE LIVE! 🎉\n\nThe Freedom From Knee Pain Webinar with Dr. Manan Vora is now LIVE! 💙\n\nJoin us now 👇\n🔗 https://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1\n\n– Team Dr. Manan Vora 💙",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "35",
     "when": "Webinar day",
     "type": "Text",
     "title": "Live-join blast #2.",
     "text": "🚨 JOIN US — WE'RE LIVE! 🚨\n\nThe Freedom From Knee Pain Webinar with Dr. Manan Vora has started! 💙\n\nTap the link to join 👇\n🔗 https://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "36",
     "when": "Webinar day",
     "type": "Text",
     "title": "Live-join blast #3 (FOMO).",
     "text": "🚨 IT'S HAPPENING RIGHT NOW! 🚨\n\nThe Freedom From Knee Pain Webinar with Dr. Manan Vora is LIVE! 💙\n\nIf you're not inside yet, you're missing it! 👀\nJoin us now 👇\n🔗 https://zoom.tagmango.com/redirect/webinar/group/6a745c5f5a35568ea0df56d1",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "37",
     "when": "Webinar +2 hrs",
     "type": "Text",
     "title": "First KRP offer message (sent twice).",
     "text": "The Knee Reset Program is where transformation begins. 🔥\n\nStructured. Guided. Proven.\n\nNo guesswork. No random exercises. Just a clear roadmap to stronger, pain-free knees.\n\nhttps://drmananvora.in/krp",
     "link": "https://drmananvora.in/krp",
     "section": "PHASE D"
    },
    {
     "n": "38",
     "when": "Webinar +3 hrs",
     "type": "Video",
     "title": "Testimonial — Satish Ji (10.5 kg weight loss).",
     "text": "💚 10.5 kg weight loss. More confidence. Less pressure on the knees.\n\nSatish Ji shares how, in just 5 months, he lost 10.5 kg by following the Pain Free Club's food and exercise plan.\n\nIf you're struggling with knee pain, this testimonial is worth watching. It might inspire you to take the first step toward a Pain Free life.\n\n🎥 Watch Satish Ji's journey here:\nhttps://member.painfreeclub.in/l/0581743fc4\n\n💙 Join the Pain Free Club today and begin your own transformation!",
     "link": "https://drive.google.com/file/d/18qt6yMyVFHdsfofFYVaJb3_aIzLgEi9s/view?usp=drivesdk",
     "section": "PHASE D"
    },
    {
     "n": "39",
     "when": "Webinar +1 day",
     "type": "Video",
     "title": "Testimonial — Varsha ji + price-rise urgency.",
     "text": "✨ Varsha ji's inspiring Pain Free Club journey is proof that healing is possible with the right guidance and consistency 💛🌿\n\n⚠️ Last few spots left at the current offer price. After that, the price increases to ₹24,999.\n\n👉 Join now:\nhttps://member.painfreeclub.in/l/0581743fc4\n\nDon't miss this opportunity to invest in your health and well-being 💪✨",
     "link": "https://drive.google.com/file/d/1PkBR0vkA7s7DHtyly_lUN09YMQW532QF/view?usp=drivesdk",
     "section": "PHASE D"
    },
    {
     "n": "40",
     "when": "Webinar +1 day",
     "type": "Text",
     "title": "Offer stack — 'Last Few Slots' with inclusions.",
     "text": "🚨 Last Few Slots Left! 🚨\n\nWhat you get?\n✔️ Lifetime Inner Circle calls with Dr. Manan Vora\n✔️ 2 Yoga + 2 Physio Sessions/week (1 full year)\n✔️ Food guidance\n✔️ 21-day The Knee Reset Challenge\n✔️ Full access to all recordings & courses\n\n👉 Join now before it's gone:\nhttps://member.painfreeclub.in/l/0581743fc4",
     "link": "https://member.painfreeclub.in/l/0581743fc4",
     "section": "PHASE D"
    },
    {
     "n": "41",
     "when": "Webinar +1 day",
     "type": "Video",
     "title": "Testimonial — Netra Ji (+ ₹24,999 urgency).",
     "text": "Thank you, Netra Ji, for sharing your wonderful experience! 💙✨\n\nFrom understanding the real causes of osteoarthritis to building healthier habits with protein-rich nutrition, regular yoga, physiotherapy, and mobility exercises, your journey is truly inspiring. 🙌\n\nThe biggest transformation isn't just reduced pain and stiffness, it's the confidence you've gained to take charge of your health every single day. 💪\n\n⚠️ Last 2 slots left at the current offer price! Once these are filled, the price will increase to ₹24,999.\n\n👉 Join now:\nhttps://member.painfreeclub.in/l/0581743fc4",
     "link": "https://drive.google.com/file/d/19irGCj8dz0msPS9GZCsJzJ8QMFVe3nHD/view?usp=drivesdk",
     "section": "PHASE D"
    },
    {
     "n": "42",
     "when": "Webinar +1 day",
     "type": "Video",
     "title": "Testimonial — Monica Ji.",
     "text": "✨ Monica Ji once struggled with knee pain too. Today, she's living with greater confidence and freedom — all because she decided to take the first step. 💛🌿\n\nThe current enrollment offer is almost over. Only a few spots remain at the present price.\n\n⏳ Once these spots are filled, the program fee will increase to ₹24,999.\n\n👉 Join now:\nhttps://member.painfreeclub.in/l/0581743fc4\n\nYour knees won't improve by waiting — but they can improve by taking action today. 💚✨",
     "link": "https://drive.google.com/file/d/1zTF8qJSpOEpXLzrGG0dmaREDw1aCsSaN/view?usp=drivesdk",
     "section": "PHASE D"
    },
    {
     "n": "43",
     "when": "Webinar +1 day",
     "type": "Video",
     "title": "Testimonial — Nirja Ji (age 75).",
     "text": "🌟 Age is just a number when your knees are strong!\n\nAt 75 years young, Nirja Ji is living a more active, pain-free life. 💚 Her knee pain has reduced significantly, and today she can walk, move, and even travel with confidence and comfort.\n\nHer journey is proof that with the right guidance, consistent exercise, and lifestyle changes, life can change at any age.\n\n✨ Watch her inspiring success story and see what's possible!\n\nJoin now:\nhttps://member.painfreeclub.in/l/0581743fc4",
     "link": "https://drive.google.com/file/d/11VZopRaDg6SD2jKaAQWHR9rwZJtvu9lo/view?usp=drivesdk",
     "section": "PHASE D"
    }
   ]
  },
  {
   "name": "KRP Nurturing",
   "items": [
    {
     "n": "1",
     "when": "On join",
     "type": "Text",
     "title": "The full welcome + onboarding message (STEP 1 app / STEP 2 food guide / STEP 3 t",
     "text": "🌿 Welcome to Knee Reset Program! 🌿\n\nHello everyone, a very warm welcome to Knee Reset Program! 🎉 We are delighted to have you join our community.\n\nTo help you get started smoothly, please go through the following resources carefully.\n\n━━━━━━━━━━━\n📱 STEP 1: Download the Pain Free Club App\n🍎 Apple: https://apps.apple.com/in/app/pfc-community/id6758769658\n🤖 Android: https://play.google.com/store/apps/details?id=com.tagmango.painfreeclub\nLog in using your registered mobile number.\n\n🥗 STEP 2: Food Guide — fill the selection form (one option, final):\n🔗 https://forms.gle/gL5NhN6xtRdKx3g4A\n\n🎥 STEP 3: Video Tutorials\n• Download the app: https://youtu.be/pPM2-D-AOS0\n• Login: https://youtu.be/cCD1O988jmk\n• Join live sessions: https://youtu.be/YZV9kexagIM\n• Watch recordings: https://youtu.be/GG5Ms9zB2EY\n• Feed & Channel: https://youtu.be/JFF1_2gaL7w\n• Post on channels: https://youtu.be/fKnmpPAu7Ls\n• Leaderboard: https://youtu.be/vNWCSOo0YZM\n• Yoga & Physio: https://youtu.be/aDVhTSwBf6Q\n• Dashboard (Chrome): https://youtu.be/eEBzvyc9AjE\n\n🌟 What you'll receive: Lifetime Inner Circle Call by Dr Manan Vora · LIVE Physio · LIVE Yoga · Nutrition & Lifestyle Guidance · 21 Days Challenge · Community Support · Session Recordings.\n\n💚 Consistency is the key to recovery. Welcome once again! 💚",
     "link": "https://forms.gle/gL5NhN6xtRdKx3g4A",
     "section": "PHASE A"
    },
    {
     "n": "2",
     "when": "On join",
     "type": "PDF",
     "title": "The Knee Reset Program Guide PDF (3 pages) — sent alongside the welcome message.",
     "text": "Knee Reset Program Guide.pdf (3 pages)",
     "link": "https://drive.google.com/file/d/1FO8uYq9ZG81LLu-t406MgrzeV3bRIXvQ/view?usp=drivesdk",
     "section": "PHASE A"
    },
    {
     "n": "3",
     "when": "On join",
     "type": "Video",
     "title": "Dr. Manan welcome video (sent right after the welcome pack).",
     "text": "Hello everyone! Dr. Manan has a message for you, please check this out",
     "link": "https://drive.google.com/file/d/1YkDYtGXz8IR8gb-0USWFrvGwv6bwZIwz/view?usp=drivesdk",
     "section": "PHASE A"
    },
    {
     "n": "4",
     "when": "On join",
     "type": "Text",
     "title": "Food Guide short nudge (re-used through the week).",
     "text": "Hello everyone! ☀️ Please fill out the Food Guide Selection form below. You will receive your selected food guide via email.\n\nKindly note:\n• Select only one option carefully, as it will be final.\n• Enter your correct email ID to receive the guide.\n\n🔗 https://forms.gle/gL5NhN6xtRdKx3g4A\n\nThank you! 😊",
     "link": "https://forms.gle/gL5NhN6xtRdKx3g4A",
     "section": "PHASE A"
    },
    {
     "n": "5",
     "when": "Bridge",
     "type": "Text",
     "title": "Orientation announcement (hosted by support team, tech/program only — not medica",
     "text": "Hello everyone! 👋\n\nA quick reminder for all Knee Reset Program Members! 🌿\n\nFriday at 6:00 PM, we'll be hosting our New Member Orientation & Weekly Support Call. 🎉\n\nThis session will help you with:\n✅ App and dashboard guidance\n✅ How to access live sessions and recordings\n✅ Understanding the program structure and flow\n✅ Answers to any technical or program-related queries\n\nPlease note: this session is for technical and program-related support only. Medical queries will not be covered.\n\nHosted by Aakriti and Sanya. We look forward to seeing you there!\n\nWarm regards,\nPain Free Club Support Team 💙",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "6",
     "when": "Orientation day",
     "type": "Text",
     "title": "Orientation countdown series — same body, swap the number. Sent at ~day-of, 4h, ",
     "text": "🌿 Hello Silver Members! 💚\n\nA gentle reminder that our New Member Orientation & Support Call is happening today at 6:00 PM.\n\nThis session is specially designed to help you:\n✨ Understand all the benefits of your membership\n✨ Learn how to use the app and access your resources\n✨ Get answers to your questions\n✨ Start your journey with confidence and clarity\n\n🔗 Join here: https://zoom.tagmango.com/redirect/webinar/group/6a507c4e02a655af3b5e9be3\n\nWe can't wait to see you at 6:00 PM! 😊",
     "link": "https://zoom.tagmango.com/redirect/webinar/group/6a507c4e02a655af3b5e9be3",
     "section": "PHASE B"
    },
    {
     "n": "7",
     "when": "Orientation +1",
     "type": "Post",
     "title": "Post-orientation engagement prompt (advice to new members).",
     "text": "✨ A glimpse from today's New Member Orientation & Support Call! 💚\n\nOur newest members have just begun their healing journey, and your experience can make a big difference.\n\n💬 What's ONE piece of advice you'd like to give a new Pain Free Club member?\n\nShare your thoughts here:\nhttps://member.painfreeclub.in/l/eec1279803",
     "link": "https://member.painfreeclub.in/l/eec1279803",
     "section": "PHASE B"
    },
    {
     "n": "8",
     "when": "Orientation +1",
     "type": "Text",
     "title": "Orientation recording + group/challenge-start expectations.",
     "text": "Hello everyone 👋\n\nWe hope the New Member Orientation Call gave you clarity about your journey ahead. If you missed it, watch the recording here 👇\n🔗 https://youtu.be/kfbKVE7flCs\n\nSupport is available Mon–Sat, 10 AM–6 PM 😊\n\nYour group: B19 – 3/8 Knee Reset Program. This will be your only group throughout the program.\n\nYour challenge begins from 3rd August, and you can start attending Yoga & Physio sessions from Monday at 7:00 AM 💪\n\nWarm Regards,\nPain Free Club Support Team 💙",
     "link": "https://youtu.be/kfbKVE7flCs",
     "section": "PHASE B"
    },
    {
     "n": "9",
     "when": "Pre-challenge",
     "type": "Video",
     "title": "21-day challenge preview video + Day-1 preview.",
     "text": "Hello everyone, here's a glimpse of how the 21 Days Challenge will be conducted. Please watch the video below, it will help you navigate the challenge journey smoothly.\n\n🔗 https://youtu.be/LSjipxA-Biw",
     "link": "https://youtu.be/LSjipxA-Biw",
     "section": "PHASE B"
    },
    {
     "n": "10",
     "when": "Challenge Day 1",
     "type": "Text",
     "title": "Daily challenge — Day 1",
     "text": "Day 1 – Foundation of Gratitude\n\n• 🙏 Gratitude: Write down 3 things you are genuinely grateful for today.\n• 🚶‍♀️ Movement: Take a slow, relaxed 10-minute walk, present with your breathing.\n• 💧 Hydration: Add 1 extra glass of water today.\n• 😴 Sleep: Go to bed 15 minutes earlier than usual.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "11",
     "when": "Challenge Day 2",
     "type": "Text",
     "title": "Daily challenge — Day 2",
     "text": "Day 2 – Calming the Nervous System\n\n• 🌬 Breathing: Inhale 4 sec, exhale 6 sec, for 10 rounds.\n• 🧠 Neck: Gentle neck rotations, no jerks.\n• 🍎 Nutrition: Include 1 seasonal fruit.\n• 📵 Sleep habit: Avoid screens 30 min before sleep.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "12",
     "when": "Challenge Day 3",
     "type": "Text",
     "title": "Daily challenge — Day 3",
     "text": "Day 3 – Focus, Strength & Stillness\n\n• 🧠 Focus: Slowly count backwards from 100 to 1.\n• 🔄 Movement: Gentle shoulder rotations.\n• 🥗 Nutrition: Include a good protein source (dal, paneer, eggs, sprouts).\n• 🧘‍♀️ Stillness: Sit quietly 5 minutes and observe your breath.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "13",
     "when": "Challenge Day 4",
     "type": "Text",
     "title": "Daily challenge — Day 4",
     "text": "Day 4 – Light Activity & Positivity\n\n• 📖 Reading: Read 5 pages of a positive book.\n• 🚶‍♀️ Walk: 15-minute easy walk at your comfortable pace.\n• 🥬 Nutrition: Add green vegetables to your meals.\n• 🦵 Recovery: Elevate your legs for 5 minutes.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "14",
     "when": "Challenge Day 5",
     "type": "Text + Video",
     "title": "Daily challenge — Day 5",
     "text": "Day 5 – Emotional Balance\n\n• 💬 Affirmations: Speak 5 positive affirmations aloud with belief.\n• 🦶 Exercise: Slow ankle exercises for balance and mobility.\n• 🚫 Nutrition: Avoid sugar today.\n• 🎶 Relaxation: Listen to calming music with closed eyes 20–30 minutes.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "15",
     "when": "Challenge Day 6",
     "type": "Text",
     "title": "Daily challenge — Day 6",
     "text": "Day 6 – Deep Relaxation & Release\n\n• 🕯 Focus: Candle gazing (Tratak) for 3 minutes.\n• 🧘‍♀️ Stretching: Gentle full-body stretch for 10 minutes.\n• 🌿 Nutrition: Add turmeric or ginger to your meals.\n• 🛁 Recovery: Take a warm bath.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "16",
     "when": "Challenge Day 7",
     "type": "Text",
     "title": "Daily challenge — Day 7",
     "text": "Day 7 – Connection & Reset\n\n• 📞 Connection: Call or talk to an old friend.\n• 🚶‍♀️ Walk: 15-minute relaxed walk.\n• 🍲 Nutrition: Eat only home-cooked food today.\n• 📖 Reading: Read 5 pages before bedtime.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "18",
     "when": "Challenge Day 9",
     "type": "Text + Video",
     "title": "Daily challenge — Day 9",
     "text": "Day 9 – Energy & Sunlight\n\n• ☀ Sun: Sit in sunlight for 15 minutes.\n• 🦵 Exercise: Seated leg raises (5 reps each leg).\n• 🌰 Nutrition: Soaked almonds or walnuts.\n• 📵 Digital: Avoid phone after dinner.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "19",
     "when": "Challenge Day 10",
     "type": "Text",
     "title": "Daily challenge — Day 10",
     "text": "Day 10 – Awareness & Movement Flow\n\n• 🧠 Awareness: Observe your thoughts without judging.\n• 🚶 Movement: Stand or move at least once every hour.\n• 🧂 Nutrition: Reduce salt intake.\n• 🎶 Relaxation: Calming music for 5–7 minutes.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "20",
     "when": "Challenge Day 11",
     "type": "Text + Video",
     "title": "Daily challenge — Day 11",
     "text": "Day 11 – Mood & Gentle Strength\n\n• 😊 Smiling: Smile consciously at least 5 times.\n• 🏋️ Exercise: Lift a water bottle (10 reps × 2 sets) slowly.\n• 🥛 Nutrition: Include curd or chaach.\n• 🧘 Stretching: Gentle stretching before bedtime.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "21",
     "when": "Challenge Day 12",
     "type": "Text",
     "title": "Daily challenge — Day 12",
     "text": "Day 12 – Detox, Mobility & Mental Clarity\n\n• 📝 Journaling: Write your thoughts freely.\n• 🦴 Mobility: Ankle mobility exercises, slowly.\n• 🚫 Nutrition: Avoid fried and packaged foods.\n• 🍵 Night: End the day with turmeric milk or green tea.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "22",
     "when": "Challenge Day 13",
     "type": "Text",
     "title": "Daily challenge — Day 13",
     "text": "Day 13 – Gratitude & Recovery\n\n• 🙏 Gratitude: Write 3 new things you are grateful for.\n• 💧 Hydration: Drink 2 extra glasses of water.\n• 🥗 Nutrition: Add sprouts or a fresh salad.\n• 🧘 Stretching: Full-body gentle stretch.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "23",
     "when": "Challenge Day 14",
     "type": "Text",
     "title": "Daily challenge — Day 14 (same as Day 13)",
     "text": "Day 14 – Gratitude & Recovery\n\n• 🙏 Gratitude: Write 3 new things you are grateful for.\n• 💧 Hydration: Drink 2 extra glasses of water.\n• 🥗 Nutrition: Add sprouts or a fresh salad.\n• 🧘 Stretching: Full-body gentle stretch.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "24",
     "when": "Challenge Day 15",
     "type": "Text + Video",
     "title": "Daily challenge — Day 15",
     "text": "Day 15 – Visualization & Identity Shift\n\n• 🌟 Visualization: Imagine your healthiest, strongest self as already becoming real.\n• Exercise: March walk focusing on control and stability.\n• 🥗 Nutrition: Protein in at least two meals.\n• 😴 Sleep: Sleep before 10:30 pm.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "25",
     "when": "Challenge Day 16",
     "type": "Text + Video",
     "title": "Daily challenge — Day 16",
     "text": "Day 16 – Emotional Strength & Discipline\n\n• 🚫 Discipline: Avoid complaining all day.\n• 💪 Exercise: Light weights / water bottles for shoulders.\n• 🥗 Nutrition: Avoid fried and packaged foods.\n• 🌬 Breathing: 10 minutes of deep breathing.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "26",
     "when": "Challenge Day 17",
     "type": "Text",
     "title": "Daily challenge — Day 17",
     "text": "Day 17 – Joyful Expression & Energy\n\n• 💃 Movement: Play music and dance freely.\n• ☀ Sunlight: 10–15 minutes in natural light.\n• 🍎 Nutrition: Eat seasonal fruits.\n• 📖 Reading: Read 10 pages of a book.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "27",
     "when": "Challenge Day 18",
     "type": "Text",
     "title": "Daily challenge — Day 18",
     "text": "Day 18 – Digital Detox & Reset\n\n• 📵 Detox: Break from screens for at least 1 hour.\n• 🧘 Stretching: 10–15 minutes of gentle stretching.\n• 🥗 Nutrition: Focus on anti-inflammatory foods.\n• 🎶 Relaxation: Calming music before sleep.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "28",
     "when": "Challenge Day 19",
     "type": "Text + Video",
     "title": "Daily challenge — Day 19",
     "text": "Day 19 – Forgiveness & Emotional Healing\n\n• 💛 Forgiveness: Release one emotional burden.\n• 🚶 Movement: Light movement or stretching.\n• 🍎 Nutrition: Seasonal fruits and vegetables.\n• 🦵 Recovery: Alternate leg raise for 5 minutes.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "29",
     "when": "Challenge Day 20",
     "type": "Text",
     "title": "Daily challenge — Day 20",
     "text": "Day 20 – Silence & Deep Reflection\n\n• 🤫 Silence: Spend 1 hour in MAUN (silence) and reflect.\n• 🚶 Movement: 10-minute walk + gentle stretching.\n• 🚫 Nutrition: Avoid outside food completely today.\n• 🌙 Routine: Early, light dinner.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "30",
     "when": "Challenge Day 21",
     "type": "Text",
     "title": "Daily challenge — Day 21 (completion)",
     "text": "Day 21 – Completion & Integration\n\n• 📝 Reflection: Write your complete 21-day journey and reflect on your transformation.\n• 🚶 Movement: A peaceful 20-minute walk.\n• 🥗 Nutrition: Integrate all healthy habits into daily life.\n• 🙏 Gratitude + Breathing: End with deep breathing and gratitude.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "31",
     "when": "Pre-challenge",
     "type": "Poll",
     "title": "Poll — food guide form submitted?",
     "text": "POLL: Have you filled the Google Form for your Food Guide?\n• ✅ Yes, I've submitted it.\n• ⏳ Not yet, I'll do it today.\n• ❓ I can't find the form / I need help.",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "32",
     "when": "Pre-challenge",
     "type": "Poll",
     "title": "Poll — food guide received by email?",
     "text": "POLL: If you filled the Google Form, we've already shared your Food Guide on your registered email ID. Please check your Inbox and Spam/Junk folder. Have you received your Food Guide?\n• 📖 Yes, received it\n• 📂 Found it in Spam/Junk\n• ❌ Not received yet",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "33",
     "when": "Challenge Day 1",
     "type": "Poll",
     "title": "Poll — Day 1 excitement.",
     "text": "POLL: Which Day 1 challenge are you most excited to complete today?\n• 🙏 Gratitude Practice – 3 things I'm grateful for\n• 🚶‍♀️ 10-minute mindful walk\n• 💧 1 extra glass of water\n• 😴 Sleep 15 minutes earlier tonight",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "34",
     "when": "Challenge Day 2",
     "type": "Poll ×4",
     "title": "Day 2 task-check — sent as 4 separate one-tap polls.",
     "text": "POLL 1: Did you complete your 10 rounds of slow breathing today? (✅ Yes, I feel calmer / 😌 Partly / ⏳ Not yet)\nPOLL 2: How did your neck feel after the gentle movements? (😊 More relaxed / 🙂 A little better / 😅 Haven't tried)\nPOLL 3: Did you have a seasonal fruit today? (🍎 Yes / 🍌 Not yet / ❌ Missed)\nPOLL 4: Will you avoid screens 30 minutes before bed tonight? (🌙 Yes / 📱 I'll try / 😅 Not today)",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "35",
     "when": "Challenge Day 3",
     "type": "Poll",
     "title": "Poll — Today's Plate posting nudge.",
     "text": "POLL: Have you posted your update in the Today's Plate channel yet?\n• 🍽️ Yes, I've posted it!\n• ⏳ Not yet, I'll post it soon.\n• 🙋 I need help finding the channel.\n• 😅 I forgot, posting now!",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "36",
     "when": "Challenge Day 4",
     "type": "Poll",
     "title": "Poll — excited for tomorrow (Day 4 tasks).",
     "text": "POLL: Which activity are you most excited to complete tomorrow?\n• 📖 Read 5 pages of an uplifting book\n• 🚶‍♀️ Take a 15-minute easy walk\n• 🥬 Add green vegetables to your meals\n• 🦵 Elevate legs for 5 minutes",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "37",
     "when": "Challenge Day 5",
     "type": "Poll ×4",
     "title": "Day 5 task-check — 4 separate one-tap polls.",
     "text": "POLL 1: Did you complete your 5 positive affirmations today? (✅ Yes / 🟡 Partially / ❌ Not yet)\nPOLL 2: Did you complete your slow ankle exercises today? (✅ / 🟡 / ❌)\nPOLL 3: Were you able to avoid sugar today? (✅ Yes, completely / 🟡 Mostly / ❌ Not yet)\nPOLL 4: Did you spend 20–30 minutes listening to calming music today? (🎶 Yes / 🟡 A few minutes / ❌ Not yet)",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "38",
     "when": "Recurring",
     "type": "Poll",
     "title": "Daily challenge-completion poll (re-used Day 6, 9, 17, 18…).",
     "text": "POLL: Have you completed today's challenge?\n• Yes, completed all 4 tasks ✅\n• Completed 2–3 tasks 💪\n• Completed 1 task 🌱\n• Not yet, I'll do it today ⏳",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "39",
     "when": "Challenge Day 10",
     "type": "Poll ×2",
     "title": "Day 10 polls — Today's Plate + task summary.",
     "text": "POLL A: Have you posted your breakfast photo in the Today's Plate channel today? (🔘 Yes ✅ / 🔘 Not yet 📸 / 🔘 I forgot 😅)\nPOLL B: How many of today's Day 10 challenges did you complete? (🧠 Observe thoughts / 🚶 Move every hour / 🧂 Mind salt / 🎶 Calming music)",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "40",
     "when": "Challenge Day 11",
     "type": "Poll ×5",
     "title": "Day 11 task-check — protein-breakfast poll + 4 task polls.",
     "text": "POLL 0: Did you include a good source of protein in your breakfast today? (Yes ✅ / Not yet 😊)\nPOLL 1: Did you consciously smile at least 5 times today? (Yes 😄 / Not yet / I'll do it today)\nPOLL 2: Did you complete 10 reps × 2 sets of slow water-bottle exercises today? (Yes 💪 / Not yet / I'll do it today)\nPOLL 3: Did you include curd or chaach in your meals today? (Yes 🥛 / Not yet / I'll include it today)\nPOLL 4: Did you do gentle stretching before bedtime? (Yes 🙌 / Not yet / I'll do it tonight)",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "41",
     "when": "Challenge Day 13",
     "type": "Poll",
     "title": "Poll — Day 13 completion + weekly consistency reflection.",
     "text": "POLL: What did you complete today? 👇\n• 🙏 3 Gratitude Points\n• 💧 2 Extra Glasses of Water\n• 🥗 Sprouts/Fresh Salad\n• 🧘‍♀️ Gentle Full-Body Stretch\n\n(Same evening) 💎 How consistent have you been this week? Reflect and vote 🗳️ → https://member.painfreeclub.in/l/b4414aafe7",
     "link": "https://member.painfreeclub.in/l/b4414aafe7",
     "section": "PHASE E"
    },
    {
     "n": "42",
     "when": "Challenge Day 15",
     "type": "Poll ×3",
     "title": "Day 15 task-check — 3 separate one-tap polls.",
     "text": "POLL 1: Did you visualize your healthiest, strongest self today? (✨ Yes / 🧘‍♀️ I'll do it today / ⏳ Not yet / ❌ Missed)\nPOLL 2: Did you complete your march walk? (✅ Yes / 💪 Doing it today / ⏳ Not yet / ❌ Couldn't)\nPOLL 3: Did you include protein in at least 2 meals? (💪 In 1 meal / 🥗 Yes in all meals / ⏳ Not yet)",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "43",
     "when": "Challenge Day 17",
     "type": "Poll",
     "title": "Poll — Day 17 completion.",
     "text": "POLL: How many Challenge did you complete today?\n• All 4! 💪\n• 3\n• 2\n• 1\n• Will try again tomorrow",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "44",
     "when": "Challenge kickoff",
     "type": "Video",
     "title": "Dr. Manan kickoff message video (sent twice), just before the 21-day-challenge p",
     "text": "Hello everyone, Dr. Manan Vora has a message for you. Please check this out.",
     "link": "https://drive.google.com/file/d/1ZmTcwFMXVlOddja6zwAQwSdAQCcxWsfn/view?usp=drivesdk",
     "section": "PHASE F"
    },
    {
     "n": "45",
     "when": "Challenge Day 15",
     "type": "Voice note",
     "title": "Dr. Manan voice note — 'important' mid-challenge message.",
     "text": "Hello everyone! Dr. Manan Vora has a special message for you all. Please take a moment to listen to this voice note. It's important, so don't miss it!",
     "link": "",
     "section": "PHASE F"
    },
    {
     "n": "46",
     "when": "Explainer videos",
     "type": "Note",
     "title": "Reminder: those six challenge-day posts each carry a Dr. Manan explainer video (",
     "text": "(See the Day 5 / 9 / 11 / 15 / 16 / 19 rows in Phase C — Type 'Text + Video'.)",
     "link": "",
     "section": "PHASE F"
    },
    {
     "n": "47",
     "when": "Session recaps",
     "type": "Video",
     "title": "Physio/Yoga session recap videos are posted after most live sessions (no caption",
     "text": "(No caption — posted right after the live Physio/Yoga session, alongside the 'how did today's session feel?' engagement post.)",
     "link": "",
     "section": "PHASE F"
    },
    {
     "n": "48",
     "when": "Victory of the Day",
     "type": "Video",
     "title": "Member transformation / Victory-of-the-Day videos are posted most days (Renu, Uj",
     "text": "(Member testimonial video + the Victory-of-the-Day caption — paste that member's video link.)",
     "link": "",
     "section": "PHASE F"
    },
    {
     "n": "49",
     "when": "Recurring",
     "type": "Text",
     "title": "Physio session reminder (swap the Zoom link each time).",
     "text": "Hello everyone 👋\n\nReminder: Physiotherapy Session today at 7:00 AM on Zoom.\n\nPlease keep a chair and mat handy, and adjust your camera so both standing and seated exercises are visible.\n\n🔗 [paste session Zoom link]\n\nYou can also join through the PFC Community App.\n\nStay strong 💪\nPain Free Club Support Team",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "50",
     "when": "Recurring",
     "type": "Text",
     "title": "Yoga session reminder (swap the Zoom link each time).",
     "text": "Hello everyone 👋\n\nReminder: Live Yoga Session at 7:00 AM (Zoom)\n\nStanding + sitting exercises — please set your camera accordingly.\n\nJoin Here: [paste session Zoom link]\n\nIf you face any issue you can join using the PFC Community App. Session starts 7:00 AM.\n\nStay Strong 💪\nPain Free Club Support Team",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "51",
     "when": "Recurring",
     "type": "Post",
     "title": "Today's Plate nudge — swap in a few member names each time.",
     "text": "Just like [names] & many more members, have you posted your meal photos on the Today's Plate channel in the PFC Community App yet? 🍽️\n\nShare your healthy plate today and inspire the community! 🌿📲",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "52",
     "when": "Recurring",
     "type": "Post",
     "title": "Exercise of the Day nudge — swap in member names.",
     "text": "@all Just like [names] and many more, have you shared your Exercise update on the Exercise of the Day channel in the PFC Community App? 💪😊\n\nSharing daily updates keeps you accountable, builds consistency, and inspires fellow members.\n\nWe're looking forward to your update! 🌿💙",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "53",
     "when": "Recurring",
     "type": "Text",
     "title": "Where to find recordings (how-to).",
     "text": "Hello 😊\n\nTo watch the recorded sessions, please refer to this short video 👇\n🎥 https://youtube.com/shorts/Y4BwuYZ_pIc\n\nOnce you've downloaded the app:\n➡️ Go to Feed ➡️ Click Courses ➡️ Select Yoga / Physio / Inner Circle Call ➡️ Choose the date\n\nIf you face difficulty, reach out — we're here to help 😊\nPain Free Club Support Team",
     "link": "https://youtube.com/shorts/Y4BwuYZ_pIc",
     "section": "PHASE G"
    },
    {
     "n": "54",
     "when": "Recurring",
     "type": "Text",
     "title": "How to post your photos on the app.",
     "text": "Hello everyone! 😊\n\nWe've made a short video explaining how to post your photos on the app. 📸\n\n🎥 Video: https://youtu.be/fKnmpPAu7Ls\n\nPlease watch and follow the steps. If you still face issues after watching, let us know.\n\nThank you! 💚",
     "link": "https://youtu.be/fKnmpPAu7Ls",
     "section": "PHASE G"
    },
    {
     "n": "55",
     "when": "Recurring",
     "type": "Post",
     "title": "Victory of the Day / MPTY celebration — swap member name + achievement.",
     "text": "🌟 Victory of the Day – [Name] Ji! 🌟\n\n[One-line achievement, e.g. 'lost 4.5 kg through consistent habits'] 💚👏\n\nLet's celebrate [Name] Ji's inspiring journey! 🎉\n\n👉 Comment 'MPTY' here to congratulate and encourage: [post link]",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "56",
     "when": "Recurring",
     "type": "Text",
     "title": "Inner Circle Call announcement (Dr. Manan LIVE Q&A).",
     "text": "🌟 Inner Circle Call for Members of the Pain Free Club 🌟\n\nDr. Manan Vora will be LIVE on [day/date] at [time] for our exclusive Inner Circle Call. 🔥\n\nYou can ask:\n✔️ Course-related doubts\n✔️ Exercise or pain-related concerns\n✔️ Recovery or progress questions\n✔️ General questions about your condition\n\n🔗 The joining link will be shared shortly.\n\nWarm Regards,\nPain Free Club Support Team",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "57",
     "when": "Recurring",
     "type": "Image",
     "title": "Weekly schedule (image of session days/timings).",
     "text": "Dear Pain Free Club Members,\n\nYour Weekly Schedule is here, with all your session days and timings in one place.\n\nPlease review it and plan your week in advance so you don't miss any sessions.\n\nStay consistent. Stay committed. Stay Pain Free.",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "58",
     "when": "Recurring",
     "type": "Text",
     "title": "Diamond cross-promotion (invite Silver members to the Diamond Showcase from insi",
     "text": "💎 Hello Silver Members!\n\nCurious to know what makes the Diamond Membership special? Join Dr. Manan Vora for an exclusive Diamond Membership Showcase!\n\n📅 [date] ⏰ [time]\n\nDiscover the extra guidance, support, and roadmap available with Diamond Membership.\n\n📲 Join the WhatsApp group for all updates:\n[paste Diamond WhatsApp group link]\n\nSave the date. See you there! 💙",
     "link": "",
     "section": "PHASE G"
    }
   ]
  },
  {
   "name": "Diamond Nurturing",
   "items": [
    {
     "n": "1",
     "when": "Showcase −6d",
     "type": "Poll",
     "title": "Opening engagement poll — surfaces what members value (used later to tailor pitc",
     "text": "POLL: What kind of support helps you stay most consistent?\n• Personal guidance\n• Community support\n• Live sessions\n• Regular follow-ups\n• All of the above",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "2",
     "when": "Showcase −6d",
     "type": "Voice note",
     "title": "Dr. Manan voice note (react with 👍).",
     "text": "Hello everyone! Dr. Manan Vora has a special message for you. Please listen to the voice note and once you've heard it, react with a 👍",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "3",
     "when": "Showcase −6d",
     "type": "Video",
     "title": "Testimonial — Ganesh Ji (Silver→Diamond, 4-5k→10k steps).",
     "text": "🌟 From Pain to Progress — Ganesh Ji's Inspiring Journey!\n\nGanesh Ji joined our Knee Reset Program (Silver) in Feb 2026 and became a Diamond Member in May 2026.\n\n✅ Severe knee pain reduced significantly\n🚶‍♂️ Progressed from 4,000–5,000 to 10,000 daily steps\n🥗 Learned to balance meals sustainably with personalized nutrition\n\n✨ Don't miss our Diamond Showcase Event. 📅 26th July 🕙 10:00 AM\n\nReact with 👍 once you've seen Ganesh Ji's story!",
     "link": "https://drive.google.com/file/d/1bcMooFk-rJMHwIwFYA-yQ23JzLhvrxgf/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "4",
     "when": "Showcase −6d",
     "type": "Video",
     "title": "Angle — 'why Diamond members get more access'.",
     "text": "💎 Why do Diamond Members get more access to Dr. Manan Vora?\n\nBecause they make a different choice. They choose to invest in themselves, commit to their health and take action.\n\nCurious what Diamond Members receive and why so many are upgrading?\n\nJoin the Diamond Showcase Event 📅 26 July 🕙 10:00 AM 💚",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "5",
     "when": "Showcase −5d",
     "type": "Video",
     "title": "Poll-result reflection tying 'All of the above' to the showcase.",
     "text": "✨ Most of you selected 'All of the above' — personal guidance, community support, live sessions & regular follow-ups. 💚\n\nThat's exactly what creates long-term success.\n\nJoin Dr. Manan in the Diamond Showcase to see how it all comes together. 📅 26th July 🕙 10:00 a.m.",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "6",
     "when": "Showcase −5d",
     "type": "Video",
     "title": "Angle — 'the choice is yours' (react 👍).",
     "text": "🌿 Dr. Manan has a special message for you.\n\nThe choice is yours. Will you sit back and let pain control life? Or choose to move, heal, and take charge?\n\n👍 If you want to be the one walking, moving, and living with confidence, react with a 👍.\n\nAll details shared during our Diamond Showcase. 📅 26th July ⏰ 10:00 AM 💚",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "7",
     "when": "Showcase −5d",
     "type": "Video",
     "title": "Testimonial — Ketna Ji (menopause weight gain → stronger).",
     "text": "✨ Ketna Ji's Inspiring Diamond Transformation 💎\n\nFrom weight gain after menopause to stronger, healthier, more confident. After the Knee Reset Program she upgraded to Diamond — achieving weight loss, inch loss, improved strength and a more active lifestyle.\n\n🎥 Watch her full journey. Join the Diamond event 📅 26th July 🕙 10:00 AM. Exciting prizes to be won! 🎁",
     "link": "https://drive.google.com/file/d/1vEaspsyajq1IwgLp5Nc-i3OYdUhfeGFl/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "8",
     "when": "Showcase −4d",
     "type": "Image",
     "title": "Angle — what happens beyond the live sessions (personalized Movement Plan).",
     "text": "✨ The live yoga & physio sessions are just the beginning.\n\nAfter his live session, Durgesh Ji continued with his personalized Movement Plan from Dr. Manan and team — exercises designed for his knee.\n\nThat extra step helps members recover faster. Curious what happens beyond the live sessions? 📅 Diamond event 26th July 🕙 10:00 AM 🌿",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "9",
     "when": "Showcase −4d",
     "type": "Video",
     "title": "Testimonial (family voice) — Trupti ji, via granddaughter Simran.",
     "text": "Hello everyone! 👋 This is Simran, speaking on behalf of her grandmother, Trupti ji.\n\n🌿 Listen to how joining Dr. Manan Vora's Pain Free Club Diamond Membership has made a meaningful difference in her grandmother's healing journey. 💙",
     "link": "https://drive.google.com/file/d/1ZQvUvhje2nLyVEp_LUQrjY7O-vSUecsI/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "10",
     "when": "Showcase −4d",
     "type": "Video",
     "title": "Angle — 'the missing piece is the right guidance' (reply 💎).",
     "text": "✨ What if the missing piece in your healing journey isn't more effort — but the right guidance? 💎\n\nJoin Dr. Manan for the Diamond Showcase and discover how personalized guidance drives better results.\n\n📅 Sunday, 26th July 🕙 10:00 AM. Reply with 💎 if you'll be there!",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "11",
     "when": "Showcase −3d",
     "type": "Video",
     "title": "Testimonial — Nirmala Ji (81, weight + knee pain, back to family life).",
     "text": "💎 The greatest gift at 81 wasn't just weight loss — it was getting her life back.\n\n81-year-old Nirmala Ji joined Diamond. Today she has lost weight, her knee pain has reduced, and she enjoys precious moments with her children, grandchildren and great-grandchildren with ease.\n\nIf she can start at 81, imagine what's possible for you.",
     "link": "https://drive.google.com/file/d/1owR0IIR4sZ5v78iwDz-DJagfwgTl_xAj/view?usp=drivesdk",
     "section": "PHASE B"
    },
    {
     "n": "12",
     "when": "Showcase −3d",
     "type": "Poll",
     "title": "Engagement poll — clarity gaps.",
     "text": "POLL: What do you wish you had more clarity about?\n• Which exercises are right for me\n• What foods I should eat\n• Why my pain isn't improving\n• My long-term knee pain reversal plan\n• All of the above",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "13",
     "when": "Showcase −3d",
     "type": "Video",
     "title": "Objection-handler — 'is Diamond just a nutritionist/physio replacement?' (react ",
     "text": "In this video, Dr. Manan addresses a common question: Is the Diamond Membership just a replacement for a personal nutritionist or physiotherapist?\n\nIt's so much more — a complete personal health ecosystem to help you live pain-free, build strength, lose weight, and gain independence. 🙌\n\nJoin the Diamond Showcase 📅 26th July 🕙 10:00 AM. React 👍 once watched.",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "14",
     "when": "Showcase −2d",
     "type": "Text",
     "title": "OPEN group for one-word engagement (build energy).",
     "text": "💎 Hello Silver Members! 💙\n\nBefore the Diamond Showcase on Sunday 26th July at 10:00 AM, we'd love to hear from you.\n\n💬 In just ONE word, tell us how you're feeling about the Diamond Showcase!\n(Excited 🤩 · Curious 👀 · Hopeful 💙 · Ready 💪 · Motivated 🔥 · Inspired 🌟 …)\n\n👇 Drop your ONE word and let's fill this group with positive energy!",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "15",
     "when": "Showcase −2d",
     "type": "Video",
     "title": "Testimonial — Neena Ji (told knee replacement was the only option).",
     "text": "🚶‍♀️ Do you struggle to get up after sitting on the floor? Told knee replacement is your only option?\n\nBefore you lose hope, hear Neena Ji's journey (shared by her daughter-in-law). With Dr. Manan's guidance, Diamond Membership, nutrition support and guided strength training, she is now living a more active, pain-free life.\n\n📅 26 July ⏰ 10:00 AM 💎",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "16",
     "when": "Showcase −1d",
     "type": "Video",
     "title": "Guru Purnima hook (mentor angle).",
     "text": "🙏 This Guru Purnima, ask yourself one question…\n\nInformation is everywhere. The right guidance is rare. When pain increases, when you're confused whether to exercise or rest — who guides you?\n\n🎥 Watch Dr. Manan's special Guru Purnima message. ✨ Tomorrow | 26th July | 10:00 AM.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "17",
     "when": "Showcase −1d",
     "type": "Text",
     "title": "24-hours reminder — reveals a live-only Guru Purnima offer.",
     "text": "⏳ Just 24 Hours to Go! 💎\n\nTomorrow Dr. Manan unveils the Diamond Showcase — how members are transforming and what makes Diamond unique.\n\n✨ Special Guru Purnima Offer — revealed ONLY during the live session, nowhere else.\n\n📅 26th July, 10 AM\n🔗 https://drmananvora.in/diamondshowcase",
     "link": "https://drmananvora.in/diamondshowcase",
     "section": "PHASE C"
    },
    {
     "n": "18",
     "when": "Showcase −1d",
     "type": "Video",
     "title": "Emotional close — 'one decision could change the next 20 years'.",
     "text": "⏰ Tomorrow. 10:00 AM. One decision could change the next 20 years of your life. 💎\n\nIf knee pain has stopped you walking freely, climbing stairs, travelling, or enjoying loved ones — tomorrow is your chance to change that.\n\n🎁 A special Guru Purnima offer revealed exclusively during the live session.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "19",
     "when": "Showcase day",
     "type": "Text",
     "title": "Showcase-day countdown series — same body, swap the number (2h / 90m / 30m / 20m",
     "text": "⏳ Just 2 Hours to Go! 💎\n\nOnly 2 hours left for the Diamond Showcase with Dr. Manan Vora!\n\n✨ Hear inspiring success stories\n🎁 Unlock the exclusive Guru Purnima Offer (revealed only during the live session)\n\n📅 Today | 10:00 AM\n🔗 https://drmananvora.in/diamondshowcase\n\nSee you live! 💙",
     "link": "https://drmananvora.in/diamondshowcase",
     "section": "PHASE C"
    },
    {
     "n": "20",
     "when": "Showcase day",
     "type": "Text",
     "title": "WE ARE LIVE + repeated join blasts (many FOMO variants sent every few minutes du",
     "text": "⏳ WE ARE LIVE 💎\n\nDiamond Showcase with Dr. Manan Vora is LIVE now!\n\n✨ Real success stories 🎁 Exclusive Guru Purnima Offer (LIVE only)\n\nJoin now: 🔗 https://drmananvora.in/diamondshowcase 💙",
     "link": "https://drmananvora.in/diamondshowcase",
     "section": "PHASE C"
    },
    {
     "n": "21",
     "when": "Showcase +1d",
     "type": "Poll",
     "title": "Objection poll for non-joiners (drives the 1:1 follow-up).",
     "text": "POLL: We noticed you haven't joined the Diamond Membership yet. 💎\nWe'd love to understand what's stopping you.\n• I'm still thinking about it\n• I need more information\n• I need to discuss it with my family\n• I'm not interested right now",
     "link": "",
     "section": "PHASE D"
    }
   ]
  },
  {
   "name": "Diamond Onboarding",
   "items": [
    {
     "n": "1",
     "when": "On booking",
     "type": "Video",
     "title": "Welcome Party announcement video — invite to the 8 PM live welcome; ask for a 👍.",
     "text": "🎉 Hello everyone!\n\nToday's Welcome Party for all our Diamond members is at 8:00 PM! 🥳\n\nWe'd love each one of you to join us and keep your camera on so we can interact and make some beautiful memories together. 📸✨\n\nThe joining link will be shared shortly.\n\nWe're so excited to meet you all! See you sharp at 8:00 PM. If you've seen this message, react with a 👍",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "2",
     "when": "On booking",
     "type": "Poll",
     "title": "Attendance poll for the Welcome Party.",
     "text": "POLL: Will you be joining the Diamond Welcome Party today at 8:00 PM? 🎉\n• 💎 YES! I can't wait!\n• ⏰ I'll try my best to join!\n• 😔 I'll miss it.",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "3",
     "when": "On booking",
     "type": "Text",
     "title": "Welcome Party countdown — same body, swap the number (2h / 90m / 75m / 60m / 30m",
     "text": "💎 Just 2 Hours to Go!\n\nOur Diamond Members Welcome Party starts at 8:00 p.m. 🎉\n\nWe look forward to welcoming you and helping you get started on your journey.\n\n🔗 Join here: [paste meeting link]\n\nSee you at 8:00 p.m.! 💚",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "4",
     "when": "On booking",
     "type": "Text",
     "title": "Go-live blast + a '5 minutes in' follow-up (Zoom link).",
     "text": "🟢 WE ARE LIVE! 💎🎉\n\nThe Diamond Members Welcome Party has just begun!\n\nJoin us now and don't miss your warm welcome, important guidance, and the opportunity to connect with the Pain Free Club community.\n\n🔗 Join here: [paste Zoom link]\n\nWe're waiting for you! 💚",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "5",
     "when": "On booking",
     "type": "Image + Text",
     "title": "Dr. Manan post-party thank-you note (with a photo of the party).",
     "text": "✨ A beautiful beginning to a powerful journey! 💎💚\n\nWelcome to all our new Diamond Members! It was wonderful meeting you during today's Welcome Party and seeing your enthusiasm to take charge of your health.\n\nToday marks the beginning of a commitment to yourself. Take one step at a time, stay consistent, ask for help whenever you need it, and trust the process. Small daily actions create life-changing results.\n\nWith gratitude,\nDr. Manan Vora 💚",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "6",
     "when": "On booking",
     "type": "Voice note",
     "title": "Dr. Manan voice-note message right after the party.",
     "text": "Hello Everyone, @all\nDr. Manan has a message for you!",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "7",
     "when": "On booking",
     "type": "Post",
     "title": "Point members to a new Community post.",
     "text": "💎 Hello Diamond Members!\n\nWe've just shared a new post in the Community. 💚\n\nCheck this out:\n🔗 https://member.painfreeclub.in/l/1be0b7ec97",
     "link": "https://member.painfreeclub.in/l/1be0b7ec97",
     "section": "PHASE A"
    },
    {
     "n": "8",
     "when": "Booking +1 day",
     "type": "Text",
     "title": "WhatsApp (1:1 + group)",
     "text": "Clinical lead begins 1:1 outreach; ask members to save her number.",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "9",
     "when": "Booking +1 day",
     "type": "Video",
     "title": "Dr. Manan special message video (👍).",
     "text": "Hello Diamond Members! 💎 @all\n\nDr. Manan has a special message for you. 🙏\n\n🎥 Please watch the video above, and once you've watched it, react with a 👍 so we know you've seen it.\n\nThank you! 💚",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "10",
     "when": "Onboarding window",
     "type": "Video",
     "title": "Daily assignment — watch Dr. Manan's video, complete the assignment before 7 PM.",
     "text": "Hello everyone,\n\nPlease watch this video by Dr. Manan. This will be your assignment for today.\n\nOnce you have watched the video, please complete the assignment before 7 PM today.\n\nLooking forward to your participation. 😊",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "11",
     "when": "Onboarding window",
     "type": "Text",
     "title": "The assignment video link (YouTube).",
     "text": "🎥 Video Link: https://youtu.be/NdsQYdQfza0",
     "link": "https://youtu.be/NdsQYdQfza0",
     "section": "PHASE C"
    },
    {
     "n": "12",
     "when": "Onboarding window",
     "type": "Poll",
     "title": "Assignment completion poll.",
     "text": "POLL: Have you completed yesterday's assignment?\n• ✅ Yes, watched the video and completed the assignment\n• ⏳ Not yet, will complete it today",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "13",
     "when": "Onboarding window",
     "type": "Text + Video",
     "title": "Open the group and invite each member's one learning from the assignment (Dr. Aa",
     "text": "Good evening everyone! Dr. Manan is really excited to read your insights on the assignment that was shared yesterday ✨",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "14",
     "when": "Occasion",
     "type": "Video",
     "title": "Occasion message from Dr. Manan (e.g. Guru Purnima) — 👍 to confirm viewed.",
     "text": "🌸🙏 Hello Diamond Members, Happy Guru Purnima! 🙏🌸 @all\n\nWishing each one of you a very Happy Guru Purnima! 🌼\n\nOn this special occasion, Dr. Manan Vora has a heartfelt message just for you. ❤️\n\n👍 Once you've watched it, react with a 👍.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "15",
     "when": "On full payment",
     "type": "Text + Image",
     "title": "Personalised payment-confirmation congrats (tag the member). This is the graduat",
     "text": "🎉 Congratulations, [Name] Ji! 💎 @[member]\n\nWelcome to the Diamond Membership! Your full payment has been successfully received, and your membership is now confirmed.\n\nWe are excited to be a part of your journey towards a healthier, happier, and pain-free life. ✨💎",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "16",
     "when": "On full payment",
     "type": "Text",
     "title": "Batch message before moving paid members to the official Diamond Family group.",
     "text": "Hello [names] 💎\n\nCongratulations and welcome once again on becoming a part of the Diamond Membership! 🎉\n\nWe will now be removing you from this temporary group and adding you to the official Diamond Membership Community WhatsApp Group, where you'll receive all important updates, announcements, and community support.\n\nWe look forward to welcoming you there! 🙏",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "17",
     "when": "New batch added",
     "type": "Video",
     "title": "Dr. Manan welcome video for a fresh batch added to the holding group later (👍).",
     "text": "Hello Diamond Members! 💎\n\nDr. Manan has a special message for you. 🙏\n\n🎥 Please watch the video above, and once you've watched it, react with a 👍.\n\nThank you! 💚",
     "link": "",
     "section": "PHASE D"
    }
   ]
  },
  {
   "name": "Diamond Family",
   "items": [
    {
     "n": "1",
     "when": "On joining (paid in full)",
     "type": "Text",
     "title": "Warm welcome to the Diamond Family + what this group is for. Tag the new intake.",
     "text": "🎉💎 A Warm Welcome to Our Diamond Family! 💎🎉\n\nA heartfelt welcome to [names]! 🌸\n\nCongratulations on becoming a part of the Diamond Membership! We are delighted to have you with us and look forward to supporting you on your journey towards a healthier, happier, and pain-free life. 🌿✨\n\nThis Diamond Membership Community will be your primary space for:\n✅ Important health updates from Dr. Manan Vora\n✅ Diamond Membership announcements & reminders\n✅ Exclusive calls with Dr. Manan\n✅ Live session notifications\n\n📢 Please keep your notifications ON so you don't miss any important updates.\n\nWelcome to the Diamond Family! 💙🙏",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "2",
     "when": "On joining",
     "type": "Video",
     "title": "Official community welcome + orientation date + 'membership starts on [date]' no",
     "text": "💎 Welcome to the Official Diamond Community! @all\n\nImportant for New Members:\nYour official Diamond Membership starts on [date]. Until then, we'll be completing your onboarding and orientation. These days will not be counted in your membership period.\n\n📅 Diamond Orientation with Dr. Manan\n🗓 [Day] | 🕗 8:00 PM\n\nThis session is for all Diamond Members (new & existing). You'll receive an overview of the Diamond journey and meet your Diamond Coaches.\n\nReact with a 👍 once you've read this message.",
     "link": "",
     "section": "PHASE A"
    },
    {
     "n": "3",
     "when": "Orientation day",
     "type": "Text",
     "title": "Orientation-call countdown — swap the number + Zoom link.",
     "text": "⏳ 4 HOURS TO GO ⏳\n\nHello everyone @all,\n\nThis is a gentle reminder that our Diamond Members Onboarding Call starts today at 8:00 PM.\n\nWe're excited to welcome you and help you get the most out of your Diamond Membership journey.\n\n🔗 Join here: [paste Zoom link]\n\nSee you at 8 PM! ✨",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "4",
     "when": "Orientation day",
     "type": "Post",
     "title": "Post-call engagement — comment 'I am ready' on the meeting post.",
     "text": "Hello Diamond Members! Today's meeting post is now live! Please click the link below and drop 'I am ready' in the comment section!\n\nHere's the link — https://member.painfreeclub.in/l/2991c1b13a",
     "link": "https://member.painfreeclub.in/l/2991c1b13a",
     "section": "PHASE B"
    },
    {
     "n": "5",
     "when": "Orientation +1 day",
     "type": "Text",
     "title": "Share the orientation recording for anyone who missed it.",
     "text": "Good evening everyone 🙏✨\n\nFor those who missed yesterday's orientation call, here's the recording so you can catch every bit of it:\nhttps://vimeo.com/1215446448\n\nPlease reach out if you have any questions.\n\nDr. Aakriti Chaudhry, Clinical Lead, Pain Free Club 💎❤️",
     "link": "https://vimeo.com/1215446448",
     "section": "PHASE B"
    },
    {
     "n": "6",
     "when": "Pre-start",
     "type": "Image",
     "title": "Warm 'behind the scenes' preview before the program officially starts.",
     "text": "Good evening Diamond family 🙏✨\n\nWhile your official program begins next week, we didn't want you waiting around without a glimpse of what's happening behind the scenes!\n\nHere's Dr. Manan and our team hard at work, putting together everything going into making your journey personalized and impactful right from day one. 💎",
     "link": "",
     "section": "PHASE B"
    },
    {
     "n": "7",
     "when": "Setup",
     "type": "Text",
     "title": "Announcements-only channel charter — what gets sent here.",
     "text": "💎 Welcome to The Diamond Family\n\nThis group is your one stop for everything important related to your Diamond membership.\n\nHere's what we'll send here:\n🗓️ Your weekly schedule\n🔔 Live session reminders & joining links\n💡 Quick tips from Dr. Manan\n📚 New resources & updates\n⏱️ Any important changes\n\n• Please keep notifications ON — it's how your session links reach you on time.\n• This is an announcements-only channel, so every message here is worth opening.",
     "link": "",
     "section": "PHASE C"
    },
    {
     "n": "8",
     "when": "Recurring — Saturdays",
     "type": "Image",
     "title": "Weekly schedule image; sent every Saturday.",
     "text": "💎✨ Hello, Diamond Family! @all\n\nYour Weekly Schedule is here! 🗓️💪\n\nPlan your week, set your reminders and stay consistent! 🔥\n\nLet's make every workout count! 💎❤️",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "9",
     "when": "Recurring — session days",
     "type": "Text",
     "title": "Live Workout reminder + equipment prep + Zoom link. Swap time & equipment each s",
     "text": "🌟 Hello Diamond Members! 💎\n\nYour Diamond Live Workout is happening today at [time]! 💪\n\nPlease keep ready before the session:\n• Resistance Bands (if you have)\n• Water bottle or Dumbbells (1–2 kg)\n• Yoga mat & chair\n\n🔗 Join here: [paste Zoom link]\n\nSee you at [time]! 💙",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "10",
     "when": "Recurring — after workout",
     "type": "Post",
     "title": "Post-workout engagement — one-word feeling on the Community post.",
     "text": "💎 Diamond Members, your workout is DONE! 🔥💪 @all\n\nHead to the PFC Community App and share your post-workout feeling in ONE word! 👇\n🔗 [paste community post link]",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "11",
     "when": "Recurring — weekly",
     "type": "Text",
     "title": "Weekly Momentum Call with the Nutrition / Movement coach + Zoom link.",
     "text": "💎 Hello Diamond Members! 💎\n\nYour Weekly Momentum Call is happening today with your [Nutrition Coach Bhavna / Movement Coach Dr. Namira]! 🎉\n\n🕖 Join us today at 7:00 PM\n🔗 Join here: [paste Zoom link]\n\nLooking forward to having you all! 💙✨",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "12",
     "when": "Recurring — after momentum call",
     "type": "Post",
     "title": "Post-call feedback prompt on the Community post.",
     "text": "💎 Diamond Members, how was your Weekly Momentum Call with [coach]? 💙\n\nShare your biggest takeaway in the comments 👇\n🔗 [paste community post link]",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "13",
     "when": "Recurring — on a member win",
     "type": "Image + Text",
     "title": "Celebrate a member milestone; ask the group to react ❤️/👍.",
     "text": "🎉 Another amazing milestone by our Diamond Member, [Name] Ji! 💎 @[member]\n\n[One-line achievement — e.g. '13,361 steps today' / '4 kg + 2 inches off, walking long distances' / 'climbed stairs without support' / 'dancing with her daughter again']. 👏❤️\n\nShow your appreciation by reacting with a ❤️!",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "14",
     "when": "Recurring",
     "type": "Text",
     "title": "Short motivational tip/quote from Dr. Manan (react 👍).",
     "text": "\"A cat that dreams of becoming a lion must lose its appetite for rats.\"\n\nIf this resonated with you, react with a 👍🏻",
     "link": "",
     "section": "PHASE D"
    },
    {
     "n": "15",
     "when": "First weeks",
     "type": "Video",
     "title": "Pre-Assessment Deep Dive — Dr. Manan explainer video (why the form matters).",
     "text": "Dear Diamond Family 🌸\n🎥 For all new Diamond members — a short video from Dr. Manan explaining the purpose of your Pre-Assessment Deep Dive Form and how it shapes your program.\n(Form link in the next message.)",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "16",
     "when": "First weeks",
     "type": "Text",
     "title": "Pre-Assessment Deep Dive form — book the Deep Dive call at the end.",
     "text": "📋 Your Pre-Assessment Deep Dive Form: https://forms.gle/g5r9Aihdz8FL6EpNA\n\nThis helps your movement and nutrition coaches build your program around you specifically. Once you complete it, you'll be able to book your Deep Dive Call at the end. We recommend watching the video first, then filling the form in one sitting.",
     "link": "https://forms.gle/g5r9Aihdz8FL6EpNA",
     "section": "PHASE E"
    },
    {
     "n": "17",
     "when": "As scheduled",
     "type": "Video",
     "title": "Trainer feedback — Dr. Manan intro video.",
     "text": "Hello Diamond Family! 🙏\nDr. Manan has a quick message for you above 🎥 — we're sharing an exclusive feedback form on your physio and yoga trainers, only for our Diamond members.\n(Form link in the next message.)",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "18",
     "when": "As scheduled",
     "type": "Text",
     "title": "Physio/yoga trainer feedback form (Diamond-only).",
     "text": "📝 Fill it here: https://forms.gle/8YTGRYDed11xS7x38\nYour honest feedback helps us keep improving your experience. Thank you for taking a few minutes for this 🌸",
     "link": "https://forms.gle/8YTGRYDed11xS7x38",
     "section": "PHASE E"
    },
    {
     "n": "19",
     "when": "As needed",
     "type": "Text",
     "title": "Schedule-change notice.",
     "text": "Good evening Diamond family 🙏\nA quick update on this week's schedule: the [day] session will now take place on [new day/time], same duration. Apologies for the short notice — we've made the shift so the session runs smoothly and everyone gets full value. Looking forward to seeing you all there! 😊🌸",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "20",
     "when": "Special event",
     "type": "Video",
     "title": "Special-event invite (e.g. Moveathon) — Dr. Manan video.",
     "text": "Hi Diamond Family! A special event is happening for you. Watch Dr. Manan's video, then join using the group link in the next message.",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "21",
     "when": "Special event",
     "type": "Text",
     "title": "Special-event WhatsApp group link (e.g. Moveathon).",
     "text": "Moveathon WhatsApp group link — [paste event group link]",
     "link": "",
     "section": "PHASE E"
    },
    {
     "n": "22",
     "when": "As scheduled",
     "type": "Poll",
     "title": "Opt-in poll for the Diamond Accountability Circle group. Its intro video is item",
     "text": "POLL: Do you wish to be added to the Diamond Accountability Circle WhatsApp Group?\n• Yes, I'd like to be a part of this\n• No, I don't want more messages and groups",
     "link": "",
     "section": "PHASE F"
    },
    {
     "n": "23",
     "when": "On group creation",
     "type": "Video",
     "title": "Diamond Community welcome video from Dr. Manan.",
     "text": "Good evening everyone! Welcome to your Diamond Community group, Dr. Manan wanted to drop in with a welcome message! 💎✨",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "24",
     "when": "Occasional",
     "type": "Video",
     "title": "Dr. Manan special message video.",
     "text": "Good evening, Diamond Family! Dr. Manan has a special message for all of you 😊💎",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "25",
     "when": "Occasional",
     "type": "Video",
     "title": "Dr. Manan drops a video for the group (👍 to confirm viewed).",
     "text": "Hello @all please have a look at this ☺️\n\nGive me a 👍🏻 reaction to the above video once you've seen it!",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "26",
     "when": "Occasional",
     "type": "Voice note",
     "title": "Dr. Manan voice note (motivational / quick thought). Example carried the line be",
     "text": "\"A cat that dreams of becoming a lion must lose its appetite for rats.\"\n\nIf this resonated with you, react with a 👍🏻",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "27",
     "when": "Occasional",
     "type": "Video",
     "title": "Dr. Manan personal / relatability video (builds connection).",
     "text": "Just wanted to share this video with The Diamond Family! ❤️🥰 Just how most of you are here to learn about your health, I too am learning about parenting each and every day! ✨",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "28",
     "when": "Occasion",
     "type": "Video",
     "title": "Festival / occasion greeting video from Dr. Manan (e.g. Independence Day).",
     "text": "Happy Independence Day to each and every one of you! ❤️🇮🇳",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "29",
     "when": "As scheduled",
     "type": "Video",
     "title": "Accountability Circle intro video — 'watch, then vote' (pairs with the Phase F p",
     "text": "Please watch the entire video and then vote in the poll below. ⏬",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "30",
     "when": "Bonus",
     "type": "Video",
     "title": "Extra/bonus workout announcement from Dr. Manan (with video).",
     "text": "Hi Diamond Family, we're conducting ONE MORE workout session today at [time] only for you! 💪\n\nPlease keep ready: • Yoga Mat & Chair\n\n🔗 Join here: [paste Zoom link]\n\nReact to this message with a ❤️",
     "link": "",
     "section": "PHASE G"
    },
    {
     "n": "31",
     "when": "Occasional",
     "type": "Video",
     "title": "Uncaptioned Dr. Manan videos are posted from time to time — attach the link and ",
     "text": "(No caption — Dr. Manan video. Note the topic when you attach the link.)",
     "link": "",
     "section": "PHASE G"
    }
   ]
  },
  {
   "name": "Regular Messages",
   "items": [
    {
     "n": "1",
     "when": "",
     "type": "Reply",
     "title": "Where can I find the recordings? / How do I watch a recorded session?",
     "text": "Hello 😊\nTo watch the recorded sessions, please refer to this short video 👇\n🎥 https://youtube.com/shorts/Y4BwuYZ_pIc\n\nOnce you've downloaded the app:\n➡️ Go to Feed ➡️ Click Courses ➡️ Select Yoga / Physio / Inner Circle Call ➡️ Choose the date\n\nIf you face difficulty, feel free to reach out — we're here to help 😊\nPain Free Club Support Team",
     "link": "https://youtube.com/shorts/Y4BwuYZ_pIc",
     "section": "Access"
    },
    {
     "n": "2",
     "when": "",
     "type": "Reply",
     "title": "How do I download / log in to the app?",
     "text": "📱 Apple App Store: https://apps.apple.com/in/app/pfc-community/id6758769658\n📱 Android Play Store: https://play.google.com/store/apps/details?id=com.tagmango.painfreeclub\n\nLog in using your registered mobile number.",
     "link": "",
     "section": "Access"
    },
    {
     "n": "3",
     "when": "",
     "type": "Reply",
     "title": "How do I post my photos / update on the app?",
     "text": "Hello everyone! 😊\nWe've made a short video explaining how to post your photos on the app. 📸\n🎥 Video: https://youtu.be/fKnmpPAu7Ls\nPlease watch and follow the steps. If you still face issues, let us know. Thank you! 💚",
     "link": "https://youtu.be/fKnmpPAu7Ls",
     "section": "Access"
    },
    {
     "n": "4",
     "when": "",
     "type": "Reply",
     "title": "What time is the session today? / Is the session today?",
     "text": "Hello [name] ji, the session is today at [time]. 😊",
     "link": "",
     "section": "Schedule"
    },
    {
     "n": "5",
     "when": "",
     "type": "Reply",
     "title": "Where do I join the live Yoga / Physio session?",
     "text": "Reminder: Live [Yoga/Physio] Session at 7:00 AM (Zoom). Please keep a chair and mat handy and set your camera so standing + seated exercises are visible.\n🔗 [paste today's session Zoom link]\nYou can also join through the PFC Community App. Stay strong 💪",
     "link": "",
     "section": "Schedule"
    },
    {
     "n": "8",
     "when": "",
     "type": "Reply",
     "title": "Can I share my X-ray / MRI / medical reports in the group?",
     "text": "Hello! 😊\nAll the information about how to read your X-rays and identify the stage of your knee arthritis or condition will be covered during the webinar.\nTill then, we request you not to share your MRI reports, X-ray reports, or any other medical reports in the WhatsApp group.\nThank you for your understanding! 🙏",
     "link": "",
     "section": "Clinical / policy"
    },
    {
     "n": "9",
     "when": "",
     "type": "Reply",
     "title": "How much does the program cost / what's included?",
     "text": "What you get?\n✔️ Lifetime Inner Circle calls with Dr. Manan Vora\n✔️ 2 Yoga + 2 Physio Sessions/week (1 full year)\n✔️ Food guidance\n✔️ 21-day Knee Reset Challenge\n✔️ Full access to all recordings & courses\n👉 Join: https://member.painfreeclub.in/l/0581743fc4",
     "link": "https://member.painfreeclub.in/l/0581743fc4",
     "section": "Pricing"
    },
    {
     "n": "10",
     "when": "",
     "type": "Reply",
     "title": "Is there no session today?",
     "text": "Dear Members, there will be no live session tomorrow. Our Inner Circle Call is scheduled for [day] at [time]. In the meantime, you may access the recorded Yoga or Physiotherapy sessions on your dashboard. Thank you for your understanding. 💙",
     "link": "",
     "section": "Schedule"
    }
   ]
  }
 ]
};

const ANSWER_BANK = (FAQ.intents || [])
  .map((i) => `- (${i.category}) ${i.id}: ${i.answer || "[no approved text — route to team]"}`)
  .join("\n");

const SYSTEM_PROMPT = `You are Bruno, the Pain Free Club (PFC) WhatsApp assistant. You DRAFT a reply for a human on the PFC team to review and send — never the final word.

You have all of PFC's context below (the "PFC Brain"). Use it so you can answer ANY reasonable member question in PFC's voice — not just the pre-written ones — while staying inside the hard guardrails.

===== PFC BRAIN (background knowledge — this is who you are and what you know) =====
${PFC_BRAIN}
===== END PFC BRAIN =====

HOW TO WRITE THE REPLY, in this order of trust:
1. If the message matches an "Approved answer" below, use it. Copy any link, timing, or placeholder ([Zoom link], [time]) EXACTLY — you may only reword the greeting to fit the member.
2. If it's a general community / logistics / program question NOT in the approved list, write a brief, warm, on-brand reply grounded in the PFC Brain and the member's own message. Set needs_review=true.
3. Mirror the member's language: reply in Hindi/Hinglish if they wrote that way, English if they did.

HARD GUARDRAILS (never break — repeated from the Brain because they matter most):
- NEVER give medical advice, a diagnosis, or interpret a scan/report (MRI/X-ray). Anything about symptoms, pain, medicines, dosages, injections or surgery → gentle hand-off ("we wouldn't want to advise over chat — our team will connect you with the right person") and set escalate=true.
- NEVER quote a price / fee / rupee figure. Say the team will share current pricing and details; set needs_review=true.
- NEVER invent a link, phone number, address, clinic timing, date or policy. If you don't know a specific fact, say the team will confirm it and set needs_review=true.
- Every reply is a DRAFT a human reviews and sends.

Approved answers (highest-trust facts — copy links/placeholders verbatim):
${ANSWER_BANK}

Respond with STRICT JSON only (no prose, no code fences):
{"reply": "<the suggested reply>", "escalate": <true|false>, "needs_review": <true|false>}
Set needs_review=true whenever you wrote something not taken directly from an approved answer, or anything is uncertain.`;

function extractJson(text) {
  try { return JSON.parse(text); } catch (_) {}
  const m = text && text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}

async function compose(message, env) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.MODEL || "claude-haiku-4-5",
      max_tokens: 700,
      // System prompt is large and static (the PFC Brain), so cache it —
      // repeat replies only pay for the short member message.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Member's message:\n"""${message}"""` }],
    }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = extractJson(text) || {};
  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    escalate: parsed.escalate === true,
    needs_review: parsed.needs_review === true,
  };
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "https://web.whatsapp.com";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-pfc-key",
      "Vary": "Origin",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, ai: !!env.ANTHROPIC_API_KEY, faq: (FAQ.intents || []).length, library: (LIBRARY.groups || []).reduce((n, g) => n + (g.items || []).length, 0) });
    }
    // Thin-client content endpoints — the userscript fetches these live so it
    // never needs re-pasting when content changes.
    if (request.method === "GET" && url.pathname === "/faq") return json(FAQ);
    if (request.method === "GET" && url.pathname === "/library") return json(LIBRARY);
    if (request.method === "POST" && url.pathname === "/compose") {
      if (env.SHARED_SECRET && request.headers.get("x-pfc-key") !== env.SHARED_SECRET) {
        return json({ error: "unauthorized" }, 401);
      }
      if (!env.ANTHROPIC_API_KEY) return json({ error: "AI not configured" }, 503);
      let body;
      try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }
      const message = (body.message || "").toString().slice(0, 4000);
      if (!message.trim()) return json({ error: "empty message" }, 400);
      try {
        return json(await compose(message, env));
      } catch (e) {
        return json({ error: "compose failed" }, 502);
      }
    }
    return json({ error: "not found" }, 404);
  },
};
