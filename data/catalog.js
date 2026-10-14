// Feltouch product & material data — a subset of the catalogue behind rt60.feltouch.tr
// (absorption coefficients per octave band, equivalent-area factors, module sizes).
const FT = {
 "products": {
  "baffle_air_felt_15_cm_axis": {
   "name": "BAFFLE AIR FELT 15 cm axis",
   "series": "BAFFLE",
   "add": null,
   "sub": 1,
   "gap": null,
   "alpha": {
    "63": 0.04,
    "125": 0.08,
    "250": 0.3,
    "500": 0.39,
    "1000": 0.42,
    "2000": 0.77,
    "4000": 0.91
   },
   "kind": "baffle",
   "axisM": 0.15,
   "lenM": 1.2
  },
  "cosmos_space_wall_panel_fetlfill": {
   "name": "COSMOS SPACE WALL PANEL + FETLFILL",
   "series": "COSMOS",
   "add": null,
   "sub": 1,
   "gap": null,
   "alpha": {
    "63": 0.07,
    "125": 0.24,
    "250": 0.78,
    "500": 1,
    "1000": 1,
    "2000": 0.83,
    "4000": 0.7
   },
   "kind": "panel",
   "moduleM2": 0.36,
   "moduleLabel": "60 × 60 cm"
  },
  "sense_flux_form_natural_ceiling_20_cm_air_gap_feltfill": {
   "name": "SENSE FLUX Form Natural Ceiling (20 cm Air Gap)+FELTFILL",
   "series": "SENSE",
   "add": 1,
   "sub": null,
   "gap": 20,
   "alpha": {
    "63": 0.24,
    "125": 0.6,
    "250": 1.12,
    "500": 1.06,
    "1000": 0.99,
    "2000": 1.03,
    "4000": 1.03
   },
   "kind": "cloud"
  },
  "baffle_air_felt_10_cm_axis": {
   "name": "BAFFLE AIR FELT 10 cm axis",
   "series": "BAFFLE",
   "add": null,
   "sub": 1,
   "gap": null,
   "alpha": {
    "63": 0.05,
    "125": 0.09,
    "250": 0.33,
    "500": 0.44,
    "1000": 0.48,
    "2000": 0.83,
    "4000": 0.93
   },
   "kind": "baffle",
   "axisM": 0.1,
   "lenM": 1.2
  },
  "sense_flux_flat": {
   "name": "SENSE FLUX FLAT",
   "series": "SENSE",
   "add": null,
   "sub": 1,
   "gap": null,
   "alpha": {
    "63": 0.03,
    "125": 0.16,
    "250": 0.58,
    "500": 0.8,
    "1000": 0.75,
    "2000": 0.66,
    "4000": 0.64
   },
   "kind": "panel"
  },
  "zen_cloud_large_feltfill": {
   "name": "ZEN CLOUD LARGE + FELTFILL",
   "series": "ZEN",
   "add": 3.68,
   "sub": null,
   "gap": null,
   "alpha": {
    "63": 0.05,
    "125": 0.18,
    "250": 0.33,
    "500": 0.55,
    "1000": 0.67,
    "2000": 0.76,
    "4000": 0.8
   },
   "kind": "cloud"
  },
  "sparkle_bowl_surface": {
   "name": "SPARKLE BOWL SURFACE",
   "series": "SPARKLE",
   "add": 0.8,
   "sub": null,
   "gap": null,
   "alpha": {
    "63": 0.07,
    "125": 0.06,
    "250": 0.12,
    "500": 0.31,
    "1000": 0.47,
    "2000": 0.44,
    "4000": 0.43
   },
   "kind": "pods"
  },
  "decosound_batura_natural_feltfill": {
   "name": "DECOSOUND BATURA NATURAL + FELTFILL",
   "series": "DECOSOUND",
   "add": null,
   "sub": 1,
   "gap": null,
   "alpha": {
    "63": 0.08,
    "125": 0.32,
    "250": 0.75,
    "500": 1.07,
    "1000": 1.15,
    "2000": 1.04,
    "4000": 0.95
   },
   "kind": "panel"
  },
  "sense_flux_form_feltfill": {
   "name": "SENSE FLUX FORM+FELTFILL",
   "series": "SENSE",
   "add": null,
   "sub": 1,
   "gap": null,
   "alpha": {
    "63": 0.15,
    "125": 0.25,
    "250": 0.95,
    "500": 1.15,
    "1000": 1.18,
    "2000": 1.13,
    "4000": 1
   },
   "kind": "panel"
  }
 },
 "materials": {
  "marble": {
   "name": "Marble",
   "alpha": {
    "63": 0.01,
    "125": 0,
    "250": 0.02,
    "500": 0.02,
    "1000": 0.02,
    "2000": 0.02,
    "4000": 0.02
   }
  },
  "plasterboard_on_frame_100_mm_airspace": {
   "name": "Plasterboard on frame 100 mm airspace",
   "alpha": {
    "63": 0.2,
    "125": 0.28,
    "250": 0.22,
    "500": 0.17,
    "1000": 0.09,
    "2000": 0.1,
    "4000": 0.11
   }
  },
  "plaster_on_brick": {
   "name": "Plaster on brick",
   "alpha": {
    "63": 0.01,
    "125": 0.02,
    "250": 0.02,
    "500": 0.02,
    "1000": 0.03,
    "2000": 0.03,
    "4000": 0.03
   }
  },
  "linolium": {
   "name": "Linolium",
   "alpha": {
    "63": 0.03,
    "125": 0.03,
    "250": 0.03,
    "500": 0.03,
    "1000": 0.02,
    "2000": 0.02,
    "4000": 0.02
   }
  },
  "plater_on_concrete": {
   "name": "plater on concrete",
   "alpha": {
    "63": 0.01,
    "125": 0.01,
    "250": 0.02,
    "500": 0.02,
    "1000": 0.02,
    "2000": 0.02,
    "4000": 0.02
   }
  },
  "carpet": {
   "name": "Carpet",
   "alpha": {
    "63": 0.01,
    "125": 0.02,
    "250": 0.06,
    "500": 0.15,
    "1000": 0.25,
    "2000": 0.45,
    "4000": 0.45
   }
  },
  "wood": {
   "name": "Wood",
   "alpha": {
    "63": 0.11,
    "125": 0.1,
    "250": 0.07,
    "500": 0.06,
    "1000": 0.07,
    "2000": 0.07,
    "4000": 0.07
   }
  },
  "glass": {
   "name": "Glass",
   "alpha": {
    "63": 0.04,
    "125": 0.03,
    "250": 0.03,
    "500": 0.02,
    "1000": 0.02,
    "2000": 0.02,
    "4000": 0.02
   }
  }
 },
 "freqs": [
  125,
  250,
  500,
  1000,
  2000,
  4000
 ],
 "freqAlphaMap": {
  "125": "63",
  "250": "125",
  "500": "250",
  "1000": "500",
  "2000": "1000",
  "4000": "2000"
 },
 "door": {
  "w": 0.9,
  "h": 2.2
 }
};
