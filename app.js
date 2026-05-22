
window.addEventListener("error", function(e){
  const el=document.getElementById("app");
  if(el){el.innerHTML=`<div class="error"><b>Erreur JavaScript :</b>\n${e.message}\n\nFichier : ${e.filename}\nLigne : ${e.lineno}</div>`;}
});

const root=document.getElementById("app");
const DAYS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi"];
let currentUser=null,currentProfile=null,currentView="dashboard",weekOffset=0,calDate=new Date();

function showError(msg){root.innerHTML=`<div class="error">${msg}</div>`;}
function logoHtml(){return `<div class="logo"><span class="z">Z</span><span class="word">YVORA</span></div>`;}
function num(v){return parseFloat(String(v||"0").replace(",","."))||0;}
function fmtDate(d){return d?new Date(d+"T12:00:00").toLocaleDateString("fr-CH"):"";}
function isoDate(date){return date.toISOString().slice(0,10);}
function badge(status){
  if(status==="validé")return `<span class="badge okb">validé</span>`;
  if(status==="refusé")return `<span class="badge refused">refusé</span>`;
  if(status==="corrigé")return `<span class="badge info">corrigé</span>`;
  return `<span class="badge pending">${status||"en attente"}</span>`;
}
function getWeekRange(){
  const now=new Date(); const day=now.getDay(); const diff=day===0?-6:1-day;
  const monday=new Date(now); monday.setDate(now.getDate()+diff+(weekOffset*7));
  const friday=new Date(monday); friday.setDate(monday.getDate()+4);
  return {monday,start:isoDate(monday),end:isoDate(friday)};
}
function dayIso(index){const r=getWeekRange(); const d=new Date(r.monday); d.setDate(r.monday.getDate()+index); return isoDate(d);}
function draftKey(){const r=getWeekRange(); return currentUser?`zyvora_draft_${currentUser.id}_${r.start}`:`zyvora_draft_${r.start}`;}
function getDraft(){try{return JSON.parse(localStorage.getItem(draftKey())||"{}");}catch(e){return {};}}
function setDraft(d){localStorage.setItem(draftKey(),JSON.stringify(d));}
function renderKeepScroll(){
  const y = window.scrollY || document.documentElement.scrollTop || 0;
  renderApp();
  setTimeout(()=>window.scrollTo(0,y),0);
}
function renderToDay(label){
  renderApp();
  setTimeout(()=>{
    const el=document.querySelector(`[data-day="${label}"]`);
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
  },0);
}
function dayTotal(day){return (day.rows||[]).reduce((s,r)=>{if(r.type==="holiday")return s+8.5; return s+num(r.hours);},0);}
function dayComplete(day){
  if(!day||!day.rows||!day.rows.length)return false;
  if(day.rows.some(r=>r.type==="holiday"))return true;
  const valid=day.rows.filter(r=>{
    if(r.type==="work")return num(r.hours)>0&&String(r.site||"").trim().length>0;
    if(r.type==="absence")return num(r.hours)>0;
    return false;
  });
  if(!valid.length)return false;
  return valid.reduce((s,r)=>s+num(r.hours),0)>=8.5;
}
function progressHtml(day){
  const total=dayTotal(day), ok=dayComplete(day), pct=ok?100:Math.min(100,Math.round(total/8.5*100));
  const holiday=day.rows&&day.rows.some(r=>r.type==="holiday");
  return `<div class="day-progress"><div class="day-progress-top"><span>${ok?"Journée complète":"Il manque des heures"}</span><b>${holiday?"Jour férié":total.toFixed(2)+" / 8.5 h"}</b></div><div class="day-progress-bar"><div class="${ok?"day-progress-fill ok":"day-progress-fill missing"}" style="width:${pct}%"></div></div></div>`;
}
function lockKey(label){const r=getWeekRange();return `${currentUser.id}_${r.start}_${label}`;}

if(typeof SUPABASE_URL==="undefined"||typeof SUPABASE_ANON_KEY==="undefined"){showError("Erreur : config.js ne charge pas.");}
else if(typeof supabase==="undefined"){showError("Erreur : Supabase ne charge pas.");}
else{
const supabaseClient=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
init();

async function init(){
  try{
    const {data}=await supabaseClient.auth.getSession();
    if(data.session&&data.session.user){currentUser=data.session.user;await loadProfile();renderApp();}
    else renderLogin();
  }catch(err){showError("Erreur au démarrage :\n"+err.message);}
}
async function loadProfile(){
  const {data,error}=await supabaseClient.from("profiles").select("*").eq("id",currentUser.id).single();
  if(error||!data)throw new Error("Profil introuvable : "+(error?error.message:"aucune donnée"));
  currentProfile=data;
}
function renderLogin(){
  root.innerHTML=`<div class="login-page"><div class="login-top">${logoHtml()}</div><div class="login-panel"><h1>Se connecter</h1><div class="login-field"><input id="email" type="email" placeholder="Votre e-mail"></div><div class="login-field"><input id="password" type="password" placeholder="Mot de passe"></div><div class="forgot-line" onclick="forgotPassword()">Mot de passe oublié?</div><button class="login-submit" onclick="login()">S’IDENTIFIER</button></div></div>`;
}
window.login=async function(){
  try{
    const email=document.getElementById("email").value.trim().toLowerCase(), password=document.getElementById("password").value;
    const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error)return alert(error.message);
    currentUser=data.user; await loadProfile(); renderApp();
  }catch(err){showError("Erreur connexion :\n"+err.message);}
};
window.forgotPassword=async function(){
  const email=prompt("Indique ton e-mail :"); if(!email)return;
  const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
  if(error)alert(error.message); else alert("E-mail envoyé.");
};
window.logout=async function(){await supabaseClient.auth.signOut();currentUser=null;currentProfile=null;currentView="dashboard";renderLogin();};
window.setView=function(v){currentView=v;renderApp();};

function renderApp(){
  const isAdmin=currentProfile.role==="admin";
  root.innerHTML=`<div class="app"><aside class="side">${logoHtml()}<div class="userbox"><b>${currentProfile.full_name}</b><br>${isAdmin?"Patron / Admin":"Employé"}</div><div class="nav"><button class="${currentView==="dashboard"?"active":""}" onclick="setView('dashboard')">Tableau de bord</button>${isAdmin?`<button class="${currentView==="validate"?"active":""}" onclick="setView('validate')">Valider les semaines</button><button class="${currentView==="requestsAdmin"?"active":""}" onclick="setView('requestsAdmin')">Vacances / congés</button><button class="${currentView==="calendarAdmin"?"active":""}" onclick="setView('calendarAdmin')">Calendrier absences</button><button class="${currentView==="unlockDays"?"active":""}" onclick="setView('unlockDays')">Débloquer jours</button><button class="${currentView==="employees"?"active":""}" onclick="setView('employees')">Employés</button>`:`<button class="${currentView==="week"?"active":""}" onclick="setView('week')">Rapport semaine</button><button class="${currentView==="request"?"active":""}" onclick="setView('request')">Vacances / congé</button>`}<button onclick="logout()">Déconnexion</button></div></aside><main class="main" id="main"></main></div>`;
  renderView();
}
async function renderView(){
  const main=document.getElementById("main");
  if(currentView==="dashboard")main.innerHTML=await dashboard();
  if(currentView==="week")main.innerHTML=await employeeWeek();
  if(currentView==="validate")main.innerHTML=await adminValidate();
  if(currentView==="request")main.innerHTML=await employeeRequest();
  if(currentView==="requestsAdmin")main.innerHTML=await adminRequests();
  if(currentView==="calendarAdmin")main.innerHTML=await adminCalendar();
  if(currentView==="unlockDays")main.innerHTML=await adminUnlockDays();
  if(currentView==="employees")main.innerHTML=await adminEmployees();
}
async function dashboard(){return `<div class="top"><h1>Tableau de bord</h1></div><div class="grid"><div class="card"><h2>Compte</h2><div class="kpi">${currentProfile.role}</div></div></div>`;}

function getDay(label){
  const draft=getDraft(); const found=(draft.days||[]).find(d=>d.day===label);
  return found||{day:label,meal:"0",expense:"0",ticket_path:"",rows:[{type:"work",site:"",hours:"0",km:"0"}]};
}
async function uploadTicket(label){
  const input=document.getElementById(`${label}ticket`);
  if(!input||!input.files||!input.files[0])return "";
  const file=input.files[0], ext=(file.name.split(".").pop()||"jpg").toLowerCase();
  const safe=label.toLowerCase().replaceAll("é","e");
  const path=`${currentUser.id}/${getWeekRange().start}/${safe}-${Date.now()}.${ext}`;
  const {error}=await supabaseClient.storage.from("expense-tickets").upload(path,file,{upsert:false});
  if(error){alert("Erreur upload ticket : "+error.message);return "";}
  return path;
}
window.downloadTicket=async function(path){
  if(!path)return alert("Aucun ticket.");
  const {data,error}=await supabaseClient.storage.from("expense-tickets").createSignedUrl(path,3600);
  if(error)return alert(error.message);
  window.open(data.signedUrl,"_blank");
};
async function saveDay(label){
  const block=document.querySelector(`[data-day="${label}"]`); const rows=[];
  block.querySelectorAll(".work-row").forEach((rowEl,index)=>{
    const type=rowEl.dataset.type;
    if(type==="holiday")rows.push({type:"holiday",name:document.getElementById(`${label}holiday${index}`).value||"Jour férié"});
    else if(type==="absence")rows.push({type:"absence",absence:document.getElementById(`${label}absence${index}`).value,hours:document.getElementById(`${label}ahours${index}`).value||"0"});
    else rows.push({type:"work",site:document.getElementById(`${label}site${index}`).value||"Chantier",hours:document.getElementById(`${label}hours${index}`).value||"0",km:document.getElementById(`${label}km${index}`).value||"0"});
  });
  const old=getDay(label);
  const entry={day:label,meal:document.getElementById(`${label}meal`).value||"0",expense:document.getElementById(`${label}expense`).value||"0",ticket_path:old.ticket_path||"",rows};
  const ticket=await uploadTicket(label); if(ticket)entry.ticket_path=ticket;
  const draft=getDraft(); draft.days=(draft.days||[]).filter(d=>d.day!==label); draft.days.push(entry); setDraft(draft);
}
function rowHtml(label,row,index,locked){
  const dis=locked?"disabled":"";
  const del=locked?"":`<button class="danger small" onclick="removeRow('${label}',${index})">Supprimer</button>`;
  if(row.type==="holiday")return `<div class="work-row" data-type="holiday"><div><label>Jour férié</label><input id="${label}holiday${index}" value="${row.name||"Jour férié"}" ${dis}></div>${del}</div>`;
  if(row.type==="absence")return `<div class="work-row" data-type="absence"><div><label>Absence</label><select id="${label}absence${index}" ${dis}><option ${row.absence==="Maladie"?"selected":""}>Maladie</option><option ${row.absence==="Congé"?"selected":""}>Congé</option><option ${row.absence==="Vacances"?"selected":""}>Vacances</option></select></div><div><label>Heures absence</label><input id="${label}ahours${index}" value="${row.hours||"0"}" ${dis}></div>${del}</div>`;
  return `<div class="work-row" data-type="work"><div><label>Chantier</label><input id="${label}site${index}" value="${row.site||""}" placeholder="Chantier" ${dis}></div><div><label>Heures</label><input id="${label}hours${index}" value="${row.hours||"0"}" placeholder="0" ${dis}></div><div><label>KM</label><input id="${label}km${index}" value="${row.km||"0"}" ${dis}></div>${del}</div>`;
}
function dayCard(label,index,locks){
  const day=getDay(label), locked=locks.some(l=>l.day_name===label);
  const dis=locked?"disabled":"";
  return `<div class="weekday" data-day="${label}"><h3>${label} ${fmtDate(dayIso(index))} ${locked?`<span class="locked-badge">Journée validée</span>`:""}</h3>${progressHtml(day)}<div class="formgrid"><div><label>Repas CHF</label><input id="${label}meal" value="${day.meal||"0"}" ${dis}></div><div><label>Frais divers CHF</label><input id="${label}expense" value="${day.expense||"0"}" ${dis}></div><div class="full"><label>Photo ticket / justificatif</label><input id="${label}ticket" type="file" accept="image/*" ${dis}>${day.ticket_path?`<button class="secondary small" onclick="downloadTicket('${day.ticket_path}')">Voir ticket enregistré</button>`:""}</div></div>${(day.rows||[]).map((row,i)=>rowHtml(label,row,i,locked)).join("")}<div class="actions">${locked?`<span class="saved">Verrouillé par validation</span>`:`<button class="secondary small" onclick="addWork('${label}')">+ Ajouter chantier</button><button class="secondary small" onclick="addAbsence('${label}')">+ Ajouter absence</button><button class="secondary small" onclick="addHoliday('${label}')">+ Jour férié</button><button class="small" onclick="saveAndRender('${label}')">Enregistrer</button><button class="ok small" onclick="lockDay('${label}')">Valider la journée</button>`}</div></div>`;
}
window.saveAndRender=async function(label){await saveDay(label);renderToDay(label);};
window.addWork=async function(label){await saveDay(label);const d=getDraft();let day=getDay(label);day.rows.push({type:"work",site:"",hours:"0",km:"0"});d.days=(d.days||[]).filter(x=>x.day!==label);d.days.push(day);setDraft(d);renderToDay(label);};
window.addAbsence=async function(label){await saveDay(label);const d=getDraft();let day=getDay(label);day.rows.push({type:"absence",absence:"Maladie",hours:"0"});d.days=(d.days||[]).filter(x=>x.day!==label);d.days.push(day);setDraft(d);renderToDay(label);};
window.addHoliday=async function(label){await saveDay(label);const d=getDraft();let day=getDay(label);day.rows=[{type:"holiday",name:"Jour férié"}];d.days=(d.days||[]).filter(x=>x.day!==label);d.days.push(day);setDraft(d);renderToDay(label);};
window.removeRow=async function(label,index){await saveDay(label);const d=getDraft();let day=getDay(label);day.rows=day.rows.filter((_,i)=>i!==index);if(!day.rows.length)day.rows=[{type:"work",site:"",hours:"0",km:"0"}];d.days=(d.days||[]).filter(x=>x.day!==label);d.days.push(day);setDraft(d);renderToDay(label);};

async function getLockedDays(){const r=getWeekRange();const {data}=await supabaseClient.from("daily_locks").select("*").eq("employee_id",currentUser.id).eq("week_start",r.start).eq("locked",true);return data||[];}
window.lockDay=async function(label){
  await saveDay(label); const day=getDay(label);
  if(!dayComplete(day))return alert("Impossible de valider : indique un chantier avec heures, ou une absence avec heures, ou un jour férié. La journée doit atteindre 8.5h.");
  const r=getWeekRange();
  const {error}=await supabaseClient.from("daily_locks").upsert({day_key:lockKey(label),employee_id:currentUser.id,employee_name:currentProfile.full_name,week_start:r.start,day_name:label,locked:true});
  if(error)return alert("Erreur verrouillage : "+error.message);
  alert("Journée validée.");
  renderToDay(label);
};
async function employeeWeek(){
  const r=getWeekRange(); const locks=await getLockedDays();
  const {data=[]}=await supabaseClient.from("weekly_reports").select("*").eq("employee_id",currentUser.id).order("created_at",{ascending:false});
  return `<div class="top"><div><h1>Rapport semaine</h1><p>Semaine du ${fmtDate(r.start)} au ${fmtDate(r.end)}. Après validation, seul l’admin peut débloquer.</p></div><div class="toolbar"><button class="secondary" onclick="changeWeek(-1)">Semaine précédente</button><button class="secondary" onclick="changeWeek(1)">Semaine suivante</button></div></div><div class="card">${DAYS.map((d,i)=>dayCard(d,i,locks)).join("")}<button onclick="sendWeek()">Envoyer la semaine pour validation</button></div><div class="card"><h2>Mes rapports</h2>${reportsTable(data,false)}</div>`;
}
window.changeWeek=function(delta){weekOffset+=delta;renderKeepScroll();};
window.sendWeek=async function(){
  for(const d of DAYS){if(document.querySelector(`[data-day="${d}"]`))await saveDay(d);}
  const locks=await getLockedDays(); if(DAYS.some(d=>!locks.some(l=>l.day_name===d)))return alert("Tu dois d’abord valider chaque journée de lundi à vendredi.");
  const r=getWeekRange(); const days=DAYS.map(d=>getDay(d));
  const finalDays=days.map(day=>({day:day.day,hours:String(dayTotal(day)),meal:day.meal||"0",expense:day.expense||"0",ticket_path:day.ticket_path||"",km:String((day.rows||[]).reduce((s,row)=>s+num(row.km),0)),note:(day.rows||[]).map(row=>row.type==="holiday"?`${row.name}: 8.5h`:row.type==="absence"?`${row.absence}: ${row.hours}h`:`${row.site||"Chantier"}: ${row.hours}h`).join(" | "),rows:day.rows}));
  const {error}=await supabaseClient.from("weekly_reports").insert({employee_id:currentUser.id,week_start:r.start,week_end:r.end,days:finalDays,status:"envoyé"});
  if(error)return alert(error.message);
  localStorage.removeItem(draftKey()); alert("Rapport envoyé."); renderApp();
};

function hasTickets(r){return (r.days||[]).some(d=>d.ticket_path);}
window.showTickets=async function(rstr){
  const r=JSON.parse(decodeURIComponent(rstr)); const tickets=(r.days||[]).filter(d=>d.ticket_path);
  if(!tickets.length)return alert("Aucun ticket.");
  for(const t of tickets){await downloadTicket(t.ticket_path);}
};
function reportsTable(data,isAdmin){
  if(!data.length)return `<div class="empty">Aucun rapport.</div>`;
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Période</th><th>Employé</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${data.map(r=>`<tr><td>${fmtDate(r.week_start)} - ${fmtDate(r.week_end)}</td><td>${r.employee_name||""}</td><td>${badge(r.status)}</td><td class="actions"><button class="small secondary" onclick='alert(${JSON.stringify(JSON.stringify(r.days||[]))})'>Voir</button>${hasTickets(r)?`<button class="small secondary" onclick="showTickets('${encodeURIComponent(JSON.stringify(r))}')">Tickets</button>`:""}${isAdmin?`<button class="small ok" onclick="setReportStatus('${r.id}','validé')">Valider</button><button class="small danger" onclick="setReportStatus('${r.id}','refusé')">Refuser</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
}
async function adminValidate(){const {data=[]}=await supabaseClient.from("weekly_reports_admin").select("*").order("created_at",{ascending:false});return `<div class="top"><h1>Valider les semaines</h1></div><div class="card">${reportsTable(data,true)}</div>`;}
window.setReportStatus=async function(id,status){const {error}=await supabaseClient.from("weekly_reports").update({status}).eq("id",id);if(error)alert(error.message);else renderApp();};

async function employeeRequest(){const {data=[]}=await supabaseClient.from("leave_requests").select("*").eq("employee_id",currentUser.id).order("created_at",{ascending:false});return `<div class="top"><h1>Vacances / congé</h1></div><div class="card"><h2>Nouvelle demande</h2><div class="formgrid"><div><label>Type</label><select id="rqType"><option>Vacances</option><option>Congé</option></select></div><div><label>Motif</label><input id="rqReason"></div><div><label>Du</label><input id="rqFrom" type="date"></div><div><label>Au</label><input id="rqTo" type="date"></div></div><button onclick="sendRequest()">Envoyer</button></div><div class="card">${leaveTable(data,false)}</div>`;}
window.sendRequest=async function(){const row={employee_id:currentUser.id,type:document.getElementById("rqType").value,reason:document.getElementById("rqReason").value,date_from:document.getElementById("rqFrom").value,date_to:document.getElementById("rqTo").value,status:"en attente"};const {error}=await supabaseClient.from("leave_requests").insert(row);if(error)alert(error.message);else{alert("Demande envoyée.");renderApp();}};
async function adminRequests(){const {data=[]}=await supabaseClient.from("leave_requests_admin").select("*").order("created_at",{ascending:false});return `<div class="top"><h1>Vacances / congés</h1></div><div class="card">${leaveTable(data,true)}</div>`;}
function leaveTable(data,isAdmin){if(!data.length)return `<div class="empty">Aucune demande.</div>`;return `<table class="table"><thead><tr><th>Employé</th><th>Type</th><th>Période</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${data.map(row=>`<tr><td>${row.employee_name||""}</td><td>${row.type}</td><td>${fmtDate(row.date_from)} - ${fmtDate(row.date_to)}</td><td>${badge(row.status)}</td><td>${isAdmin?`<button class="small ok" onclick="setLeaveStatus('${row.id}','validé')">Valider</button><button class="small danger" onclick="setLeaveStatus('${row.id}','refusé')">Refuser</button>`:""}</td></tr>`).join("")}</tbody></table>`;}
window.setLeaveStatus=async function(id,status){const {error}=await supabaseClient.from("leave_requests").update({status}).eq("id",id);if(error)alert(error.message);else renderApp();};

async function adminCalendar(){
  const {data=[]}=await supabaseClient.from("leave_requests_admin").select("*").eq("status","validé");
  const y=calDate.getFullYear(), m=calDate.getMonth(), last=new Date(y,m+1,0), cells=[];
  for(let d=1;d<=last.getDate();d++){const date=new Date(y,m,d), iso=isoDate(date), abs=data.filter(a=>iso>=a.date_from&&iso<=a.date_to);cells.push(`<div class="cal-day"><div class="cal-date">${d}</div>${abs.map(a=>`<span class="absence-pill">${a.employee_name||""}<br>${a.type}</span>`).join("")}</div>`);}
  return `<div class="top"><div><h1>Calendrier absences</h1><p>Vacances et congés validés.</p></div><div class="toolbar"><button class="secondary" onclick="changeMonth(-1)">Mois précédent</button><button class="secondary" onclick="changeMonth(1)">Mois suivant</button></div></div><div class="card"><h2>${calDate.toLocaleDateString("fr-CH",{month:"long",year:"numeric"})}</h2><div class="calendar">${cells.join("")}</div></div>`;
}
window.changeMonth=function(delta){calDate.setMonth(calDate.getMonth()+delta);renderApp();};

async function adminUnlockDays(){
  const {data=[],error}=await supabaseClient.from("daily_locks").select("*").eq("locked",true).order("week_start",{ascending:false});
  if(error)return `<div class="card"><h2>Erreur</h2><p>${error.message}</p></div>`;
  if(!data.length)return `<div class="top"><h1>Débloquer jours</h1></div><div class="card"><div class="empty">Aucun jour à débloquer.</div></div>`;
  return `<div class="top"><h1>Débloquer jours</h1></div><div class="card"><table class="table"><thead><tr><th>Employé</th><th>Semaine</th><th>Jour</th><th>Action</th></tr></thead><tbody>${data.map(l=>`<tr><td>${l.employee_name||l.employee_id}</td><td>${fmtDate(l.week_start)}</td><td>${l.day_name}</td><td><button class="small secondary" onclick="unlockEmployeeDay('${l.day_key}')">Débloquer</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.unlockEmployeeDay=async function(dayKey){if(!confirm("Débloquer cette journée ?"))return;const {error}=await supabaseClient.from("daily_locks").delete().eq("day_key",dayKey);if(error)alert(error.message);else{alert("Journée débloquée.");renderApp();}};

async function adminEmployees(){const {data=[]}=await supabaseClient.from("profiles").select("*").order("full_name");return `<div class="top"><h1>Employés</h1></div><div class="card"><table class="table"><tbody>${data.map(u=>`<tr><td>${u.full_name}</td><td>${u.email}</td><td>${u.role}</td></tr>`).join("")}</tbody></table></div>`;}
}
