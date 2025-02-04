package com.markmurphy94.hourly_chime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

class ChimeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        Toast.makeText(context, "Chime Triggered!", Toast.LENGTH_LONG).show()
        // You can also trigger a notification here
    }
}
