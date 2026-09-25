CREATE OR REPLACE FUNCTION consume_discount_for_user(discount_uuid UUID, customer_uuid UUID, parent_order_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE allowed_user_uses INTEGER;
DECLARE uses_by_customer INTEGER;
DECLARE updated_rows INTEGER;
BEGIN
  SELECT max_user_uses INTO allowed_user_uses FROM discount_codes WHERE id = discount_uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT COUNT(*) INTO uses_by_customer FROM discount_usage WHERE discount_id = discount_uuid AND user_id = customer_uuid;
  IF allowed_user_uses IS NOT NULL AND uses_by_customer >= allowed_user_uses THEN RETURN FALSE; END IF;
  UPDATE discount_codes SET current_uses = current_uses + 1
  WHERE id = discount_uuid AND is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses);
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN RETURN FALSE; END IF;
  INSERT INTO discount_usage (discount_id, user_id, order_id) VALUES (discount_uuid, customer_uuid, parent_order_uuid);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION release_discount_use(discount_uuid UUID, parent_order_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM discount_usage WHERE discount_id = discount_uuid AND order_id = parent_order_uuid;
  UPDATE discount_codes SET current_uses = GREATEST(current_uses - 1, 0) WHERE id = discount_uuid;
END;
$$;
