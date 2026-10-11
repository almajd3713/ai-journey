// Where on the chart is this screen point? The backdrop that is showing (the 3D scene or
// the flat 2D chart) registers how to answer; the hero asks when the island is clicked.
type Picker = (clientX: number, clientY: number) => [number, number] | null;
let picker: Picker | null = null;
export const setPicker = (p: Picker | null) => { picker = p; };
/** grid coordinates under a screen point, or null */
export const pick = (clientX: number, clientY: number) => (picker ? picker(clientX, clientY) : null);
