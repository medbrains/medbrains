import { Items, JsonValue, NodeTypeDescription, Workflow } from '../types';
export interface SourceField {
    /** Dot path into the item, e.g. `customer.address.city`. */
    path: string;
    /** What the first item actually held there, for the preview column. */
    sample: JsonValue;
    /** `string`, `number`, `boolean`, `object`, `list` or `empty`. */
    kind: string;
}
/**
 * Every field path present in the items, in the order they appear.
 *
 * Derived from real data rather than a declared schema, because the whole
 * point is to show what this API actually sent — including the fields its
 * documentation forgot.
 */
export declare function fieldPaths(items: Items): SourceField[];
export declare function kindOf(value: JsonValue): string;
/**
 * The fields the next node expects.
 *
 * For an integration node these are its declared parameters, which is exactly
 * the list a mapping needs to fill. For anything else there is nothing to
 * declare, and the destination is free text.
 */
export declare function destinationFields(workflow: Workflow, mapperNodeId: string, nodeTypes: readonly NodeTypeDescription[]): string[];
/**
 * Reduce a field name to what it means, so `customer_name`, `customerName` and
 * `Customer Name` all compare equal.
 */
export declare function normalizeName(name: string): string;
export interface Suggestion {
    destination: string;
    source: string;
    /** `exact` when the names agree, `similar` when one contains the other. */
    confidence: 'exact' | 'similar';
}
/**
 * Match destinations to sources by name.
 *
 * Exact matches are taken first across the whole set, so a weaker partial
 * match can never steal a source that an exact match needs. Each source is
 * used once — mapping one field onto two destinations is a deliberate act, not
 * something to guess at.
 */
export declare function autoMap(destinations: readonly string[], sources: readonly SourceField[]): Suggestion[];
/** Merge suggestions into the mappings already configured, without overwriting. */
export declare function applySuggestions(current: Readonly<Record<string, JsonValue>>, suggestions: readonly Suggestion[]): Record<string, JsonValue>;
