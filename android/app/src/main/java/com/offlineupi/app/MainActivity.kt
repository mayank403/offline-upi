package com.offlineupi.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.offlineupi.app.qr.OfflineQrParser
import com.offlineupi.app.telephony.UssdController
import com.offlineupi.app.ui.screens.HomeScreen
import com.offlineupi.app.ui.theme.OfflineUPITheme

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val callGranted = permissions[Manifest.permission.CALL_PHONE] ?: false
        if (!callGranted) {
            Toast.makeText(this, "CALL_PHONE permission is needed to dial USSD (*99#) offline", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkAndRequestPermissions()
        handleIncomingIntent(intent)

        setContent {
            OfflineUPITheme {
                HomeScreen()
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleIncomingIntent(it) }
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CALL_PHONE)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.READ_PHONE_STATE)
        }

        if (permissionsToRequest.isNotEmpty()) {
            requestPermissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    private fun handleIncomingIntent(intent: Intent) {
        val data = intent.dataString ?: return
        if (data.startsWith("upi://pay")) {
            val parsed = OfflineQrParser.parse(data)
            if (parsed != null) {
                Toast.makeText(this, "Offline UPI detected: ${parsed.payeeName} (${parsed.payeeAddress})", Toast.LENGTH_LONG).show()
                // Automatically dial *99*1*2# (Send via UPI ID)
                UssdController.dialUssd(this, parsed.toUssdDialCode())
            }
        }
    }
}
