type RoutePreloader = () => Promise<unknown>;

const routePreloaders: Record<string, RoutePreloader> = {
  "/apps": () => import("@/pages/apps"),
  "/dashboard": () => import("@/pages/dashboard"),
  "/components-inputs": () => import("@/pages/components-inputs"),
  "/patients": () => import("@/pages/patients"),
  "/opd": () => import("@/pages/opd"),
  "/opd/appointments": () => import("@/pages/appointments"),
  "/opd/pg-logbook": () => import("@/pages/pg-logbook"),
  "/doctor/signoffs": () => import("@/pages/doctor/signoffs"),
  "/lab": () => import("@/pages/lab"),
  "/radiology": () => import("@/pages/radiology"),
  "/pharmacy": () => import("@/pages/pharmacy"),
  "/pharmacy/finance": () => import("@/pages/pharmacy-finance"),
  "/billing": () => import("@/pages/billing"),
  "/indent": () => import("@/pages/indent"),
  "/procurement": () => import("@/pages/procurement"),
  "/quality": () => import("@/pages/quality"),
  "/front-office": () => import("@/pages/front-office"),
  "/housekeeping": () => import("@/pages/housekeeping"),
  "/hr": () => import("@/pages/hr"),
  "/bme": () => import("@/pages/bme"),
  "/ambulance": () => import("@/pages/ambulance"),
  "/communications": () => import("@/pages/communications"),
  "/camp": () => import("@/pages/camp"),
  "/command-center": () => import("@/pages/command-center"),
  "/facilities": () => import("@/pages/facilities"),
  "/consent": () => import("@/pages/consent"),
  "/infection-control": () => import("@/pages/infection-control"),
  "/mrd": () => import("@/pages/mrd"),
  "/security": () => import("@/pages/security"),
  "/insurance": () => import("@/pages/insurance"),
  "/analytics": () => import("@/pages/analytics"),
  "/reports": () => import("@/pages/reports"),
  "/reports/nabh": () => import("@/pages/admin/nabh-indicators"),
  "/audit": () => import("@/pages/audit"),
  "/regulatory": () => import("@/pages/regulatory"),
  "/order-sets": () => import("@/pages/order-sets"),
  "/chronic-care": () => import("@/pages/chronic-care"),
  "/occupational-health": () => import("@/pages/occupational-health"),
  "/utilization-review": () => import("@/pages/utilization-review"),
  "/case-management": () => import("@/pages/case-management"),
  "/scheduling": () => import("@/pages/scheduling"),
  "/lms": () => import("@/pages/lms"),
  "/retrospective": () => import("@/pages/retrospective"),
  "/specialty": () => import("@/pages/specialty"),
  "/specialty/cath-lab": () => import("@/pages/specialty/cath-lab"),
  "/specialty/endoscopy": () => import("@/pages/specialty/endoscopy"),
  "/specialty/psychiatry": () => import("@/pages/specialty/psychiatry"),
  "/specialty/pmr": () => import("@/pages/specialty/pmr"),
  "/specialty/palliative": () => import("@/pages/specialty/palliative"),
  "/specialty/maternity": () => import("@/pages/specialty/maternity"),
  "/specialty/other": () => import("@/pages/specialty/other"),
  "/cssd": () => import("@/pages/cssd"),
  "/diet-kitchen": () => import("@/pages/diet-kitchen"),
  "/emergency": () => import("@/pages/emergency"),
  "/blood-bank": () => import("@/pages/blood-bank"),
  "/icu": () => import("@/pages/icu"),
  "/ipd": () => import("@/pages/ipd"),
  "/nurse": () => import("@/pages/nurse-activities"),
  "/bedside-portal": () => import("@/pages/bedside-portal"),
  "/care-view": () => import("@/pages/care-view"),
  "/ot": () => import("@/pages/ot"),
  "/admin/users": () => import("@/pages/admin/users"),
  "/admin/doctors": () => import("@/pages/admin/doctors"),
  "/admin/nabh-indicators": () => import("@/pages/admin/nabh-indicators"),
  "/admin/roles": () => import("@/pages/admin/roles"),
  "/admin/groups": () => import("@/pages/admin/groups"),
  "/admin/access-requests": () => import("@/pages/admin/access-requests"),
  "/admin/settings": () => import("@/pages/admin/settings"),
  "/admin/integration-hub": () => import("@/pages/admin/integration-hub"),
  "/admin/tv-displays": () => import("@/pages/tv-displays"),
  "/admin/doctor-schedules": () => import("@/pages/admin/doctor-schedules"),
  "/admin/documents": () => import("@/pages/documents"),
  "/admin/devices": () => import("@/pages/admin/devices"),
  "/admin/paired-devices": () => import("@/pages/admin/paired-devices"),
};

const routePreloads = new Map<string, Promise<unknown>>();

function routePreloadKey(path: string): string {
  if (path.startsWith("/camp/")) return "/camp";
  if (path.startsWith("/opd/encounters/")) return "/opd";
  if (path.startsWith("/patients/")) return "/patients";
  if (path.startsWith("/indent/")) return "/indent";
  return path;
}

export function preloadRoute(path: string): void {
  const key = routePreloadKey(path);
  const preload = routePreloaders[key];
  if (!preload || routePreloads.has(key)) {
    return;
  }

  const promise = preload().catch(() => {
    routePreloads.delete(key);
  });
  routePreloads.set(key, promise);
}
