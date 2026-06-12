-- LoviBeauty — migration 006: make email optional in create_booking
--
-- Apply: paste in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run (create or replace).
--
-- Guests now book with just name + phone. Email is still stored when the
-- caller has it (logged-in users), and stays the preferred customer-matching
-- key. Without email we match the customer by phone, else create a new row
-- with a null email (customers.email is nullable + unique, multiple NULLs OK).
-- bookings_contact_present stays satisfied because customer_id is always set.

create or replace function public.create_booking(
  p_service_option_id bigint,
  p_booking_date      date,
  p_start_time        time,
  p_full_name         text,
  p_email             text,
  p_phone             text,
  p_payment_method    public.payment_method default 'transfer',
  p_notes             text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email       text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_full_name   text := trim(p_full_name);
  v_phone       text := nullif(trim(coalesce(p_phone, '')), '');
  v_duration    int;
  v_end_time    time;
  v_dow         smallint;
  v_open        time;
  v_close       time;
  v_closed      boolean;
  v_conflict    int;
  v_customer_id uuid;
  v_booking_id  uuid;
begin
  -- Basic input validation
  if v_full_name is null or length(v_full_name) = 0 then
    raise exception 'full_name is required' using errcode = '22023';
  end if;
  if v_email is not null and position('@' in v_email) = 0 then
    raise exception 'valid email is required' using errcode = '22023';
  end if;
  if v_email is null and (v_phone is null or length(v_phone) < 8) then
    raise exception 'phone is required' using errcode = '22023';
  end if;

  -- Lookup duration
  select duration_minutes into v_duration
    from public.service_options
   where id = p_service_option_id and active;
  if v_duration is null then
    raise exception 'service option % not available', p_service_option_id
      using errcode = '22023';
  end if;
  v_end_time := p_start_time + make_interval(mins => v_duration);

  -- Business hours
  v_dow := extract(dow from p_booking_date)::smallint;
  select open_time, close_time, is_closed
    into v_open, v_close, v_closed
    from public.business_hours
   where day_of_week = v_dow;
  if not found or v_closed or v_open is null then
    raise exception 'studio is closed on this day' using errcode = '22023';
  end if;
  if p_start_time < v_open or v_end_time > v_close then
    raise exception 'requested time is outside business hours'
      using errcode = '22023';
  end if;

  -- Serialize concurrent inserts on the same date so two clients can't take
  -- the same slot. xact-scoped, released at commit.
  perform pg_advisory_xact_lock(
    hashtext('booking:' || p_booking_date::text)
  );

  -- Lazy expiry: flip stale pending_payment for this date to 'expired'.
  update public.bookings
     set status = 'expired'
   where booking_date = p_booking_date
     and status = 'pending_payment'
     and held_at <= now() - public.hold_window();

  -- Conflict against active bookings (confirmed or pending_payment within hold).
  select count(*) into v_conflict
    from public.bookings
   where booking_date = p_booking_date
     and status in ('confirmed', 'pending_payment')
     and (start_time, end_time) overlaps (p_start_time, v_end_time);
  if v_conflict > 0 then
    raise exception 'slot already taken' using errcode = '23505';
  end if;

  -- Conflict against admin-defined blocks.
  select count(*) into v_conflict
    from public.blocked_slots
   where blocked_date = p_booking_date
     and (start_time, end_time) overlaps (p_start_time, v_end_time);
  if v_conflict > 0 then
    raise exception 'slot blocked' using errcode = '23505';
  end if;

  -- Upsert customer: by email when we have it, else by phone.
  if v_email is not null then
    select id into v_customer_id from public.customers where email = v_email;
  else
    select id into v_customer_id
      from public.customers
     where phone = v_phone
     order by created_at desc
     limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers (full_name, email, phone)
    values (v_full_name, v_email, v_phone)
    returning id into v_customer_id;
  else
    update public.customers
       set full_name = v_full_name,
           phone     = coalesce(v_phone, phone),
           email     = coalesce(email, v_email)
     where id = v_customer_id;
  end if;

  -- Insert booking.
  insert into public.bookings (
    customer_id, service_option_id,
    booking_date, start_time, end_time,
    status, payment_method, payment_status, held_at,
    guest_name, guest_email, guest_phone, notes
  ) values (
    v_customer_id, p_service_option_id,
    p_booking_date, p_start_time, v_end_time,
    'pending_payment', p_payment_method, 'pending', now(),
    v_full_name, v_email, v_phone, p_notes
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- create or replace keeps existing grants, but re-assert them for clarity.
revoke all on function public.create_booking(
  bigint, date, time, text, text, text, public.payment_method, text
) from public;
grant execute on function public.create_booking(
  bigint, date, time, text, text, text, public.payment_method, text
) to anon, authenticated;
