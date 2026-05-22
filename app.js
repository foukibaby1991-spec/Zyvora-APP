
window.addEventListener("error", function(e){
  const el = document.getElementById("app");
  if(el){
    el.innerHTML = `<div class="error"><b>Erreur JavaScript :</b>
${e.message}

Fichier : ${e.filename}
Ligne : ${e.lineno}</div>`;
  }
});

const root = document.getElementById("app");
const DAYS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi"];
let currentUser = null;
let currentProfile = null;
let currentView = "dashboard";
let weekOffset = 0;

function showError(msg){
  root.innerHTML = `<div class="error">${msg}</div>`;
}

function logoHtml(){
  return `<div class="logo"><span class="z">Z</span><span class="word">YVORA</span></div>`;
}

function num(v){
  return parseFloat(String(v || "0").replace(",", ".")) || 0;
}

function fmtDate(d){
  return d ? new Date(d + "T12:00:00").toLocaleDateString("fr-CH") : "";
}

function badge(status){
  if(status === "validé") return `<span class="badge okb">validé</span>`;
  if(status === "refusé") return `<span class="badge refused">refusé</span>`;
  if(status === "corrigé") return `<span class="badge info">corrigé</span>`;
  return `<span class="badge pending">${status || "en attente"}</span>`;
}

function getWeekRange(){
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + (weekOffset * 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    monday,
    start: monday.toISOString().slice(0,10),
    end: friday.toISOString().slice(0,10)
  };
}

function dayIso(index){
  const range = getWeekRange();
  const d = new Date(range.monday);
  d.setDate(range.monday.getDate() + index);
  return d.toISOString().slice(0,10);
}

function draftKey(){
  const range = getWeekRange();
  return currentUser ? `zyvora_draft_${currentUser.id}_${range.start}` : `zyvora_draft_${range.start}`;
}

function getDraft(){
  try{
    return JSON.parse(localStorage.getItem(draftKey()) || "{}");
  }catch(e){
    return {};
  }
}

function setDraft(draft){
  localStorage.setItem(draftKey(), JSON.stringify(draft));
}

function dayTotal(day){
  return (day.rows || []).reduce((sum,row) => {
    if(row.type === "holiday") return sum + 8.5;
    return sum + num(row.hours);
  }, 0);
}

function dayComplete(day){
  if(!day || !day.rows || !day.rows.length) return false;
  if(day.rows.some(r => r.type === "holiday")) return true;
  const validRows = day.rows.filter(r => {
    if(r.type === "work") return num(r.hours) > 0 && String(r.site || "").trim().length > 0;
    if(r.type === "absence") return num(r.hours) > 0;
    return false;
  });
  if(!validRows.length) return false;
  return validRows.reduce((s,r)=>s+num(r.hours),0) >= 8.5;
}

function progressHtml(day){
  const total = dayTotal(day);
  const ok = dayComplete(day);
  const pct = ok ? 100 : Math.min(100, Math.round((total / 8.5) * 100));
  return `
    <div class="day-progress">
      <div class="day-progress-top">
        <span>${ok ? "Journée complète" : "Il manque des heures"}</span>
        <b>${day.rows && day.rows.some(r=>r.type==="holiday") ? "Jour férié" : total.toFixed(2) + " / 8.5 h"}</b>
      </div>
      <div class="day-progress-bar">
        <div class="${ok ? "day-progress-fill ok" : "day-progress-fill missing"}" style="width:${pct}%"></div>
      </div>
    </div>`;
}

if(typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined"){
  showError("Erreur : config.js ne charge pas. Vérifie que le fichier config.js existe bien.");
}else if(typeof supabase === "undefined"){
  showError("Erreur : la librairie Supabase ne charge pas. Vérifie index.html.");
}else{
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  init();

  async function init(){
    try{
      const { data } = await supabaseClient.auth.getSession();
      if(data.session && data.session.user){
        currentUser = data.session.user;
        await loadProfile();
        renderApp();
      }else{
        renderLogin();
      }
    }catch(err){
      showError("Erreur au démarrage :\n" + err.message);
    }
  }

  async function loadProfile(){
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if(error || !data){
      throw new Error("Profil introuvable : " + (error ? error.message : "aucune donnée"));
    }

    currentProfile = data;
  }

  function renderLogin(){
    root.innerHTML = `
      <div class="login-page">
        <div class="login-top">${logoHtml()}</div>
        <div class="login-panel">
          <h1>Se connecter</h1>
          <div class="login-field"><input id="email" type="email" placeholder="Votre e-mail"></div>
          <div class="login-field"><input id="password" type="password" placeholder="Mot de passe"></div>
          <div class="forgot-line" onclick="forgotPassword()">Mot de passe oublié?</div>
          <button class="login-submit" onclick="login()">S’IDENTIFIER</button>
        </div>
      </div>`;
  }

  window.login = async function(){
    try{
      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value;

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if(error){
        alert(error.message);
        return;
      }

      currentUser = data.user;
      await loadProfile();
      renderApp();
    }catch(err){
      showError("Erreur connexion :\n" + err.message);
    }
  };

  window.forgotPassword = async function(){
    const email = prompt("Indique ton e-mail :");
    if(!email) return;

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if(error) alert(error.message);
    else alert("E-mail envoyé.");
  };

  window.logout = async function(){
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    currentView = "dashboard";
    renderLogin();
  };

  window.setView = function(view){
    currentView = view;
    renderApp();
  };

  function renderApp(){
    const isAdmin = currentProfile.role === "admin";

    root.innerHTML = `
      <div class="app">
        <aside class="side">
          ${logoHtml()}
          <div class="userbox">
            <b>${currentProfile.full_name}</b><br>
            ${isAdmin ? "Patron / Admin" : "Employé"}
          </div>

          <div class="nav">
            <button class="${currentView==="dashboard" ? "active" : ""}" onclick="setView('dashboard')">Tableau de bord</button>

            ${isAdmin ? `
              <button class="${currentView==="validate" ? "active" : ""}" onclick="setView('validate')">Valider les semaines</button>
              <button class="${currentView==="requestsAdmin" ? "active" : ""}" onclick="setView('requestsAdmin')">Vacances / congés</button>
              <button class="${currentView==="employees" ? "active" : ""}" onclick="setView('employees')">Employés</button>
            ` : `
              <button class="${currentView==="week" ? "active" : ""}" onclick="setView('week')">Rapport semaine</button>
              <button class="${currentView==="request" ? "active" : ""}" onclick="setView('request')">Vacances / congé</button>
            `}

            <button onclick="logout()">Déconnexion</button>
          </div>
        </aside>

        <main class="main" id="main"></main>
      </div>`;

    renderView();
  }

  async function renderView(){
    const main = document.getElementById("main");

    if(currentView === "dashboard") main.innerHTML = await dashboard();
    if(currentView === "week") main.innerHTML = await employeeWeek();
    if(currentView === "validate") main.innerHTML = await adminValidate();
    if(currentView === "request") main.innerHTML = await employeeRequest();
    if(currentView === "requestsAdmin") main.innerHTML = await adminRequests();
    if(currentView === "employees") main.innerHTML = await adminEmployees();
  }

  async function dashboard(){
    return `
      <div class="top"><h1>Tableau de bord</h1></div>
      <div class="grid">
        <div class="card"><h2>Compte</h2><div class="kpi">${currentProfile.role}</div></div>
      </div>`;
  }

  function getDay(label){
    const draft = getDraft();
    const found = (draft.days || []).find(d => d.day === label);
    return found || {
      day: label,
      meal: "0",
      expense: "0",
      rows: [{ type: "work", site: "", hours: "0", km: "0" }]
    };
  }

  function saveDay(label){
    const block = document.querySelector(`[data-day="${label}"]`);
    const rows = [];

    block.querySelectorAll(".work-row").forEach((rowEl, index) => {
      const type = rowEl.dataset.type;

      if(type === "holiday"){
        rows.push({
          type: "holiday",
          name: document.getElementById(`${label}holiday${index}`).value || "Jour férié"
        });
      }else if(type === "absence"){
        rows.push({
          type: "absence",
          absence: document.getElementById(`${label}absence${index}`).value,
          hours: document.getElementById(`${label}ahours${index}`).value || "0"
        });
      }else{
        rows.push({
          type: "work",
          site: document.getElementById(`${label}site${index}`).value || "Chantier",
          hours: document.getElementById(`${label}hours${index}`).value || "0",
          km: document.getElementById(`${label}km${index}`).value || "0"
        });
      }
    });

    const entry = {
      day: label,
      meal: document.getElementById(`${label}meal`).value || "0",
      expense: document.getElementById(`${label}expense`).value || "0",
      rows
    };

    const draft = getDraft();
    draft.days = (draft.days || []).filter(d => d.day !== label);
    draft.days.push(entry);
    setDraft(draft);
    renderApp();
  }

  function rowHtml(label, row, index){
    if(row.type === "holiday"){
      return `
        <div class="work-row" data-type="holiday">
          <div><label>Jour férié</label><input id="${label}holiday${index}" value="${row.name || "Jour férié"}"></div>
          <button class="danger small" onclick="removeRow('${label}',${index})">Supprimer</button>
        </div>`;
    }

    if(row.type === "absence"){
      return `
        <div class="work-row" data-type="absence">
          <div><label>Absence</label><select id="${label}absence${index}">
            <option ${row.absence==="Maladie" ? "selected" : ""}>Maladie</option>
            <option ${row.absence==="Congé" ? "selected" : ""}>Congé</option>
            <option ${row.absence==="Vacances" ? "selected" : ""}>Vacances</option>
          </select></div>
          <div><label>Heures absence</label><input id="${label}ahours${index}" value="${row.hours || "0"}"></div>
          <button class="danger small" onclick="removeRow('${label}',${index})">Supprimer</button>
        </div>`;
    }

    return `
      <div class="work-row" data-type="work">
        <div><label>Chantier</label><input id="${label}site${index}" value="${row.site || ""}" placeholder="Chantier"></div>
        <div><label>Heures</label><input id="${label}hours${index}" value="${row.hours || "0"}" placeholder="0"></div>
        <div><label>KM</label><input id="${label}km${index}" value="${row.km || "0"}"></div>
        <button class="danger small" onclick="removeRow('${label}',${index})">Supprimer</button>
      </div>`;
  }

  function dayCard(label, index){
    const day = getDay(label);

    return `
      <div class="weekday" data-day="${label}">
        <h3>${label} ${fmtDate(dayIso(index))}</h3>
        ${progressHtml(day)}

        <div class="formgrid">
          <div><label>Repas CHF</label><input id="${label}meal" value="${day.meal || "0"}"></div>
          <div><label>Frais divers CHF</label><input id="${label}expense" value="${day.expense || "0"}"></div>
        </div>

        ${(day.rows || []).map((row,index)=>rowHtml(label,row,index)).join("")}

        <div class="actions">
          <button class="secondary small" onclick="addWork('${label}')">+ Ajouter chantier</button>
          <button class="secondary small" onclick="addAbsence('${label}')">+ Ajouter absence</button>
          <button class="secondary small" onclick="addHoliday('${label}')">+ Jour férié</button>
          <button class="small" onclick="saveDay('${label}')">Enregistrer</button>
        </div>
      </div>`;
  }

  window.addWork = function(label){
    const draft = getDraft();
    const day = getDay(label);
    day.rows.push({ type:"work", site:"", hours:"0", km:"0" });
    draft.days = (draft.days || []).filter(d => d.day !== label);
    draft.days.push(day);
    setDraft(draft);
    renderApp();
  };

  window.addAbsence = function(label){
    const draft = getDraft();
    const day = getDay(label);
    day.rows.push({ type:"absence", absence:"Maladie", hours:"0" });
    draft.days = (draft.days || []).filter(d => d.day !== label);
    draft.days.push(day);
    setDraft(draft);
    renderApp();
  };

  window.addHoliday = function(label){
    const draft = getDraft();
    const day = getDay(label);
    day.rows = [{ type:"holiday", name:"Jour férié" }];
    draft.days = (draft.days || []).filter(d => d.day !== label);
    draft.days.push(day);
    setDraft(draft);
    renderApp();
  };

  window.removeRow = function(label,index){
    const draft = getDraft();
    const day = getDay(label);
    day.rows = day.rows.filter((_,i)=>i!==index);
    if(!day.rows.length) day.rows = [{ type:"work", site:"", hours:"0", km:"0" }];
    draft.days = (draft.days || []).filter(d => d.day !== label);
    draft.days.push(day);
    setDraft(draft);
    renderApp();
  };

  async function employeeWeek(){
    const range = getWeekRange();
    const { data = [] } = await supabaseClient
      .from("weekly_reports")
      .select("*")
      .eq("employee_id", currentUser.id)
      .order("created_at", { ascending:false });

    return `
      <div class="top">
        <div>
          <h1>Rapport semaine</h1>
          <p>Semaine du ${fmtDate(range.start)} au ${fmtDate(range.end)}. Après validation, seul l’admin peut débloquer.</p>
        </div>
      </div>

      <div class="card">
        ${DAYS.map((day,index)=>dayCard(day,index)).join("")}
        <button onclick="sendWeek()">Envoyer la semaine pour validation</button>
      </div>

      <div class="card">
        <h2>Mes rapports</h2>
        ${reportsTable(data,false)}
      </div>`;
  }

  window.sendWeek = async function(){
    const days = DAYS.map(day => getDay(day));

    if(days.some(day => !dayComplete(day))){
      alert("Tous les jours doivent être complets avant d’envoyer.");
      return;
    }

    const range = getWeekRange();

    const finalDays = days.map(day => ({
      day: day.day,
      hours: String(dayTotal(day)),
      meal: day.meal || "0",
      expense: day.expense || "0",
      km: String((day.rows || []).reduce((sum,row)=>sum+num(row.km),0)),
      note: (day.rows || []).map(row => {
        if(row.type === "holiday") return `${row.name}: 8.5h`;
        if(row.type === "absence") return `${row.absence}: ${row.hours}h`;
        return `${row.site || "Chantier"}: ${row.hours}h`;
      }).join(" | "),
      rows: day.rows
    }));

    const { error } = await supabaseClient
      .from("weekly_reports")
      .insert({
        employee_id: currentUser.id,
        week_start: range.start,
        week_end: range.end,
        days: finalDays,
        status: "envoyé"
      });

    if(error){
      alert(error.message);
      return;
    }

    localStorage.removeItem(draftKey());
    alert("Rapport envoyé.");
    renderApp();
  };

  function reportsTable(data, isAdmin){
    if(!data.length) return `<div class="empty">Aucun rapport.</div>`;

    return `
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Période</th><th>Employé</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${data.map(report => `
              <tr>
                <td>${fmtDate(report.week_start)} - ${fmtDate(report.week_end)}</td>
                <td>${report.employee_name || ""}</td>
                <td>${badge(report.status)}</td>
                <td class="actions">
                  <button class="small secondary" onclick='alert(${JSON.stringify(JSON.stringify(report.days || []))})'>Voir</button>
                  ${isAdmin ? `
                    <button class="small ok" onclick="setReportStatus('${report.id}','validé')">Valider</button>
                    <button class="small danger" onclick="setReportStatus('${report.id}','refusé')">Refuser</button>
                  ` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function adminValidate(){
    const { data = [] } = await supabaseClient
      .from("weekly_reports_admin")
      .select("*")
      .order("created_at", { ascending:false });

    return `<div class="top"><h1>Valider les semaines</h1></div><div class="card">${reportsTable(data,true)}</div>`;
  }

  window.setReportStatus = async function(id,status){
    const { error } = await supabaseClient.from("weekly_reports").update({ status }).eq("id", id);
    if(error) alert(error.message);
    else renderApp();
  };

  async function employeeRequest(){
    const { data = [] } = await supabaseClient
      .from("leave_requests")
      .select("*")
      .eq("employee_id", currentUser.id)
      .order("created_at", { ascending:false });

    return `
      <div class="top"><h1>Vacances / congé</h1></div>
      <div class="card">
        <h2>Nouvelle demande</h2>
        <div class="formgrid">
          <div><label>Type</label><select id="rqType"><option>Vacances</option><option>Congé</option></select></div>
          <div><label>Motif</label><input id="rqReason"></div>
          <div><label>Du</label><input id="rqFrom" type="date"></div>
          <div><label>Au</label><input id="rqTo" type="date"></div>
        </div>
        <button onclick="sendRequest()">Envoyer</button>
      </div>
      <div class="card">${leaveTable(data,false)}</div>`;
  }

  window.sendRequest = async function(){
    const row = {
      employee_id: currentUser.id,
      type: document.getElementById("rqType").value,
      reason: document.getElementById("rqReason").value,
      date_from: document.getElementById("rqFrom").value,
      date_to: document.getElementById("rqTo").value,
      status: "en attente"
    };

    const { error } = await supabaseClient.from("leave_requests").insert(row);

    if(error) alert(error.message);
    else{
      alert("Demande envoyée.");
      renderApp();
    }
  };

  async function adminRequests(){
    const { data = [] } = await supabaseClient
      .from("leave_requests_admin")
      .select("*")
      .order("created_at", { ascending:false });

    return `<div class="top"><h1>Vacances / congés</h1></div><div class="card">${leaveTable(data,true)}</div>`;
  }

  function leaveTable(data,isAdmin){
    if(!data.length) return `<div class="empty">Aucune demande.</div>`;

    return `
      <table class="table">
        <thead><tr><th>Employé</th><th>Type</th><th>Période</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td>${row.employee_name || ""}</td>
              <td>${row.type}</td>
              <td>${fmtDate(row.date_from)} - ${fmtDate(row.date_to)}</td>
              <td>${badge(row.status)}</td>
              <td>${isAdmin ? `<button class="small ok" onclick="setLeaveStatus('${row.id}','validé')">Valider</button>` : ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  window.setLeaveStatus = async function(id,status){
    const { error } = await supabaseClient.from("leave_requests").update({ status }).eq("id", id);
    if(error) alert(error.message);
    else renderApp();
  };

  async function adminEmployees(){
    const { data = [] } = await supabaseClient.from("profiles").select("*").order("full_name");

    return `
      <div class="top"><h1>Employés</h1></div>
      <div class="card">
        <table class="table">
          <tbody>
            ${data.map(user => `<tr><td>${user.full_name}</td><td>${user.email}</td><td>${user.role}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }
}
