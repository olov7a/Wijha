-- Phase C / 02: atomic unit creation with rooms and beds.
--
-- The owner form used to be a local-state mock. Doing the three inserts from the
-- client would leave a half-created unit when a room or bed fails, so the whole
-- inventory is created in one SECURITY DEFINER call.
--
-- Request shape (owned by features/owner/schemas.ts):
--   p_rooms = [
--     { "name": "Room A", "beds": [{ "label": "Bed 1", "price_piastres": 280000 }] }
--   ]

create function public.create_unit(
  p_title text,
  p_area text,
  p_gender public.gender_type,
  p_description text,
  p_amenities text[],
  p_rooms jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_unit_id uuid;
  v_room record;
  v_bed record;
  v_room_id uuid;
  v_room_count integer;
  v_bed_count integer;
begin
  if v_owner_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select private.has_role('owner'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 3 and 120 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if p_area is null or char_length(btrim(p_area)) not between 2 and 120 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if p_description is not null and char_length(p_description) > 3000 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_amenities), 0) > 30 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if p_rooms is null
     or jsonb_typeof(p_rooms) <> 'array'
     or jsonb_array_length(p_rooms) not between 1 and 20 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  insert into public.units (
    owner_id, title, area, gender_type, status, description, amenities
  )
  values (
    v_owner_id,
    btrim(p_title),
    btrim(p_area),
    p_gender,
    'pending',
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(p_amenities, '{}'::text[])
  )
  returning id into v_unit_id;

  for v_room in
    select *
    from jsonb_to_recordset(p_rooms) as room(name text, beds jsonb)
  loop
    if v_room.name is null
       or char_length(btrim(v_room.name)) not between 1 and 60 then
      raise exception 'INVALID_INPUT' using errcode = '22023';
    end if;

    if v_room.beds is null
       or jsonb_typeof(v_room.beds) <> 'array'
       or jsonb_array_length(v_room.beds) not between 1 and 12 then
      raise exception 'INVALID_INPUT' using errcode = '22023';
    end if;

    insert into public.rooms (unit_id, name)
    values (v_unit_id, btrim(v_room.name))
    returning id into v_room_id;

    for v_bed in
      select *
      from jsonb_to_recordset(v_room.beds) as bed(label text, price_piastres integer)
    loop
      if v_bed.label is null
         or char_length(btrim(v_bed.label)) not between 1 and 40 then
        raise exception 'INVALID_INPUT' using errcode = '22023';
      end if;

      if v_bed.price_piastres is null
         or v_bed.price_piastres not between 100 and 100000000 then
        raise exception 'INVALID_INPUT' using errcode = '22023';
      end if;

      insert into public.beds (room_id, label, price_piastres)
      values (v_room_id, btrim(v_bed.label), v_bed.price_piastres);
    end loop;
  end loop;

  select count(*)::integer into v_room_count
  from public.rooms
  where unit_id = v_unit_id;

  select count(*)::integer into v_bed_count
  from public.beds as b
  join public.rooms as r on r.id = b.room_id
  where r.unit_id = v_unit_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_owner_id,
    'unit.created',
    'unit',
    v_unit_id,
    jsonb_build_object('rooms', v_room_count, 'beds', v_bed_count)
  );

  return v_unit_id;
end;
$$;

revoke all on function public.create_unit(text, text, public.gender_type, text, text[], jsonb)
from public, anon, authenticated;
grant execute on function public.create_unit(text, text, public.gender_type, text, text[], jsonb)
to authenticated, service_role;
