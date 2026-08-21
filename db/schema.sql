-- Belong schema (multi-tenant church membership management)

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_status text not null default 'trialing'
    check (plan_status in ('trialing', 'active', 'pending_review', 'canceled')),
  trial_ends_at timestamptz not null,
  payment_reference text,
  payment_submitted_at timestamptz,
  subscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,               -- e.g. "Adams family"
  address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_households_org on households(organization_id);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('Male', 'Female')),
  marital_status text check (marital_status in ('Single', 'Married', 'Widowed', 'Divorced')),
  phone text,
  email text,
  address text,
  photo_url text,

  membership_status text not null default 'Visitor'
    check (membership_status in ('Visitor', 'New convert', 'Member', 'Inactive')),
  date_joined date,
  baptism_date date,
  occupation text,
  emergency_contact_name text,
  emergency_contact_phone text,

  household_id uuid references households(id) on delete set null,
  is_head_of_household boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_members_org on members(organization_id);
create index if not exists idx_members_household on members(household_id);
create index if not exists idx_members_status on members(membership_status);
create index if not exists idx_members_name on members(full_name);

create table if not exists ministries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,          -- Choir, Ushering, Youth, etc.
  unique (organization_id, name)
);

create index if not exists idx_ministries_org on ministries(organization_id);

create table if not exists member_ministries (
  member_id uuid not null references members(id) on delete cascade,
  ministry_id uuid not null references ministries(id) on delete cascade,
  primary key (member_id, ministry_id)
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  service_date date not null,
  service_type text not null default 'Sunday'  -- Sunday, midweek, special
);

create index if not exists idx_services_org on services(organization_id);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  present boolean not null default true,
  unique (service_id, member_id)
);

create index if not exists idx_attendance_org on attendance(organization_id);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'staff' check (role in ('admin', 'staff', 'leader')),
  created_at timestamptz not null default now()
);

create index if not exists idx_users_org on users(organization_id);

create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
