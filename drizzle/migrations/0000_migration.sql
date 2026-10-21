
-- ENUMS
create type public.app_role as enum ('admin','booking_agent','demo_staff');
create type public.meeting_platform as enum ('zoom','google_meet');
create type public.appointment_status as enum ('scheduled','rescheduled','completed','cancelled','no_show');
create type public.demo_outcome as enum ('interested','follow_up_required','not_interested','sold','lost');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and ur.role = _role and p.is_active)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and p.is_active)
$$;

create policy "staff read profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "admin profile update" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "read own or admin roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "admin insert roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admin update roles" on public.user_roles for update to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "admin delete roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- prevent users from disabling themselves via own-profile policy
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active is distinct from old.is_active and not public.has_role(auth.uid(),'admin') then
    raise exception 'Only admins can change account status';
  end if;
  if new.is_active = false and new.id = auth.uid() then
    raise exception 'You cannot deactivate your own account';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_guard_profile before update on public.profiles for each row execute function public.guard_profile_update();

-- New user: profile; first user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), coalesce(new.email,''));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- CLIENTS
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(business_name) between 1 and 200),
  owner_name text not null check (char_length(owner_name) between 1 and 200),
  phone text not null check (char_length(phone) between 3 and 40),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  country text not null check (char_length(country) between 2 and 100),
  timezone text not null,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_clients_business on public.clients (lower(business_name));
create index idx_clients_created_by on public.clients (created_by);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

create or replace function public.validate_timezone()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid IANA time zone: %', new.timezone;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_clients_tz before insert or update on public.clients for each row execute function public.validate_timezone();

create policy "staff read clients" on public.clients for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin/agent insert clients" on public.clients for insert to authenticated
  with check ((public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'booking_agent')) and created_by = auth.uid());
create policy "admin or creator update clients" on public.clients for update to authenticated
  using (public.has_role(auth.uid(),'admin') or (created_by = auth.uid() and public.has_role(auth.uid(),'booking_agent')));
create policy "admin delete clients" on public.clients for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- APPOINTMENTS
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  local_date date not null,
  local_time time not null,
  timezone text not null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes between 5 and 480),
  platform public.meeting_platform not null,
  meeting_url text not null check (meeting_url ~* '^https?://'),
  demo_website_url text check (demo_website_url is null or demo_website_url ~* '^https?://'),
  demo_staff_id uuid references public.profiles(id) on delete set null,
  booking_agent_id uuid not null references public.profiles(id) on delete restrict,
  status public.appointment_status not null default 'scheduled',
  outcome public.demo_outcome,
  follow_up_date date,
  final_website_url text check (final_website_url is null or final_website_url ~* '^https?://'),
  sale_amount numeric(12,2) check (sale_amount is null or sale_amount >= 0),
  cancellation_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_appt_scheduled on public.appointments (scheduled_at);
create index idx_appt_client on public.appointments (client_id);
create index idx_appt_agent on public.appointments (booking_agent_id);
create index idx_appt_staff on public.appointments (demo_staff_id);
create index idx_appt_status on public.appointments (status);
create index idx_appt_followup on public.appointments (follow_up_date) where follow_up_date is not null;
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;

-- compute UTC from local date/time + IANA zone in the DB (DST-safe), and guard column changes per role
create or replace function public.appointments_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid IANA time zone: %', new.timezone;
  end if;
  new.scheduled_at := (new.local_date + new.local_time) at time zone new.timezone;
  new.updated_at := now();
  if new.outcome = 'sold' and new.sale_amount is null then null; end if;
  if tg_op = 'UPDATE' and uid is not null and not public.has_role(uid,'admin') then
    if public.has_role(uid,'demo_staff') and old.booking_agent_id <> uid then
      if new.client_id <> old.client_id or new.booking_agent_id <> old.booking_agent_id
         or new.demo_staff_id is distinct from old.demo_staff_id or new.is_demo <> old.is_demo then
        raise exception 'Demo staff cannot change client, agent or assignment';
      end if;
    elsif public.has_role(uid,'booking_agent') then
      if new.booking_agent_id <> old.booking_agent_id or new.outcome is distinct from old.outcome
         or new.sale_amount is distinct from old.sale_amount or new.is_demo <> old.is_demo then
        raise exception 'Booking agents cannot change outcomes, sales or ownership';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_appt_before before insert or update on public.appointments for each row execute function public.appointments_before_write();

create policy "read appointments" on public.appointments for select to authenticated using (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'demo_staff') or booking_agent_id = auth.uid());
create policy "insert appointments" on public.appointments for insert to authenticated with check (
  public.has_role(auth.uid(),'admin') or (public.has_role(auth.uid(),'booking_agent') and booking_agent_id = auth.uid()));
create policy "update appointments" on public.appointments for update to authenticated using (
  public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'demo_staff')
  or (public.has_role(auth.uid(),'booking_agent') and booking_agent_id = auth.uid()));
create policy "admin delete appointments" on public.appointments for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- REMARKS (append-only)
create table public.appointment_remarks (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  remark text not null check (char_length(remark) between 1 and 5000),
  requested_changes text check (requested_changes is null or char_length(requested_changes) <= 5000),
  objections text check (objections is null or char_length(objections) <= 5000),
  outcome_at_time public.demo_outcome,
  created_at timestamptz not null default now()
);
create index idx_remarks_appt on public.appointment_remarks (appointment_id, created_at desc);
grant select, insert on public.appointment_remarks to authenticated;
grant all on public.appointment_remarks to service_role;
alter table public.appointment_remarks enable row level security;
create policy "read remarks" on public.appointment_remarks for select to authenticated using (
  exists (select 1 from public.appointments a where a.id = appointment_id));
create policy "insert remarks" on public.appointment_remarks for insert to authenticated with check (
  author_id = auth.uid() and public.is_staff(auth.uid()) and exists (select 1 from public.appointments a where a.id = appointment_id));

-- AUDIT LOG
create table public.audit_logs (
  id bigserial primary key,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_entity on public.audit_logs (entity, entity_id, created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admin read audit" on public.audit_logs for select to authenticated using (
  public.has_role(auth.uid(),'admin')
  or (entity = 'appointment' and exists (select 1 from public.appointments a where a.id = entity_id)));

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs(entity, entity_id, action, actor_id, old_data) values (tg_argv[0], old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs(entity, entity_id, action, actor_id, old_data, new_data) values (tg_argv[0], new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
  else
    insert into public.audit_logs(entity, entity_id, action, actor_id, new_data) values (tg_argv[0], new.id, 'create', auth.uid(), to_jsonb(new));
  end if;
  return new;
end $$;
create trigger trg_audit_appt after insert or update or delete on public.appointments for each row execute function public.audit_trigger('appointment');
create trigger trg_audit_client after insert or update or delete on public.clients for each row execute function public.audit_trigger('client');
create trigger trg_audit_roles after insert or delete on public.user_roles for each row execute function public.audit_trigger('user_role');

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notif_user on public.notifications (user_id, created_at desc);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifications delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

create or replace function public.notify_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
declare biz text; link text := '/appointments/' || new.id;
begin
  if new.is_demo then return new; end if;
  select business_name into biz from public.clients where id = new.client_id;
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, type, title, body, link)
      select ur.user_id, 'new_booking', 'New demo booked', biz || ' — ' || to_char(new.local_date,'Mon DD') || ' ' || to_char(new.local_time,'HH24:MI') || ' (' || new.timezone || ')', link
      from public.user_roles ur where ur.role = 'admin' and ur.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000');
  end if;
  if new.demo_staff_id is not null and (tg_op = 'INSERT' or new.demo_staff_id is distinct from old.demo_staff_id)
     and new.demo_staff_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000') then
    insert into public.notifications(user_id, type, title, body, link)
      values (new.demo_staff_id, 'assignment', 'You were assigned a demo', biz, link);
  end if;
  if tg_op = 'UPDATE' and (new.scheduled_at <> old.scheduled_at or new.status <> old.status) then
    insert into public.notifications(user_id, type, title, body, link)
      select distinct u, 'appointment_update', 'Appointment ' || replace(new.status::text,'_',' '), biz, link
      from unnest(array[new.booking_agent_id, new.demo_staff_id]) u
      where u is not null and u <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000');
  end if;
  return new;
end $$;
create trigger trg_notify_appt after insert or update on public.appointments for each row execute function public.notify_appointment();
