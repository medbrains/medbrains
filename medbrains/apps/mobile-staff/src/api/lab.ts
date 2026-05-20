/**
 * Lab API methods — OPD blood-test ordering, order queue, sample
 * collection, critical alerts, and phlebotomy worklists.
 */

import type {
  CreateLabOrderRequest,
  LabCriticalAlert,
  LabOrder,
  LabOrderDetailResponse,
  LabOrderListResponse,
  LabPhlebotomyQueueItem,
  LabTatAnalyticsRow,
  LabTestCatalog,
} from "@medbrains/types";
import { request } from "./client.js";
import { apiConfig } from "./config.js";

export async function listLabOrders(status?: string): Promise<LabOrderListResponse> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<LabOrderListResponse>(apiConfig, "GET", `/api/lab/orders${qs}`);
}

export async function getLabOrder(id: string): Promise<LabOrderDetailResponse> {
  return request<LabOrderDetailResponse>(apiConfig, "GET", `/api/lab/orders/${id}`);
}

export async function createLabOrder(data: CreateLabOrderRequest): Promise<LabOrder> {
  return request<LabOrder>(apiConfig, "POST", "/api/lab/orders", data);
}

export async function collectSample(id: string): Promise<LabOrder> {
  return request<LabOrder>(apiConfig, "PUT", `/api/lab/orders/${id}/collect`);
}

export async function startProcessing(id: string): Promise<LabOrder> {
  return request<LabOrder>(apiConfig, "PUT", `/api/lab/orders/${id}/process`);
}

export async function completeLabOrder(id: string): Promise<LabOrder> {
  return request<LabOrder>(apiConfig, "PUT", `/api/lab/orders/${id}/complete`);
}

export async function verifyLabOrder(id: string): Promise<LabOrder> {
  return request<LabOrder>(apiConfig, "PUT", `/api/lab/orders/${id}/verify`);
}

export async function listLabCatalog(params?: {
  search?: string;
  sample_type?: string;
}): Promise<LabTestCatalog[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.sample_type) qs.set("sample_type", params.sample_type);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<LabTestCatalog[]>(apiConfig, "GET", `/api/lab/catalog${suffix}`);
}

export async function listCriticalAlerts(): Promise<LabCriticalAlert[]> {
  return request<LabCriticalAlert[]>(apiConfig, "GET", "/api/lab/critical-alerts");
}

export async function acknowledgeCriticalAlert(alertId: string): Promise<LabCriticalAlert> {
  return request<LabCriticalAlert>(
    apiConfig,
    "PUT",
    `/api/lab/critical-alerts/${alertId}/acknowledge`,
  );
}

export async function listPhlebotomyQueue(): Promise<LabPhlebotomyQueueItem[]> {
  return request<LabPhlebotomyQueueItem[]>(apiConfig, "GET", "/api/lab/phlebotomy-queue");
}

export async function updatePhlebotomyStatus(
  id: string,
  status: "in_progress" | "completed" | "skipped",
): Promise<LabPhlebotomyQueueItem> {
  return request<LabPhlebotomyQueueItem>(
    apiConfig,
    "PUT",
    `/api/lab/phlebotomy-queue/${id}/status`,
    {
      status,
    },
  );
}

export async function getLabTatAnalytics(): Promise<LabTatAnalyticsRow[]> {
  return request<LabTatAnalyticsRow[]>(apiConfig, "GET", "/api/lab/analytics/tat");
}
