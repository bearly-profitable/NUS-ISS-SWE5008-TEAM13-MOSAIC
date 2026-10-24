/**
 * The hand-authored half of the edit. Every time is a second of the *source*
 * recording (walkthru-unedited2.mp4) and every position a pixel of it
 * (2838 × 1428), so this file reads against the raw footage and survives any
 * re-cut of the pauses.
 */

export const CHAPTER_META = [
  { id: "company", num: "01", title: "Company Info", sub: "One customer CSV, the brand and the offer", tile: 0 },
  { id: "segments", num: "02", title: "Segments", sub: "HDBSCAN finds the groups, an LLM explains them", tile: 3 },
  { id: "creative", num: "03", title: "Creative Review", sub: "A creative direction for every segment", tile: 2 },
  { id: "emails", num: "04", title: "Email Review", sub: "One email per segment, fully editable", tile: 4 },
  { id: "guardian", num: "05", title: "Approval Queue", sub: "Guardian runs ten pre-flight checks", tile: 5 },
  { id: "dispatch", num: "06", title: "Human Send", sub: "Nothing leaves until a person presses send", tile: 1 },
  { id: "logs", num: "07", title: "Logs", sub: "Every agent and operator action, audited", tile: 7 },
] as const;

export type ChapterId = (typeof CHAPTER_META)[number]["id"];

export type CamEase = "glide" | "snap" | "smooth";
/** Centre the camera on source point (x, y) at zoom z, moving over d frames. */
export type CamKey = { t: number; x: number; y: number; z: number; d?: number; ease?: CamEase };

/** A ring around a region of the screen, with an optional label chip. */
export type Callout = {
  t: number;
  until: number;
  box: [number, number, number, number];
  label?: string;
  side?: "top" | "bottom";
  dim?: boolean;
};

/** A click: ripple at a source point. */
export type Click = { t: number; x: number; y: number };

/** A burst of MOSAIC tiles from a point (the send). */
export type Burst = { t: number; x: number; y: number };

/** A centred caption chip over a blurred stretch. */
export type Note = { t: number; until: number; text: string };

/**
 * The camera follows the narration: push in on what is being talked about,
 * pull back when the page changes, and track the page when it scrolls under
 * a held shot (the `snap` keys). Chapter-opening keys use `d: 0`: the chapter
 * card's swing hides the change.
 */
export const CAMERA: CamKey[] = [
  // 01 Company Info
  { t: 0, x: 1419, y: 714, z: 1 },
  { t: 0.9, x: 1419, y: 560, z: 1.4, d: 50 },
  { t: 6.0, x: 1890, y: 300, z: 2.1, d: 34 }, // "click on the load example"
  { t: 9.6, x: 1419, y: 480, z: 1.6, d: 30 }, // loader
  { t: 21.1, x: 1419, y: 760, z: 1.45, d: 30 }, // contacts land
  { t: 25.6, x: 1419, y: 880, z: 1.6, d: 34 }, // About your company
  { t: 42.8, x: 1419, y: 960, z: 1.6, d: 30 },
  { t: 47.0, x: 1419, y: 880, z: 1.65, d: 24 }, // campaign intent
  { t: 53.0, x: 1419, y: 560, z: 1.7, d: 30 }, // offers
  { t: 66.6, x: 1419, y: 620, z: 1.95, d: 30 },
  { t: 86.6, x: 1180, y: 960, z: 2.05, d: 26 }, // dynamic attribute
  { t: 89.25, x: 1180, y: 600, z: 2.05, d: 14, ease: "snap" }, // page scrolls under us
  { t: 95.4, x: 1419, y: 760, z: 1.45, d: 32 }, // contacts table
  { t: 99.0, x: 1419, y: 640, z: 1.7, d: 40 },
  { t: 105.4, x: 2250, y: 1120, z: 1.65, d: 30 }, // Next
  // 02 Segments
  { t: 109.1, x: 1419, y: 520, z: 1.35, d: 0 },
  { t: 110.3, x: 2000, y: 300, z: 1.9, d: 28 }, // Generate segments
  { t: 112.9, x: 1419, y: 470, z: 1.55, d: 30 },
  { t: 116.5, x: 1060, y: 520, z: 2.0, d: 40 }, // the pipeline steps
  { t: 125.0, x: 1419, y: 470, z: 1.45, d: 40 },
  { t: 142.5, x: 1150, y: 560, z: 2.0, d: 36 }, // HDBSCAN result
  { t: 151.0, x: 1419, y: 500, z: 1.4, d: 30 },
  { t: 172.4, x: 1419, y: 690, z: 1.12, d: 30 }, // six segments
  { t: 179.5, x: 760, y: 1040, z: 2.15, d: 36 }, // Seasonal Gift Buyers
  { t: 201.5, x: 1419, y: 714, z: 1.2, d: 40 },
  // 03 Creative Review
  { t: 205.0, x: 1419, y: 640, z: 1.35, d: 0 },
  { t: 206.0, x: 1419, y: 620, z: 1.6, d: 34 }, // brand assets
  { t: 216.1, x: 1419, y: 560, z: 1.6, d: 10 },
  { t: 221.9, x: 1405, y: 900, z: 1.55, d: 30 }, // palette
  { t: 228.0, x: 2100, y: 300, z: 2.0, d: 26 }, // Generate direction
  { t: 231.4, x: 1100, y: 420, z: 1.9, d: 34 },
  { t: 250.4, x: 1419, y: 500, z: 1.4, d: 30 },
  { t: 266.2, x: 1419, y: 700, z: 1.25, d: 30 },
  { t: 271.6, x: 1915, y: 640, z: 1.85, d: 36 }, // Seasonal Gift Buyers direction
  { t: 276.1, x: 1915, y: 560, z: 1.85, d: 16 },
  { t: 289.4, x: 1419, y: 714, z: 1.25, d: 30 },
  // 04 Email Review
  { t: 290.9, x: 1419, y: 700, z: 1.3, d: 0 },
  { t: 292.3, x: 1419, y: 420, z: 1.5, d: 30 },
  { t: 293.4, x: 2150, y: 300, z: 2.0, d: 26 }, // Generate emails
  { t: 295.8, x: 1060, y: 420, z: 2.0, d: 34 },
  { t: 312.4, x: 1419, y: 500, z: 1.4, d: 30 },
  { t: 367.9, x: 1419, y: 714, z: 1.15, d: 30 }, // six emails
  { t: 373.7, x: 918, y: 985, z: 1.95, d: 30 }, // Seasonal Gift Buyers email
  { t: 376.0, x: 1419, y: 714, z: 1.1, d: 24 }, // builder opens
  { t: 378.4, x: 950, y: 760, z: 1.55, d: 34 },
  { t: 382.4, x: 640, y: 850, z: 2.0, d: 28 }, // block palette
  { t: 386.4, x: 700, y: 760, z: 1.45, d: 24 }, // palette scrolls: take in the whole panel
  { t: 390.4, x: 700, y: 760, z: 1.55, d: 30 }, // block list
  { t: 398.6, x: 1990, y: 700, z: 1.6, d: 34 }, // live preview
  { t: 404.8, x: 1990, y: 780, z: 1.9, d: 24 },
  { t: 411.8, x: 1700, y: 600, z: 1.3, d: 30 },
  { t: 413.5, x: 2500, y: 300, z: 2.0, d: 20 },
  { t: 414.5, x: 1419, y: 714, z: 1.12, d: 26 },
  { t: 416.0, x: 2300, y: 1150, z: 1.6, d: 22 },
  // 05 Approval Queue
  { t: 418.95, x: 1419, y: 620, z: 1.3, d: 0 },
  { t: 419.5, x: 1419, y: 440, z: 1.55, d: 30 }, // model scores
  { t: 423.4, x: 1419, y: 480, z: 1.4, d: 24 },
  { t: 425.8, x: 1419, y: 700, z: 1.25, d: 30 },
  { t: 427.4, x: 900, y: 560, z: 1.8, d: 30 }, // the queue
  { t: 436.4, x: 1650, y: 520, z: 1.75, d: 30 }, // Seasonal Gift Buyers, 10/10
  { t: 439.5, x: 900, y: 560, z: 1.6, d: 30 },
  { t: 443.2, x: 1650, y: 480, z: 1.75, d: 30 }, // Frequent Full-Price Buyers, 9/10
  { t: 457.4, x: 1419, y: 700, z: 1.3, d: 30 },
  { t: 461.6, x: 1660, y: 560, z: 1.55, d: 30 }, // recipient preview
  { t: 470.8, x: 1700, y: 1050, z: 1.5, d: 30 },
  // 06 Human Send
  { t: 473.4, x: 1700, y: 1050, z: 1.55, d: 0 },
  { t: 473.9, x: 1422, y: 724, z: 2.0, d: 16, ease: "snap" }, // the confirm dialog
  { t: 475.3, x: 1700, y: 1050, z: 1.5, d: 30 },
  { t: 482.9, x: 2150, y: 1150, z: 1.8, d: 30 }, // sent
  { t: 486.4, x: 2000, y: 1100, z: 1.6, d: 24 },
  { t: 489.4, x: 1500, y: 450, z: 1.5, d: 30 }, // the inbox
  { t: 499.8, x: 1050, y: 680, z: 1.4, d: 24 },
  { t: 506.2, x: 1419, y: 714, z: 1.15, d: 24 },
  // 07 Logs
  { t: 508.3, x: 1419, y: 714, z: 1.15, d: 0 },
  { t: 512.8, x: 2000, y: 1150, z: 1.6, d: 20 },
  { t: 514.4, x: 1419, y: 560, z: 1.45, d: 32 },
  { t: 516.6, x: 1250, y: 640, z: 1.75, d: 34 },
  { t: 525.3, x: 1050, y: 560, z: 1.9, d: 24 },
  { t: 529.4, x: 1419, y: 620, z: 1.4, d: 36 },
  { t: 533.2, x: 1419, y: 714, z: 1.0, d: 80 },
];

/** Each ring sits inside a stretch where the page does not scroll (checked against the activity trace). */
export const CALLOUTS: Callout[] = [
  { t: 6.6, until: 9.1, box: [1900, 100, 212, 52], label: "Load the demo customer base", side: "bottom" },
  { t: 70.5, until: 79.4, box: [580, 588, 1690, 130], label: "Offers the emails are allowed to cite" },
  { t: 89.4, until: 93.9, box: [738, 528, 132, 48], label: "{{name}} greets every reader", side: "bottom" },

  { t: 110.6, until: 112.0, box: [2070, 100, 330, 58], label: "Generate segments", side: "bottom" },
  { t: 143.3, until: 146.6, box: [745, 560, 480, 62], label: "HDBSCAN: 9 clusters, top 6 kept", side: "bottom" },
  { t: 175.6, until: 178.3, box: [1135, 625, 570, 50], label: "Age skew flagged for review", side: "bottom" },
  { t: 185.0, until: 190.2, box: [455, 935, 610, 90], label: "Motivation" },
  { t: 193.6, until: 200.9, box: [455, 1040, 610, 65], label: "Tone" },

  { t: 208.4, until: 212.8, box: [477, 397, 922, 505], label: "Company logo" },
  { t: 222.4, until: 226.9, box: [470, 1040, 1100, 100], label: "Brand palette" },
  { t: 228.4, until: 230.5, box: [2070, 100, 330, 60], label: "Generate direction", side: "bottom" },
  { t: 273.3, until: 275.9, box: [1450, 385, 930, 70], label: "Tonality" },
  { t: 279.0, until: 285.7, box: [1450, 688, 930, 68], label: "The word “gift” goes in the CTA" },
  { t: 286.4, until: 289.2, box: [1450, 742, 930, 62], label: "Design & shapes" },

  { t: 293.7, until: 295.3, box: [2120, 100, 280, 58], label: "Generate emails", side: "bottom" },
  { t: 373.8, until: 375.7, box: [446, 630, 944, 710], label: "Seasonal Gift Buyers" },
  // "logo, countdown, …" — blocks light as they are named while the palette is still;
  // it scrolls from 386.5, so the rest of the list gets one ring on the panel.
  { t: 384.98, until: 385.9, box: [128, 462, 497, 110], dim: false },
  { t: 385.66, until: 386.5, box: [128, 846, 497, 110], dim: false },
  { t: 386.5, until: 390.0, box: [120, 290, 1040, 1080], label: "19 block types to drag in" },
  { t: 393.6, until: 398.3, box: [110, 280, 1070, 1020], label: "Drag to reorder" },
  { t: 405.2, until: 408.2, box: [1810, 805, 355, 78], label: "Call to action" },

  { t: 420.8, until: 423.2, box: [440, 280, 1958, 380], label: "Model scores for all four agents", side: "bottom" },
  { t: 429.4, until: 433.8, box: [440, 150, 432, 950], label: "One email per segment" },
  { t: 436.6, until: 438.8, box: [940, 165, 1440, 60], label: "10/10 checks · ready to send", side: "bottom" },
  { t: 440.2, until: 442.5, box: [445, 150, 425, 130], label: "Needs attention", side: "bottom" },
  { t: 445.3, until: 456.9, box: [940, 585, 1420, 72], label: "Age acts as a proxy here: 37% deviation", side: "bottom" },
  { t: 465.0, until: 470.5, box: [945, 410, 1430, 900], label: "What the recipient sees" },

  { t: 474.0, until: 474.95, box: [1556, 875, 220, 55], label: "A person presses send", side: "bottom" },
  { t: 483.2, until: 485.8, box: [2170, 1315, 625, 75], label: "Delivered" },
  { t: 491.3, until: 496.4, box: [600, 300, 2190, 80], label: "In a real inbox", side: "bottom" },

  { t: 517.0, until: 520.6, box: [570, 590, 1700, 460], label: "Agent actions", side: "bottom" },
  { t: 521.2, until: 525.6, box: [570, 418, 1700, 150], label: "Operator actions — me", side: "bottom" },
  { t: 525.9, until: 528.7, box: [580, 240, 545, 50], label: "What I did · What the agents did", side: "bottom" },
];

/** Clicks, timed to the frame the UI first reacts. */
export const CLICKS: Click[] = [
  { t: 9.2, x: 2005, y: 125 },
  { t: 87.45, x: 802, y: 948 },
  { t: 107.1, x: 2700, y: 1335 },
  { t: 112.1, x: 2235, y: 128 },
  { t: 227.3, x: 2245, y: 1101 },
  { t: 230.6, x: 2235, y: 130 },
  { t: 295.4, x: 2270, y: 128 },
  { t: 375.75, x: 1310, y: 1297 },
  { t: 414.2, x: 2716, y: 130 },
  { t: 416.7, x: 2690, y: 1335 },
  { t: 435.95, x: 570, y: 845 },
  { t: 442.6, x: 620, y: 215 },
  { t: 473.75, x: 2285, y: 1254 },
  { t: 474.95, x: 1665, y: 902 },
  { t: 513.15, x: 2207, y: 1331 },
  { t: 525.8, x: 800, y: 264 },
  { t: 527.6, x: 1010, y: 264 },
  { t: 531.1, x: 640, y: 264 },
];

export const BURSTS: Burst[] = [{ t: 474.95, x: 1665, y: 902 }];

export const NOTES: Note[] = [
  { t: 212.9, until: 216.0, text: "Picking the logo file" },
  { t: 217.9, until: 220.3, text: "Picking the hero image" },
  { t: 489.4, until: 491.2, text: "Personal inbox blurred" },
];
