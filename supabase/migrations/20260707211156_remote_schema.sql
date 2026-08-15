SET check_function_bodies = false;
DROP EXTENSION pg_net;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;
CREATE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;
CREATE TABLE public.forgot (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, text text NOT NULL, created_at timestamp with time zone DEFAULT now());
ALTER TABLE public.forgot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forgot ADD CONSTRAINT forgot_pkey PRIMARY KEY (id);
GRANT ALL ON public.forgot TO anon;
GRANT ALL ON public.forgot TO authenticated;
GRANT ALL ON public.forgot TO service_role;
CREATE POLICY only_me ON public.forgot TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text)) WITH CHECK ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text));
CREATE TABLE public.forgot_dev (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, text text NOT NULL, created_at timestamp with time zone DEFAULT now());
COMMENT ON TABLE public.forgot_dev IS 'duplicate of forgot for in dev environment';
ALTER TABLE public.forgot_dev ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forgot_dev ADD CONSTRAINT forgot_dev_pkey PRIMARY KEY (id);
GRANT ALL ON public.forgot_dev TO anon;
GRANT ALL ON public.forgot_dev TO authenticated;
GRANT ALL ON public.forgot_dev TO service_role;
CREATE POLICY only_me ON public.forgot_dev TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text)) WITH CHECK ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text));
CREATE TABLE public.habits_daily (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, habit_date date NOT NULL, protein_shake boolean DEFAULT false, b12 boolean DEFAULT false, magnesium boolean DEFAULT false, calve_exercises boolean DEFAULT false, habit_number bigint, creatine boolean DEFAULT false);
COMMENT ON TABLE public.habits_daily IS 'This is a duplicate of forgot';
ALTER TABLE public.habits_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits_daily ADD CONSTRAINT habits_daily_habit_date_key UNIQUE (habit_date);
ALTER TABLE public.habits_daily ADD CONSTRAINT habits_daily_pkey PRIMARY KEY (id);
GRANT ALL ON public.habits_daily TO anon;
GRANT ALL ON public.habits_daily TO authenticated;
GRANT ALL ON public.habits_daily TO service_role;
CREATE POLICY only_me ON public.habits_daily TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text)) WITH CHECK ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text));
CREATE TABLE public.habits_daily_dev (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, habit_date date NOT NULL, protein_shake boolean DEFAULT false, b12 boolean DEFAULT false, magnesium boolean DEFAULT false, calve_exercises boolean DEFAULT false, habit_number bigint, creatine boolean DEFAULT false);
ALTER TABLE public.habits_daily_dev ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits_daily_dev ADD CONSTRAINT habits_daily_dev_habit_date_key UNIQUE (habit_date);
ALTER TABLE public.habits_daily_dev ADD CONSTRAINT habits_daily_dev_pkey PRIMARY KEY (id);
GRANT ALL ON public.habits_daily_dev TO anon;
GRANT ALL ON public.habits_daily_dev TO authenticated;
GRANT ALL ON public.habits_daily_dev TO service_role;
CREATE POLICY only_me ON public.habits_daily_dev TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text)) WITH CHECK ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text));
CREATE TABLE public.run_stats (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, distance_km numeric(6,2), tempo_seconds integer, rating smallint, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.run_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_stats ADD CONSTRAINT run_stats_pkey PRIMARY KEY (id);
ALTER TABLE public.run_stats ADD CONSTRAINT run_stats_rating_check CHECK (rating IS NULL OR rating >= 1 AND rating <= 10);
GRANT ALL ON public.run_stats TO anon;
GRANT ALL ON public.run_stats TO authenticated;
GRANT ALL ON public.run_stats TO service_role;
CREATE POLICY only_me ON public.run_stats TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text)) WITH CHECK ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text));
CREATE TABLE public.run_stats_dev (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, distance_km numeric(6,2), tempo_seconds integer, rating smallint, created_at timestamp with time zone DEFAULT now() NOT NULL);
ALTER TABLE public.run_stats_dev ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_stats_dev ADD CONSTRAINT run_stats_dev_pkey PRIMARY KEY (id);
ALTER TABLE public.run_stats_dev ADD CONSTRAINT run_stats_rating_check CHECK (rating IS NULL OR rating >= 1 AND rating <= 10);
GRANT ALL ON public.run_stats_dev TO anon;
GRANT ALL ON public.run_stats_dev TO authenticated;
GRANT ALL ON public.run_stats_dev TO service_role;
CREATE POLICY only_me ON public.run_stats_dev TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text)) WITH CHECK ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text));
CREATE TABLE public.weight (id integer GENERATED BY DEFAULT AS IDENTITY NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, weight real);
ALTER TABLE public.weight ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight ADD CONSTRAINT weight_pkey PRIMARY KEY (id);
GRANT ALL ON public.weight TO anon;
GRANT ALL ON public.weight TO authenticated;
GRANT ALL ON public.weight TO service_role;
CREATE POLICY only_me ON public.weight TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text)) WITH CHECK ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text));
CREATE TABLE public.weight_dev (id integer GENERATED BY DEFAULT AS IDENTITY NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, weight double precision);
ALTER TABLE public.weight_dev ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_dev ADD CONSTRAINT weight_dev_pkey PRIMARY KEY (id);
GRANT ALL ON public.weight_dev TO anon;
GRANT ALL ON public.weight_dev TO authenticated;
GRANT ALL ON public.weight_dev TO service_role;
CREATE POLICY only_me ON public.weight_dev TO authenticated USING ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text)) WITH CHECK ((( SELECT (auth.jwt() ->> 'email'::text)) = 'guillaumevandijk@gmail.com'::text));
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable();
