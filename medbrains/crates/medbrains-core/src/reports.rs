//! Governed report catalog and runtime data contracts.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportPriority {
    P1,
    P2,
    P3,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportReadiness {
    LiveApi,
    QueryBuildable,
    DerivedView,
    Predictive,
    CaptureNeeded,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportExportFormat {
    Pdf,
    Excel,
    Csv,
    Png,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportExportMode {
    Standard,
    Governed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportDataStatus {
    Live,
    NotWired,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EChartsTemplate {
    LineStack,
    LineGradient,
    AreaStack,
    BarStack,
    BarRace,
    BarWaterfall,
    HeatmapCartesian,
    HeatmapCalendar,
    Boxplot,
    Sankey,
    GraphNetwork,
    Radar,
    Treemap,
    Sunburst,
    Funnel,
    Gauge,
    GeoMap,
    EffectScatterMap,
    PictorialBar,
    CustomSvg,
    Timeline,
    ParallelCoordinates,
    ThemeRiver,
    CandlestickOhlc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportDefinition {
    pub id: String,
    pub title: String,
    pub purpose: String,
    pub source_tables: Vec<String>,
    pub source_events: Vec<String>,
    pub event_payload_keys: Vec<String>,
    pub indicator_targets: Vec<String>,
    pub permissions: Vec<String>,
    pub priority: ReportPriority,
    pub readiness: ReportReadiness,
    pub chart_types: Vec<String>,
    pub echarts_template: EChartsTemplate,
    pub visual_kind: String,
    pub refresh: String,
    pub exports: Vec<ReportExportFormat>,
    pub export_mode: ReportExportMode,
    pub drilldowns: Vec<String>,
    pub data_endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportFamilyDefinition {
    pub id: String,
    pub title: String,
    pub eyebrow: String,
    pub description: String,
    pub reports: Vec<ReportDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportCatalogResponse {
    pub generated_at: DateTime<Utc>,
    pub families: Vec<ReportFamilyDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportDataSummary {
    pub row_count: usize,
    pub status: ReportDataStatus,
    pub source: String,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportDataResponse {
    pub report_id: String,
    pub generated_at: DateTime<Utc>,
    pub summary: ReportDataSummary,
    pub rows: Vec<Value>,
}
