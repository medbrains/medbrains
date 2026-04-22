import { describe, it, expect } from "vitest";
import {
  // Patient
  isPatient,
  isPatientCreate,
  isPatientUpdate,
  isPatientArray,
  assertPatient,
  // User
  isUser,
  isUserCreate,
  isUserUpdate,
  // Tenant
  isTenant,
  // Department
  isDepartment,
  isDepartmentCreate,
  // Encounter
  isEncounter,
  isEncounterCreate,
  // Consultation
  isConsultation,
  isConsultationCreate,
  // Diagnosis
  isDiagnosis,
  isDiagnosisCreate,
  // Vital
  isVital,
  isVitalCreate,
  // Lab Order
  isLabOrder,
  isLabOrderCreate,
  // Invoice
  isInvoice,
  isInvoiceCreate,
  // Admission
  isAdmission,
  isAdmissionCreate,
  // OPD Queue
  isOpdQueue,
  // API Response helpers
  validateApiResponse,
  validateApiArrayResponse,
  TypeAssertionError,
} from "./guards.js";

// ══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ══════════════════════════════════════════════════════════════════════════════

const UUID1 = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "550e8400-e29b-41d4-a716-446655440001";
const UUID3 = "550e8400-e29b-41d4-a716-446655440002";
const TIMESTAMP = "2024-01-15T10:30:00Z";
const DATE = "1990-01-15";

const validPatient = {
  id: UUID1,
  tenant_id: UUID2,
  uhid: "UHID001",
  abha_id: null,
  first_name: "John",
  last_name: "Doe",
  date_of_birth: DATE,
  gender: "male",
  phone: "9876543210",
  email: "john@example.com",
  address: { city: "Mumbai" },
  category: "general",
  attributes: {},
  is_active: true,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validUser = {
  id: UUID1,
  tenant_id: UUID2,
  username: "johndoe",
  email: "john@example.com",
  full_name: "John Doe",
  role: "doctor",
  access_matrix: {},
  is_active: true,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validTenant = {
  id: UUID1,
  code: "HOSP001",
  name: "General Hospital",
  hospital_type: "multi_specialty",
  config: {},
  is_active: true,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validDepartment = {
  id: UUID1,
  tenant_id: UUID2,
  parent_id: null,
  code: "CARDIO",
  name: "Cardiology",
  department_type: "clinical",
  config: {},
  is_active: true,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validEncounter = {
  id: UUID1,
  tenant_id: UUID2,
  patient_id: UUID3,
  encounter_type: "opd",
  status: "registered",
  department_id: null,
  doctor_id: null,
  admission_id: null,
  metadata: {},
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validConsultation = {
  id: UUID1,
  tenant_id: UUID2,
  encounter_id: UUID3,
  doctor_id: UUID1,
  chief_complaint: "Fever",
  history: null,
  examination: null,
  plan: null,
  notes: {},
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validDiagnosis = {
  id: UUID1,
  tenant_id: UUID2,
  encounter_id: UUID3,
  icd_code: "A00.1",
  description: "Cholera",
  diagnosis_type: null,
  is_primary: true,
  created_at: TIMESTAMP,
};

const validVital = {
  id: UUID1,
  tenant_id: UUID2,
  encounter_id: UUID3,
  recorded_by: UUID1,
  temperature: "98.6",
  pulse: 72,
  bp_systolic: 120,
  bp_diastolic: 80,
  respiratory_rate: 16,
  spo2: 98,
  weight: "70.5",
  height: "175",
  recorded_at: TIMESTAMP,
};

const validLabOrder = {
  id: UUID1,
  tenant_id: UUID2,
  encounter_id: UUID3,
  patient_id: UUID1,
  test_id: UUID2,
  ordered_by: UUID3,
  status: "ordered",
  priority: "routine",
  notes: null,
  collected_at: null,
  collected_by: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validInvoice = {
  id: UUID1,
  tenant_id: UUID2,
  invoice_number: "INV-2024-001",
  patient_id: UUID3,
  encounter_id: null,
  status: "draft",
  total_amount: "1500.00",
  tax_amount: "270.00",
  discount_amount: "100.00",
  paid_amount: "0.00",
  notes: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validAdmission = {
  id: UUID1,
  tenant_id: UUID2,
  encounter_id: UUID3,
  patient_id: UUID1,
  bed_id: null,
  admitting_doctor_id: UUID2,
  status: "admitted",
  admitted_at: TIMESTAMP,
  discharge_type: null,
  discharge_summary: null,
  discharged_at: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const validOpdQueue = {
  id: UUID1,
  tenant_id: UUID2,
  encounter_id: UUID3,
  token_number: 1,
  department_id: UUID1,
  doctor_id: null,
  status: "waiting",
  priority: 0,
  called_at: null,
  completed_at: null,
  created_at: TIMESTAMP,
};

// ══════════════════════════════════════════════════════════════════════════════
// PATIENT TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isPatient", () => {
  it("validates complete patient object", () => {
    expect(isPatient(validPatient)).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(isPatient({ id: UUID1 })).toBe(false);
    expect(isPatient({ ...validPatient, id: undefined })).toBe(false);
    expect(isPatient({ ...validPatient, uhid: undefined })).toBe(false);
  });

  it("rejects invalid UUID", () => {
    expect(isPatient({ ...validPatient, id: "not-a-uuid" })).toBe(false);
    expect(isPatient({ ...validPatient, tenant_id: "invalid" })).toBe(false);
  });

  it("rejects invalid gender", () => {
    expect(isPatient({ ...validPatient, gender: "invalid" })).toBe(false);
  });

  it("rejects invalid category", () => {
    expect(isPatient({ ...validPatient, category: "invalid" })).toBe(false);
  });

  it("rejects invalid date of birth", () => {
    expect(isPatient({ ...validPatient, date_of_birth: "invalid" })).toBe(false);
  });

  it("accepts null optional fields", () => {
    const patient = { ...validPatient, abha_id: null, email: null };
    expect(isPatient(patient)).toBe(true);
  });
});

describe("isPatientCreate", () => {
  it("validates patient creation payload", () => {
    const create = {
      first_name: "John",
      last_name: "Doe",
      date_of_birth: DATE,
      gender: "male",
      phone: "9876543210",
    };
    expect(isPatientCreate(create)).toBe(true);
  });

  it("accepts optional fields", () => {
    const create = {
      first_name: "John",
      last_name: "Doe",
      date_of_birth: DATE,
      gender: "female",
      phone: "9876543210",
      email: "jane@example.com",
      category: "vip",
      attributes: { notes: "VIP patient" },
    };
    expect(isPatientCreate(create)).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(isPatientCreate({ first_name: "John" })).toBe(false);
  });

  it("rejects invalid gender", () => {
    const create = {
      first_name: "John",
      last_name: "Doe",
      date_of_birth: DATE,
      gender: "invalid",
      phone: "9876543210",
    };
    expect(isPatientCreate(create)).toBe(false);
  });
});

describe("isPatientUpdate", () => {
  it("validates partial update", () => {
    expect(isPatientUpdate({ first_name: "Jane" })).toBe(true);
    expect(isPatientUpdate({ gender: "female" })).toBe(true);
    expect(isPatientUpdate({})).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isPatientUpdate({ gender: "invalid" })).toBe(false);
    expect(isPatientUpdate({ category: "invalid" })).toBe(false);
  });
});

describe("isPatientArray", () => {
  it("validates array of patients", () => {
    expect(isPatientArray([validPatient])).toBe(true);
    expect(isPatientArray([validPatient, validPatient])).toBe(true);
    expect(isPatientArray([])).toBe(true);
  });

  it("rejects array with invalid patient", () => {
    expect(isPatientArray([validPatient, { id: "invalid" }])).toBe(false);
  });

  it("rejects non-array", () => {
    expect(isPatientArray(validPatient)).toBe(false);
  });
});

describe("assertPatient", () => {
  it("does not throw for valid patient", () => {
    expect(() => assertPatient(validPatient)).not.toThrow();
  });

  it("throws for invalid patient", () => {
    expect(() => assertPatient({ id: "invalid" })).toThrow(TypeAssertionError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// USER TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isUser", () => {
  it("validates complete user object", () => {
    expect(isUser(validUser)).toBe(true);
  });

  it("rejects invalid role", () => {
    expect(isUser({ ...validUser, role: "invalid_role" })).toBe(false);
  });

  it("validates all user roles", () => {
    const roles = [
      "super_admin", "hospital_admin", "doctor", "nurse", "receptionist",
      "lab_technician", "pharmacist", "billing_clerk", "housekeeping_staff",
      "facilities_manager", "audit_officer",
    ];
    for (const role of roles) {
      expect(isUser({ ...validUser, role })).toBe(true);
    }
  });
});

describe("isUserCreate", () => {
  it("validates user creation payload", () => {
    const create = {
      username: "newuser",
      email: "new@example.com",
      full_name: "New User",
      role: "nurse",
      password: "SecurePass123!",
    };
    expect(isUserCreate(create)).toBe(true);
  });

  it("rejects missing password", () => {
    const create = {
      username: "newuser",
      email: "new@example.com",
      full_name: "New User",
      role: "nurse",
    };
    expect(isUserCreate(create)).toBe(false);
  });
});

describe("isUserUpdate", () => {
  it("validates partial update", () => {
    expect(isUserUpdate({ full_name: "Updated Name" })).toBe(true);
    expect(isUserUpdate({ role: "doctor" })).toBe(true);
    expect(isUserUpdate({})).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TENANT TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isTenant", () => {
  it("validates complete tenant object", () => {
    expect(isTenant(validTenant)).toBe(true);
  });

  it("validates all hospital types", () => {
    const types = [
      "medical_college", "multi_specialty", "district_hospital", "community_health",
      "primary_health", "standalone_clinic", "eye_hospital", "dental_college",
    ];
    for (const hospital_type of types) {
      expect(isTenant({ ...validTenant, hospital_type })).toBe(true);
    }
  });

  it("rejects invalid hospital type", () => {
    expect(isTenant({ ...validTenant, hospital_type: "invalid" })).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DEPARTMENT TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isDepartment", () => {
  it("validates complete department object", () => {
    expect(isDepartment(validDepartment)).toBe(true);
  });

  it("validates all department types", () => {
    const types = ["clinical", "pre_clinical", "para_clinical", "administrative", "support", "academic"];
    for (const department_type of types) {
      expect(isDepartment({ ...validDepartment, department_type })).toBe(true);
    }
  });

  it("accepts parent_id as UUID", () => {
    expect(isDepartment({ ...validDepartment, parent_id: UUID1 })).toBe(true);
  });
});

describe("isDepartmentCreate", () => {
  it("validates department creation payload", () => {
    const create = {
      code: "NEURO",
      name: "Neurology",
      department_type: "clinical",
    };
    expect(isDepartmentCreate(create)).toBe(true);
  });

  it("accepts optional parent_id", () => {
    const create = {
      code: "NEURO",
      name: "Neurology",
      department_type: "clinical",
      parent_id: UUID1,
    };
    expect(isDepartmentCreate(create)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ENCOUNTER TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isEncounter", () => {
  it("validates complete encounter object", () => {
    expect(isEncounter(validEncounter)).toBe(true);
  });

  it("validates all encounter types", () => {
    const types = ["opd", "ipd", "emergency", "daycare", "teleconsult"];
    for (const encounter_type of types) {
      expect(isEncounter({ ...validEncounter, encounter_type })).toBe(true);
    }
  });

  it("validates all encounter statuses", () => {
    const statuses = ["registered", "triaged", "in_consultation", "admitted", "discharged", "cancelled", "no_show"];
    for (const status of statuses) {
      expect(isEncounter({ ...validEncounter, status })).toBe(true);
    }
  });
});

describe("isEncounterCreate", () => {
  it("validates encounter creation payload", () => {
    const create = {
      patient_id: UUID1,
      encounter_type: "opd",
    };
    expect(isEncounterCreate(create)).toBe(true);
  });

  it("accepts optional fields", () => {
    const create = {
      patient_id: UUID1,
      encounter_type: "opd",
      department_id: UUID2,
      doctor_id: UUID3,
    };
    expect(isEncounterCreate(create)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CONSULTATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isConsultation", () => {
  it("validates complete consultation object", () => {
    expect(isConsultation(validConsultation)).toBe(true);
  });

  it("accepts all optional fields as null", () => {
    const consultation = {
      ...validConsultation,
      chief_complaint: null,
      history: null,
      examination: null,
      plan: null,
      notes: null,
    };
    expect(isConsultation(consultation)).toBe(true);
  });
});

describe("isConsultationCreate", () => {
  it("validates consultation creation payload", () => {
    const create = {
      encounter_id: UUID1,
      doctor_id: UUID2,
    };
    expect(isConsultationCreate(create)).toBe(true);
  });

  it("accepts optional fields", () => {
    const create = {
      encounter_id: UUID1,
      doctor_id: UUID2,
      chief_complaint: "Headache",
      history: "Patient reports...",
    };
    expect(isConsultationCreate(create)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DIAGNOSIS TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isDiagnosis", () => {
  it("validates complete diagnosis object", () => {
    expect(isDiagnosis(validDiagnosis)).toBe(true);
  });
});

describe("isDiagnosisCreate", () => {
  it("validates diagnosis creation payload", () => {
    const create = {
      encounter_id: UUID1,
      icd_code: "J06.9",
      description: "Upper respiratory infection",
    };
    expect(isDiagnosisCreate(create)).toBe(true);
  });

  it("accepts optional is_primary", () => {
    const create = {
      encounter_id: UUID1,
      icd_code: "J06.9",
      description: "Upper respiratory infection",
      is_primary: true,
    };
    expect(isDiagnosisCreate(create)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VITAL TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isVital", () => {
  it("validates complete vital object", () => {
    expect(isVital(validVital)).toBe(true);
  });

  it("accepts all optional vitals as null", () => {
    const vital = {
      id: UUID1,
      tenant_id: UUID2,
      encounter_id: UUID3,
      recorded_by: UUID1,
      temperature: null,
      pulse: null,
      bp_systolic: null,
      bp_diastolic: null,
      respiratory_rate: null,
      spo2: null,
      weight: null,
      height: null,
      recorded_at: TIMESTAMP,
    };
    expect(isVital(vital)).toBe(true);
  });
});

describe("isVitalCreate", () => {
  it("validates vital creation payload", () => {
    const create = {
      encounter_id: UUID1,
      recorded_by: UUID2,
    };
    expect(isVitalCreate(create)).toBe(true);
  });

  it("accepts optional vital measurements", () => {
    const create = {
      encounter_id: UUID1,
      recorded_by: UUID2,
      temperature: "98.6",
      pulse: 72,
      bp_systolic: 120,
      bp_diastolic: 80,
    };
    expect(isVitalCreate(create)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LAB ORDER TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isLabOrder", () => {
  it("validates complete lab order object", () => {
    expect(isLabOrder(validLabOrder)).toBe(true);
  });

  it("validates all lab statuses", () => {
    const statuses = ["ordered", "sample_collected", "processing", "completed", "verified", "cancelled"];
    for (const status of statuses) {
      expect(isLabOrder({ ...validLabOrder, status })).toBe(true);
    }
  });

  it("validates all lab priorities", () => {
    const priorities = ["routine", "urgent", "stat"];
    for (const priority of priorities) {
      expect(isLabOrder({ ...validLabOrder, priority })).toBe(true);
    }
  });
});

describe("isLabOrderCreate", () => {
  it("validates lab order creation payload", () => {
    const create = {
      encounter_id: UUID1,
      patient_id: UUID2,
      test_id: UUID3,
      ordered_by: UUID1,
    };
    expect(isLabOrderCreate(create)).toBe(true);
  });

  it("accepts optional priority", () => {
    const create = {
      encounter_id: UUID1,
      patient_id: UUID2,
      test_id: UUID3,
      ordered_by: UUID1,
      priority: "urgent",
    };
    expect(isLabOrderCreate(create)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// INVOICE TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isInvoice", () => {
  it("validates complete invoice object", () => {
    expect(isInvoice(validInvoice)).toBe(true);
  });

  it("validates all invoice statuses", () => {
    const statuses = ["draft", "issued", "partially_paid", "paid", "cancelled"];
    for (const status of statuses) {
      expect(isInvoice({ ...validInvoice, status })).toBe(true);
    }
  });
});

describe("isInvoiceCreate", () => {
  it("validates invoice creation payload", () => {
    const create = {
      patient_id: UUID1,
      total_amount: "1500.00",
    };
    expect(isInvoiceCreate(create)).toBe(true);
  });

  it("accepts optional fields", () => {
    const create = {
      patient_id: UUID1,
      total_amount: "1500.00",
      encounter_id: UUID2,
      status: "issued",
      tax_amount: "270.00",
    };
    expect(isInvoiceCreate(create)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMISSION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isAdmission", () => {
  it("validates complete admission object", () => {
    expect(isAdmission(validAdmission)).toBe(true);
  });

  it("validates all admission statuses", () => {
    const statuses = ["admitted", "transferred", "discharged", "deceased", "lama", "dama", "absconded"];
    for (const status of statuses) {
      expect(isAdmission({ ...validAdmission, status })).toBe(true);
    }
  });

  it("validates all discharge types", () => {
    const types = ["normal", "lama", "dama", "absconded", "referred", "deceased"];
    for (const discharge_type of types) {
      expect(isAdmission({ ...validAdmission, discharge_type })).toBe(true);
    }
  });
});

describe("isAdmissionCreate", () => {
  it("validates admission creation payload", () => {
    const create = {
      encounter_id: UUID1,
      patient_id: UUID2,
      admitting_doctor_id: UUID3,
    };
    expect(isAdmissionCreate(create)).toBe(true);
  });

  it("accepts optional bed_id", () => {
    const create = {
      encounter_id: UUID1,
      patient_id: UUID2,
      admitting_doctor_id: UUID3,
      bed_id: UUID1,
    };
    expect(isAdmissionCreate(create)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// OPD QUEUE TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("isOpdQueue", () => {
  it("validates complete OPD queue object", () => {
    expect(isOpdQueue(validOpdQueue)).toBe(true);
  });

  it("validates all queue statuses", () => {
    const statuses = ["waiting", "called", "in_consultation", "completed", "no_show", "cancelled"];
    for (const status of statuses) {
      expect(isOpdQueue({ ...validOpdQueue, status })).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// API RESPONSE VALIDATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("validateApiResponse", () => {
  it("returns typed data for valid response", () => {
    const result = validateApiResponse(validPatient, isPatient, "/patients/123");
    expect(result).toEqual(validPatient);
  });

  it("throws for invalid response", () => {
    expect(() => {
      validateApiResponse({ invalid: "data" }, isPatient, "/patients/123");
    }).toThrow(TypeAssertionError);
  });
});

describe("validateApiArrayResponse", () => {
  it("returns typed array for valid response", () => {
    const result = validateApiArrayResponse([validPatient], isPatient, "/patients");
    expect(result).toEqual([validPatient]);
  });

  it("returns empty array for empty response", () => {
    const result = validateApiArrayResponse([], isPatient, "/patients");
    expect(result).toEqual([]);
  });

  it("throws for non-array response", () => {
    expect(() => {
      validateApiArrayResponse(validPatient, isPatient, "/patients");
    }).toThrow(TypeAssertionError);
  });

  it("throws for array with invalid item", () => {
    expect(() => {
      validateApiArrayResponse([validPatient, { invalid: "data" }], isPatient, "/patients");
    }).toThrow(TypeAssertionError);
  });

  it("includes index in error message", () => {
    try {
      validateApiArrayResponse([validPatient, { invalid: "data" }], isPatient, "/patients");
    } catch (e) {
      expect(e).toBeInstanceOf(TypeAssertionError);
      expect((e as TypeAssertionError).message).toContain("index 1");
    }
  });
});
