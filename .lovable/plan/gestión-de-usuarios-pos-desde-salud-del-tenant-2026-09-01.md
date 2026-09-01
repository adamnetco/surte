# Gestión de usuarios POS desde Salud del tenant

## Objetivo
Hacer visible y comprensible la administración de accesos de cada tienda desde su propio panel de salud, reutilizando el flujo seguro ya existente y sin cambiar el funcionamiento del POS.

## Cambios de interfaz
- Añadir **Usuarios POS** al menú de la tienda, al checklist de “Estado de la tienda” y a las acciones rápidas.
- Crear la ruta `/superadmin/t/:slug/usuarios`, protegida por el tenant activo.
- Reutilizar la vista actual de miembros, pero presentarla como gestión operativa: correo/nombre, rol POS, sucursales, estado y acciones.
- Permitir desde esa vista:
  - crear una cuenta y asignarla a la tienda;
  - definir o restablecer contraseña;
  - cambiar el rol dentro de esa tienda;
  - desactivar o reactivar el acceso sin borrar el usuario ni su historial.
- Mantener estados de carga con skeletons y una presentación móvil en tarjetas en lugar de una tabla ancha.

## Reglas de acceso
- El superadmin puede gestionar cualquier tienda seleccionada.
- Un owner/admin activo solo puede gestionar usuarios de su propia tienda.
- Solo owner o superadmin puede modificar al owner.
- Los cambios de rol global quedan bloqueados al cliente; la función segura del backend deriva lo necesario desde el rol real de tienda.
- Cada alta, cambio de rol, contraseña, activación o desactivación queda auditado.

## Correcciones de seguridad incluidas
- Eliminar la política que permite a un admin modificar roles globales de usuarios arbitrarios. Los admins administrarán únicamente membresías de su organización mediante el flujo validado del backend.
- Sustituir la lectura abierta de eventos de WhatsApp por seguimiento mediante **token privado e impredecible**.
- Los enlaces nuevos de seguimiento incluirán el token; usuarios autenticados conservarán acceso a sus propios pedidos. Los eventos no expondrán teléfono ni payload sensible en la respuesta pública.

## Implementación técnica
- Extender el adaptador de acceso y la función `tenant-access-manage` con listado seguro, cambio de rol, desactivar y reactivar.
- Incorporar la ruta y navegación tenant-scoped en Superadmin.
- Añadir token de seguimiento a pedidos y una función de lectura segura que valide organización, número y token; retirar la política anónima abierta.
- Actualizar los puntos que generan/consumen enlaces de pedido para transportar el token sin romper los pedidos existentes durante la transición.

## Verificación
- Probar visualmente la ruta de usuarios en escritorio y móvil.
- Confirmar que crear usuario, cambiar rol, definir contraseña y desactivar/reactivar refrescan la lista.
- Verificar que un admin de tienda no pueda operar sobre otra organización ni otorgar roles globales.
- Verificar que un pedido con token válido se consulta y uno sin token o con token incorrecto no expone eventos.
- Revisar build, errores de ejecución y marcar como resueltos los dos hallazgos de seguridad.
