package com.listeningwith.host.service

import android.service.notification.NotificationListenerService

/**
 * Required for MediaSessionManager.getActiveSessions() to work.
 * The user must grant notification access permission in settings.
 * This service doesn't need to do anything - it just needs to exist and be declared in manifest.
 */
class NotificationListener : NotificationListenerService()
