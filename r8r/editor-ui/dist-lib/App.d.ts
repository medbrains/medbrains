/**
 * The standalone application.
 *
 * Everything here is what r8r-on-its-own needs and an embedding host does not:
 * the brand, and hash routing so a reload lands back where you were. The editor
 * itself is the library component, so the two deployments cannot drift.
 */
export declare function App(): import("react").JSX.Element;
