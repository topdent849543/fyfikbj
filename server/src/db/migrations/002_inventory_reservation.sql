-- Atomically reserve or release stock during checkout and cancellation.
CREATE OR REPLACE FUNCTION reserve_product_stock(product_uuid UUID, requested_quantity INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE updated_rows INTEGER;
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - requested_quantity, updated_at = NOW()
  WHERE id = product_uuid
    AND is_active = true
    AND is_approved = true
    AND stock_quantity >= requested_quantity;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION release_product_stock(product_uuid UUID, released_quantity INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + released_quantity, updated_at = NOW()
  WHERE id = product_uuid;
END;
$$;
