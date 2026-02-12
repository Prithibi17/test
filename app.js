let map;
let userMarker = null;

const DEFAULT_LOCATION = [28.6139, 77.2090]; // fallback (Delhi)

initMap();

function initMap() {
  map = L.map("map", { attributionControl: false })
    .setView(DEFAULT_LOCATION, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
    .addTo(map);

  initLocationSystem();
}

////////////////////////////////////////////////////////
/* ✅ ROBUST LOCATION SYSTEM */
////////////////////////////////////////////////////////

function initLocationSystem() {
  if (!navigator.geolocation) {
    showFallback("Geolocation not supported");
    return;
  }

  navigator.permissions?.query({ name: "geolocation" })
    .then(result => {
      console.log("Permission state:", result.state);

      if (result.state === "denied") {
        showFallback("Location permission denied");
      } else {
        getFreshLocation();
      }
    })
    .catch(() => {
      // Older browsers → just try GPS
      getFreshLocation();
    });
}

////////////////////////////////////////////////////////
/* ✅ GET LOCATION SAFELY */
////////////////////////////////////////////////////////

function getFreshLocation() {
  navigator.geolocation.getCurrentPosition(
    pos => {
      const latlng = [
        pos.coords.latitude,
        pos.coords.longitude
      ];

      console.log("✅ Live GPS:", latlng);

      placeUserMarker(latlng);
      map.flyTo(latlng, 15, { duration: 1.2 });
    },

    err => {
      console.warn("❌ Live GPS failed:", err.message);

      // Try cached / last known
      navigator.geolocation.getCurrentPosition(
        pos => {
          const latlng = [
            pos.coords.latitude,
            pos.coords.longitude
          ];

          console.log("✅ Cached GPS:", latlng);

          placeUserMarker(latlng);
          map.flyTo(latlng, 15);
        },

        () => {
          // Final fallback
          showFallback("Using default location");
        },

        {
          maximumAge: Infinity,
          timeout: 5000
        }
      );
    },

    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    }
  );
}

////////////////////////////////////////////////////////
/* ✅ MARKER */
////////////////////////////////////////////////////////

function placeUserMarker(latlng) {
  if (userMarker) map.removeLayer(userMarker);

  userMarker = L.circleMarker(latlng, {
    radius: 8,
    color: "#fff",
    weight: 2,
    fillColor: "#2A7FFF",
    fillOpacity: 1
  }).addTo(map);

  userMarker._path.classList.add("pulse");
}

////////////////////////////////////////////////////////
/* ✅ FALLBACK */
////////////////////////////////////////////////////////

function showFallback(message) {
  console.warn("⚠ Fallback:", message);

  placeUserMarker(DEFAULT_LOCATION);
  map.flyTo(DEFAULT_LOCATION, 13);

  // Optional UI message
  const status = document.getElementById("ride-status");
  if (status) {
    status.innerText = `📍 ${message}`;
  }
}
