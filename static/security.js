// ===== PARAMS =====
const params = new URLSearchParams(window.location.search);
const society = params.get("society") || "Society";
const user    = params.get("user") || "Security";
const BASE = window.location.origin;


// ===== INIT =====
window.addEventListener("DOMContentLoaded", function () {
    let name = user.includes("@") ? user.split("@")[0] : user;
    name = name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById("welcomeText").innerText = `Welcome, ${name} 👋`;
    document.getElementById("societyText").innerText = `${society}  •  Security Gate`;

    loadVisitors();
    connectWebSocket();
    // Real-time polling as fallback every 5s
    setInterval(loadVisitors, 5000);
});

// ===== SECTION NAVIGATION =====
const sections = ['dashboard', 'visitors', 'queue', 'log'];

function showSection(name, el) {
    sections.forEach(s => {
        const sec = document.getElementById(`sec-${s}`);
        if (sec) sec.style.display = 'none';
    });
    const target = document.getElementById(`sec-${name}`);
    if (target) target.style.display = name === 'dashboard' ? 'block' : 'contents';

    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    if (el) el.classList.add('active');

    if (name === 'visitors') loadVisitors();
    if (name === 'queue')    loadQueue();
    if (name === 'log')      loadLog();
}

// ===== LOAD VISITORS =====
function loadVisitors() {
    fetch(`${BASE}/visitors/${society}`)
    .then(r => r.json())
    .then(data => {
        updateStats(data);
        renderAwaitingList(data.filter(v => v.status === 'Approved'));
        renderInsideList(data.filter(v => v.status === 'Inside'));
        renderGateTable(data);
    })
    .catch(() => {});
}

// ===== STATS =====
function updateStats(data) {
    const approved = data.filter(v => v.status === 'Approved').length;
    const inside   = data.filter(v => v.status === 'Inside').length;
    const exited   = data.filter(v => v.status === 'Exited').length;

    const s1 = document.getElementById('stat-approved');
    const s2 = document.getElementById('stat-inside');
    const s3 = document.getElementById('stat-exited');
    if (s1) s1.textContent = approved;
    if (s2) s2.textContent = inside;
    if (s3) s3.textContent = exited;

    const ac = document.getElementById('awaitingCount');
    const ic = document.getElementById('insideCount');
    if (ac) ac.textContent = approved;
    if (ic) ic.textContent = inside;
}

// ===== AWAITING ENTRY LIST =====
function renderAwaitingList(data) {
    const container = document.getElementById('awaitingList');
    if (!container) return;

    if (!data.length) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span>No visitors awaiting entry</div>`;
        return;
    }

    container.innerHTML = data.map(v => `
    <div class="list-item">
        <div style="flex:1;">
            <div style="font-weight:600;color:var(--text);">${v.name}</div>
            <div style="font-size:12px;color:var(--text-muted);">Flat ${v.flat} · ${v.time||''}</div>
        </div>
        <button class="btn-sm entry-btn" onclick="markEntry('${v.name}')">Allow Entry</button>
    </div>`).join('');
}

// ===== INSIDE LIST =====
function renderInsideList(data) {
    const container = document.getElementById('insideList');
    if (!container) return;

    if (!data.length) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🏠</span>No visitors inside</div>`;
        return;
    }

    container.innerHTML = data.map(v => `
    <div class="list-item">
        <div style="flex:1;">
            <div style="font-weight:600;color:var(--text);">${v.name}</div>
            <div style="font-size:12px;color:var(--text-muted);">Flat ${v.flat} · Entered ${v.entry_time||v.time||''}</div>
        </div>
        <button class="btn-sm exit-btn" onclick="markExit('${v.name}')">Mark Exit</button>
    </div>`).join('');
}

// ===== FULL GATE TABLE =====
function renderGateTable(data) {
    const table = document.getElementById('visitorTable');
    if (!table) return;

    table.innerHTML = `<tr><th>Name</th><th>Flat</th><th>Status</th><th>Time</th><th>Action</th></tr>`;

    if (!data.length) {
        table.innerHTML += `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No visitors today</td></tr>`;
        return;
    }

    data.forEach(v => {
        let actionBtn = '';
        if (v.status === 'Approved') {
            actionBtn = `<button class="btn-sm entry-btn" onclick="markEntry('${v.name}')">Entry ✓</button>`;
        } else if (v.status === 'Inside') {
            actionBtn = `<button class="btn-sm exit-btn" onclick="markExit('${v.name}')">Exit →</button>`;
        } else {
            actionBtn = `<span style="color:var(--text-muted);font-size:12px;">Done</span>`;
        }

        table.innerHTML += `
        <tr>
            <td style="font-weight:600;color:var(--text);">${v.name}</td>
            <td>${v.flat}</td>
            <td><span class="status status-${(v.status||'').toLowerCase()}">${v.status}</span></td>
            <td style="color:var(--text-muted);font-size:12px;">${v.time||'–'}</td>
            <td>${actionBtn}</td>
        </tr>`;
    });
}

// ===== GATE LOG =====
function loadLog() {
    fetch(`${BASE}/visitors/${society}`)
    .then(r => r.json())
    .then(data => {
        const table = document.getElementById('logTable');
        if (!table) return;

        table.innerHTML = `<tr><th>Name</th><th>Flat</th><th>Status</th><th>Entry</th><th>Exit</th></tr>`;

        if (!data.length) {
            table.innerHTML += `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No gate log yet</td></tr>`;
            return;
        }

        [...data].reverse().forEach(v => {
            table.innerHTML += `
            <tr>
                <td style="font-weight:600;color:var(--text);">${v.name}</td>
                <td>${v.flat}</td>
                <td><span class="status status-${(v.status||'').toLowerCase()}">${v.status}</span></td>
                <td style="color:var(--text-muted);font-size:12px;">${v.entry_time||'–'}</td>
                <td style="color:var(--text-muted);font-size:12px;">${v.exit_time||'–'}</td>
            </tr>`;
        });
    })
    .catch(() => {});
}

// ===== QUEUE =====
function loadQueue() {
    fetch(`${BASE}/visitor-queue/${society}`)
    .then(r => r.json())
    .then(data => {
        const container = document.getElementById('queueList');
        const totalEl   = document.getElementById('queueTotal');
        if (!container) return;

        if (totalEl) totalEl.textContent = `${data.length} waiting`;

        if (!data.length) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span>Queue is empty</div>`;
            return;
        }

        container.innerHTML = data.map(v => `
        <div class="list-item queue-card">
            <span class="queue-badge">${v.position}</span>
            <div style="flex:1;">
                <div style="font-weight:600;color:var(--text);">${v.name}</div>
                <div style="font-size:12px;color:var(--text-muted);">Flat ${v.flat}</div>
            </div>
            <button class="btn-sm entry-btn" onclick="markEntry('${v.name}')">Allow Entry</button>
        </div>`).join('');
    })
    .catch(() => {});
}

// ===== MARK ENTRY =====
function markEntry(name) {
    fetch(`${BASE}/mark-entry/${society}/${name}`, { method: "POST" })
    .then(r => r.json())
    .then(() => {
        showToast('success', 'Entry Marked', `${name} has entered the society.`);
        loadVisitors();
        loadQueue();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
}

// ===== MARK EXIT =====
function markExit(name) {
    fetch(`${BASE}/mark-exit/${society}/${name}`, { method: "POST" })
    .then(r => r.json())
    .then(() => {
        showToast('success', 'Exit Marked', `${name} has exited the society.`);
        loadVisitors();
    })
    .catch(() => showToast('error', 'Error', 'Could not connect to server.'));
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
                showToast('success', 'Update', 'Visitor list updated.');
            });

            socket.on('notification', (n) => {
                showToast('success', 'Alert', n.text);
            });
        };
        document.head.appendChild(script);
    } catch(e) {
        console.log('WebSocket unavailable, using polling.');
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
