// Client-side profile/company/team storage (localStorage).
// Replace with Lovable Cloud later.

const PROFILE_KEY = "roadgate.profile";
const COMPANY_KEY = "roadgate.company";
const TEAM_KEY = "roadgate.team";
const INTEGRATIONS_KEY = "roadgate.integrations";
const BILLING_KEY = "roadgate.billing";

export type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone: string;
  avatarDataUrl?: string;
};

export type Company = {
  name: string;
  fiscalYearEnd: string;
  billingEmail: string;
  logoDataUrl?: string;
  minPasswordLength: number;
  enterprisePasswordStrength: boolean;
  defaultAuthMethod: "password" | "google" | "sso";
};

export type TeamRole = "collaborator" | "reviewer" | "inactive";
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  invitedAt: string;
};

export type Integration = {
  id: string;
  provider: "harvestr" | "jira" | "slack" | "custom";
  name: string;
  status: "connected" | "pending" | "disabled";
  config?: Record<string, string>;
  createdAt: string;
};

export type Billing = {
  plan: "free" | "starter" | "business" | "enterprise";
  seats: number;
  reviewerSeats: number;
  pricePerYear: number;
  contactName: string;
  contactEmail: string;
  taxId: string;
  address: string;
  cardLast4?: string;
  cardExpires?: string;
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("roadgate:profile"));
}

export const getProfile = (): Profile =>
  read<Profile>(PROFILE_KEY, {
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    phone: "",
  });
export const saveProfile = (p: Profile) => write(PROFILE_KEY, p);

export const getCompany = (): Company =>
  read<Company>(COMPANY_KEY, {
    name: "",
    fiscalYearEnd: "December 31st",
    billingEmail: "",
    minPasswordLength: 6,
    enterprisePasswordStrength: false,
    defaultAuthMethod: "password",
  });
export const saveCompany = (c: Company) => write(COMPANY_KEY, c);

export const getTeam = (): TeamMember[] => read<TeamMember[]>(TEAM_KEY, []);
export const saveTeam = (t: TeamMember[]) => write(TEAM_KEY, t);

export const getIntegrations = (): Integration[] =>
  read<Integration[]>(INTEGRATIONS_KEY, []);
export const saveIntegrations = (i: Integration[]) => write(INTEGRATIONS_KEY, i);

export const getBilling = (): Billing =>
  read<Billing>(BILLING_KEY, {
    plan: "free",
    seats: 1,
    reviewerSeats: 0,
    pricePerYear: 0,
    contactName: "",
    contactEmail: "",
    taxId: "",
    address: "",
  });
export const saveBilling = (b: Billing) => write(BILLING_KEY, b);
