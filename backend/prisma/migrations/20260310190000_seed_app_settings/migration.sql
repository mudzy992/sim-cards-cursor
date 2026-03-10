INSERT IGNORE INTO `app_settings` (`id`, `key`, `value`, `description`, `created_at`, `updated_at`)
VALUES
  (UUID(), 'notifications.enabled', 'true', 'Globalno uključivanje/isključivanje notifikacija (web + mobile).', NOW(3), NOW(3)),
  (UUID(), 'notifications.websocket.enabled', 'true', 'Da li je WebSocket kanal za notifikacije aktivan.', NOW(3), NOW(3)),
  (UUID(), 'notifications.pollingIntervalSeconds', '30', 'Fallback interval za REST polling notifikacija u sekundama.', NOW(3), NOW(3)),
  (UUID(), 'notifications.showBadgeCount', 'true', 'Prikaz badge broja nepročitanih notifikacija.', NOW(3), NOW(3)),
  (UUID(), 'notifications.mobile.enabled', 'true', 'Uključivanje notifikacija na mobilnoj aplikaciji.', NOW(3), NOW(3)),
  (UUID(), 'notifications.mobile.pushEnabled', 'true', 'Uključivanje push notifikacija na mobilnoj aplikaciji.', NOW(3), NOW(3)),

  (UUID(), 'email.enabled', 'true', 'Globalno uključivanje/isključivanje slanja emailova.', NOW(3), NOW(3)),
  (UUID(), 'email.fromName', 'SIM Tracker', 'Naziv pošiljaoca u emailovima.', NOW(3), NOW(3)),
  (UUID(), 'email.fromAddress', 'no-reply@example.com', 'Email adresa pošiljaoca.', NOW(3), NOW(3)),
  (UUID(), 'email.replyTo', '', 'Opcionalni reply-to email.', NOW(3), NOW(3)),
  (UUID(), 'email.sendOnApprove', 'false', 'Automatsko slanje emaila pri odobravanju zapisnika.', NOW(3), NOW(3)),
  (UUID(), 'email.sendOnActivateSep', 'false', 'Automatsko slanje emaila pri aktivaciji u SEP.', NOW(3), NOW(3)),

  (UUID(), 'installationRecords.autoSubmitForApproval', 'false', 'Automatsko slanje zapisnika na odobrenje nakon kreiranja.', NOW(3), NOW(3)),
  (UUID(), 'installationRecords.allowSelfApproval', 'true', 'Da li kreator zapisnika može odobravati ako je u approval grupi.', NOW(3), NOW(3)),
  (UUID(), 'installationRecords.maxPhotosPerRecord', '5', 'Maksimalan broj fotografija po zapisniku.', NOW(3), NOW(3)),
  (UUID(), 'installationRecords.requirePhotoForApproval', 'false', 'Da li je fotografija obavezna za odobrenje zapisnika.', NOW(3), NOW(3)),

  (UUID(), 'uploads.maxPhotoSizeMb', '5', 'Maksimalna veličina fotografije u MB.', NOW(3), NOW(3)),
  (UUID(), 'uploads.allowedPhotoMimeTypes', 'image/jpeg,image/png', 'Dozvoljeni MIME tipovi za fotografije.', NOW(3), NOW(3)),
  (UUID(), 'uploads.maxDocumentSizeMb', '10', 'Maksimalna veličina dokumenta u MB.', NOW(3), NOW(3)),
  (UUID(), 'uploads.allowedDocumentMimeTypes', 'application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Dozvoljeni MIME tipovi za dokumente.', NOW(3), NOW(3)),

  (UUID(), 'security.rateLimit.enabled', 'true', 'Uključivanje globalnog rate limiting-a.', NOW(3), NOW(3)),
  (UUID(), 'security.rateLimit.windowSeconds', '60', 'Trajanje rate limit prozora u sekundama.', NOW(3), NOW(3)),
  (UUID(), 'security.rateLimit.maxRequests', '100', 'Maksimalan broj zahtjeva po prozoru.', NOW(3), NOW(3)),

  (UUID(), 'dashboard.defaultTimeRange', '7_DAYS', 'Podrazumijevani vremenski opseg za dashboard grafike.', NOW(3), NOW(3)),
  (UUID(), 'dashboard.showDemountTasksWidget', 'true', 'Da li prikazati widget za demontažne zadatke na dashboardu.', NOW(3), NOW(3)),

  (UUID(), 'tour.web.enabled', 'true', 'Uključivanje web App Tour-a.', NOW(3), NOW(3)),
  (UUID(), 'tour.mobile.enabled', 'true', 'Uključivanje mobile mini-toura.', NOW(3), NOW(3)),

  (UUID(), 'mobile.offlineQueue.enabled', 'true', 'Uključivanje offline queue mehanizma na mobilnoj aplikaciji.', NOW(3), NOW(3)),
  (UUID(), 'mobile.offlineQueue.maxItems', '50', 'Maksimalan broj offline queued akcija.', NOW(3), NOW(3)),
  (UUID(), 'mobile.requireGpsForRecord', 'false', 'Da li je GPS obavezan pri kreiranju zapisnika.', NOW(3), NOW(3)),
  (UUID(), 'mobile.push.testMode', 'false', 'Da li je push test mode uključen (samo test poruke).', NOW(3), NOW(3)),
  (UUID(), 'mobile.push.defaultChannel', 'records', 'Podrazumijevani push kanal (approval/records/system).', NOW(3), NOW(3));

