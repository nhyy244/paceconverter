/** What the info button on an ultra's column opens. */
export interface RaceInfo {
  /** The organizer's own name for the event. */
  name: string;
  /** One line: what it is and where. */
  summary: string;
  /** The organizer's page for this race. */
  url: string;
}

export interface Race {
  id: string;
  /** Column heading — short enough for a phone-width column. */
  label: string;
  /** Course distance in km, the app's canonical unit. */
  km: number;
  /** Only the ultras carry one. */
  info?: RaceInfo;
}

/**
 * Standard distances are exact by definition; the half and full marathon are
 * the World Athletics figures.
 *
 * The four ultras are Destination Trail events whose courses are rerouted
 * between editions, and are named for a round number they don't actually run.
 * Each km figure below converts the mileage printed on the very page the info
 * panel links to, so anyone who follows the link sees the same number — the
 * organizer also publishes different figures on per-edition pages, and picking
 * those would leave the app contradicting its own source. Worth re-checking
 * before each season.
 */
export const RACES: Race[] = [
  { id: '5k', label: '5K', km: 5 },
  { id: '10k', label: '10K', km: 10 },
  { id: '15k', label: '15K', km: 15 },
  { id: 'half', label: 'HALF', km: 21.0975 },
  { id: 'marathon', label: 'MARATHON', km: 42.195 },
  { id: '50k', label: '50K', km: 50 },
  { id: '100k', label: '100K', km: 100 },
  {
    id: 'tahoe200',
    label: 'TAHOE 200',
    km: 322.5, // 200.4 mi
    info: {
      name: 'Tahoe 200 Endurance Run',
      summary: 'A loop right around Lake Tahoe on the Tahoe Rim Trail, California and Nevada.',
      url: 'https://www.destinationtrailrun.com/tahoe',
    },
  },
  {
    id: 'moab240',
    label: 'MOAB 240',
    km: 389.1, // 241.8 mi
    info: {
      name: 'Moab 240 Endurance Run',
      summary: 'A loop through the canyon country around Moab, Utah.',
      url: 'https://www.destinationtrailrun.com/moab',
    },
  },
  {
    id: 'bigfoot200',
    label: 'BIGFOOT 200',
    km: 322.0, // 200.1 mi
    info: {
      name: 'Bigfoot 200 Endurance Run',
      summary: "Washington's Cascade Range, from Mount St. Helens to Randle.",
      url: 'https://www.destinationtrailrun.com/bigfoot',
    },
  },
  {
    id: 'arizona300',
    label: 'ARIZONA 300',
    km: 483.6, // 300.5 mi
    info: {
      name: 'Arizona Monster 300',
      summary: 'Across the Sonoran Desert from Patagonia to Superior, Arizona.',
      url: 'https://www.destinationtrailrun.com/arizona-monster-300',
    },
  },
];

/** Distance label under a column heading: "42.2 km", "5 km". */
export function formatDistance(km: number): string {
  const rounded = Math.round(km * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} km`;
}
