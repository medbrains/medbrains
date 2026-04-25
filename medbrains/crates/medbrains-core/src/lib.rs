//! # medbrains-core
//!
//! Domain types and business entities for the hospital management system.
//! This crate has **zero framework dependencies** — it defines the core data model
//! shared by the server, database, and client layers.
//!
//! ## Modules
//!
//! - [`patient`] — Patient demographics, UHID, registration
//! - [`auth`] — Authentication claims and role definitions
//! - [`tenant`] — Multi-tenant context and tenant metadata
//! - [`billing`] — Charges, invoices, payment types
//! - [`lab`] — Lab orders, test panels, result types
//! - [`ipd`] — Inpatient admissions, bed assignments, discharge
//! - [`consultation`] / [`encounter`] — OPD visits, clinical encounters
//! - [`workflow`] — Workflow templates and step definitions
//! - [`audit`] — Audit log entry types with SHA-256 chain

pub mod ambulance;
pub mod analytics;
pub mod appointment;
pub mod audit;
pub mod bedside_portal;
pub mod bme;
pub mod case_mgmt;
pub mod blood_bank;
pub mod camp;
pub mod cms;
pub mod command_center;
pub mod communications;
pub mod consent;
pub mod auth;
pub mod billing;
pub mod cds;
pub mod config;
pub mod consultation;
pub mod cssd;
pub mod dashboard;
pub mod diet;
pub mod device;
pub mod document;
pub mod department;
pub mod emergency;
pub mod encounter;
pub mod facilities_mgmt;
pub mod facility;
pub mod form;
pub mod front_office;
pub mod geo;
pub mod housekeeping;
pub mod hr;
pub mod icu;
pub mod infection_control;
pub mod indent;
pub mod insurance;
pub mod inventory;
pub mod integration;
pub mod ipd;
pub mod it_security;
pub mod lab;
pub mod lms;
pub mod mrd;
pub mod multi_hospital;
pub mod ot;
pub mod occ_health;
pub mod onboarding;
pub mod order_set;
pub mod patient;
pub mod permissions;
pub mod print_data;
pub mod pharmacy;
pub mod pharmacy_phase2;
pub mod procurement;
pub mod quality;
pub mod queue;
pub mod radiology;
pub mod regulatory;
pub mod retrospective;
pub mod scheduling;
pub mod screen;
pub mod security;
pub mod sequence;
pub mod specialty;
pub mod tenant;
pub mod topology;
pub mod user;
pub mod utilization_review;
pub mod workflow;
