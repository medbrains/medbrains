import type {
  AdditionalSequence,
  OnboardingBedType,
  OnboardingDepartment,
  OnboardingFacility,
  OnboardingLocation,
  OnboardingPaymentMethod,
  OnboardingRole,
  OnboardingService,
  OnboardingTaxCategory,
  OnboardingUser,
} from "@medbrains/types";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

// Platform-agnostic UUID generation
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-browser environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Platform-agnostic sessionStorage
const isBrowser =
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const sessionStorageAdapter: StateStorage = {
  getItem: (name) => {
    if (!isBrowser) return null;
    const value = window.sessionStorage.getItem(name);
    return value ?? null;
  },
  setItem: (name, value) => {
    if (!isBrowser) return;
    window.sessionStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (!isBrowser) return;
    window.sessionStorage.removeItem(name);
  },
};

// Wrap in createJSONStorage for proper zustand persist integration
const getSessionStorage = () => createJSONStorage(() => sessionStorageAdapter);

interface HospitalDetails {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  registration_no?: string | null;
  accreditation?: string | null;
  timezone: string;
  currency: string;
  fy_start_month: number;
}

interface GeoData {
  country_id?: string;
  state_id?: string;
  district_id?: string;
}

interface SequencesData {
  uhid_prefix: string;
  uhid_pad_width: number;
  invoice_prefix: string;
  invoice_pad_width: number;
}

interface BrandingData {
  primary_color: string;
  secondary_color: string;
  logo_url?: string;
}

interface OnboardingState {
  // Step 2: Hospital Details
  hospitalDetails: HospitalDetails | null;
  setHospitalDetails: (data: HospitalDetails) => void;

  // Step 3: Geo & Regulatory
  geo: GeoData | null;
  regulatorIds: string[];
  setGeo: (geo: GeoData, regulatorIds: string[]) => void;

  // Step 4: Facilities
  facilities: OnboardingFacility[];
  addFacility: (facility: Omit<OnboardingFacility, "local_id">) => void;
  removeFacility: (localId: string) => void;
  setFacilities: (facilities: OnboardingFacility[]) => void;

  // Step 5: Locations
  locations: OnboardingLocation[];
  addLocation: (location: Omit<OnboardingLocation, "local_id">) => void;
  removeLocation: (localId: string) => void;
  setLocations: (locations: OnboardingLocation[]) => void;

  // Step 6: Departments
  departments: OnboardingDepartment[];
  addDepartment: (department: Omit<OnboardingDepartment, "local_id">) => void;
  removeDepartment: (localId: string) => void;
  setDepartments: (departments: OnboardingDepartment[]) => void;

  // Step 7: Users & Roles
  users: OnboardingUser[];
  addUser: (user: Omit<OnboardingUser, "local_id">) => void;
  removeUser: (localId: string) => void;
  roles: OnboardingRole[];
  addRole: (role: Omit<OnboardingRole, "local_id">) => void;
  removeRole: (localId: string) => void;

  // Step 8: Modules
  moduleStatuses: Record<string, string>;
  setModuleStatus: (code: string, status: string) => void;
  setAllModuleStatuses: (statuses: Record<string, string>) => void;

  // Step 9: Sequences
  sequences: SequencesData | null;
  setSequences: (data: SequencesData) => void;
  additionalSequences: AdditionalSequence[];
  setAdditionalSequences: (data: AdditionalSequence[]) => void;

  // Step 10: Services
  services: OnboardingService[];
  addService: (service: Omit<OnboardingService, "local_id">) => void;
  removeService: (localId: string) => void;
  setServices: (services: OnboardingService[]) => void;

  // Step 11: Bed Types
  bedTypes: OnboardingBedType[];
  addBedType: (bedType: Omit<OnboardingBedType, "local_id">) => void;
  removeBedType: (localId: string) => void;
  setBedTypes: (bedTypes: OnboardingBedType[]) => void;

  // Step 12: Billing & Tax
  taxCategories: OnboardingTaxCategory[];
  addTaxCategory: (cat: Omit<OnboardingTaxCategory, "local_id">) => void;
  removeTaxCategory: (localId: string) => void;
  setTaxCategories: (cats: OnboardingTaxCategory[]) => void;

  paymentMethods: OnboardingPaymentMethod[];
  addPaymentMethod: (pm: Omit<OnboardingPaymentMethod, "local_id">) => void;
  removePaymentMethod: (localId: string) => void;
  setPaymentMethods: (pms: OnboardingPaymentMethod[]) => void;

  // Step 13: Branding
  branding: BrandingData | null;
  setBranding: (data: BrandingData) => void;

  // Lifecycle
  reset: () => void;
}

const initialState = {
  hospitalDetails: null,
  geo: null,
  regulatorIds: [],
  facilities: [],
  locations: [],
  departments: [],
  users: [],
  roles: [],
  moduleStatuses: {},
  sequences: null,
  additionalSequences: [] as AdditionalSequence[],
  services: [] as OnboardingService[],
  bedTypes: [] as OnboardingBedType[],
  taxCategories: [] as OnboardingTaxCategory[],
  paymentMethods: [] as OnboardingPaymentMethod[],
  branding: null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      // Step 2
      setHospitalDetails: (data) => set({ hospitalDetails: data }),

      // Step 3
      setGeo: (geo, regulatorIds) => set({ geo, regulatorIds }),

      // Step 4
      addFacility: (facility) =>
        set((state) => ({
          facilities: [
            ...state.facilities,
            { ...facility, local_id: generateUUID() },
          ],
        })),
      removeFacility: (localId) =>
        set((state) => ({
          facilities: state.facilities.filter((f) => f.local_id !== localId),
        })),
      setFacilities: (facilities) => set({ facilities }),

      // Step 5
      addLocation: (location) =>
        set((state) => ({
          locations: [
            ...state.locations,
            { ...location, local_id: generateUUID() },
          ],
        })),
      removeLocation: (localId) =>
        set((state) => ({
          locations: state.locations.filter((l) => l.local_id !== localId),
        })),
      setLocations: (locations) => set({ locations }),

      // Step 6
      addDepartment: (department) =>
        set((state) => ({
          departments: [
            ...state.departments,
            { ...department, local_id: generateUUID() },
          ],
        })),
      removeDepartment: (localId) =>
        set((state) => ({
          departments: state.departments.filter((d) => d.local_id !== localId),
        })),
      setDepartments: (departments) => set({ departments }),

      // Step 7
      addUser: (user) =>
        set((state) => ({
          users: [
            ...state.users,
            { ...user, local_id: generateUUID() },
          ],
        })),
      removeUser: (localId) =>
        set((state) => ({
          users: state.users.filter((u) => u.local_id !== localId),
        })),
      addRole: (role) =>
        set((state) => ({
          roles: [
            ...state.roles,
            { ...role, local_id: generateUUID() },
          ],
        })),
      removeRole: (localId) =>
        set((state) => ({
          roles: state.roles.filter((r) => r.local_id !== localId),
        })),

      // Step 8
      setModuleStatus: (code, status) =>
        set((state) => ({
          moduleStatuses: { ...state.moduleStatuses, [code]: status },
        })),
      setAllModuleStatuses: (statuses) => set({ moduleStatuses: statuses }),

      // Step 9
      setSequences: (data) => set({ sequences: data }),
      setAdditionalSequences: (data) => set({ additionalSequences: data }),

      // Step 10: Services
      addService: (service) =>
        set((state) => ({
          services: [
            ...state.services,
            { ...service, local_id: generateUUID() },
          ],
        })),
      removeService: (localId) =>
        set((state) => ({
          services: state.services.filter((s) => s.local_id !== localId),
        })),
      setServices: (services) => set({ services }),

      // Step 11: Bed Types
      addBedType: (bedType) =>
        set((state) => ({
          bedTypes: [
            ...state.bedTypes,
            { ...bedType, local_id: generateUUID() },
          ],
        })),
      removeBedType: (localId) =>
        set((state) => ({
          bedTypes: state.bedTypes.filter((b) => b.local_id !== localId),
        })),
      setBedTypes: (bedTypes) => set({ bedTypes }),

      // Step 12: Billing & Tax
      addTaxCategory: (cat) =>
        set((state) => ({
          taxCategories: [
            ...state.taxCategories,
            { ...cat, local_id: generateUUID() },
          ],
        })),
      removeTaxCategory: (localId) =>
        set((state) => ({
          taxCategories: state.taxCategories.filter((c) => c.local_id !== localId),
        })),
      setTaxCategories: (cats) => set({ taxCategories: cats }),

      addPaymentMethod: (pm) =>
        set((state) => ({
          paymentMethods: [
            ...state.paymentMethods,
            { ...pm, local_id: generateUUID() },
          ],
        })),
      removePaymentMethod: (localId) =>
        set((state) => ({
          paymentMethods: state.paymentMethods.filter((p) => p.local_id !== localId),
        })),
      setPaymentMethods: (pms) => set({ paymentMethods: pms }),

      // Step 13
      setBranding: (data) => set({ branding: data }),

      // Lifecycle
      reset: () => set(initialState),
    }),
    {
      name: "onboarding-storage",
      storage: getSessionStorage(),
    },
  ),
);
