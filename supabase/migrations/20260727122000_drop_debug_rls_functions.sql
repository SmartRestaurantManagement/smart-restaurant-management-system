-- Cleanup: drop the temporary read-only diagnostic functions from
-- 20260727121000 / 20260727121500 used to investigate why RLS wasn't
-- being enforced. Not part of the app.
drop function if exists public.__debug_tables_rls();
drop function if exists public.__debug_all_rls();
