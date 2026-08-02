-- Reemplaza los Features del roadmap indicado por el listado proporcionado
WITH rm AS (
  SELECT id, user_id FROM public.roadmaps WHERE id = 'c930a430-e0ec-4e72-b91f-8499f01e7976'
), del AS (
  DELETE FROM public.roadmap_items WHERE roadmap_id = 'c930a430-e0ec-4e72-b91f-8499f01e7976' AND type = 'feature'
), src(item_uid, item_code, type, title, description, parent_id, effort, priority, quarter, state, notes, tags) AS (
  VALUES
  (gen_random_uuid()::text, '622', 'feature', 'BIO: envio de notificacion push a tablet', NULL, NULL, NULL, '3-Low', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '3169', 'feature', 'AdminSite API: crear estrategia de traducciones para errores de endpoints', NULL, NULL, NULL, '3-Low', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '5737', 'feature', 'EDELIVERY - Comunicaciones fehacientes sin OTP', NULL, NULL, 150, '3-Low', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '7669', 'feature', 'BIO - iOS: Capturar los datos de la biometria con el Pencil de Apple que recoge info en el aire', NULL, NULL, 250, '2-Medium', 'Q3', NULL, NULL, NULL),
  (gen_random_uuid()::text, '9207', 'feature', 'VIDcloud-Remote/Batch: Allow attaching documents - Add to PDF attachments', NULL, NULL, 100, '1-High', 'Q2', NULL, 'Requerido por Qualita para el cliente Planeta', NULL),
  (gen_random_uuid()::text, '9348', 'feature', 'VIDcloud - API v3.0: firmantes opcionales en el documento', NULL, NULL, 100, '1-High', NULL, NULL, 'In progress', NULL),
  (gen_random_uuid()::text, '10530', 'feature', 'VIDcloud: Refactorizacion/Actualizacion generacion plantillas de emal - Similar al refactor de generacion de Reports', NULL, NULL, 320, '2-Medium', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '11007', 'feature', 'BIO: Busquedas en BIO por otros campos & Unificar comportamiento de filtrado y busqueda', NULL, '9206', NULL, '4-Lowest', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '11775', 'feature', 'EDELIVERY: Envio de Reminders Automaticos', NULL, NULL, NULL, '3-Low', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '11776', 'feature', 'EDELIVERY: Renderizacion de pagina On-Demand', NULL, NULL, NULL, '3-Low', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '11955', 'feature', 'AdminSite: Exportar CSV de Consumo Clientes/Canal vista de un Partner', NULL, NULL, 100, '2-Medium', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '12462', 'feature', 'VIDsigner: Pentest sobre la API y Aplicaciones BIO/Remote/Centralized/AdminSite', NULL, NULL, NULL, '2-Medium', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '13640', 'feature', 'VIDsigner: Anadir en el portal de consumo interno el estatus de servicios de proveedores de VIDsigner [HIGH - 2025]', NULL, '13639', 300, '2-Medium', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '14225', 'feature', 'BIO - Cambiar el tipo de autorizacion que usamos en los Devices M2M', NULL, NULL, 50, '2-Medium', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '14226', 'feature', 'REMOTE: Enable Wallet Flow as 2FA via request - Send by POST Document', NULL, NULL, 20, '1-High', 'Q2', NULL, NULL, NULL),
  (gen_random_uuid()::text, '14250', 'feature', 'Centralized - Render: Renderizacion On-Demand of Attachments', NULL, NULL, NULL, '2-Medium', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '14251', 'feature', 'VIDcloud - Approvers Status: Nuevo tipo de notificacion para seguimiento del flujo de Aprobaciones', NULL, '14252', NULL, '2-Medium', NULL, NULL, 'Requerido por Qualita', NULL),
  (gen_random_uuid()::text, '14928', 'feature', 'Remote: Add a wizard to reduce support cases', NULL, NULL, 40, '1-High', 'Q2', NULL, NULL, NULL),
  (gen_random_uuid()::text, '14929', 'feature', 'BIO - Required: Gestionar la logica del parametro Required en los elementos de un formulario', NULL, NULL, 200, '1-High', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '14932', 'feature', 'Centralized: Permitir cambiar el PIN de un Certificado P12 cargado previamente en KeyVault', NULL, NULL, 50, '1-High', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '14935', 'feature', 'VIDcloud: POST Document / Batch indicar "Donwladed" True/False by request (Remote/Centralized)', NULL, NULL, NULL, '3-Low', NULL, NULL, 'Wish', NULL),
  (gen_random_uuid()::text, '14946', 'feature', 'VIDcloud - Redtrust Integration: Improvements for Enroll Process & Sign Process', NULL, NULL, 120, '3-Low', NULL, NULL, '- Token de Redtrust en lugar de pasarlo por la URL, pedimos que se creara un servicio que VIDsigner pudiera consumir, esto lo han incorporado en la propuesta y esperan tenerlo disponible para Febrero2025
- La aplicacion que desarrollen del lado de Redtrust tiene que ser Responsive', NULL),
  (gen_random_uuid()::text, '14955', 'feature', 'VIDcloud - Report: Anadir en el Report los aprobadores como parte de las evidencias', NULL, NULL, 150, '1-High', NULL, NULL, 'Wish', NULL),
  (gen_random_uuid()::text, '14956', 'feature', 'Centralized: Show signers the list of reviewers before signing', NULL, NULL, 150, '1-High', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '14957', 'feature', 'VIDcloud - Status Doc: Notificacion de docstatus solo con URL base - Eliminar de la URL el DocGUID', NULL, '14252', 80, '2-Medium', NULL, NULL, 'Wish', NULL),
  (gen_random_uuid()::text, '15051', 'feature', 'Edelivery: Adjuntar documentos a una notificacion', NULL, NULL, NULL, '3-Low', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '15054', 'feature', 'VIDcloud: Improvements Swisscom Flow - Centralized/Remote', NULL, NULL, NULL, '3-Low', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '15056', 'feature', 'VIDcloud - Reports: Creat UnitTests for TemplateService class - Full coverage', NULL, NULL, NULL, '4-Lowest', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '15057', 'feature', 'FirmaConTuDNI: Anadir Captcha & Mejoras 2025', NULL, NULL, NULL, '4-Lowest', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '15059', 'feature', 'BIO - Android: Distribucion MDM de la APK con XML de configuracion', NULL, NULL, NULL, '4-Lowest', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '15167', 'feature', 'Centralized: Firmaprofesional Firmacloud Integration', NULL, NULL, 50, '2-Medium', 'Q2', NULL, 'Wish', NULL),
  (gen_random_uuid()::text, '15189', 'feature', 'VIDcloud: Start Migration to .NET 9 - API PUB', NULL, '15173', 500, '1-High', 'Q4', NULL, NULL, NULL),
  (gen_random_uuid()::text, '15190', 'feature', 'VIDcloud: Start Migration to .NET 9 - API PRIV', NULL, '15173', 500, '4-Lowest', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '15191', 'feature', 'VIDcloud: Start Migration to .NET 9 - API MNGM', NULL, '15173', 500, '4-Lowest', NULL, NULL, NULL, NULL),
  (gen_random_uuid()::text, '15204', 'feature', 'BIO- Android: Design and UX Review/Update', NULL, '9206', 200, '2-Medium', NULL, NULL, 'Cambiamos de prioridad a LOW priority y lo sacamos de Q3', NULL),
  (gen_random_uuid()::text, '15202', 'feature', 'BIO- iOS: Design and UX Review/Update', NULL, '9206', 200, '2-Medium', NULL, NULL, 'Cambiamos de prioridad a LOW priority y lo sacamos de Q2', NULL),
  (gen_random_uuid()::text, '15203', 'feature', 'BIO- Windows: Design and UX Review/Update', NULL, '9206', 200, '2-Medium', NULL, NULL, 'Cambiamos de prioridad a LOW priority y lo sacamos de Q4', NULL),
  (gen_random_uuid()::text, '16408', 'feature', 'Signaturit - VID: Integration Centralized Signature Flow (Advanced & QF)', NULL, '15711', 300, '1-High', 'Q3', NULL, NULL, NULL),
  (gen_random_uuid()::text, '16409', 'feature', 'Signaturit - VID: Integration BIO Signature Flow', NULL, '15711', 200, '1-High', 'Q3', NULL, NULL, NULL),
  (gen_random_uuid()::text, '16411', 'feature', 'Signaturit - VID: Integracion con UTC', NULL, '15711', 300, '1-High', 'Q4', NULL, NULL, NULL),
  (gen_random_uuid()::text, '16412', 'feature', 'Rebranding aplicaciones frontend - Signaturit Brand', NULL, '15711', 150, '1-High', 'Q3', NULL, NULL, NULL)
)
INSERT INTO public.roadmap_items (user_id, roadmap_id, item_uid, item_code, type, title, description, parent_id, effort, priority, quarter, state, notes, tags, hidden_from_roadmap)
SELECT rm.user_id, rm.id, s.item_uid::text, s.item_code::text, s.type::text, s.title::text, s.description::text, s.parent_id::text, s.effort::numeric, s.priority::text, s.quarter::text, s.state::text, s.notes::text, s.tags::text, false
FROM src s CROSS JOIN rm;