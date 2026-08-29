const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (data: { organization_name: string; admin_name: string; email: string; password: string }) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  forgotPassword: (email: string) =>
    request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  getOrganization: () => request("/organizations/me"),
  submitPayment: (payment_reference: string) =>
    request("/organizations/subscribe", { method: "POST", body: JSON.stringify({ payment_reference }) }),
  rotateIntakeToken: () => request("/organizations/intake/rotate", { method: "POST" }),
  setIntakeEnabled: (enabled: boolean) =>
    request("/organizations/intake/toggle", { method: "POST", body: JSON.stringify({ enabled }) }),

  // Public visitor check-in (no auth required).
  getCheckinInfo: (token: string) => request(`/public/checkin/${token}`),
  submitCheckin: (
    token: string,
    data: {
      full_name: string;
      phone?: string;
      email?: string;
      address?: string;
      first_time?: boolean;
      prayer_request?: string;
    }
  ) => request(`/public/checkin/${token}`, { method: "POST", body: JSON.stringify(data) }),

  // Staff review of visitor check-ins.
  getVisitorCheckins: (status = "new") => request(`/visitor-checkins?status=${status}`),
  convertVisitorCheckin: (id: string) => request(`/visitor-checkins/${id}/convert`, { method: "POST" }),
  dismissVisitorCheckin: (id: string) => request(`/visitor-checkins/${id}/dismiss`, { method: "POST" }),

  // Platform super-admin (cross-tenant subscription management).
  getAdminOrganizations: (status = "") =>
    request(`/admin/organizations${status ? `?status=${status}` : ""}`),
  activateOrg: (id: string, months = 1) =>
    request(`/admin/organizations/${id}/activate`, { method: "POST", body: JSON.stringify({ months }) }),
  extendOrgTrial: (id: string, days: number) =>
    request(`/admin/organizations/${id}/extend-trial`, { method: "POST", body: JSON.stringify({ days }) }),
  cancelOrg: (id: string) => request(`/admin/organizations/${id}/cancel`, { method: "POST" }),

  getMembers: (params: Record<string, string> = {}) =>
    request(`/members?${new URLSearchParams(params)}`),
  getMember: (id: string) => request(`/members/${id}`),
  createMember: (data: any) => request("/members", { method: "POST", body: JSON.stringify(data) }),
  updateMember: (id: string, data: any) => request(`/members/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMember: (id: string) => request(`/members/${id}`, { method: "DELETE" }),
  uploadMemberPhoto: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    const token = getToken();
    const res = await fetch(`${API_URL}/members/${id}/photo`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || "Request failed");
    }
    return res.json();
  },
  importMembers: (rows: any[]) => request("/members/import", { method: "POST", body: JSON.stringify({ rows }) }),

  getHouseholds: () => request("/households"),
  createHousehold: (data: any) => request("/households", { method: "POST", body: JSON.stringify(data) }),
  getHouseholdMembers: (id: string) => request(`/households/${id}/members`),

  getMinistries: () => request("/ministries"),

  getDashboardSummary: () => request("/dashboard/summary"),

  createOrGetService: (service_date: string, service_type = "Sunday") =>
    request("/attendance/services", { method: "POST", body: JSON.stringify({ service_date, service_type }) }),
  getServices: () => request("/attendance/services"),
  getServiceAttendance: (serviceId: string) => request(`/attendance/services/${serviceId}/attendance`),
  checkIn: (serviceId: string, member_id: string, present: boolean) =>
    request(`/attendance/services/${serviceId}/checkin`, { method: "POST", body: JSON.stringify({ member_id, present }) }),
};
