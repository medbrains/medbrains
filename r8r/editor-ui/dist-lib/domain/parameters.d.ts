import { JsonValue, NodeProperty } from '../types';
/**
 * A field declares `displayOptions` to stay hidden until it is relevant — the
 * HTTP node's JSON body only appears once Body Type is JSON, and an
 * integration's fields only appear for the resource and operation they belong
 * to. Every `show` condition must hold; any `hide` match wins.
 *
 * An unset parameter never satisfies a `show` rule, so a field gated on a
 * choice the user has not made yet stays hidden.
 */
export declare function isVisible(property: NodeProperty, parameters: Readonly<Record<string, JsonValue>>): boolean;
/** The value to render for a property, falling back to its declared default. */
export declare function valueOf(property: NodeProperty, parameters: Readonly<Record<string, JsonValue>>): JsonValue;
/**
 * Bring a node's parameters into a state its own schema agrees with.
 *
 * Integration nodes reuse the name `operation` once per resource, so the
 * parameters only make sense read in order: `resource` decides which
 * `operation` property is live, and that in turn decides which fields are.
 * Walking the list top-down and fixing each visible property as we go is what
 * makes switching Resource reset Operation to something that resource
 * actually supports — rather than leaving a value the server would reject.
 *
 * Returns the same object when nothing needed changing, so callers can skip a
 * pointless state update.
 */
export declare function normalizeParameters(properties: readonly NodeProperty[], parameters: Readonly<Record<string, JsonValue>>): Record<string, JsonValue>;
/** Render any JSON value in a single-line text input without losing type. */
export declare function asText(value: JsonValue): string;
/** Key/value editors work on entry lists; the model stores an object. */
export declare function toEntries(value: JsonValue): [string, JsonValue][];
export declare function fromEntries(entries: readonly [string, JsonValue][]): JsonValue;
