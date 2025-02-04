package com.markmurphy94.hourly_chime

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = AlarmModule.NAME)
class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        const val NAME = "AlarmModule"
    }

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun scheduleExactAlarm(timestamp: Double) {
        val context = reactApplicationContext
        val chimeManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java) // BroadcastReceiver to handle chime
        val pendingIntent = PendingIntent.getBroadcast(
            context, 
            0, 
            intent, 
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (chimeManager.canScheduleExactAlarms()) {
                chimeManager.setExact(AlarmManager.RTC_WAKEUP, timestamp.toLong(), pendingIntent)
            }
        } else {
            chimeManager.setExact(AlarmManager.RTC_WAKEUP, timestamp.toLong(), pendingIntent)
        }
    }
}
