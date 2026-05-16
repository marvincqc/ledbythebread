-- Seed default cut-off hours (idempotent — won't overwrite if already set)
INSERT INTO admin_settings (key, value) VALUES
  ('morning_cutoff_hour', '17'),
  ('evening_cutoff_hour', '11')
ON CONFLICT (key) DO NOTHING;

-- Update get_slot_cutoff to read hours from admin_settings
-- so any direct RPC callers also respect the configured times.
CREATE OR REPLACE FUNCTION get_slot_cutoff(
  p_delivery_date    date,
  p_slot_type        text,
  p_cut_off_override timestamptz DEFAULT NULL
) RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_morning_hour int;
  v_evening_hour int;
BEGIN
  IF p_cut_off_override IS NOT NULL THEN
    RETURN p_cut_off_override;
  END IF;

  SELECT COALESCE(value::int, 17) INTO v_morning_hour
    FROM admin_settings WHERE key = 'morning_cutoff_hour';
  SELECT COALESCE(value::int, 11) INTO v_evening_hour
    FROM admin_settings WHERE key = 'evening_cutoff_hour';

  v_morning_hour := COALESCE(v_morning_hour, 17);
  v_evening_hour := COALESCE(v_evening_hour, 11);

  IF p_slot_type = 'morning' THEN
    -- Previous day at morning_cutoff_hour SGT (UTC+8)
    RETURN ((p_delivery_date - INTERVAL '1 day')::date)::timestamp
           + make_interval(hours => v_morning_hour - 8);
  ELSE
    -- Same day at evening_cutoff_hour SGT
    RETURN (p_delivery_date::date)::timestamp
           + make_interval(hours => v_evening_hour - 8);
  END IF;
END;
$$;
