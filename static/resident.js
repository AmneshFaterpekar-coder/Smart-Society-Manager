// ===== PARAMS =====
const params = new URLSearchParams(window.location.search);
const society = params.get("society") || "Society";
const user    = params.get("user") || "Resident";
const BASE = window.location.origin;


// ===== INIT =====
window.addEventListener("DOMContentLoaded", function () {
    let name = user.includes("@") ? user.split("@")[0] : user;
    name = name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById("welcomeText").innerText = `Welcome, ${name} 👋`;
    document.getElementById("societyText").innerText = `${society}  •  Resident Portal`;

    loadAll();
    connectWebSocket();
    setInterval(loadAll, 30000);
});

// ===== SECTION NAVIGATION =====
const sections = ['dashboard','visitors','maintenance','amenities','complaints','announcements'];

function showSection(name, el) {
    sections.forEach(s => {
        const sec = document.getElementById(`sec-${s}`);
        if (sec) sec.style.display = 'none';
    });
    const target = document.getElementById(`sec-${name}`);
    if (target) target.style.display = name === 'dashboard' ? 'block' : 'contents';

    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    if (el) el.classList.add('active');

    if (name === 'visitors')      loadAllVisitors();
    if (name === 'maintenance')   loadAllMaintenance();
    if (name === 'amenities')     loadAmenities();
    if (name === 'complaints')    loadMyComplaints();
    if (name === 'announcements') loadAllAnnouncements();
}

// ===== LOAD ALL =====
function loadAll() {
    loadVisitors();
    loadMaintenance();
    loadAnnouncements();
    loadAmenitiesDash();
}

// ===== VISITORS =====
function loadVisitors() {
    fetch(`${BASE}/visitors/${society}`)
    .then(r => r.json())
    .then(data => renderVisitorTable('visitorTable', data.slice(-6).reverse(), false))
    .catch(() => {});
}

function loadAllVisitors() {
    fetch(`${BASE}/visitors/${society}`)
    .then(r => r.json())
    .then(data => renderVisitorTable('allVisitorTable', data.reverse(), true))
    .catch(() => {});
}

function renderVisitorTable(tableId, data, showFlat) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const headers = showFlat
        ? `<tr><th>Name</th><th>Flat</th><th>Status</th><th>Time</th></tr>`
        : `<tr><th>Name</th><th>Status</th><th>Time</th></tr>`;
    table.innerHTML = headers;
    if (!data.length) {
        table.innerHTML += `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No visitors yet</td></tr>`;
        return;
    }
    data.forEach(v => {
        table.innerHTML += showFlat
            ? `<tr>
                <td style="font-weight:600;color:var(--text);">${v.name}</td>
                <td>${v.flat}</td>
                <td><span class="status status-${(v.status||'').toLowerCase()}">${v.status}</span></td>
                <td style="color:var(--text-muted);font-size:12px;">${v.time||'–'}</td>
               </tr>`
            : `<tr>
                <td style="font-weight:600;color:var(--text);">${v.name}</td>
                <td><span class="status status-${(v.status||'').toLowerCase()}">${v.status}</span></td>
                <td style="color:var(--text-muted);font-size:12px;">${v.time||'–'}</td>
               </tr>`;
    });
}

// ===== VISITOR MODAL =====
function openVisitorModal() {
    document.getElementById('visitorModal').classList.add('open');
}
function closeModal() {
    document.getElementById('visitorModal').classList.remove('open');
}

function approveVisitor() {
    const name = document.getElementById("vName").value.trim();
    const flat = document.getElementById("vFlat").value.trim();

    if (!name || !flat) return showToast('warning', 'Missing', 'Please enter visitor name and flat.');

    fetch(`${BASE}/approve-visitor`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name, flat, society })
    })
    .then(r => r.json())
    .then(() => {
        closeModal();
        document.getElementById("vName").value = "";
        document.getElementById("vFlat").value = "";
        showToast('success', 'Approved!', `${name} is approved for Flat ${flat}.`);
        loadVisitors();
        loadAllVisitors();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

// ===== MAINTENANCE =====
function loadMaintenance() {
    fetch(`${BASE}/maintenance/${society}`)
    .then(r => r.json())
    .then(data => renderMaintenanceTable('maintenanceTable', data))
    .catch(() => {});
}

function loadAllMaintenance() {
    fetch(`${BASE}/maintenance/${society}`)
    .then(r => r.json())
    .then(data => renderMaintenanceTable('allMaintenanceTable', data))
    .catch(() => {});
}

function renderMaintenanceTable(tableId, data) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.innerHTML = `<tr><th>Flat</th><th>Amount</th><th>Status</th><th>Action</th></tr>`;
    if (!data.length) {
        table.innerHTML += `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No bills</td></tr>`;
        return;
    }
    data.forEach(m => {
        const btn = m.status === "Pending"
            ? `<button class="btn-sm btn-success" onclick="payMaintenance('${m.flat}')">Pay ₹${m.amount}</button>`
            : `<span style="color:var(--success);font-size:12px;">✓ Paid</span>`;
        table.innerHTML += `
        <tr>
            <td style="font-weight:600;color:var(--text);">${m.flat}</td>
            <td>₹${m.amount}</td>
            <td><span class="status status-${(m.status||'pending').toLowerCase()}">${m.status}</span></td>
            <td>${btn}</td>
        </tr>`;
    });
}

function payMaintenance(flat) {
    fetch(`${BASE}/pay-maintenance/${society}/${flat}`, { method: "POST" })
    .then(r => r.json())
    .then(() => {
        showToast('success', 'Payment Done!', `Maintenance paid for Flat ${flat}.`);
        loadMaintenance();
        loadAllMaintenance();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

// ===== AMENITIES =====
function bookAmenity() {
    const name  = document.getElementById("amenityName").value;
    const date  = document.getElementById("amenityDate").value;
    const start = document.getElementById("startTime").value;
    const end   = document.getElementById("endTime").value;

    if (!date || !start || !end) return showToast('warning', 'Missing', 'Please fill all booking fields.');
    if (start >= end) return showToast('warning', 'Invalid Time', 'End time must be after start time.');

    fetch(`${BASE}/book-amenity`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name, date, start, end, society, user })
    })
    .then(r => r.json())
    .then(() => {
        showToast('success', 'Booked!', `${name} booked on ${date}.`);
        loadAmenities();
        loadAmenitiesDash();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

function loadAmenities() {
    fetch(`${BASE}/amenities/${society}`)
    .then(r => r.json())
    .then(data => renderAmenityList('amenityList', data))
    .catch(() => {});
}

function loadAmenitiesDash() {
    fetch(`${BASE}/amenities/${society}`)
    .then(r => r.json())
    .then(data => renderAmenityList('amenityListDash', data.slice(-4).reverse()))
    .catch(() => {});
}

function renderAmenityList(listId, data) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = "";
    if (!data.length) {
        list.innerHTML = `<div class="empty-state"><span class="empty-icon">🏊</span>No bookings yet</div>`;
        return;
    }
    data.forEach(a => {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `
            <span style="font-size:18px;">${getAmenityIcon(a.name)}</span>
            <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);">${a.name}</div>
                <div style="font-size:12px;color:var(--text-muted);">${a.date}  •  ${a.start}–${a.end}</div>
            </div>`;
        list.appendChild(item);
    });
}

function getAmenityIcon(name) {
    const icons = { Gym: '🏋️', Pool: '🏊', Clubhouse: '🏛️', 'Tennis Court': '🎾', 'Badminton Court': '🏸' };
    return icons[name] || '📅';
}

// ===== ANNOUNCEMENTS =====
function loadAnnouncements() {
    fetch(`${BASE}/announcements/${society}`)
    .then(r => r.json())
    .then(data => renderAnnouncementList('announcementList', data))
    .catch(() => {});
}
function loadAllAnnouncements() {
    fetch(`${BASE}/announcements/${society}`)
    .then(r => r.json())
    .then(data => renderAnnouncementList('allAnnouncementList', data))
    .catch(() => {});
}

function renderAnnouncementList(listId, data) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = "";
    if (!data.length) {
        list.innerHTML = `<div class="empty-state"><span class="empty-icon">📢</span>No announcements yet</div>`;
        return;
    }
    [...data].reverse().forEach(a => {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `
            <span style="flex:1;">${a.text}</span>
            <span style="font-size:11px;color:var(--text-muted);">${a.time||''}</span>`;
        list.appendChild(item);
    });
}

// ===== COMPLAINTS =====
function submitComplaint() {
    const flat    = document.getElementById("compFlat").value.trim();
    const subject = document.getElementById("compSubject").value.trim();
    const desc    = document.getElementById("compDesc").value.trim();

    if (!flat || !subject) return showToast('warning', 'Missing', 'Please fill flat and subject.');

    fetch(`${BASE}/add-complaint`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ flat, subject, description: desc, society, user })
    })
    .then(r => r.json())
    .then(() => {
        document.getElementById("compFlat").value = "";
        document.getElementById("compSubject").value = "";
        document.getElementById("compDesc").value = "";
        showToast('success', 'Submitted!', 'Your complaint has been sent to admin.');
        loadMyComplaints();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

function loadMyComplaints() {
    fetch(`${BASE}/complaints/${society}`)
    .then(r => r.json())
    .then(data => {
        const container = document.getElementById("myComplaints");
        if (!container) return;
        const mine = data.filter(c => c.user === user || c.flat);
        if (!mine.length) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span>No complaints filed</div>`;
            return;
        }
        container.innerHTML = mine.map(c => `
        <div class="list-item" style="border-left:3px solid ${c.status==='Open'?'var(--danger)':'var(--success)'};">
            <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);">${c.subject}</div>
                <div style="font-size:12px;color:var(--text-muted);">Flat ${c.flat} · ${c.time||''}</div>
            </div>
            <span class="status status-${(c.status||'open').toLowerCase()}">${c.status}</span>
        </div>`).join('');
    })
    .catch(() => {});
}

// ===== WEBSOCKET =====
function connectWebSocket() {
    try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js';
        script.onload = () => {
            const socket = io(BASE);
            socket.emit('join', { society });

            socket.on('visitors_updated', () => {
                loadVisitors();
                document.getElementById('notifDot').classList.add('active');
            });

            socket.on('notification', (n) => {
                showToast('success', 'Notice', n.text);
                document.getElementById('notifDot').classList.add('active');
            });

            socket.on('announcement_added', () => {
                loadAnnouncements();
                showToast('success', 'New Announcement', 'Admin posted a new announcement.');
            });
        };
        document.head.appendChild(script);
    } catch(e) {
        console.log('WebSocket not available.');
    }
}

// ===== TOAST =====
function showToast(type, title, body) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-body">${body}</div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== LOGOUT =====
function logout() {
    window.location.href = "login.html";
}
