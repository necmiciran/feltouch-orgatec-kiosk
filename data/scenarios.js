// Five demo spaces.
// Room sizes match the 3D scenes. RT60 before/after is NOT typed in: it is calculated
// by calc.js with the same Sabine engine as https://rt60.feltouch.tr, from the room
// (dimensions, existing materials) and the Feltouch products + quantities below.
//   walls: w1 = front (door), w2 = back, w3 = left, w4 = right
//   qty  : m² for area products, pieces for count products (see data/catalog.js)
const SCENARIOS = [
  {
    id: "airport",
    icon: "airport",
    room: {
      en: "Airport Terminal", tr: "Havalimanı Terminali", de: "Flughafenterminal", fr: "Terminal d’aéroport",
      nl: "Luchthaventerminal", el: "Τερματικός σταθμός αεροδρομίου", cs: "Letištní terminál",
      bg: "Летищен терминал", it: "Terminal aeroportuale"
    },
    dims: { w: 16, l: 26, h: 7.5 },
    materials: { floor: "marble", ceiling: "plasterboard_on_frame_100_mm_airspace", walls: "plaster_on_brick" },
    windows: [{ wall: "w2", w: 14, h: 6.8 }],
    solution: [
      { surface: "ceiling", product: "baffle_air_felt_15_cm_axis", qty: 220 },
      { surface: "wall3", product: "cosmos_space_wall_panel_fetlfill", qty: 80 },
      { surface: "wall4", product: "cosmos_space_wall_panel_fetlfill", qty: 80 }
    ],
    audio: "assets/audio/airport.wav"
  },
  {
    id: "classroom",
    icon: "classroom",
    room: {
      en: "University Classroom", tr: "Üniversite Sınıfı", de: "Universitätsseminarraum", fr: "Salle de cours universitaire",
      nl: "Collegezaal", el: "Πανεπιστημιακή αίθουσα", cs: "Univerzitní učebna",
      bg: "Университетска аудитория", it: "Aula universitaria"
    },
    dims: { w: 9, l: 11, h: 3.4 },
    materials: { floor: "linolium", ceiling: "plater_on_concrete", walls: "plaster_on_brick" },
    windows: [{ wall: "w3", w: 8, h: 1.8 }],
    solution: [
      { surface: "ceiling", product: "sense_flux_form_natural_ceiling_20_cm_air_gap_feltfill", qty: 54 },
      { surface: "wall4", product: "cosmos_space_wall_panel_fetlfill", qty: 24 },
      { surface: "wall2", product: "cosmos_space_wall_panel_fetlfill", qty: 10 }
    ],
    audio: "assets/audio/classroom.wav"
  },
  {
    id: "office",
    icon: "office",
    room: {
      en: "Open Office", tr: "Açık Ofis", de: "Großraumbüro", fr: "Bureau open space",
      nl: "Kantoortuin", el: "Γραφείο ανοιχτού χώρου", cs: "Kancelář open space",
      bg: "Офис с открито пространство", it: "Ufficio open space"
    },
    dims: { w: 11, l: 14, h: 3.2 },
    materials: { floor: "carpet", ceiling: "plater_on_concrete", walls: "plaster_on_brick" },
    windows: [{ wall: "w3", w: 11, h: 1.9 }],
    solution: [
      { surface: "ceiling", product: "baffle_air_felt_10_cm_axis", qty: 110 },
      { surface: "wall4", product: "sense_flux_flat", qty: 24 },
      { surface: "wall2", product: "sense_flux_flat", qty: 14 }
    ],
    audio: "assets/audio/office.wav"
  },
  {
    id: "restaurant",
    icon: "restaurant",
    room: {
      en: "Restaurant", tr: "Restoran", de: "Restaurant", fr: "Restaurant",
      nl: "Restaurant", el: "Εστιατόριο", cs: "Restaurace", bg: "Ресторант", it: "Ristorante"
    },
    dims: { w: 10, l: 12, h: 3.4 },
    materials: { floor: "wood", ceiling: "plater_on_concrete", walls: "plaster_on_brick" },
    windows: [{ wall: "w3", w: 8, h: 1.7 }],
    solution: [
      { surface: "ceiling", product: "zen_cloud_large_feltfill", qty: 16 },
      { surface: "wall4", product: "sparkle_bowl_surface", qty: 44 },
      { surface: "wall2", product: "decosound_batura_natural_feltfill", qty: 12 }
    ],
    // restaurant sound design: dense cutlery / plate clatter that rings on in the reverberant room
    // and buries the speech ("before"), but is short and clear once the ceiling/walls are treated
    audioFx: { clinks: { perSec: 6, level: 0.8 }, wetCap: 4.6, irTilt: 0.1 },
    audio: "assets/audio/restaurant.wav"
  },
  {
    id: "waiting-area",
    icon: "waiting",
    room: {
      en: "Waiting Area", tr: "Bekleme Alanı", de: "Wartebereich", fr: "Salle d’attente",
      nl: "Wachtruimte", el: "Χώρος αναμονής", cs: "Čekárna", bg: "Чакалня", it: "Sala d’attesa"
    },
    dims: { w: 9, l: 10, h: 3.4 },
    materials: { floor: "linolium", ceiling: "plasterboard_on_frame_100_mm_airspace", walls: "plaster_on_brick" },
    windows: [{ wall: "w3", w: 7, h: 1.8 }],
    solution: [
      { surface: "ceiling", product: "sense_flux_form_feltfill", qty: 42 },
      { surface: "wall4", product: "sense_flux_flat", qty: 18 },
      { surface: "wall2", product: "sense_flux_flat", qty: 9 }
    ],
    audio: "assets/audio/waiting-area.wav"
  }
];

// results (RT60 before/after, treated area, …) computed once from the data above
SCENARIOS.forEach(sc => { sc.calc = FeltouchCalc.compute(sc); });
