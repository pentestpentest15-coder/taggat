-- Add machine_ip column to labs (for direct IP address option alongside machine_url)
ALTER TABLE labs ADD COLUMN IF NOT EXISTS machine_ip text;

-- Add connection_type column to labs: 'url' or 'ip'
ALTER TABLE labs ADD COLUMN IF NOT EXISTS connection_type text DEFAULT 'url';
