package com.listeningwith.spike

import android.service.notification.NotificationListenerService

class NotificationListener : NotificationListenerService() {
    // this service is required for MediaSessionManager.getActiveSessions() to work
    // the user must grant notification access permission in settings
}
