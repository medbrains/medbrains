/**
 * Presenting a node id for a person to read.
 *
 * Kept apart from the screen deliberately: this is pure string work,
 * and pulling React Native in to test it would mean not testing it.
 */

/** Characters per group when the id is shown for reading aloud. */
export const NODE_ID_GROUP_SIZE = 8;

/**
 * Break the id into fixed groups so it can be read aloud without
 * losing your place.
 *
 * Presentation only. An administrator reads this across a ward and
 * types it into a laptop; if grouping ever altered the value, the
 * wrong key would be bound and the device would look correctly paired
 * and never connect.
 */
export function groupForReading(nodeId: string, size = NODE_ID_GROUP_SIZE): string {
  if (size <= 0) {
    return nodeId;
  }
  const groups: string[] = [];
  for (let index = 0; index < nodeId.length; index += size) {
    groups.push(nodeId.slice(index, index + size));
  }
  return groups.join("  ");
}
