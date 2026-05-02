// ===== URL PARAMS =====
const params = new URLSearchParams(window.location.search);
const society = params.get("society") || "Society";
const user = params.get("user") || "Admin";

const BASE = window.location.origin;


// ===== WELCOME =====
window.addEventListener("DOMContentLoaded", function () {
    let name = user.includes("@") ? user.split("@")[0] : user;
    name = name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById("welcomeText").innerText = `Welcome, ${name} 👋`;
    document.getElementById("societyText").innerText = `${society}  •  Admin Panel`;

    loadAll();
    connectWebSocket();
    setInterval(loadAll, 30000); // refresh every 30s
});

// ===== SECTION NAVIGATION =====
const sections = ['dashboard','visitors','maintenance','amenities','staff','complaints','announcements','ai'];

function showSection(name, el) {
    // Hide all
    sections.forEach(s => {
        const el = document.getElementById(`sec-${s}`);
        if (el) el.style.display = 'none';
    });

    // Show target
    const target = document.getElementById(`sec-${name}`);
    if (target) target.style.display = 'contents';

    // Update sidebar active
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    if (el) el.classList.add('active');

    // Load section data
    if (name === 'visitors')      { loadVisitors(); loadVisitorQueue(); }
    if (name === 'maintenance')   loadMaintenanceTable();
    if (name === 'amenities')     loadAmenitiesTable();
    if (name === 'staff')         loadStaff();
    if (name === 'complaints')    loadComplaints();
    if (name === 'announcements') loadAnnouncements2();
    if (name === 'ai')            loadAIInsights();
}

// ===== LOAD ALL (dashboard) =====
function loadAll() {
    loadStats();
    loadVisitors();
    loadAnnouncements();
    loadNotifications();
    loadComplaintDash();
    loadAIInsights();
}

// ===== STATS =====
function loadStats() {
    fetch(`${BASE}/stats/${society}`)
    .then(r => r.json())
    .then(d => {
        document.getElementById("stat-residents").textContent  = d.total_residents;
        document.getElementById("stat-payments").textContent   = d.pending_payments;
        document.getElementById("stat-visitors").textContent   = d.visitors_today;
        document.getElementById("stat-staff").textContent      = d.total_staff;
        document.getElementById("stat-complaints").textContent = d.open_complaints;
    })
    .catch(() => {});
}

// ===== VISITORS =====
function loadVisitors() {
    fetch(`${BASE}/visitors/${society}`)
    .then(r => r.json())
    .then(data => {
        renderVisitorTable('visitorTable', data.slice(-8).reverse());
        renderVisitorTable('allVisitorTable', data);
    })
    .catch(() => {});
}

function renderVisitorTable(tableId, data) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.innerHTML = `<tr><th>Name</th><th>Flat</th><th>Status</th><th>Time</th></tr>`;
    if (!data.length) {
        table.innerHTML += `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No visitors yet</td></tr>`;
        return;
    }
    data.forEach(v => {
        table.innerHTML += `
        <tr>
            <td>${v.name}</td>
            <td>${v.flat}</td>
            <td><span class="status status-${(v.status||'').toLowerCase()}">${v.status}</span></td>
            <td style="color:var(--text-muted);font-size:12px;">${v.time || '–'}</td>
        </tr>`;
    });
}

// ===== VISITOR QUEUE =====
function loadVisitorQueue() {
    fetch(`${BASE}/visitor-queue/${society}`)
    .then(r => r.json())
    .then(data => {
        const container = document.getElementById('visitorQueue');
        const countEl   = document.getElementById('queueCount');
        if (!container) return;

        countEl.textContent = `${data.length} waiting`;

        if (!data.length) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span>No visitors in queue</div>`;
            return;
        }

        container.innerHTML = data.map(v => `
        <div class="list-item">
            <span class="queue-badge">${v.position}</span>
            <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);">${v.name}</div>
                <div style="font-size:12px;color:var(--text-muted);">Flat ${v.flat}</div>
            </div>
        </div>`).join('');
    })
    .catch(() => {});
}

// ===== ANNOUNCEMENTS =====
function addAnnouncement() {
    const text = document.getElementById("annInput").value.trim();
    if (!text) return showToast('warning', 'Empty', 'Please type an announcement.');
    postAnnouncement(text, "annInput", "announcementList");
}
function addAnnouncement2() {
    const text = document.getElementById("annInput2").value.trim();
    if (!text) return showToast('warning', 'Empty', 'Please type an announcement.');
    postAnnouncement(text, "annInput2", "announcementList2");
}

function postAnnouncement(text, inputId, listId) {
    fetch(`${BASE}/add-announcement`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ text, society })
    })
    .then(r => r.json())
    .then(() => {
        document.getElementById(inputId).value = "";
        showToast('success', 'Posted', 'Announcement published to all residents.');
        loadAnnouncements();
        if (listId === "announcementList2") loadAnnouncements2();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

function loadAnnouncements() {
    fetch(`${BASE}/announcements/${society}`)
    .then(r => r.json())
    .then(data => renderAnnouncementList("announcementList", data))
    .catch(() => {});
}
function loadAnnouncements2() {
    fetch(`${BASE}/announcements/${society}`)
    .then(r => r.json())
    .then(data => renderAnnouncementList("announcementList2", data))
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
        const li = document.createElement("div");
        li.className = "list-item";
        li.innerHTML = `<span style="flex:1;">${a.text}</span><span style="font-size:11px;color:var(--text-muted);">${a.time||''}</span>`;
        list.appendChild(li);
    });
}

// ===== MAINTENANCE =====
function addMaintenance() {
    const flat   = document.getElementById("flatInput").value.trim();
    const name   = document.getElementById("residentName").value.trim();
    const amount = document.getElementById("amountInput").value;

    if (!flat || !amount) return showToast('warning', 'Missing Fields', 'Please fill flat and amount.');

    fetch(`${BASE}/add-maintenance`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ flat, name, amount: Number(amount), society })
    })
    .then(r => r.json())
    .then(() => {
        document.getElementById("flatInput").value = "";
        document.getElementById("residentName").value = "";
        document.getElementById("amountInput").value = "";
        showToast('success', 'Added', `Bill added for Flat ${flat}.`);
        loadMaintenanceTable();
        loadStats();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

function loadMaintenanceTable() {
    fetch(`${BASE}/maintenance/${society}`)
    .then(r => r.json())
    .then(data => {
        const table = document.getElementById("maintenanceTable");
        if (!table) return;
        table.innerHTML = `<tr><th>Flat</th><th>Amount</th><th>Status</th></tr>`;
        if (!data.length) {
            table.innerHTML += `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">No bills yet</td></tr>`;
            return;
        }
        data.forEach(m => {
            table.innerHTML += `
            <tr>
                <td>${m.flat}</td>
                <td>₹${m.amount}</td>
                <td><span class="status status-${(m.status||'pending').toLowerCase()}">${m.status}</span></td>
            </tr>`;
        });
    })
    .catch(() => {});
}

// ===== AMENITIES =====
function loadAmenitiesTable() {
    fetch(`${BASE}/amenities/${society}`)
    .then(r => r.json())
    .then(data => {
        const table = document.getElementById("amenityTable");
        if (!table) return;
        table.innerHTML = `<tr><th>Amenity</th><th>Date</th><th>Time</th><th>Booked By</th></tr>`;
        if (!data.length) {
            table.innerHTML += `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No bookings yet</td></tr>`;
            return;
        }
        data.forEach(a => {
            table.innerHTML += `
            <tr>
                <td>${a.name}</td>
                <td>${a.date}</td>
                <td>${a.start} – ${a.end}</td>
                <td style="color:var(--text-muted);">${a.booked_by || a.user || '–'}</td>
            </tr>`;
        });
    })
    .catch(() => {});
}

// ===== STAFF =====
function addStaff() {
    const name    = document.getElementById("staffName").value.trim();
    const role    = document.getElementById("staffRole").value;
    const contact = document.getElementById("staffContact").value.trim();

    if (!name) return showToast('warning', 'Missing', 'Please enter staff name.');

    fetch(`${BASE}/add-staff`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name, role, contact, society })
    })
    .then(r => r.json())
    .then(() => {
        document.getElementById("staffName").value = "";
        document.getElementById("staffContact").value = "";
        showToast('success', 'Added', `${name} (${role}) added to staff.`);
        loadStaff();
        loadStats();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

function loadStaff() {
    fetch(`${BASE}/staff/${society}`)
    .then(r => r.json())
    .then(data => {
        const table = document.getElementById("staffTable");
        if (!table) return;
        table.innerHTML = `<tr><th>Name</th><th>Role</th><th>Contact</th><th>Added</th></tr>`;
        if (!data.length) {
            table.innerHTML += `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No staff yet</td></tr>`;
            return;
        }
        data.forEach(s => {
            table.innerHTML += `
            <tr>
                <td style="font-weight:600;color:var(--text);">${s.name}</td>
                <td><span class="badge badge-blue">${s.role}</span></td>
                <td style="color:var(--text-muted);">${s.contact || '–'}</td>
                <td style="color:var(--text-muted);font-size:12px;">${s.added_on || '–'}</td>
            </tr>`;
        });
    })
    .catch(() => {});
}

// ===== COMPLAINTS =====
function loadComplaints() {
    fetch(`${BASE}/complaints/${society}`)
    .then(r => r.json())
    .then(data => {
        const table = document.getElementById("complaintTable");
        if (!table) return;
        table.innerHTML = `<tr><th>Flat</th><th>Subject</th><th>Description</th><th>Time</th><th>Status</th><th>Action</th></tr>`;
        if (!data.length) {
            table.innerHTML += `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No complaints yet</td></tr>`;
            return;
        }
        data.forEach((c, i) => {
            const actionBtn = c.status === 'Open'
                ? `<button class="btn-sm btn-success" onclick="resolveComplaint(${i})">Resolve</button>`
                : `<span style="color:var(--success);font-size:12px;">✓ Done</span>`;
            table.innerHTML += `
            <tr>
                <td>${c.flat || '–'}</td>
                <td style="font-weight:600;color:var(--text);">${c.subject || '–'}</td>
                <td style="color:var(--text-muted);font-size:12px;">${c.description || '–'}</td>
                <td style="color:var(--text-muted);font-size:12px;">${c.time || '–'}</td>
                <td><span class="status status-${(c.status||'open').toLowerCase()}">${c.status}</span></td>
                <td>${actionBtn}</td>
            </tr>`;
        });
    })
    .catch(() => {});
}

function loadComplaintDash() {
    fetch(`${BASE}/complaints/${society}`)
    .then(r => r.json())
    .then(data => {
        const container = document.getElementById("complaintListDash");
        if (!container) return;
        const open = data.filter(c => c.status === 'Open').slice(-4).reverse();
        if (!open.length) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span>No open complaints</div>`;
            return;
        }
        container.innerHTML = open.map((c, i) => `
        <div class="list-item complaint-item">
            <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);">${c.subject}</div>
                <div style="font-size:12px;color:var(--text-muted);">Flat ${c.flat} · ${c.time}</div>
            </div>
            <button class="btn-sm btn-success" onclick="resolveComplaint(${i});loadComplaintDash();">Resolve</button>
        </div>`).join('');
    })
    .catch(() => {});
}

function resolveComplaint(idx) {
    fetch(`${BASE}/resolve-complaint/${society}/${idx}`, { method: "POST" })
    .then(r => r.json())
    .then(() => {
        showToast('success', 'Resolved', 'Complaint marked as resolved.');
        loadComplaints();
        loadComplaintDash();
        loadStats();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

// ===== NOTIFICATIONS =====
function loadNotifications() {
    fetch(`${BASE}/notifications/${society}`)
    .then(r => r.json())
    .then(data => {
        const list = document.getElementById("notificationList");
        if (!list) return;
        list.innerHTML = "";
        if (!data.length) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">🔔</span>No activity yet</div>`;
            return;
        }
        data.slice(0, 10).forEach(n => {
            const li = document.createElement("div");
            li.className = "list-item";
            li.innerHTML = `
                <span style="flex:1;font-size:13px;">${n.text}</span>
                <span style="font-size:11px;color:var(--text-muted);flex-shrink:0;">${n.time||''}</span>`;
            list.appendChild(li);
        });
    })
    .catch(() => {});
}

// ===== WEBSOCKET (real-time) =====
function connectWebSocket() {
    try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js';
        script.onload = () => {
            const socket = io(BASE);
            socket.emit('join', { society });

            socket.on('visitors_updated', () => {
                loadVisitors();
                loadStats();
                document.getElementById('notifDot').classList.add('active');
            });

            socket.on('notification', (n) => {
                showToast('success', 'Update', n.text);
                loadNotifications();
                document.getElementById('notifDot').classList.add('active');
            });

            socket.on('announcement_added', () => loadAnnouncements());
        };
        document.head.appendChild(script);
    } catch(e) {
        console.log('WebSocket not available, using polling.');
    }
}

// ===== TOAST HELPER =====
function showToast(type, title, body) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-body">${body}</div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== AI INSIGHTS =====
function loadAIInsights() {
    loadAIPeak();
    loadAIAnomalies();
}

function loadAIPeak() {
    fetch(`${BASE}/predict-peak/${society}`)
    .then(r => r.json())
    .then(data => {
        renderPeakWidget('aiPeakWidget', data);
        renderPeakWidget('aiPeakFull', data);
        renderUsageBreakdown(data);
    })
    .catch(() => {});
}

function renderPeakWidget(elId, data) {
    const el = document.getElementById(elId);
    if (!el) return;

    if (data.status === 'insufficient_data') {
        el.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">📊</span>
            <div>${data.message}</div>
        </div>`;
        return;
    }

    const tomorrowAlert = data.tomorrow_busy
        ? `<div class="list-item" style="border-left:3px solid var(--warning);margin-top:8px;">
               <span style="font-size:16px;">📅</span>
               <div><div style="font-weight:600;color:var(--text);">Busy Tomorrow</div>
               <div style="font-size:12px;color:var(--text-muted);">${data.tomorrow_day} historically has high bookings</div></div>
           </div>`
        : '';

    el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
        <div class="list-item" style="border-left:3px solid var(--accent);">
            <span style="font-size:20px;">🏆</span>
            <div style="flex:1;">
                <div style="font-weight:700;color:var(--text);font-size:15px;">${data.peak_amenity}</div>
                <div style="font-size:12px;color:var(--text-muted);">Most booked amenity (${data.peak_amenity_count} bookings)</div>
            </div>
        </div>
        <div class="list-item" style="border-left:3px solid var(--success);">
            <span style="font-size:20px;">⏰</span>
            <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);">Peak Hour: ${data.peak_hour}</div>
                <div style="font-size:12px;color:var(--text-muted);">Highest booking activity</div>
            </div>
        </div>
        <div class="list-item" style="border-left:3px solid var(--warning);">
            <span style="font-size:20px;">📅</span>
            <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);">Busiest Day: ${data.peak_day}</div>
                <div style="font-size:12px;color:var(--text-muted);">Most bookings happen on this day</div>
            </div>
        </div>
        ${tomorrowAlert}
    </div>`;
}

function renderUsageBreakdown(data) {
    const el = document.getElementById('aiUsageBreakdown');
    if (!el || !data.usage_breakdown) return;

    if (!data.usage_breakdown.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">📈</span>No bookings yet</div>`;
        return;
    }

    const max = data.usage_breakdown[0].count;
    el.innerHTML = data.usage_breakdown.map(item => {
        const pct = Math.round((item.count / max) * 100);
        const icons = { Gym:'🏋️', Pool:'🏊', Clubhouse:'🏛️', 'Tennis Court':'🎾', 'Badminton Court':'🏸' };
        return `
        <div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                <span style="font-size:13px;color:var(--text);">${icons[item.name]||'📅'} ${item.name}</span>
                <span style="font-size:12px;color:var(--text-muted);font-weight:600;">${item.count} bookings</span>
            </div>
            <div style="background:var(--surface2);border-radius:4px;height:6px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:4px;transition:width 0.6s ease;"></div>
            </div>
        </div>`;
    }).join('');
}

function loadAIAnomalies() {
    fetch(`${BASE}/security-anomalies/${society}`)
    .then(r => r.json())
    .then(data => {
        renderAnomalies('aiAnomalyWidget', data, 3);   // dashboard - show max 3
        renderAnomalies('aiAnomalyFull',   data, 999); // full page - show all

        // Update badge
        const badge = document.getElementById('anomalyBadge');
        if (badge) {
            badge.textContent = data.total;
            badge.className = data.total > 0 ? 'badge badge-red' : 'badge badge-green';
        }

        // Show toast if new danger anomaly found
        const dangers = data.anomalies.filter(a => a.severity === 'danger');
        if (dangers.length > 0) {
            showToast('error', '🚨 Security Alert', dangers[0].message);
        }
    })
    .catch(() => {});
}

function renderAnomalies(elId, data, maxShow) {
    const el = document.getElementById(elId);
    if (!el) return;

    if (!data.anomalies || !data.anomalies.length) {
        el.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">✅</span>
            <div style="color:var(--success);font-weight:600;">All clear</div>
            <div style="margin-top:4px;">No anomalies detected (${data.scanned || 0} visitors scanned)</div>
        </div>`;
        return;
    }

    const toShow = data.anomalies.slice(0, maxShow);
    el.innerHTML = toShow.map(a => `
    <div class="list-item" style="border-left:3px solid var(--${a.severity === 'danger' ? 'danger' : 'warning'});margin-bottom:8px;">
        <span style="font-size:18px;flex-shrink:0;">${a.icon}</span>
        <div style="flex:1;">
            <div style="font-weight:700;color:${a.severity === 'danger' ? 'var(--danger)' : 'var(--warning)'};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${a.type}</div>
            <div style="font-size:13px;color:var(--text-dim);margin-top:2px;">${a.message}</div>
        </div>
    </div>`).join('');

    if (data.anomalies.length > maxShow) {
        el.innerHTML += `<div style="text-align:center;font-size:12px;color:var(--text-muted);padding:8px;">+${data.anomalies.length - maxShow} more — view AI Insights tab</div>`;
    }
}

// ===== LOGOUT =====
function logout() {
    window.location.href = "login.html";
}
