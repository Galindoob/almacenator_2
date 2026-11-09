INSERT INTO permiso (id) VALUES ('productos_editar'), ('permisos_cambiar') ON CONFLICT (id) DO NOTHING;
INSERT INTO rol_permiso (id_rol, id_permiso, habilitado)
SELECT r.id, p.id, lower(r.role) = 'master' FROM role r CROSS JOIN permiso p
WHERE p.id IN ('productos_editar', 'permisos_cambiar')
ON CONFLICT (id_rol, id_permiso) DO NOTHING;
