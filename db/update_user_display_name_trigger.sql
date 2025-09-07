-- Function to update auth.users display_name when profile is created/updated
CREATE OR REPLACE FUNCTION update_auth_user_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the display_name in auth.users table when first_name is set in profiles
  IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN
    UPDATE auth.users 
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
      'display_name', NEW.first_name,
      'first_name', NEW.first_name,
      'full_name', NEW.first_name
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for when profiles are inserted
CREATE OR REPLACE TRIGGER trigger_update_auth_user_display_name_on_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_auth_user_display_name();

-- Create trigger for when profiles are updated
CREATE OR REPLACE TRIGGER trigger_update_auth_user_display_name_on_update
  AFTER UPDATE OF first_name ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_auth_user_display_name(); 