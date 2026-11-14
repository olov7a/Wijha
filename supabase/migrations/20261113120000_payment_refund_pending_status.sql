-- Cancellation/refund policy, step 1/2: new payment state.
--
-- A refund is a money movement. With manual payments (no gateway yet), the
-- system must not mark money as returned before an admin actually sends it.
-- `refund_pending` means "the policy says this must be refunded, waiting for
-- the admin to execute the transfer". The next migration uses the value.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_status'
      and e.enumlabel = 'refund_pending'
  ) then
    alter type public.payment_status add value 'refund_pending';
  end if;
end
$$;
