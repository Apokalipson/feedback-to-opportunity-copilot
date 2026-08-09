-- Supabase creates this SECURITY DEFINER function when automatic RLS is
-- enabled for new public tables. The event trigger can continue to call the
-- function, but API roles must not be able to invoke it through Data API RPC.
revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;
