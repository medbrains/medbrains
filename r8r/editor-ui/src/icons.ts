/**
 * Node icons, as real vector glyphs rather than emoji.
 *
 * The backend describes a node's icon as a short string so it stays free of
 * frontend concerns; this map turns that string into an actual icon. Anything
 * unmapped falls back to a neutral shape, so an integration added later still
 * renders sensibly before it gets an icon of its own.
 */

import {
  IconArrowsSplit2,
  IconBrandGithub,
  IconBrandSlack,
  IconChartArrowsVertical,
  IconClock,
  IconCode,
  IconCirclesRelation,
  IconFilter,
  IconPencil,
  IconPlayerPlay,
  IconPlayerPause,
  IconPoint,
  IconArrowsSplit,
  IconWebhook,
  IconWorld,
  type Icon,
} from '@tabler/icons-react'

const BY_NODE_TYPE: Record<string, Icon> = {
  manual: IconPlayerPlay,
  webhook: IconWebhook,
  schedule: IconClock,
  set: IconPencil,
  code: IconCode,
  splitOut: IconArrowsSplit,
  aggregate: IconChartArrowsVertical,
  if: IconArrowsSplit2,
  filter: IconFilter,
  merge: IconCirclesRelation,
  wait: IconPlayerPause,
  noOp: IconPoint,
  httpRequest: IconWorld,
  slack: IconBrandSlack,
  github: IconBrandGithub,
}

export function iconFor(nodeType: string): Icon {
  return BY_NODE_TYPE[nodeType] ?? IconPoint
}
