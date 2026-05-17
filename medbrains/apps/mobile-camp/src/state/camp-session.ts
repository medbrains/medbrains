/**
 * Global Camp Mode session.
 *
 * Field users select a camp once. The rest of the app works inside
 * that active camp workspace until they switch camp or wipe local data.
 */

import type { Camp, CampPacketResponse } from "@medbrains/types";
import { create } from "zustand";

export type CampOperationMode = "remote_offline" | "hospital_online" | "hybrid";

interface CampSessionState {
  selectedCamp: Camp | null;
  packet: CampPacketResponse | null;
  pendingEvents: number;
  operationMode: CampOperationMode;
  setSelectedCamp: (camp: Camp) => void;
  setPacket: (packet: CampPacketResponse) => void;
  setPendingEvents: (count: number) => void;
  setOperationMode: (mode: CampOperationMode) => void;
  clearCurrentCamp: () => void;
}

export const useCampSession = create<CampSessionState>((set) => ({
  selectedCamp: null,
  packet: null,
  pendingEvents: 0,
  operationMode: "remote_offline",
  setSelectedCamp: (camp) => set({ selectedCamp: camp }),
  setPacket: (packet) =>
    set({
      selectedCamp: packet.camp,
      packet,
    }),
  setPendingEvents: (pendingEvents) => set({ pendingEvents }),
  setOperationMode: (operationMode) => set({ operationMode }),
  clearCurrentCamp: () =>
    set({
      selectedCamp: null,
      packet: null,
      pendingEvents: 0,
      operationMode: "remote_offline",
    }),
}));
