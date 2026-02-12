let map;
let selectingMode = null;

let pickupCoords = null;
let dropCoords = null;

let pickupMarker = null;
let dropMarker = null;
let routeLine = null;

let riderMarker = null;
let userMarker = null;
let accuracyCircle = null;

let fareAmount = 0;
let ridePhase = "idle";
let selectedVehicle = "bike";
let lastStablePosition = null;

const pricing = {
  bike: { base: 30, perKm: 10 },
  auto: { base: 50, perKm: 14 },
  cab:  { base: 80, perKm: 18 }
};

initMap();

////////////////////////////////////////////////////////
/* MAP INIT */
////////////////////////////////////////////////////////

function initMap() {
  map = L.map("map", { attributionControl: false })
    .setView([28.6139, 77.2090], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
    .addTo(map);

  startGPS();
  map.on("click", onMapClick);
}

////////////////////////////////////////////////////////
/* GPS */
////////////////////////////////////////////////////////

function startGPS() {
  if (!navigator.geolocation) return;

  navigator.geolocation.watchPosition(pos => {
    const latlng = [pos.coords.latitude, pos.coords.longitude];
    const accuracy = pos.coords.accuracy;

    if (accuracy > 100) return;

    if (!lastStablePosition) {
      createUserMarker(latlng, accuracy);
      map.flyTo(latlng, 15);
      lastStablePosition = latlng;
      return;
    }

    const jump = getDistance(lastStablePosition, latlng);
    if (jump > 200) return;

    smoothMove(userMarker, lastStablePosition, latlng);
    updateAccuracy(latlng, accuracy);

    lastStablePosition = latlng;
  });
}

function createUserMarker(latlng, accuracy) {
  userMarker = L.circleMarker(latlng, {
    radius: 8,
    color: "#fff",
    weight: 2,
    fillColor: "#2A7FFF",
    fillOpacity: 1
  }).addTo(map);

  userMarker._path.classList.add("pulse");

  accuracyCircle = L.circle(latlng, {
    radius: accuracy,
    color: "#2A7FFF",
    weight: 1,
    fillOpacity: 0.1
  }).addTo(map);
}

function updateAccuracy(latlng, accuracy) {
  accuracyCircle.setLatLng(latlng);
  accuracyCircle.setRadius(accuracy);
}

////////////////////////////////////////////////////////
/* Pickup / Drop Selection */
////////////////////////////////////////////////////////

function enableMapSelect(type) {
  selectingMode = type;
  showStatus(`Tap map to set ${type}`);
}

async function onMapClick(e) {
  if (!selectingMode) return;

  const { lat, lng } = e.latlng;
  const address = await reverseGeocode(lat, lng);

  if (selectingMode === "pickup") {
    pickupCoords = [lat, lng];
    if (pickupMarker) map.removeLayer(pickupMarker);

    pickupMarker = L.marker(pickupCoords, { draggable: true }).addTo(map);
    pickupMarker.on("dragend", async ev => {
      const p = ev.target.getLatLng();
      pickupCoords = [p.lat, p.lng];
      document.getElementById("pickup").value =
        await reverseGeocode(p.lat, p.lng);
    });

    document.getElementById("pickup").value = address;
  }

  if (selectingMode === "drop") {
    dropCoords = [lat, lng];
    if (dropMarker) map.removeLayer(dropMarker);

    dropMarker = L.marker(dropCoords, { draggable: true }).addTo(map);
    dropMarker.on("dragend", async ev => {
      const p = ev.target.getLatLng();
      dropCoords = [p.lat, p.lng];
      document.getElementById("drop").value =
        await reverseGeocode(p.lat, p.lng);
    });

    document.getElementById("drop").value = address;
  }

  selectingMode = null;
  showStatus("Location Set ✅");
}

////////////////////////////////////////////////////////
/* Vehicle */
////////////////////////////////////////////////////////

function selectVehicle(type) {
  selectedVehicle = type;

  document.querySelectorAll(".vehicle-row button")
    .forEach(btn => btn.classList.remove("active"));

  document.getElementById(`${type}-btn`).classList.add("active");
}

////////////////////////////////////////////////////////
/* Route */
////////////////////////////////////////////////////////

async function calculateRoute() {
  if (!pickupCoords || !dropCoords) {
    alert("Select pickup & drop");
    return;
  }

  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/` +
    `${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}` +
    `?overview=full&geometries=geojson`
  );

  const data = await res.json();
  const route = data.routes[0];

  if (routeLine) map.removeLayer(routeLine);

  routeLine = L.geoJSON(route.geometry).addTo(map);
  map.fitBounds(routeLine.getBounds());

  const km = route.distance / 1000;
  const { base, perKm } = pricing[selectedVehicle];
  const distanceFare = km * perKm;

  fareAmount = base + distanceFare;

  document.getElementById("fare").innerText =
    `Fare ₹${fareAmount.toFixed(0)}`;

  document.getElementById("fare-breakdown").innerText =
    `Base ₹${base} • Distance ₹${distanceFare.toFixed(0)}`;

  simulateRider(route.geometry.coordinates);
}

////////////////////////////////////////////////////////
/* Rider */
////////////////////////////////////////////////////////

function simulateRider(routeCoords) {
  showStatus("Finding Rider 🔎");

  setTimeout(() => {
    showStatus("Rider Assigned ✅");
    document.getElementById("rider-card").classList.remove("hidden");
    document.getElementById("cancel-btn").classList.remove("hidden");

    startRider(routeCoords);
  }, 2000);
}

function startRider(routeCoords) {
  const path = routeCoords.map(c => [c[1], c[0]]);
  riderMarker = L.marker(path[0]).addTo(map);
  moveRider(path, 0);
}

function moveRider(path, i) {
  if (i >= path.length) return;

  riderMarker.setLatLng(path[i]);
  document.getElementById("eta").innerText = `ETA ${(path.length - i)} sec`;

  setTimeout(() => moveRider(path, i + 1), 300);
}

////////////////////////////////////////////////////////
/* Utilities */
////////////////////////////////////////////////////////

function smoothMove(marker, from, to) {
  marker.setLatLng(to);
}

function getDistance(a, b) {
  return map.distance(a, b);
}

async function reverseGeocode(lat, lon) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
  );
  const data = await res.json();
  return data.display_name || "Selected location";
}

function showStatus(text) {
  document.getElementById("ride-status").innerText = text;
}

function callRider() { alert("Calling Rider 📞"); }
function chatRider() { alert("Opening Chat 💬"); }

function cancelRide() {
  if (riderMarker) map.removeLayer(riderMarker);
  showStatus("Ride Cancelled ❌");
}

////////////////////////////////////////////////////////
/* Draggable Sheet */
////////////////////////////////////////////////////////

const sheet = document.getElementById("sheet");
const dragHandle = document.getElementById("dragHandle");

let startY = 0;
let startHeight = 0;

dragHandle.addEventListener("mousedown", startDrag);
dragHandle.addEventListener("touchstart", startDrag);

function startDrag(e) {
  startY = e.touches ? e.touches[0].clientY : e.clientY;
  startHeight = sheet.offsetHeight;

  document.addEventListener("mousemove", onDrag);
  document.addEventListener("touchmove", onDrag);

  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("touchend", stopDrag);
}

function onDrag(e) {
  const currentY = e.touches ? e.touches[0].clientY : e.clientY;
  const delta = startY - currentY;

  const newHeight = startHeight + delta;
  const min = window.innerHeight * 0.15;
  const max = window.innerHeight * 0.85;

  sheet.style.height = Math.max(min, Math.min(max, newHeight)) + "px";
}

function stopDrag() {
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("touchmove", onDrag);
}
