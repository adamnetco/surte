-- Bootstrap policies so a freshly created tenant user can create their own organization
-- during Onboarding (fixes "No pudimos crear tu organización").

-- 1) Allow any authenticated user to create an organization (they become its owner via the next insert).
CREATE POLICY "authenticated can bootstrap org"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 2) Allow a user to register themselves as the 'owner' member of an organization
--    when no member exists yet for that organization (true bootstrap, prevents takeover).
CREATE POLICY "user can self-register as owner of empty org"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_members.organization_id
  )
);
