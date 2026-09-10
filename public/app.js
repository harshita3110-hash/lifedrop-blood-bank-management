const STORAGE_KEY = "lifedropCurrentUser";
const USERS_KEY = "lifedropUsers";
const API_BASE = "/api/locations";
let currentRole = "donor";

const dashboardViews = {
  donor: [
    { key: "overview", label: "Overview", icon: "fa-house" },
    { key: "live-map", label: "Live Map", icon: "fa-map-location-dot" },
    { key: "profile", label: "Profile", icon: "fa-user" }
  ],
  patient: [
    { key: "overview", label: "Overview", icon: "fa-house" },
    { key: "blood-requests", label: "Blood Requests", icon: "fa-heart-pulse" },
    { key: "live-map", label: "Live Map", icon: "fa-map-location-dot" },
    { key: "profile", label: "Profile", icon: "fa-user" }
  ],
  admin: [
    { key: "overview", label: "Overview", icon: "fa-house" },
    { key: "inventory", label: "Inventory", icon: "fa-warehouse" },
    { key: "blood-requests", label: "Blood Requests", icon: "fa-list-check" },
    { key: "donor-records", label: "Donor Records", icon: "fa-users" },
    { key: "live-map", label: "Live Map", icon: "fa-map-location-dot" }
  ]
};

let currentLeafletMap = null;
let currentMarkers = [];
let liveDataCache = [];
let searchMarker = null;
let currentMapTypeFilter = "all";

// ---------- BASIC ----------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });

  const target = document.getElementById(id);
  if (target) {
    target.classList.remove("hidden");
  }
}

function selectRole(role) {
  currentRole = role;
  document.getElementById("auth-role-input").value = role;

  document.getElementById("role-selection").classList.add("hidden");
  document.getElementById("auth-form-container").classList.remove("hidden");

  const title = document.getElementById("auth-title");
  const roleIcon = document.getElementById("auth-role-icon");
  const bloodField = document.getElementById("blood-group-field");
  const adminNotice = document.getElementById("admin-notice");
  const authToggleWrapper = document.getElementById("auth-toggle-wrapper");
  const emailLabel = document.getElementById("email-label");

  title.textContent = `${capitalize(role)} Portal`;

  roleIcon.className = "text-3xl";
  if (role === "donor") {
    roleIcon.classList.add("fa-solid", "fa-heart", "text-red-600");
    bloodField.classList.remove("hidden");
    adminNotice.classList.add("hidden");
    authToggleWrapper.classList.remove("hidden");
    emailLabel.textContent = "Email Address";
  } else if (role === "patient") {
    roleIcon.classList.add("fa-solid", "fa-heart-pulse", "text-blue-600");
    bloodField.classList.remove("hidden");
    adminNotice.classList.add("hidden");
    authToggleWrapper.classList.remove("hidden");
    emailLabel.textContent = "Email Address";
  } else {
    roleIcon.classList.add("fa-solid", "fa-shield-halved", "text-emerald-600");
    bloodField.classList.add("hidden");
    adminNotice.classList.remove("hidden");
    authToggleWrapper.classList.add("hidden");
    emailLabel.textContent = "Hospital Email / Admin ID";
  }

  resetAuthForm();
}

function backToRoleSelection() {
  document.getElementById("auth-form-container").classList.add("hidden");
  document.getElementById("role-selection").classList.remove("hidden");
  hideAuthError();
}

function toggleAuthMode() {
  const isLoginInput = document.getElementById("auth-is-login");
  const registerFields = document.getElementById("register-fields");
  const subtitle = document.getElementById("auth-subtitle");
  const toggleBtn = document.getElementById("auth-toggle-btn");
  const submitText = document.getElementById("auth-submit-text");

  const isLogin = isLoginInput.value === "true";

  if (isLogin) {
    isLoginInput.value = "false";
    registerFields.classList.remove("hidden");
    subtitle.textContent = "Already have an account?";
    toggleBtn.textContent = "Sign in instead";
    submitText.textContent = "Create Account";
  } else {
    isLoginInput.value = "true";
    registerFields.classList.add("hidden");
    subtitle.textContent = "Don't have an account?";
    toggleBtn.textContent = "Create one now";
    submitText.textContent = "Sign In";
  }

  hideAuthError();
}

function handleAuthSubmit(event) {
  event.preventDefault();

  const role = document.getElementById("auth-role-input").value || currentRole;
  const isLogin = document.getElementById("auth-is-login").value === "true";
  const name = document.getElementById("name").value.trim();
  const bloodGroup = document.getElementById("bloodGroup").value;
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    showAuthError("Please enter email and password.");
    return;
  }

  if (role === "admin") {
    if (email === "admin3110@gmail.com" && password === "admin1234") {
      const adminUser = {
        role: "admin",
        name: "Admin",
        email,
        bloodGroup: "-",
        isLogin: true
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));
      updateNavbar(true);
      openDashboard(adminUser, "overview");
      return;
    } else {
      showAuthError("Invalid admin email or password.");
      return;
    }
  }

  if (!isLogin) {
    if (!name) {
      showAuthError("Please enter your full name.");
      return;
    }

    if (!bloodGroup) {
      showAuthError("Please select your blood group.");
      return;
    }

    const users = getStoredUsers();

    const alreadyExists = users.find(
      user => user.email === email && user.role === role
    );

    if (alreadyExists) {
      showAuthError(`${capitalize(role)} account already exists with this email.`);
      return;
    }

    const newUser = {
      role,
      name,
      email,
      password,
      bloodGroup
    };

    users.push(newUser);
    saveStoredUsers(users);

    const sessionUser = {
      role,
      name,
      email,
      bloodGroup,
      isLogin: true
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    updateNavbar(true);
    openDashboard(sessionUser, "overview");
    return;
  }

  const users = getStoredUsers();

  const matchedUser = users.find(
    user =>
      user.email === email &&
      user.password === password &&
      user.role === role
  );

  if (!matchedUser) {
    showAuthError(`Invalid ${role} email or password.`);
    return;
  }

  const sessionUser = {
    role: matchedUser.role,
    name: matchedUser.name,
    email: matchedUser.email,
    bloodGroup: matchedUser.bloodGroup,
    isLogin: true
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
  updateNavbar(true);
  openDashboard(sessionUser, "overview");
}

function getStoredUsers() {
  const users = localStorage.getItem(USERS_KEY);
  return users ? JSON.parse(users) : [];
}

function saveStoredUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function openDashboard(userData, defaultView = "overview") {
  showScreen("dashboard-layout");

  document.getElementById("dash-user-name").textContent = userData.name;
  document.getElementById("dash-user-role").textContent = userData.role;
  document.getElementById("dash-role-title").textContent = `${capitalize(userData.role)} Dashboard`;
  document.getElementById("dash-user-initial").textContent = userData.name.charAt(0).toUpperCase();

  buildDashboardNav(userData.role, defaultView);
  renderDashboardContent(userData, defaultView);
}

function buildDashboardNav(role, activeKey) {
  const nav = document.getElementById("dash-nav");
  nav.innerHTML = "";

  dashboardViews[role].forEach(item => {
    const button = document.createElement("button");
    button.className = `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${
      item.key === activeKey
        ? "bg-red-50 text-red-700 border border-red-100"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;
    button.innerHTML = `<i class="fa-solid ${item.icon} w-4"></i><span>${item.label}</span>`;
    button.onclick = () => {
      const user = getStoredUser();
      buildDashboardNav(role, item.key);
      renderDashboardContent(user, item.key);
    };
    nav.appendChild(button);
  });
}

async function renderDashboardContent(userData, view) {
  const title = document.getElementById("dash-view-title");
  const content = document.getElementById("dash-content-area");

  const viewLabel = dashboardViews[userData.role].find(item => item.key === view)?.label || "Overview";
  title.textContent = viewLabel;

  if (view === "live-map") {
    content.innerHTML = `<div class="fade-in">${liveMapMarkup()}</div>`;
    setTimeout(initLeafletMap, 100);
    return;
  }

  try {
    const data = await fetchLiveData();
    liveDataCache = data;

    let html = "";

    if (userData.role === "donor") {
      if (view === "overview") html = donorOverviewLive(userData, data);
      else html = profileCard(userData);
    }

    if (userData.role === "patient") {
      if (view === "overview") html = patientOverviewLive(userData, data);
      else if (view === "blood-requests") html = patientRequestsLive(data);
      else html = profileCard(userData);
    }

    if (userData.role === "admin") {
      if (view === "overview") html = adminOverviewLive(userData, data);
      else if (view === "inventory") html = adminInventoryLive(data);
      else if (view === "blood-requests") html = adminRequestsLive(data);
      else if (view === "donor-records") html = adminDonorsLive(data);
    }

    content.innerHTML = `<div class="fade-in">${html}</div>`;
  } catch (error) {
    console.error(error);
    content.innerHTML = `<div class="fade-in"><div class="bg-red-50 text-red-700 border border-red-200 rounded-2xl p-6">Failed to load real-time data.</div></div>`;
  }
}

function goToDashboard() {
  const user = getStoredUser();
  if (!user) return;
  openDashboard(user, "overview");
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  updateNavbar(false);
  backToRoleSelection();
  document.getElementById("auth-form").reset();
  showScreen("home-screen");
  window.scrollTo(0, 0);
}

function updateNavbar(isLoggedIn) {
  document.getElementById("nav-dashboard-btn").classList.toggle("hidden", !isLoggedIn);
  document.getElementById("nav-logout-btn").classList.toggle("hidden", !isLoggedIn);
  document.getElementById("nav-login-btn").classList.toggle("hidden", isLoggedIn);
}

function getStoredUser() {
  const user = localStorage.getItem(STORAGE_KEY);
  return user ? JSON.parse(user) : null;
}

function showAuthError(message) {
  document.getElementById("auth-error-msg").textContent = message;
  document.getElementById("auth-error").classList.remove("hidden");
}

function hideAuthError() {
  document.getElementById("auth-error").classList.add("hidden");
}

function resetAuthForm() {
  document.getElementById("auth-form").reset();
  document.getElementById("auth-is-login").value = "true";
  document.getElementById("register-fields").classList.add("hidden");
  document.getElementById("auth-subtitle").textContent = "Don't have an account?";
  document.getElementById("auth-toggle-btn").textContent = "Create one now";
  document.getElementById("auth-submit-text").textContent = "Sign In";
  hideAuthError();
}

// ---------- LIVE API ----------
async function fetchLiveData() {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error("Failed to fetch live data");
  return await res.json();
}

// ---------- LIVE VIEWS ----------
function donorOverviewLive(user, data) {
  const donors = data.filter(item => item.type === "donor");
  const sameGroup = donors.filter(item => item.blood_group === user.bloodGroup);
  const hospitals = data.filter(item => item.type === "hospital");

  return `
    <div class="space-y-8">
      <div class="bg-gradient-to-r from-red-600 to-red-500 rounded-3xl text-white p-8 shadow-lg">
        <h3 class="text-2xl font-bold">Welcome back, ${escapeHtml(user.name)}</h3>
        <p class="mt-2 text-red-50">This dashboard now shows only live MySQL data.</p>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        ${cardStat("Your Blood Group", user.bloodGroup || "-", "text-red-600")}
        ${cardStat("Live Donors", String(donors.length), "text-slate-900")}
        ${cardStat(`Same Group (${escapeHtml(user.bloodGroup || "-")})`, String(sameGroup.length), "text-emerald-600")}
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h4 class="text-xl font-bold mb-4">Connected Hospitals</h4>
        <p class="text-slate-600">${hospitals.length} hospital records currently available in live data.</p>
      </div>
    </div>
  `;
}

function patientOverviewLive(user, data) {
  const patients = data.filter(item => item.type === "patient");
  const hospitals = data.filter(item => item.type === "hospital");
  const donors = data.filter(item => item.type === "donor");

  return `
    <div class="space-y-8">
      <div class="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl text-white p-8 shadow-lg">
        <h3 class="text-2xl font-bold">Hello, ${escapeHtml(user.name)}</h3>
        <p class="mt-2 text-blue-50">This section is using live records from MySQL.</p>
      </div>

      <div class="grid md:grid-cols-3 gap-6">
        ${cardStat("Live Patient Requests", String(patients.length), "text-blue-600")}
        ${cardStat("Live Donors", String(donors.length), "text-emerald-600")}
        ${cardStat("Live Hospitals", String(hospitals.length), "text-slate-900")}
      </div>
    </div>
  `;
}

function patientRequestsLive(data) {
  const patients = data.filter(item => item.type === "patient");

  if (!patients.length) {
    return emptyBox("No real-time patient requests found.");
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h4 class="text-xl font-bold mb-6">Live Blood Requests</h4>
      <div class="space-y-4">
        ${patients.map(item => requestLiveCard(item)).join("")}
      </div>
    </div>
  `;
}

function adminOverviewLive(user, data) {
  const donors = data.filter(item => item.type === "donor");
  const patients = data.filter(item => item.type === "patient");
  const hospitals = data.filter(item => item.type === "hospital");
  const totalUnits = hospitals.reduce((sum, item) => sum + Number(item.units || 0), 0);

  return `
    <div class="space-y-8">
      <div class="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-3xl text-white p-8 shadow-lg">
        <h3 class="text-2xl font-bold">Welcome, ${escapeHtml(user.name)}</h3>
        <p class="mt-2 text-emerald-50">This dashboard now shows only real-time MySQL records.</p>
      </div>

      <div class="grid md:grid-cols-4 gap-6">
        ${cardStat("Live Donors", String(donors.length), "text-emerald-600")}
        ${cardStat("Live Requests", String(patients.length), "text-blue-600")}
        ${cardStat("Live Hospitals", String(hospitals.length), "text-slate-900")}
        ${cardStat("Hospital Units", String(totalUnits), "text-red-600")}
      </div>
    </div>
  `;
}

function adminInventoryLive(data) {
  if (!data.length) {
    return emptyBox("No real-time inventory data found.");
  }

  const grouped = {};

  data.forEach(item => {
    const group = item.blood_group || "Unknown";
    const type = item.type || "unknown";
    const units = Number(item.units || 0);

    if (!grouped[group]) {
      grouped[group] = {
        blood_group: group,
        hospitalUnits: 0,
        donorUnits: 0,
        patientDemand: 0,
        hospitals: 0,
        donors: 0,
        patients: 0
      };
    }

    if (type === "hospital") {
      grouped[group].hospitalUnits += units;
      grouped[group].hospitals += 1;
    }

    if (type === "donor") {
      grouped[group].donorUnits += units;
      grouped[group].donors += 1;
    }

    if (type === "patient") {
      grouped[group].patientDemand += units;
      grouped[group].patients += 1;
    }
  });

  const rows = Object.values(grouped)
    .sort((a, b) => a.blood_group.localeCompare(b.blood_group))
    .map(item => {
      const available = item.hospitalUnits + item.donorUnits;
      const demand = item.patientDemand;

      let status = "Good";
      let badge = "bg-emerald-50 text-emerald-700";

      if (available === 0 && demand > 0) {
        status = "Critical";
        badge = "bg-red-50 text-red-700";
      } else if (available < demand) {
        status = "Low";
        badge = "bg-amber-50 text-amber-700";
      }

      return `
        <tr class="border-b border-slate-100">
          <td class="py-4 font-bold">${escapeHtml(item.blood_group)}</td>
          <td class="py-4">${available}</td>
          <td class="py-4">${demand}</td>
          <td class="py-4">${item.hospitals}</td>
          <td class="py-4">${item.donors}</td>
          <td class="py-4">${item.patients}</td>
          <td class="py-4">
            <span class="px-3 py-1 rounded-full text-xs font-bold ${badge}">
              ${status}
            </span>
          </td>
        </tr>
      `;
    });

  return `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h4 class="text-xl font-bold mb-2">Real-Time Blood Inventory</h4>
      <p class="text-sm text-slate-500 mb-6">
        Calculated live from MySQL: hospitals + donors = available, patients = demand.
      </p>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-slate-200 text-slate-500 text-sm">
              <th class="py-3">Blood Group</th>
              <th class="py-3">Available Units</th>
              <th class="py-3">Patient Demand</th>
              <th class="py-3">Hospitals</th>
              <th class="py-3">Donors</th>
              <th class="py-3">Patients</th>
              <th class="py-3">Status</th>
            </tr>
          </thead>
          <tbody class="text-slate-700">
            ${rows.join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function adminRequestsLive(data) {
  const patients = data.filter(item => item.type === "patient");

  if (!patients.length) {
    return emptyBox("No real-time blood requests found.");
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h4 class="text-xl font-bold mb-6">Active Blood Requests</h4>
      <div class="space-y-4">
        ${patients.map(item => requestLiveCard(item)).join("")}
      </div>
    </div>
  `;
}

function adminDonorsLive(data) {
  const donors = data.filter(item => item.type === "donor");

  if (!donors.length) {
    return emptyBox("No real-time donor records found.");
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h4 class="text-xl font-bold mb-6">Recent Donor Records</h4>
      <div class="space-y-4">
        ${donors.map(item => donorLiveRow(item)).join("")}
      </div>
    </div>
  `;
}

// ---------- LIVE COMPONENTS ----------
function requestLiveCard(item) {
  const user = getStoredUser();
  const status = item.status || "pending";

  let badge = "bg-amber-50 text-amber-700";
  if (status === "accepted") badge = "bg-emerald-50 text-emerald-700";
  if (status === "rejected") badge = "bg-red-50 text-red-700";

  let message = "Your request is pending. Please wait for admin approval.";
  if (status === "accepted") message = "Your request is accepted. Hospital/admin will contact you soon.";
  if (status === "rejected") message = "Your request is rejected. Please contact admin or create another request.";

  const adminButtons = user && user.role === "admin" ? `
    <button onclick="updateRequestStatus(${item.id}, 'accepted')"
      class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">Accept</button>

    <button onclick="updateRequestStatus(${item.id}, 'rejected')"
      class="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-bold">Reject</button>

    <button onclick="updateRequestStatus(${item.id}, 'pending')"
      class="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold">Pending</button>

   <button onclick="editRecord(${item.id})"
  class="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold">Edit</button>

    <button onclick="deleteRecord(${item.id})"
      class="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">Delete</button>
  ` : "";

  return `
    <div class="border border-slate-200 rounded-xl p-5">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h5 class="font-bold text-slate-900">${escapeHtml(item.name)}</h5>
          <p class="text-sm text-slate-500 mt-1">
            ${escapeHtml(item.blood_group)} • ${escapeHtml(String(item.units || 0))} Units •
            ${escapeHtml(item.city)}, ${escapeHtml(item.state)}
          </p>
          <p class="text-xs text-slate-400 mt-1">${escapeHtml(item.contact || "No contact")}</p>
        </div>

        <span class="px-3 py-1 rounded-full text-xs font-bold ${badge}">
          ${escapeHtml(status.toUpperCase())}
        </span>
      </div>

      <p class="mt-3 text-sm font-medium ${status === "accepted" ? "text-emerald-700" : status === "rejected" ? "text-red-700" : "text-amber-700"}">
        ${message}
      </p>

      <div class="flex flex-wrap gap-2 mt-4">
        <button onclick='showRecordDetails(${JSON.stringify(item)})'
          class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">View Details</button>

        <a href="tel:${escapeHtml(item.contact || "")}"
          class="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold">Call Now</a>

        <a href="mailto:${escapeHtml(item.email || "")}"
          class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">Email</a>

        <a target="_blank" href="https://www.google.com/maps?q=${escapeHtml(item.lat)},${escapeHtml(item.lng)}"
          class="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">Open Map</a>

        ${adminButtons}
      </div>
    </div>
  `;
}

function donorLiveRow(item) {
  const status = item.status || "pending";

  let badge = "bg-amber-50 text-amber-700";
  if (status === "accepted") badge = "bg-emerald-50 text-emerald-700";
  if (status === "rejected") badge = "bg-red-50 text-red-700";

  return `
    <div class="border border-slate-200 rounded-xl p-5">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h5 class="font-bold text-slate-900">${escapeHtml(item.name)}</h5>
          <p class="text-sm text-slate-500 mt-1">
            ${escapeHtml(item.blood_group)} • ${escapeHtml(item.contact || "No contact")} •
            ${escapeHtml(item.city)}, ${escapeHtml(item.state)}
          </p>
        </div>

        <span class="px-4 py-2 rounded-xl text-sm font-bold ${badge}">
          ${escapeHtml(status.toUpperCase())}
        </span>
      </div>

      <div class="flex flex-wrap gap-2 mt-4">
        <button onclick='showRecordDetails(${JSON.stringify(item)})'
          class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">View Details</button>

        <a href="tel:${escapeHtml(item.contact || "")}"
          class="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold">Call Now</a>

        <a href="mailto:${escapeHtml(item.email || "")}"
          class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">Email</a>

        <button onclick="updateRequestStatus(${item.id}, 'accepted')"
          class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">Accept</button>

        <button onclick="updateRequestStatus(${item.id}, 'rejected')"
          class="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-bold">Reject</button>

        <button onclick="updateRequestStatus(${item.id}, 'pending')"
          class="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold">Pending</button>

        <button onclick="editRecord(${item.id})"
          class="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold">Edit</button>

        <button onclick="deleteRecord(${item.id})"
          class="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">Delete</button>
      </div>
    </div>
  `;
}

function inventoryLiveRow(group, units) {
  let status = "Good";
  let badge = "bg-emerald-50 text-emerald-700";

  if (units <= 5) {
    status = "Critical";
    badge = "bg-red-50 text-red-700";
  } else if (units <= 15) {
    status = "Low";
    badge = "bg-amber-50 text-amber-700";
  }

  return `
    <tr class="border-b border-slate-100">
      <td class="py-4 font-bold">${escapeHtml(group)}</td>
      <td class="py-4">${escapeHtml(String(units))}</td>
      <td class="py-4"><span class="px-3 py-1 rounded-full text-xs font-bold ${badge}">${status}</span></td>
    </tr>
  `;
}

function emptyBox(message) {
  return `
    <div class="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
      <p class="text-slate-500">${escapeHtml(message)}</p>
    </div>
  `;
}

// ---------- LIVE MAP ----------
function liveMapMarkup() {
  return `
    <div class="w-full h-full flex flex-col pb-8">
      <div class="mb-4 flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900">India Live Blood Map</h2>
          <p class="text-sm text-slate-500">Show hospitals, donors, patients and find nearest match.</p>
        </div>

        <div class="flex flex-col md:flex-row gap-3">
          <input
            id="map-search-input"
            type="text"
            placeholder="Search live records..."
            class="px-4 py-2 border border-slate-200 rounded-xl text-sm w-full md:w-72"
            oninput="applyLiveFilters()"
          >
          <button
            type="button"
            onclick="loadLiveData()"
            class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-4">
        <button type="button" onclick="setMapTypeFilter('all')" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">All</button>
        <button type="button" onclick="setMapTypeFilter('hospital')" class="px-4 py-2 rounded-xl bg-red-100 text-red-700 text-sm font-bold">Hospitals</button>
        <button type="button" onclick="setMapTypeFilter('donor')" class="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-bold">Donors</button>
        <button type="button" onclick="setMapTypeFilter('patient')" class="px-4 py-2 rounded-xl bg-blue-100 text-blue-700 text-sm font-bold">Patients</button>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div class="xl:col-span-3">
          <div id="leaflet-map-container" class="rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative z-0" style="min-height: 460px;"></div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 max-h-[460px] overflow-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-slate-900">Live Data List</h3>
            <span id="live-count" class="text-xs font-bold text-slate-500">0 items</span>
          </div>
          <div id="blood-bank-list" class="space-y-3">
            <p class="text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mt-6">
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-xl font-bold mb-2">Search Place</h3>
            <p class="text-sm text-slate-500 mb-4">Search any city or hospital location in India.</p>
            <div class="flex flex-col md:flex-row gap-3">
              <input
                id="place-search-input"
                type="text"
                placeholder="Search city or place..."
                class="px-4 py-3 border border-slate-200 rounded-xl text-sm w-full"
              >
              <button
                type="button"
                onclick="searchPlaceAndFill()"
                class="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
              >
                Search Place
              </button>
            </div>
          </div>

          <div>
            <h3 class="text-xl font-bold mb-2">Find Nearest</h3>
            <p class="text-sm text-slate-500 mb-4">Find nearest donor or patient from searched place.</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select id="nearest-type" class="px-4 py-3 border border-slate-200 rounded-xl text-sm">
                <option value="donor">Nearest Donor</option>
                <option value="patient">Nearest Patient</option>
                <option value="hospital">Nearest Hospital</option>
              </select>
              <select id="nearest-blood-group" class="px-4 py-3 border border-slate-200 rounded-xl text-sm">
                <option value="">Any Blood Group</option>
                <option>A+</option><option>A-</option>
                <option>B+</option><option>B-</option>
                <option>AB+</option><option>AB-</option>
                <option>O+</option><option>O-</option>
              </select>
              <button
                type="button"
                onclick="findNearestRecord()"
                class="px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition"
              >
                Find
              </button>
            </div>
            <div id="nearest-result" class="mt-4 text-sm text-slate-600"></div>
          </div>
        </div>

        <hr class="my-6 border-slate-200">

        <h3 class="text-xl font-bold mb-4">Add Live Blood Data</h3>
        <form onsubmit="addLiveData(event)" class="grid md:grid-cols-2 gap-4">
          <input id="live-name" type="text" placeholder="Name / Hospital" class="border p-3 rounded-xl" required>

          <select id="live-type" class="border p-3 rounded-xl" required>
            <option value="">Select Type</option>
            <option value="donor">Donor</option>
            <option value="patient">Patient</option>
            <option value="hospital">Hospital</option>
          </select>

          <select id="live-blood-group" class="border p-3 rounded-xl" required>
            <option value="">Blood Group</option>
            <option>A+</option><option>A-</option>
            <option>B+</option><option>B-</option>
            <option>AB+</option><option>AB-</option>
            <option>O+</option><option>O-</option>
          </select>

          <input id="live-city" type="text" placeholder="City" class="border p-3 rounded-xl" required>
          <input id="live-state" type="text" placeholder="State" class="border p-3 rounded-xl" required>
          <input id="live-lat" type="number" step="any" placeholder="Latitude" class="border p-3 rounded-xl" required>
          <input id="live-lng" type="number" step="any" placeholder="Longitude" class="border p-3 rounded-xl" required>
          <input id="live-contact" type="text" placeholder="Contact Number" class="border p-3 rounded-xl">
          <input id="live-email" type="email" placeholder="Email Address" class="border p-3 rounded-xl">
          <input id="live-units" type="number" placeholder="Units" class="border p-3 rounded-xl" value="1">

          <div class="md:col-span-2">
            <button class="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition">
              Save Live Data
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function initLeafletMap() {
  const mapContainer = document.getElementById("leaflet-map-container");
  if (!mapContainer || !window.L) return;

  if (currentLeafletMap) {
    currentLeafletMap.remove();
  }

  currentLeafletMap = L.map("leaflet-map-container").setView([22.9734, 78.6569], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(currentLeafletMap);

  await loadLiveData();
}

async function loadLiveData() {
  try {
    const res = await fetch(API_BASE);
    const data = await res.json();
    liveDataCache = data;
    applyLiveFilters();
  } catch (error) {
    console.error("Error loading live data:", error);
    const list = document.getElementById("blood-bank-list");
    if (list) list.innerHTML = `<p class="text-sm text-red-600">Failed to load live data.</p>`;
  }
}

function setMapTypeFilter(type) {
  currentMapTypeFilter = type;
  applyLiveFilters();
}

function applyLiveFilters() {
  const input = document.getElementById("map-search-input");
  const query = (input?.value || "").toLowerCase().trim();

  let filtered = [...liveDataCache];

  if (currentMapTypeFilter !== "all") {
    filtered = filtered.filter(item => item.type === currentMapTypeFilter);
  }

  if (query) {
    filtered = filtered.filter(item => {
      return [item.name, item.type, item.city, item.state, item.blood_group, item.contact]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  renderFilteredLiveData(filtered);
}

function renderFilteredLiveData(data) {
  renderLiveMarkers(data);
  renderLiveList(data);
  const count = document.getElementById("live-count");
  if (count) count.textContent = `${data.length} items`;
}

function renderLiveMarkers(data) {
  if (!currentLeafletMap) return;

  currentMarkers.forEach(marker => currentLeafletMap.removeLayer(marker));
  currentMarkers = [];

  const bounds = [];

  data.forEach(item => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    let color = "red";
    if (item.type === "donor") color = "green";
    if (item.type === "patient") color = "blue";

    const icon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:2px solid white;"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker([lat, lng], { icon }).addTo(currentLeafletMap);

    marker.bindPopup(`
      <div class="text-sm">
        <b>${escapeHtml(item.name)}</b><br>
        ${escapeHtml(item.type)}<br>
        Blood Group: ${escapeHtml(item.blood_group)}<br>
        ${escapeHtml(item.city)}, ${escapeHtml(item.state)}<br>
        Contact: ${escapeHtml(item.contact || "N/A")}<br>
        Units: ${escapeHtml(String(item.units))}
      </div>
    `);

    currentMarkers.push(marker);
    bounds.push([lat, lng]);
  });

  if (searchMarker && currentLeafletMap.hasLayer(searchMarker)) {
    bounds.push(searchMarker.getLatLng());
  }

  if (bounds.length > 0) {
    currentLeafletMap.fitBounds(bounds, { padding: [30, 30] });
  }
}

function renderLiveList(data) {
  const list = document.getElementById("blood-bank-list");
  if (!list) return;

  if (!data.length) {
    list.innerHTML = `<p class="text-sm text-slate-500">No live data found.</p>`;
    return;
  }

  list.innerHTML = data.map(item => `
    <div class="border border-slate-200 rounded-xl p-3">
      <h4 class="font-bold text-slate-900">${escapeHtml(item.name)}</h4>
      <p class="text-xs text-slate-500">${escapeHtml(item.city)}, ${escapeHtml(item.state)}</p>
      <p class="text-xs text-slate-600">${escapeHtml(item.type)} • ${escapeHtml(item.blood_group)} • Units: ${escapeHtml(String(item.units))}</p>
      <p class="text-xs text-slate-500 mt-1">${escapeHtml(item.contact || "No contact")}</p>
    </div>
  `).join("");
}

async function searchPlaceAndFill() {
  const input = document.getElementById("place-search-input");
  const query = (input?.value || "").trim();

  if (!query) {
    alert("Please enter a city or place name.");
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&addressdetails=1&limit=1`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const data = await res.json();

    if (!data || !data.length) {
      alert("Location not found.");
      return;
    }

    const place = data[0];
    const address = place.address || {};

    const city = address.city || address.town || address.village || address.county || query;
    const state = address.state || address.region || "";
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);

    document.getElementById("live-city").value = city;
    document.getElementById("live-state").value = state;
    document.getElementById("live-lat").value = lat.toFixed(6);
    document.getElementById("live-lng").value = lon.toFixed(6);

    if (currentLeafletMap) {
      if (searchMarker) currentLeafletMap.removeLayer(searchMarker);
      searchMarker = L.marker([lat, lon]).addTo(currentLeafletMap);
      searchMarker.bindPopup(`<b>${escapeHtml(place.display_name)}</b>`).openPopup();
      currentLeafletMap.setView([lat, lon], 12);
    }
  } catch (error) {
    console.error("Place search failed:", error);
    alert("Failed to search place.");
  }
}

function findNearestRecord() {
  const lat = parseFloat(document.getElementById("live-lat").value);
  const lng = parseFloat(document.getElementById("live-lng").value);
  const type = document.getElementById("nearest-type").value;
  const bloodGroup = document.getElementById("nearest-blood-group").value;
  const resultBox = document.getElementById("nearest-result");

  if (isNaN(lat) || isNaN(lng)) {
    resultBox.innerHTML = `<span class="text-red-600">Search a place first to get exact location.</span>`;
    return;
  }

  let records = liveDataCache.filter(item => item.type === type);

  if (bloodGroup) {
    records = records.filter(item => item.blood_group === bloodGroup);
  }

  if (!records.length) {
    resultBox.innerHTML = `<span class="text-red-600">No matching ${type} found.</span>`;
    return;
  }

  let nearest = null;
  let minDistance = Infinity;

  records.forEach(item => {
    const itemLat = parseFloat(item.lat);
    const itemLng = parseFloat(item.lng);
    if (isNaN(itemLat) || isNaN(itemLng)) return;

    const distance = haversineDistance(lat, lng, itemLat, itemLng);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = item;
    }
  });

  if (!nearest) {
    resultBox.innerHTML = `<span class="text-red-600">No valid location found.</span>`;
    return;
  }

  resultBox.innerHTML = `
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <h4 class="font-bold text-slate-900">${escapeHtml(nearest.name)}</h4>
      <p class="text-sm text-slate-600 mt-1">${escapeHtml(nearest.type)} • ${escapeHtml(nearest.blood_group)}</p>
      <p class="text-sm text-slate-600">${escapeHtml(nearest.city)}, ${escapeHtml(nearest.state)}</p>
      <p class="text-sm text-slate-600">Contact: ${escapeHtml(nearest.contact || "No contact")}</p>
      <p class="text-sm font-bold text-emerald-700 mt-2">Distance: ${minDistance.toFixed(2)} km</p>
    </div>
  `;

  if (currentLeafletMap) {
    currentLeafletMap.setView([parseFloat(nearest.lat), parseFloat(nearest.lng)], 10);
  }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * (Math.PI / 180);
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function updateRequestStatus(id, status) {
  try {
    const currentUser = getStoredUser();

    const currentTitle = document.getElementById("dash-view-title")?.textContent || "";
    let currentView = "overview";

    if (currentTitle.includes("Donor")) currentView = "donor-records";
    else if (currentTitle.includes("Blood Requests")) currentView = "blood-requests";
    else if (currentTitle.includes("Inventory")) currentView = "inventory";
    else if (currentTitle.includes("Live Map")) currentView = "live-map";

    const res = await fetch(`${API_BASE}/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || "Failed to update status");
      return;
    }

    alert(result.message || `Record marked as ${status}`);

    renderDashboardContent(currentUser, currentView);

  } catch (error) {
    console.error("Status update failed:", error);
    alert("Failed to update status");
  }
}

function editRecord(id) {
  const item = liveDataCache.find(x => x.id === id);

  if (!item) {
    alert("Record not found");
    return;
  }

  showScreen("dashboard-layout");
  buildDashboardNav("admin", "live-map");
  document.getElementById("dash-view-title").textContent = "Edit Record";

  document.getElementById("dash-content-area").innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 class="text-xl font-bold mb-4">Edit Record</h3>

      <form onsubmit='updateRecord(event, ${item.id})' class="grid md:grid-cols-2 gap-4">
        <input id="edit-name" value="${escapeHtml(item.name)}" class="border p-3 rounded-xl" required>

        <select id="edit-type" class="border p-3 rounded-xl" required>
          <option value="donor" ${item.type === "donor" ? "selected" : ""}>Donor</option>
          <option value="patient" ${item.type === "patient" ? "selected" : ""}>Patient</option>
          <option value="hospital" ${item.type === "hospital" ? "selected" : ""}>Hospital</option>
        </select>

        <input id="edit-blood" value="${escapeHtml(item.blood_group)}" class="border p-3 rounded-xl" required>
        <input id="edit-city" value="${escapeHtml(item.city)}" class="border p-3 rounded-xl" required>
        <input id="edit-state" value="${escapeHtml(item.state)}" class="border p-3 rounded-xl" required>
        <input id="edit-lat" value="${escapeHtml(item.lat)}" class="border p-3 rounded-xl" required>
        <input id="edit-lng" value="${escapeHtml(item.lng)}" class="border p-3 rounded-xl" required>
        <input id="edit-contact" value="${escapeHtml(item.contact || "")}" class="border p-3 rounded-xl">
        <input id="edit-email" value="${escapeHtml(item.email || "")}" class="border p-3 rounded-xl">
        <input id="edit-units" value="${escapeHtml(item.units || 1)}" class="border p-3 rounded-xl">

        <select id="edit-status" class="border p-3 rounded-xl">
          <option value="pending" ${item.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="accepted" ${item.status === "accepted" ? "selected" : ""}>Accepted</option>
          <option value="rejected" ${item.status === "rejected" ? "selected" : ""}>Rejected</option>
        </select>

        <div class="md:col-span-2 flex gap-3">
          <button class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">Update</button>
          <button type="button" onclick="goToDashboard()" class="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

async function updateRecord(event, id) {
  event.preventDefault();

  const payload = {
    name: document.getElementById("edit-name").value,
    type: document.getElementById("edit-type").value,
    blood_group: document.getElementById("edit-blood").value,
    city: document.getElementById("edit-city").value,
    state: document.getElementById("edit-state").value,
    lat: document.getElementById("edit-lat").value,
    lng: document.getElementById("edit-lng").value,
    contact: document.getElementById("edit-contact").value,
    email: document.getElementById("edit-email").value,
    units: document.getElementById("edit-units").value,
    status: document.getElementById("edit-status").value
  };

  await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  alert("Updated successfully");
  const user = getStoredUser();
  openDashboard(user, "overview");
}

async function addLiveData(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById("live-name").value,
    type: document.getElementById("live-type").value,
    blood_group: document.getElementById("live-blood-group").value,
    city: document.getElementById("live-city").value,
    state: document.getElementById("live-state").value,
    lat: document.getElementById("live-lat").value,
    lng: document.getElementById("live-lng").value,
    contact: document.getElementById("live-contact").value,
   email: document.getElementById("live-email").value,
    units: document.getElementById("live-units").value
  };

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    alert(result.message || "Saved successfully");

    event.target.reset();
    document.getElementById("live-units").value = 1;

    const placeSearch = document.getElementById("place-search-input");
    if (placeSearch) placeSearch.value = "";

    await loadLiveData();
  } catch (error) {
    console.error("Error saving data:", error);
    alert("Failed to save data");
  }
}

// ---------- HELPERS ----------
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cardStat(title, value, colorClass) {
  return `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <p class="text-sm font-medium text-slate-500">${title}</p>
      <h3 class="text-3xl font-extrabold mt-2 ${colorClass}">${value}</h3>
    </div>
  `;
}

function profileCard(user) {
  return `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-2xl">
      <h4 class="text-xl font-bold mb-6">Profile Information</h4>
      <div class="grid md:grid-cols-2 gap-5 text-sm">
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <p class="text-slate-500">Full Name</p>
          <p class="font-bold text-slate-900 mt-1">${escapeHtml(user.name)}</p>
        </div>
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <p class="text-slate-500">Email</p>
          <p class="font-bold text-slate-900 mt-1">${escapeHtml(user.email)}</p>
        </div>
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <p class="text-slate-500">Role</p>
          <p class="font-bold text-slate-900 mt-1">${capitalize(user.role)}</p>
        </div>
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <p class="text-slate-500">Blood Group</p>
          <p class="font-bold text-slate-900 mt-1">${escapeHtml(user.bloodGroup || "-")}</p>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.onload = function () {
  updateNavbar(false);
  showScreen("home-screen");

  const savedUser = getStoredUser();
  if (savedUser) {
    updateNavbar(true);
    openDashboard(savedUser, "overview");
  }
};

function showRecordDetails(item) {
  const oldModal = document.getElementById("record-details-modal");
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = "record-details-modal";
  modal.className = "fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4";

  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 relative">
      <button onclick="document.getElementById('record-details-modal').remove()"
        class="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-bold">
        ×
      </button>

      <h2 class="text-2xl font-extrabold text-slate-900 mb-2">${escapeHtml(item.name)}</h2>
      <p class="text-sm text-slate-500 mb-6">${escapeHtml(item.type)} record</p>

      <div class="grid gap-3 text-sm">
        <div class="p-4 bg-slate-50 rounded-xl border"><b>Blood Group:</b> ${escapeHtml(item.blood_group)}</div>
        <div class="p-4 bg-slate-50 rounded-xl border"><b>Units:</b> ${escapeHtml(String(item.units || 0))}</div>
        <div class="p-4 bg-slate-50 rounded-xl border"><b>Location:</b> ${escapeHtml(item.city)}, ${escapeHtml(item.state)}</div>
        <div class="p-4 bg-slate-50 rounded-xl border"><b>Contact:</b> ${escapeHtml(item.contact || "No contact")}</div>
        <div class="p-4 bg-slate-50 rounded-xl border"><b>Email:</b> ${escapeHtml(item.email || "No email")}</div>
      </div>

      <div class="flex flex-wrap gap-2 mt-6">
        <a href="tel:${escapeHtml(item.contact || "")}" class="px-4 py-3 rounded-xl bg-green-600 text-white text-sm font-bold">Call Now</a>
        <a href="mailto:${escapeHtml(item.email || "")}" class="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold">Send Email</a>
        <a target="_blank" href="https://www.google.com/maps?q=${escapeHtml(item.lat)},${escapeHtml(item.lng)}"
          class="px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-bold">Open Map</a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function deleteRecord(id) {
  if (!confirm("Are you sure you want to delete this record?")) return;

  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE"
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || "Failed to delete record");
      return;
    }

    alert(result.message || "Deleted successfully");

    const user = getStoredUser();

    const currentTitle = document.getElementById("dash-view-title")?.textContent || "";
    let currentView = "overview";

    if (currentTitle.includes("Donor")) currentView = "donor-records";
    else if (currentTitle.includes("Blood Requests")) currentView = "blood-requests";
    else if (currentTitle.includes("Inventory")) currentView = "inventory";
    else if (currentTitle.includes("Live Map")) currentView = "live-map";

    renderDashboardContent(user, currentView);

  } catch (error) {
    console.error("Delete failed:", error);
    alert("Failed to delete record");
  }
}