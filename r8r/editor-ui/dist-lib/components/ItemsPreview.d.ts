import { Items } from '../types';
/**
 * Items, shown either as a table or as raw JSON.
 *
 * The table is the default because most items are flat records and a table
 * makes twenty of them scannable; JSON is one click away for the nested cases.
 */
export declare function ItemsPreview({ items, empty, label, }: {
    items: Items;
    empty: string;
    label: string;
}): import("react").JSX.Element;
