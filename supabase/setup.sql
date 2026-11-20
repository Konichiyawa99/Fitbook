-- Run once in the Supabase SQL editor.
-- Keeps the existing tbl_* schema and links it to Supabase Auth.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.tbl_user, public.tbl_member, public.tbl_booking,
  public.tbl_payment, public.tbl_progress, public.tbl_memberattendance,
  public.tbl_schedule, public.tbl_classes, public.tbl_trainer, public.tbl_employee
  TO authenticated;
GRANT INSERT, UPDATE ON public.tbl_user, public.tbl_member TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER TABLE public.tbl_user
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

ALTER TABLE public.tbl_user
  ADD CONSTRAINT tbl_user_auth_user_fk
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;

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

CREATE POLICY "Users can read their own app user"
ON public.tbl_user FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can link their own app user"
ON public.tbl_user FOR UPDATE TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can create their own app user"
ON public.tbl_user FOR INSERT TO authenticated
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Members can read their own member row"
ON public.tbl_member FOR SELECT TO authenticated
USING (
  userid IN (
    SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Members can create their own member row"
ON public.tbl_member FOR INSERT TO authenticated
WITH CHECK (
  userid IN (
    SELECT userid FROM public.tbl_user WHERE auth_user_id = auth.uid()
  )
);

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

CREATE POLICY "Authenticated users can read classes"
ON public.tbl_classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read schedules"
ON public.tbl_schedule FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read trainers"
ON public.tbl_trainer FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read employees"
ON public.tbl_employee FOR SELECT TO authenticated USING (true);
