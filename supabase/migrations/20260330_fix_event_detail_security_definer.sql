-- ============================================================
-- Fix: restore SECURITY DEFINER on get_event_detail
--
-- Migration 20260316 re-created get_event_detail WITHOUT
-- SECURITY DEFINER, overwriting the 20260315 version that had it.
-- Without SECURITY DEFINER the function runs as the calling role
-- (anon), which cannot read through RLS on events and related
-- tables — causing "Event Not Found" on every detail screen.
-- ============================================================

ALTER FUNCTION public.get_event_detail(integer, integer)
  SECURITY DEFINER
  SET search_path = public;
