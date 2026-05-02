from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from datetime import datetime
import os

app = Flask(__name__, static_folder='static', static_url_path='')

# Serve login page at root
@app.route('/')
def home():
    return send_from_directory('static', 'login.html')

# Serve all other static files (html, css, js)
@app.route('/<path:filename>')
def serve_file(filename):
    return send_from_directory('static', filename)

# ---------------- IN-MEMORY DATA ---------------- #

visitors = []
announcements = []
amenities = []
staff = []
notifications = []
complaints = []

maintenance = [
    {"name": "Rajesh", "flat": "A101", "amount": 2000, "status": "Pending", "society": "Greenwood"},
    {"name": "Priya",  "flat": "B202", "amount": 1500, "status": "Pending", "society": "Greenwood"}
]

# Visitor queue per society
visitor_queue = {}   # { society: [visitor, ...] }

# ---------------- HELPERS ---------------- #

def push_notification(society, text):
    """Add a notification and broadcast via WebSocket."""
    note = {"text": text, "time": datetime.now().strftime("%H:%M"), "society": society}
    notifications.append(note)
    socketio.emit("notification", note, room=society)

# ---------------- HOME ---------------- #

@app.route('/')
def home():
    return send_from_directory('static', 'login.html')

@app.route('/<path:filename>')
def serve_file(filename):
    return send_from_directory('static', filename)

# ---------------- VISITORS ---------------- #

@app.route('/approve-visitor', methods=['POST'])
def approve_visitor():
    data = request.json
    data["status"] = "Approved"
    data["time"] = datetime.now().strftime("%H:%M")
    visitors.append(data)

    society = data.get("society", "")
    push_notification(society, f"Visitor '{data['name']}' approved for Flat {data['flat']}")
    socketio.emit("visitors_updated", {}, room=society)

    # Add to queue
    if society not in visitor_queue:
        visitor_queue[society] = []
    visitor_queue[society].append(data)

    return jsonify({"message": "Visitor Approved"})


@app.route('/mark-entry/<society>/<name>', methods=['POST'])
def mark_entry(society, name):
    for v in visitors:
        if v["name"] == name and v["society"] == society:
            v["status"] = "Inside"
            v["entry_time"] = datetime.now().strftime("%H:%M")

    # Remove from queue
    if society in visitor_queue:
        visitor_queue[society] = [v for v in visitor_queue[society] if v["name"] != name]

    push_notification(society, f"Visitor '{name}' entered the society")
    socketio.emit("visitors_updated", {}, room=society)
    return jsonify({"message": "Entry Marked"})


@app.route('/mark-exit/<society>/<name>', methods=['POST'])
def mark_exit(society, name):
    for v in visitors:
        if v["name"] == name and v["society"] == society:
            v["status"] = "Exited"
            v["exit_time"] = datetime.now().strftime("%H:%M")

    push_notification(society, f"Visitor '{name}' exited the society")
    socketio.emit("visitors_updated", {}, room=society)
    return jsonify({"message": "Exit Marked"})


@app.route('/visitors/<society>', methods=['GET'])
def get_visitors(society):
    return jsonify([v for v in visitors if v.get("society") == society])


@app.route('/visitor-queue/<society>', methods=['GET'])
def get_visitor_queue(society):
    q = visitor_queue.get(society, [])
    return jsonify([{"name": v["name"], "flat": v["flat"], "position": i+1}
                    for i, v in enumerate(q)])

# ---------------- ANNOUNCEMENTS ---------------- #

@app.route('/announcements/<society>', methods=['GET'])
def get_announcements(society):
    return jsonify([a for a in announcements if a.get("society") == society])


@app.route('/add-announcement', methods=['POST'])
def add_announcement():
    data = request.json
    data["time"] = datetime.now().strftime("%d %b %H:%M")
    announcements.append(data)
    socketio.emit("announcement_added", data, room=data.get("society", ""))
    return jsonify({"message": "Announcement Added"})

# ---------------- MAINTENANCE ---------------- #

@app.route('/maintenance/<society>', methods=['GET'])
def get_maintenance(society):
    return jsonify([m for m in maintenance if m.get("society") == society])


@app.route('/add-maintenance', methods=['POST'])
def add_maintenance():
    data = request.json
    data["status"] = "Pending"
    maintenance.append(data)
    push_notification(data.get("society",""), f"New maintenance bill added for Flat {data['flat']} — ₹{data['amount']}")
    return jsonify({"message": "Maintenance Bill Added"})


@app.route('/pay-maintenance/<society>/<flat>', methods=['POST'])
def pay_maintenance(society, flat):
    for m in maintenance:
        if m["flat"] == flat and m.get("society") == society:
            m["status"] = "Paid"
            m["amount"] = 0
    push_notification(society, f"Maintenance paid for Flat {flat}")
    return jsonify({"message": "Payment Successful"})

# ---------------- AMENITIES ---------------- #

@app.route('/book-amenity', methods=['POST'])
def book_amenity():
    data = request.json
    data["booked_by"] = data.get("user", "Resident")
    amenities.append(data)
    push_notification(data.get("society",""), f"{data['name']} booked on {data['date']} ({data['start']}–{data['end']})")
    return jsonify({"message": "Amenity Booked Successfully"})


@app.route('/amenities/<society>', methods=['GET'])
def get_amenities(society):
    return jsonify([a for a in amenities if a.get("society") == society])

# ---------------- STAFF ---------------- #

@app.route('/add-staff', methods=['POST'])
def add_staff():
    data = request.json
    data["added_on"] = datetime.now().strftime("%d %b %Y")
    staff.append(data)
    return jsonify({"message": "Staff Added"})


@app.route('/staff/<society>', methods=['GET'])
def get_staff(society):
    return jsonify([s for s in staff if s.get("society") == society])

# ---------------- COMPLAINTS ---------------- #

@app.route('/add-complaint', methods=['POST'])
def add_complaint():
    data = request.json
    data["status"] = "Open"
    data["time"] = datetime.now().strftime("%d %b %H:%M")
    complaints.append(data)
    push_notification(data.get("society",""), f"New complaint from Flat {data.get('flat','?')}: {data.get('subject','')}")
    return jsonify({"message": "Complaint Submitted"})


@app.route('/complaints/<society>', methods=['GET'])
def get_complaints(society):
    return jsonify([c for c in complaints if c.get("society") == society])


@app.route('/resolve-complaint/<society>/<int:idx>', methods=['POST'])
def resolve_complaint(society, idx):
    soc_complaints = [c for c in complaints if c.get("society") == society]
    if 0 <= idx < len(soc_complaints):
        soc_complaints[idx]["status"] = "Resolved"
    return jsonify({"message": "Complaint Resolved"})

# ---------------- NOTIFICATIONS ---------------- #

@app.route('/notifications/<society>', methods=['GET'])
def get_notifications(society):
    soc = [n for n in notifications if n.get("society") == society]
    return jsonify(list(reversed(soc[-20:])))  # last 20, newest first


@app.route('/add-notification', methods=['POST'])
def add_notification():
    data = request.json
    notifications.append(data)
    return jsonify({"message": "Notification Added"})

# ---------------- DASHBOARD STATS ---------------- #

@app.route('/stats/<society>', methods=['GET'])
def get_stats(society):
    total_residents = len(set(
        m["flat"] for m in maintenance if m.get("society") == society
    ))
    pending_payments = len([m for m in maintenance if m.get("society") == society and m["status"] == "Pending"])
    visitors_today = len([v for v in visitors if v.get("society") == society])
    total_staff = len([s for s in staff if s.get("society") == society])
    open_complaints = len([c for c in complaints if c.get("society") == society and c["status"] == "Open"])

    return jsonify({
        "total_residents": total_residents,
        "pending_payments": pending_payments,
        "visitors_today": visitors_today,
        "total_staff": total_staff,
        "open_complaints": open_complaints
    })

# ---------------- AI ROUTES ---------------- #

@app.route('/predict-peak/<society>', methods=['GET'])
def predict_peak(society):
    from collections import Counter

    soc_bookings = [a for a in amenities if a.get("society") == society]

    if len(soc_bookings) < 2:
        return jsonify({"status": "insufficient_data", "message": "Not enough booking data yet. Book a few amenities first!"})

    amenity_counts = Counter(a["name"] for a in soc_bookings)
    hour_counts    = Counter()
    day_counts     = Counter()

    for a in soc_bookings:
        if a.get("start"):
            try:
                hour = int(a["start"].split(":")[0])
                hour_counts[hour] += 1
            except:
                pass
        if a.get("date"):
            try:
                from datetime import datetime
                d = datetime.strptime(a["date"], "%Y-%m-%d")
                day_counts[d.strftime("%A")] += 1
            except:
                pass

    peak_amenity = amenity_counts.most_common(1)[0][0]
    peak_count   = amenity_counts.most_common(1)[0][1]

    peak_hour    = hour_counts.most_common(1)[0][0] if hour_counts else None
    peak_day     = day_counts.most_common(1)[0][0]  if day_counts  else None

    # Amenity usage breakdown
    usage_breakdown = [{"name": k, "count": v} for k, v in amenity_counts.most_common()]

    # Peak hour label
    peak_hour_label = f"{peak_hour}:00 – {peak_hour+1}:00" if peak_hour is not None else "N/A"

    # Predict tomorrow's rush: check if tomorrow's day has high usage
    from datetime import datetime, timedelta
    tomorrow_day = (datetime.now() + timedelta(days=1)).strftime("%A")
    tomorrow_busy = day_counts.get(tomorrow_day, 0) > 0

    return jsonify({
        "status": "ok",
        "peak_amenity": peak_amenity,
        "peak_amenity_count": peak_count,
        "peak_hour": peak_hour_label,
        "peak_day": peak_day or "N/A",
        "tomorrow_day": tomorrow_day,
        "tomorrow_busy": tomorrow_busy,
        "total_bookings": len(soc_bookings),
        "usage_breakdown": usage_breakdown
    })


@app.route('/security-anomalies/<society>', methods=['GET'])
def security_anomalies(society):
    from collections import Counter
    from datetime import datetime

    soc_visitors = [v for v in visitors if v.get("society") == society]
    anomalies = []

    # Rule 1: More than 3 visitors to same flat in one day
    flat_counts = Counter(v["flat"] for v in soc_visitors)
    for flat, count in flat_counts.items():
        if count > 3:
            anomalies.append({
                "type": "High Traffic",
                "icon": "🚨",
                "message": f"Flat {flat} has {count} visitors today — unusually high",
                "severity": "danger"
            })

    # Rule 2: Late night visitors (after 10 PM or before 6 AM)
    for v in soc_visitors:
        if v.get("time"):
            try:
                hour = int(v["time"].split(":")[0])
                if hour >= 22 or hour < 6:
                    time_label = "late night" if hour >= 22 else "early morning"
                    anomalies.append({
                        "type": "Odd Hours Entry",
                        "icon": "🌙",
                        "message": f"Visitor '{v['name']}' approved for Flat {v['flat']} at {v['time']} ({time_label})",
                        "severity": "warning"
                    })
            except:
                pass

    # Rule 3: Visitor inside for too long (more than 4 hours)
    now_hour = datetime.now().hour
    for v in soc_visitors:
        if v.get("status") == "Inside" and v.get("entry_time"):
            try:
                entry_hour = int(v["entry_time"].split(":")[0])
                hours_inside = now_hour - entry_hour
                if hours_inside > 4:
                    anomalies.append({
                        "type": "Long Stay Alert",
                        "icon": "⏰",
                        "message": f"Visitor '{v['name']}' at Flat {v['flat']} has been inside for {hours_inside}+ hours",
                        "severity": "warning"
                    })
            except:
                pass

    # Rule 4: Multiple visitors with same name (possible duplicate / tailgating)
    name_counts = Counter(v["name"].lower() for v in soc_visitors)
    for name, count in name_counts.items():
        if count > 1:
            anomalies.append({
                "type": "Duplicate Visitor",
                "icon": "👥",
                "message": f"Visitor name '{name.title()}' appears {count} times — possible duplicate entry",
                "severity": "warning"
            })

    return jsonify({
        "anomalies": anomalies,
        "total": len(anomalies),
        "scanned": len(soc_visitors)
    })


# ---------------- WEBSOCKET EVENTS ---------------- #

@socketio.on('join')
def on_join(data):
    from flask_socketio import join_room
    society = data.get('society', '')
    join_room(society)
    emit('joined', {'msg': f'Joined room: {society}'})

# ---------------- RUN ---------------- #

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
