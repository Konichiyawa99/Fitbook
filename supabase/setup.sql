-- Run once in the Supabase SQL editor.
-- Keeps the existing tbl_* schema and links it to Supabase Auth.

ALTER TABLE public.tbl_member
  ADD COLUMN IF NOT EXISTS height text,
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.tbl_trainer
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.tbl_payment
  ADD COLUMN IF NOT EXISTS receipt_url text;

CREATE TABLE IF NOT EXISTS public.tbl_announcement (
  announcementid serial PRIMARY KEY,
  title varchar(150),
  message text NOT NULL,
  isactive boolean NOT NULL DEFAULT true,
  createdat timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tbl_dashboard_config (
  configid integer PRIMARY KEY CHECK (configid = 1),
  payment_qr_url text,
  payment_method varchar(50),
  payment_reference_hint text,
  payment_amount numeric(10,2),
  countries jsonb NOT NULL DEFAULT '[]'::jsonb
);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.tbl_user, public.tbl_member, public.tbl_booking,
  public.tbl_payment, public.tbl_progress, public.tbl_memberattendance,
  public.tbl_schedule, public.tbl_classes, public.tbl_trainer, public.tbl_employee,
  public.tbl_announcement, public.tbl_dashboard_config
  TO authenticated;
GRANT INSERT, UPDATE ON public.tbl_user, public.tbl_member TO authenticated;
GRANT INSERT ON public.tbl_payment TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER TABLE public.tbl_user
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tbl_user_auth_user_fk'
      AND conrelid = 'public.tbl_user'::regclass
  ) THEN
    ALTER TABLE public.tbl_user
      ADD CONSTRAINT tbl_user_auth_user_fk
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.tbl_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_booking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_memberattendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_trainer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_announcement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbl_dashboard_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own app user" ON public.tbl_user;
CREATE POLICY "Users can read their own app user"
ON public.tbl_user FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can link their own app user" ON public.tbl_user;
CREATE POLICY "Users can link their own app user"
ON public.tbl_user FOR UPDATE TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own app user" ON public.tbl_user;
CREATE POLICY "Users can create their own app user"
ON public.tbl_user FOR INSERT TO authenticated
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Members can read their own member row" ON public.tbl_member;
CREATE POLICY "Members can read their own member row"
ON public.tbl_member FOR SELECT TO authenticated
USING (
  userid IN (
    SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can create their own member row" ON public.tbl_member;
CREATE POLICY "Members can create their own member row"
ON public.tbl_member FOR INSERT TO authenticated
WITH CHECK (
  userid IN (
    SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can update their own member row" ON public.tbl_member;
CREATE POLICY "Members can update their own member row"
ON public.tbl_member FOR UPDATE TO authenticated
USING (
  userid IN (
    SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  userid IN (
    SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can read their own bookings" ON public.tbl_booking;
CREATE POLICY "Members can read their own bookings"
ON public.tbl_booking FOR SELECT TO authenticated
USING (
  memberid IN (
    SELECT memberid FROM public.tbl_member
    WHERE userid IN (
      SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Members can read their own payments" ON public.tbl_payment;
CREATE POLICY "Members can read their own payments"
ON public.tbl_payment FOR SELECT TO authenticated
USING (
  memberid IN (
    SELECT memberid FROM public.tbl_member
    WHERE userid IN (
      SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Members can submit their own payments" ON public.tbl_payment;
CREATE POLICY "Members can submit their own payments"
ON public.tbl_payment FOR INSERT TO authenticated
WITH CHECK (
  memberid IN (
    SELECT memberid FROM public.tbl_member
    WHERE userid IN (
      SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
    )
  )
  AND paymentstatus = 'pending'
);

DROP POLICY IF EXISTS "Members can read their own progress" ON public.tbl_progress;
CREATE POLICY "Members can read their own progress"
ON public.tbl_progress FOR SELECT TO authenticated
USING (
  memberid IN (
    SELECT memberid FROM public.tbl_member
    WHERE userid IN (
      SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Members can read their own attendance" ON public.tbl_memberattendance;
CREATE POLICY "Members can read their own attendance"
ON public.tbl_memberattendance FOR SELECT TO authenticated
USING (
  memberid IN (
    SELECT memberid FROM public.tbl_member
    WHERE userid IN (
      SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can read classes" ON public.tbl_classes;
CREATE POLICY "Authenticated users can read classes"
ON public.tbl_classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read schedules" ON public.tbl_schedule;
CREATE POLICY "Authenticated users can read schedules"
ON public.tbl_schedule FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read trainers" ON public.tbl_trainer;
CREATE POLICY "Authenticated users can read trainers"
ON public.tbl_trainer FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read employees" ON public.tbl_employee;
CREATE POLICY "Authenticated users can read employees"
ON public.tbl_employee FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read announcements" ON public.tbl_announcement;
CREATE POLICY "Authenticated users can read announcements"
ON public.tbl_announcement FOR SELECT TO authenticated
USING (isactive = true);

DROP POLICY IF EXISTS "Authenticated users can read dashboard config" ON public.tbl_dashboard_config;
CREATE POLICY "Authenticated users can read dashboard config"
ON public.tbl_dashboard_config FOR SELECT TO authenticated
USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members can upload their own payment receipts" ON storage.objects;
CREATE POLICY "Members can upload their own payment receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Members can read their own payment receipts" ON storage.objects;
CREATE POLICY "Members can read their own payment receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "Members can delete their own payment receipts" ON storage.objects;
CREATE POLICY "Members can delete their own payment receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
