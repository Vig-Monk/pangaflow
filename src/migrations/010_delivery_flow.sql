-- =============================================================================
-- Migration: 010_delivery_flow.sql
-- Soko Platform — Checkout & Delivery Flow Schema
-- =============================================================================
-- Extends order lifecycle, adds location capture metadata, creates audit trails,
-- sets up merchant fulfillment points, and seeds curated East African estates.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend Status and Add Delivery Columns to `orders`
-- ---------------------------------------------------------------------------

-- Update status check constraint to support the full delivery progression
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
CHECK (status IN ('pending', 'confirmed', 'assigned', 'out_for_delivery', 'delivered', 'cancelled'));

-- Add delivery metadata, location coordinates, rider tracking, and verification columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'delivery'
CHECK (delivery_type IN ('delivery', 'pickup')),
ADD COLUMN IF NOT EXISTS customer_lat NUMERIC(9,6),
ADD COLUMN IF NOT EXISTS customer_lng NUMERIC(9,6),
ADD COLUMN IF NOT EXISTS location_source TEXT
CHECK (location_source IN ('gps', 'local_list', 'nominatim', 'manual_text')),
ADD COLUMN IF NOT EXISTS location_accuracy_m NUMERIC,
ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rider_name TEXT,
ADD COLUMN IF NOT EXISTS rider_phone TEXT,
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS delivery_fee_status TEXT NOT NULL DEFAULT 'known'
CHECK (delivery_fee_status IN ('known', 'needs_merchant_confirmation')),
ADD COLUMN IF NOT EXISTS delivery_confirmation_code TEXT,
ADD COLUMN IF NOT EXISTS amount_collected NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS collected_by TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. Order Status History (Audit Trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS order_status_history (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	status TEXT NOT NULL,
	changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	changed_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Merchant Locations (Fulfillment / Pickup Base)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS merchant_locations (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
	name TEXT NOT NULL DEFAULT 'Main Store / Hub',
	lat NUMERIC(9,6) NOT NULL,
	lng NUMERIC(9,6) NOT NULL,
	address_text TEXT,
	max_delivery_radius_km NUMERIC(5,2) NOT NULL DEFAULT 15.00,
	base_delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 100.00,
	fee_per_km NUMERIC(12,2) NOT NULL DEFAULT 25.00,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_locations_org_id ON merchant_locations(org_id);

DROP TRIGGER IF EXISTS trg_merchant_locations_updated_at ON merchant_locations;
CREATE TRIGGER trg_merchant_locations_updated_at
BEFORE UPDATE ON merchant_locations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Reference Estates & Localities (Zero-Cost Local Geocoding Table)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estates (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL UNIQUE,
	city TEXT NOT NULL DEFAULT 'Nairobi',
	lat NUMERIC(9,6) NOT NULL,
	lng NUMERIC(9,6) NOT NULL,
	area_alias TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_estates_name ON estates(name);
CREATE INDEX IF NOT EXISTS idx_estates_area_alias ON estates USING GIN(area_alias);

-- ---------------------------------------------------------------------------
-- 5. Seed Curated East African Estates & Localities
-- ---------------------------------------------------------------------------

INSERT INTO estates (name, city, lat, lng, area_alias) VALUES
('Westlands', 'Nairobi', -1.268300, 36.811100, ARRAY['westy', 'sarit', 'parklands', 'mpesa house', 'westgate']),
('Kilimani', 'Nairobi', -1.290800, 36.782800, ARRAY['yaya', 'argwings', 'hurlingham', 'chaka']),
('South B', 'Nairobi', -1.312500, 36.837200, ARRAY['mariakani', 'plainsview', 'golden gate', 'kapiti']),
('South C', 'Nairobi', -1.321700, 36.828600, ARRAY['muhoho', 'bellevue', 'five star', 'mugoya']),
('Umoja', 'Nairobi', -1.285800, 36.897800, ARRAY['umoja 1', 'umoja 2', 'innercore', 'tennison', 'pefa']),
('Kasarani', 'Nairobi', -1.222500, 36.903300, ARRAY['sportsview', 'clay city', 'seasons', 'hunters', 'sunton']),
('Donholm', 'Nairobi', -1.299400, 36.885800, ARRAY['donny', 'greenfields', 'harambee', 'phase 8', 'old donholm']),
('Kayole', 'Nairobi', -1.278300, 36.918300, ARRAY['junction', 'masimba', 'pine breeze', 'soweto', 'spine road']),
('Ongata Rongai', 'Nairobi', -1.396700, 36.757800, ARRAY['rongai', 'kiserian', 'maasai lodge', 'tuskys rongai']),
('Eastleigh', 'Nairobi', -1.276400, 36.848900, ARRAY['first avenue', 'section 3', 'garissa lodge', 'twelfth street']),
('Ruaraka', 'Nairobi', -1.248300, 36.873100, ARRAY['babadogo', 'baba dogo', 'ngumba', 'outer ring', 'drive-in']),
('Karen', 'Nairobi', -1.323600, 36.705600, ARRAY['the hub', 'hardy', 'bogani', 'karen crossroads']),
('Ngara', 'Nairobi', -1.275000, 36.825000, ARRAY['fig tree', 'parkroad', 'desai', 'stima club']),
('Kahawa West', 'Nairobi', -1.183900, 36.895300, ARRAY['kongo', 'kamiti', 'jacaranda', 'farmer']),
('Githurai 44', 'Nairobi', -1.205600, 36.897200, ARRAY['44', 'kamiti rd', 'githurai']),
('Langata', 'Nairobi', -1.353200, 36.772500, ARRAY['carnivore', 'dam estate', 'nhc langata', 'sunvalley', 'uhuru gardens']),
('Parklands', 'Nairobi', -1.261200, 36.816700, ARRAY['limuru road', 'aga khan', '3rd parklands', 'diamond plaza']),
('Roysambu', 'Nairobi', -1.218600, 36.887500, ARRAY['thika road mall', 'trm', 'lumumba', 'mirema']),
('Buruburu', 'Nairobi', -1.288900, 36.877800, ARRAY['buru', 'phase 1', 'phase 2', 'phase 3', 'phase 4', 'phase 5', 'mesora']),
('Fedha', 'Nairobi', -1.318300, 36.903900, ARRAY['fedha estate', 'telaviv', 'gate b']),
('Embakasi', 'Nairobi', -1.311700, 36.917200, ARRAY['pipeline', 'nyayo estate', 'taj mall', 'tassia']),
('Ruaka', 'Nairobi', -1.206900, 36.775800, ARRAY['two rivers', 'rosslyn', 'limuru rd ruaka']),
('Madaraka', 'Nairobi', -1.306100, 36.817200, ARRAY['strathmore', 'aerodrome', 'madaraka estate']),
('Pangani', 'Nairobi', -1.269400, 36.838900, ARRAY['pangani girls', 'thika rd pangani']),
('Kileleshwa', 'Nairobi', -1.280000, 36.788900, ARRAY['kandara', 'siaya', 'omero', 'mandera road']),
('Lavington', 'Nairobi', -1.283300, 36.766700, ARRAY['lavington mall', 'james gichuru', 'valley arcade']),
('Upper Hill', 'Nairobi', -1.299400, 36.817200, ARRAY['elgon road', 'britam tower', 'hospital road', 'knh']),
('Nairobi CBD', 'Nairobi', -1.286400, 36.817200, ARRAY['town', 'city centre', 'moi avenue', 'kenyatta avenue', 'tom mboya']),
('Adams Arcade', 'Nairobi', -1.300600, 36.786100, ARRAY['ngong road adams', 'elgeyo marakwet', 'adams']),
('Garden Estate', 'Nairobi', -1.233300, 36.866700, ARRAY['garden city', 'roasters', 'mountain mall'])
ON CONFLICT (name) DO NOTHING;