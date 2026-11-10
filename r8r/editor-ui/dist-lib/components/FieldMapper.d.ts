import { Items, JsonValue } from '../types';
/**
 * The two-sided field mapper.
 *
 * The left column is what actually arrived from the previous node; the right
 * is where it is going. Auto-map fills in every row whose names agree, which
 * is most of them, and leaves the judgement calls to the person.
 */
export declare function FieldMapper({ value, input, destinations, onChange, }: {
    value: JsonValue;
    /** Items the previous node produced in the last run. */
    input: Items;
    /** Fields the next node expects, when it declares any. */
    destinations: readonly string[];
    onChange: (value: JsonValue) => void;
}): import("react").JSX.Element;
