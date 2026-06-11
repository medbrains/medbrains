---
module: diet-kitchen
priority: P1
status: draft
---

# SOP: Diet & Kitchen

## Overview
The Diet & Kitchen module covers therapeutic diet prescription by dietitians, diet plan linkage to IPD patient records, meal planning by the kitchen team, meal delivery tracking, and nutritional intake monitoring. It integrates with IPD (patient admission status, food allergies, clinical conditions), pharmacy (TPN — total parenteral nutrition), and nursing (enteral feed administration). Compliance with food safety and hospital dietary standards is enforced.

## Actor Matrix

| Actor (Role) | Can Perform | Notes |
|---|---|---|
| `dietitian` | Prescribe diet, create diet templates, nutritional assessment | Clinical nutritional authority |
| `canteen_staff` | Prepare meals, record output, mark delivery | Kitchen execution actor |
| `nurse` | Record patient meal consumption, enteral feed administration | Bedside monitoring |
| `doctor` | Order specific dietary restriction (e.g., NPO, diabetic diet) | Dietary orders in clinical context |

---

## Scenario 1: Dietitian Prescribes Therapeutic Diet for IPD Patient — Actor: Dietitian

**Actor**: `dietitian`  
**Entry point**: Diet Module → IPD Patients → Nutritional Assessment  
**Preconditions**: Patient admitted in IPD; dietary referral received from doctor (or dietitian opens proactively for high-risk patients)

**Steps**:
1. Dietitian opens patient's IPD record; reviews diagnosis, BMI, lab values (albumin, Hb), allergies, and clinical condition.
2. Conducts nutritional assessment: calculates caloric need (Harris-Benedict / Mifflin-St Jeor), protein requirement.
3. Selects diet type from template library (Diabetic 1800 kcal / Renal Diet / Low Sodium / Clear Liquid / etc.).
4. Customises based on patient tolerance and allergies (marks allergens clearly).
5. Prescribes diet plan: meal times (Breakfast / Mid-morning / Lunch / Afternoon / Dinner / Bedtime), items, quantities.
6. Saves plan; kitchen receives updated diet list for next meal cycle.
7. Documents nutritional diagnosis (e.g., "Malnutrition — moderate, BMI 17") in patient record.

**Exit / Outcome**: Diet plan active for patient; kitchen queue updated; nutritional assessment documented.  
**Regulatory note**: NABH MOM.4 — nutritional screening on admission; NABH DNS.1 — dietitian involved in care of high-risk nutritional patients; FSSAI — food preparation follows safety standards.  
**Existing test**: `apps/web/e2e/crud/diet-kitchen.spec.ts` (partial); `— needs diet prescription chain test`

---

## Scenario 2: Kitchen Staff Prepares and Delivers Meals — Actor: Canteen Staff

**Actor**: `canteen_staff`  
**Entry point**: Diet → Kitchen → Today's Meal List  
**Preconditions**: Dietitian prescriptions finalized; current meal slot is active (e.g., Lunch 11:30–13:00)

**Steps**:
1. Kitchen staff opens meal list for current slot; sees all IPD patients with their diet type and any special instructions (no salt, no sugar, allergen-free).
2. Prepares meals as per standard operating recipes in the diet template.
3. Marks each tray prepared; system generates tray labels (patient name, UHID, bed, diet type, allergen list).
4. Delivers trays to respective wards; ward nurse or canteen staff marks "delivered" in system.
5. If patient is NPO or on fasting for procedure: system flags "DO NOT FEED" on tray list.
6. Records any returns (patient refused meal, procedure scheduled, discharge).

**Exit / Outcome**: Meals delivered; delivery timestamp recorded; dietary compliance traceable per patient per meal.  
**Regulatory note**: FSSAI Food Safety and Standards Act 2006 — hospital kitchen licence; NABH DNS.2 — diet tray labelling and special diet instructions; NPO compliance enforced by kitchen–clinical workflow.  
**Existing test**: `— needs test`

---

## Scenario 3: Nurse Records Meal Consumption and Enteral Feed — Actor: Nurse

**Actor**: `nurse`  
**Entry point**: IPD Ward → Patient record → Nutrition Monitoring  
**Preconditions**: Meal delivered to patient; enteral feed running if applicable

**Steps**:
1. Nurse records oral meal intake as percentage consumed (e.g., "50% of lunch tray eaten").
2. Records refusal reason if applicable (nausea, procedure prep, anorexia).
3. For enteral/tube-fed patients: records feed rate, volume infused, tube position check (before each feed).
4. Records fluid balance contribution from enteral feed into I/O chart.
5. Flags persistent poor intake (< 50% for 2+ consecutive meals) → auto-notifies dietitian for reassessment.
6. Dietitian receives alert and may revise diet plan or escalate to doctor for TPN consideration.

**Exit / Outcome**: Nutritional intake documented per meal; poor intake alerts triggered; I/O balance updated.  
**Regulatory note**: NABH MOM.4 — nutritional monitoring documented; NABH DNS.3 — enteral feed administration documented; IPSG Goal 3 — tube feed rate and position verified before each administration.  
**Existing test**: `— needs test`
