import { create } from "zustand";

/** Global open/close state for the "add product from anywhere" quick-add modal. */
interface AddProductState {
  opened: boolean;
  open: () => void;
  close: () => void;
}

export const useAddProductStore = create<AddProductState>((set) => ({
  opened: false,
  open: () => set({ opened: true }),
  close: () => set({ opened: false }),
}));
