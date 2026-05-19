DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_role_id UUID;
  v_perms JSONB := '["domains:read","domains:write","domains:delete","dns:read","dns:write","mail:read","mail:write","files:read","files:write","db:read","db:write","backup:read","backup:write","backup:restore","security:read","security:write","monitoring:read","monitoring:write","billing:read","billing:write","devops:read","devops:write","docker:read","docker:write","ai:use","marketplace:read","marketplace:install","admin:users","admin:servers"]';
BEGIN
  FOR v_user_id, v_org_id IN SELECT id, organization_id FROM users LOOP
    INSERT INTO roles (id, organization_id, name, is_system, permissions)
    VALUES (gen_random_uuid(), v_org_id, 'admin', true, v_perms)
    ON CONFLICT (organization_id, name) DO UPDATE SET permissions = EXCLUDED.permissions
    RETURNING id INTO v_role_id;

    IF v_role_id IS NULL THEN
      SELECT id INTO v_role_id FROM roles WHERE organization_id = v_org_id AND name = 'admin';
    END IF;

    INSERT INTO user_roles (user_id, role_id) VALUES (v_user_id, v_role_id) ON CONFLICT DO NOTHING;
    UPDATE users SET status = 'active' WHERE id = v_user_id;
    RAISE NOTICE 'Fixed user %', v_user_id;
  END LOOP;
END;
$$;
