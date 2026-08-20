// Unit conversion helpers. The calculation engine works in imperial internally;
// these convert at the UI boundary when the user prefers metric.

export const UNITS = {
  imperial: { label: "Imperial", length: "in", feed: "IPM", speed: "RPM", power: "HP", surface: "SFM", mrr: "in³/min" },
  metric: { label: "Metric", length: "mm", feed: "mm/min", speed: "RPM", power: "kW", surface: "m/min", mrr: "cm³/min" },
};

export const lenFromImp = (v, u) => (u === "metric" ? v * 25.4 : v);
export const lenToImp = (v, u) => (u === "metric" ? v / 25.4 : v);
export const feedFromImp = (v, u) => (u === "metric" ? v * 25.4 : v);
export const feedToImp = (v, u) => (u === "metric" ? v / 25.4 : v);
export const surfaceFromImp = (v, u) => (u === "metric" ? v * 0.3048 : v); // SFM -> m/min
export const powerFromImp = (v, u) => (u === "metric" ? v * 0.7457 : v); // HP -> kW
export const powerToImp = (v, u) => (u === "metric" ? v / 0.7457 : v);
export const mrrFromImp = (v, u) => (u === "metric" ? v * 16.387 : v); // in³/min -> cm³/min